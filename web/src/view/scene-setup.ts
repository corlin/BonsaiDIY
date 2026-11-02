import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  dirLight: THREE.DirectionalLight;
  ambientLight: THREE.AmbientLight;
  rimLight: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
  updateSeasonLighting: (season: string) => void;
  setSeasonLighting: (season: string) => void;
}

export function createScene(
  container: HTMLElement,
  onAnimate?: (elapsedSeconds: number) => void
): SceneContext {
  const scene = new THREE.Scene();
  // 东方茶室雅致柔和的冷杉水墨渐变背景
  scene.background = new THREE.Color(0x1a1d24);
  scene.fog = new THREE.FogExp2(0x1a1d24, 0.08);

  const camera = new THREE.PerspectiveCamera(
    38,
    container.clientWidth / container.clientHeight,
    0.1,
    50
  );
  camera.position.set(0, 1.8, 3.8);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0.85, 0);
  controls.maxPolarAngle = Math.PI / 2 - 0.02; // 禁止镜头穿透桌面
  controls.minDistance = 1.2;
  controls.maxDistance = 8.0;

  // ===== 专业三点艺术照明系统 =====
  const ambientLight = new THREE.AmbientLight(0xdde5ee, 0.65);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xfffaec, 1.6);
  dirLight.position.set(3.5, 6.0, 3.0);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 15;
  dirLight.shadow.camera.left = -2;
  dirLight.shadow.camera.right = 2;
  dirLight.shadow.camera.top = 2.5;
  dirLight.shadow.camera.bottom = -1.0;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);

  const rimLight = new THREE.DirectionalLight(0xcce2ff, 0.85);
  rimLight.position.set(-4.0, 4.0, -3.5);
  scene.add(rimLight);

  const fillLight = new THREE.DirectionalLight(0xa59c8d, 0.35);
  fillLight.position.set(0, -3, 2);
  scene.add(fillLight);

  // ===== 雅致东方茶席与紫砂名盆 =====
  setupTeaTableAndPot(scene);

  const setSeasonLighting = (season: string) => {
    switch (season) {
      case 'Spring':
        dirLight.color.setHex(0xfff6e5);
        ambientLight.color.setHex(0xe0f2e9);
        renderer.toneMappingExposure = 1.15;
        break;
      case 'Summer':
        dirLight.color.setHex(0xffeed0);
        ambientLight.color.setHex(0xd0e8ff);
        renderer.toneMappingExposure = 1.25;
        break;
      case 'Autumn':
        dirLight.color.setHex(0xffdfba);
        ambientLight.color.setHex(0xe8d0b5);
        renderer.toneMappingExposure = 1.08;
        break;
      case 'Winter':
        dirLight.color.setHex(0xddeeff);
        ambientLight.color.setHex(0xcfd8dc);
        renderer.toneMappingExposure = 0.95;
        break;
    }
  };

  const onResize = () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  window.addEventListener('resize', onResize);

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    controls.update();
    if (onAnimate) {
      onAnimate(elapsed);
    }
    renderer.render(scene, camera);
  }
  animate();

  return {
    scene,
    camera,
    renderer,
    controls,
    dirLight,
    ambientLight,
    rimLight,
    fillLight,
    updateSeasonLighting: setSeasonLighting,
    setSeasonLighting,
  };
}

function setupTeaTableAndPot(scene: THREE.Scene): void {
  // 1. 实木茶几桌面 (沉香木质感)
  const tableGeom = new THREE.CylinderGeometry(1.6, 1.7, 0.1, 48);
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x1f1b18,
    roughness: 0.55,
    metalness: 0.15,
  });
  const table = new THREE.Mesh(tableGeom, tableMat);
  table.position.y = -0.05;
  table.receiveShadow = true;
  scene.add(table);

  // 2. 宜兴紫砂名盆 (深红紫泥，八角带足)
  const potOuterGeom = new THREE.CylinderGeometry(0.72, 0.58, 0.28, 8);
  const potMat = new THREE.MeshStandardMaterial({
    color: 0x4a2e2b,
    roughness: 0.78,
    metalness: 0.08,
  });
  const pot = new THREE.Mesh(potOuterGeom, potMat);
  pot.position.y = 0.14;
  pot.castShadow = true;
  pot.receiveShadow = true;
  scene.add(pot);

  const rimGeom = new THREE.TorusGeometry(0.73, 0.025, 8, 8);
  rimGeom.rotateX(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeom, potMat);
  rim.position.y = 0.28;
  scene.add(rim);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const footGeom = new THREE.BoxGeometry(0.1, 0.08, 0.1);
    const foot = new THREE.Mesh(footGeom, potMat);
    foot.position.set(Math.cos(angle) * 0.52, 0.04, Math.sin(angle) * 0.52);
    foot.castShadow = true;
    scene.add(foot);
  }

  // 3. 湿润赤玉土与青苔
  const soilGeom = new THREE.CylinderGeometry(0.68, 0.68, 0.02, 32);
  const soilMat = new THREE.MeshStandardMaterial({
    color: 0x3d2817,
    roughness: 0.95,
  });
  const soil = new THREE.Mesh(soilGeom, soilMat);
  soil.position.y = 0.25;
  soil.receiveShadow = true;
  scene.add(soil);

  const mossMat = new THREE.MeshStandardMaterial({
    color: 0x3c5c24,
    roughness: 0.9,
    flatShading: true,
  });
  for (let i = 0; i < 7; i++) {
    const angle = (i * Math.PI * 2) / 7 + Math.random() * 0.3;
    const dist = 0.18 + Math.random() * 0.32;
    const mossGeom = new THREE.SphereGeometry(0.08 + Math.random() * 0.06, 8, 6);
    mossGeom.scale(1.4, 0.35, 1.2);
    const moss = new THREE.Mesh(mossGeom, mossMat);
    moss.position.set(Math.cos(angle) * dist, 0.26, Math.sin(angle) * dist);
    moss.receiveShadow = true;
    scene.add(moss);
  }

  // 4. 八方根盘 (Nebari) 抓地气根
  const rootMat = new THREE.MeshStandardMaterial({
    color: 0x3d2e24,
    roughness: 0.88,
  });
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6 + (Math.random() - 0.5) * 0.3;
    const rootLen = 0.25 + Math.random() * 0.1;
    const rootGeom = new THREE.CylinderGeometry(0.02, 0.05, rootLen, 6);
    const root = new THREE.Mesh(rootGeom, rootMat);
    root.position.set(
      Math.cos(angle) * (rootLen * 0.45),
      0.26,
      Math.sin(angle) * (rootLen * 0.45)
    );
    root.rotation.z = Math.cos(angle) * 0.65;
    root.rotation.x = -Math.sin(angle) * 0.65;
    root.castShadow = true;
    root.receiveShadow = true;
    scene.add(root);
  }
}
