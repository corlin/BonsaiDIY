use std::collections::HashSet;
use crate::model::{Season, TreeGraph};
use crate::rng::DeterministicRng;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SeasonReport {
    pub new_internodes_count: usize,
    pub energy_delta: f32,
    pub season: Season,
}

#[derive(Clone, Debug, Default)]
pub struct GrowthEngine;

impl GrowthEngine {
    pub fn new() -> Self {
        Self
    }

    pub fn advance_season(&mut self, tree: &mut TreeGraph, rng: &mut DeterministicRng) -> SeasonReport {
        // 推进铝丝老化与塑性定型
        for seg in tree.segments.values_mut() {
            if let Some(ref mut wire) = seg.wire_info {
                wire.wired_seasons += 1;
                if wire.wired_seasons >= 2 {
                    wire.is_set = true;
                }
                if wire.wired_seasons >= 4 {
                    wire.has_wire_bite = true;
                }
            }
        }

        // 嵌线勒痕轻微损耗局部健康与全树能量
        let wire_bite_count = tree
            .segments
            .values()
            .filter(|s| s.wire_info.as_ref().map(|w| w.has_wire_bite).unwrap_or(false))
            .count();
        if wire_bite_count > 0 {
            let penalty = wire_bite_count as f32 * 2.0;
            tree.energy_pool = (tree.energy_pool - penalty).max(0.0);
        }

        match tree.season {
            Season::Spring => self.advance_spring(tree, rng),
            Season::Summer => self.advance_summer(tree),
            Season::Autumn => self.advance_autumn(tree),
            Season::Winter => self.advance_winter(tree),
        }
    }

    fn advance_spring(&mut self, tree: &mut TreeGraph, rng: &mut DeterministicRng) -> SeasonReport {
        // 查找所有末端优势枝梢 (tip internodes)
        let parent_ids: HashSet<u32> = tree
            .segments
            .values()
            .filter_map(|s| s.parent_id)
            .collect();

        let mut tip_ids: Vec<u32> = tree
            .segments
            .keys()
            .filter(|id| !parent_ids.contains(id))
            .copied()
            .collect();
        tip_ids.sort_unstable(); // 保证确定性

        let mut new_internodes_count = 0;
        let mut energy_spent = 0.0;

        if tree.energy_pool > 5.0 {
            for tip_id in tip_ids {
                if let Some(parent) = tree.segments.get(&tip_id).cloned() {
                    let parent_dir = [
                        parent.end_pos[0] - parent.start_pos[0],
                        parent.end_pos[1] - parent.start_pos[1],
                        parent.end_pos[2] - parent.start_pos[2],
                    ];
                    let len = (parent_dir[0].powi(2) + parent_dir[1].powi(2) + parent_dir[2].powi(2)).sqrt();
                    let norm_dir = if len > 1e-4 {
                        [parent_dir[0] / len, parent_dir[1] / len, parent_dir[2] / len]
                    } else {
                        [0.0, 1.0, 0.0]
                    };

                    let new_end = [
                        parent.end_pos[0] + norm_dir[0] * 0.28 + rng.range(-0.06, 0.06),
                        parent.end_pos[1] + norm_dir[1] * 0.28 + rng.range(0.02, 0.08),
                        parent.end_pos[2] + norm_dir[2] * 0.28 + rng.range(-0.06, 0.06),
                    ];

                    let new_order = (parent.order + 1).min(4);
                    tree.attach_internode(parent.id, new_end, new_order, 6);
                    new_internodes_count += 1;
                    energy_spent += 1.5;
                }
            }
            tree.compute_pipe_model(2.0, 0.038);
        }

        tree.energy_pool = (tree.energy_pool - energy_spent).max(0.0);
        tree.season = Season::Summer;

        SeasonReport {
            new_internodes_count,
            energy_delta: -energy_spent,
            season: Season::Spring,
        }
    }

    fn advance_summer(&mut self, tree: &mut TreeGraph) -> SeasonReport {
        let total_leaves: u32 = tree.segments.values().map(|s| s.leaf_count).sum();
        let energy_gained = (total_leaves as f32) * 0.5;
        tree.energy_pool += energy_gained;

        for seg in tree.segments.values_mut() {
            seg.radius = (seg.radius * 1.12).max(seg.radius + 0.002);
        }

        tree.season = Season::Autumn;
        SeasonReport {
            new_internodes_count: 0,
            energy_delta: energy_gained,
            season: Season::Summer,
        }
    }

    fn advance_autumn(&mut self, tree: &mut TreeGraph) -> SeasonReport {
        let total_leaves: u32 = tree.segments.values().map(|s| s.leaf_count).sum();
        let energy_gained = (total_leaves as f32) * 0.1;
        tree.energy_pool += energy_gained;

        tree.season = Season::Winter;
        SeasonReport {
            new_internodes_count: 0,
            energy_delta: energy_gained,
            season: Season::Autumn,
        }
    }

    fn advance_winter(&mut self, tree: &mut TreeGraph) -> SeasonReport {
        let dormant_cost = 2.0;
        tree.energy_pool = (tree.energy_pool - dormant_cost).max(0.0);
        tree.year += 1;
        tree.season = Season::Spring;

        SeasonReport {
            new_internodes_count: 0,
            energy_delta: -dormant_cost,
            season: Season::Winter,
        }
    }
}
