use crate::model::TreeGraph;
use super::{DiagnosticIssue, Severity};

/// 计算并评估全树高径比 (R-PROP-01)
pub fn evaluate_height_to_caliper(tree: &TreeGraph) -> Option<DiagnosticIssue> {
    if tree.segments.is_empty() {
        return None;
    }

    // 优先取 root_id 对应的基部段，若无则取 parent_id 为 None 且 order 为 0 或起始 y 最小的段
    let base_seg = tree
        .root_id
        .and_then(|id| tree.get_segment(id))
        .or_else(|| {
            tree.segments
                .values()
                .filter(|s| s.parent_id.is_none() && s.order == 0)
                .min_by(|a, b| a.start_pos[1].partial_cmp(&b.start_pos[1]).unwrap())
        })
        .or_else(|| {
            tree.segments
                .values()
                .filter(|s| s.parent_id.is_none())
                .min_by(|a, b| a.start_pos[1].partial_cmp(&b.start_pos[1]).unwrap())
        })?;

    let caliper_diameter = base_seg.radius * 2.0;
    if caliper_diameter <= 1e-5 {
        return None;
    }

    let min_y = base_seg.start_pos[1];
    let mut max_y = min_y;
    for seg in tree.segments.values() {
        max_y = max_y.max(seg.start_pos[1]).max(seg.end_pos[1]);
    }

    let total_height = (max_y - min_y).max(0.0);
    if total_height <= 1e-5 {
        return None;
    }

    let ratio = total_height / caliper_diameter;

    if ratio > 9.0 {
        Some(DiagnosticIssue {
            rule_id: "R-PROP-01".to_string(),
            severity: Severity::Warning,
            message_key: "rule.prop.too_tall".to_string(),
            evidence_segment_id: Some(base_seg.id),
            detail: format!(
                "树高与干径比为 {:.1}:1，超过 9.0:1 上限，干身过于细高，缺乏老树苍古气象",
                ratio
            ),
        })
    } else if (5.0..=7.0).contains(&ratio) {
        Some(DiagnosticIssue {
            rule_id: "R-PROP-01".to_string(),
            severity: Severity::Info,
            message_key: "rule.prop.golden_ratio".to_string(),
            evidence_segment_id: Some(base_seg.id),
            detail: format!(
                "树高与干径比为 {:.1}:1，符合 6:1 黄金高径比区间 (5.0~7.0:1)",
                ratio
            ),
        })
    } else {
        None
    }
}

/// 评估最低第一主枝出枝高度 (R-PROP-02)
pub fn evaluate_lowest_branch_height(tree: &TreeGraph) -> Option<DiagnosticIssue> {
    if tree.segments.is_empty() {
        return None;
    }

    let base_y = tree
        .root_id
        .and_then(|id| tree.get_segment(id))
        .map(|s| s.start_pos[1])
        .unwrap_or_else(|| {
            tree.segments
                .values()
                .map(|s| s.start_pos[1])
                .fold(f32::INFINITY, f32::min)
        });

    let mut max_y = base_y;
    for seg in tree.segments.values() {
        max_y = max_y.max(seg.start_pos[1]).max(seg.end_pos[1]);
    }

    let total_height = (max_y - base_y).max(0.0);
    if total_height <= 1e-5 {
        return None;
    }

    // 找到 Order 为 1 的所有一级分枝中出枝点 (start_pos.y) 最低者
    let lowest_order1_branch = tree
        .segments
        .values()
        .filter(|s| s.order == 1)
        .min_by(|a, b| a.start_pos[1].partial_cmp(&b.start_pos[1]).unwrap())?;

    let branch_height = (lowest_order1_branch.start_pos[1] - base_y).max(0.0);
    let ratio = branch_height / total_height;

    // 若最低主枝出枝高度 > 树总高度的 1/3 (0.35)
    if ratio > 0.35 {
        Some(DiagnosticIssue {
            rule_id: "R-PROP-02".to_string(),
            severity: Severity::Warning,
            message_key: "rule.prop.first_branch_too_high".to_string(),
            evidence_segment_id: Some(lowest_order1_branch.id),
            detail: format!(
                "最低第一主枝出枝高度占比为 {:.1}% (高 {:.2}m / 总高 {:.2}m)，高于设计高度的 1/3 (35%)，破坏下盘稳重感",
                ratio * 100.0,
                branch_height,
                total_height
            ),
        })
    } else {
        None
    }
}

/// 聚合评估所有比例相关规则
pub fn evaluate_proportions(tree: &TreeGraph, issues: &mut Vec<DiagnosticIssue>) {
    if let Some(issue) = evaluate_height_to_caliper(tree) {
        issues.push(issue);
    }
    if let Some(issue) = evaluate_lowest_branch_height(tree) {
        issues.push(issue);
    }
}
