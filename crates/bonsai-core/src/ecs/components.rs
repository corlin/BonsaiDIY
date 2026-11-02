use serde::{Deserialize, Serialize};
use super::entity::Entity;

/// 树状父子层级关系组件 (Hierarchy Component)
/// 借鉴 Bevy 的 `Parent` 与 `Children` 设计，原生嵌入分支级数 (BranchOrder)
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Hierarchy {
    pub parent: Option<Entity>,
    pub children: Vec<Entity>,
    pub order: u8, // 0: 主干, 1: 一级主枝, 2: 二级副枝, 3: 细分侧枝, 4+: 极细末梢
}

impl Hierarchy {
    pub fn new(parent: Option<Entity>, order: u8) -> Self {
        Self {
            parent,
            children: Vec::with_capacity(4),
            order,
        }
    }

    pub fn add_child(&mut self, child: Entity) {
        if !self.children.contains(&child) {
            self.children.push(child);
        }
    }

    pub fn remove_child(&mut self, child: Entity) {
        self.children.retain(|&c| c != child);
    }
}

/// 节段三维几何组件 (SegmentGeometry Component)
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SegmentGeometry {
    pub start: [f32; 3],
    pub end: [f32; 3],
    pub radius: f32,
    pub aesthetic_role: u8, // 0: Trunk, 1: SashiEda(左大主枝), 2: UkeEda(右平衡枝), 3: Back, 4: Front, 5: Apex(顶冠)
}

impl SegmentGeometry {
    pub fn new(start: [f32; 3], end: [f32; 3], radius: f32, role: u8) -> Self {
        Self {
            start,
            end,
            radius,
            aesthetic_role: role,
        }
    }

    pub fn length(&self) -> f32 {
        let dx = self.end[0] - self.start[0];
        let dy = self.end[1] - self.start[1];
        let dz = self.end[2] - self.start[2];
        (dx * dx + dy * dy + dz * dz).sqrt()
    }

    pub fn direction(&self) -> [f32; 3] {
        let len = self.length();
        if len < 1e-6 {
            [0.0, 1.0, 0.0]
        } else {
            [
                (self.end[0] - self.start[0]) / len,
                (self.end[1] - self.start[1]) / len,
                (self.end[2] - self.start[2]) / len,
            ]
        }
    }
}

/// 维管束与水力管道模型组件 (VascularPipe Component)
/// 基于达芬奇管道模型 (Leonardo da Vinci Area Conservation)
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct VascularPipe {
    pub exponent: f32,       // 截面积守恒指数，夏栎等硬阔叶树通常为 2.0
    pub effective_area: f32, // 活维管束截面积
    pub cambium_growth: f32, // 形成层年轮加粗量
}

impl Default for VascularPipe {
    fn default() -> Self {
        Self {
            exponent: 2.0,
            effective_area: 0.001,
            cambium_growth: 0.0,
        }
    }
}

/// 芽生化发育状态枚举
#[derive(Copy, Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum BudState {
    Dormant,  // 深度休眠（受顶端优势生长素抑制）
    Swelling, // 膨大萌动（春季解冻或剪去主枝后激活）
    Flushed,  // 已抽梢萌发为新木质化节段
    Aborted,  // 枯萎败育
}

/// 潜伏芽组件 (BudComponent)
/// 依附于木质化节间，受顶端优势与生长素浓度的负反馈调控
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct BudComponent {
    pub parent_internode: Entity,
    pub position: [f32; 3],
    pub direction: [f32; 3],
    pub state: BudState,
    pub auxin_inhibition: f32, // 顶端优势生长素浓度 [0.0, 1.0]
    pub vigor: f32,            // 芽势活力
}

impl BudComponent {
    pub fn new(parent_internode: Entity, position: [f32; 3], direction: [f32; 3]) -> Self {
        Self {
            parent_internode,
            position,
            direction,
            state: BudState::Dormant,
            auxin_inhibition: 1.0,
            vigor: 1.0,
        }
    }
}

/// 梢头单层羽裂叶托组件 (FoliagePad Component)
/// 独立实体化挂载于分枝梢头，光合作用的核心发生地
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct FoliagePad {
    pub parent_internode: Entity,
    pub center: [f32; 3],
    pub normal: [f32; 3],
    pub leaf_count: u16,
    pub spread: [f32; 2], // [半长轴, 半短轴] 扁平椭圆枝托展开半径
    pub chlorophyll: f32, // 叶绿素活性 (受四季季相调控)
}

impl FoliagePad {
    pub fn new(parent_internode: Entity, center: [f32; 3], normal: [f32; 3], leaf_count: u16, spread: [f32; 2]) -> Self {
        Self {
            parent_internode,
            center,
            normal,
            leaf_count,
            spread,
            chlorophyll: 1.0,
        }
    }
}

/// 铝丝定型夹具组件 (WireFixture Component)
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct WireFixture {
    pub gauge_mm: f32,
    pub initial_dir: [f32; 3],
    pub target_bend: [f32; 3],
    pub season_counter: u8,
    pub has_bitten: bool,
}
