use bonsai_core::model::TreeGraph;
use bonsai_core::rules::{RuleEngine, Severity};

#[test]
fn test_rule_r_prop_01_height_to_caliper_ratio() {
    let mut tree = TreeGraph::new();
    // 制造一棵细长如筷子的树 (高 2.5m, 直径仅 0.05m, 比例 50:1 严重违反 6:1)
    let trunk0 = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.25, 0.0]);
    let _trunk1 = tree.attach_internode(trunk0, [0.0, 2.5, 0.0], 0, 2);
    tree.compute_pipe_model(2.0, 0.02);

    let engine = RuleEngine::new();
    let issues = engine.evaluate_all(&tree, 0.0);

    let prop_issue = issues.iter().find(|i| i.rule_id == "R-PROP-01");
    assert!(prop_issue.is_some());
    let issue = prop_issue.unwrap();
    assert_eq!(issue.severity, Severity::Warning);
    assert_eq!(issue.message_key, "rule.prop.too_tall");
    assert_eq!(issue.evidence_segment_id, Some(trunk0));
}

#[test]
fn test_rule_r_prop_01_golden_ratio() {
    let mut tree = TreeGraph::new();
    // 高 1.2m, 根部直径 0.2m (radius 0.1), ratio = 1.2 / 0.2 = 6.0
    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.2, 0.0]);
    let base = tree.get_segment_mut(trunk).unwrap();
    base.radius = 0.1;

    let engine = RuleEngine::new();
    let issues = engine.evaluate_all(&tree, 0.0);

    let prop_issue = issues.iter().find(|i| i.rule_id == "R-PROP-01");
    assert!(prop_issue.is_some());
    let issue = prop_issue.unwrap();
    assert_eq!(issue.severity, Severity::Info);
    assert_eq!(issue.message_key, "rule.prop.golden_ratio");
}

#[test]
fn test_rule_r_prop_02_lowest_branch_too_high() {
    let mut tree = TreeGraph::new();
    let trunk0 = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let _trunk1 = tree.attach_internode(trunk0, [0.0, 2.0, 0.0], 0, 2);
    // 第一主枝出在 y = 1.0 处，总高 2.0m，出枝点高度比 = 50% > 35%
    let branch = tree.attach_internode(trunk0, [0.5, 1.5, 0.0], 1, 5);

    let engine = RuleEngine::new();
    let issues = engine.evaluate_all(&tree, 0.0);

    let issue = issues.iter().find(|i| i.rule_id == "R-PROP-02");
    assert!(issue.is_some());
    let issue = issue.unwrap();
    assert_eq!(issue.severity, Severity::Warning);
    assert_eq!(issue.message_key, "rule.prop.first_branch_too_high");
    assert_eq!(issue.evidence_segment_id, Some(branch));
}

#[test]
fn test_rule_r_prop_02_lowest_branch_ok() {
    let mut tree = TreeGraph::new();
    let trunk0 = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 0.5, 0.0]);
    let _trunk1 = tree.attach_internode(trunk0, [0.0, 2.0, 0.0], 0, 2);
    let _branch = tree.attach_internode(trunk0, [0.5, 0.8, 0.0], 1, 5);

    let engine = RuleEngine::new();
    let issues = engine.evaluate_all(&tree, 0.0);

    let issue = issues.iter().find(|i| i.rule_id == "R-PROP-02");
    assert!(issue.is_none());
}

#[test]
fn test_rule_r_prune_05_excessive_biomass_loss() {
    let tree = TreeGraph::new();
    let engine = RuleEngine::new();
    let issues = engine.evaluate_all(&tree, 0.35);

    let prune_issue = issues.iter().find(|i| i.rule_id == "R-PRUNE-05");
    assert!(prune_issue.is_some());
    let issue = prune_issue.unwrap();
    assert_eq!(issue.severity, Severity::Danger);
    assert_eq!(issue.message_key, "rule.prune.excessive_biomass_loss");
    assert_eq!(issue.evidence_segment_id, None);
}

#[test]
fn test_rule_r_prune_05_acceptable_loss() {
    let tree = TreeGraph::new();
    let engine = RuleEngine::new();
    let issues = engine.evaluate_all(&tree, 0.15);

    let prune_issue = issues.iter().find(|i| i.rule_id == "R-PRUNE-05");
    assert!(prune_issue.is_none());
}

#[test]
fn test_rule_r_prune_01_prefer_heading_back() {
    let mut tree = TreeGraph::new();
    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let branch1 = tree.attach_internode(trunk, [0.5, 1.2, 0.0], 1, 2);
    let _inner_branch = tree.attach_internode(branch1, [0.7, 1.5, 0.1], 2, 8);

    let engine = RuleEngine::new();
    let issue = engine.check_prune_action(&tree, branch1);

    assert!(issue.is_some());
    let issue = issue.unwrap();
    assert_eq!(issue.rule_id, "R-PRUNE-01");
    assert_eq!(issue.severity, Severity::Warning);
    assert_eq!(issue.message_key, "rule.prune.prefer_heading_back");
    assert_eq!(issue.evidence_segment_id, Some(branch1));
}

#[test]
fn test_rule_r_prune_01_safe_cut() {
    let mut tree = TreeGraph::new();
    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let branch1 = tree.attach_internode(trunk, [0.5, 1.2, 0.0], 1, 2);
    let inner_branch = tree.attach_internode(branch1, [0.7, 1.5, 0.1], 2, 8);

    let engine = RuleEngine::new();
    // 剪除外层/次级分枝（Order 2）属于合规回缩，不触发 R-PRUNE-01 警告
    let issue = engine.check_prune_action(&tree, inner_branch);
    assert!(issue.is_none());

    // 没有次级分枝的独立一级枝条，剪除亦不触发
    let mut tree2 = TreeGraph::new();
    let trunk2 = tree2.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let bare_branch = tree2.attach_internode(trunk2, [0.5, 1.2, 0.0], 1, 2);
    let issue2 = engine.check_prune_action(&tree2, bare_branch);
    assert!(issue2.is_none());
}

#[test]
fn test_empty_tree_no_crash() {
    let tree = TreeGraph::new();
    let engine = RuleEngine::new();
    let issues = engine.evaluate_all(&tree, 0.0);
    assert!(issues.is_empty());
}
