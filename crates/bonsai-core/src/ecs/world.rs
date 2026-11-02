use std::collections::HashMap;
use super::entity::{Entity, EntityAllocator};
use super::components::*;
use super::resources::*;

/// 专有植物 ECS 模拟世界 (BonsaiWorld)
/// 严格遵循数据驱动设计 (DOD) 与纯净状态隔离，彻底解耦渲染与仿真状态
pub struct BonsaiWorld {
    pub allocator: EntityAllocator,

    // 组件稀疏存储池
    pub hierarchies: HashMap<Entity, Hierarchy>,
    pub geometries: HashMap<Entity, SegmentGeometry>,
    pub vascular_pipes: HashMap<Entity, VascularPipe>,
    pub buds: HashMap<Entity, BudComponent>,
    pub foliage_pads: HashMap<Entity, FoliagePad>,
    pub wires: HashMap<Entity, WireFixture>,

    // 全局单例资源 (Resources)
    pub season: SeasonResource,
    pub energy: EnergyPoolResource,
    pub topology: TopologyCacheResource,
    pub rng: RngResource,

    // 快速查找根节点
    pub root_entity: Option<Entity>,
}

impl BonsaiWorld {
    pub fn new(seed: u64) -> Self {
        Self {
            allocator: EntityAllocator::new(),
            hierarchies: HashMap::with_capacity(128),
            geometries: HashMap::with_capacity(128),
            vascular_pipes: HashMap::with_capacity(128),
            buds: HashMap::with_capacity(128),
            foliage_pads: HashMap::with_capacity(64),
            wires: HashMap::with_capacity(32),
            season: SeasonResource::default(),
            energy: EnergyPoolResource::default(),
            topology: TopologyCacheResource::default(),
            rng: RngResource::new(seed),
            root_entity: None,
        }
    }

    /// 创建一个木质化节间实体 (Internode Entity)
    pub fn spawn_internode(
        &mut self,
        start: [f32; 3],
        end: [f32; 3],
        radius: f32,
        role: u8,
        parent: Option<Entity>,
        order: u8,
    ) -> Entity {
        let entity = self.allocator.allocate();

        let hierarchy = Hierarchy::new(parent, order);
        let geometry = SegmentGeometry::new(start, end, radius, role);
        let effective_area = std::f32::consts::PI * radius * radius;
        let pipe = VascularPipe {
            exponent: 2.0,
            effective_area,
            cambium_growth: 0.0,
        };

        self.hierarchies.insert(entity, hierarchy);
        self.geometries.insert(entity, geometry);
        self.vascular_pipes.insert(entity, pipe);

        // 如果是子节点，挂载到父节点的 children 列表
        if let Some(parent_entity) = parent {
            if let Some(parent_hier) = self.hierarchies.get_mut(&parent_entity) {
                parent_hier.children.push(entity);
            }
        } else if self.root_entity.is_none() {
            self.root_entity = Some(entity);
        }

        self.topology.is_dirty = true;
        entity
    }

    /// 创建一个芽点组件 (Bud)
    pub fn spawn_bud(&mut self, parent_internode: Entity, position: [f32; 3], direction: [f32; 3]) -> Entity {
        let bud_entity = self.allocator.allocate();
        let bud = BudComponent {
            parent_internode,
            position,
            direction,
            state: BudState::Dormant,
            auxin_inhibition: 1.0,
            vigor: 0.8,
        };
        self.buds.insert(bud_entity, bud);
        bud_entity
    }

    /// 创建一个微观枝托叶云 (FoliagePad)
    pub fn spawn_foliage_pad(
        &mut self,
        parent_internode: Entity,
        center: [f32; 3],
        normal: [f32; 3],
        leaf_count: usize,
        spread_radius: [f32; 2],
    ) {
        let pad = FoliagePad::new(
            parent_internode,
            center,
            normal,
            leaf_count as u16,
            spread_radius,
        );
        self.foliage_pads.insert(parent_internode, pad);
    }

    /// 级联销毁以 target 为根的完整子树 (用于蓄枝截干修剪)
    pub fn despawn_subtree(&mut self, target: Entity) -> Vec<Entity> {
        let mut pruned = Vec::new();
        let mut stack = vec![target];

        // 收集子树的所有节点
        while let Some(current) = stack.pop() {
            pruned.push(current);
            if let Some(hier) = self.hierarchies.get(&current) {
                for &child in &hier.children {
                    stack.push(child);
                }
            }
        }

        // 从父节点的 children 列表中移除 target
        if let Some(target_hier) = self.hierarchies.get(&target) {
            if let Some(parent_entity) = target_hier.parent {
                if let Some(parent_hier) = self.hierarchies.get_mut(&parent_entity) {
                    parent_hier.children.retain(|&c| c != target);
                }
            }
        }

        // 彻底释放组件
        for &ent in &pruned {
            self.hierarchies.remove(&ent);
            self.geometries.remove(&ent);
            self.vascular_pipes.remove(&ent);
            self.wires.remove(&ent);
            self.allocator.deallocate(ent);
        }

        // 清理依附于被删除实体的芽点与叶托
        self.buds.retain(|_, b| !pruned.contains(&b.parent_internode));
        self.foliage_pads.retain(|pad_ent, _| !pruned.contains(pad_ent));

        if Some(target) == self.root_entity {
            self.root_entity = None;
        }

        self.topology.is_dirty = true;
        self.ensure_topology_cache();

        pruned
    }

    /// 维护拓扑拓扑排序线性缓存队列 (Top-down & Bottom-up)
    /// 确保后续所有物理/水力计算 100% 具备缓存局部性，完全消除递归栈深度
    pub fn ensure_topology_cache(&mut self) {
        if !self.topology.is_dirty {
            return;
        }

        self.topology.top_down_order.clear();
        self.topology.bottom_up_order.clear();

        let Some(root) = self.root_entity else {
            self.topology.is_dirty = false;
            return;
        };

        // BFS / 前序深度遍历构建连续线性拓扑队列
        let mut queue = std::collections::VecDeque::new();
        queue.push_back(root);

        while let Some(current) = queue.pop_front() {
            self.topology.top_down_order.push(current);
            if let Some(hier) = self.hierarchies.get(&current) {
                for &child in &hier.children {
                    queue.push_back(child);
                }
            }
        }

        // 自底向上队列为自顶向下的严格逆序
        self.topology.bottom_up_order = self.topology.top_down_order.iter().rev().copied().collect();
        self.topology.is_dirty = false;
    }

    /// 初始化经典百年名品夏栎（模样木 Moyogi）
    /// 全三级仿生分叉架构（3-Level Ramification）：
    /// 主干 (Order 0) -> 一级主枝 (Order 1) -> 二级副枝 (Order 2) -> 三级细梢 (Order 3)
    pub fn init_aged_oak_moyogi(&mut self) {
        self.clear();

        // 1. 雄浑粗壮主干 (Order 0, 从盆面低缓土丘 y=0.165 出土，自然曲度收尖)
        let trunk_base = self.spawn_internode([0.0, 0.165, 0.0], [0.01, 0.365, -0.01], 0.075, 0, None, 0);
        let trunk_mid = self.spawn_internode([0.01, 0.365, -0.01], [-0.03, 0.625, 0.02], 0.058, 0, Some(trunk_base), 0);
        let trunk_crotch = self.spawn_internode([-0.03, 0.625, 0.02], [0.03, 0.845, -0.01], 0.046, 0, Some(trunk_mid), 0);
        let trunk_apex_lower = self.spawn_internode([0.03, 0.845, -0.01], [0.04, 1.095, 0.01], 0.034, 0, Some(trunk_crotch), 0);
        let trunk_apex_top = self.spawn_internode([0.04, 1.095, 0.01], [0.02, 1.325, -0.01], 0.022, 5, Some(trunk_apex_lower), 0);

        // 2. 第一大主枝系统 (Sashi-Eda, 树高38%向左平展苍劲微垂，带前/中/后三向二级侧枝与细梢)
        let b1 = self.spawn_internode([0.03, 0.845, -0.01], [-0.32, 0.825, 0.03], 0.034, 1, Some(trunk_crotch), 1);
        let b1_drop = self.spawn_internode([-0.32, 0.825, 0.03], [-0.56, 0.775, 0.07], 0.026, 1, Some(b1), 1);

        // b1 前侧副枝 (Order 2) 与细梢 (Order 3)
        let b1_f = self.spawn_internode([-0.56, 0.775, 0.07], [-0.72, 0.755, 0.18], 0.018, 1, Some(b1_drop), 2);
        let b1_f_tip = self.spawn_internode([-0.72, 0.755, 0.18], [-0.86, 0.735, 0.24], 0.010, 1, Some(b1_f), 3);
        self.spawn_foliage_pad(b1_f_tip, [-0.86, 0.735, 0.24], [0.0, 1.0, 0.0], 34, [0.22, 0.16]);

        // b1 主轴梢头 (Order 2) 与细梢 (Order 3)
        let b1_m = self.spawn_internode([-0.56, 0.775, 0.07], [-0.78, 0.745, 0.05], 0.019, 1, Some(b1_drop), 2);
        let b1_m_tip = self.spawn_internode([-0.78, 0.745, 0.05], [-0.94, 0.725, 0.06], 0.011, 1, Some(b1_m), 3);
        self.spawn_foliage_pad(b1_m_tip, [-0.94, 0.725, 0.06], [0.0, 1.0, 0.0], 36, [0.24, 0.18]);

        // b1 后侧副枝 (Order 2) 与细梢 (Order 3)
        let b1_b = self.spawn_internode([-0.56, 0.775, 0.07], [-0.68, 0.805, -0.08], 0.017, 1, Some(b1_drop), 2);
        let b1_b_tip = self.spawn_internode([-0.68, 0.805, -0.08], [-0.82, 0.825, -0.14], 0.010, 1, Some(b1_b), 3);
        self.spawn_foliage_pad(b1_b_tip, [-0.82, 0.825, -0.14], [0.0, 1.0, 0.0], 32, [0.20, 0.15]);

        // 3. 第二大平衡主枝系统 (Uke-Eda, 右侧上扬抗衡，带前/中/后三向细密枝托)
        let b2 = self.spawn_internode([0.03, 0.845, -0.01], [0.35, 0.895, -0.04], 0.030, 2, Some(trunk_crotch), 1);
        let b2_ext = self.spawn_internode([0.35, 0.895, -0.04], [0.60, 0.915, -0.08], 0.022, 2, Some(b2), 1);

        let b2_f = self.spawn_internode([0.60, 0.915, -0.08], [0.72, 0.945, 0.08], 0.016, 2, Some(b2_ext), 2);
        let b2_f_tip = self.spawn_internode([0.72, 0.945, 0.08], [0.85, 0.965, 0.16], 0.010, 2, Some(b2_f), 3);
        self.spawn_foliage_pad(b2_f_tip, [0.85, 0.965, 0.16], [0.0, 1.0, 0.0], 32, [0.21, 0.15]);

        let b2_m = self.spawn_internode([0.60, 0.915, -0.08], [0.78, 0.905, -0.12], 0.017, 2, Some(b2_ext), 2);
        let b2_m_tip = self.spawn_internode([0.78, 0.905, -0.12], [0.92, 0.895, -0.15], 0.010, 2, Some(b2_m), 3);
        self.spawn_foliage_pad(b2_m_tip, [0.92, 0.895, -0.15], [0.0, 1.0, 0.0], 34, [0.22, 0.16]);

        let b2_b = self.spawn_internode([0.60, 0.915, -0.08], [0.66, 0.955, -0.22], 0.015, 2, Some(b2_ext), 2);
        let b2_b_tip = self.spawn_internode([0.66, 0.955, -0.22], [0.76, 0.975, -0.32], 0.009, 2, Some(b2_b), 3);
        self.spawn_foliage_pad(b2_b_tip, [0.76, 0.975, -0.32], [0.0, 1.0, 0.0], 30, [0.19, 0.14]);

        // 4. 后背深景枝系统 (Back Branch, 构筑纵深深度)
        let b3 = self.spawn_internode([0.04, 1.095, 0.01], [-0.08, 1.055, -0.28], 0.022, 3, Some(trunk_apex_lower), 1);
        let b3_f1 = self.spawn_internode([-0.08, 1.055, -0.28], [-0.22, 1.125, -0.46], 0.015, 3, Some(b3), 2);
        let b3_f1_tip = self.spawn_internode([-0.22, 1.125, -0.46], [-0.32, 1.165, -0.58], 0.009, 3, Some(b3_f1), 3);
        self.spawn_foliage_pad(b3_f1_tip, [-0.32, 1.165, -0.58], [0.0, 1.0, 0.0], 30, [0.20, 0.15]);

        let b3_f2 = self.spawn_internode([-0.08, 1.055, -0.28], [0.06, 1.105, -0.44], 0.014, 3, Some(b3), 2);
        let b3_f2_tip = self.spawn_internode([0.06, 1.105, -0.44], [0.15, 1.145, -0.55], 0.009, 3, Some(b3_f2), 3);
        self.spawn_foliage_pad(b3_f2_tip, [0.15, 1.145, -0.55], [0.0, 1.0, 0.0], 28, [0.19, 0.14]);

        // 5. 前方立体枝系统 (Front Branch, 强化三维破空感)
        let b4 = self.spawn_internode([0.04, 1.095, 0.01], [0.16, 1.065, 0.20], 0.020, 4, Some(trunk_apex_lower), 1);
        let b4_f1 = self.spawn_internode([0.16, 1.065, 0.20], [0.32, 1.115, 0.32], 0.014, 4, Some(b4), 2);
        let b4_f1_tip = self.spawn_internode([0.32, 1.115, 0.32], [0.44, 1.135, 0.40], 0.009, 4, Some(b4_f1), 3);
        self.spawn_foliage_pad(b4_f1_tip, [0.44, 1.135, 0.40], [0.0, 1.0, 0.0], 28, [0.18, 0.14]);

        let b4_f2 = self.spawn_internode([0.16, 1.065, 0.20], [0.12, 1.145, 0.30], 0.013, 4, Some(b4), 2);
        let b4_f2_tip = self.spawn_internode([0.12, 1.145, 0.30], [0.10, 1.175, 0.38], 0.009, 4, Some(b4_f2), 3);
        self.spawn_foliage_pad(b4_f2_tip, [0.10, 1.175, 0.38], [0.0, 1.0, 0.0], 26, [0.17, 0.13]);

        // 6. 中上层舒展枝组 (左右交替过渡层)
        let b5_l = self.spawn_internode([0.04, 1.095, 0.01], [-0.25, 1.205, 0.02], 0.020, 1, Some(trunk_apex_lower), 1);
        let b5_l_f1 = self.spawn_internode([-0.25, 1.205, 0.02], [-0.44, 1.265, 0.08], 0.014, 1, Some(b5_l), 2);
        let b5_l_f1_tip = self.spawn_internode([-0.44, 1.265, 0.08], [-0.58, 1.295, 0.12], 0.009, 1, Some(b5_l_f1), 3);
        self.spawn_foliage_pad(b5_l_f1_tip, [-0.58, 1.295, 0.12], [0.0, 1.0, 0.0], 30, [0.20, 0.15]);

        let b5_l_f2 = self.spawn_internode([-0.25, 1.205, 0.02], [-0.38, 1.255, -0.06], 0.013, 1, Some(b5_l), 2);
        let b5_l_f2_tip = self.spawn_internode([-0.38, 1.255, -0.06], [-0.50, 1.285, -0.10], 0.009, 1, Some(b5_l_f2), 3);
        self.spawn_foliage_pad(b5_l_f2_tip, [-0.50, 1.285, -0.10], [0.0, 1.0, 0.0], 28, [0.19, 0.14]);

        let b6_r = self.spawn_internode([0.04, 1.095, 0.01], [0.24, 1.235, -0.03], 0.019, 2, Some(trunk_apex_lower), 1);
        let b6_r_f1 = self.spawn_internode([0.24, 1.235, -0.03], [0.42, 1.295, -0.06], 0.013, 2, Some(b6_r), 2);
        let b6_r_f1_tip = self.spawn_internode([0.42, 1.295, -0.06], [0.55, 1.335, -0.08], 0.009, 2, Some(b6_r_f1), 3);
        self.spawn_foliage_pad(b6_r_f1_tip, [0.55, 1.335, -0.08], [0.0, 1.0, 0.0], 30, [0.20, 0.15]);

        let b6_r_f2 = self.spawn_internode([0.04, 1.095, 0.01], [0.36, 1.285, 0.08], 0.013, 2, Some(b6_r), 2);
        let b6_r_f2_tip = self.spawn_internode([0.36, 1.285, 0.08], [0.46, 1.315, 0.14], 0.009, 2, Some(b6_r_f2), 3);
        self.spawn_foliage_pad(b6_r_f2_tip, [0.46, 1.315, 0.14], [0.0, 1.0, 0.0], 28, [0.19, 0.14]);

        // 7. 顶端伞房冠顶系统 (Apex Dome, 丰满三角形聚伞)
        let apex_l = self.spawn_internode([0.02, 1.325, -0.01], [-0.14, 1.485, 0.04], 0.016, 5, Some(trunk_apex_top), 1);
        let apex_l_tip = self.spawn_internode([-0.14, 1.485, 0.04], [-0.24, 1.555, 0.06], 0.010, 5, Some(apex_l), 2);
        self.spawn_foliage_pad(apex_l_tip, [-0.24, 1.555, 0.06], [0.0, 1.0, 0.0], 32, [0.21, 0.15]);

        let apex_r = self.spawn_internode([0.02, 1.325, -0.01], [0.15, 1.495, -0.03], 0.015, 5, Some(trunk_apex_top), 1);
        let apex_r_tip = self.spawn_internode([0.15, 1.495, -0.03], [0.24, 1.565, -0.05], 0.010, 5, Some(apex_r), 2);
        self.spawn_foliage_pad(apex_r_tip, [0.24, 1.565, -0.05], [0.0, 1.0, 0.0], 30, [0.20, 0.15]);

        let apex_c = self.spawn_internode([0.02, 1.325, -0.01], [0.01, 1.545, 0.01], 0.015, 5, Some(trunk_apex_top), 1);
        let apex_c_tip = self.spawn_internode([0.01, 1.545, 0.01], [0.01, 1.665, 0.01], 0.010, 5, Some(apex_c), 2);
        self.spawn_foliage_pad(apex_c_tip, [0.01, 1.665, 0.01], [0.0, 1.0, 0.0], 36, [0.24, 0.18]);

        // 8. 关键剪定蓄枝点植入休眠潜伏芽 (Dormant Buds)
        self.spawn_bud(b1, [-0.28, 0.825, 0.06], [-0.8, 0.2, 0.3]);
        self.spawn_bud(b2, [0.32, 0.915, -0.04], [0.7, 0.3, -0.2]);
        self.spawn_bud(trunk_apex_lower, [0.02, 1.105, 0.08], [0.1, 0.8, 0.4]);

        self.ensure_topology_cache();
    }

    pub fn clear(&mut self) {
        self.allocator.clear();
        self.hierarchies.clear();
        self.geometries.clear();
        self.vascular_pipes.clear();
        self.buds.clear();
        self.foliage_pads.clear();
        self.wires.clear();
        self.root_entity = None;
        self.topology.top_down_order.clear();
        self.topology.bottom_up_order.clear();
        self.topology.is_dirty = false;
    }
}
