import * as THREE from 'three';

/**
 * 生成 1024×1024 欧洲夏栎 (Quercus robur) 矢量级单叶超清纹理
 * 特征：
 * 1. 5~6 对典型夏栎圆润波浪深裂片与耳状叶基 (Auriculate base)；
 * 2. 翡翠浓绿 (#3a781c) 到边缘向阳浅黄绿 (#7ec832) 的生机渐变；
 * 3. 鲜明浅黄绿色中主脉与放射状羽状侧脉深入每个波浪圆齿；
 * 4. 蜡质角质层高光光泽与背光半透光感。
 */
export function createOakLeafAtlas(): { texture: THREE.CanvasTexture; alphaTest: number } {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 1024, 1024);

  ctx.save();
  ctx.translate(512, 512);

  // 叶身渐变底色（叶心翡翠浓绿，叶缘向阳鲜亮嫩绿，透着日光黄绿）
  const grad = ctx.createRadialGradient(0, 0, 60, 0, 0, 440);
  grad.addColorStop(0, '#5fa82e');
  grad.addColorStop(0.55, '#4e9224');
  grad.addColorStop(0.85, '#3b7519');
  grad.addColorStop(1, '#2c5912');

  // 1. 真实夏栎波浪羽裂轮廓 (5~6对圆润裂片，比例完美放大两倍)
  ctx.beginPath();
  // 从叶柄基部起始 (顶部朝上 -Y，基部在 +Y)
  ctx.moveTo(0, 390);

  // 右侧边缘裂片 (由基部至叶尖)
  ctx.bezierCurveTo(36, 370, 52, 340, 44, 310);   // 基部耳状小裂片 (Auricle)
  ctx.bezierCurveTo(90, 300, 136, 260, 104, 210); // 第1裂片
  ctx.bezierCurveTo(160, 190, 190, 120, 136, 70); // 第2大裂片
  ctx.bezierCurveTo(180, 40, 196, -50, 130, -100);// 第3大裂片
  ctx.bezierCurveTo(150, -130, 156, -210, 96, -250); // 第4裂片
  ctx.bezierCurveTo(100, -280, 84, -340, 44, -364);  // 第5小裂片
  ctx.bezierCurveTo(24, -384, 12, -410, 0, -420);    // 圆润叶尖

  // 左侧对称但微有机扰动的羽裂边缘
  ctx.bezierCurveTo(-12, -420, -24, -384, -44, -364);
  ctx.bezierCurveTo(-84, -340, -100, -280, -96, -250);
  ctx.bezierCurveTo(-156, -210, -150, -130, -130, -100);
  ctx.bezierCurveTo(-196, -50, -180, 40, -136, 70);
  ctx.bezierCurveTo(-190, 120, -160, 190, -104, 210);
  ctx.bezierCurveTo(-136, 260, -90, 300, -44, 310);
  ctx.bezierCurveTo(-52, 340, -36, 370, 0, 390);
  ctx.closePath();

  ctx.fillStyle = grad;
  ctx.fill();

  // 边缘向阳黄绿透明微受光圈
  ctx.strokeStyle = 'rgba(175, 235, 85, 0.50)';
  ctx.lineWidth = 4.0;
  ctx.stroke();

  // 2. 真实主叶脉与侧叶脉系统
  // 主叶脉 (中轴贯通)
  ctx.beginPath();
  ctx.moveTo(0, 460); // 叶柄
  ctx.lineTo(0, -400);
  ctx.strokeStyle = 'rgba(205, 252, 135, 0.88)';
  ctx.lineWidth = 7.0;
  ctx.stroke();

  // 叶柄实底 (带木质红绿褐色)
  ctx.beginPath();
  ctx.moveTo(0, 460);
  ctx.lineTo(0, 370);
  ctx.strokeStyle = '#65822a';
  ctx.lineWidth = 10.0;
  ctx.stroke();

  // 侧叶脉（通向每个羽裂突出部）
  const lobeTargets = [
    { yStart: 280, xEnd: 100, yEnd: 230 },
    { yStart: 140, xEnd: 144, yEnd: 90 },
    { yStart: -20, xEnd: 144, yEnd: -80 },
    { yStart: -170,xEnd: 110, yEnd: -230 },
    { yStart: -300,xEnd: 60,  yEnd: -350 },
  ];

  ctx.strokeStyle = 'rgba(195, 248, 125, 0.62)';
  ctx.lineWidth = 4.2;
  for (const t of lobeTargets) {
    // 右侧主脉
    ctx.beginPath();
    ctx.moveTo(0, t.yStart);
    ctx.quadraticCurveTo(t.xEnd * 0.45, t.yStart - 10, t.xEnd, t.yEnd);
    ctx.stroke();

    // 左侧主脉
    ctx.beginPath();
    ctx.moveTo(0, t.yStart);
    ctx.quadraticCurveTo(-t.xEnd * 0.45, t.yStart - 10, -t.xEnd, t.yEnd);
    ctx.stroke();
  }

  // 3. 微观次级细网脉 (细微叶肉网络与受光感)
  ctx.strokeStyle = 'rgba(215, 255, 145, 0.22)';
  ctx.lineWidth = 1.8;
  for (const t of lobeTargets) {
    for (let step = 0.25; step < 0.95; step += 0.25) {
      const mx = t.xEnd * step;
      const my = t.yStart + (t.yEnd - t.yStart) * step;
      ctx.beginPath();
      ctx.moveTo(0, my);
      ctx.lineTo(mx + 20, my - 22);
      ctx.moveTo(0, my);
      ctx.lineTo(-mx - 20, my - 22);
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
