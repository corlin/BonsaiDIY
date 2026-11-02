import * as THREE from 'three';
import { createOakLeafAtlas } from './oak-leaf-texture';
import { createAgedOakBarkMaterialSet, BarkMaterialSet } from './bark-material';

export interface TreeSegmentRenderData {
  id: number;
  order: number;
  radius: number;
  start: THREE.Vector3;
  end: THREE.Vector3;
}

export class TreeRenderer {
  private barkSet: BarkMaterialSet;
  private leafMaterial: THREE.MeshStandardMaterial;
  public treeGroup: THREE.Group;
  public foliageGroup: THREE.Group;
  private segmentMeshes: Map<number, THREE.Mesh> = new Map();
  private interactiveMeshes: THREE.Mesh[] = [];
  private isSkeletonMode = false;
  private evidenceSegmentId: number | null = null;
  private hoveredSegmentId: number | null = null;
  private currentSeason = 'Spring';

  private readonly orderColors: number[] = [
    0xef4444, // 0: 主干 (朱红)
    0x38bdf8, // 1: 一级主枝 (天青蓝)
    0x4ade80, // 2: 二级次枝 (碧翠绿)
    0xfbbf24, // 3: 细分侧枝 (金黄)
    0xa855f7, // 4+: 极细嫩梢 (紫罗兰)
  ];

  constructor(scene?: THREE.Scene) {
    this.treeGroup = new THREE.Group();
    this.foliageGroup = new THREE.Group();
    this.treeGroup.add(this.foliageGroup);

    if (scene) {
      scene.add(this.treeGroup);
    }

    // 1. 真实古老夏栎分级 PBR 树皮材质集 (老干深裂、主枝中裂、嫩枝紧致)
    this.barkSet = createAgedOakBarkMaterialSet();

    // 2. 真实夏栎波浪圆齿羽裂单叶 (带蜡质角质层高光与背光半透明)
    const { texture: leafTex, alphaTest } = createOakLeafAtlas();
    this.leafMaterial = new THREE.MeshStandardMaterial({
      map: leafTex,
      transparent: true,
      alphaTest: alphaTest,
      roughness: 0.42, // 植物角质层微弱蜡质光泽
      metalness: 0.02,
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide,
    });
  }

  public updateTree(buffer: Float32Array): void {
    this.rebuildFromBuffer(buffer);
  }

  public rebuildFromBuffer(buffer: Float32Array): void {
    this.segmentMeshes.clear();
    this.interactiveMeshes = [];

    while (this.treeGroup.children.length > 0) {
      const child = this.treeGroup.children[0];
      this.treeGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }
    while (this.foliageGroup.children.length > 0) {
      const child = this.foliageGroup.children[0];
      this.foliageGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }
    this.treeGroup.add(this.foliageGroup);

    const segments = this.parseSegmentsBuffer(buffer);

    // 1. 构建各级枝干几何网格
    for (const seg of segments) {
      const mesh = this.createSegmentMesh(seg);
      this.segmentMeshes.set(seg.id, mesh);
      this.interactiveMeshes.push(mesh);
      this.treeGroup.add(mesh);

      // 分叉节点接缝圆润过渡（消除生硬圆柱折角）
      const jointMat = this.getBarkMaterialForOrder(seg.order);
      const jointGeom = new THREE.SphereGeometry(seg.radius * 1.04, 16, 16);
      const joint = new THREE.Mesh(jointGeom, jointMat);
      joint.position.copy(seg.start);
      joint.userData = { isJoint: true, segmentId: seg.id, order: seg.order };
      joint.castShadow = true;
      joint.receiveShadow = true;
      this.interactiveMeshes.push(joint);
      this.treeGroup.add(joint);

      // 主干基底膨大根盘环 (Bulbous Fluted Base)
      if (seg.order === 0 && seg.id === 0) {
        const baseFluteGeom = new THREE.CylinderGeometry(seg.radius * 1.02, seg.radius * 1.48, 0.13, 28);
        const baseFlute = new THREE.Mesh(baseFluteGeom, this.barkSet.trunkBark);
        baseFlute.position.set(seg.start.x, seg.start.y - 0.05, seg.start.z);
        baseFlute.castShadow = true;
        baseFlute.receiveShadow = true;
        this.treeGroup.add(baseFlute);
      }

      // 仅在分枝侧枝与梢头（order >= 2）挂载微卷立体羽裂单叶枝托云片
      if (seg.order >= 2) {
        this.attachOakFoliagePad(seg);
      }
    }

    this.applyDisplayMode();
    this.applySeasonColors();
  }

  private getBarkMaterialForOrder(order: number): THREE.MeshStandardMaterial {
    if (order === 0) {
      return this.barkSet.trunkBark;
    } else if (order === 1) {
      return this.barkSet.primaryBark;
    } else {
      return this.barkSet.twigBark;
    }
  }

  /**
   * 1:1 还原参考图中的“水平微拱分层枝托云片”：
   * 采用 3×2 顶点微卷曲网格 (Curved Quad)，彻底消灭纸片感，展现生机勃勃的叶片张力
   */
  private attachOakFoliagePad(seg: TreeSegmentRenderData): void {
    const isTerminal = seg.order >= 3;
    const leafCount = isTerminal ? 24 : 18;
    const padRadiusX = isTerminal ? 0.22 : 0.18;
    const padRadiusZ = isTerminal ? 0.16 : 0.14;

    const branchDir = new THREE.Vector3().subVectors(seg.end, seg.start);
    const branchNorm = branchDir.clone().normalize();

    // 枝托中心位于梢头略偏外侧
    const padCenter = seg.end.clone().addScaledVector(branchNorm, 0.03);

    // 水平法向基向量
    const up = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3().crossVectors(branchNorm, up).normalize();
    if (right.lengthSq() < 0.01) {
      right = new THREE.Vector3(1, 0, 0);
    }
    const forward = new THREE.Vector3().crossVectors(right, up).normalize();

    // 单叶基准尺寸
    const leafWidth = 0.082;
    const leafLength = 0.135;

    for (let i = 0; i < leafCount; i++) {
      // 沿椭圆枝托微拱分布
      const angle = (i * Math.PI * 2) / leafCount + (Math.random() - 0.5) * 0.45;
      const distRatio = Math.sqrt(Math.random()) * 0.85 + 0.15;
      const offsetX = Math.cos(angle) * padRadiusX * distRatio;
      const offsetZ = Math.sin(angle) * padRadiusZ * distRatio;
      const offsetY = -Math.pow(distRatio, 2) * 0.025 + (Math.random() - 0.5) * 0.02;

      // 生成微卷立体网格 (3×2 细分顶点，中脉微凹，叶尖微垂)
      const geom = this.createCurvedLeafGeometry(leafWidth, leafLength);

      const leafMesh = new THREE.Mesh(geom, this.leafMaterial);

      // 3D 绝对空间位置
      const leafPos = padCenter.clone()
        .addScaledVector(right, offsetX)
        .addScaledVector(forward, offsetZ)
        .add(new THREE.Vector3(0, offsetY, 0));
      leafMesh.position.copy(leafPos);

      // 单叶 3D 朝向：叶尖向外展开，迎向日光 (仰角 15°~35°)
      leafMesh.lookAt(leafPos.clone().add(new THREE.Vector3(offsetX * 1.5, 0.18, offsetZ * 1.5)));
      leafMesh.rotateX(Math.PI / 2 - 0.35 + (Math.random() - 0.5) * 0.3);
      leafMesh.rotateZ((Math.random() - 0.5) * 0.35);

      const scale = 0.88 + Math.random() * 0.28;
      leafMesh.scale.set(scale, scale, scale);

      leafMesh.castShadow = true;
      leafMesh.receiveShadow = true;
      this.foliageGroup.add(leafMesh);
    }
  }

  /**
   * 生成 3×2 顶点微卷立体单叶网格
   * 中脉微凹、叶尖微垂，彻底打破死板平面感
   */
  private createCurvedLeafGeometry(width: number, length: number): THREE.BufferGeometry {
    const geom = new THREE.PlaneGeometry(width, length, 2, 2);
    geom.translate(0, length * 0.5, 0); // 锚点置于叶柄基部

    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);

      // 中脉纵深微凹弧度
      const midribCurve = (1.0 - Math.pow(x / (width * 0.5 + 1e-4), 2)) * -0.008;
      // 叶尖下垂弧度
      const tipDroop = Math.pow(y / length, 2) * -0.012;

      pos.setZ(i, midribCurve + tipDroop);
    }
    geom.computeVertexNormals();
    return geom;
  }

  private createSegmentMesh(seg: TreeSegmentRenderData): THREE.Mesh {
    const dir = new THREE.Vector3().subVectors(seg.end, seg.start);
    const len = dir.length();
    const normDir = dir.clone().normalize();

    // 自然渐进收尖 (Tapering)
    const radiusBottom = seg.radius;
    const radiusTop = seg.radius * (seg.order === 0 ? 0.88 : 0.82);
    const geom = new THREE.CylinderGeometry(radiusTop, radiusBottom, len, 24);

    const mat = this.getBarkMaterialForOrder(seg.order).clone();
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const mid = new THREE.Vector3().addVectors(seg.start, seg.end).multiplyScalar(0.5);
    mesh.position.copy(mid);

    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, normDir);
    mesh.quaternion.copy(quat);

    mesh.userData = {
      segmentId: seg.id,
      order: seg.order,
      start: seg.start,
      end: seg.end,
      radius: seg.radius,
    };

    return mesh;
  }

  public parseSegmentsBuffer(buffer: Float32Array): TreeSegmentRenderData[] {
    const stride = 9;
    const count = Math.floor(buffer.length / stride);
    const list: TreeSegmentRenderData[] = [];

    for (let i = 0; i < count; i++) {
      const offset = i * stride;
      list.push({
        id: Math.round(buffer[offset]),
        order: Math.round(buffer[offset + 1]),
        radius: buffer[offset + 2],
        start: new THREE.Vector3(buffer[offset + 3], buffer[offset + 4], buffer[offset + 5]),
        end: new THREE.Vector3(buffer[offset + 6], buffer[offset + 7], buffer[offset + 8]),
      });
    }
    return list;
  }

  public getInteractiveMeshes(): THREE.Mesh[] {
    return this.interactiveMeshes;
  }

  public getSkeletonMode(): boolean {
    return this.isSkeletonMode;
  }

  public setSkeletonMode(mode: boolean): void {
    this.isSkeletonMode = mode;
    this.applyDisplayMode();
  }

  public toggleSkeletonMode(): boolean {
    this.setSkeletonMode(!this.isSkeletonMode);
    return this.isSkeletonMode;
  }

  public setSeason(season: string): void {
    this.currentSeason = season;
    this.applySeasonColors();
  }

  private applySeasonColors(): void {
    if (this.currentSeason === 'Winter') {
      this.foliageGroup.visible = false;
    } else {
      this.foliageGroup.visible = !this.isSkeletonMode;
      switch (this.currentSeason) {
        case 'Spring':
          this.leafMaterial.color.setHex(0x65af38); // 鲜嫩黄绿新叶
          break;
        case 'Summer':
          this.leafMaterial.color.setHex(0x3e8620); // 浓密翡翠苍翠
          break;
        case 'Autumn':
          this.leafMaterial.color.setHex(0xb86f1e); // 温暖金褐红
          break;
      }
    }
  }

  private applyDisplayMode(): void {
    if (this.currentSeason === 'Winter') {
      this.foliageGroup.visible = false;
    } else {
      this.foliageGroup.visible = !this.isSkeletonMode;
    }

    for (const mesh of this.segmentMeshes.values()) {
      if (this.isSkeletonMode) {
        const order = mesh.userData.order ?? 0;
        const color = this.orderColors[Math.min(order, this.orderColors.length - 1)];
        mesh.material = new THREE.MeshBasicMaterial({
          color,
          wireframe: false,
        });
      } else {
        const order = mesh.userData.order ?? 0;
        mesh.material = this.getBarkMaterialForOrder(order).clone();
      }
    }
  }

  public setEvidenceHighlight(segmentId: number | null): void {
    this.evidenceSegmentId = segmentId;
    if (segmentId === null) {
      this.applyDisplayMode();
    }
  }

  public getEvidenceHighlight(): number | null {
    return this.evidenceSegmentId;
  }

  public highlightSegment(segmentId: number | null): void {
    if (this.hoveredSegmentId === segmentId) return;
    this.hoveredSegmentId = segmentId;
    if (segmentId !== null && this.evidenceSegmentId === null) {
      const mesh = this.segmentMeshes.get(segmentId);
      if (mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.emissive.setHex(0x382818);
      }
    } else if (segmentId === null && this.evidenceSegmentId === null) {
      this.applyDisplayMode();
    }
  }

  public updatePulse(elapsedSeconds: number): void {
    if (this.evidenceSegmentId === null) return;
    const mesh = this.segmentMeshes.get(this.evidenceSegmentId);
    if (!mesh) return;

    const pulse = 0.65 + 0.35 * Math.sin(elapsedSeconds * 8.0);
    const pulseColor = new THREE.Color(1.0, 0.25 * pulse, 0.05);

    if (mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material.emissive = pulseColor;
      mesh.material.emissiveIntensity = pulse * 1.5;
    } else if (mesh.material instanceof THREE.MeshBasicMaterial) {
      mesh.material.color = pulseColor;
    }
  }
}
