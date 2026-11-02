use bonsai_core::model::{Season, TreeGraph};
use bonsai_core::rng::DeterministicRng;
use bonsai_core::growth::GrowthEngine;

#[test]
fn test_seasonal_cycle_and_spring_flush() {
    let mut rng = DeterministicRng::new(42);
    let mut tree = TreeGraph::new();
    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let _branch = tree.attach_internode(trunk, [0.3, 1.5, 0.0], 1, 5);

    let mut growth = GrowthEngine::new();
    assert_eq!(tree.season, Season::Spring);

    // 春季生长：抽生新芽
    let report_spring = growth.advance_season(&mut tree, &mut rng);
    assert_eq!(tree.season, Season::Summer);
    assert!(report_spring.new_internodes_count > 0);
    assert_eq!(report_spring.season, Season::Spring);

    // 夏季：光合作用积累，能量增加，叶片硬化
    let energy_before_summer = tree.energy_pool;
    let report_summer = growth.advance_season(&mut tree, &mut rng);
    assert_eq!(tree.season, Season::Autumn);
    assert!(tree.energy_pool > energy_before_summer);
    assert_eq!(report_summer.new_internodes_count, 0);
    assert_eq!(report_summer.season, Season::Summer);
}

#[test]
fn test_full_annual_cycle_and_year_increment() {
    let mut rng = DeterministicRng::new(100);
    let mut tree = TreeGraph::new();
    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    tree.attach_internode(trunk, [0.2, 1.3, 0.0], 1, 4);

    let mut growth = GrowthEngine::new();
    assert_eq!(tree.year, 1);
    assert_eq!(tree.season, Season::Spring);

    // 1. Spring -> Summer
    let rep_spring = growth.advance_season(&mut tree, &mut rng);
    assert_eq!(tree.season, Season::Summer);
    assert_eq!(tree.year, 1);
    assert!(rep_spring.new_internodes_count > 0);

    // 2. Summer -> Autumn
    let rep_summer = growth.advance_season(&mut tree, &mut rng);
    assert_eq!(tree.season, Season::Autumn);
    assert_eq!(tree.year, 1);
    assert_eq!(rep_summer.season, Season::Summer);

    // 3. Autumn -> Winter
    let rep_autumn = growth.advance_season(&mut tree, &mut rng);
    assert_eq!(tree.season, Season::Winter);
    assert_eq!(tree.year, 1);
    assert_eq!(rep_autumn.season, Season::Autumn);

    // 4. Winter -> Spring (Year completes and rolls to next year)
    let rep_winter = growth.advance_season(&mut tree, &mut rng);
    assert_eq!(tree.season, Season::Spring);
    assert_eq!(tree.year, 2);
    assert_eq!(rep_winter.season, Season::Winter);
}

#[test]
fn test_cambium_thickening_in_summer() {
    let mut rng = DeterministicRng::new(777);
    let mut tree = TreeGraph::new();
    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    tree.attach_internode(trunk, [0.1, 1.4, 0.0], 1, 6);
    tree.compute_pipe_model(2.0, 0.05);

    let mut growth = GrowthEngine::new();
    // Advance through spring
    growth.advance_season(&mut tree, &mut rng);
    assert_eq!(tree.season, Season::Summer);

    let trunk_radius_before_summer = tree.get_segment(trunk).unwrap().radius;

    // Advance summer (secondary cambium division)
    growth.advance_season(&mut tree, &mut rng);
    assert_eq!(tree.season, Season::Autumn);

    let trunk_radius_after_summer = tree.get_segment(trunk).unwrap().radius;
    assert!(trunk_radius_after_summer > trunk_radius_before_summer);
}

#[test]
fn test_growth_determinism() {
    let mut rng1 = DeterministicRng::new(42);
    let mut tree1 = TreeGraph::new();
    let t1 = tree1.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    tree1.attach_internode(t1, [0.3, 1.5, 0.1], 1, 8);

    let mut rng2 = DeterministicRng::new(42);
    let mut tree2 = TreeGraph::new();
    let t2 = tree2.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    tree2.attach_internode(t2, [0.3, 1.5, 0.1], 1, 8);

    let mut growth1 = GrowthEngine::new();
    let mut growth2 = GrowthEngine::new();

    // Advance 4 seasons
    for _ in 0..4 {
        growth1.advance_season(&mut tree1, &mut rng1);
        growth2.advance_season(&mut tree2, &mut rng2);
    }

    assert_eq!(tree1.segments.len(), tree2.segments.len());
    assert_eq!(tree1.energy_pool, tree2.energy_pool);
    assert_eq!(tree1.year, tree2.year);
    assert_eq!(tree1.season, tree2.season);

    for (id, seg1) in &tree1.segments {
        let seg2 = tree2.segments.get(id).expect("Segment must exist in tree2");
        assert_eq!(seg1.start_pos, seg2.start_pos);
        assert_eq!(seg1.end_pos, seg2.end_pos);
        assert_eq!(seg1.radius, seg2.radius);
        assert_eq!(seg1.leaf_count, seg2.leaf_count);
    }
}

#[test]
fn test_zero_energy_growth_stagnation() {
    let mut rng = DeterministicRng::new(999);
    let mut tree = TreeGraph::new();
    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    tree.attach_internode(trunk, [0.1, 1.2, 0.0], 1, 0); // No leaves, zero energy
    tree.energy_pool = 0.0;

    let initial_count = tree.segments.len();
    let mut growth = GrowthEngine::new();

    // In spring with 0 energy, tree cannot flush new shoots
    let rep = growth.advance_season(&mut tree, &mut rng);
    assert_eq!(rep.new_internodes_count, 0);
    assert_eq!(tree.segments.len(), initial_count);
    assert!(tree.energy_pool >= 0.0);
}

#[test]
fn test_multi_year_simulation() {
    let mut rng = DeterministicRng::new(2026);
    let mut tree = TreeGraph::new();
    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    tree.attach_internode(trunk, [0.2, 1.3, 0.1], 1, 5);

    let mut growth = GrowthEngine::new();

    // Advance 3 full years (12 seasons)
    for _ in 0..12 {
        growth.advance_season(&mut tree, &mut rng);
    }

    assert_eq!(tree.year, 4);
    assert_eq!(tree.season, Season::Spring);
    // Tree has grown more segments and trunk has thickened significantly
    assert!(tree.segments.len() > 2);
    let trunk_radius = tree.get_segment(trunk).unwrap().radius;
    assert!(trunk_radius > 0.1);
}

