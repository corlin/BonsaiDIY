import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  container: HTMLElement;
  keyLight: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
  ambientLight: THREE.AmbientLight;
  setSeasonLighting: (season: string) => void;
}

export interface SeasonalLightingConfig {
  keyColor: number;
  keyIntensity: number;
  fillColor: number;
  fillIntensity: number;
  ambientColor: number;
  ambientIntensity: number;
  bgColor: number;
}

export const SEASONAL_LIGHTS: Record<string, SeasonalLightingConfig> = {
  Spring: {
    keyColor: 0xfffaed, // 清亮温润
    keyIntensity: 2.1,
    fillColor: 0xa5c4e8,
    fillIntensity: 0.8,
    ambientColor: 0xffffff,
    ambientIntensity: 0.7,
    bgColor: 0x181c22,
  },
  Summer: {
    keyColor: 0xfff4d6, // 艳阳金辉
    keyIntensity: 2.4,
    fillColor: 0x90c2e7,
    fillIntensity: 0.7,
    ambientColor: 0xfffcf5,
    ambientIntensity: 0.8,
    bgColor: 0x191e24,
  },
  Autumn: {
    keyColor: 0xffdfba, // 暮色斜阳
    keyIntensity: 2.0,
    fillColor: 0xd4a373,
    fillIntensity: 0.75,
    ambientColor: 0xfcf4ea,
    ambientIntensity: 0.65,
    bgColor: 0x221c1a,
  },
  Winter: {
    keyColor: 0xddeeff, // 清冷霜蓝
    keyIntensity: 1.8,
    fillColor: 0x88aacc,
    fillIntensity: 0.9,
    ambientColor: 0xe8f0f8,
    ambientIntensity: 0.6,
    bgColor: 0x151922,
  },
};

/**
 * Initializes the Three.js 3D viewport, camera, lights, orbit controls, and pot scenery.
 */
export function createScene(
  container: HTMLElement,
  onFrame?: (timeSeconds: number) => void
): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x181c22);
  scene.fog = new THREE.FogExp2(0x181c22, 0.08);

  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 1.8, 3.8);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 1.1, 0);
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.maxPolarAngle = Math.PI / 2 + 0.08;
  controls.update();

  // --- Lighting ---
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xfffaed, 2.0);
  keyLight.position.set(4, 7, 3);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 15;
  keyLight.shadow.camera.left = -3;
  keyLight.shadow.camera.right = 3;
  keyLight.shadow.camera.top = 3;
  keyLight.shadow.camera.bottom = -1;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xa5c4e8, 0.8);
  fillLight.position.set(-4, 3, -3);
  scene.add(fillLight);

  // --- Seasonal lighting handler ---
  const setSeasonLighting = (season: string) => {
    const config = SEASONAL_LIGHTS[season] || SEASONAL_LIGHTS.Spring;
    keyLight.color.setHex(config.keyColor);
    keyLight.intensity = config.keyIntensity;
    fillLight.color.setHex(config.fillColor);
    fillLight.intensity = config.fillIntensity;
    ambientLight.color.setHex(config.ambientColor);
    ambientLight.intensity = config.ambientIntensity;
    if (scene.background instanceof THREE.Color) {
      scene.background.setHex(config.bgColor);
    }
    if (scene.fog) {
      scene.fog.color.setHex(config.bgColor);
    }
  };

  // --- Scenery: Bonsai Pot & Soil ---
  const sceneryGroup = new THREE.Group();

  // Ceramic bonsai pot (Trapezoidal / oval look)
  const potGeo = new THREE.CylinderGeometry(0.85, 0.65, 0.28, 32);
  const potMat = new THREE.MeshStandardMaterial({
    color: 0x242830,
    roughness: 0.7,
    metalness: 0.15,
  });
  const pot = new THREE.Mesh(potGeo, potMat);
  pot.position.y = 0.14;
  pot.castShadow = true;
  pot.receiveShadow = true;
  sceneryGroup.add(pot);

  // Pot rim accent
  const rimGeo = new THREE.TorusGeometry(0.86, 0.03, 16, 48);
  rimGeo.rotateX(Math.PI / 2);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x1c2026,
    roughness: 0.5,
    metalness: 0.3,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.y = 0.27;
  sceneryGroup.add(rim);

  // Soil inside pot
  const soilGeo = new THREE.CylinderGeometry(0.82, 0.82, 0.06, 32);
  const soilMat = new THREE.MeshStandardMaterial({
    color: 0x1f1a16,
    roughness: 0.95,
    metalness: 0.0,
  });
  const soil = new THREE.Mesh(soilGeo, soilMat);
  soil.position.y = 0.25;
  soil.receiveShadow = true;
  sceneryGroup.add(soil);

  // Decorative moss patch on soil
  const mossGeo = new THREE.CylinderGeometry(0.55, 0.65, 0.03, 24);
  const mossMat = new THREE.MeshStandardMaterial({
    color: 0x2e4a2b,
    roughness: 0.9,
    metalness: 0.0,
  });
  const moss = new THREE.Mesh(mossGeo, mossMat);
  moss.position.set(0.1, 0.27, -0.05);
  sceneryGroup.add(moss);

  // Ground shadow receiver plane
  const floorGeo = new THREE.CircleGeometry(4, 48);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.ShadowMaterial({ opacity: 0.35 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = 0.001;
  floor.receiveShadow = true;
  sceneryGroup.add(floor);

  scene.add(sceneryGroup);

  // --- Window Resize Handling ---
  const onResize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  // --- Animation Render Loop ---
  const startTime = performance.now();
  const animate = () => {
    requestAnimationFrame(animate);
    const elapsedSeconds = (performance.now() - startTime) / 1000;
    controls.update();
    if (onFrame) {
      onFrame(elapsedSeconds);
    }
    renderer.render(scene, camera);
  };
  animate();

  return {
    scene,
    camera,
    renderer,
    controls,
    container,
    keyLight,
    fillLight,
    ambientLight,
    setSeasonLighting,
  };
}
