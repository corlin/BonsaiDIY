use crate::ecs::world::BonsaiWorld;
use crate::ecs::components::BudState;
use crate::model::Season;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct EcsSeasonReport {
    pub season: Season,
    pub completed_season: Season,
    pub year: u32,
    pub energy_pool: f32,
    pub energy_delta: f32,
    pub new_internodes_count: usize,
    pub cambium_thickened: bool,
    pub defoliated: bool,
}

/// 四季植物生理系统 (SeasonalGrowthSystem)
/// 严格映射四季动态能量平衡与细胞发育
pub fn run_growth_system(world: &mut BonsaiWorld) -> EcsSeasonReport {
    let completed_season = world.season.current;
    let old_energy = world.energy.nsc_stored;
    let mut new_internodes_count = 0;

    match completed_season {
        Season::Spring => {
            // ===== 春季：抽梢分生与潜伏芽萌发 (Spring Flush) =====
            // 萌发所有处于 Swelling 状态的芽
            let mut buds_to_flush = Vec::new();
            for (&bud_ent, bud) in &world.buds {
                if bud.state == BudState::Swelling {
                    buds_to_flush.push((bud_ent, bud.parent_internode, bud.position, bud.direction));
                }
            }

            for (bud_ent, parent_internode, pos, dir) in buds_to_flush {
                let parent_order = world.hierarchies.get(&parent_internode).map(|h| h.order).unwrap_or(0);
                let new_end = [
                    pos[0] + dir[0] * 0.22,
                    pos[1] + dir[1] * 0.22,
                    pos[2] + dir[2] * 0.22,
                ];
                let new_internode = world.spawn_internode(
                    pos,
                    new_end,
                    0.016,
                    parent_order.min(5),
                    Some(parent_internode),
                    parent_order + 1,
                );

                // 在新梢头生成叶托
                world.spawn_foliage_pad(
                    new_internode,
                    new_end,
                    [0.0, 1.0, 0.0],
                    16,
                    [0.18, 0.14],
                );

                // 标记芽已萌发
                if let Some(b) = world.buds.get_mut(&bud_ent) {
                    b.state = BudState::Flushed;
                }
                new_internodes_count += 1;
            }

            // 抽梢消耗能量储备
            world.energy.nsc_stored = (world.energy.nsc_stored - 18.0).max(10.0);
        }
        Season::Summer => {
            // ===== 夏季：光合旺盛与形成层加粗 (Cambium Thickening) =====
            // 统计总叶绿素光合量
            let mut total_photosynthesis = 0.0f32;
            for pad in world.foliage_pads.values() {
                total_photosynthesis += pad.leaf_count as f32 * pad.chlorophyll * 0.08;
            }
            world.energy.annual_photosynthesis = total_photosynthesis;
            world.energy.nsc_stored = (world.energy.nsc_stored + total_photosynthesis).min(world.energy.max_capacity);

            // 形成层加粗：养分分配给大枝与主干
            for (&ent, hier) in &world.hierarchies {
                if let Some(geom) = world.geometries.get_mut(&ent) {
                    let thickening_factor = match hier.order {
                        0 => 0.0035, // 主干增粗显著
                        1 => 0.0025,
                        2 => 0.0015,
                        _ => 0.0008,
                    };
                    geom.radius += thickening_factor;
                }
            }
        }
        Season::Autumn => {
            // ===== 秋季：养分回流与木质化硬化 (Hardening & Translocation) =====
            // 叶绿素分解，养分回流根茎
            for pad in world.foliage_pads.values_mut() {
                pad.chlorophyll *= 0.6; // 颜色转为金褐
            }
            world.energy.nsc_stored = (world.energy.nsc_stored + 12.0).min(world.energy.max_capacity);

            // 金属丝缠绕时效增加，判定嵌线 (Wire-bite)
            for wire in world.wires.values_mut() {
                wire.season_counter += 1;
                if wire.season_counter >= 4 {
                    wire.has_bitten = true;
                }
            }
        }
        Season::Winter => {
            // ===== 冬季：落叶与深度休眠 (Dormancy) =====
            for pad in world.foliage_pads.values_mut() {
                pad.chlorophyll = 0.0;
            }
            // 铝丝定型结算：若已满 2 季，达到塑性变形定型
            for wire in world.wires.values_mut() {
                wire.season_counter += 1;
            }
        }
    }

    // 推进季节状态机
    let next_season = world.season.advance();
    world.ensure_topology_cache();

    let energy_delta = world.energy.nsc_stored - old_energy;
    EcsSeasonReport {
        season: next_season,
        completed_season,
        year: world.season.year,
        energy_pool: world.energy.nsc_stored,
        energy_delta,
        new_internodes_count,
        cambium_thickened: completed_season == Season::Summer,
        defoliated: completed_season == Season::Winter,
    }
}
