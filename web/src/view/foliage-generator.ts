import * as THREE from 'three';

export class FoliageGenerator {
  private leafMaterial: THREE.MeshStandardMaterial;

  constructor() {
    // 东方盆景松柏/榆树经典云片：温润翡翠墨绿，带微透光与柔和高光
    this.leafMaterial = new THREE.MeshStandardMaterial({
      color: 0x224929,
      roughness: 0.55,
      metalness: 0.08,
      flatShading: false, // 彻底关闭硬边破碎多边形，使用平滑法线
      side: THREE.DoubleSide,
    });
  }

  /**
   * 在末梢细枝生成轻盈、小巧、扁平透光的云片微托 (Bonsai Foliage Cloud)
   */
  public createFoliageCloud(center: THREE.Vector3, scale = 0.1): THREE.Group {
    const group = new THREE.Group();
    group.position.copy(center);

    // 精致的 3-4 片微型层叠薄片
    const padCount = 3;
    for (let i = 0; i < padCount; i++) {
      // 极小半径的多面体，压成极薄的水平小云片
      const geom = new THREE.IcosahedronGeometry(scale * (0.7 + i * 0.2), 2);
      geom.scale(1.4, 0.18, 1.1); // 极致扁平化，避免膨胀成面团

      const mesh = new THREE.Mesh(geom, this.leafMaterial.clone());
      const mat = mesh.material as THREE.MeshStandardMaterial;
      
      // 顶层微带初春/盛夏嫩黄微光，底层深沉
      mat.color.offsetHSL(
        0.02 * (i - 1),
        0.05,
        0.04 * (padCount - i)
      );

      // 上下错落但紧密聚拢在小枝周围
      mesh.position.set(
        (Math.random() - 0.5) * scale * 0.4,
        (i - 1) * scale * 0.15,
        (Math.random() - 0.5) * scale * 0.4
      );
      mesh.rotation.y = Math.random() * Math.PI;
      mesh.rotation.x = (Math.random() - 0.5) * 0.1;
      mesh.rotation.z = (Math.random() - 0.5) * 0.1;

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    return group;
  }
}
