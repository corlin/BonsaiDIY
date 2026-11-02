use crate::ecs::world::BonsaiWorld;

/// 渲染数据抽取系统 (ExtractRenderDataSystem)
/// 借鉴 Bevy Render Extract 阶段与 Egregoria 零拷贝思想：
/// 将分散存储的 ECS 实体数据打包抽取为紧凑连续的一维浮点缓冲区，跨语言零拷贝访问
pub struct ExtractedRenderData {
    pub segments_buffer: Vec<f32>,
    pub foliage_buffer: Vec<f32>,
    pub buds_buffer: Vec<f32>,
}

pub fn run_extract_render_system(world: &mut BonsaiWorld) -> ExtractedRenderData {
    world.ensure_topology_cache();

    // 1. 抽取枝干几何通道 (Segments Buffer, 9-Float 步长与 Web 端完全兼容)
    // [id, order, radius, start_x, start_y, start_z, end_x, end_y, end_z]
    let mut segments_buffer = Vec::with_capacity(world.geometries.len() * 9);
    for &ent in &world.topology.top_down_order {
        if let Some(geom) = world.geometries.get(&ent) {
            let order = world.hierarchies.get(&ent).map(|h| h.order).unwrap_or(0);
            segments_buffer.push(ent.id as f32);
            segments_buffer.push(order as f32);
            segments_buffer.push(geom.radius);
            segments_buffer.push(geom.start[0]);
            segments_buffer.push(geom.start[1]);
            segments_buffer.push(geom.start[2]);
            segments_buffer.push(geom.end[0]);
            segments_buffer.push(geom.end[1]);
            segments_buffer.push(geom.end[2]);
        }
    }

    // 2. 抽取梢头叶托通道 (Foliage Pads Buffer, 8-Float 步长)
    // [parent_id, center_x, center_y, center_z, normal_x, normal_y, normal_z, leaf_count]
    let mut foliage_buffer = Vec::with_capacity(world.foliage_pads.len() * 8);
    for pad in world.foliage_pads.values() {
        foliage_buffer.push(pad.parent_internode.id as f32);
        foliage_buffer.push(pad.center[0]);
        foliage_buffer.push(pad.center[1]);
        foliage_buffer.push(pad.center[2]);
        foliage_buffer.push(pad.normal[0]);
        foliage_buffer.push(pad.normal[1]);
        foliage_buffer.push(pad.normal[2]);
        foliage_buffer.push(pad.leaf_count as f32);
    }

    // 3. 抽取潜伏芽位通道 (Buds Buffer, 6-Float 步长)
    // [parent_id, pos_x, pos_y, pos_z, dir_x, state]
    let mut buds_buffer = Vec::with_capacity(world.buds.len() * 6);
    for bud in world.buds.values() {
        buds_buffer.push(bud.parent_internode.id as f32);
        buds_buffer.push(bud.position[0]);
        buds_buffer.push(bud.position[1]);
        buds_buffer.push(bud.position[2]);
        buds_buffer.push(bud.direction[0]);
        let state_val = match bud.state {
            crate::ecs::components::BudState::Dormant => 0.0,
            crate::ecs::components::BudState::Swelling => 1.0,
            crate::ecs::components::BudState::Flushed => 2.0,
            crate::ecs::components::BudState::Aborted => 3.0,
        };
        buds_buffer.push(state_val);
    }

    ExtractedRenderData {
        segments_buffer,
        foliage_buffer,
        buds_buffer,
    }
}
