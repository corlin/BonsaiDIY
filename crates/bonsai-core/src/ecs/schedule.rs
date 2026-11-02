use crate::ecs::world::BonsaiWorld;
use crate::ecs::commands::{BonsaiCommand, CommandExecutionReport};
use crate::ecs::systems::prune_system::run_prune_system;
use crate::ecs::systems::growth_system::run_growth_system;
use crate::ecs::systems::wire_system::{run_apply_wire_system, run_remove_wire_system};
use crate::ecs::systems::pipe_system::run_pipe_model_system;
use crate::ecs::systems::extract_render_system::{run_extract_render_system, ExtractedRenderData};

/// 双轨阶段调度器 (Dual-Track Bonsai Scheduler)
/// 严格拆分“即时交互操作”与“宏观四季生理模拟”
pub struct BonsaiScheduler;

impl BonsaiScheduler {
    /// 执行交互命令 (Interactive Pipeline)
    pub fn execute_command(world: &mut BonsaiWorld, command: BonsaiCommand) -> CommandExecutionReport {
        match command {
            BonsaiCommand::PruneBranch { segment_id } => {
                run_prune_system(world, segment_id)
            }
            BonsaiCommand::ApplyWire { segment_id, gauge_mm, target_bend } => {
                match run_apply_wire_system(world, segment_id, gauge_mm, target_bend) {
                    Ok(()) => CommandExecutionReport {
                        success: true,
                        message: format!("Applied {:.1}mm wire to segment {}", gauge_mm, segment_id),
                        ..Default::default()
                    },
                    Err(e) => CommandExecutionReport {
                        success: false,
                        message: e,
                        ..Default::default()
                    },
                }
            }
            BonsaiCommand::RemoveWire { segment_id } => {
                match run_remove_wire_system(world, segment_id) {
                    Ok(is_set) => CommandExecutionReport {
                        success: true,
                        message: if is_set {
                            "Wire removed: permanent bend set achieved".to_string()
                        } else {
                            "Wire removed: springback occurred (under 2 seasons)".to_string()
                        },
                        ..Default::default()
                    },
                    Err(e) => CommandExecutionReport {
                        success: false,
                        message: e,
                        ..Default::default()
                    },
                }
            }
            BonsaiCommand::AdvanceSeason => {
                let report = run_growth_system(world);
                run_pipe_model_system(world, 2.0, 0.018);
                CommandExecutionReport {
                    success: true,
                    new_internodes_count: report.new_internodes_count,
                    energy_delta: report.energy_delta,
                    message: format!("Advanced to {:?}", report.season),
                    ..Default::default()
                }
            }
            BonsaiCommand::ResetTree { .. } => {
                world.init_aged_oak_moyogi();
                run_pipe_model_system(world, 2.0, 0.018);
                CommandExecutionReport {
                    success: true,
                    message: "Reset tree to reference aged oak moyogi".to_string(),
                    ..Default::default()
                }
            }
        }
    }

    /// 提取渲染数据
    pub fn extract_render_data(world: &mut BonsaiWorld) -> ExtractedRenderData {
        run_extract_render_system(world)
    }
}
