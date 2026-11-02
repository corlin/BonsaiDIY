use crate::ecs::world::BonsaiWorld;

/// 达芬奇管道模型计算系统 (PipeModelSystem)
/// 严格依据物理截面积守恒定律 (Leonardo da Vinci Area Conservation Rule):
/// r_parent = (\sum r_child^e)^{1/e}
/// 遍历完全在扁平连续数组 `bottom_up_order` 上执行，零递归调用，100% 缓存命中
pub fn run_pipe_model_system(world: &mut BonsaiWorld, base_exponent: f32, min_terminal_radius: f32) {
    world.ensure_topology_cache();

    // 复制自底向上队列以规避可变借用冲突
    let bottom_up: Vec<_> = world.topology.bottom_up_order.clone();

    for &ent in &bottom_up {
        let Some(hier) = world.hierarchies.get(&ent).cloned() else {
            continue;
        };

        if hier.children.is_empty() {
            // 末端小枝梢头：赋予基准微观半径
            if let Some(geom) = world.geometries.get_mut(&ent) {
                geom.radius = min_terminal_radius;
            }
            if let Some(pipe) = world.vascular_pipes.get_mut(&ent) {
                pipe.effective_area = std::f32::consts::PI * min_terminal_radius * min_terminal_radius;
            }
        } else {
            // 分枝节点：汇聚所有子分枝的截面积
            let mut sum_r_pow = 0.0f32;
            let exp = world.vascular_pipes.get(&ent).map(|p| p.exponent).unwrap_or(base_exponent);

            for &child_ent in &hier.children {
                if let Some(child_geom) = world.geometries.get(&child_ent) {
                    sum_r_pow += child_geom.radius.powf(exp);
                }
            }

            let mut parent_r = sum_r_pow.powf(1.0 / exp);

            // 主干下盘基底给予膨大老桩加权 (Nebari Trunk Flare)
            if hier.order == 0 {
                let is_base = hier.parent.is_none();
                let flare = if is_base { 2.1 } else { 1.4 };
                parent_r = (parent_r * flare).max(if is_base { 0.125 } else { 0.075 });
            }

            if let Some(geom) = world.geometries.get_mut(&ent) {
                geom.radius = parent_r;
            }
            if let Some(pipe) = world.vascular_pipes.get_mut(&ent) {
                pipe.effective_area = std::f32::consts::PI * parent_r * parent_r;
            }
        }
    }
}
