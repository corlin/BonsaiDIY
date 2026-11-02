import * as THREE from 'three';

/**
 * 生成真实欧洲夏栎 (Quercus robur) 单叶超清纹理
 * 特征：叶片边缘具有典型的波浪圆齿羽状深裂 (Lobes)，叶基部有耳状小凹 (Auriculate base)，
 * 具有清晰主脉与分支侧脉，支持半透明与 AlphaTest 锐利边缘。
 */
export function createOakLeafAtlas(): { texture: THREE.CanvasTexture; alphaTest: number } {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 512);

  ctx.save();
  ctx.translate(256, 256);

  // 叶身渐变底色（叶心翡翠浓绿，叶缘向阳鲜亮嫩绿）
  const grad = ctx.createRadialGradient(0, 0, 30, 0, 0, 220);
  grad.addColorStop(0, '#589e28');
  grad.addColorStop(0.65, '#4a8920');
  grad.addColorStop(0.9, '#3b7017');
  grad.addColorStop(1, '#2c5411');

  // 1. 真实夏栎波浪羽裂轮廓 (5~6对圆润裂片)
  ctx.beginPath();
  // 从叶柄基部起始 (顶部设为朝上 -Y，基部在 +Y)
  ctx.moveTo(0, 195);

  // 右侧边缘裂片 (由基部至叶尖)
  ctx.bezierCurveTo(18, 185, 26, 170, 22, 155);  // 基部微凹耳片
  ctx.bezierCurveTo(45, 150, 68, 130, 52, 105);  // 第1裂片
  ctx.bezierCurveTo(80, 95, 95, 60, 68, 35);     // 第2裂片 (大)
  ctx.bezierCurveTo(90, 20, 98, -25, 65, -50);   // 第3裂片 (大)
  ctx.bezierCurveTo(75, -65, 78, -105, 48, -125); // 第4裂片
  ctx.bezierCurveTo(50, -140, 42, -170, 22, -182); // 第5小裂片
  ctx.bezierCurveTo(12, -192, 6, -205, 0, -210);   // 圆润叶尖

  // 左侧对称但微有机扰动的羽裂边缘
  ctx.bezierCurveTo(-6, -205, -12, -192, -22, -182);
  ctx.bezierCurveTo(-42, -170, -50, -140, -48, -125);
  ctx.bezierCurveTo(-78, -105, -75, -65, -65, -50);
  ctx.bezierCurveTo(-98, -25, -90, 20, -68, 35);
  ctx.bezierCurveTo(-95, 60, -80, 95, -52, 105);
  ctx.bezierCurveTo(-68, 130, -45, 150, -22, 155);
  ctx.bezierCurveTo(-26, 170, -18, 185, 0, 195);
  ctx.closePath();

  ctx.fillStyle = grad;
  ctx.fill();

  // 边缘极轻微的向阳黄绿受光微边
  ctx.strokeStyle = 'rgba(165, 220, 75, 0.45)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 2. 真实主叶脉与侧叶脉系统
  // 主叶脉 (中轴贯通)
  ctx.beginPath();
  ctx.moveTo(0, 235); // 叶柄
  ctx.lineTo(0, -200);
  ctx.strokeStyle = 'rgba(195, 245, 125, 0.85)';
  ctx.lineWidth = 4.0;
  ctx.stroke();

  // 叶柄实底 (稍带木质红褐色)
  ctx.beginPath();
  ctx.moveTo(0, 235);
  ctx.lineTo(0, 185);
  ctx.strokeStyle = '#627c28';
  ctx.lineWidth = 5.5;
  ctx.stroke();

  // 侧叶脉（通向每个羽裂突出部）
  const lobeTargets = [
    { yStart: 140, xEnd: 50, yEnd: 115 },
    { yStart: 70,  xEnd: 72, yEnd: 45 },
    { yStart: -10, xEnd: 72, yEnd: -40 },
    { yStart: -85, xEnd: 55, yEnd: -115 },
    { yStart: -150,xEnd: 30, yEnd: -175 },
  ];

  ctx.strokeStyle = 'rgba(180, 235, 115, 0.55)';
  ctx.lineWidth = 2.2;
  for (const t of lobeTargets) {
    // 右侧脉
    ctx.beginPath();
    ctx.moveTo(0, t.yStart);
    ctx.quadraticCurveTo(t.xEnd * 0.4, t.yStart - 5, t.xEnd, t.yEnd);
    ctx.stroke();

    // 左侧脉
    ctx.beginPath();
    ctx.moveTo(0, t.yStart);
    ctx.quadraticCurveTo(-t.xEnd * 0.4, t.yStart - 5, -t.xEnd, t.yEnd);
    ctx.stroke();
  }

  // 3. 微观次级细网脉 (微细网络光感)
  ctx.strokeStyle = 'rgba(200, 245, 130, 0.18)';
  ctx.lineWidth = 1.0;
  for (const t of lobeTargets) {
    for (let step = 0.3; step < 0.9; step += 0.3) {
      const mx = t.xEnd * step;
      const my = t.yStart + (t.yEnd - t.yStart) * step;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + 10, my - 12);
      ctx.moveTo(-mx, my);
      ctx.lineTo(-mx - 10, my - 12);
      ctx.stroke();
    }
  }

  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;

  return { texture, alphaTest: 0.35 };
}
