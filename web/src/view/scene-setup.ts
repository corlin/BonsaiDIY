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
  // 1:1 还原参考图中纯净高雅的展厅暖白微米灰背景
  scene.background = new THREE.Color(0xf2f0eb);
  scene.fog = new THREE.FogExp2(0xf2f0eb, 0.035);

  const camera = new THREE.PerspectiveCamera(
    34,
    container.clientWidth / container.clientHeight,
    0.1,
    50
  );
  // 正面黄金微俯视鉴赏视角：完美包揽从盆面青苔根盘到顶冠各层枝托
  camera.position.set(0, 1.30, 3.35);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0.90, 0); // 焦点对准第一大主枝托出枝核心
  controls.maxPolarAngle = Math.PI / 2 - 0.02; // 禁止穿透展台地面
  controls.minDistance = 1.1;
  controls.maxDistance = 5.5;

  // ===== 高端名家盆景展漫射布光 =====
  // 1. 柔和白色漫射天光 (避免任何死黑死暗)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.90);
  scene.add(ambientLight);

  // 2. 右上方斜射主暖光 (打出树皮纵纹高光与叶片透光感)
  const dirLight = new THREE.DirectionalLight(0xfffdf5, 1.45);
  dirLight.position.set(2.8, 5.5, 3.5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 12;
  dirLight.shadow.camera.left = -2.0;
  dirLight.shadow.camera.right = 2.0;
  dirLight.shadow.camera.top = 2.5;
  dirLight.shadow.camera.bottom = -1.0;
  dirLight.shadow.bias = -0.0003;
  scene.add(dirLight);

  // 3. 左侧轮廓微光 (Rim light)
  const rimLight = new THREE.DirectionalLight(0xe4edff, 0.60);
  rimLight.position.set(-3.2, 4.0, -2.5);
  scene.add(rimLight);

  // 4. 地面柔和反弹光
  const fillLight = new THREE.DirectionalLight(0xeddcca, 0.35);
  fillLight.position.set(0, -2, 2.0);
  scene.add(fillLight);

  // ===== 1:1 还原参考图中的宜兴紫砂椭圆浅盆、红褐赤玉土馒头丘与八方苍老露根 =====
  setupReferencePotAndMound(scene);

  const setSeasonLighting = (season: string) => {
    switch (season) {
      case 'Spring':
        dirLight.color.setHex(0xfffdf5);
        ambientLight.color.setHex(0xffffff);
        renderer.toneMappingExposure = 1.08;
        break;
      case 'Summer':
        dirLight.color.setHex(0xfff7e4);
        ambientLight.color.setHex(0xf7faff);
        renderer.toneMappingExposure = 1.16;
        break;
      case 'Autumn':
        dirLight.color.setHex(0xffeed6);
        ambientLight.color.setHex(0xfdf3e6);
        renderer.toneMappingExposure = 1.02;
        break;
      case 'Winter':
        dirLight.color.setHex(0xeef4fc);
        ambientLight.color.setHex(0xe8eef5);
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

/**
 * 还原参考图中深紫泥椭圆浅盆、馒头状赤玉土堆、八方露根与青苔
 */
function setupReferencePotAndMound(scene: THREE.Scene): void {
  // 1. 展台纯净米白底板与阴影接收面
  const floorGeom = new THREE.PlaneGeometry(16, 16);
  const floorMat = new THREE.ShadowMaterial({ opacity: 0.15 });
  const floor = new THREE.Mesh(floorGeom, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.0;
  floor.receiveShadow = true;
  scene.add(floor);

  // 展品微台座 (低调典雅的展台垫板)
  const standGeom = new THREE.CylinderGeometry(1.35, 1.40, 0.035, 64);
  const standMat = new THREE.MeshStandardMaterial({
    color: 0xe6e3dc,
    roughness: 0.75,
  });
  const stand = new THREE.Mesh(standGeom, standMat);
  stand.position.y = 0.0175;
  stand.receiveShadow = true;
  scene.add(stand);

  // 2. 经典深褐紫泥椭圆浅盆 (Oval Yixing Bonsai Pot)
  const potRadiusX = 0.72;
  const potRadiusZ = 0.54;
  const potHeight = 0.11;
  const potBaseY = 0.035;

  const potGeom = new THREE.CylinderGeometry(1.0, 0.91, potHeight, 64);
  potGeom.scale(potRadiusX, 1.0, potRadiusZ);

  const potMat = new THREE.MeshStandardMaterial({
    color: 0x463228, // 参考图同款温润紫砂深朱褐
    roughness: 0.78,
    metalness: 0.04,
  });
  const pot = new THREE.Mesh(potGeom, potMat);
  pot.position.y = potBaseY + potHeight / 2 + 0.02;
  pot.castShadow = true;
  pot.receiveShadow = true;
  scene.add(pot);

  // 盆口优雅的微外翻圆润口沿 (Rolled Lip)
  const rimGeom = new THREE.TorusGeometry(1.01, 0.022, 16, 64);
  rimGeom.rotateX(Math.PI / 2);
  rimGeom.scale(potRadiusX, potRadiusZ, 1.0);
  const rim = new THREE.Mesh(rimGeom, potMat);
  rim.position.y = potBaseY + potHeight + 0.02;
  rim.castShadow = true;
  scene.add(rim);

  // 盆底 4 处低矮端庄的云足 (Cloud Feet)
  const footGeom = new THREE.BoxGeometry(0.08, 0.025, 0.08);
  const footPositions = [
    [potRadiusX * 0.70, potRadiusZ * 0.65],
    [-potRadiusX * 0.70, potRadiusZ * 0.65],
    [potRadiusX * 0.70, -potRadiusZ * 0.65],
    [-potRadiusX * 0.70, -potRadiusZ * 0.65],
  ];
  for (const [fx, fz] of footPositions) {
    const foot = new THREE.Mesh(footGeom, potMat);
    foot.position.set(fx, potBaseY + 0.012, fz);
    foot.castShadow = true;
    scene.add(foot);
  }

  // 3. 参考图中标志性的“微凸饱满馒头状”赤玉土丘 (Akadama Mound)
  // 生成赤玉土多孔颗粒凹凸贴图
  const soilCanvas = document.createElement('canvas');
  soilCanvas.width = 256;
  soilCanvas.height = 256;
  const sctx = soilCanvas.getContext('2d')!;
  sctx.fillStyle = '#4e3522';
  sctx.fillRect(0, 0, 256, 256);
  // 细碎颗粒凹凸感
  for (let i = 0; i < 1200; i++) {
    const px = Math.random() * 256;
    const py = Math.random() * 256;
    const radius = 1.2 + Math.random() * 2.2;
    sctx.fillStyle = Math.random() > 0.5 ? '#3b2615' : '#61442c';
    sctx.beginPath();
    sctx.arc(px, py, radius, 0, Math.PI * 2);
    sctx.fill();
  }
  const soilTex = new THREE.CanvasTexture(soilCanvas);
  soilTex.wrapS = THREE.RepeatWrapping;
  soilTex.wrapT = THREE.RepeatWrapping;
  soilTex.repeat.set(4, 4);

  const moundGeom = new THREE.SphereGeometry(potRadiusX * 0.96, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.36);
  moundGeom.scale(1.0, 0.36, potRadiusZ / potRadiusX);
  const soilMat = new THREE.MeshStandardMaterial({
    map: soilTex,
    bumpMap: soilTex,
    bumpScale: 0.025,
    roughness: 0.95,
  });
  const mound = new THREE.Mesh(moundGeom, soilMat);
  mound.position.y = potBaseY + potHeight - 0.01;
  mound.receiveShadow = true;
  scene.add(mound);

  // 4. 参考图中树蔸根盘四周斑驳点缀的翠绿短绒青苔小斑 (Patchy Living Moss)
  const mossMat = new THREE.MeshStandardMaterial({
    color: 0x487928, // 鲜活草绿苔藓
    roughness: 0.92,
  });
  for (let i = 0; i < 14; i++) {
    const angle = (i * Math.PI * 2) / 14 + (Math.random() - 0.5) * 0.3;
    const dist = 0.12 + Math.random() * 0.28;
    const mossGeom = new THREE.SphereGeometry(0.065 + Math.random() * 0.05, 10, 8);
    mossGeom.scale(1.5, 0.28, 1.3);
    const moss = new THREE.Mesh(mossGeom, mossMat);
    moss.position.set(
      Math.cos(angle) * dist,
      potBaseY + potHeight + 0.13 - dist * 0.14,
      Math.sin(angle) * dist * (potRadiusZ / potRadiusX)
    );
    moss.receiveShadow = true;
    scene.add(moss);
  }

  // 5. 抓地盘曲的八方主露根 (Nebari Buttress Roots)
  const rootMat = new THREE.MeshStandardMaterial({
    color: 0x463d35,
    roughness: 0.88,
  });
  const rootAngles = [0.15, 0.95, 1.85, 2.75, 3.65, 4.45, 5.25, 5.95];
  for (const angle of rootAngles) {
    const rootLen = 0.22 + Math.random() * 0.08;
    const rootGeom = new THREE.CylinderGeometry(0.018, 0.052, rootLen, 12);
    const root = new THREE.Mesh(rootGeom, rootMat);
    const posX = Math.cos(angle) * (rootLen * 0.48);
    const posZ = Math.sin(angle) * (rootLen * 0.48) * (potRadiusZ / potRadiusX);
    root.position.set(
      posX,
      potBaseY + potHeight + 0.135 - rootLen * 0.22,
      posZ
    );
    root.rotation.z = Math.cos(angle) * 0.72;
    root.rotation.x = -Math.sin(angle) * 0.72;
    root.castShadow = true;
    root.receiveShadow = true;
    scene.add(root);
  }
}
