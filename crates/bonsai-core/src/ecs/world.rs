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
        let pipe = VascularPipe::default();

        self.hierarchies.insert(entity, hierarchy);
        self.geometries.insert(entity, geometry);
        self.vascular_pipes.insert(entity, pipe);

        // 若有父实体，挂载进父实体的 children 列表中
        if let Some(parent_ent) = parent {
            if let Some(parent_hier) = self.hierarchies.get_mut(&parent_ent) {
                parent_hier.add_child(entity);
            }
        } else if self.root_entity.is_none() {
            self.root_entity = Some(entity);
        }

        self.topology.mark_dirty();
        entity
    }

    /// 在指定节间上生成潜伏芽 (Bud Entity)
    pub fn spawn_bud(&mut self, parent_internode: Entity, position: [f32; 3], direction: [f32; 3]) -> Entity {
        let entity = self.allocator.allocate();
        let bud = BudComponent::new(parent_internode, position, direction);
        self.buds.insert(entity, bud);
        entity
    }

    /// 在分枝梢头挂载扁平羽裂叶托 (FoliagePad Entity)
    pub fn spawn_foliage_pad(
        &mut self,
        parent_internode: Entity,
        center: [f32; 3],
        normal: [f32; 3],
        leaf_count: u16,
        spread: [f32; 2],
    ) -> Entity {
        let entity = self.allocator.allocate();
        let pad = FoliagePad::new(parent_internode, center, normal, leaf_count, spread);
        self.foliage_pads.insert(entity, pad);
        entity
    }

    /// 级联销毁指定实体及其所有子实体（剪枝子树回收）
    pub fn despawn_subtree(&mut self, target: Entity) -> Vec<Entity> {
        let mut culled = Vec::new();
        let mut stack = vec![target];

        while let Some(current) = stack.pop() {
            culled.push(current);
            if let Some(hier) = self.hierarchies.get(&current) {
                for &child in &hier.children {
                    stack.push(child);
                }
            }
        }

        // 从父节点的 children 列表中移除 target
        if let Some(hier) = self.hierarchies.get(&target) {
            if let Some(parent_ent) = hier.parent {
                if let Some(parent_hier) = self.hierarchies.get_mut(&parent_ent) {
                    parent_hier.remove_child(target);
                }
            }
        }

        // 统一清理被剔除实体的组件
        for &ent in &culled {
            self.hierarchies.remove(&ent);
            self.geometries.remove(&ent);
            self.vascular_pipes.remove(&ent);
            self.wires.remove(&ent);
            self.allocator.deallocate(ent);
        }

        // 同步清理附着在已销毁木质节间上的潜伏芽与叶托
        let culled_set: std::collections::HashSet<Entity> = culled.iter().copied().collect();
        self.buds.retain(|bud_ent, bud| {
            if culled_set.contains(&bud.parent_internode) {
                self.allocator.deallocate(*bud_ent);
                false
            } else {
                true
            }
        });
        self.foliage_pads.retain(|pad_ent, pad| {
            if culled_set.contains(&pad.parent_internode) {
                self.allocator.deallocate(*pad_ent);
                false
            } else {
                true
            }
        });

        self.topology.mark_dirty();
        culled
    }

    /// 刷新并线性化构建自顶向下与自底向上的拓扑排序缓存
    pub fn ensure_topology_cache(&mut self) {
        if !self.topology.is_dirty && !self.topology.top_down_order.is_empty() {
            return;
        }

        self.topology.top_down_order.clear();
        let Some(root) = self.root_entity else {
            self.topology.bottom_up_order.clear();
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

        // 自底向上队列直接为自顶向下队列的逆序
        self.topology.bottom_up_order = self.topology.top_down_order.iter().rev().copied().collect();
        self.topology.is_dirty = false;
    }

    /// 1:1 初始化参考图中“百年夏栎模样木 (Aged Oak Moyogi)”完整植物 ECS 实体集
    pub fn init_aged_oak_moyogi(&mut self) {
        self.clear();

        // 1. 雄浑粗壮主干 (Order 0, 树高梯度收尖)
        let trunk_base = self.spawn_internode([0.0, 0.28, 0.0], [0.01, 0.48, -0.01], 0.135, 0, None, 0);
        let trunk_mid = self.spawn_internode([0.01, 0.48, -0.01], [-0.03, 0.75, 0.02], 0.105, 0, Some(trunk_base), 0);
        let trunk_crotch = self.spawn_internode([-0.03, 0.75, 0.02], [0.03, 0.98, -0.01], 0.082, 0, Some(trunk_mid), 0);
        let trunk_apex_lower = self.spawn_internode([0.03, 0.98, -0.01], [0.04, 1.25, 0.01], 0.058, 0, Some(trunk_crotch), 0);
        let trunk_apex_top = self.spawn_internode([0.04, 1.25, 0.01], [0.02, 1.48, -0.01], 0.038, 5, Some(trunk_apex_lower), 0);

        // 2. 第一大主枝托 (Sashi-Eda, 树高38%向左苍劲平展微垂)
        let b1 = self.spawn_internode([0.03, 0.98, -0.01], [-0.32, 0.94, 0.04], 0.052, 1, Some(trunk_crotch), 1);
        let b1_drop = self.spawn_internode([-0.32, 0.94, 0.04], [-0.58, 0.88, 0.08], 0.038, 1, Some(b1), 2);
        let b1_sub1 = self.spawn_internode([-0.58, 0.88, 0.08], [-0.76, 0.85, 0.12], 0.026, 1, Some(b1_drop), 3);
        let b1_sub1_tip = self.spawn_internode([-0.76, 0.85, 0.12], [-0.88, 0.82, 0.14], 0.018, 1, Some(b1_sub1), 4);
        let b1_sub2 = self.spawn_internode([-0.58, 0.88, 0.08], [-0.62, 0.96, -0.06], 0.024, 1, Some(b1_drop), 3);
        let b1_sub2_tip = self.spawn_internode([-0.62, 0.96, -0.06], [-0.74, 0.98, -0.08], 0.017, 1, Some(b1_sub2), 4);

        // 挂载第一大主枝梢头平展叶托 (Foliage Pads)
        self.spawn_foliage_pad(b1_sub1_tip, [-0.88, 0.82, 0.14], [0.0, 1.0, 0.0], 26, [0.24, 0.18]);
        self.spawn_foliage_pad(b1_sub2_tip, [-0.74, 0.98, -0.08], [0.0, 1.0, 0.0], 22, [0.20, 0.16]);

        // 3. 右侧下层平衡副枝 (Uke-Eda)
        let b2 = self.spawn_internode([0.03, 0.98, -0.01], [0.35, 1.04, -0.05], 0.046, 2, Some(trunk_crotch), 1);
        let b2_sub1 = self.spawn_internode([0.35, 1.04, -0.05], [0.62, 1.06, -0.10], 0.032, 2, Some(b2), 2);
        let b2_sub1_tip = self.spawn_internode([0.62, 1.06, -0.10], [0.80, 1.05, -0.12], 0.022, 2, Some(b2_sub1), 3);
        let b2_sub2 = self.spawn_internode([0.35, 1.04, -0.05], [0.48, 1.15, 0.12], 0.028, 2, Some(b2), 2);
        let b2_sub2_tip = self.spawn_internode([0.48, 1.15, 0.12], [0.65, 1.18, 0.18], 0.018, 2, Some(b2_sub2), 3);

        self.spawn_foliage_pad(b2_sub1_tip, [0.80, 1.05, -0.12], [0.0, 1.0, 0.0], 24, [0.22, 0.16]);
        self.spawn_foliage_pad(b2_sub2_tip, [0.65, 1.18, 0.18], [0.0, 1.0, 0.0], 20, [0.18, 0.14]);

        // 4. 后背深景枝 (Back Branch) 与前方立体枝 (Front Branch)
        let b3_back = self.spawn_internode([0.04, 1.25, 0.01], [-0.08, 1.18, -0.32], 0.035, 3, Some(trunk_apex_lower), 1);
        let b3_back_sub = self.spawn_internode([-0.08, 1.18, -0.32], [-0.18, 1.34, -0.60], 0.022, 3, Some(b3_back), 2);
        self.spawn_foliage_pad(b3_back_sub, [-0.18, 1.34, -0.60], [0.0, 1.0, 0.0], 22, [0.20, 0.16]);

        let b4_front = self.spawn_internode([0.04, 1.25, 0.01], [0.18, 1.22, 0.22], 0.032, 4, Some(trunk_apex_lower), 1);
        let b4_front_sub = self.spawn_internode([0.18, 1.22, 0.22], [0.38, 1.30, 0.35], 0.020, 4, Some(b4_front), 2);
        self.spawn_foliage_pad(b4_front_sub, [0.38, 1.30, 0.35], [0.0, 1.0, 0.0], 18, [0.18, 0.14]);

        // 5. 中上层舒展小分枝
        let b5_l = self.spawn_internode([0.04, 1.25, 0.01], [-0.28, 1.36, 0.02], 0.030, 1, Some(trunk_apex_lower), 1);
        let b5_l_tip = self.spawn_internode([-0.28, 1.36, 0.02], [-0.55, 1.44, 0.06], 0.018, 1, Some(b5_l), 2);
        self.spawn_foliage_pad(b5_l_tip, [-0.55, 1.44, 0.06], [0.0, 1.0, 0.0], 22, [0.20, 0.15]);

        let b6_r = self.spawn_internode([0.04, 1.25, 0.01], [0.26, 1.40, -0.04], 0.028, 2, Some(trunk_apex_lower), 1);
        let b6_r_tip = self.spawn_internode([0.26, 1.40, -0.04], [0.52, 1.48, -0.07], 0.018, 2, Some(b6_r), 2);
        self.spawn_foliage_pad(b6_r_tip, [0.52, 1.48, -0.07], [0.0, 1.0, 0.0], 20, [0.19, 0.14]);

        // 6. 顶端伞房冠顶 (Apex Dome)
        let apex_l = self.spawn_internode([0.02, 1.48, -0.01], [-0.18, 1.68, 0.05], 0.024, 5, Some(trunk_apex_top), 1);
        self.spawn_foliage_pad(apex_l, [-0.18, 1.68, 0.05], [0.0, 1.0, 0.0], 24, [0.21, 0.16]);

        let apex_r = self.spawn_internode([0.02, 1.48, -0.01], [0.18, 1.70, -0.04], 0.022, 5, Some(trunk_apex_top), 1);
        self.spawn_foliage_pad(apex_r, [0.18, 1.70, -0.04], [0.0, 1.0, 0.0], 22, [0.20, 0.15]);

        let apex_c = self.spawn_internode([0.02, 1.48, -0.01], [0.01, 1.82, 0.01], 0.020, 5, Some(trunk_apex_top), 1);
        self.spawn_foliage_pad(apex_c, [0.01, 1.82, 0.01], [0.0, 1.0, 0.0], 26, [0.22, 0.18]);

        // 7. 在骨干主枝关键截剪点植入休眠潜伏芽 (Dormant Buds)
        self.spawn_bud(b1, [-0.28, 0.95, 0.06], [-0.8, 0.2, 0.3]);
        self.spawn_bud(b2, [0.32, 1.05, -0.04], [0.7, 0.3, -0.2]);
        self.spawn_bud(trunk_apex_lower, [0.02, 1.26, 0.08], [0.1, 0.8, 0.4]);

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
        self.topology.mark_dirty();
    }
}
