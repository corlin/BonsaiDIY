use crate::ecs::world::BonsaiWorld;
use crate::ecs::entity::Entity;
use crate::ecs::components::BudState;
use crate::ecs::commands::CommandExecutionReport;
use super::pipe_system::run_pipe_model_system;

/// 剪枝与潜伏芽激活系统 (PruningSystem)
/// 严格实现 Reddit Wiki 核心“蓄枝截干 (Clip & Grow)”与级联销毁
pub fn run_prune_system(world: &mut BonsaiWorld, segment_id: u32) -> CommandExecutionReport {
    // 1. 查找目标实体
    let target_ent = Entity::new(segment_id, 1);
    let target = if world.geometries.contains_key(&target_ent) {
        Some(target_ent)
    } else {
        world.geometries.keys().find(|e| e.id == segment_id).copied()
    };

    let Some(target_ent) = target else {
        return CommandExecutionReport {
            success: false,
            message: format!("Segment ID {} not found", segment_id),
            ..Default::default()
        };
    };

    // 2. 计算生物质损失比例 (Biomass Loss Ratio)
    let total_area: f32 = world.vascular_pipes.values().map(|p| p.effective_area).sum();
    let parent_ent = world.hierarchies.get(&target_ent).and_then(|h| h.parent);

    // 3. 级联回收子树
    let culled = world.despawn_subtree(target_ent);
    let culled_count = culled.len();

    let culled_area: f32 = culled.iter().filter_map(|e| world.vascular_pipes.get(e)).map(|p| p.effective_area).sum();
    let loss_ratio = if total_area > 1e-6 {
        (culled_area / total_area).min(1.0)
    } else {
        0.0
    };
    world.energy.last_biomass_loss_ratio = loss_ratio;

    // 4. 激活剪口母枝上的休眠潜伏芽 (Bud Awakening)
    let mut awakened_count = 0;
    if let Some(parent) = parent_ent {
        let mut found_bud = false;
        for bud in world.buds.values_mut() {
            if bud.parent_internode == parent && bud.state == BudState::Dormant {
                bud.state = BudState::Swelling;
                bud.auxin_inhibition = 0.0; // 顶端生长素阻断
                found_bud = true;
                awakened_count += 1;
                break;
            }
        }

        // 若母枝上原无潜伏芽，生成一个新唤醒芽
        if !found_bud {
            if let Some(parent_geom) = world.geometries.get(&parent) {
                let dir = parent_geom.direction();
                let lateral_dir = [-dir[2], dir[1] * 0.5, dir[0]];
                let new_bud = world.spawn_bud(parent, parent_geom.end, lateral_dir);
                if let Some(b) = world.buds.get_mut(&new_bud) {
                    b.state = BudState::Swelling;
                    b.auxin_inhibition = 0.0;
                }
                awakened_count += 1;
            }
        }
    }

    // 5. 重新计算达芬奇管道模型截面积
    run_pipe_model_system(world, 2.0, 0.018);

    CommandExecutionReport {
        success: true,
        biomass_loss_ratio: loss_ratio,
        pruned_internodes_count: culled_count,
        awakened_buds_count: awakened_count,
        new_internodes_count: 0,
        energy_delta: 0.0,
        message: format!("Successfully pruned {} segments, awakened {} buds", culled_count, awakened_count),
    }
}
