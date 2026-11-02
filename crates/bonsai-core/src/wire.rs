use crate::model::{TreeGraph, Vector3D, WireInfo};

#[derive(Clone, Debug, Default)]
pub struct WireEngine;

impl WireEngine {
    pub fn new() -> Self {
        Self
    }

    pub fn apply_wire(
        tree: &mut TreeGraph,
        segment_id: u32,
        gauge_mm: f32,
        target_direction: Vector3D,
    ) -> Result<(), String> {
        apply_wire(tree, segment_id, gauge_mm, target_direction)
    }

    pub fn remove_wire(
        tree: &mut TreeGraph,
        segment_id: u32,
    ) -> Result<(), String> {
        remove_wire(tree, segment_id)
    }
}

pub fn apply_wire(
    tree: &mut TreeGraph,
    segment_id: u32,
    gauge_mm: f32,
    target_direction: Vector3D,
) -> Result<(), String> {
    // 1. 校验铝丝规格范围 (1.0 - 4.0 mm)
    if !(1.0..=4.0).contains(&gauge_mm) {
        return Err(format!(
            "Wire gauge {:.2} mm out of valid range (1.0 - 4.0 mm)",
            gauge_mm
        ));
    }

    // 2. 目标方向向量模长校验
    let dir_len = (target_direction[0].powi(2)
        + target_direction[1].powi(2)
        + target_direction[2].powi(2))
    .sqrt();
    if dir_len < 1e-4 {
        return Err("Target direction vector cannot be zero".into());
    }
    let norm_dir = [
        target_direction[0] / dir_len,
        target_direction[1] / dir_len,
        target_direction[2] / dir_len,
    ];

    // 3. 查找枝段并校验粗度
    let seg = tree
        .get_segment(segment_id)
        .ok_or_else(|| format!("Segment {} not found", segment_id))?;

    let branch_thickness = seg.branch_thickness_mm();
    let min_gauge = branch_thickness / 3.0;
    if gauge_mm < min_gauge {
        return Err(format!(
            "Wire gauge {:.2} mm is too thin for branch thickness {:.1} mm (must be >= 1/3, required >= {:.2} mm)",
            gauge_mm, branch_thickness, min_gauge
        ));
    }

    // 4. 计算枝段长度并弯曲
    let seg_vec = [
        seg.end_pos[0] - seg.start_pos[0],
        seg.end_pos[1] - seg.start_pos[1],
        seg.end_pos[2] - seg.start_pos[2],
    ];
    let length = (seg_vec[0].powi(2) + seg_vec[1].powi(2) + seg_vec[2].powi(2)).sqrt();
    if length < 1e-4 {
        return Err("Segment has zero length".into());
    }

    let old_end = seg.end_pos;
    let start = seg.start_pos;
    let new_end = [
        start[0] + norm_dir[0] * length,
        start[1] + norm_dir[1] * length,
        start[2] + norm_dir[2] * length,
    ];

    let seg_mut = tree.get_segment_mut(segment_id).unwrap();
    seg_mut.pre_wire_end_pos = Some(old_end);
    seg_mut.end_pos = new_end;
    seg_mut.is_wired = true;
    seg_mut.wire_info = Some(WireInfo {
        gauge_mm,
        wired_seasons: 0,
        is_set: false,
        has_wire_bite: false,
    });

    let delta = [
        new_end[0] - old_end[0],
        new_end[1] - old_end[1],
        new_end[2] - old_end[2],
    ];
    shift_descendants(tree, segment_id, delta);

    Ok(())
}

pub fn remove_wire(tree: &mut TreeGraph, segment_id: u32) -> Result<(), String> {
    let seg = tree
        .get_segment(segment_id)
        .ok_or_else(|| format!("Segment {} not found", segment_id))?;

    let wire_info = seg
        .wire_info
        .clone()
        .ok_or_else(|| format!("Segment {} is not wired", segment_id))?;

    if !wire_info.is_set {
        // 若未木质化定型，拆线后发生部分回弹
        if let Some(orig_end) = seg.pre_wire_end_pos {
            let start = seg.start_pos;
            let cur_end = seg.end_pos;

            let v_cur = [
                cur_end[0] - start[0],
                cur_end[1] - start[1],
                cur_end[2] - start[2],
            ];
            let v_orig = [
                orig_end[0] - start[0],
                orig_end[1] - start[1],
                orig_end[2] - start[2],
            ];

            let len = (v_cur[0].powi(2) + v_cur[1].powi(2) + v_cur[2].powi(2)).sqrt();
            let len_orig = (v_orig[0].powi(2) + v_orig[1].powi(2) + v_orig[2].powi(2)).sqrt();

            if len > 1e-4 && len_orig > 1e-4 {
                let u_cur = [v_cur[0] / len, v_cur[1] / len, v_cur[2] / len];
                let u_orig = [v_orig[0] / len_orig, v_orig[1] / len_orig, v_orig[2] / len_orig];

                // 回弹 50%
                let u_spring = [
                    u_cur[0] * 0.5 + u_orig[0] * 0.5,
                    u_cur[1] * 0.5 + u_orig[1] * 0.5,
                    u_cur[2] * 0.5 + u_orig[2] * 0.5,
                ];
                let spring_norm =
                    (u_spring[0].powi(2) + u_spring[1].powi(2) + u_spring[2].powi(2)).sqrt();
                let u_norm = if spring_norm > 1e-4 {
                    [
                        u_spring[0] / spring_norm,
                        u_spring[1] / spring_norm,
                        u_spring[2] / spring_norm,
                    ]
                } else {
                    u_cur
                };

                let new_end = [
                    start[0] + u_norm[0] * len,
                    start[1] + u_norm[1] * len,
                    start[2] + u_norm[2] * len,
                ];

                let delta = [
                    new_end[0] - cur_end[0],
                    new_end[1] - cur_end[1],
                    new_end[2] - cur_end[2],
                ];

                let seg_mut = tree.get_segment_mut(segment_id).unwrap();
                seg_mut.end_pos = new_end;
                shift_descendants(tree, segment_id, delta);
            }
        }
    }
    // 若已定型 (is_set)，保持当前弯曲，无需位移

    let seg_mut = tree.get_segment_mut(segment_id).unwrap();
    seg_mut.wire_info = None;
    seg_mut.is_wired = false;
    seg_mut.pre_wire_end_pos = None;

    Ok(())
}

fn shift_descendants(tree: &mut TreeGraph, parent_id: u32, delta: Vector3D) {
    if delta[0].abs() < 1e-6 && delta[1].abs() < 1e-6 && delta[2].abs() < 1e-6 {
        return;
    }

    let mut stack = vec![parent_id];
    let mut child_ids = Vec::new();

    while let Some(pid) = stack.pop() {
        for s in tree.segments.values() {
            if s.parent_id == Some(pid) {
                child_ids.push(s.id);
                stack.push(s.id);
            }
        }
    }

    for cid in child_ids {
        if let Some(c) = tree.segments.get_mut(&cid) {
            c.start_pos[0] += delta[0];
            c.start_pos[1] += delta[1];
            c.start_pos[2] += delta[2];
            c.end_pos[0] += delta[0];
            c.end_pos[1] += delta[1];
            c.end_pos[2] += delta[2];
            if let Some(ref mut p) = c.pre_wire_end_pos {
                p[0] += delta[0];
                p[1] += delta[1];
                p[2] += delta[2];
            }
        }
    }
}
