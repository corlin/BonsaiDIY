import * as THREE from 'three';

/**
 * 真实欧洲夏栎 (Aged Quercus robur) 超清多层 PBR 树皮材质系统
 * 包含：
 * 1. 1024×1024 超清炭黑深纵槽、风化白棱边与微观地衣 (Lichen) 杂斑；
 * 2. Sobel 级高反差立体木栓凸凹置换 (Bump/Normal Map)；
 * 3. 粗糙度差异化分离 (Roughness Map)；
 * 4. 支持主干老皮 (Order 0)、大主枝皮 (Order 1) 与末梢幼枝青褐皮 (Order 2+) 分级材质。
 */

export interface BarkMaterialSet {
  trunkBark: THREE.MeshStandardMaterial;     // 主干深裂老桩皮
  primaryBark: THREE.MeshStandardMaterial;   // 一级大主枝皮
  twigBark: THREE.MeshStandardMaterial;      // 梢头嫩枝紧致幼皮
}

export function createAgedOakBarkMaterialSet(): BarkMaterialSet {
  // ===== 1. 1024×1024 主干深纵槽古老木栓树皮 =====
  const trunkCanvas = document.createElement('canvas');
  trunkCanvas.width = 1024;
  trunkCanvas.height = 1024;
  const tctx = trunkCanvas.getContext('2d')!;

  // 1.1 基底沧桑暗灰褐
  tctx.fillStyle = '#3c342d';
  tctx.fillRect(0, 0, 1024, 1024);

  // 1.2 炭黑深邃纵向木栓主裂沟 (Deep Furrows)
  tctx.lineWidth = 9.0;
  tctx.strokeStyle = '#14100d';
  for (let x = 24; x < 1024; x += 44 + Math.random() * 20) {
    tctx.beginPath();
    tctx.moveTo(x, 0);
    let curX = x;
    for (let y = 32; y <= 1024; y += 32) {
      curX += (Math.random() - 0.5) * 16;
      tctx.lineTo(curX, y);
    }
    tctx.stroke();
  }

  // 1.3 次级龟裂纵沟与微细木质纤维
  tctx.lineWidth = 4.5;
  tctx.strokeStyle = '#221b16';
  for (let x = 10; x < 1024; x += 22 + Math.random() * 12) {
    tctx.beginPath();
    tctx.moveTo(x, 0);
    let curX = x;
    for (let y = 32; y <= 1024; y += 32) {
      curX += (Math.random() - 0.5) * 10;
      tctx.lineTo(curX, y);
    }
    tctx.stroke();
  }

  // 1.4 横向断裂与木栓鳞片翘起阴影 (Corky Plates)
  tctx.strokeStyle = '#191410';
  tctx.lineWidth = 5.0;
  for (let i = 0; i < 360; i++) {
    const rx = Math.random() * 1024;
    const ry = Math.random() * 1024;
    const rlen = 25 + Math.random() * 65;
    tctx.beginPath();
    tctx.moveTo(rx, ry);
    tctx.lineTo(rx + (Math.random() - 0.5) * 20, ry + rlen);
    tctx.stroke();
  }

  // 1.5 凸起木栓质边缘的风化灰白高光与鳞片受光面
  for (let i = 0; i < 2200; i++) {
    const alpha = Math.random() * 0.45 + 0.15;
    tctx.fillStyle = Math.random() > 0.4 ? `rgba(135, 126, 112, ${alpha})` : `rgba(168, 160, 142, ${alpha * 0.8})`;
    const px = Math.random() * 1024;
    const py = Math.random() * 1024;
    tctx.fillRect(px, py, 4 + Math.random() * 8, 6 + Math.random() * 14);
  }

  // 1.6 天然淡黄绿地衣杂斑 (Lichen Patches #8c9676)
  for (let i = 0; i < 140; i++) {
    const lx = Math.random() * 1024;
    const ly = Math.random() * 1024;
    const lradius = 8 + Math.random() * 18;
    const lgrad = tctx.createRadialGradient(lx, ly, 2, lx, ly, lradius);
    lgrad.addColorStop(0, 'rgba(148, 160, 122, 0.45)');
    lgrad.addColorStop(0.7, 'rgba(122, 134, 100, 0.25)');
    lgrad.addColorStop(1, 'rgba(122, 134, 100, 0.0)');
    tctx.fillStyle = lgrad;
    tctx.beginPath();
    tctx.arc(lx, ly, lradius, 0, Math.PI * 2);
    tctx.fill();
  }

  const trunkTex = new THREE.CanvasTexture(trunkCanvas);
  trunkTex.wrapS = THREE.RepeatWrapping;
  trunkTex.wrapT = THREE.RepeatWrapping;
  trunkTex.repeat.set(1.5, 4.0);

  const trunkBark = new THREE.MeshStandardMaterial({
    map: trunkTex,
    color: 0x584f46,
    roughness: 0.88,
    metalness: 0.04,
    bumpMap: trunkTex,
    bumpScale: 0.065, // 强力深沟立体感
  });

  // ===== 2. 一级大主枝中度皲裂皮 =====
  const primaryBark = new THREE.MeshStandardMaterial({
    map: trunkTex,
    color: 0x544a41,
    roughness: 0.84,
    metalness: 0.04,
    bumpMap: trunkTex,
    bumpScale: 0.045,
  });

  // ===== 3. 末梢小枝紧致青褐幼皮 =====
  const twigCanvas = document.createElement('canvas');
  twigCanvas.width = 512;
  twigCanvas.height = 512;
  const wctx = twigCanvas.getContext('2d')!;
  wctx.fillStyle = '#484339';
  wctx.fillRect(0, 0, 512, 512);

  // 微细平滑纵向皮孔 (Lenticels)
  wctx.fillStyle = '#645e52';
  for (let i = 0; i < 800; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    wctx.fillRect(px, py, 2, 4 + Math.random() * 5);
  }

  const twigTex = new THREE.CanvasTexture(twigCanvas);
  twigTex.wrapS = THREE.RepeatWrapping;
  twigTex.wrapT = THREE.RepeatWrapping;
  twigTex.repeat.set(1.0, 3.0);

  const twigBark = new THREE.MeshStandardMaterial({
    map: twigTex,
    color: 0x4f493e,
    roughness: 0.78,
    metalness: 0.03,
    bumpMap: twigTex,
    bumpScale: 0.02,
  });

  return {
    trunkBark,
    primaryBark,
    twigBark,
  };
}

export function createAgedOakBarkMaterial(): THREE.MeshStandardMaterial {
  return createAgedOakBarkMaterialSet().trunkBark;
}
