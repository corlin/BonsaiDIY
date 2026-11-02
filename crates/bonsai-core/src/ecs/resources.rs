use serde::{Deserialize, Serialize};
use super::entity::Entity;

/// 确定性伪随机数发生器 (DeterministicRng)
/// 采用高效轻量的 Xorshift64 算法，保证生长模拟跨平台 100% 可重现
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DeterministicRng {
    state: u64,
}

impl DeterministicRng {
    pub fn new(seed: u64) -> Self {
        let state = if seed == 0 { 0x853c49e6748fea9b } else { seed };
        Self { state }
    }

    pub fn next_u32(&mut self) -> u32 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.state = x;
        (x & 0xFFFFFFFF) as u32
    }

    pub fn next_f32(&mut self) -> f32 {
        (self.next_u32() as f32) / 4294967296.0
    }

    pub fn range(&mut self, min: f32, max: f32) -> f32 {
        min + self.next_f32() * (max - min)
    }
}

/// 四季生命周期枚举 (Season)
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Season {
    Spring,
    Summer,
    Autumn,
    Winter,
}

/// 四季生命周期资源 (SeasonResource)
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SeasonResource {
    pub current: Season,
    pub year: u32,
}

impl Default for SeasonResource {
    fn default() -> Self {
        Self {
            current: Season::Spring,
            year: 1,
        }
    }
}

impl SeasonResource {
    pub fn advance(&mut self) -> Season {
        match self.current {
            Season::Spring => {
                self.current = Season::Summer;
            }
            Season::Summer => {
                self.current = Season::Autumn;
            }
            Season::Autumn => {
                self.current = Season::Winter;
            }
            Season::Winter => {
                self.current = Season::Spring;
                self.year += 1;
            }
        }
        self.current
    }
}

/// 能量平衡池资源 (EnergyPoolResource)
/// 模拟非结构性碳水化合物 (NSC) 的四季流动与分配
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct EnergyPoolResource {
    pub nsc_stored: f32,
    pub max_capacity: f32,
    pub annual_photosynthesis: f32,
    pub last_biomass_loss_ratio: f32,
}

impl Default for EnergyPoolResource {
    fn default() -> Self {
        Self {
            nsc_stored: 100.0,
            max_capacity: 100.0,
            annual_photosynthesis: 0.0,
            last_biomass_loss_ratio: 0.0,
        }
    }
}

/// 拓扑遍历缓存资源 (TopologyCacheResource)
/// 借鉴 Egregoria 扁平线性化思想：彻底规避深层递归调用
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct TopologyCacheResource {
    /// 自顶向下线性数组（供生长素 Auxin、位姿旋转正序遍历）
    pub top_down_order: Vec<Entity>,
    /// 自底向上线性数组（供达芬奇管道截面积累加、秋季养分回流逆序遍历）
    pub bottom_up_order: Vec<Entity>,
    /// 层级结构脏标记
    pub is_dirty: bool,
}

impl TopologyCacheResource {
    pub fn mark_dirty(&mut self) {
        self.is_dirty = true;
    }
}

/// 确定性随机数生成器资源 (RngResource)
pub struct RngResource {
    pub rng: DeterministicRng,
}

impl RngResource {
    pub fn new(seed: u64) -> Self {
        Self {
            rng: DeterministicRng::new(seed),
        }
    }
}
