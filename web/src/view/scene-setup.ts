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

  // 2. 右上方斜射主暖光 (打出树皮深纵纹高光与叶片透光感)
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
 * 还原参考图中宜兴深紫泥“梨皮调砂”椭圆浅盆、赤玉土颗粒堆、八方露根与双层青苔
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

  // 2. 宜兴深紫泥“梨皮调砂”微观纹理与材质
  const potRadiusX = 0.72;
  const potRadiusZ = 0.54;
  const potHeight = 0.11;
  const potBaseY = 0.035;

  const potCanvas = document.createElement('canvas');
  potCanvas.width = 512;
  potCanvas.height = 512;
  const pctx = potCanvas.getContext('2d')!;
  pctx.fillStyle = '#422e25'; // 深紫泥深栗紫褐基底
  pctx.fillRect(0, 0, 512, 512);
  // 梨皮调砂细微矿物颗粒
  for (let i = 0; i < 3500; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    pctx.fillStyle = Math.random() > 0.4 ? 'rgba(88, 64, 54, 0.45)' : 'rgba(125, 98, 85, 0.35)';
    pctx.fillRect(px, py, 1.5, 1.5);
  }
  const potTex = new THREE.CanvasTexture(potCanvas);
  potTex.wrapS = THREE.RepeatWrapping;
  potTex.wrapT = THREE.RepeatWrapping;
  potTex.repeat.set(2, 2);

  const potMat = new THREE.MeshStandardMaterial({
    map: potTex,
    bumpMap: potTex,
    bumpScale: 0.018,
    color: 0x48342a,
    roughness: 0.72,
    metalness: 0.04,
  });

  const potGeom = new THREE.CylinderGeometry(1.0, 0.91, potHeight, 64);
  potGeom.scale(potRadiusX, 1.0, potRadiusZ);

  const pot = new THREE.Mesh(potGeom, potMat);
  pot.position.y = potBaseY + potHeight / 2 + 0.02;
  pot.castShadow = true;
  pot.receiveShadow = true;
  scene.add(pot);

  // 盆口优雅的微外翻圆润口沿 (Rolled Lip) - 产生柔和漫反射高光弧线
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

  // 3. 1024×1024 赤玉土多孔颗粒真凹凸置换贴图
  const soilCanvas = document.createElement('canvas');
  soilCanvas.width = 1024;
  soilCanvas.height = 1024;
  const sctx = soilCanvas.getContext('2d')!;
  sctx.fillStyle = '#4c3321'; // 深红褐底色
  sctx.fillRect(0, 0, 1024, 1024);

  // 细碎颗粒凹凸感（粒径 2~5mm 尺度，红褐、肉桂褐与深炭黑阴影缝隙交织）
  for (let i = 0; i < 4800; i++) {
    const px = Math.random() * 1024;
    const py = Math.random() * 1024;
    const radius = 2.0 + Math.random() * 4.5;
    const rnd = Math.random();
    sctx.fillStyle = rnd > 0.6 ? '#6e492e' : rnd > 0.25 ? '#573822' : '#28170c';
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
    bumpScale: 0.045, // 强力多孔颗粒立体感
    roughness: 0.95,
  });
  const mound = new THREE.Mesh(moundGeom, soilMat);
  mound.position.y = potBaseY + potHeight - 0.01;
  mound.receiveShadow = true;
  scene.add(mound);

  // 4. 双层丝绒青苔微观材质 (Velvet Living Moss)
  // 顶层鲜嫩黄绿与底层深翠绿双层交织
  const mossCanvas = document.createElement('canvas');
  mossCanvas.width = 256;
  mossCanvas.height = 256;
  const mctx = mossCanvas.getContext('2d')!;
  const mgrad = mctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  mgrad.addColorStop(0, '#6bb82d');
  mgrad.addColorStop(0.7, '#4c8a20');
  mgrad.addColorStop(1, '#2c5a14');
  mctx.fillStyle = mgrad;
  mctx.fillRect(0, 0, 256, 256);
  // 微绒毛微点
  for (let i = 0; i < 2000; i++) {
    mctx.fillStyle = Math.random() > 0.5 ? 'rgba(125, 205, 50, 0.35)' : 'rgba(35, 75, 18, 0.3)';
    mctx.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  const mossTex = new THREE.CanvasTexture(mossCanvas);

  const mossMat = new THREE.MeshStandardMaterial({
    map: mossTex,
    bumpMap: mossTex,
    bumpScale: 0.025,
    roughness: 0.95, // 丝绒微绒完全漫反射
  });

  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI * 2) / 16 + (Math.random() - 0.5) * 0.3;
    const dist = 0.12 + Math.random() * 0.28;
    const mossGeom = new THREE.SphereGeometry(0.065 + Math.random() * 0.05, 12, 10);
    mossGeom.scale(1.5, 0.28, 1.3);
    const moss = new THREE.Mesh(mossGeom, mossMat);
    moss.position.set(
      Math.cos(angle) * dist,
      potBaseY + potHeight + 0.135 - dist * 0.14,
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
