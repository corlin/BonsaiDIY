use crate::model::{TreeGraph, Vector3D};
use crate::rng::DeterministicRng;

#[derive(Clone, Debug, PartialEq)]
pub struct PruneResult {
    pub removed_count: usize,
    pub biomass_loss_ratio: f32,
    pub activated_buds: Vec<ActivatedBud>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ActivatedBud {
    pub parent_id: u32,
    pub direction: Vector3D,
}

#[derive(Clone, Debug, Default)]
pub struct PruningEngine;

impl PruningEngine {
    pub fn new() -> Self {
        Self
    }

    pub fn prune_branch(
        &mut self,
        tree: &mut TreeGraph,
        target_id: u32,
        rng: &mut DeterministicRng,
    ) -> PruneResult {
        let total_leaves_before: u32 = tree.segments.values().map(|s| s.leaf_count).sum();
        let parent_id = tree.get_segment(target_id).and_then(|s| s.parent_id);

        let removed_ids = tree.remove_subtree(target_id);
        let total_leaves_after: u32 = tree.segments.values().map(|s| s.leaf_count).sum();

        let loss_ratio = if total_leaves_before > 0 {
            (total_leaves_before.saturating_sub(total_leaves_after)) as f32 / total_leaves_before as f32
        } else {
            0.0
        };

        let mut activated_buds = Vec::new();
        if let Some(pid) = parent_id {
            if tree.get_segment(pid).is_some() {
                let count = if rng.range(1.0, 3.0) > 1.8 { 2 } else { 1 };
                for _ in 0..count {
                    let angle = rng.range(0.0, std::f32::consts::TAU);
                    let dir: Vector3D = [
                        angle.cos() * 0.7,
                        rng.range(0.2, 0.8),
                        angle.sin() * 0.7,
                    ];
                    activated_buds.push(ActivatedBud {
                        parent_id: pid,
                        direction: dir,
                    });
                }
            }
        }

        tree.compute_pipe_model(2.0, 0.05);

        PruneResult {
            removed_count: removed_ids.len(),
            biomass_loss_ratio: loss_ratio,
            activated_buds,
        }
    }
}
