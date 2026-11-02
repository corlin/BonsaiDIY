use bonsai_core::model::TreeGraph;
use bonsai_core::rng::DeterministicRng;
use bonsai_core::prune::PruningEngine;

#[test]
fn test_clip_and_grow_prune() {
    let mut rng = DeterministicRng::new(999);
    let mut tree = TreeGraph::new();

    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let branch = tree.attach_internode(trunk, [0.5, 1.8, 0.0], 1, 15);

    let mut engine = PruningEngine::new();
    let res = engine.prune_branch(&mut tree, branch, &mut rng);

    assert_eq!(res.removed_count, 1);
    assert!(tree.get_segment(branch).is_none());
    assert!(tree.get_segment(trunk).is_some());
    assert!(!res.activated_buds.is_empty());
}

#[test]
fn test_biomass_loss_calculation() {
    let mut rng = DeterministicRng::new(42);
    let mut tree = TreeGraph::new();

    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]); // leaf_count = 1
    let b1 = tree.attach_internode(trunk, [1.0, 1.5, 0.0], 1, 10);
    let b2 = tree.attach_internode(trunk, [-1.0, 1.5, 0.0], 1, 10);
    // Total leaves = 1 + 10 + 10 = 21

    let mut engine = PruningEngine::new();
    let res = engine.prune_branch(&mut tree, b1, &mut rng);

    assert_eq!(res.removed_count, 1);
    // Loss should be 10 / 21 ≈ 0.47619
    let expected_loss = 10.0 / 21.0;
    assert!((res.biomass_loss_ratio - expected_loss).abs() < 1e-4);
    assert!(tree.get_segment(b1).is_none());
    assert!(tree.get_segment(b2).is_some());
}

#[test]
fn test_prune_subtree_cascade() {
    let mut rng = DeterministicRng::new(1234);
    let mut tree = TreeGraph::new();

    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let b1 = tree.attach_internode(trunk, [0.5, 1.5, 0.0], 1, 5);
    let b2 = tree.attach_internode(b1, [0.8, 2.0, 0.0], 2, 8);
    let b3 = tree.attach_internode(b2, [1.0, 2.5, 0.0], 3, 12);

    let mut engine = PruningEngine::new();
    let res = engine.prune_branch(&mut tree, b1, &mut rng);

    assert_eq!(res.removed_count, 3);
    assert!(tree.get_segment(b1).is_none());
    assert!(tree.get_segment(b2).is_none());
    assert!(tree.get_segment(b3).is_none());
    assert!(tree.get_segment(trunk).is_some());
    assert!(!res.activated_buds.is_empty());
    for bud in &res.activated_buds {
        assert_eq!(bud.parent_id, trunk);
    }
}
