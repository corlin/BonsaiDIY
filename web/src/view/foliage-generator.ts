import * as THREE from 'three';

export class FoliageGenerator {
  private leafTexture: THREE.CanvasTexture;
  private leafMaterial: THREE.MeshStandardMaterial;

  constructor() {
    this.leafTexture = this.createFoliageTexture();
    this.leafMaterial = new THREE.MeshStandardMaterial({
      map: this.leafTexture,
      transparent: true,
      alphaTest: 0.25,
      roughness: 0.6,
      metalness: 0.05,
      side: THREE.DoubleSide,
      color: 0x5b8c46, // 榆树清透温润的嫩绿
      shadowSide: THREE.DoubleSide,
    });
  }

  /**
   * 动态生成真实的细密小榆树叶片纹理贴图（透明通道带锯齿边缘与叶脉）
   */
  private createFoliageTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 256, 256);

    // 绘制若干簇优雅交错的单片小叶子
    const leafCount = 14;
    for (let i = 0; i < leafCount; i++) {
      const angle = (i * Math.PI * 2) / leafCount;
      const dist = 35 + Math.random() * 50;
      const cx = 128 + Math.cos(angle) * dist;
      const cy = 128 + Math.sin(angle) * dist;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle + Math.PI / 2 + (Math.random() - 0.5) * 0.4);

      // 绘制带叶尖与微锯齿的榆树叶片
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.bezierCurveTo(14, -14, 15, 12, 0, 22);
      ctx.bezierCurveTo(-15, 12, -14, -14, 0, -22);
      ctx.fillStyle = `rgb(${75 + Math.floor(Math.random() * 25)}, ${130 + Math.floor(Math.random() * 35)}, ${50 + Math.floor(Math.random() * 20)})`;
      ctx.fill();

      // 微弱中央主叶脉
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(0, 20);
      ctx.strokeStyle = 'rgba(160, 210, 110, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.restore();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * 在枝条梢头生成轻盈、透光且绝不遮挡骨架主干的细碎叶片片状交叉网格
   */
  public createFoliageCloud(center: THREE.Vector3, _radius: number): THREE.Group {
    const group = new THREE.Group();
    group.position.copy(center);

    // 尺寸严格约束在 0.12 - 0.16m，小巧点缀在梢头，透风透光
    const padSize = 0.14;
    const cardCount = 3;

    for (let i = 0; i < cardCount; i++) {
      const geom = new THREE.PlaneGeometry(padSize, padSize);
      const mesh = new THREE.Mesh(geom, this.leafMaterial.clone());

      // 各片微倾斜十字交叉，从任何角度看都通透轻盈
      const rotY = (i * Math.PI) / cardCount;
      const rotX = (Math.random() - 0.5) * 0.4;
      const rotZ = (Math.random() - 0.5) * 0.4;
      mesh.rotation.set(rotX, rotY, rotZ);

      // 微偏移避免共面闪烁
      mesh.position.set(
        (Math.random() - 0.5) * 0.04,
        (Math.random() - 0.5) * 0.03,
        (Math.random() - 0.5) * 0.04
      );

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    return group;
  }
}
