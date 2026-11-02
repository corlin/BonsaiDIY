import * as THREE from 'three';

/**
 * 真实古老欧洲夏栎 (Aged Quercus robur) 沧桑皲裂老树皮材质
 * 特征：深邃纵向木栓裂纹 (Deep vertical furrows)、龟裂鳞片 (Corky bark plates)、
 * 沧桑风化灰褐色调与自然地衣微反光。
 */
export function createAgedOakBarkMaterial(): THREE.MeshStandardMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 1. 基底苍灰暗褐色
  ctx.fillStyle = '#3a332d';
  ctx.fillRect(0, 0, 512, 512);

  // 2. 纵向深槽木栓裂纹 (Deep Furrows)
  ctx.lineWidth = 4.0;
  ctx.strokeStyle = '#181410';
  for (let x = 12; x < 512; x += 24 + Math.random() * 12) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    let curX = x;
    for (let y = 16; y <= 512; y += 16) {
      curX += (Math.random() - 0.5) * 10;
      ctx.lineTo(curX, y);
    }
    ctx.stroke();
  }

  // 3. 次级龟裂纵纹与微细木纹
  ctx.strokeStyle = '#231d17';
  ctx.lineWidth = 2.0;
  for (let x = 4; x < 512; x += 12 + Math.random() * 8) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    let curX = x;
    for (let y = 20; y <= 512; y += 20) {
      curX += (Math.random() - 0.5) * 6;
      ctx.lineTo(curX, y);
    }
    ctx.stroke();
  }

  // 4. 横向断裂与鳞片翘起阴影 (Bark Plates)
  ctx.strokeStyle = '#1c1713';
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 180; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    const rlen = 15 + Math.random() * 35;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx + (Math.random() - 0.5) * 12, ry + rlen);
    ctx.stroke();
  }

  // 5. 凸起木栓质边缘的风化灰白与微地衣受光层 (Weathered Cork Highlights)
  for (let i = 0; i < 900; i++) {
    const alpha = Math.random() * 0.4 + 0.1;
    ctx.fillStyle = Math.random() > 0.4 ? `rgba(115, 105, 92, ${alpha})` : `rgba(145, 138, 120, ${alpha * 0.7})`;
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    ctx.fillRect(px, py, 3 + Math.random() * 5, 4 + Math.random() * 8);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.5, 4.0);

  return new THREE.MeshStandardMaterial({
    map: texture,
    color: 0x584f46, // 苍劲沧桑古灰褐
    roughness: 0.90,
    metalness: 0.04,
    bumpMap: texture,
    bumpScale: 0.055,
  });
}
