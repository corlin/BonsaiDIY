use serde::{Deserialize, Serialize};
use crate::ecs::world::BonsaiWorld;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Severity {
    Info,
    Warning,
    Danger,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DiagnosticIssue {
    pub rule_id: String,
    pub severity: Severity,
    pub message_key: String,
    pub evidence_segment_id: Option<u32>,
    pub detail: String,
}

/// 盆景美学与造型审计系统 (RuleAuditSystem)
/// 基于 Reddit r/Bonsai Wiki 规则全量审定比例与健康状态
pub fn run_rule_audit_system(world: &BonsaiWorld, recent_loss_ratio: f32) -> Vec<DiagnosticIssue> {
    let mut issues = Vec::new();

    // 1. 获取树木几何包围体与关键节点
    let Some(root) = world.root_entity else {
        return issues;
    };
    let Some(root_geom) = world.geometries.get(&root) else {
        return issues;
    };

    let caliper = root_geom.radius * 2.0;
    let base_y = root_geom.start[1];

    let mut max_y = root_geom.end[1];
    for geom in world.geometries.values() {
        if geom.end[1] > max_y {
            max_y = geom.end[1];
        }
    }
    let total_height = (max_y - base_y).max(0.01);

    // ===== 规则 R-PROP-01: 高径比 (Height-to-Caliper Ratio, 黄金比例 6:1 ~ 8:1) =====
    if caliper > 1e-4 {
        let ratio = total_height / caliper;
        if ratio > 12.0 {
            issues.push(DiagnosticIssue {
                rule_id: "R-PROP-01".to_string(),
                severity: Severity::Danger,
                message_key: "ratio_too_slender".to_string(),
                evidence_segment_id: Some(root.id),
                detail: format!(
                    "高径比严重超标 ({:.1}:1, 黄金区间 6:1~8:1)。树干过于细高弱瘦，建议蓄枝截干矮化逼芽加粗。",
                    ratio
                ),
            });
        } else if ratio > 8.5 {
            issues.push(DiagnosticIssue {
                rule_id: "R-PROP-01".to_string(),
                severity: Severity::Warning,
                message_key: "ratio_slightly_high".to_string(),
                evidence_segment_id: Some(root.id),
                detail: format!(
                    "高径比偏高 ({:.1}:1, 黄金区间 6:1~8:1)。可通过回缩修剪上部顶芽抑制徒长。",
                    ratio
                ),
            });
        } else if ratio >= 5.5 && ratio <= 8.5 {
            issues.push(DiagnosticIssue {
                rule_id: "R-PROP-01".to_string(),
                severity: Severity::Info,
                message_key: "ratio_optimal".to_string(),
                evidence_segment_id: Some(root.id),
                detail: format!(
                    "高径比极其理想 ({:.1}:1, 黄金区间 6:1~8:1)。树干具备苍老沉稳的盆景骨力与名木气质。",
                    ratio
                ),
            });
        }
    }

    // ===== 规则 R-PROP-02: 第一大主枝出枝高度比例 (约在全树高 1/3 ~ 2/5 处) =====
    let mut lowest_primary_branch_y: Option<(f32, u32)> = None;
    for (&ent, hier) in &world.hierarchies {
        if hier.order == 1 {
            if let Some(geom) = world.geometries.get(&ent) {
                let start_y = geom.start[1];
                if lowest_primary_branch_y.is_none() || start_y < lowest_primary_branch_y.unwrap().0 {
                    lowest_primary_branch_y = Some((start_y, ent.id));
                }
            }
        }
    }

    if let Some((first_y, seg_id)) = lowest_primary_branch_y {
        let branch_height_ratio = (first_y - base_y) / total_height;
        if branch_height_ratio > 0.65 {
            issues.push(DiagnosticIssue {
                rule_id: "R-PROP-02".to_string(),
                severity: Severity::Warning,
                message_key: "lowest_branch_too_high".to_string(),
                evidence_segment_id: Some(seg_id),
                detail: format!(
                    "第一大主枝出枝过高 (占比 {:.0}%, 建议在 30%~40% 处)。底部主干过于空旷突兀。",
                    branch_height_ratio * 100.0
                ),
            });
        } else if branch_height_ratio < 0.20 {
            issues.push(DiagnosticIssue {
                rule_id: "R-PROP-02".to_string(),
                severity: Severity::Warning,
                message_key: "lowest_branch_too_low".to_string(),
                evidence_segment_id: Some(seg_id),
                detail: format!(
                    "第一大主枝出枝偏低 (占比 {:.0}%, 建议在 30%~40% 处)。遮挡了下盘优美根盘展露。",
                    branch_height_ratio * 100.0
                ),
            });
        }
    }

    // ===== 规则 R-PRUNE-05: 单季过量修剪严重告警 (生物质损失 > 20%) =====
    if recent_loss_ratio > 0.20 {
        issues.push(DiagnosticIssue {
            rule_id: "R-PRUNE-05".to_string(),
            severity: Severity::Danger,
            message_key: "excessive_pruning".to_string(),
            evidence_segment_id: None,
            detail: format!(
                "单季生物质修剪损失达 {:.1}% (上限 20.0%)！过度修剪可能导致养分耗竭枯死，请暂停截干静养。",
                recent_loss_ratio * 100.0
            ),
        });
    }

    issues
}
