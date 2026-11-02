pub mod proportions;
pub mod pruning_rules;

use serde::{Deserialize, Serialize};
use crate::model::TreeGraph;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Severity {
    Info,
    Warning,
    Danger,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct DiagnosticIssue {
    pub rule_id: String,
    pub severity: Severity,
    pub message_key: String,
    pub evidence_segment_id: Option<u32>,
    pub detail: String,
}

#[derive(Clone, Debug, Default)]
pub struct RuleEngine;

impl RuleEngine {
    pub fn new() -> Self {
        Self
    }

    /// 全量评估树木当前状态的 Wiki 规则
    pub fn evaluate_all(&self, tree: &TreeGraph, recent_loss_ratio: f32) -> Vec<DiagnosticIssue> {
        let mut issues = Vec::new();
        proportions::evaluate_proportions(tree, &mut issues);
        pruning_rules::evaluate_pruning_rules(tree, recent_loss_ratio, &mut issues);
        issues
    }

    /// 评估特定剪枝动作是否违反 Wiki 规则（如 R-PRUNE-01 回缩剪优先）
    pub fn check_prune_action(&self, tree: &TreeGraph, target_segment_id: u32) -> Option<DiagnosticIssue> {
        pruning_rules::check_heading_back(tree, target_segment_id)
    }

    /// 别名：评估特定剪枝动作
    pub fn evaluate_prune_action(&self, tree: &TreeGraph, target_segment_id: u32) -> Option<DiagnosticIssue> {
        self.check_prune_action(tree, target_segment_id)
    }
}
