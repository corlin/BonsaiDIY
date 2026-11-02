use bonsai_core::model::{TreeGraph, WireInfo};
use bonsai_core::growth::GrowthEngine;
use bonsai_core::rng::DeterministicRng;
use bonsai_core::wire::WireEngine;

#[test]
fn test_apply_wire_success_and_geometry_bend() {
    let mut tree = TreeGraph::new();
    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let branch = tree.attach_internode(trunk, [0.0, 1.8, 0.0], 1, 5);

    // Set branch radius to 3mm (0.003m) -> branch diameter = 6.0mm
    tree.get_segment_mut(branch).unwrap().radius = 0.003;

    // A 6mm branch requires wire gauge >= 6.0 / 3.0 = 2.0mm.
    // 2.5mm gauge is valid.
    let res = WireEngine::apply_wire(&mut tree, branch, 2.5, [1.0, 0.0, 0.0]);
    assert!(res.is_ok(), "apply_wire should succeed: {:?}", res);

    let seg = tree.get_segment(branch).unwrap();
    assert!(seg.is_wired);
    assert_eq!(
        seg.wire_info,
        Some(WireInfo {
            gauge_mm: 2.5,
            wired_seasons: 0,
            is_set: false,
            has_wire_bite: false,
        })
    );

    // Branch start is [0.0, 1.0, 0.0], original end was [0.0, 1.8, 0.0] (length 0.8)
    // Bent towards [1.0, 0.0, 0.0], new end should be [0.8, 1.0, 0.0]
    let end = seg.end_pos;
    assert!((end[0] - 0.8).abs() < 1e-4);
    assert!((end[1] - 1.0).abs() < 1e-4);
    assert!((end[2] - 0.0).abs() < 1e-4);
}

#[test]
fn test_apply_wire_gauge_too_thin_fails() {
    let mut tree = TreeGraph::new();
    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let branch = tree.attach_internode(trunk, [0.0, 1.8, 0.0], 1, 5);
    tree.get_segment_mut(branch).unwrap().radius = 0.003; // diameter = 6.0mm

    // Wire gauge 1.5mm is < 6.0 / 3.0 = 2.0mm -> too thin!
    let res = WireEngine::apply_wire(&mut tree, branch, 1.5, [1.0, 0.0, 0.0]);
    assert!(res.is_err(), "Expected error for wire gauge that is too thin");

    let seg = tree.get_segment(branch).unwrap();
    assert!(!seg.is_wired);
    assert!(seg.wire_info.is_none());
    // End position should remain unbent
    assert_eq!(seg.end_pos, [0.0, 1.8, 0.0]);
}

#[test]
fn test_apply_wire_invalid_gauge_range() {
    let mut tree = TreeGraph::new();
    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let branch = tree.attach_internode(trunk, [0.0, 1.8, 0.0], 1, 5);
    tree.get_segment_mut(branch).unwrap().radius = 0.001;

    // Below 1.0mm
    let res_low = WireEngine::apply_wire(&mut tree, branch, 0.8, [1.0, 0.0, 0.0]);
    assert!(res_low.is_err());

    // Above 4.0mm
    let res_high = WireEngine::apply_wire(&mut tree, branch, 4.5, [1.0, 0.0, 0.0]);
    assert!(res_high.is_err());
}

#[test]
fn test_apply_wire_nonexistent_segment() {
    let mut tree = TreeGraph::new();
    let res = WireEngine::apply_wire(&mut tree, 9999, 2.0, [1.0, 0.0, 0.0]);
    assert!(res.is_err());
}

#[test]
fn test_remove_wire_without_setting_springback() {
    let mut rng = DeterministicRng::new(42);
    let mut tree = TreeGraph::new();
    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let branch = tree.attach_internode(trunk, [0.0, 1.8, 0.0], 1, 5);
    tree.get_segment_mut(branch).unwrap().radius = 0.003;

    // Bend towards [1.0, 0.0, 0.0]
    WireEngine::apply_wire(&mut tree, branch, 2.5, [1.0, 0.0, 0.0]).unwrap();
    let bent_end = tree.get_segment(branch).unwrap().end_pos;
    assert!((bent_end[0] - 0.8).abs() < 1e-4);

    // Advance 1 season: wired_seasons becomes 1, is_set is false
    let mut growth = GrowthEngine::new();
    growth.advance_season(&mut tree, &mut rng);

    let info_before = tree.get_segment(branch).unwrap().wire_info.clone().unwrap();
    assert_eq!(info_before.wired_seasons, 1);
    assert!(!info_before.is_set);

    // Remove wire before plastic setting
    let res = WireEngine::remove_wire(&mut tree, branch);
    assert!(res.is_ok());

    let seg = tree.get_segment(branch).unwrap();
    assert!(!seg.is_wired);
    assert!(seg.wire_info.is_none());

    // Partial springback:
    // Should NOT be fully at bent_end [0.8, 1.0, 0.0] nor fully at original [0.0, 1.8, 0.0]
    let sprung_end = seg.end_pos;
    assert!(sprung_end[0] > 0.1 && sprung_end[0] < 0.79, "x should spring back partially: {}", sprung_end[0]);
    assert!(sprung_end[1] > 1.01 && sprung_end[1] < 1.79, "y should spring back partially: {}", sprung_end[1]);

    // Segment length should be preserved (0.8)
    let len = ((sprung_end[0] - seg.start_pos[0]).powi(2)
        + (sprung_end[1] - seg.start_pos[1]).powi(2)
        + (sprung_end[2] - seg.start_pos[2]).powi(2))
        .sqrt();
    assert!((len - 0.8).abs() < 1e-3, "Branch length must be preserved, got {}", len);
}

#[test]
fn test_wire_setting_after_two_seasons_maintains_bend() {
    let mut rng = DeterministicRng::new(42);
    let mut tree = TreeGraph::new();
    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let branch = tree.attach_internode(trunk, [0.0, 1.8, 0.0], 1, 5);
    tree.get_segment_mut(branch).unwrap().radius = 0.003;

    WireEngine::apply_wire(&mut tree, branch, 2.5, [1.0, 0.0, 0.0]).unwrap();

    let mut growth = GrowthEngine::new();
    // Advance 2 seasons
    growth.advance_season(&mut tree, &mut rng);
    growth.advance_season(&mut tree, &mut rng);

    let info = tree.get_segment(branch).unwrap().wire_info.clone().unwrap();
    assert_eq!(info.wired_seasons, 2);
    assert!(info.is_set, "Should be set after 2 seasons");
    assert!(!info.has_wire_bite, "Should not bite after only 2 seasons");

    // Remove wire after setting
    WireEngine::remove_wire(&mut tree, branch).unwrap();

    let seg = tree.get_segment(branch).unwrap();
    assert!(!seg.is_wired);
    assert!(seg.wire_info.is_none());

    // Should maintain bent position (no springback)
    let end = seg.end_pos;
    assert!((end[0] - 0.8).abs() < 1e-3);
    assert!((end[1] - 1.0).abs() < 1e-3);
    assert!((end[2] - 0.0).abs() < 1e-3);
}

#[test]
fn test_wire_bite_hazard_after_four_seasons() {
    let mut rng = DeterministicRng::new(42);
    let mut tree = TreeGraph::new();
    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let branch = tree.attach_internode(trunk, [0.0, 1.8, 0.0], 1, 5);
    tree.get_segment_mut(branch).unwrap().radius = 0.003;

    WireEngine::apply_wire(&mut tree, branch, 2.5, [1.0, 0.0, 0.0]).unwrap();

    let mut growth = GrowthEngine::new();
    // Advance 4 seasons
    for season_idx in 1..=4 {
        growth.advance_season(&mut tree, &mut rng);
        let info = tree.get_segment(branch).unwrap().wire_info.clone().unwrap();
        assert_eq!(info.wired_seasons, season_idx);
        if season_idx >= 2 {
            assert!(info.is_set);
        }
        if season_idx >= 4 {
            assert!(info.has_wire_bite, "Wire bite hazard must trigger at seasons >= 4");
        } else {
            assert!(!info.has_wire_bite);
        }
    }
}

#[test]
fn test_remove_wire_unwired_or_nonexistent() {
    let mut tree = TreeGraph::new();
    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);

    // Unwired segment
    let res1 = WireEngine::remove_wire(&mut tree, trunk);
    assert!(res1.is_err());

    // Non-existent segment
    let res2 = WireEngine::remove_wire(&mut tree, 8888);
    assert!(res2.is_err());
}

#[test]
fn test_wiring_propagates_to_child_segments() {
    let mut tree = TreeGraph::new();
    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let b1 = tree.attach_internode(trunk, [0.0, 1.8, 0.0], 1, 5);
    let b2 = tree.attach_internode(b1, [0.0, 2.4, 0.0], 2, 3);
    tree.get_segment_mut(b1).unwrap().radius = 0.003;

    // Bend b1 from [0.0, 1.8, 0.0] towards [1.0, 0.0, 0.0]
    WireEngine::apply_wire(&mut tree, b1, 2.5, [1.0, 0.0, 0.0]).unwrap();

    let seg1 = tree.get_segment(b1).unwrap();
    let seg2 = tree.get_segment(b2).unwrap();

    // Child b2 start_pos must match b1 end_pos!
    assert_eq!(seg2.start_pos, seg1.end_pos);
    // Child b2 end_pos should also have shifted by delta [0.8, -0.8, 0.0]
    // Original b2 was [0.0, 2.4, 0.0], shifted should be [0.8, 1.6, 0.0]
    assert!((seg2.end_pos[0] - 0.8).abs() < 1e-4);
    assert!((seg2.end_pos[1] - 1.6).abs() < 1e-4);
}
