import * as THREE from 'three';

/**
 * 真实欧洲夏栎 (Aged Quercus robur) 超清多层 PBR 树皮材质系统
 * 依据名品盆景参考图：
 * 1. 1024×1024 超清风化灰褐色 (Taupe/Ash #7a6e60) 基底，受光面呈现古朴米灰包浆；
 * 2. 纵向深皲裂沟槽呈现深炭褐暗影 (#28201a)；
 * 3. 凸起木栓质脊线 (Corky Ridges) 带有真实高反差微立体置换；
 * 4. 一级大主枝 (Order 1) 与末梢二三级细枝 (Order 2+) 梯度过渡。
 */

export interface BarkMaterialSet {
  trunkBark: THREE.MeshStandardMaterial;     // 主干深裂老桩皮
  primaryBark: THREE.MeshStandardMaterial;   // 一级大主枝皮
  twigBark: THREE.MeshStandardMaterial;      // 梢头细枝紧致木色皮
}

export function createAgedOakBarkMaterialSet(): BarkMaterialSet {
  // ===== 1. 1024×1024 主干深纵槽古老木栓树皮 =====
  const trunkCanvas = document.createElement('canvas');
  trunkCanvas.width = 1024;
  trunkCanvas.height = 1024;
  const tctx = trunkCanvas.getContext('2d')!;

  // 1.1 基底：古朴风化灰褐 (Taupe/Ash，彻底消除死黑)
  tctx.fillStyle = '#75695b';
  tctx.fillRect(0, 0, 1024, 1024);

  // 1.2 炭黑深邃纵向木栓主裂沟 (Deep Furrows)
  tctx.lineWidth = 9.0;
  tctx.strokeStyle = '#28201a';
  for (let x = 20; x < 1024; x += 38 + Math.random() * 18) {
    tctx.beginPath();
    tctx.moveTo(x, 0);
    let curX = x;
    for (let y = 32; y <= 1024; y += 32) {
      curX += (Math.random() - 0.5) * 14;
      tctx.lineTo(curX, y);
    }
    tctx.stroke();
  }

  // 1.3 次级龟裂纵沟与微细木质纤维
  tctx.lineWidth = 4.0;
  tctx.strokeStyle = '#3d3229';
  for (let x = 8; x < 1024; x += 18 + Math.random() * 10) {
    tctx.beginPath();
    tctx.moveTo(x, 0);
    let curX = x;
    for (let y = 32; y <= 1024; y += 32) {
      curX += (Math.random() - 0.5) * 8;
      tctx.lineTo(curX, y);
    }
    tctx.stroke();
  }

  // 1.4 横向断裂与木栓鳞片翘起阴影 (Corky Plates)
  tctx.strokeStyle = '#2c231c';
  tctx.lineWidth = 4.5;
  for (let i = 0; i < 380; i++) {
    const rx = Math.random() * 1024;
    const ry = Math.random() * 1024;
    const rlen = 20 + Math.random() * 55;
    tctx.beginPath();
    tctx.moveTo(rx, ry);
    tctx.lineTo(rx + (Math.random() - 0.5) * 16, ry + rlen);
    tctx.stroke();
  }

  // 1.5 凸起木栓质边缘的风化灰白/米灰高光受光脊线
  for (let i = 0; i < 2800; i++) {
    const alpha = Math.random() * 0.5 + 0.25;
    tctx.fillStyle = Math.random() > 0.4 ? `rgba(168, 158, 142, ${alpha})` : `rgba(195, 185, 168, ${alpha * 0.8})`;
    const px = Math.random() * 1024;
    const py = Math.random() * 1024;
    tctx.fillRect(px, py, 3 + Math.random() * 6, 6 + Math.random() * 16);
  }

  // 1.6 天然淡黄绿地衣杂斑 (Lichen Patches)
  for (let i = 0; i < 150; i++) {
    const lx = Math.random() * 1024;
    const ly = Math.random() * 1024;
    const lradius = 6 + Math.random() * 16;
    const lgrad = tctx.createRadialGradient(lx, ly, 2, lx, ly, lradius);
    lgrad.addColorStop(0, 'rgba(160, 175, 130, 0.45)');
    lgrad.addColorStop(0.7, 'rgba(135, 148, 110, 0.20)');
    lgrad.addColorStop(1, 'rgba(135, 148, 110, 0.0)');
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
    color: 0xffffff, // 保持贴图本色，绝不死黑
    roughness: 0.82,
    metalness: 0.02,
    bumpMap: trunkTex,
    bumpScale: 0.045, // 凸凹深沟立体感
  });

  // ===== 2. 一级大主枝中度皲裂皮 (暖木褐过渡) =====
  const primaryCanvas = document.createElement('canvas');
  primaryCanvas.width = 512;
  primaryCanvas.height = 512;
  const pctx = primaryCanvas.getContext('2d')!;
  pctx.fillStyle = '#65574a';
  pctx.fillRect(0, 0, 512, 512);

  // 中细度纵沟
  pctx.lineWidth = 4.0;
  pctx.strokeStyle = '#2d231b';
  for (let x = 12; x < 512; x += 24 + Math.random() * 12) {
    pctx.beginPath();
    pctx.moveTo(x, 0);
    let curX = x;
    for (let y = 20; y <= 512; y += 20) {
      curX += (Math.random() - 0.5) * 8;
      pctx.lineTo(curX, y);
    }
    pctx.stroke();
  }
  // 浅色皮孔杂纹
  pctx.fillStyle = 'rgba(155, 145, 130, 0.35)';
  for (let i = 0; i < 900; i++) {
    pctx.fillRect(Math.random() * 512, Math.random() * 512, 2.5, 5 + Math.random() * 8);
  }

  const primaryTex = new THREE.CanvasTexture(primaryCanvas);
  primaryTex.wrapS = THREE.RepeatWrapping;
  primaryTex.wrapT = THREE.RepeatWrapping;
  primaryTex.repeat.set(1.2, 3.0);

  const primaryBark = new THREE.MeshStandardMaterial({
    map: primaryTex,
    color: 0xffffff,
    roughness: 0.80,
    metalness: 0.02,
    bumpMap: primaryTex,
    bumpScale: 0.03,
  });

  // ===== 3. 末梢二、三级细小枝紧致木色幼皮 =====
  const twigCanvas = document.createElement('canvas');
  twigCanvas.width = 256;
  twigCanvas.height = 256;
  const wctx = twigCanvas.getContext('2d')!;
  wctx.fillStyle = '#55473a';
  wctx.fillRect(0, 0, 256, 256);

  // 微细平滑纵向皮孔 (Lenticels)
  wctx.fillStyle = 'rgba(145, 132, 118, 0.4)';
  for (let i = 0; i < 500; i++) {
    wctx.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 3 + Math.random() * 4);
  }

  const twigTex = new THREE.CanvasTexture(twigCanvas);
  twigTex.wrapS = THREE.RepeatWrapping;
  twigTex.wrapT = THREE.RepeatWrapping;
  twigTex.repeat.set(1.0, 2.5);

  const twigBark = new THREE.MeshStandardMaterial({
    map: twigTex,
    color: 0xffffff,
    roughness: 0.76,
    metalness: 0.02,
    bumpMap: twigTex,
    bumpScale: 0.015,
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
