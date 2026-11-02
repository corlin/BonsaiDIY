use bonsai_core::ecs::*;
use bonsai_core::ecs::systems::pipe_system::run_pipe_model_system;
use bonsai_core::ecs::systems::growth_system::run_growth_system;
use bonsai_core::ecs::systems::prune_system::run_prune_system;
use bonsai_core::ecs::systems::wire_system::{run_apply_wire_system, run_remove_wire_system};
use bonsai_core::ecs::systems::extract_render_system::run_extract_render_system;
use bonsai_core::model::Season;

#[test]
fn test_ecs_entity_allocation_and_reuse() {
    let mut allocator = EntityAllocator::new();
    let e1 = allocator.allocate();
    assert_eq!(e1.id, 0);
    assert_eq!(e1.generation, 1);
    assert!(allocator.is_alive(e1));

    let e2 = allocator.allocate();
    assert_eq!(e2.id, 1);
    assert_eq!(e2.generation, 1);

    // 释放 e1
    assert!(allocator.deallocate(e1));
    assert!(!allocator.is_alive(e1));

    // 重新分配，复用索引 0，代际加 1 (避免 ABA)
    let e1_reused = allocator.allocate();
    assert_eq!(e1_reused.id, 0);
    assert_eq!(e1_reused.generation, 2);
    assert!(allocator.is_alive(e1_reused));
    assert!(!allocator.is_alive(e1)); // 原 e1 引用永久失效
}

#[test]
fn test_ecs_topology_ordering() {
    let mut world = BonsaiWorld::new(2026);
    let root = world.spawn_internode([0.0, 0.0, 0.0], [0.0, 0.5, 0.0], 0.1, 0, None, 0);
    let b1 = world.spawn_internode([0.0, 0.5, 0.0], [-0.3, 0.8, 0.0], 0.05, 1, Some(root), 1);
    let _b2 = world.spawn_internode([0.0, 0.5, 0.0], [0.3, 0.8, 0.0], 0.05, 1, Some(root), 1);
    let b1_tip = world.spawn_internode([-0.3, 0.8, 0.0], [-0.5, 1.0, 0.0], 0.02, 1, Some(b1), 2);

    world.ensure_topology_cache();

    // Top-down 队列根节点必须排在第一位
    assert_eq!(world.topology.top_down_order[0], root);
    assert_eq!(world.topology.top_down_order.len(), 4);

    // Bottom-up 队列根节点必须排在最后一位
    assert_eq!(*world.topology.bottom_up_order.last().unwrap(), root);
    assert_eq!(world.topology.bottom_up_order[0], b1_tip);
}

#[test]
fn test_ecs_pipe_model_da_vinci() {
    let mut world = BonsaiWorld::new(2026);
    let root = world.spawn_internode([0.0, 0.0, 0.0], [0.0, 0.5, 0.0], 0.05, 0, None, 0);
    let b1 = world.spawn_internode([0.0, 0.5, 0.0], [-0.3, 0.8, 0.0], 0.02, 1, Some(root), 1);
    let b2 = world.spawn_internode([0.0, 0.5, 0.0], [0.3, 0.8, 0.0], 0.02, 1, Some(root), 1);

    // 运行达芬奇管道模型系统 (指数 e=2.0)
    run_pipe_model_system(&mut world, 2.0, 0.02);

    let b1_r = world.geometries.get(&b1).unwrap().radius;
    let b2_r = world.geometries.get(&b2).unwrap().radius;
    assert!((b1_r - 0.02).abs() < 1e-4);
    assert!((b2_r - 0.02).abs() < 1e-4);

    // 父枝截面积守恒且加权老桩膨大
    let root_r = world.geometries.get(&root).unwrap().radius;
    let expected_pipe = (0.02f32.powi(2) + 0.02f32.powi(2)).sqrt();
    assert!(root_r >= expected_pipe);
}

#[test]
fn test_ecs_prune_subtree_cascade_and_bud_awakening() {
    let mut world = BonsaiWorld::new(2026);
    world.init_aged_oak_moyogi();

    let initial_count = world.geometries.len();
    assert!(initial_count > 20);

    // 找到第一大主枝子枝条进行修剪
    let target = world.geometries.keys().find(|e| e.id == 5).copied().unwrap();
    let report = run_prune_system(&mut world, target.id);

    assert!(report.success);
    assert!(report.pruned_internodes_count >= 1);
    assert!(world.geometries.len() < initial_count);
    assert!(report.awakened_buds_count >= 1);
}

#[test]
fn test_ecs_seasonal_cycle_and_growth() {
    let mut world = BonsaiWorld::new(2026);
    world.init_aged_oak_moyogi();

    assert_eq!(world.season.current, Season::Spring);
    assert_eq!(world.season.year, 1);

    // 推进春季 -> 夏季
    let report_spring = run_growth_system(&mut world);
    assert_eq!(world.season.current, Season::Summer);
    assert_eq!(report_spring.completed_season, Season::Spring);

    // 推进夏季 -> 秋季 (形成层加粗)
    let report_summer = run_growth_system(&mut world);
    assert_eq!(world.season.current, Season::Autumn);
    assert!(report_summer.cambium_thickened);

    // 推进秋季 -> 冬季
    let _report_autumn = run_growth_system(&mut world);
    assert_eq!(world.season.current, Season::Winter);

    // 推进冬季 -> 次年春季 (落叶休眠并进入第 2 年)
    let report_winter = run_growth_system(&mut world);
    assert_eq!(world.season.current, Season::Spring);
    assert_eq!(world.season.year, 2);
    assert!(report_winter.defoliated);
}

#[test]
fn test_ecs_wire_fixture() {
    let mut world = BonsaiWorld::new(2026);
    world.init_aged_oak_moyogi();

    let target_id = 7;
    let geom = world.geometries.values().find(|g| world.geometries.keys().any(|e| e.id == target_id)).unwrap();
    let branch_dia_mm = geom.radius * 2.0 * 1000.0;
    let min_gauge = branch_dia_mm * 0.33;

    // 粗度不够的铝丝会被拒绝 (1/3力学比)
    let res_fail = run_apply_wire_system(&mut world, target_id, min_gauge * 0.5, [0.0, 1.0, 0.0]);
    assert!(res_fail.is_err());

    // 达标铝丝成功缠绕
    let res_ok = run_apply_wire_system(&mut world, target_id, min_gauge * 1.2, [0.0, 0.8, 0.6]);
    assert!(res_ok.is_ok());

    // 未满 2 季拆除，发生回弹
    let removed_springback = run_remove_wire_system(&mut world, target_id).unwrap();
    assert!(!removed_springback);
}

#[test]
fn test_ecs_extract_render_buffers() {
    let mut world = BonsaiWorld::new(2026);
    world.init_aged_oak_moyogi();

    let render_data = run_extract_render_system(&mut world);

    // 步长校验
    assert_eq!(render_data.segments_buffer.len() % 9, 0);
    assert!(render_data.segments_buffer.len() >= 9 * 20);

    assert_eq!(render_data.foliage_buffer.len() % 8, 0);
    assert!(render_data.foliage_buffer.len() >= 8 * 5);

    assert_eq!(render_data.buds_buffer.len() % 6, 0);
}
