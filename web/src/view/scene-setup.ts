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
  // 东方茶室远山水墨渐变背景
  scene.background = new THREE.Color(0x15181d);
  scene.fog = new THREE.FogExp2(0x15181d, 0.09);

  const camera = new THREE.PerspectiveCamera(
    36,
    container.clientWidth / container.clientHeight,
    0.1,
    50
  );
  // 视角微微仰视，拉出古典盆景的巍峨与空间感
  camera.position.set(0, 1.4, 3.4);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0.95, 0); // 居中聚焦在树冠中部
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.minDistance = 1.0;
  controls.maxDistance = 6.0;

  // ===== 三点照明 =====
  const ambientLight = new THREE.AmbientLight(0xdde5ee, 0.75);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xfffaec, 1.8);
  dirLight.position.set(3.5, 6.0, 3.5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 15;
  dirLight.shadow.bias = -0.0003;
  scene.add(dirLight);

  const rimLight = new THREE.DirectionalLight(0xcce2ff, 1.0);
  rimLight.position.set(-3.5, 4.0, -3.0);
  scene.add(rimLight);

  const fillLight = new THREE.DirectionalLight(0xa59c8d, 0.4);
  fillLight.position.set(0, -2, 2);
  scene.add(fillLight);

  // ===== 优雅古典几架与宜兴四方名盆 =====
  setupTeaTableAndPot(scene);

  const setSeasonLighting = (season: string) => {
    switch (season) {
      case 'Spring':
        dirLight.color.setHex(0xfff6e5);
        ambientLight.color.setHex(0xe0f2e9);
        renderer.toneMappingExposure = 1.2;
        break;
      case 'Summer':
        dirLight.color.setHex(0xffeed0);
        ambientLight.color.setHex(0xd0e8ff);
        renderer.toneMappingExposure = 1.3;
        break;
      case 'Autumn':
        dirLight.color.setHex(0xffdfba);
        ambientLight.color.setHex(0xe8d0b5);
        renderer.toneMappingExposure = 1.12;
        break;
      case 'Winter':
        dirLight.color.setHex(0xddeeff);
        ambientLight.color.setHex(0xcfd8dc);
        renderer.toneMappingExposure = 0.98;
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
  // 1. 黑檀木古典条几 (漆面温润，带金线边)
  const standGeom = new THREE.BoxGeometry(2.0, 0.08, 1.2);
  const standMat = new THREE.MeshStandardMaterial({
    color: 0x181412,
    roughness: 0.45,
    metalness: 0.12,
  });
  const stand = new THREE.Mesh(standGeom, standMat);
  stand.position.y = -0.04;
  stand.receiveShadow = true;
  scene.add(stand);

  // 2. 宜兴紫砂四方外凸名盆 (长方形文人盆，深红紫泥)
  const potGeom = new THREE.BoxGeometry(1.2, 0.22, 0.85);
  const potMat = new THREE.MeshStandardMaterial({
    color: 0x482c28,
    roughness: 0.76,
    metalness: 0.08,
  });
  const pot = new THREE.Mesh(potGeom, potMat);
  pot.position.y = 0.11;
  pot.castShadow = true;
  pot.receiveShadow = true;
  scene.add(pot);

  // 四只如意足
  for (let i = 0; i < 4; i++) {
    const x = (i % 2 === 0 ? 1 : -1) * 0.52;
    const z = (i < 2 ? 1 : -1) * 0.35;
    const footGeom = new THREE.BoxGeometry(0.1, 0.06, 0.08);
    const foot = new THREE.Mesh(footGeom, potMat);
    foot.position.set(x, 0.03, z);
    foot.castShadow = true;
    scene.add(foot);
  }

  // 3. 湿润赤玉土颗粒铺面
  const soilGeom = new THREE.BoxGeometry(1.12, 0.02, 0.77);
  const soilMat = new THREE.MeshStandardMaterial({
    color: 0x3a2517,
    roughness: 0.95,
  });
  const soil = new THREE.Mesh(soilGeom, soilMat);
  soil.position.y = 0.21;
  soil.receiveShadow = true;
  scene.add(soil);

  // 点缀青苔
  const mossMat = new THREE.MeshStandardMaterial({
    color: 0x3d5c27,
    roughness: 0.85,
    flatShading: true,
  });
  for (let i = 0; i < 8; i++) {
    const x = (Math.random() - 0.5) * 0.85;
    const z = (Math.random() - 0.5) * 0.55;
    const mossGeom = new THREE.SphereGeometry(0.06 + Math.random() * 0.04, 8, 6);
    mossGeom.scale(1.6, 0.3, 1.2);
    const moss = new THREE.Mesh(mossGeom, mossMat);
    moss.position.set(x, 0.22, z);
    moss.receiveShadow = true;
    scene.add(moss);
  }

  // 4. 八方根盘 (Nebari) 抓地力根
  const rootMat = new THREE.MeshStandardMaterial({
    color: 0x483426,
    roughness: 0.82,
  });
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6 + (Math.random() - 0.5) * 0.3;
    const rootLen = 0.22 + Math.random() * 0.08;
    const rootGeom = new THREE.CylinderGeometry(0.015, 0.04, rootLen, 8);
    const root = new THREE.Mesh(rootGeom, rootMat);
    root.position.set(
      Math.cos(angle) * (rootLen * 0.45),
      0.22,
      Math.sin(angle) * (rootLen * 0.45)
    );
    root.rotation.z = Math.cos(angle) * 0.65;
    root.rotation.x = -Math.sin(angle) * 0.65;
    root.castShadow = true;
    root.receiveShadow = true;
    scene.add(root);
  }
}
