use wasm_bindgen::prelude::*;
use crate::ecs::world::BonsaiWorld;
use crate::ecs::schedule::BonsaiScheduler;
use crate::ecs::commands::BonsaiCommand;
use crate::ecs::systems::pipe_system::run_pipe_model_system;
use crate::ecs::systems::rule_audit_system::run_rule_audit_system;

/// WASM 跨语言桥接引擎 (BonsaiWasmEngine)
/// 彻底基于纯净 ECS 架构 (BonsaiWorld + BonsaiScheduler)
/// 严格解耦物理仿真与图形渲染，支持多通道零拷贝缓冲区提取
#[wasm_bindgen]
pub struct BonsaiWasmEngine {
    world: BonsaiWorld,
}

#[wasm_bindgen]
impl BonsaiWasmEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u32) -> Self {
        let mut world = BonsaiWorld::new(seed as u64);
        world.init_aged_oak_moyogi();
        run_pipe_model_system(&mut world, 2.0, 0.018);
        Self { world }
    }

    /// 修剪指定枝段 (通过 BonsaiCommand 执行原子剪枝与潜伏芽激活)
    pub fn prune_branch(&mut self, segment_id: u32) -> bool {
        let report = BonsaiScheduler::execute_command(
            &mut self.world,
            BonsaiCommand::PruneBranch { segment_id },
        );
        report.success
    }

    /// 推进生长季 (通过 BonsaiCommand 执行春抽梢/夏加粗/秋回流/冬休眠)
    pub fn advance_season(&mut self) -> String {
        let prev_season = self.world.season.current;
        let prev_energy = self.world.energy.nsc_stored;

        let report = BonsaiScheduler::execute_command(
            &mut self.world,
            BonsaiCommand::AdvanceSeason,
        );

        let json_report = serde_json::json!({
            "season": format!("{:?}", self.world.season.current),
            "completed_season": format!("{:?}", prev_season),
            "year": self.world.season.year,
            "energy_pool": self.world.energy.nsc_stored,
            "energy_delta": self.world.energy.nsc_stored - prev_energy,
            "new_internodes_count": report.new_internodes_count,
            "cambium_thickened": prev_season == crate::ecs::resources::Season::Summer,
            "defoliated": prev_season == crate::ecs::resources::Season::Winter,
        });

        json_report.to_string()
    }

    /// 运行 Wiki 造型与比例美学规则审计系统
    pub fn evaluate_rules(&self, recent_loss: f32) -> String {
        let issues = run_rule_audit_system(&self.world, recent_loss);
        serde_json::to_string(&issues).unwrap_or_else(|_| "[]".to_string())
    }

    /// 获取整树概况元数据
    pub fn get_tree_info(&self) -> String {
        let info = serde_json::json!({
            "season": format!("{:?}", self.world.season.current),
            "year": self.world.season.year,
            "energy_pool": self.world.energy.nsc_stored,
            "segment_count": self.world.geometries.len(),
            "foliage_pads_count": self.world.foliage_pads.len(),
            "buds_count": self.world.buds.len(),
        });
        info.to_string()
    }

    /// 获取最近一次修剪造成的生物质损失比例
    pub fn get_last_loss_ratio(&self) -> f32 {
        self.world.energy.last_biomass_loss_ratio
    }

    /// 缠绕金属丝塑性定型
    pub fn apply_wire(&mut self, segment_id: u32, gauge_mm: f32, dx: f32, dy: f32, dz: f32) -> bool {
        let report = BonsaiScheduler::execute_command(
            &mut self.world,
            BonsaiCommand::ApplyWire {
                segment_id,
                gauge_mm,
                target_bend: [dx, dy, dz],
            },
        );
        report.success
    }

    /// 拆除金属丝
    pub fn remove_wire(&mut self, segment_id: u32) -> bool {
        let report = BonsaiScheduler::execute_command(
            &mut self.world,
            BonsaiCommand::RemoveWire { segment_id },
        );
        report.success
    }

    /// 抽取枝干几何通道 (9-Float 步长，直接映射 Float32Array 零拷贝切片)
    /// [id, order, radius, start_x, start_y, start_z, end_x, end_y, end_z]
    pub fn get_segments_buffer(&mut self) -> Vec<f32> {
        let extracted = BonsaiScheduler::extract_render_data(&mut self.world);
        extracted.segments_buffer
    }

    /// 抽取梢头叶托通道 (8-Float 步长，供 GPU InstancedMesh 批量实例化)
    /// [parent_id, center_x, center_y, center_z, normal_x, normal_y, normal_z, leaf_count]
    pub fn get_foliage_buffer(&mut self) -> Vec<f32> {
        let extracted = BonsaiScheduler::extract_render_data(&mut self.world);
        extracted.foliage_buffer
    }

    /// 抽取潜伏芽位通道 (6-Float 步长)
    /// [parent_id, pos_x, pos_y, pos_z, dir_x, state]
    pub fn get_buds_buffer(&mut self) -> Vec<f32> {
        let extracted = BonsaiScheduler::extract_render_data(&mut self.world);
        extracted.buds_buffer
    }

    /// 统一通用命令执行入口 (支持 JSON 格式指令输入与确定性回放)
    pub fn execute_command(&mut self, command_json: &str) -> String {
        let cmd: Result<BonsaiCommand, _> = serde_json::from_str(command_json);
        match cmd {
            Ok(command) => {
                let report = BonsaiScheduler::execute_command(&mut self.world, command);
                serde_json::to_string(&report).unwrap_or_else(|_| "{}".to_string())
            }
            Err(e) => {
                serde_json::json!({
                    "success": false,
                    "message": format!("Invalid command JSON: {}", e)
                }).to_string()
            }
        }
    }
}
