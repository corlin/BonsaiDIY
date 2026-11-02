use std::collections::HashSet;
use crate::model::{Season, TreeGraph};
use crate::rng::DeterministicRng;

#[derive(Clone, Debug, PartialEq)]
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
            .values()
            .filter(|s| !parent_ids.contains(&s.id))
            .map(|s| s.id)
            .collect();

        // 确定性排序保证多端回放严格一致
        tip_ids.sort_unstable();

        let mut new_internodes_count = 0;
        let mut new_segments = Vec::new();

        // 仅在能量池不为负时抽条生长
        if tree.energy_pool > 0.0 {
            for &tip_id in &tip_ids {
                if let Some(tip) = tree.segments.get(&tip_id) {
                    let dx = tip.end_pos[0] - tip.start_pos[0];
                    let dy = tip.end_pos[1] - tip.start_pos[1];
                    let dz = tip.end_pos[2] - tip.start_pos[2];
                    let len = (dx * dx + dy * dy + dz * dz).sqrt();

                    let (ux, uy, uz) = if len > 1e-4 {
                        (dx / len, dy / len, dz / len)
                    } else {
                        (0.0, 1.0, 0.0)
                    };

                    // 结合生长扰动与负向向地性/向光性向上偏折
                    let px = ux + rng.range(-0.1, 0.1);
                    let py = (uy + rng.range(0.05, 0.15)).max(0.05);
                    let pz = uz + rng.range(-0.1, 0.1);
                    let plen = (px * px + py * py + pz * pz).sqrt();
                    let (nx, ny, nz) = if plen > 1e-4 {
                        (px / plen, py / plen, pz / plen)
                    } else {
                        (0.0, 1.0, 0.0)
                    };

                    let internode_len = rng.range(0.25, 0.35);
                    let new_end = [
                        tip.end_pos[0] + nx * internode_len,
                        tip.end_pos[1] + ny * internode_len,
                        tip.end_pos[2] + nz * internode_len,
                    ];
                    let new_leaves = (rng.range(5.0, 8.0) as u32).max(1);
                    new_segments.push((tip.id, new_end, tip.order, new_leaves));
                }
            }

            for (parent_id, new_end, order, leaves) in new_segments {
                tree.attach_internode(parent_id, new_end, order, leaves);
                new_internodes_count += 1;
            }
        }

        // 更新达芬奇管道粗度
        tree.compute_pipe_model(2.0, 0.05);

        // 萌发消耗能量
        let energy_cost = (new_internodes_count as f32 * 5.0).max(5.0);
        let energy_delta = -energy_cost.min(tree.energy_pool);
        tree.energy_pool += energy_delta;

        tree.season = Season::Summer;
        SeasonReport {
            new_internodes_count,
            energy_delta,
            season: Season::Spring,
        }
    }

    fn advance_summer(&mut self, tree: &mut TreeGraph) -> SeasonReport {
        // 充足光合作用：能量池大幅累积 (leaves * 0.5)
        let total_leaves: u32 = tree.segments.values().map(|s| s.leaf_count).sum();
        let energy_gain = (total_leaves as f32) * 0.5;
        tree.energy_pool += energy_gain;

        // 次生维管形成层分裂（全树粗度增加）
        for seg in tree.segments.values_mut() {
            seg.radius = (seg.radius * 1.15).max(seg.radius + 0.005);
        }

        tree.season = Season::Autumn;
        SeasonReport {
            new_internodes_count: 0,
            energy_delta: energy_gain,
            season: Season::Summer,
        }
    }

    fn advance_autumn(&mut self, tree: &mut TreeGraph) -> SeasonReport {
        // 形成过冬顶芽，叶片养分回流，树木为休眠做准备
        let total_leaves: u32 = tree.segments.values().map(|s| s.leaf_count).sum();
        let resorption = (total_leaves as f32) * 0.1;
        tree.energy_pool += resorption;

        tree.season = Season::Winter;
        SeasonReport {
            new_internodes_count: 0,
            energy_delta: resorption,
            season: Season::Autumn,
        }
    }

    fn advance_winter(&mut self, tree: &mut TreeGraph) -> SeasonReport {
        // 进入休眠状态，度过低温积累阶段，消耗基础代谢能量
        let winter_cost: f32 = 5.0;
        let energy_delta = -winter_cost.min(tree.energy_pool);
        tree.energy_pool += energy_delta;

        // 冬季结束，树龄加 1，循环回春季
        tree.year += 1;
        tree.season = Season::Spring;

        SeasonReport {
            new_internodes_count: 0,
            energy_delta,
            season: Season::Winter,
        }
    }
}
