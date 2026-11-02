use crate::model::TreeGraph;
use std::collections::HashMap;

impl TreeGraph {
    pub fn compute_pipe_model(&mut self, exponent: f32, min_tip_radius: f32) {
        let mut children_map: HashMap<u32, Vec<u32>> = HashMap::new();
        for seg in self.segments.values() {
            if let Some(pid) = seg.parent_id {
                children_map.entry(pid).or_default().push(seg.id);
            }
        }

        fn calc_radius(
            id: u32,
            segments: &mut HashMap<u32, crate::model::InternodeSegment>,
            children_map: &HashMap<u32, Vec<u32>>,
            exponent: f32,
            min_tip_radius: f32,
        ) -> f32 {
            let children = children_map.get(&id).cloned().unwrap_or_default();
            if children.is_empty() {
                let seg = segments.get_mut(&id).unwrap();
                seg.radius = min_tip_radius * (seg.leaf_count as f32).sqrt().max(1.0);
                return seg.radius;
            }

            let mut sum_exp = 0.0;
            for child_id in children {
                let r = calc_radius(child_id, segments, children_map, exponent, min_tip_radius);
                sum_exp += r.powf(exponent);
            }

            let seg = segments.get_mut(&id).unwrap();
            seg.radius = sum_exp.powf(1.0 / exponent);
            seg.radius
        }

        let roots: Vec<u32> = self
            .segments
            .values()
            .filter(|s| s.parent_id.is_none() || !self.segments.contains_key(&s.parent_id.unwrap()))
            .map(|s| s.id)
            .collect();

        for root in roots {
            calc_radius(
                root,
                &mut self.segments,
                &children_map,
                exponent,
                min_tip_radius,
            );
        }
    }
}
