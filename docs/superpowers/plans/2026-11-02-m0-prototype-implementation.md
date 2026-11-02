# 《树境·盆景道》Rust 核心内核与 WASM/Web 交互原型实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 **Rust** 构建确定性盆景物理生长与修剪内核（`crates/bonsai-core`），利用 `wasm-pack` 编译为 WebAssembly，并在前端（Vite + TypeScript + Three.js）中跑通剪枝、达芬奇管道粗度重算、潜伏芽萌发（Clip & Grow）与结构骨架透视渲染，同时保留 C-ABI 供后续 Unity 移动原生端直接调用。

**Architecture:** 
1. **Rust 原生内核 (`crates/bonsai-core`)**：纯 Rust 实现，不含平台相关代码。维护树拓扑图、芽命运竞争、能量储备与修剪算子。自带原生 `cargo test` 单元测试。
2. **WASM 绑定层 (`crates/bonsai-core/src/wasm.rs`)**：通过 `wasm-bindgen` 向前端快速导出紧凑二进制/类型化几何数据（Flat Float32Array 缓冲区），杜绝大量 JS-WASM 跨边界对象传递开销。
3. **C-ABI 导出 (`crates/bonsai-core/src/ffi.rs`)**：导出基础 C 兼容接口，供后续 Unity 原生插件调用。
4. **前端渲染表现层 (`web/`)**：Vite + Three.js 通过加载 WASM 模块，实现 3D 射线交互点选剪枝、骨架透视着色与 HUD 统计。

**Tech Stack:** Rust (Edition 2021), wasm-pack, wasm-bindgen, TypeScript, Vite, Three.js, Vitest.

---

## 目录结构规划

```
/
├── Cargo.toml                       # Rust Workspace 配置
├── crates/
│   └── bonsai-core/                 # 核心 Rust 模拟引擎
│       ├── Cargo.toml
│       ├── src/
│       │   ├── lib.rs               # 模块入口
│       │   ├── rng.rs               # 确定性伪随机发生器 (PCG/Xorshift)
│       │   ├── model.rs             # 树木 DAG 拓扑与节间/芽数据结构
│       │   ├── pipe.rs              # 达芬奇管道模型粗细计算 (Pipe Model)
│       │   ├── prune.rs             # 剪枝算子与潜伏芽激活 (Clip & Grow)
│       │   ├── wasm.rs              # wasm-bindgen 快速导出接口
│       │   └── ffi.rs               # Unity C-ABI 预留导出
│       └── tests/
│           ├── rng_tests.rs
│           ├── pipe_tests.rs
│           └── prune_tests.rs
├── web/                             # 前端渲染展示与交互 (Vite + Three.js)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.ts                  # WASM 载入、场景初始化、Raycaster 点选剪枝
│       └── view/
│           ├── mesh-generator.ts    # 解析 WASM 缓冲区并生成 Three.js Mesh
│           ├── skeleton-view.ts     # 骨架透视控制器
│           └── scene-setup.ts       # 光照、阴影、盆器与相机
```

---

### Task 1: Rust Workspace 与 bonsai-core 基础工程搭建

**Files:**
- Create: `Cargo.toml`
- Create: `crates/bonsai-core/Cargo.toml`
- Create: `crates/bonsai-core/src/lib.rs`

**Interfaces:**
- Produces: `crates/bonsai-core` 库，支持 `cargo test`。

- [ ] **Step 1: 创建根目录 Cargo.toml**

```toml
[workspace]
members = [
    "crates/bonsai-core",
]
resolver = "2"
```

- [ ] **Step 2: 创建 `crates/bonsai-core/Cargo.toml`**

```toml
[package]
name = "bonsai-core"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"

[dev-dependencies]
wasm-bindgen-test = "0.3"
```

- [ ] **Step 3: 创建 `crates/bonsai-core/src/lib.rs`**

```rust
pub mod rng;
pub mod model;
pub mod pipe;
pub mod prune;
pub mod wasm;
pub mod ffi;

pub use model::TreeGraph;
```

- [ ] **Step 4: 编译检查**

Run: `cargo check`
Expected: 成功创建 Cargo.lock 并在后续模块填充后通过。

---

### Task 2: Rust 确定性随机数发生器 (PRNG) 实现与测试

**Files:**
- Create: `crates/bonsai-core/src/rng.rs`
- Test: `crates/bonsai-core/tests/rng_tests.rs`

**Interfaces:**
- Produces: `DeterministicRng` 结构体，支持 `new(seed: u64)`, `next_f32() -> f32`, `range(min: f32, max: f32) -> f32`。

- [ ] **Step 1: 编写测试 `crates/bonsai-core/tests/rng_tests.rs`**

```rust
use bonsai_core::rng::DeterministicRng;

#[test]
fn test_rng_determinism() {
    let mut rng1 = DeterministicRng::new(12345);
    let mut rng2 = DeterministicRng::new(12345);

    for _ in 0..100 {
        assert_eq!(rng1.next_f32(), rng2.next_f32());
    }
}

#[test]
fn test_rng_range() {
    let mut rng = DeterministicRng::new(42);
    for _ in 0..100 {
        let val = rng.range(5.0, 15.0);
        assert!(val >= 5.0 && val < 15.0);
    }
}
```

- [ ] **Step 2: 实现 `crates/bonsai-core/src/rng.rs`**

```rust
#[derive(Clone, Debug)]
pub struct DeterministicRng {
    state: u64,
}

impl DeterministicRng {
    pub fn new(seed: u64) -> Self {
        let state = if seed == 0 { 0x853c49e6748fea9b } else { seed };
        Self { state }
    }

    pub fn next_u32(&mut self) -> u32 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.state = x;
        (x & 0xFFFFFFFF) as u32
    }

    pub fn next_f32(&mut self) -> f32 {
        (self.next_u32() as f32) / 4294967296.0
    }

    pub fn range(&mut self, min: f32, max: f32) -> f32 {
        min + self.next_f32() * (max - min)
    }
}
```

- [ ] **Step 3: 运行测试并验证通过**

Run: `cargo test --test rng_tests`
Expected: test result: ok. 2 passed.

---

### Task 3: 树木 DAG 拓扑模型与达芬奇管道模型粗度计算

**Files:**
- Create: `crates/bonsai-core/src/model.rs`
- Create: `crates/bonsai-core/src/pipe.rs`
- Test: `crates/bonsai-core/tests/pipe_tests.rs`

**Interfaces:**
- Produces: `TreeGraph`，提供 `create_base_internode`, `attach_internode`, `compute_pipe_model(exponent, min_tip_radius)`。

- [ ] **Step 1: 编写测试 `crates/bonsai-core/tests/pipe_tests.rs`**

```rust
use bonsai_core::model::TreeGraph;

#[test]
fn test_pipe_model_da_vinci_rule() {
    let mut tree = TreeGraph::new();
    let base = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let b1 = tree.attach_internode(base, [0.5, 2.0, 0.0], 1, 10);
    let b2 = tree.attach_internode(base, [-0.5, 2.0, 0.0], 1, 10);

    tree.compute_pipe_model(2.0, 0.05);

    let r_base = tree.get_segment(base).unwrap().radius;
    let r_b1 = tree.get_segment(b1).unwrap().radius;
    let r_b2 = tree.get_segment(b2).unwrap().radius;

    // r_base^2 ≈ r_b1^2 + r_b2^2
    let area_base = r_base * r_base;
    let area_children = r_b1 * r_b1 + r_b2 * r_b2;

    assert!(r_base > r_b1);
    assert!(r_base > r_b2);
    assert!((area_base - area_children).abs() < 0.001);
}
```

- [ ] **Step 2: 实现 `crates/bonsai-core/src/model.rs`**

```rust
use std::collections::HashMap;

pub type Vector3D = [f32; 3];

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
}

#[derive(Clone, Debug)]
pub struct TreeGraph {
    pub segments: HashMap<u32, InternodeSegment>,
    pub root_id: Option<u32>,
    next_id: u32,
}

impl TreeGraph {
    pub fn new() -> Self {
        Self {
            segments: HashMap::new(),
            root_id: None,
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
        };
        self.segments.insert(id, seg);
        self.root_id = Some(id);
        id
    }

    pub fn attach_internode(&mut self, parent_id: u32, end: Vector3D, order: u8, leaf_count: u32) -> u32 {
        let parent_end = self.segments.get(&parent_id)
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
        };
        self.segments.insert(id, seg);
        id
    }

    pub fn get_segment(&self, id: u32) -> Option<&InternodeSegment> {
        self.segments.get(&id)
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
        removed
    }
}
```

- [ ] **Step 3: 实现 `crates/bonsai-core/src/pipe.rs`**

```rust
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

        if let Some(root) = self.root_id {
            if self.segments.contains_key(&root) {
                calc_radius(root, &mut self.segments, &children_map, exponent, min_tip_radius);
            }
        }
    }
}
```

- [ ] **Step 4: 运行测试并验证通过**

Run: `cargo test --test pipe_tests`
Expected: test result: ok. 1 passed.

---

### Task 4: 剪枝算子与潜伏芽萌发激活引擎

**Files:**
- Create: `crates/bonsai-core/src/prune.rs`
- Test: `crates/bonsai-core/tests/prune_tests.rs`

**Interfaces:**
- Produces: `PruningEngine`，提供 `prune_branch(tree, target_id) -> PruneResult`，并在截口下方激活不定芽。

- [ ] **Step 1: 编写测试 `crates/bonsai-core/tests/prune_tests.rs`**

```rust
use bonsai_core::model::TreeGraph;
use bonsai_core::rng::DeterministicRng;
use bonsai_core::prune::PruningEngine;

#[test]
fn test_clip_and_grow_prune() {
    let mut rng = DeterministicRng::new(999);
    let mut tree = TreeGraph::new();

    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let branch = tree.attach_internode(trunk, [0.5, 1.8, 0.0], 1, 15);

    let mut engine = PruningEngine::new();
    let res = engine.prune_branch(&mut tree, branch, &mut rng);

    assert_eq!(res.removed_count, 1);
    assert!(tree.get_segment(branch).is_none());
    assert!(tree.get_segment(trunk).is_some());
    assert!(!res.activated_buds.is_empty());
}
```

- [ ] **Step 2: 实现 `crates/bonsai-core/src/prune.rs`**

```rust
use crate::model::{TreeGraph, Vector3D};
use crate::rng::DeterministicRng;

pub struct PruneResult {
    pub removed_count: usize,
    pub biomass_loss_ratio: f32,
    pub activated_buds: Vec<ActivatedBud>,
}

pub struct ActivatedBud {
    pub parent_id: u32,
    pub direction: Vector3D,
}

pub struct PruningEngine;

impl PruningEngine {
    pub fn new() -> Self {
        Self
    }

    pub fn prune_branch(&mut self, tree: &mut TreeGraph, target_id: u32, rng: &mut DeterministicRng) -> PruneResult {
        let total_leaves_before: u32 = tree.segments.values().map(|s| s.leaf_count).sum();
        let parent_id = tree.get_segment(target_id).and_then(|s| s.parent_id);

        let removed_ids = tree.remove_subtree(target_id);
        let total_leaves_after: u32 = tree.segments.values().map(|s| s.leaf_count).sum();

        let loss_ratio = if total_leaves_before > 0 {
            (total_leaves_before - total_leaves_after) as f32 / total_leaves_before as f32
        } else {
            0.0
        };

        let mut activated_buds = Vec::new();
        if let Some(pid) = parent_id {
            if tree.get_segment(pid).is_some() {
                let count = if rng.range(1.0, 3.0) > 1.8 { 2 } else { 1 };
                for _ in 0..count {
                    let angle = rng.range(0.0, std::f32::consts::TAU);
                    let dir: Vector3D = [
                        angle.cos() * 0.7,
                        rng.range(0.2, 0.8),
                        angle.sin() * 0.7,
                    ];
                    activated_buds.push(ActivatedBud { parent_id: pid, direction: dir });
                }
            }
        }

        tree.compute_pipe_model(2.0, 0.05);

        PruneResult {
            removed_count: removed_ids.len(),
            biomass_loss_ratio: loss_ratio,
            activated_buds,
        }
    }
}
```

- [ ] **Step 3: 运行测试并验证通过**

Run: `cargo test --test prune_tests`
Expected: test result: ok. 1 passed.

---

### Task 5: WASM 快速导出接口 (Float32Array 零拷贝缓冲区) 与 Unity C-ABI 预留

**Files:**
- Create: `crates/bonsai-core/src/wasm.rs`
- Create: `crates/bonsai-core/src/ffi.rs`

**Interfaces:**
- Produces: `BonsaiWasmEngine` 结构体，通过 `wasm_bindgen` 暴露 `init_tree()`, `prune(id)`, `get_render_buffer() -> Vec<f32>`。

- [ ] **Step 1: 编写 `crates/bonsai-core/src/wasm.rs`**

```rust
use wasm_bindgen::prelude::*;
use crate::model::TreeGraph;
use crate::rng::DeterministicRng;
use crate::prune::PruningEngine;

#[wasm_bindgen]
pub struct BonsaiWasmEngine {
    tree: TreeGraph,
    rng: DeterministicRng,
    pruning: PruningEngine,
}

#[wasm_bindgen]
impl BonsaiWasmEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u32) -> Self {
        let mut engine = Self {
            tree: TreeGraph::new(),
            rng: DeterministicRng::new(seed as u64),
            pruning: PruningEngine::new(),
        };
        engine.init_default_tree();
        engine
    }

    fn init_default_tree(&mut self) {
        let base = self.tree.create_base_internode([0.0, 0.25, 0.0], [0.0, 0.8, 0.0]);
        let b1 = self.tree.attach_internode(base, [0.3, 1.3, 0.1], 1, 15);
        let b2 = self.tree.attach_internode(base, [-0.25, 1.4, -0.2], 1, 12);
        self.tree.attach_internode(b1, [0.5, 1.8, 0.2], 2, 20);
        self.tree.attach_internode(b2, [-0.4, 1.9, -0.3], 2, 18);
        self.tree.compute_pipe_model(2.0, 0.05);
    }

    /// 执行剪枝，切除指定枝条并激活潜伏芽
    pub fn prune_branch(&mut self, segment_id: u32) -> bool {
        if self.tree.get_segment(segment_id).is_none() {
            return false;
        }
        let res = self.pruning.prune_branch(&mut self.tree, segment_id, &mut self.rng);
        for bud in res.activated_buds {
            if let Some(parent) = self.tree.get_segment(bud.parent_id).cloned() {
                let new_end = [
                    parent.end_pos[0] + bud.direction[0] * 0.3,
                    parent.end_pos[1] + bud.direction[1] * 0.3,
                    parent.end_pos[2] + bud.direction[2] * 0.3,
                ];
                self.tree.attach_internode(parent.id, new_end, parent.order + 1, 5);
            }
        }
        self.tree.compute_pipe_model(2.0, 0.05);
        true
    }

    /// 打包全部节间数据供前端 Three.js 直读：
    /// 每个枝段布局 [id, order, radius, startX, startY, startZ, endX, endY, endZ] (共 9 个 f32)
    pub fn get_segments_buffer(&self) -> Vec<f32> {
        let mut buffer = Vec::with_capacity(self.tree.segments.len() * 9);
        for seg in self.tree.segments.values() {
            buffer.push(seg.id as f32);
            buffer.push(seg.order as f32);
            buffer.push(seg.radius);
            buffer.push(seg.start_pos[0]);
            buffer.push(seg.start_pos[1]);
            buffer.push(seg.start_pos[2]);
            buffer.push(seg.end_pos[0]);
            buffer.push(seg.end_pos[1]);
            buffer.push(seg.end_pos[2]);
        }
        buffer
    }
}
```

- [ ] **Step 2: 编写 `crates/bonsai-core/src/ffi.rs` (Unity C-ABI 预留)**

```rust
use crate::model::TreeGraph;

#[no_mangle]
pub extern "C" fn bonsai_create_engine() -> *mut TreeGraph {
    let tree = Box::new(TreeGraph::new());
    Box::into_raw(tree)
}

#[no_mangle]
pub extern "C" fn bonsai_destroy_engine(ptr: *mut TreeGraph) {
    if !ptr.is_null() {
        unsafe { drop(Box::from_raw(ptr)) };
    }
}
```

- [ ] **Step 3: 运行 `cargo check` 确保编译无误**

Run: `cargo check`
Expected: Finished dev profile.

---

### Task 6: 前端工程与 wasm-pack 构建链接集成

**Files:**
- Create: `web/package.json`
- Create: `web/vite.config.ts`
- Create: `web/tsconfig.json`
- Create: `web/index.html`
- Create: `web/src/view/scene-setup.ts`
- Create: `web/src/view/skeleton-view.ts`
- Create: `web/src/main.ts`

- [ ] **Step 1: 安装 wasm-pack (如未安装) 并编译 WASM 包**

Run: `which wasm-pack || cargo install wasm-pack`
Run: `wasm-pack build crates/bonsai-core --target web --out-dir ../../web/pkg`
Expected: 生成 `web/pkg/bonsai_core.js` 与 `web/pkg/bonsai_core_bg.wasm`。

- [ ] **Step 2: 配置 `web/package.json`**

```json
{
  "name": "bonsai-dojo-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build"
  },
  "dependencies": {
    "three": "^0.170.0"
  },
  "devDependencies": {
    "@types/three": "^0.170.0",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vite-plugin-wasm": "^3.3.0",
    "vite-plugin-top-level-await": "^1.4.4"
  }
}
```

- [ ] **Step 3: 配置 `web/vite.config.ts` 启用 WASM 支持**

```typescript
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
});
```

- [ ] **Step 4: 实现前端主控制器 `web/src/main.ts` 读取 WASM Buffer**

```typescript
import * as THREE from 'three';
import init, { BonsaiWasmEngine } from '../pkg/bonsai_core.js';
import { SceneSetup } from './view/scene-setup';
import { SkeletonView } from './view/skeleton-view';

async function bootstrap() {
  await init();
  const engine = new BonsaiWasmEngine(2026);
  const container = document.getElementById('canvas-container')!;
  const stage = new SceneSetup(container);
  const skeleton = new SkeletonView();

  let treeGroup = new THREE.Group();
  stage.scene.add(treeGroup);

  const barkMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.85 });

  function renderTreeFromWasm() {
    // 清空现有 Mesh
    while (treeGroup.children.length > 0) {
      treeGroup.remove(treeGroup.children[0]);
    }

    const buffer = engine.get_segments_buffer();
    // 缓冲区按每 9 个浮点数一个节间段展开: [id, order, radius, sx, sy, sz, ex, ey, ez]
    for (let i = 0; i < buffer.length; i += 9) {
      const id = buffer[i];
      const order = buffer[i + 1];
      const radius = buffer[i + 2];
      const p1 = new THREE.Vector3(buffer[i + 3], buffer[i + 4], buffer[i + 5]);
      const p2 = new THREE.Vector3(buffer[i + 6], buffer[i + 7], buffer[i + 8]);

      const dist = p1.distanceTo(p2);
      const geom = new THREE.CylinderGeometry(radius * 0.85, radius, dist, 8);
      const mesh = new THREE.Mesh(geom, barkMaterial);

      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      mesh.position.copy(mid);

      const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

      mesh.userData = { segmentId: id, order };
      treeGroup.add(mesh);
    }
  }

  renderTreeFromWasm();

  // Raycaster 点选剪枝
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  window.addEventListener('click', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, stage.camera);
    const hits = raycaster.intersectObjects(treeGroup.children);
    if (hits.length > 0) {
      const segId = hits[0].object.userData?.segmentId;
      const order = hits[0].object.userData?.order;
      if (segId !== undefined && order > 0) {
        // 调用 Rust WASM 物理剪枝内核
        const pruned = engine.prune_branch(segId);
        if (pruned) {
          renderTreeFromWasm();
        }
      }
    }
  });

  document.getElementById('btn-toggle-skeleton')?.addEventListener('click', () => {
    skeleton.toggle(treeGroup);
  });

  function loop() {
    requestAnimationFrame(loop);
    treeGroup.rotation.y += 0.002;
    stage.render();
  }
  loop();
}

bootstrap();
```

- [ ] **Step 5: 启动测试验证通过**

Run: `cd web && npm install && npm run build`
Expected: 构建成功，生成产物，WASM 正常链接。

---

### Task 7: 远程仓库同步与持续集成提交

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: 提交代码并推送远程 master 分支**

```bash
git add Cargo.toml crates/ web/ docs/superpowers/plans/2026-11-02-m0-prototype-implementation.md
git commit -m "feat: complete Rust-first WASM core and Three.js integration implementation plan"
git push origin master
```
