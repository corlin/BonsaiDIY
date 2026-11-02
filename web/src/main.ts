import * as THREE from 'three';
import initWasm, { BonsaiWasmEngine } from '../pkg/bonsai_core.js';
import { createScene, SceneContext } from './view/scene-setup.js';
import { TreeRenderer } from './view/skeleton-view.js';

interface DiagnosticIssue {
  rule_id: string;
  severity: 'Info' | 'Warning' | 'Danger';
  message_key: string;
  evidence_segment_id: number | null;
  detail: string;
}

interface TreeInfo {
  season: string;
  year: number;
  energy_pool: number;
  segment_count: number;
}

interface SeasonAdvanceResult {
  new_internodes_count: number;
  energy_delta: number;
  season: string;
  completed_season?: string;
  year: number;
  energy_pool: number;
}

const SEASON_NAMES_ZH: Record<string, string> = {
  Spring: '春',
  Summer: '夏',
  Autumn: '秋',
  Winter: '冬',
};

const SEVERITY_NAMES_ZH: Record<string, string> = {
  Danger: '严重违规',
  Warning: '美学警示',
  Info: '黄金区间',
};

let engine: BonsaiWasmEngine | null = null;
let treeRenderer: TreeRenderer | null = null;
let sceneContext: SceneContext | null = null;
let prunedCount = 0;

async function bootstrap() {
  const container = document.getElementById('canvas-container');
  if (!container) {
    throw new Error('Canvas container not found');
  }

  // 1. Initialize WASM module
  await initWasm();
  engine = new BonsaiWasmEngine(2026);

  // 2. Setup Three.js scene, camera, lighting, and pulse loop
  sceneContext = createScene(container, (elapsedSeconds) => {
    if (treeRenderer) {
      treeRenderer.updatePulse(elapsedSeconds);
    }
  });
  treeRenderer = new TreeRenderer(sceneContext.scene);

  // 3. Bind UI DOM Elements
  const seasonBadge = document.getElementById('season-badge');
  const energyBar = document.getElementById('energy-bar');
  const statEnergy = document.getElementById('stat-energy');
  const btnGrowSeason = document.getElementById('btn-grow-season') as HTMLButtonElement | null;
  const btnToggleSkeleton = document.getElementById('btn-toggle-skeleton') as HTMLButtonElement | null;
  const btnReset = document.getElementById('btn-reset') as HTMLButtonElement | null;
  const statSegments = document.getElementById('stat-segments');
  const statPruned = document.getElementById('stat-pruned');
  const statAge = document.getElementById('stat-age');
  const statMode = document.getElementById('stat-mode');
  const coachIssuesList = document.getElementById('coach-issues-list');
  const coachStatusPill = document.getElementById('coach-status-pill');
  const hudPanel = document.getElementById('hud-panel');
  const coachPanel = document.getElementById('coach-panel');
  const btnToggleHud = document.getElementById('btn-toggle-hud');
  const btnToggleCoach = document.getElementById('btn-toggle-coach');

  if (btnToggleHud && hudPanel) {
    btnToggleHud.addEventListener('click', () => {
      hudPanel.classList.toggle('collapsed');
    });
  }
  if (btnToggleCoach && coachPanel) {
    btnToggleCoach.addEventListener('click', () => {
      coachPanel.classList.toggle('collapsed');
    });
  }

  /**
   * Updates Coach Diagnostics Panel with real-time rule audit issues
   */
  function updateCoachPanel(lossRatio: number) {
    if (!engine || !coachIssuesList || !coachStatusPill) return;

    const issuesJson = engine.evaluate_rules(lossRatio);
    let issues: DiagnosticIssue[] = [];
    try {
      issues = JSON.parse(issuesJson);
    } catch (e) {
      console.error('Failed to parse diagnostic issues:', e);
      issues = [];
    }

    const hasDanger = issues.some((i) => i.severity === 'Danger');
    const hasWarning = issues.some((i) => i.severity === 'Warning');

    if (hasDanger) {
      coachStatusPill.className = 'coach-pill pill-danger';
      coachStatusPill.textContent = '严重告警';
    } else if (hasWarning) {
      coachStatusPill.className = 'coach-pill pill-warning';
      coachStatusPill.textContent = '建议优化';
    } else {
      coachStatusPill.className = 'coach-pill pill-ok';
      coachStatusPill.textContent = '平衡良好';
    }

    // Render issue cards
    coachIssuesList.innerHTML = '';
    if (issues.length === 0) {
      const emptyCard = document.createElement('div');
      emptyCard.className = 'coach-empty';
      emptyCard.innerHTML = `
        <div class="coach-empty-icon">🍃</div>
        <div>当前树木姿态健康平衡</div>
        <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">未检测到高径比超标或过量修剪违规</div>
      `;
      coachIssuesList.appendChild(emptyCard);
      return;
    }

    for (const issue of issues) {
      const card = document.createElement('div');
      card.className = `coach-card severity-${issue.severity}`;

      const severityZh = SEVERITY_NAMES_ZH[issue.severity] || issue.severity;
      let evidenceButtonHtml = '';
      if (issue.evidence_segment_id !== null && issue.evidence_segment_id !== undefined) {
        evidenceButtonHtml = `
          <button class="card-evidence-btn" data-seg-id="${issue.evidence_segment_id}">
            🔍 定位违规枝条 #${issue.evidence_segment_id}
          </button>
        `;
      }

      card.innerHTML = `
        <div class="card-top">
          <span class="rule-tag">[${issue.rule_id}]</span>
          <span class="severity-badge ${issue.severity}">${severityZh}</span>
        </div>
        <div class="card-detail">${issue.detail}</div>
        ${evidenceButtonHtml}
      `;

      if (issue.evidence_segment_id !== null && issue.evidence_segment_id !== undefined) {
        const segId = issue.evidence_segment_id;
        const btnLocate = card.querySelector('.card-evidence-btn') as HTMLButtonElement | null;
        if (btnLocate) {
          btnLocate.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!treeRenderer) return;
            const currentHighlight = treeRenderer.getEvidenceHighlight();
            if (currentHighlight === segId) {
              treeRenderer.setEvidenceHighlight(null);
            } else {
              treeRenderer.setEvidenceHighlight(segId);
            }
          });
        }

        card.addEventListener('mouseenter', () => {
          if (treeRenderer) {
            treeRenderer.setEvidenceHighlight(segId);
          }
        });
        card.addEventListener('mouseleave', () => {
          if (treeRenderer) {
            treeRenderer.setEvidenceHighlight(null);
          }
        });
      }

      coachIssuesList.appendChild(card);
    }
  }

  /**
   * Refreshes the tree geometry and updates HUD stats, energy, season lighting, and coach panel
   */
  function renderCurrentTree(lossRatio: number = 0.0) {
    if (!engine || !treeRenderer || !sceneContext) return;

    const buffer = engine.get_segments_buffer();
    treeRenderer.updateTree(buffer);

    const infoJson = engine.get_tree_info();
    let info: TreeInfo;
    try {
      info = JSON.parse(infoJson);
    } catch {
      info = { season: 'Spring', year: 1, energy_pool: 100, segment_count: 5 };
    }

    // 1. Update Season Badge & Seasonal Lighting
    const seasonZh = SEASON_NAMES_ZH[info.season] || info.season;
    if (seasonBadge) {
      seasonBadge.textContent = `${seasonZh} · 第 ${info.year} 年`;
      seasonBadge.className = `badge season-${info.season.toLowerCase()}`;
    }
    sceneContext.setSeasonLighting(info.season);
    treeRenderer.setSeason(info.season);

    // 2. Update Energy Pool Progress Bar
    const energyClamped = Math.max(0, Math.min(100, info.energy_pool));
    if (energyBar) {
      energyBar.style.width = `${energyClamped}%`;
      if (energyClamped < 25) {
        energyBar.classList.add('low');
      } else {
        energyBar.classList.remove('low');
      }
    }
    if (statEnergy) {
      statEnergy.textContent = info.energy_pool.toFixed(1);
    }

    // 3. Update HUD counts
    if (statSegments) {
      statSegments.textContent = info.segment_count.toString();
    }
    if (statPruned) {
      statPruned.textContent = prunedCount.toString();
    }
    if (statAge) {
      statAge.textContent = `第 ${info.year} 年`;
    }
    if (statMode) {
      statMode.textContent = treeRenderer.getSkeletonMode() ? 'Hierarchy Skeleton' : 'Organic Trunk';
    }

    // 4. Update Rule Coach Panel
    updateCoachPanel(lossRatio);
  }

  // Initial tree render
  renderCurrentTree(0.0);

  // 4. Advance Season Button
  if (btnGrowSeason) {
    btnGrowSeason.addEventListener('click', () => {
      if (!engine) return;
      try {
        const reportJson = engine.advance_season();
        const report = JSON.parse(reportJson) as SeasonAdvanceResult;
        console.log(`[Bonsai Dojo] Advanced season to ${report.season}, new internodes: ${report.new_internodes_count}, energy delta: ${report.energy_delta}`);
      } catch (err) {
        console.error('Failed to parse advance season report:', err);
      }

      renderCurrentTree(0.0);

      // Brief button click feedback
      btnGrowSeason.style.transform = 'scale(0.96)';
      setTimeout(() => {
        btnGrowSeason.style.transform = '';
      }, 150);
    });
  }

  // 5. Toggle Skeleton Mode
  if (btnToggleSkeleton) {
    btnToggleSkeleton.addEventListener('click', () => {
      if (!treeRenderer) return;
      const nextMode = !treeRenderer.getSkeletonMode();
      treeRenderer.setSkeletonMode(nextMode);
      btnToggleSkeleton.classList.toggle('active', nextMode);
      if (statMode) {
        statMode.textContent = nextMode ? 'Hierarchy Skeleton' : 'Organic Trunk';
      }
    });
  }

  // 6. Reset Bonsai
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (engine) {
        engine.free();
      }
      const newSeed = Math.floor(Math.random() * 100000) + 1;
      engine = new BonsaiWasmEngine(newSeed);
      prunedCount = 0;
      if (treeRenderer) {
        treeRenderer.setEvidenceHighlight(null);
      }
      renderCurrentTree(0.0);
    });
  }

  // 7. Raycasting for Branch Hover and Pruning
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let pointerDownPos = { x: 0, y: 0 };

  function updateMouseCoord(event: MouseEvent) {
    if (!sceneContext) return;
    const rect = sceneContext.renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  window.addEventListener('pointermove', (event) => {
    if (!treeRenderer || !sceneContext) return;
    updateMouseCoord(event);
    raycaster.setFromCamera(mouse, sceneContext.camera);

    const hits = raycaster.intersectObjects(treeRenderer.getInteractiveMeshes(), false);
    if (hits.length > 0) {
      const segId = hits[0].object.userData.segmentId;
      treeRenderer.highlightSegment(segId);
      container.style.cursor = 'pointer';
    } else {
      treeRenderer.highlightSegment(null);
      container.style.cursor = 'default';
    }
  });

  window.addEventListener('pointerdown', (event) => {
    pointerDownPos = { x: event.clientX, y: event.clientY };
  });

  window.addEventListener('pointerup', (event) => {
    if (!engine || !treeRenderer || !sceneContext) return;

    // Distinguish clean click from camera orbit drag
    const dist = Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y);
    if (dist > 5) return;

    updateMouseCoord(event);
    raycaster.setFromCamera(mouse, sceneContext.camera);

    const hits = raycaster.intersectObjects(treeRenderer.getInteractiveMeshes(), false);
    if (hits.length > 0) {
      const segId = hits[0].object.userData.segmentId;
      if (typeof segId === 'number') {
        const success = engine.prune_branch(segId);
        if (success) {
          prunedCount++;
          const lossRatio = engine.get_last_loss_ratio();
          renderCurrentTree(lossRatio);
        }
      }
    }
  });
}

bootstrap().catch((err) => {
  console.error('Failed to initialize Bonsai Dojo Web Application:', err);
});
