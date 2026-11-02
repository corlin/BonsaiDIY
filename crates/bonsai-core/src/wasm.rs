use wasm_bindgen::prelude::*;
use crate::model::TreeGraph;
use crate::rng::DeterministicRng;
use crate::prune::PruningEngine;

#[wasm_bindgen]
pub struct BonsaiWasmEngine {
    tree: TreeGraph,
    rng: DeterministicRng,
    pruning: PruningEngine,
}

#[wasm_bindgen]
impl BonsaiWasmEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u32) -> Self {
        let mut engine = Self {
            tree: TreeGraph::new(),
            rng: DeterministicRng::new(seed as u64),
            pruning: PruningEngine::new(),
        };
        engine.init_default_tree();
        engine
    }

    fn init_default_tree(&mut self) {
        let base = self.tree.create_base_internode([0.0, 0.25, 0.0], [0.0, 0.8, 0.0]);
        let b1 = self.tree.attach_internode(base, [0.3, 1.3, 0.1], 1, 15);
        let b2 = self.tree.attach_internode(base, [-0.25, 1.4, -0.2], 1, 12);
        self.tree.attach_internode(b1, [0.5, 1.8, 0.2], 2, 20);
        self.tree.attach_internode(b2, [-0.4, 1.9, -0.3], 2, 18);
        self.tree.compute_pipe_model(2.0, 0.05);
    }

    /// 执行剪枝，切除指定枝条并激活潜伏芽
    pub fn prune_branch(&mut self, segment_id: u32) -> bool {
        if self.tree.get_segment(segment_id).is_none() {
            return false;
        }
        let res = self.pruning.prune_branch(&mut self.tree, segment_id, &mut self.rng);
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
}
