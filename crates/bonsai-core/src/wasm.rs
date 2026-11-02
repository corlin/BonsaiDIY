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
    last_loss_ratio: f32,
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
            last_loss_ratio: 0.0,
        };
        engine.init_default_tree();
        engine
    }

    fn init_default_tree(&mut self) {
        let base = self.tree.create_base_internode([0.0, 0.25, 0.0], [0.0, 0.8, 0.0]);
        let b1 = self.tree.attach_internode(base, [0.3, 1.3, 0.1], 1, 5);
        let b2 = self.tree.attach_internode(base, [-0.25, 1.4, -0.2], 1, 4);
        self.tree.attach_internode(b1, [0.5, 1.8, 0.2], 2, 2);
        self.tree.attach_internode(b2, [-0.4, 1.9, -0.3], 2, 2);
        self.tree.compute_pipe_model(2.0, 0.05);
    }

    /// 执行剪枝，切除指定枝条并激活潜伏芽
    pub fn prune_branch(&mut self, segment_id: u32) -> bool {
        if self.tree.get_segment(segment_id).is_none() {
            return false;
        }
        let res = self.pruning.prune_branch(&mut self.tree, segment_id, &mut self.rng);
        self.last_loss_ratio = res.biomass_loss_ratio;
        for bud in res.activated_buds {
            if let Some(parent) = self.tree.get_segment(bud.parent_id).cloned() {
                let new_end = [
                    parent.end_pos[0] + bud.direction[0] * 0.3,
                    parent.end_pos[1] + bud.direction[1] * 0.3,
                    parent.end_pos[2] + bud.direction[2] * 0.3,
                ];
                self.tree.attach_internode(parent.id, new_end, parent.order + 1, 5);
            }
        }
        self.tree.compute_pipe_model(2.0, 0.05);
        true
    }

    /// 获取最近一次修剪造成的生物质损失比例
    pub fn get_last_loss_ratio(&self) -> f32 {
        self.last_loss_ratio
    }

    /// 推进一个季节，返回包含四季更迭报表的 JSON 字符串
    pub fn advance_season(&mut self) -> String {
        let report = self.growth.advance_season(&mut self.tree, &mut self.rng);
        let result = serde_json::json!({
            "new_internodes_count": report.new_internodes_count,
            "energy_delta": report.energy_delta,
            "season": format!("{:?}", self.tree.season),
            "completed_season": format!("{:?}", report.season),
            "year": self.tree.year,
            "energy_pool": self.tree.energy_pool,
        });
        serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
    }

    /// 评估 Wiki 规则并返回教练诊断警告列表
    pub fn evaluate_rules(&self, recent_loss_ratio: f32) -> String {
        let issues = self.rule_engine.evaluate_all(&self.tree, recent_loss_ratio);
        serde_json::to_string(&issues).unwrap_or_else(|_| "[]".to_string())
    }

    /// 获取树木核心状态（季节、树龄、能量池、枝段数量）
    pub fn get_tree_info(&self) -> String {
        let info = serde_json::json!({
            "season": format!("{:?}", self.tree.season),
            "year": self.tree.year,
            "energy_pool": self.tree.energy_pool,
            "segment_count": self.tree.segments.len(),
        });
        serde_json::to_string(&info).unwrap_or_else(|_| "{}".to_string())
    }

    /// 对指定枝段缠绕铝丝并设定弯曲目标方向
    pub fn apply_wire(
        &mut self,
        segment_id: u32,
        gauge_mm: f32,
        target_dir_x: f32,
        target_dir_y: f32,
        target_dir_z: f32,
    ) -> bool {
        WireEngine::apply_wire(
            &mut self.tree,
            segment_id,
            gauge_mm,
            [target_dir_x, target_dir_y, target_dir_z],
        )
        .is_ok()
    }

    /// 拆除指定枝段上的铝丝
    pub fn remove_wire(&mut self, segment_id: u32) -> bool {
        WireEngine::remove_wire(&mut self.tree, segment_id).is_ok()
    }

    /// 打包全部节间数据供前端 Three.js 直读：
    /// 每个枝段布局 [id, order, radius, startX, startY, startZ, endX, endY, endZ] (共 9 个 f32)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wasm_engine_init_and_buffer() {
        let engine = BonsaiWasmEngine::new(42);
        let buffer = engine.get_segments_buffer();
        // Initial tree has 5 segments: base, b1, b2, and 2 tips
        assert_eq!(buffer.len(), 5 * 9);

        // Verify structure of first segment
        for chunk in buffer.chunks(9) {
            assert_eq!(chunk.len(), 9);
            let id = chunk[0];
            let order = chunk[1];
            let radius = chunk[2];
            assert!(id > 0.0);
            assert!(order >= 0.0);
            assert!(radius > 0.0);
        }
    }

    #[test]
    fn test_wasm_engine_prune_branch() {
        let mut engine = BonsaiWasmEngine::new(2026);
        // Segment 4 is a tip branch attached to b1
        let pruned = engine.prune_branch(4);
        assert!(pruned);
        assert!(engine.get_last_loss_ratio() > 0.0);

        let buffer = engine.get_segments_buffer();
        // Segment 4 was removed, and bud activation spawned 1 or 2 new internodes
        assert_eq!(buffer.len() % 9, 0);

        // Verify pruned segment 4 is no longer in buffer
        let ids: Vec<u32> = buffer.chunks(9).map(|c| c[0] as u32).collect();
        assert!(!ids.contains(&4));
    }

    #[test]
    fn test_wasm_engine_prune_nonexistent() {
        let mut engine = BonsaiWasmEngine::new(1234);
        let pruned = engine.prune_branch(9999);
        assert!(!pruned);
    }

    #[test]
    fn test_wasm_engine_advance_season() {
        let mut engine = BonsaiWasmEngine::new(42);
        // Initial tree: Spring, Year 1, 5 segments, energy 100.0
        let res_json = engine.advance_season();
        let parsed: serde_json::Value = serde_json::from_str(&res_json).expect("valid json");
        assert_eq!(parsed["season"], "Summer");
        assert_eq!(parsed["completed_season"], "Spring");
        assert_eq!(parsed["year"], 1);
        assert!(parsed["new_internodes_count"].as_u64().unwrap() > 0);

        // Verify get_tree_info matches
        let info_json = engine.get_tree_info();
        let info: serde_json::Value = serde_json::from_str(&info_json).expect("valid json");
        assert_eq!(info["season"], "Summer");
        assert_eq!(info["year"], 1);
    }

    #[test]
    fn test_wasm_engine_evaluate_rules() {
        let engine = BonsaiWasmEngine::new(42);
        // Default tree has normal proportions
        let issues_json = engine.evaluate_rules(0.0);
        let issues: Vec<serde_json::Value> = serde_json::from_str(&issues_json).expect("valid json");
        // Verify valid JSON array returned
        assert!(issues.is_empty() || issues.iter().all(|i| i["rule_id"].is_string()));

        // If high loss ratio passed (e.g. 0.35), R-PRUNE-05 must be triggered
        let danger_json = engine.evaluate_rules(0.35);
        let danger_issues: Vec<serde_json::Value> = serde_json::from_str(&danger_json).expect("valid json");
        assert!(danger_issues.iter().any(|i| i["rule_id"] == "R-PRUNE-05" && i["severity"] == "Danger"));
    }

    #[test]
    fn test_wasm_engine_apply_and_remove_wire() {
        let mut engine = BonsaiWasmEngine::new(42);
        // Segment 4 is a tip branch (order 2, leaf_count 2 -> thickness ~7.07mm -> gauge 2.5mm is valid)
        let applied = engine.apply_wire(4, 2.5, 1.0, 0.5, 0.0);
        assert!(applied);

        // Remove wire
        let removed = engine.remove_wire(4);
        assert!(removed);

        // Removing already unwired segment should return false
        let removed_again = engine.remove_wire(4);
        assert!(!removed_again);
    }
}
