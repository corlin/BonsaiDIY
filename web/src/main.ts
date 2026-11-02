import * as THREE from 'three';
import initWasm, { BonsaiWasmEngine } from '../pkg/bonsai_core.js';
import { createScene } from './view/scene-setup.js';
import { TreeRenderer } from './view/skeleton-view.js';

let engine: BonsaiWasmEngine | null = null;
let treeRenderer: TreeRenderer | null = null;
let prunedCount = 0;

async function bootstrap() {
  const container = document.getElementById('canvas-container');
  if (!container) {
    throw new Error('Canvas container not found');
  }

  // 1. Initialize WASM module
  await initWasm();
  engine = new BonsaiWasmEngine(2026);

  // 2. Setup Three.js scene and controls
  const { scene, camera, renderer } = createScene(container);
  treeRenderer = new TreeRenderer(scene);

  // 3. Populate HUD elements
  const btnToggleSkeleton = document.getElementById('btn-toggle-skeleton') as HTMLButtonElement | null;
  const btnReset = document.getElementById('btn-reset') as HTMLButtonElement | null;
  const statSegments = document.getElementById('stat-segments');
  const statPruned = document.getElementById('stat-pruned');
  const statMode = document.getElementById('stat-mode');

  function updateHUD() {
    if (!treeRenderer) return;
    const count = treeRenderer.getSegmentCount();
    if (statSegments) statSegments.textContent = count.toString();
    if (statPruned) statPruned.textContent = prunedCount.toString();
    if (statMode) {
      statMode.textContent = treeRenderer.getSkeletonMode() ? 'Hierarchy Skeleton' : 'Organic Trunk';
    }
  }

  function renderCurrentTree() {
    if (!engine || !treeRenderer) return;
    const buffer = engine.get_segments_buffer();
    treeRenderer.updateTree(buffer);
    updateHUD();
  }

  renderCurrentTree();

  // 4. UI Actions
  if (btnToggleSkeleton) {
    btnToggleSkeleton.addEventListener('click', () => {
      if (!treeRenderer) return;
      const nextMode = !treeRenderer.getSkeletonMode();
      treeRenderer.setSkeletonMode(nextMode);
      btnToggleSkeleton.classList.toggle('active', nextMode);
      updateHUD();
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (engine) {
        engine.free();
      }
      const newSeed = Math.floor(Math.random() * 100000) + 1;
      engine = new BonsaiWasmEngine(newSeed);
      prunedCount = 0;
      renderCurrentTree();
    });
  }

  // 5. Raycasting for branch hover and pruning
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let pointerDownPos = { x: 0, y: 0 };

  function updateMouseCoord(event: MouseEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  window.addEventListener('pointermove', (event) => {
    if (!treeRenderer) return;
    updateMouseCoord(event);
    raycaster.setFromCamera(mouse, camera);

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
    if (!engine || !treeRenderer) return;

    // Distinguish click from camera orbit drag
    const dist = Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y);
    if (dist > 5) return;

    updateMouseCoord(event);
    raycaster.setFromCamera(mouse, camera);

    const hits = raycaster.intersectObjects(treeRenderer.getInteractiveMeshes(), false);
    if (hits.length > 0) {
      const segId = hits[0].object.userData.segmentId;
      if (typeof segId === 'number') {
        const success = engine.prune_branch(segId);
        if (success) {
          prunedCount++;
          renderCurrentTree();
        }
      }
    }
  });
}

bootstrap().catch((err) => {
  console.error('Failed to initialize Bonsai Dojo Web Application:', err);
});
