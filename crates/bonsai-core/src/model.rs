use std::collections::HashMap;
use serde::{Deserialize, Serialize};

pub type Vector3D = [f32; 3];

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Season {
    Spring,
    Summer,
    Autumn,
    Winter,
}

impl Season {
    pub fn next(&self) -> Season {
        match self {
            Season::Spring => Season::Summer,
            Season::Summer => Season::Autumn,
            Season::Autumn => Season::Winter,
            Season::Winter => Season::Spring,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct WireInfo {
    pub gauge_mm: f32,          // 铝丝规格 (1.0 - 4.0 mm)
    pub wired_seasons: u32,     // 缠绕持续的生长季计数
    pub is_set: bool,           // 是否已完成木质化塑性定型
    pub has_wire_bite: bool,    // 是否已产生嵌线勒痕
}

#[derive(Clone, Debug)]
pub struct InternodeSegment {
    pub id: u32,
    pub parent_id: Option<u32>,
    pub start_pos: Vector3D,
    pub end_pos: Vector3D,
    pub order: u8,
    pub radius: f32,
    pub leaf_count: u32,
    pub is_wired: bool,
    pub wire_info: Option<WireInfo>,
    pub pre_wire_end_pos: Option<Vector3D>,
}

impl InternodeSegment {
    pub fn branch_thickness_mm(&self) -> f32 {
        if self.radius < 0.02 {
            self.radius * 2000.0
        } else {
            self.radius * 100.0
        }
    }
}

#[derive(Clone, Debug)]
pub struct TreeGraph {
    pub segments: HashMap<u32, InternodeSegment>,
    pub root_id: Option<u32>,
    pub season: Season,
    pub energy_pool: f32,
    pub year: u32,
    next_id: u32,
}

impl TreeGraph {
    pub fn new() -> Self {
        Self {
            segments: HashMap::new(),
            root_id: None,
            season: Season::Spring,
            energy_pool: 100.0,
            year: 1,
            next_id: 1,
        }
    }

    pub fn create_base_internode(&mut self, start: Vector3D, end: Vector3D) -> u32 {
        let id = self.next_id;
        self.next_id += 1;

        let seg = InternodeSegment {
            id,
            parent_id: None,
            start_pos: start,
            end_pos: end,
            order: 0,
            radius: 0.1,
            leaf_count: 1,
            is_wired: false,
            wire_info: None,
            pre_wire_end_pos: None,
        };
        self.segments.insert(id, seg);
        self.root_id = Some(id);
        id
    }

    pub fn attach_internode(
        &mut self,
        parent_id: u32,
        end: Vector3D,
        order: u8,
        leaf_count: u32,
    ) -> u32 {
        let parent_end = self
            .segments
            .get(&parent_id)
            .expect("Parent segment not found")
            .end_pos;

        let id = self.next_id;
        self.next_id += 1;

        let seg = InternodeSegment {
            id,
            parent_id: Some(parent_id),
            start_pos: parent_end,
            end_pos: end,
            order,
            radius: 0.05,
            leaf_count,
            is_wired: false,
            wire_info: None,
            pre_wire_end_pos: None,
        };
        self.segments.insert(id, seg);
        id
    }

    pub fn get_segment(&self, id: u32) -> Option<&InternodeSegment> {
        self.segments.get(&id)
    }

    pub fn get_segment_mut(&mut self, id: u32) -> Option<&mut InternodeSegment> {
        self.segments.get_mut(&id)
    }

    pub fn remove_subtree(&mut self, target_id: u32) -> Vec<u32> {
        let mut removed = Vec::new();
        let mut stack = vec![target_id];

        while let Some(current_id) = stack.pop() {
            removed.push(current_id);
            for seg in self.segments.values() {
                if seg.parent_id == Some(current_id) {
                    stack.push(seg.id);
                }
            }
        }

        for id in &removed {
            self.segments.remove(id);
        }
        if let Some(root) = self.root_id {
            if removed.contains(&root) {
                self.root_id = None;
            }
        }
        removed
    }
}

impl Default for TreeGraph {
    fn default() -> Self {
        Self::new()
    }
}
