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
  // 1:1 还原名家盆景展厅高雅的暖灰纯净微米背景
  scene.background = new THREE.Color(0xf4f1eb);
  scene.fog = new THREE.FogExp2(0xf4f1eb, 0.032);

  const camera = new THREE.PerspectiveCamera(
    34,
    container.clientWidth / container.clientHeight,
    0.1,
    50
  );
  // 正面黄金微俯视鉴赏视角：完美包揽从盆面青苔根盘到顶冠各层枝托
  camera.position.set(0, 1.25, 3.25);

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
  controls.target.set(0, 0.88, 0); // 焦点对准第一主枝托与主干出枝中枢
  controls.maxPolarAngle = Math.PI / 2 - 0.02; // 禁止穿透展台地面
  controls.minDistance = 1.1;
  controls.maxDistance = 5.5;

  // ===== 高端名家盆景展漫射布光 =====
  // 1. 柔和白色漫射天光 (避免任何死黑死暗)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.92);
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

  // ===== 1:1 还原参考图中的宜兴紫砂椭圆浅盆、低缓微凸赤玉土与八方苍劲龙爪露根 =====
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
 * 还原参考图中宜兴深紫泥“梨皮调砂”椭圆浅盆、低平缓坡赤玉土颗粒堆与八方苍劲露根
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
  pctx.fillStyle = '#3e2c24'; // 深紫泥深栗紫褐基底
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
  // 经 rotateX(PI/2) 后，长轴在 X 轴，短轴在 Z 轴，故缩放向量必须为 (potRadiusX, 1.0, potRadiusZ)
  const rimGeom = new THREE.TorusGeometry(1.0, 0.020, 16, 64);
  rimGeom.rotateX(Math.PI / 2);
  rimGeom.scale(potRadiusX * 1.008, 1.0, potRadiusZ * 1.008);
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
  sctx.fillStyle = '#785033'; // 纯正名品温润红褐赤玉土底色
  sctx.fillRect(0, 0, 1024, 1024);

  // 细碎颗粒凹凸感（粒径 2~5mm 尺度，陶土肉桂褐、烘焙褐与缝隙交织）
  for (let i = 0; i < 6000; i++) {
    const px = Math.random() * 1024;
    const py = Math.random() * 1024;
    const radius = 2.0 + Math.random() * 4.5;
    const rnd = Math.random();
    sctx.fillStyle = rnd > 0.6 ? '#926543' : rnd > 0.25 ? '#805436' : '#563520';
    sctx.beginPath();
    sctx.arc(px, py, radius, 0, Math.PI * 2);
    sctx.fill();
  }
  const soilTex = new THREE.CanvasTexture(soilCanvas);
  soilTex.wrapS = THREE.RepeatWrapping;
  soilTex.wrapT = THREE.RepeatWrapping;
  soilTex.repeat.set(4, 4);

  const soilMat = new THREE.MeshStandardMaterial({
    map: soilTex,
    bumpMap: soilTex,
    bumpScale: 0.035, // 自然多孔颗粒立体感
    roughness: 0.88,
    color: 0xffffff, // 保持贴图本色，绝杀死黑
  });

  // ===== 彻底消灭失控大黑球：构建精准低缓微凸抛物线赤玉土面 =====
  // 盆沿高度 potLipY = potBaseY + potHeight + 0.02 = 0.165
  // 土面内侧边缘 y_edge = 0.156 (低于盆沿 9mm，符合保水防溢标准)
  // 土面中心最高点 y_center = 0.178 (仅高出边缘 2.2cm，低缓优雅平铺，严禁高耸黑保龄球)
  const soilRadiusX = potRadiusX * 0.96;
  const soilRadiusZ = potRadiusZ * 0.96;
  const radialRings = 24;
  const angularSlices = 64;
  const moundVertices: number[] = [];
  const moundNormals: number[] = [];
  const moundUvs: number[] = [];
  const moundIndices: number[] = [];

  for (let r = 0; r <= radialRings; r++) {
    const u = r / radialRings; // 0 (中心) -> 1 (盆口边缘)
    const currentHeight = 0.178 - 0.022 * Math.pow(u, 1.8);
    const rx = u * soilRadiusX;
    const rz = u * soilRadiusZ;

    for (let s = 0; s <= angularSlices; s++) {
      const theta = (s / angularSlices) * Math.PI * 2;
      const x = rx * Math.cos(theta);
      const z = rz * Math.sin(theta);
      const y = currentHeight;

      moundVertices.push(x, y, z);

      // 法线：中心竖直朝上，边缘微斜
      const slope = -0.022 * 1.8 * Math.pow(u, 0.8) / (soilRadiusX + 1e-4);
      const nx = -Math.cos(theta) * slope;
      const nz = -Math.sin(theta) * slope;
      const ny = 1.0;
      const normLen = Math.hypot(nx, ny, nz);
      moundNormals.push(nx / normLen, ny / normLen, nz / normLen);

      moundUvs.push((Math.cos(theta) * u + 1) * 0.5, (Math.sin(theta) * u + 1) * 0.5);
    }
  }

  for (let r = 0; r < radialRings; r++) {
    for (let s = 0; s < angularSlices; s++) {
      const row1 = r * (angularSlices + 1);
      const row2 = (r + 1) * (angularSlices + 1);
      moundIndices.push(row1 + s, row2 + s, row1 + s + 1);
      moundIndices.push(row1 + s + 1, row2 + s, row2 + s + 1);
    }
  }

  const customMoundGeom = new THREE.BufferGeometry();
  customMoundGeom.setAttribute('position', new THREE.Float32BufferAttribute(moundVertices, 3));
  customMoundGeom.setAttribute('normal', new THREE.Float32BufferAttribute(moundNormals, 3));
  customMoundGeom.setAttribute('uv', new THREE.Float32BufferAttribute(moundUvs, 2));
  customMoundGeom.setIndex(moundIndices);

  const moundMesh = new THREE.Mesh(customMoundGeom, soilMat);
  moundMesh.receiveShadow = true;
  scene.add(moundMesh);

  // 4. 双层丝绒微绒青苔渗润贴图 (羽化渗透，消灭“黄瓜片”)
  const mossCanvas = document.createElement('canvas');
  mossCanvas.width = 256;
  mossCanvas.height = 256;
  const mctx = mossCanvas.getContext('2d')!;
  const mgrad = mctx.createRadialGradient(128, 128, 10, 128, 128, 122);
  mgrad.addColorStop(0, 'rgba(125, 202, 42, 0.95)');
  mgrad.addColorStop(0.45, 'rgba(84, 156, 32, 0.85)');
  mgrad.addColorStop(0.75, 'rgba(44, 94, 18, 0.45)');
  mgrad.addColorStop(1.0, 'rgba(44, 94, 18, 0.0)');
  mctx.fillStyle = mgrad;
  mctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    mctx.fillStyle = Math.random() > 0.5 ? 'rgba(155, 235, 70, 0.35)' : 'rgba(35, 75, 18, 0.25)';
    mctx.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  const mossTex = new THREE.CanvasTexture(mossCanvas);

  const mossMat = new THREE.MeshStandardMaterial({
    map: mossTex,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    roughness: 0.95,
  });

  // 青苔自然贴附渗润于树根根颈周围土面
  for (let i = 0; i < 18; i++) {
    const angle = (i * Math.PI * 2) / 18 + (Math.random() - 0.5) * 0.35;
    const dist = 0.06 + Math.random() * 0.24;
    const u = dist / soilRadiusX;
    const mossY = 0.178 - 0.022 * Math.pow(u, 1.8) + 0.002;

    const patchRadius = 0.055 + Math.random() * 0.05;
    const mossGeom = new THREE.PlaneGeometry(patchRadius * 2, patchRadius * 1.6);
    mossGeom.rotateX(-Math.PI / 2);
    const moss = new THREE.Mesh(mossGeom, mossMat);
    moss.position.set(
      Math.cos(angle) * dist,
      mossY,
      Math.sin(angle) * dist * (soilRadiusZ / soilRadiusX)
    );
    moss.rotation.y = Math.random() * Math.PI;
    moss.receiveShadow = true;
    scene.add(moss);
  }

  // 树木基部自身具备仿生八方老根盘 (Nebari Flare)，自然扎根于低缓赤玉土与微绒青苔之中
}
