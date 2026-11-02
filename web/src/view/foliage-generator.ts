import * as THREE from 'three';

export class FoliageGenerator {
  private leafMaterial: THREE.MeshStandardMaterial;

  constructor() {
    // 东方盆景经典的深墨绿微带翠色
    this.leafMaterial = new THREE.MeshStandardMaterial({
      color: 0x2e6b38,
      roughness: 0.65,
      metalness: 0.05,
      flatShading: true,
      side: THREE.DoubleSide,
    });
  }

  /**
   * 在枝条末梢生成有机、蓬松的云片状叶簇 (Foliage Cloud)
   */
  public createFoliageCloud(center: THREE.Vector3, scale = 0.25): THREE.Group {
    const group = new THREE.Group();
    group.position.copy(center);

    // 采用多个扁平的多面体簇组合成自然的日式/中式云片形态
    const cloudCount = 5;
    for (let i = 0; i < cloudCount; i++) {
      const geom = new THREE.DodecahedronGeometry(scale * (0.6 + Math.random() * 0.4), 1);
      // 压扁成椭球云片
      geom.scale(1.2, 0.45, 0.9);

      // 顶点微扰增加有机感
      const pos = geom.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        const vx = pos.getX(j);
        const vy = pos.getY(j);
        const vz = pos.getZ(j);
        const noise = (Math.sin(vx * 10) + Math.cos(vy * 10) + Math.sin(vz * 10)) * 0.03;
        pos.setXYZ(j, vx + noise, vy + noise, vz + noise);
      }
      geom.computeVertexNormals();

      const mesh = new THREE.Mesh(geom, this.leafMaterial.clone());
      // 微调各小叶块的明度，产生通透层次感
      (mesh.material as THREE.MeshStandardMaterial).color.offsetHSL(
        (Math.random() - 0.5) * 0.04,
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.08
      );

      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * scale * 0.8,
        (Math.random() - 0.3) * scale * 0.3,
        (Math.random() - 0.5) * scale * 0.8
      );
      mesh.position.copy(offset);
      mesh.rotation.set(
        (Math.random() - 0.5) * 0.3,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 0.3
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    return group;
  }
}
