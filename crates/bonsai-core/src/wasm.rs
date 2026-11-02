use wasm_bindgen::prelude::*;
use crate::model::TreeGraph;
use crate::rng::DeterministicRng;
use crate::prune::PruningEngine;
use crate::growth::GrowthEngine;
use crate::wire::WireEngine;
use crate::rules::RuleEngine;

#[wasm_bindgen]
pub struct BonsaiWasmEngine {
    tree: TreeGraph,
    rng: DeterministicRng,
    pruning: PruningEngine,
    growth: GrowthEngine,
    rule_engine: RuleEngine,
    last_biomass_loss: f32,
}

#[wasm_bindgen]
impl BonsaiWasmEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u32) -> Self {
        let mut engine = Self {
            tree: TreeGraph::new(),
            rng: DeterministicRng::new(seed as u64),
            pruning: PruningEngine::new(),
            growth: GrowthEngine::new(),
            rule_engine: RuleEngine::new(),
            last_biomass_loss: 0.0,
        };
        engine.init_default_tree();
        engine
    }

    /// 构建一棵兼具自然曲度与多层云片潜力的经典模样木 (Moyogi) 初级生胚老桩
    fn init_default_tree(&mut self) {
        // 1. 基底老干 (微倾斜破除呆板垂直)
        let base = self.tree.create_base_internode([0.0, 0.25, 0.0], [0.04, 0.65, -0.02]);
        // 2. 主干第一弯 (之字形过渡)
        let trunk_mid = self.tree.attach_internode(base, [-0.06, 1.05, 0.05], 0, 10);
        // 3. 梢头回抱 (树势顾盼生姿)
        let trunk_apex = self.tree.attach_internode(trunk_mid, [0.02, 1.45, 0.0], 0, 16);

        // 4. 第一主枝 (左侧飘逸长枝，出枝点稳健)
        let b1 = self.tree.attach_internode(base, [0.38, 0.68, 0.12], 1, 14);
        self.tree.attach_internode(b1, [0.65, 0.78, 0.18], 2, 18);
        self.tree.attach_internode(b1, [0.52, 0.88, -0.05], 2, 12);

        // 5. 第二副枝 (右后方立体衬托)
        let b2 = self.tree.attach_internode(trunk_mid, [-0.35, 1.08, -0.22], 1, 15);
        self.tree.attach_internode(b2, [-0.58, 1.18, -0.32], 2, 20);

        // 6. 顶端结顶主云片枝
        let apex_left = self.tree.attach_internode(trunk_apex, [-0.18, 1.62, 0.1], 1, 16);
        let apex_right = self.tree.attach_internode(trunk_apex, [0.15, 1.68, -0.08], 1, 18);
        self.tree.attach_internode(apex_right, [0.28, 1.82, -0.05], 2, 22);

        // 依据达芬奇水力法则平滑整树各段粗细与木质锥度
        self.tree.compute_pipe_model(2.0, 0.038);
    }

    pub fn prune_branch(&mut self, segment_id: u32) -> bool {
        if self.tree.get_segment(segment_id).is_none() {
            return false;
        }
        let res = self.pruning.prune_branch(&mut self.tree, segment_id, &mut self.rng);
        self.last_biomass_loss = res.biomass_loss_ratio;

        for bud in res.activated_buds {
            if let Some(parent) = self.tree.get_segment(bud.parent_id).cloned() {
                let new_end = [
                    parent.end_pos[0] + bud.direction[0] * 0.28,
                    parent.end_pos[1] + bud.direction[1] * 0.28,
                    parent.end_pos[2] + bud.direction[2] * 0.28,
                ];
                self.tree.attach_internode(parent.id, new_end, parent.order + 1, 6);
            }
        }
        self.tree.compute_pipe_model(2.0, 0.038);
        true
    }

    pub fn advance_season(&mut self) -> String {
        let report = self.growth.advance_season(&mut self.tree, &mut self.rng);
        self.tree.compute_pipe_model(2.0, 0.038);
        serde_json::to_string(&report).unwrap_or_else(|_| "{}".to_string())
    }

    pub fn evaluate_rules(&self, recent_loss: f32) -> String {
        let issues = self.rule_engine.evaluate_all(&self.tree, recent_loss);
        serde_json::to_string(&issues).unwrap_or_else(|_| "[]".to_string())
    }

    pub fn get_tree_info(&self) -> String {
        let info = serde_json::json!({
            "season": self.tree.season,
            "year": self.tree.year,
            "energy_pool": self.tree.energy_pool,
            "segment_count": self.tree.segments.len()
        });
        info.to_string()
    }

    pub fn get_last_loss_ratio(&self) -> f32 {
        self.last_biomass_loss
    }

    pub fn apply_wire(&mut self, segment_id: u32, gauge_mm: f32, dx: f32, dy: f32, dz: f32) -> bool {
        WireEngine::apply_wire(&mut self.tree, segment_id, gauge_mm, [dx, dy, dz]).is_ok()
    }

    pub fn remove_wire(&mut self, segment_id: u32) -> bool {
        WireEngine::remove_wire(&mut self.tree, segment_id).is_ok()
    }

    pub fn get_segments_buffer(&self) -> Vec<f32> {
        let mut buffer = Vec::with_capacity(self.tree.segments.len() * 9);
        for seg in self.tree.segments.values() {
            buffer.push(seg.id as f32);
            buffer.push(seg.order as f32);
            buffer.push(seg.radius);
            buffer.push(seg.start_pos[0]);
            buffer.push(seg.start_pos[1]);
            buffer.push(seg.start_pos[2]);
            buffer.push(seg.end_pos[0]);
            buffer.push(seg.end_pos[1]);
            buffer.push(seg.end_pos[2]);
        }
        buffer
    }
}
