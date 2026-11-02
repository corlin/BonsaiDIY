# 《树境·盆景道》M1 阶段：生长物理闭环与规则诊断引擎实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在当前 M0 原型基础上，完整落地 M1 阶段三大核心子系统：
1. **L1 生理物理生长步进与能量池循环**：实现季度时间推进（`advance_season`），根据光通量遮阴计算芽命运（生长伸长、休眠或枯退），依据碳储备池（NSC）与顶端优势调节全树增粗与抽条；
2. **L2 铝丝蟠扎力学与形变定型算子**：实现给指定节间缠绕金属丝（1.0~4.0mm）、弯曲方向与曲率调整，随生长季节完成塑性定型或产生嵌线伤痕（Wire Bite）；
3. **L3 Wiki 规则诊断引擎 (Rule Diagnostic Engine)**：针对树木当前几何与生理状态，自动执行 R-PROP-01（6:1高径比）、R-PROP-02（第一主枝出枝点 ≤ 1/3）、R-PRUNE-05（20%生物质过剪预警）与 R-PRUNE-01（由外向内回缩优先）评估，并输出纯结构化 JSON 诊断条目供前端 3D 视口高亮。

**Architecture:**
- 全部生理推演算法与规则判定均严格位于 Rust 内核 (`crates/bonsai-core`) 中，保持 100% 确定性。
- 通过 `BonsaiWasmEngine` 导出 `advance_season()`, `apply_wire()`, `evaluate_rules() -> String (JSON)`。
- Web 表现层 (`web/`) 增强 HUD 面板，展示当前季节（春/夏/秋/冬）、全树碳水化合物能量指数，并在触发规则报警时实时在 3D 空间高亮违规枝条。

---

## 模块与文件拆解

```
crates/bonsai-core/
├── src/
│   ├── model.rs                 # 增加：EnergyPool, WireState, 节间形变曲率
│   ├── growth.rs                # 新增：光通量阴影衰减、芽伸长与年度季节生理状态机
│   ├── wire.rs                  # 新增：蟠扎弯曲与木质化定型/嵌线计算
│   ├── rules/                   # 新增：Wiki 规则诊断引擎模块
│   │   ├── mod.rs               # 规则引擎调度入口
│   │   ├── proportions.rs       # R-PROP-01 (6:1比), R-PROP-02 (最低枝高度)
│   │   └── pruning_rules.rs     # R-PRUNE-01 (回缩优先), R-PRUNE-05 (20%生物质超限)
│   ├── wasm.rs                  # 扩充导出：季节步进、蟠扎指令、规则诊断结果导出
│   └── lib.rs                   # 注册 growth, wire, rules 模块
└── tests/
    ├── growth_tests.rs          # 季节生长与碳能量变化测试
    ├── wire_tests.rs            # 蟠扎形变与定型测试
    └── rule_tests.rs            # 4条核心规则违规触发测试
web/
├── src/
│   ├── main.ts                  # 绑定「前进一个生长季」与「规则诊断」HUD 面板
│   └── view/
│       ├── skeleton-view.ts     # 规则违规枝条红色脉冲报警高亮
│       └── scene-setup.ts       # 四季环境光影动态渐变 (春嫩绿、夏浓郁、秋金黄、冬清冷)
```

---

### Task 1: 树木能量平衡池 (EnergyPool) 与季节生理状态机 (Growth Engine)

**Files:**
- Modify: `crates/bonsai-core/src/model.rs`
- Create: `crates/bonsai-core/src/growth.rs`
- Modify: `crates/bonsai-core/src/lib.rs`
- Create: `crates/bonsai-core/tests/growth_tests.rs`

**Interfaces:**
- Produces: `Season` 枚举 (`Spring`, `Summer`, `Autumn`, `Winter`)，`GrowthEngine` 提供 `advance_season(&mut self, tree: &mut TreeGraph, rng: &mut DeterministicRng) -> SeasonReport`。

- [ ] **Step 1: 编写测试 `crates/bonsai-core/tests/growth_tests.rs`**
```rust
use bonsai_core::model::{TreeGraph, Season};
use bonsai_core::rng::DeterministicRng;
use bonsai_core::growth::GrowthEngine;

#[test]
fn test_seasonal_cycle_and_spring_flush() {
    let mut rng = DeterministicRng::new(42);
    let mut tree = TreeGraph::new();
    let trunk = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
    let branch = tree.attach_internode(trunk, [0.3, 1.5, 0.0], 1, 5);

    let mut growth = GrowthEngine::new();
    assert_eq!(tree.season, Season::Spring);

    // 春季生长：抽生新芽
    let report_spring = growth.advance_season(&mut tree, &mut rng);
    assert_eq!(tree.season, Season::Summer);
    assert!(report_spring.new_internodes_count > 0);

    // 夏季：光合作用积累，能量增加，叶片硬化
    let energy_before_summer = tree.energy_pool;
    growth.advance_season(&mut tree, &mut rng);
    assert_eq!(tree.season, Season::Autumn);
    assert!(tree.energy_pool > energy_before_summer);
}
```

- [ ] **Step 2: 运行测试确保失败 (TDD)**
- [ ] **Step 3: 扩展 `model.rs` 并在 `growth.rs` 中实现季节循环与顶端优势伸长**
- [ ] **Step 4: 运行 `cargo test --test growth_tests` 验证通过**
- [ ] **Step 5: 提交 commit**
```bash
git add crates/bonsai-core/src/model.rs crates/bonsai-core/src/growth.rs crates/bonsai-core/src/lib.rs crates/bonsai-core/tests/growth_tests.rs
git commit -m "feat: implement annual seasonal growth cycle and energy pool simulation"
```

---

### Task 2: 铝丝蟠扎力学模型与塑性定型/嵌线计算 (Wiring Engine)

**Files:**
- Create: `crates/bonsai-core/src/wire.rs`
- Modify: `crates/bonsai-core/src/model.rs`
- Modify: `crates/bonsai-core/src/lib.rs`
- Create: `crates/bonsai-core/tests/wire_tests.rs`

**Interfaces:**
- Produces: `WireEngine`，提供 `apply_wire(tree, segment_id, wire_gauge_mm, target_direction)`，并在每次生长季更新中累积木质化定型进度。当经过 2 个生长季后定型；若超过 4 个生长季未拆线，触发 `has_wire_bite = true` 并降低树势。

- [ ] **Step 1: 编写测试 `crates/bonsai-core/tests/wire_tests.rs`**
- [ ] **Step 2: 运行测试确保失败 (TDD)**
- [ ] **Step 3: 实现 `crates/bonsai-core/src/wire.rs`**
- [ ] **Step 4: 运行 `cargo test --test wire_tests` 验证通过**
- [ ] **Step 5: 提交 commit**
```bash
git add crates/bonsai-core/src/wire.rs crates/bonsai-core/src/model.rs crates/bonsai-core/src/lib.rs crates/bonsai-core/tests/wire_tests.rs
git commit -m "feat: implement branch wiring mechanics with setting and wire-bite hazards"
```

---

### Task 3: Wiki 规则诊断引擎 (R-PROP-01, R-PROP-02, R-PRUNE-05, R-PRUNE-01)

**Files:**
- Create: `crates/bonsai-core/src/rules/mod.rs`
- Create: `crates/bonsai-core/src/rules/proportions.rs`
- Create: `crates/bonsai-core/src/rules/pruning_rules.rs`
- Modify: `crates/bonsai-core/src/lib.rs`
- Create: `crates/bonsai-core/tests/rule_tests.rs`

**Interfaces:**
- Produces: `RuleEngine`，提供 `evaluate_all(&self, tree: &TreeGraph, recent_loss_ratio: f32) -> Vec<DiagnosticIssue>`。
- `DiagnosticIssue` 包含 `rule_id: String`, `severity: Severity (Warning/Danger/Info)`, `message_key: String`, `evidence_segment_id: Option<u32>`。

- [ ] **Step 1: 编写测试 `crates/bonsai-core/tests/rule_tests.rs`**
```rust
use bonsai_core::model::TreeGraph;
use bonsai_core::rules::{RuleEngine, Severity};

#[test]
fn test_rule_r_prop_01_height_to_caliper_ratio() {
    let mut tree = TreeGraph::new();
    // 制造一棵细长如筷子的树 (高 2.5m, 直径仅 0.05m, 比例 50:1 严重违反 6:1)
    let trunk0 = tree.create_base_internode([0.0, 0.0, 0.0], [0.0, 1.25, 0.0]);
    let trunk1 = tree.attach_internode(trunk0, [0.0, 2.5, 0.0], 0, 2);
    tree.compute_pipe_model(2.0, 0.02);

    let engine = RuleEngine::new();
    let issues = engine.evaluate_all(&tree, 0.0);

    let prop_issue = issues.iter().find(|i| i.rule_id == "R-PROP-01");
    assert!(prop_issue.is_some());
    assert_eq!(prop_issue.unwrap().severity, Severity::Warning);
}

#[test]
fn test_rule_r_prune_05_excessive_biomass_loss() {
    let tree = TreeGraph::new();
    let engine = RuleEngine::new();
    // 单次剪除超过 20%
    let issues = engine.evaluate_all(&tree, 0.35);

    let prune_issue = issues.iter().find(|i| i.rule_id == "R-PRUNE-05");
    assert!(prune_issue.is_some());
    assert_eq!(prune_issue.unwrap().severity, Severity::Danger);
}
```

- [ ] **Step 2: 运行测试确保失败 (TDD)**
- [ ] **Step 3: 实现 `rules/` 模块与计算逻辑**
- [ ] **Step 4: 运行 `cargo test --test rule_tests` 验证通过**
- [ ] **Step 5: 提交 commit**
```bash
git add crates/bonsai-core/src/rules/ crates/bonsai-core/tests/rule_tests.rs
git commit -m "feat: implement wiki-based diagnostic rules engine for bonsai aesthetics and health"
```

---

### Task 4: WASM 导出扩充与 Web 端四季更迭/规则告警全链路集成

**Files:**
- Modify: `crates/bonsai-core/src/wasm.rs`
- Modify: `web/src/main.ts`
- Modify: `web/src/view/scene-setup.ts`
- Modify: `web/index.html`

**Interfaces:**
- Produces: 
  - WASM API 新增：`advance_season() -> String (JSON)`, `evaluate_rules(last_loss) -> String (JSON)`。
  - 前端点击「前进 1 个生长季 (+1 Season)」可推进春夏秋冬，树木随之抽条萌发，右上角 HUD 实时输出 Wiki 教练诊断，违规枝条在 3D 中闪烁红光警示。

- [ ] **Step 1: 扩充 `wasm.rs` 暴露 `advance_season` 与 `evaluate_rules`**
- [ ] **Step 2: 重新执行 `wasm-pack build crates/bonsai-core --target web --out-dir ../../web/pkg`**
- [ ] **Step 3: 升级 `web/index.html` 与 `web/src/main.ts` 支持四季推进与诊断徽标**
- [ ] **Step 4: 运行 `cd web && npm run build` 确保零错误打包**
- [ ] **Step 5: 运行 `cargo test` 确保 100% 测试通过**
- [ ] **Step 6: 提交 commit 并推送到 GitHub origin/master**
```bash
git add .
git commit -m "feat: integrate seasonal growth simulation and real-time rule coach diagnostics into web UI"
git push origin master
```
