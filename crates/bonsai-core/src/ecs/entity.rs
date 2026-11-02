use serde::{Deserialize, Serialize};

/// 实体唯一标识符 (Entity)
/// 遵循 Bevy / Specs 实体设计：32 位索引 + 32 位代际 (Generation)
/// 保证在实体销毁和复用时绝不发生 ABA 悬挂引用
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct Entity {
    pub id: u32,
    pub generation: u32,
}

impl Entity {
    pub const NULL: Entity = Entity {
        id: u32::MAX,
        generation: 0,
    };

    #[inline]
    pub fn new(id: u32, generation: u32) -> Self {
        Self { id, generation }
    }

    #[inline]
    pub fn is_valid(&self) -> bool {
        self.id != u32::MAX
    }
}

/// 实体分配器 (EntityAllocator)
/// 维护空闲列表 (Free-list)，实现 O(1) 分配与释放
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct EntityAllocator {
    generations: Vec<u32>,
    free_indices: Vec<u32>,
}

impl EntityAllocator {
    pub fn new() -> Self {
        Self {
            generations: Vec::with_capacity(256),
            free_indices: Vec::new(),
        }
    }

    pub fn allocate(&mut self) -> Entity {
        if let Some(idx) = self.free_indices.pop() {
            let gen = self.generations[idx as usize];
            Entity::new(idx, gen)
        } else {
            let idx = self.generations.len() as u32;
            self.generations.push(1);
            Entity::new(idx, 1)
        }
    }

    pub fn deallocate(&mut self, entity: Entity) -> bool {
        let idx = entity.id as usize;
        if idx >= self.generations.len() {
            return false;
        }
        if self.generations[idx] != entity.generation {
            return false; // 代际不匹配，已被释放过
        }
        // 代际自增以失效现存实体引用
        self.generations[idx] = self.generations[idx].wrapping_add(1);
        self.free_indices.push(entity.id);
        true
    }

    pub fn is_alive(&self, entity: Entity) -> bool {
        let idx = entity.id as usize;
        idx < self.generations.len() && self.generations[idx] == entity.generation
    }

    pub fn clear(&mut self) {
        self.generations.clear();
        self.free_indices.clear();
    }
}
