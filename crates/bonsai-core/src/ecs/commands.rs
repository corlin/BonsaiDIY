use serde::{Deserialize, Serialize};

/// 盆景世界交互命令 (BonsaiCommand)
/// 借鉴 Egregoria `WorldCommand` 模式：将一切外部交互封装为纯确定性命令，
/// 严格隔离用户输入与 ECS 仿真核心，原生支持确定性录制、重放与 Undo/Redo
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum BonsaiCommand {
    /// 修剪指定节段（级联销毁子树并激活潜伏芽）
    PruneBranch { segment_id: u32 },
    /// 缠绕定型铝丝
    ApplyWire {
        segment_id: u32,
        gauge_mm: f32,
        target_bend: [f32; 3],
    },
    /// 拆除定型铝丝
    RemoveWire { segment_id: u32 },
    /// 推进一个生长季 (春/夏/秋/冬)
    AdvanceSeason,
    /// 重置树形为初始名木拓扑
    ResetTree { seed: u32 },
}

/// 命令执行结果与事件审计报告
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct CommandExecutionReport {
    pub success: bool,
    pub biomass_loss_ratio: f32,
    pub pruned_internodes_count: usize,
    pub awakened_buds_count: usize,
    pub new_internodes_count: usize,
    pub energy_delta: f32,
    pub message: String,
}
