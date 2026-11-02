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

    /// 1:1 还原用户参考图中百年古栎树盆景 (Aged Oak Bonsai) 真实解剖骨架
    fn init_default_tree(&mut self) {
        // ===== 1. 雄浑粗壮的下盘基底老干 (Bulbous Base & Fluted Trunk) =====
        // 地径极大（膨大老桩），从盆面出土向上微微收缩
        let trunk_base = self.tree.create_base_internode([0.0, 0.28, 0.0], [0.01, 0.48, -0.01]);
        // 中干微折左倾
        let trunk_mid = self.tree.attach_internode(trunk_base, [-0.03, 0.75, 0.02], 0, 8);
        // 主干收尖并向右回曲，到达核心分叉点
        let trunk_crotch = self.tree.attach_internode(trunk_mid, [0.03, 0.98, -0.01], 0, 10);
        // 向上延伸的主梢顶轴
        let trunk_apex_lower = self.tree.attach_internode(trunk_crotch, [0.04, 1.25, 0.01], 0, 12);
        let trunk_apex_top = self.tree.attach_internode(trunk_apex_lower, [0.02, 1.48, -0.01], 0, 14);

        // ===== 2. 第一大主枝（左下平展粗大出干托，苍劲平伸） =====
        let b1 = self.tree.attach_internode(trunk_crotch, [-0.32, 0.94, 0.04], 1, 14);
        let b1_drop = self.tree.attach_internode(b1, [-0.58, 0.88, 0.08], 2, 18);
        let b1_tip1 = self.tree.attach_internode(b1_drop, [-0.76, 0.85, 0.12], 3, 22);
        self.tree.attach_internode(b1_tip1, [-0.88, 0.82, 0.14], 4, 18);
        let b1_tip2 = self.tree.attach_internode(b1_drop, [-0.62, 0.96, -0.06], 3, 16);
        self.tree.attach_internode(b1_tip2, [-0.74, 0.98, -0.08], 4, 15);

        // ===== 3. 右侧下层平衡副枝（右侧对重托，横向开张） =====
        let b2 = self.tree.attach_internode(trunk_crotch, [0.35, 1.04, -0.05], 1, 15);
        let b2_sub1 = self.tree.attach_internode(b2, [0.62, 1.06, -0.10], 2, 20);
        let b2_sub1_tip = self.tree.attach_internode(b2_sub1, [0.80, 1.05, -0.12], 3, 18);
        self.tree.attach_internode(b2_sub1_tip, [0.92, 1.02, -0.14], 4, 14);
        let b2_sub2 = self.tree.attach_internode(b2, [0.48, 1.15, 0.12], 2, 15);
        self.tree.attach_internode(b2_sub2, [0.65, 1.18, 0.18], 3, 12);

        // ===== 4. 中层向阳立体枝与后背深景托 =====
        let b3_back = self.tree.attach_internode(trunk_apex_lower, [-0.08, 1.18, -0.32], 1, 12);
        let b3_back_sub = self.tree.attach_internode(b3_back, [-0.12, 1.28, -0.48], 2, 16);
        self.tree.attach_internode(b3_back_sub, [-0.18, 1.34, -0.60], 3, 12);

        let b4_front = self.tree.attach_internode(trunk_apex_lower, [0.18, 1.22, 0.22], 1, 14);
        let b4_front_sub = self.tree.attach_internode(b4_front, [0.32, 1.28, 0.32], 2, 16);
        self.tree.attach_internode(b4_front_sub, [0.42, 1.32, 0.38], 3, 12);

        // ===== 5. 中上层舒展分枝托 =====
        let b5_mid_left = self.tree.attach_internode(trunk_apex_lower, [-0.28, 1.36, 0.02], 1, 15);
        let b5_sub = self.tree.attach_internode(b5_mid_left, [-0.48, 1.42, 0.05], 2, 18);
        self.tree.attach_internode(b5_sub, [-0.60, 1.45, 0.08], 3, 14);

        let b6_mid_right = self.tree.attach_internode(trunk_apex_lower, [0.26, 1.40, -0.04], 1, 16);
        let b6_sub = self.tree.attach_internode(b6_mid_right, [0.45, 1.46, -0.06], 2, 18);
        self.tree.attach_internode(b6_sub, [0.58, 1.50, -0.08], 3, 12);

        // ===== 6. 顶端伞房冠顶 (Apex Dome) =====
        let apex_l = self.tree.attach_internode(trunk_apex_top, [-0.15, 1.62, 0.04], 1, 16);
        self.tree.attach_internode(apex_l, [-0.24, 1.70, 0.06], 2, 14);

        let apex_r = self.tree.attach_internode(trunk_apex_top, [0.14, 1.65, -0.03], 1, 18);
        self.tree.attach_internode(apex_r, [0.22, 1.72, -0.05], 2, 15);

        let apex_c = self.tree.attach_internode(trunk_apex_top, [0.01, 1.76, 0.01], 1, 22);
        self.tree.attach_internode(apex_c, [0.02, 1.84, 0.02], 2, 18);

        // 重新运行达芬奇管道模型，赋予极其苍劲粗大的老桩地径
        self.tree.compute_pipe_model(2.0, 0.018);

        // 手动加强下盘主干的粗壮厚重度（膨大根盘老桩感）
        if let Some(base_seg) = self.tree.segments.get_mut(&trunk_base) {
            base_seg.radius = (base_seg.radius * 2.2).max(0.125);
        }
        if let Some(mid_seg) = self.tree.segments.get_mut(&trunk_mid) {
            mid_seg.radius = (mid_seg.radius * 1.7).max(0.095);
        }
        if let Some(crotch_seg) = self.tree.segments.get_mut(&trunk_crotch) {
            crotch_seg.radius = (crotch_seg.radius * 1.4).max(0.075);
        }
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
                    parent.end_pos[0] + bud.direction[0] * 0.20,
                    parent.end_pos[1] + bud.direction[1] * 0.20,
                    parent.end_pos[2] + bud.direction[2] * 0.20,
                ];
                self.tree.attach_internode(parent.id, new_end, parent.order + 1, 5);
            }
        }
        self.tree.compute_pipe_model(2.0, 0.018);
        true
    }

    pub fn advance_season(&mut self) -> String {
        let report = self.growth.advance_season(&mut self.tree, &mut self.rng);
        self.tree.compute_pipe_model(2.0, 0.018);
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
