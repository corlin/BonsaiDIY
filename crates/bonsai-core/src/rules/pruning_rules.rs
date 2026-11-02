use crate::model::TreeGraph;
use super::{DiagnosticIssue, Severity};

/// 评估单次剪除生物质体量 (R-PRUNE-05)
pub fn evaluate_biomass_loss(recent_loss_ratio: f32) -> Option<DiagnosticIssue> {
    if recent_loss_ratio > 0.20 {
        Some(DiagnosticIssue {
            rule_id: "R-PRUNE-05".to_string(),
            severity: Severity::Danger,
            message_key: "rule.prune.excessive_biomass_loss".to_string(),
            evidence_segment_id: None,
            detail: format!(
                "单次修剪损失生物质体量 {:.1}%，超过 20% 安全阈值，可能导致树势严重衰退",
                recent_loss_ratio * 100.0
            ),
        })
    } else {
        None
    }
}

/// 评估是否违反回缩剪优先原则 (R-PRUNE-01)
/// 若修剪直接移除了贴近主干的一级主枝（Order 1）且该主枝上保留有健康的内膛分枝，触发 Warning
pub fn check_heading_back(tree: &TreeGraph, target_id: u32) -> Option<DiagnosticIssue> {
    let target = tree.get_segment(target_id)?;
    if target.order != 1 {
        return None;
    }

    let has_healthy_inner_branch = has_inner_lateral_branches(tree, target_id);

    if has_healthy_inner_branch {
        Some(DiagnosticIssue {
            rule_id: "R-PRUNE-01".to_string(),
            severity: Severity::Warning,
            message_key: "rule.prune.prefer_heading_back".to_string(),
            evidence_segment_id: Some(target_id),
            detail: "优先进行回缩修剪而非直接基部去枝，靠近主干的次级内膛枝是未来枝托回缩的命脉。".to_string(),
        })
    } else {
        None
    }
}

fn has_inner_lateral_branches(tree: &TreeGraph, target_id: u32) -> bool {
    let mut stack = vec![target_id];
    let mut found = false;

    while let Some(curr_id) = stack.pop() {
        for seg in tree.segments.values() {
            if seg.parent_id == Some(curr_id) {
                stack.push(seg.id);
                if seg.order >= 2 && seg.leaf_count > 0 {
                    found = true;
                }
            }
        }
    }
    found
}

/// 聚合评估所有剪枝相关规则
pub fn evaluate_pruning_rules(
    _tree: &TreeGraph,
    recent_loss_ratio: f32,
    issues: &mut Vec<DiagnosticIssue>,
) {
    if let Some(issue) = evaluate_biomass_loss(recent_loss_ratio) {
        issues.push(issue);
    }
}
