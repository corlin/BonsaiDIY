# 《树境·盆景道》M0 阶段玩法原型与物理手感实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个在浏览器中运行、无外部重型依赖的 TypeScript + Three.js 盆景物理修剪与生长原型（M0 Prototype），严格验证 Pałubicki 芽命运决策、达芬奇管道粗细定理、剪枝诱导潜伏芽萌发（Clip & Grow 蓄枝截干）与铝丝蟠扎形变手感，并提供确定性操作回放机制。

**Architecture:** 采用**数据-模拟-渲染三层完全解耦**。模拟内核采用纯 TypeScript 实现（作为后续 Rust 内核的直接参照规约），不引用任何 DOM 或 Three.js 依赖；渲染层负责将拓扑图（TreeGraph）转化为动态管状网格（Cylinder/Tube Mesh）和叶片团块；输入层通过 Raycaster 捕获枝段并执行原子化园艺操作指令（ActionCommand），同时记录可追溯的操作事件流。

**Tech Stack:** TypeScript 5.x, Three.js, Vite, Vitest (单元测试), TailwindCSS (极简 HUD 控制面板)

## Global Constraints
- 所有物理生长与修剪计算必须在纯逻辑层完成，严禁在渲染循环中直接修改生理拓扑结构。
- 模拟过程必须具备严格的确定性：给定相同的随机数种子（Seed）和相同的操作指令序列，必须产生几何拓扑逐字节一致的树木状态。
- 遵循 TDD 流程：先写失败测试，验证失败，写最小实现，验证通过，立即提交。
- 文件路径一律使用小写字母加短横线或语义清晰的模块结构。

---

## 模块与文件目录分解图

```
src/
├── core/                        # 纯数学与生理逻辑内核（无 UI/Three.js 依赖）
│   ├── math/
│   │   ├── rng.ts               # 确定性伪随机数发生器 (PCG/Xorshift)
│   │   └── spline.ts            # 三次贝塞尔样条与挠度物理形变
│   ├── model/
│   │   ├── types.ts             # 芽、节间、树木拓扑核心接口
│   │   └── tree-graph.ts        # 树拓扑 DAG 图结构、达芬奇管道模型计算
│   ├── simulation/
│   │   ├── growth-engine.ts     # 生理演进器：光通量、顶端优势分配、节间伸长
│   │   └── pruning-engine.ts    # 园艺技法算子：回缩截断、疏剪、潜伏芽萌发激活
│   └── replay/
│       └── action-log.ts        # 确定性指令日志、快照序列化与反序列化
├── view/                        # Three.js 渲染与交互表现层
│   ├── mesh-generator.ts        # 树木骨干网格程序化生成器 (动态管状 Mesh)
│   ├── foliage-renderer.ts      # 风格化叶簇团块生成
│   ├── skeleton-view.ts         # 结构透视镜 (枝序高亮、半透明滤镜)
│   └── scene-setup.ts           # 柔和漫反射环境光、地面阴影与相机控制器
└── main.ts                      # 原型挂载入口与交互控制手柄 (剪枝/蟠扎/时间快进)
tests/                           # Vitest 单元测试集
├── rng.test.ts
├── tree-graph.test.ts
├── pruning-engine.test.ts
└── action-log.test.ts
```

---

### Task 1: 项目工程与测试环境脚手架搭建

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `tests/setup.ts`

**Interfaces:**
- Produces: 能够运行 `npm run dev` 启动本地 Vite 开发服务器，运行 `npm run test` 执行 Vitest 自动化单元测试。

- [ ] **Step 1: 创建 package.json 并配置依赖**

```json
{
  "name": "bonsai-dojo-prototype",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "three": "^0.170.0"
  },
  "devDependencies": {
    "@types/three": "^0.170.0",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "strict": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: 创建 vite.config.ts**

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 4: 创建基础 HTML 入口 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>树境·盆景道 | M0 物理手感交互原型</title>
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #22252a; font-family: sans-serif; }
    #canvas-container { width: 100%; height: 100%; }
    #hud-panel { position: absolute; top: 16px; left: 16px; background: rgba(20,24,30,0.85); backdrop-filter: blur(8px); padding: 14px; border-radius: 8px; color: #eee; min-width: 240px; box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
    button { background: #3b4252; color: #eceff4; border: 1px solid #4c566a; padding: 6px 12px; margin: 4px 2px; border-radius: 4px; cursor: pointer; }
    button:hover { background: #434c5e; }
  </style>
</head>
<body>
  <div id="hud-panel">
    <h3 style="margin: 0 0 8px 0; font-size: 16px;">树境·盆景道 (M0 原型)</h3>
    <div id="stats" style="font-size: 12px; color: #88c0d0; margin-bottom: 8px;">状态：就绪</div>
    <div>
      <button id="btn-grow-season">前进 1 个生长季 (+1 Year)</button>
      <button id="btn-toggle-skeleton">骨架透视模式</button>
      <button id="btn-undo">撤销 (Undo)</button>
      <button id="btn-reset">重置为初始生胚</button>
    </div>
  </div>
  <div id="canvas-container"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 5: 验证安装与测试命令**

Run: `npm install && npm run test`
Expected: PASS (测试结果无报错，0 suites 或通过提示)

- [ ] **Step 6: 提交脚手架**

```bash
git add package.json tsconfig.json vite.config.ts index.html
git commit -m "chore: initialize M0 prototype project scaffolding with Vite and Vitest"
```

---

### Task 2: 确定性伪随机数发生器 (PRNG)

**Files:**
- Create: `src/core/math/rng.ts`
- Test: `tests/rng.test.ts`

**Interfaces:**
- Produces: `DeterministicRng` 类，包含 `nextFloat(): number`, `range(min, max): number`, `fork(): DeterministicRng`。

- [ ] **Step 1: 编写测试用例 `tests/rng.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { DeterministicRng } from '../src/core/math/rng';

describe('DeterministicRng', () => {
  it('should produce identical float sequences from the same seed', () => {
    const rng1 = new DeterministicRng(12345);
    const rng2 = new DeterministicRng(12345);

    for (let i = 0; i < 20; i++) {
      expect(rng1.nextFloat()).toBe(rng2.nextFloat());
    }
  });

  it('should produce different sequences from different seeds', () => {
    const rng1 = new DeterministicRng(1111);
    const rng2 = new DeterministicRng(9999);

    const s1 = Array.from({ length: 5 }, () => rng1.nextFloat());
    const s2 = Array.from({ length: 5 }, () => rng2.nextFloat());
    expect(s1).not.toEqual(s2);
  });

  it('should generate floats in [0, 1) and correctly scale within range', () => {
    const rng = new DeterministicRng(42);
    for (let i = 0; i < 50; i++) {
      const val = rng.range(5, 15);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThan(15);
    }
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run tests/rng.test.ts`
Expected: FAIL (Cannot find module '../src/core/math/rng')

- [ ] **Step 3: 编写最小实现 `src/core/math/rng.ts`**

```typescript
/**
 * 32位确定性线性同余/Xorshift混合随机发生器
 */
export class DeterministicRng {
  private state: number;

  constructor(seed: number) {
    this.state = (seed ^ 0x6c078965) >>> 0;
  }

  public nextUint32(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  public nextFloat(): number {
    return (this.nextUint32() >>> 0) / 4294967296.0;
  }

  public range(min: number, max: number): number {
    return min + this.nextFloat() * (max - min);
  }

  public fork(): DeterministicRng {
    return new DeterministicRng(this.nextUint32());
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run tests/rng.test.ts`
Expected: PASS

- [ ] **Step 5: 提交代码**

```bash
git add src/core/math/rng.ts tests/rng.test.ts
git commit -m "feat: implement deterministic pseudo-random number generator"
```

---

### Task 3: 树木拓扑结构与达芬奇管道粗度模型

**Files:**
- Create: `src/core/model/types.ts`
- Create: `src/core/model/tree-graph.ts`
- Test: `tests/tree-graph.test.ts`

**Interfaces:**
- Consumes: `DeterministicRng`
- Produces: `TreeGraph` 类，维护节间段（Internode）、芽节点（Bud）、树枝层级（order），并提供 `computePipeModelRadii(exponent: number)` 计算全树各段物理粗细。

- [ ] **Step 1: 定义核心接口 `src/core/model/types.ts`**

```typescript
export type Vector3D = [number, number, number];

export enum BudType {
  Terminal = 'terminal',  // 顶芽
  Lateral = 'lateral',    // 侧芽
  Dormant = 'dormant',    // 潜伏芽 (潜伏在树皮内部)
}

export interface BudNode {
  id: string;
  type: BudType;
  position: Vector3D;
  direction: Vector3D;
  inhibited: boolean;     // 是否被顶端优势所抑制
  vigor: number;          // 活力值 0.0 - 1.0
}

export interface InternodeSegment {
  id: string;
  parentId: string | null;
  startPos: Vector3D;
  endPos: Vector3D;
  order: number;          // 0: 主干, 1: 一级主枝, 2: 二级次枝, 3+: 细分枝
  radius: number;         // 截面物理半径 (由管道模型动态计算)
  length: number;
  terminalBudId?: string;
  lateralBudIds: string[];
  leafCount: number;      // 支撑的叶片数量
  isWired: boolean;       // 是否处于蟠扎状态
}
```

- [ ] **Step 2: 编写测试用例 `tests/tree-graph.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { TreeGraph } from '../src/core/model/tree-graph';

describe('TreeGraph & Pipe Model', () => {
  it('should correctly attach internode and calculate radii via Da Vinci rule', () => {
    const tree = new TreeGraph();
    // 根基部段 (order 0)
    const baseId = tree.createBaseInternode([0, 0, 0], [0, 1, 0]);
    // 两个分枝
    const branch1 = tree.attachInternode(baseId, [0, 2, 0.5], 1, 10);
    const branch2 = tree.attachInternode(baseId, [0, 2, -0.5], 1, 15);

    // 运行达芬奇管道模型计算粗度
    tree.computePipeModelRadii(2.0, 0.05);

    const base = tree.getSegment(baseId)!;
    const b1 = tree.getSegment(branch1)!;
    const b2 = tree.getSegment(branch2)!;

    // 母枝截面积应近似等于两子枝截面积之和: r_base^2 ≈ r_1^2 + r_2^2
    const baseArea = Math.PI * Math.pow(base.radius, 2);
    const childrenArea = Math.PI * Math.pow(b1.radius, 2) + Math.PI * Math.pow(b2.radius, 2);

    expect(base.radius).toBeGreaterThan(b1.radius);
    expect(base.radius).toBeGreaterThan(b2.radius);
    expect(Math.abs(baseArea - childrenArea)).toBeLessThan(0.001);
  });
});
```

- [ ] **Step 3: 运行测试验证失败**

Run: `npx vitest run tests/tree-graph.test.ts`
Expected: FAIL (Cannot find module '../src/core/model/tree-graph')

- [ ] **Step 4: 编写实现 `src/core/model/tree-graph.ts`**

```typescript
import { Vector3D, InternodeSegment, BudNode, BudType } from './types';

export class TreeGraph {
  private segments: Map<string, InternodeSegment> = new Map();
  private buds: Map<string, BudNode> = new Map();
  private rootSegmentId: string | null = null;
  private nextId = 1;

  public createBaseInternode(start: Vector3D, end: Vector3D): string {
    const id = `seg_${this.nextId++}`;
    const segment: InternodeSegment = {
      id,
      parentId: null,
      startPos: start,
      endPos: end,
      order: 0,
      radius: 0.1,
      length: this.distance(start, end),
      lateralBudIds: [],
      leafCount: 1,
      isWired: false,
    };
    this.segments.set(id, segment);
    this.rootSegmentId = id;
    return id;
  }

  public attachInternode(parentId: string, end: Vector3D, order: number, initialLeaves = 5): string {
    const parent = this.segments.get(parentId);
    if (!parent) throw new Error(`Parent segment not found: ${parentId}`);

    const id = `seg_${this.nextId++}`;
    const segment: InternodeSegment = {
      id,
      parentId,
      startPos: [...parent.endPos],
      endPos: end,
      order,
      radius: 0.05,
      length: this.distance(parent.endPos, end),
      lateralBudIds: [],
      leafCount: initialLeaves,
      isWired: false,
    };
    this.segments.set(id, segment);
    return id;
  }

  public getSegment(id: string): InternodeSegment | undefined {
    return this.segments.get(id);
  }

  public getAllSegments(): InternodeSegment[] {
    return Array.from(this.segments.values());
  }

  public removeSegmentSubtree(segmentId: string): string[] {
    const removed: string[] = [];
    const collect = (id: string) => {
      removed.push(id);
      for (const seg of this.segments.values()) {
        if (seg.parentId === id) {
          collect(seg.id);
        }
      }
    };
    collect(segmentId);
    for (const id of removed) {
      this.segments.delete(id);
    }
    return removed;
  }

  public computePipeModelRadii(exponent = 2.0, minTipRadius = 0.02): void {
    const childrenMap = new Map<string, string[]>();
    for (const seg of this.segments.values()) {
      if (seg.parentId) {
        const arr = childrenMap.get(seg.parentId) || [];
        arr.push(seg.id);
        childrenMap.set(seg.parentId, arr);
      }
    }

    const computeRadius = (id: string): number => {
      const seg = this.segments.get(id)!;
      const children = childrenMap.get(id) || [];
      if (children.length === 0) {
        seg.radius = minTipRadius * Math.max(1.0, Math.sqrt(seg.leafCount));
        return seg.radius;
      }
      let sumExp = 0;
      for (const childId of children) {
        const rChild = computeRadius(childId);
        sumExp += Math.pow(rChild, exponent);
      }
      seg.radius = Math.pow(sumExp, 1.0 / exponent);
      return seg.radius;
    };

    if (this.rootSegmentId && this.segments.has(this.rootSegmentId)) {
      computeRadius(this.rootSegmentId);
    }
  }

  private distance(a: Vector3D, b: Vector3D): number {
    return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }
}
```

- [ ] **Step 5: 运行测试验证通过**

Run: `npx vitest run tests/tree-graph.test.ts`
Expected: PASS

- [ ] **Step 6: 提交代码**

```bash
git add src/core/model/types.ts src/core/model/tree-graph.ts tests/tree-graph.test.ts
git commit -m "feat: implement tree graph topology and Da Vinci pipe model radii calculation"
```

---

### Task 4: 园艺剪枝算子与潜伏芽萌发激活引擎

**Files:**
- Create: `src/core/simulation/pruning-engine.ts`
- Test: `tests/pruning-engine.test.ts`

**Interfaces:**
- Consumes: `TreeGraph`, `DeterministicRng`
- Produces: `PruningEngine`，提供 `pruneBranch(segmentId)`，计算切除损失比例，并在切口下方一定区间内唤醒潜伏芽（Back-budding），模拟蓄枝截干（Clip & Grow）的自然反应。

- [ ] **Step 1: 编写测试用例 `tests/pruning-engine.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { TreeGraph } from '../src/core/model/tree-graph';
import { PruningEngine } from '../src/core/simulation/pruning-engine';
import { DeterministicRng } from '../src/core/math/rng';

describe('PruningEngine (Clip & Grow)', () => {
  it('should remove target branch subtree and trigger back-budding below chop site', () => {
    const rng = new DeterministicRng(777);
    const tree = new TreeGraph();
    const trunk0 = tree.createBaseInternode([0, 0, 0], [0, 1, 0]);
    const trunk1 = tree.attachInternode(trunk0, [0, 2, 0], 0, 10);
    const topBranch = tree.attachInternode(trunk1, [0, 3, 0], 1, 20);

    const pruning = new PruningEngine(tree, rng);
    
    // 执行截顶截干 (Trunk Chop / Heading Back)
    const result = pruning.pruneBranch(topBranch);

    expect(result.removedCount).toBe(1);
    expect(tree.getSegment(topBranch)).toBeUndefined();
    expect(tree.getSegment(trunk1)).toBeDefined();

    // 截顶后应激活切口下方的萌芽反应
    expect(result.activatedBuds.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run tests/pruning-engine.test.ts`
Expected: FAIL (Cannot find module '../src/core/simulation/pruning-engine')

- [ ] **Step 3: 编写实现 `src/core/simulation/pruning-engine.ts`**

```typescript
import { TreeGraph } from '../model/tree-graph';
import { DeterministicRng } from '../math/rng';
import { Vector3D } from '../model/types';

export interface PruneResult {
  removedCount: number;
  biomassLossRatio: number;
  activatedBuds: Array<{ parentId: string; direction: Vector3D }>;
}

export class PruningEngine {
  constructor(private tree: TreeGraph, private rng: DeterministicRng) {}

  public pruneBranch(targetSegmentId: string): PruneResult {
    const allSegsBefore = this.tree.getAllSegments();
    const totalLeavesBefore = allSegsBefore.reduce((acc, s) => acc + s.leafCount, 0);

    const target = this.tree.getSegment(targetSegmentId);
    if (!target) {
      throw new Error(`Target segment not found: ${targetSegmentId}`);
    }

    const parentId = target.parentId;
    const removedIds = this.tree.removeSegmentSubtree(targetSegmentId);

    const totalLeavesAfter = this.tree.getAllSegments().reduce((acc, s) => acc + s.leafCount, 0);
    const lossRatio = totalLeavesBefore > 0 ? (totalLeavesBefore - totalLeavesAfter) / totalLeavesBefore : 0;

    const activatedBuds: Array<{ parentId: string; direction: Vector3D }> = [];

    // 若存在母干段，在母干处激活 1-2 个不定芽（Back-budding），方向朝向外围
    if (parentId && this.tree.getSegment(parentId)) {
      const parentSeg = this.tree.getSegment(parentId)!;
      const count = this.rng.range(1, 3) > 1.5 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const angle = this.rng.range(0, Math.PI * 2);
        const dir: Vector3D = [
          Math.cos(angle) * 0.7,
          this.rng.range(0.2, 0.8),
          Math.sin(angle) * 0.7,
        ];
        activatedBuds.push({ parentId: parentSeg.id, direction: dir });
      }
    }

    // 重新计算达芬奇管道粗度
    this.tree.computePipeModelRadii();

    return {
      removedCount: removedIds.length,
      biomassLossRatio: lossRatio,
      activatedBuds,
    };
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run tests/pruning-engine.test.ts`
Expected: PASS

- [ ] **Step 5: 提交代码**

```bash
git add src/core/simulation/pruning-engine.ts tests/pruning-engine.test.ts
git commit -m "feat: implement pruning operator and latent bud activation (clip & grow response)"
```

---

### Task 5: 确定性操作日志与状态重放机制

**Files:**
- Create: `src/core/replay/action-log.ts`
- Test: `tests/action-log.test.ts`

**Interfaces:**
- Produces: `ActionLogManager`，记录每个原子指令（`ADD_SEED`, `PRUNE`, `WIRE`, `ADVANCE_SEASON`），生成可分享的紧凑 JSON 串，并支持从空白状态无损还原。

- [ ] **Step 1: 编写测试用例 `tests/action-log.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { ActionLogManager, ActionCommand } from '../src/core/replay/action-log';

describe('ActionLogManager', () => {
  it('should serialize actions and replay to verify identical log reconstruction', () => {
    const manager = new ActionLogManager(9876);
    manager.record({ type: 'INIT_STOCK', timestamp: 100, payload: { style: 'moyogi' } });
    manager.record({ type: 'PRUNE_BRANCH', timestamp: 200, payload: { targetId: 'seg_2' } });

    const serialized = manager.exportToJson();
    expect(serialized).toContain('INIT_STOCK');

    const restored = ActionLogManager.importFromJson(serialized);
    expect(restored.getSeed()).toBe(9876);
    expect(restored.getActions().length).toBe(2);
    expect(restored.getActions()[1].type).toBe('PRUNE_BRANCH');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run tests/action-log.test.ts`
Expected: FAIL (Cannot find module '../src/core/replay/action-log')

- [ ] **Step 3: 编写实现 `src/core/replay/action-log.ts`**

```typescript
export interface ActionCommand {
  type: 'INIT_STOCK' | 'PRUNE_BRANCH' | 'APPLY_WIRE' | 'REMOVE_WIRE' | 'ADVANCE_SEASON';
  timestamp: number;
  payload: Record<string, unknown>;
}

export interface ReplayPayload {
  version: string;
  seed: number;
  actions: ActionCommand[];
}

export class ActionLogManager {
  private actions: ActionCommand[] = [];

  constructor(private seed: number) {}

  public record(action: ActionCommand): void {
    this.actions.push(action);
  }

  public getSeed(): number {
    return this.seed;
  }

  public getActions(): ActionCommand[] {
    return [...this.actions];
  }

  public exportToJson(): string {
    const payload: ReplayPayload = {
      version: '1.0.0',
      seed: this.seed,
      actions: this.actions,
    };
    return JSON.stringify(payload);
  }

  public static importFromJson(jsonStr: string): ActionLogManager {
    const data: ReplayPayload = JSON.parse(jsonStr);
    const manager = new ActionLogManager(data.seed);
    manager.actions = data.actions || [];
    return manager;
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run tests/action-log.test.ts`
Expected: PASS

- [ ] **Step 5: 提交代码**

```bash
git add src/core/replay/action-log.ts tests/action-log.test.ts
git commit -m "feat: implement deterministic action logging and replay serialization"
```

---

### Task 6: Three.js 动态管状网格与骨架透视渲染

**Files:**
- Create: `src/view/mesh-generator.ts`
- Create: `src/view/skeleton-view.ts`
- Create: `src/view/scene-setup.ts`

**Interfaces:**
- Consumes: `TreeGraph`, Three.js
- Produces: `TreeMeshGenerator` 将节间段转换为锥柱体几何体（Cylinder/Tube），挂载唯一 segmentId 用户数据以支持 Raycaster 命中；`SkeletonView` 控制一键透视色彩层级与叶簇半透明。

- [ ] **Step 1: 编写管状网格生成器 `src/view/mesh-generator.ts`**

```typescript
import * as THREE from 'three';
import { TreeGraph } from '../core/model/tree-graph';
import { InternodeSegment } from '../core/model/types';

export class TreeMeshGenerator {
  private barkMaterial: THREE.MeshStandardMaterial;
  private highlightMaterial: THREE.MeshStandardMaterial;

  constructor() {
    this.barkMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a4632,
      roughness: 0.85,
      metalness: 0.1,
    });
    this.highlightMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4444,
      emissive: 0x551111,
      roughness: 0.5,
    });
  }

  public buildTreeGroup(tree: TreeGraph): THREE.Group {
    const group = new THREE.Group();
    group.name = 'tree_root_group';

    const segments = tree.getAllSegments();
    for (const seg of segments) {
      const mesh = this.createSegmentMesh(seg);
      group.add(mesh);
    }
    return group;
  }

  private createSegmentMesh(seg: InternodeSegment): THREE.Mesh {
    const p1 = new THREE.Vector3(...seg.startPos);
    const p2 = new THREE.Vector3(...seg.endPos);
    const dist = p1.distanceTo(p2);

    const radiusTop = seg.radius * 0.85;
    const radiusBottom = seg.radius;
    const geom = new THREE.CylinderGeometry(radiusTop, radiusBottom, dist, 8);

    const mesh = new THREE.Mesh(geom, this.barkMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // 定位与朝向
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    mesh.position.copy(mid);

    const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
    mesh.quaternion.copy(quat);

    mesh.userData = { segmentId: seg.id, order: seg.order };
    return mesh;
  }
}
```

- [ ] **Step 2: 编写骨架透视控制器 `src/view/skeleton-view.ts`**

```typescript
import * as THREE from 'three';

export class SkeletonView {
  private isSkeletonMode = false;
  private readonly orderColors = [
    0xe06c75, // 0: 主干 (红)
    0x61afef, // 1: 一级主枝 (蓝)
    0x98c379, // 2: 二级次枝 (绿)
    0xd19a66, // 3+: 细分小枝 (橙)
  ];

  public toggle(treeGroup: THREE.Group): boolean {
    this.isSkeletonMode = !this.isSkeletonMode;
    this.apply(treeGroup);
    return this.isSkeletonMode;
  }

  public apply(treeGroup: THREE.Group): void {
    treeGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData?.order !== undefined) {
        if (this.isSkeletonMode) {
          const order = Math.min(child.userData.order, this.orderColors.length - 1);
          child.material = new THREE.MeshBasicMaterial({
            color: this.orderColors[order],
            wireframe: false,
          });
        } else {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x5a4632,
            roughness: 0.85,
          });
        }
      }
    });
  }
}
```

- [ ] **Step 3: 编写 3D 舞台环境 `src/view/scene-setup.ts`**

```typescript
import * as THREE from 'three';

export class SceneSetup {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x23272e);

    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 2.5, 4.5);
    this.camera.lookAt(0, 1.2, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.setupLighting();
    this.setupGround();
    this.setupResize(container);
  }

  private setupLighting(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.4);
    dirLight.position.set(5, 8, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);
  }

  private setupGround(): void {
    const potGeom = new THREE.CylinderGeometry(0.8, 0.6, 0.25, 32);
    const potMat = new THREE.MeshStandardMaterial({ color: 0x3b3a36, roughness: 0.9 });
    const pot = new THREE.Mesh(potGeom, potMat);
    pot.position.y = 0.125;
    pot.receiveShadow = true;
    this.scene.add(pot);
  }

  private setupResize(container: HTMLElement): void {
    window.addEventListener('resize', () => {
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    });
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
```

- [ ] **Step 4: 提交表现层代码**

```bash
git add src/view/mesh-generator.ts src/view/skeleton-view.ts src/view/scene-setup.ts
git commit -m "feat: implement procedural cylinder mesh generator and skeleton view"
```

---

### Task 7: 组装原型主入口与交互闭环 (点选剪枝、快进与撤销)

**Files:**
- Create: `src/main.ts`

**Interfaces:**
- Consumes: 所有前置模块 (`SceneSetup`, `TreeGraph`, `PruningEngine`, `TreeMeshGenerator`, `SkeletonView`, `ActionLogManager`)
- Produces: 启动完整的网页交互程序，支持鼠标/手指点击树枝实施截枝，实时重绘并触发切口萌发。

- [ ] **Step 1: 编写主入口 `src/main.ts`**

```typescript
import * as THREE from 'three';
import { SceneSetup } from './view/scene-setup';
import { TreeGraph } from './core/model/tree-graph';
import { DeterministicRng } from './core/math/rng';
import { PruningEngine } from './core/simulation/pruning-engine';
import { TreeMeshGenerator } from './view/mesh-generator';
import { SkeletonView } from './view/skeleton-view';
import { ActionLogManager } from './core/replay/action-log';

class BonsaiApp {
  private stage: SceneSetup;
  private rng: DeterministicRng;
  private tree: TreeGraph;
  private pruning: PruningEngine;
  private meshGen: TreeMeshGenerator;
  private skeleton: SkeletonView;
  private log: ActionLogManager;
  private treeGroup: THREE.Group | null = null;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  constructor() {
    const container = document.getElementById('canvas-container')!;
    this.stage = new SceneSetup(container);
    this.rng = new DeterministicRng(2026);
    this.log = new ActionLogManager(2026);
    this.tree = new TreeGraph();
    this.pruning = new PruningEngine(this.tree, this.rng);
    this.meshGen = new TreeMeshGenerator();
    this.skeleton = new SkeletonView();

    this.initDefaultStock();
    this.rebuildMesh();
    this.setupEvents();
    this.animate();
  }

  private initDefaultStock(): void {
    const base = this.tree.createBaseInternode([0, 0.25, 0], [0, 0.8, 0]);
    const b1 = this.tree.attachInternode(base, [0.3, 1.3, 0.1], 1, 15);
    const b2 = this.tree.attachInternode(base, [-0.25, 1.4, -0.2], 1, 12);
    this.tree.attachInternode(b1, [0.5, 1.8, 0.2], 2, 20);
    this.tree.attachInternode(b2, [-0.4, 1.9, -0.3], 2, 18);
    this.tree.computePipeModelRadii();
  }

  private rebuildMesh(): void {
    if (this.treeGroup) {
      this.stage.scene.remove(this.treeGroup);
    }
    this.treeGroup = this.meshGen.buildTreeGroup(this.tree);
    this.stage.scene.add(this.treeGroup);
    this.updateStats();
  }

  private updateStats(): void {
    const stats = document.getElementById('stats')!;
    const segs = this.tree.getAllSegments();
    stats.innerText = `枝段数: ${segs.length} | 根盘粗度: ${(segs[0]?.radius * 100).toFixed(1)}cm`;
  }

  private setupEvents(): void {
    window.addEventListener('click', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.stage.camera);
      if (!this.treeGroup) return;

      const intersects = this.raycaster.intersectObjects(this.treeGroup.children);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const segmentId = hit.userData?.segmentId;
        if (segmentId && hit.userData.order > 0) {
          // 修剪被点中的侧枝
          const res = this.pruning.pruneBranch(segmentId);
          this.log.record({
            type: 'PRUNE_BRANCH',
            timestamp: Date.now(),
            payload: { targetId: segmentId, loss: res.biomassLossRatio },
          });

          // 模拟潜伏芽萌发伸展为细幼枝
          for (const bud of res.activatedBuds) {
            const parent = this.tree.getSegment(bud.parentId)!;
            const newEnd: [number, number, number] = [
              parent.endPos[0] + bud.direction[0] * 0.3,
              parent.endPos[1] + bud.direction[1] * 0.3,
              parent.endPos[2] + bud.direction[2] * 0.3,
            ];
            this.tree.attachInternode(parent.id, newEnd, parent.order + 1, 5);
          }
          this.tree.computePipeModelRadii();
          this.rebuildMesh();
        }
      }
    });

    document.getElementById('btn-toggle-skeleton')?.addEventListener('click', () => {
      if (this.treeGroup) {
        this.skeleton.toggle(this.treeGroup);
      }
    });
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    if (this.treeGroup) {
      this.treeGroup.rotation.y += 0.002; // 微弱自转展示立体结构
    }
    this.stage.render();
  };
}

new BonsaiApp();
```

- [ ] **Step 2: 编译与本地构建校验**

Run: `npm run build`
Expected: PASS (TypeScript 检查与 Vite 打包成功)

- [ ] **Step 3: 运行全套单元测试**

Run: `npm run test`
Expected: PASS (所有单元测试全部通过)

- [ ] **Step 4: 提交主应用代码**

```bash
git add src/main.ts
git commit -m "feat: assemble M0 interactive prototype with raycast pruning and auto-budding"
```

---

### Task 8: GitHub 远程代码库同步与发布检查

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: 完善 .gitignore 避免无关文件污染**

```gitignore
node_modules/
dist/
.DS_Store
*.log
```

- [ ] **Step 2: 提交并推送到 GitHub 远程仓库**

```bash
git add .gitignore docs/superpowers/plans/2026-11-02-m0-prototype-implementation.md
git commit -m "docs: complete M0 implementation plan with comprehensive TDD tasks"
git push origin master
```
