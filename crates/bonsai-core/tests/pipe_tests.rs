use bonsai_core::model::TreeGraph;

#[test]
fn test_pipe_model_da_vinci_rule() {
    let mut tree = TreeGraph::new();
    let base = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let b1 = tree.attach_internode(base, [0.5, 2.0, 0.0], 1, 10);
    let b2 = tree.attach_internode(base, [-0.5, 2.0, 0.0], 1, 10);

    tree.compute_pipe_model(2.0, 0.05);

    let r_base = tree.get_segment(base).unwrap().radius;
    let r_b1 = tree.get_segment(b1).unwrap().radius;
    let r_b2 = tree.get_segment(b2).unwrap().radius;

    // r_base^2 ≈ r_b1^2 + r_b2^2
    let area_base = r_base * r_base;
    let area_children = r_b1 * r_b1 + r_b2 * r_b2;

    assert!(r_base > r_b1);
    assert!(r_base > r_b2);
    assert!((area_base - area_children).abs() < 0.001);
}

#[test]
fn test_tree_graph_remove_subtree() {
    let mut tree = TreeGraph::new();
    let base = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let b1 = tree.attach_internode(base, [0.5, 2.0, 0.0], 1, 10);
    let b2 = tree.attach_internode(base, [-0.5, 2.0, 0.0], 1, 10);
    let b1_child = tree.attach_internode(b1, [0.8, 3.0, 0.0], 2, 5);

    let removed = tree.remove_subtree(b1);
    assert!(removed.contains(&b1));
    assert!(removed.contains(&b1_child));
    assert_eq!(removed.len(), 2);

    assert!(tree.get_segment(base).is_some());
    assert!(tree.get_segment(b2).is_some());
    assert!(tree.get_segment(b1).is_none());
    assert!(tree.get_segment(b1_child).is_none());
}

#[test]
fn test_pipe_model_multilevel() {
    let mut tree = TreeGraph::new();
    let base = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let b1 = tree.attach_internode(base, [0.5, 2.0, 0.0], 1, 5);
    let b2 = tree.attach_internode(base, [-0.5, 2.0, 0.0], 1, 5);
    let c1 = tree.attach_internode(b1, [0.8, 2.5, 0.0], 2, 8);
    let c2 = tree.attach_internode(b1, [0.2, 2.6, 0.0], 2, 12);

    tree.compute_pipe_model(2.0, 0.05);

    let r_base = tree.get_segment(base).unwrap().radius;
    let r_b1 = tree.get_segment(b1).unwrap().radius;
    let r_b2 = tree.get_segment(b2).unwrap().radius;
    let r_c1 = tree.get_segment(c1).unwrap().radius;
    let r_c2 = tree.get_segment(c2).unwrap().radius;

    // Check intermediate branch b1
    let area_b1 = r_b1 * r_b1;
    let area_c_sum = r_c1 * r_c1 + r_c2 * r_c2;
    assert!((area_b1 - area_c_sum).abs() < 0.001);

    // Check base
    let area_base = r_base * r_base;
    let area_branches = r_b1 * r_b1 + r_b2 * r_b2;
    assert!((area_base - area_branches).abs() < 0.001);
}
