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
  private leafGeometry: THREE.BufferGeometry;
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
      roughness: 0.42, // 植物角质层蜡质光泽
      metalness: 0.02,
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide,
    });

    // 预构建标准夏栎微卷立体单叶网格 (法向恒定朝天 +Y，叶柄在原点，叶尖向 +Z 延伸)
    // 依据名品夏栎控叶尺度：长 5.5cm × 宽 3.4cm
    this.leafGeometry = this.createFlatOakLeafGeometry(0.034, 0.055);
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
        // leafGeometry 是共享复用的，无需在此单独 dispose
      }
    }
    this.treeGroup.add(this.foliageGroup);

    const segments = this.parseSegmentsBuffer(buffer);
    if (segments.length === 0) return;

    // 构建段间拓扑邻接图 (用于连续放样与端面法向对齐)
    const childrenMap = new Map<number, TreeSegmentRenderData[]>();
    const parentMap = new Map<number, TreeSegmentRenderData>();

    for (const seg of segments) {
      childrenMap.set(seg.id, []);
    }
    for (const seg of segments) {
      // 遍历寻找谁的 end 与当前 seg 的 start 吻合
      for (const candidate of segments) {
        if (candidate.id !== seg.id && candidate.end.distanceToSquared(seg.start) < 1e-4) {
          parentMap.set(seg.id, candidate);
          childrenMap.get(candidate.id)?.push(seg);
          break;
        }
      }
    }

    // 1. 构建无缝连续放样各级枝干几何网格 (彻底消除独立锯断截面与怪异关节大球)
    for (const seg of segments) {
      const parentSeg = parentMap.get(seg.id) ?? null;
      const children = childrenMap.get(seg.id) ?? [];
      const primaryChild = children.length > 0 ? children[0] : null;

      const mesh = this.createLoftedSegmentMesh(seg, parentSeg, primaryChild);
      this.segmentMeshes.set(seg.id, mesh);
      this.interactiveMeshes.push(mesh);
      this.treeGroup.add(mesh);

      // 仅在真实枝条末梢梢头挂载平展向阳微拱枝托云片 (避免在主干与主枝分叉处长出死板叶子)
      if (children.length === 0 && seg.order >= 1) {
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
   * 连续放样枝干网格 (Continuous Lofted Spline Segment)
   * 依据相邻节段夹角二等分线对齐两端横截面法向，实现 100% 无缝连接
   */
  private createLoftedSegmentMesh(
    seg: TreeSegmentRenderData,
    parentSeg: TreeSegmentRenderData | null,
    primaryChild: TreeSegmentRenderData | null
  ): THREE.Mesh {
    const pStart = seg.start;
    const pEnd = seg.end;
    const dirCurr = new THREE.Vector3().subVectors(pEnd, pStart).normalize();

    // 1. 起点截面法线
    let normStart: THREE.Vector3;
    if (parentSeg) {
      const dirParent = new THREE.Vector3().subVectors(parentSeg.end, parentSeg.start).normalize();
      normStart = new THREE.Vector3().addVectors(dirParent, dirCurr).normalize();
      if (normStart.lengthSq() < 0.1) normStart.copy(dirCurr);
    } else {
      // 树干基底根颈：水平贴地截面 (法向恒为 (0, 1, 0))
      normStart = new THREE.Vector3(0, 1, 0);
    }

    // 2. 终点截面法线
    let normEnd: THREE.Vector3;
    if (primaryChild) {
      const dirChild = new THREE.Vector3().subVectors(primaryChild.end, primaryChild.start).normalize();
      normEnd = new THREE.Vector3().addVectors(dirCurr, dirChild).normalize();
      if (normEnd.lengthSq() < 0.1) normEnd.copy(dirCurr);
    } else {
      normEnd = dirCurr.clone();
    }

    // 3. 截面半径放样
    let rStart = seg.radius;
    // 主干底部根盘喇叭口膨大 (Flare)
    if (seg.order === 0 && !parentSeg) {
      rStart = seg.radius * 1.35;
    }
    let rEnd = primaryChild ? primaryChild.radius : seg.radius * (seg.order === 0 ? 0.88 : 0.76);

    const radialSegments = 24;
    const lengthSlices = 3;

    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // 参考向上向量
    const refUp = new THREE.Vector3(0, 1, 0);

    for (let slice = 0; slice <= lengthSlices; slice++) {
      const t = slice / lengthSlices;
      const center = new THREE.Vector3().lerpVectors(pStart, pEnd, t);
      const ringNorm = new THREE.Vector3().lerpVectors(normStart, normEnd, t).normalize();

      // 构建截面正交基向量 (u, v)
      let uVec = new THREE.Vector3().crossVectors(ringNorm, refUp).normalize();
      if (uVec.lengthSq() < 0.05) {
        uVec = new THREE.Vector3().crossVectors(ringNorm, new THREE.Vector3(0, 0, 1)).normalize();
      }
      const vVec = new THREE.Vector3().crossVectors(ringNorm, uVec).normalize();

      // 半径插值与主干老树皮纵向苍劲筋肋 (Fluting)
      const curRadius = THREE.MathUtils.lerp(rStart, rEnd, t);

      for (let j = 0; j <= radialSegments; j++) {
        const theta = (j / radialSegments) * Math.PI * 2;
        let flute = 1.0;
        if (seg.order === 0) {
          // 老桩古栎特有的纵向筋肋隆起
          flute = 1.0 + 0.06 * (1.0 - t) * Math.cos(5 * theta) + 0.03 * Math.sin(3 * theta);
        }

        const effRadius = curRadius * flute;
        const vx = center.x + (Math.cos(theta) * uVec.x + Math.sin(theta) * vVec.x) * effRadius;
        const vy = center.y + (Math.cos(theta) * uVec.y + Math.sin(theta) * vVec.y) * effRadius;
        const vz = center.z + (Math.cos(theta) * uVec.z + Math.sin(theta) * vVec.z) * effRadius;

        vertices.push(vx, vy, vz);

        // 法线朝外
        const nx = Math.cos(theta) * uVec.x + Math.sin(theta) * vVec.x;
        const ny = Math.cos(theta) * uVec.y + Math.sin(theta) * vVec.y;
        const nz = Math.cos(theta) * uVec.z + Math.sin(theta) * vVec.z;
        normals.push(nx, ny, nz);

        uvs.push(j / radialSegments, seg.id + t * 0.8);
      }
    }

    // 缝合网格三角形
    for (let slice = 0; slice < lengthSlices; slice++) {
      for (let j = 0; j < radialSegments; j++) {
        const row1 = slice * (radialSegments + 1);
        const row2 = (slice + 1) * (radialSegments + 1);
        indices.push(row1 + j, row2 + j, row1 + j + 1);
        indices.push(row1 + j + 1, row2 + j, row2 + j + 1);
      }
    }

    // 若为末梢分支，将末端截面优雅缝合圆顶
    if (!primaryChild) {
      const tipCenterIndex = vertices.length / 3;
      vertices.push(pEnd.x + normEnd.x * rEnd * 0.4, pEnd.y + normEnd.y * rEnd * 0.4, pEnd.z + normEnd.z * rEnd * 0.4);
      normals.push(normEnd.x, normEnd.y, normEnd.z);
      uvs.push(0.5, seg.id + 1.0);

      const lastRow = lengthSlices * (radialSegments + 1);
      for (let j = 0; j < radialSegments; j++) {
        indices.push(lastRow + j, tipCenterIndex, lastRow + j + 1);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);

    const mat = this.getBarkMaterialForOrder(seg.order).clone();
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    mesh.userData = {
      segmentId: seg.id,
      order: seg.order,
      start: seg.start,
      end: seg.end,
      radius: seg.radius,
    };

    return mesh;
  }

  /**
   * 生成真正平展向阳的标准夏栎单叶网格
   * - 叶柄锚定于原点 (0, 0, 0)
   * - 叶尖朝向 +Z 轴延伸
   * - 叶面法向朝天 +Y = (0, 1, 0)
   * - 微凹中脉与微垂叶尖
   */
  private createFlatOakLeafGeometry(width: number, length: number): THREE.BufferGeometry {
    const nx = 4;
    const nz = 4;
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let iz = 0; iz <= nz; iz++) {
      const v = iz / nz; // 0 (叶柄) -> 1 (叶尖)
      const z = v * length;

      for (let ix = 0; ix <= nx; ix++) {
        const u = ix / nx; // 0 (左缘) -> 1 (右缘)
        const x = (u - 0.5) * width;

        // 自然叶片微观立体曲度：中脉微凹，叶尖微垂，叶缘微舒展
        const midribDist = Math.abs(u - 0.5) * 2.0; // 0 (中脉) -> 1 (边缘)
        const midribCup = (1.0 - Math.pow(midribDist, 2)) * -0.003;
        const tipDroop = -Math.pow(v, 2) * 0.008;
        const y = midribCup + tipDroop;

        vertices.push(x, y, z);
        normals.push(0, 1, 0);
        // UV 映射：v=0 为纹理底部叶柄，v=1 为纹理顶部叶尖
        uvs.push(u, 1.0 - v);
      }
    }

    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const row1 = iz * (nx + 1);
        const row2 = (iz + 1) * (nx + 1);
        indices.push(row1 + ix, row2 + ix, row1 + ix + 1);
        indices.push(row1 + ix + 1, row2 + ix, row2 + ix + 1);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    return geom;
  }

  /**
   * 1:1 还原参考图中的“水平叠瓦状微拱向阳实心枝托云片”：
   * 彻底消灭空心甜甜圈与垂直刀片！
   * 单叶从细梢中心无死区紧密向外辐射叠瓦，中心饱满厚实，边缘叶尖微垂微卷
   */
  private attachOakFoliagePad(seg: TreeSegmentRenderData): void {
    const leafCount = 34; // 丰满致密的经典名木枝托厚度
    const padRadiusX = 0.20;
    const padRadiusZ = 0.15;

    const branchDir = new THREE.Vector3().subVectors(seg.end, seg.start).normalize();
    // 枝托中心位于细梢端点偏外侧
    const padCenter = seg.end.clone().addScaledVector(branchDir, 0.035);

    // 水平枝托基向量
    const up = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3().crossVectors(branchDir, up).normalize();
    if (right.lengthSq() < 0.05) {
      right = new THREE.Vector3(1, 0, 0);
    }
    const forward = new THREE.Vector3().crossVectors(right, up).normalize();

    // 双层错落致密叠瓦状分布 (Bottom Tier & Top Tier)
    for (let i = 0; i < leafCount; i++) {
      const isTopTier = i >= 16;
      const tierHeight = isTopTier ? 0.022 : 0.002;
      const maxRadiusRatio = isTopTier ? 0.75 : 1.0;

      const angle = (i * Math.PI * 2) / (isTopTier ? 18 : 16) + (Math.random() - 0.5) * 0.35;
      // 彻底消除内圈死区：从中心 r=0 到边缘均匀致密覆盖
      const distRatio = Math.sqrt(Math.random()) * maxRadiusRatio;

      const offsetX = Math.cos(angle) * padRadiusX * distRatio;
      const offsetZ = Math.sin(angle) * padRadiusZ * distRatio;
      // 枝托整体微拱伞房状 (中心略微隆起，边缘自然微垂)
      const domeDrop = -Math.pow(distRatio, 2) * 0.014;

      const leafPos = padCenter.clone()
        .addScaledVector(right, offsetX)
        .addScaledVector(forward, offsetZ)
        .add(new THREE.Vector3(0, tierHeight + domeDrop, 0));

      const leafMesh = new THREE.Mesh(this.leafGeometry, this.leafMaterial);
      leafMesh.position.copy(leafPos);

      // 单叶朝向计算：
      // 叶尖沿径向向外展开，若在中心则沿分枝向前舒展
      let outwardDir: THREE.Vector3;
      if (Math.hypot(offsetX, offsetZ) > 0.015) {
        outwardDir = new THREE.Vector3()
          .addScaledVector(right, offsetX)
          .addScaledVector(forward, offsetZ)
          .normalize();
      } else {
        outwardDir = forward.clone();
      }

      const yawAngle = Math.atan2(outwardDir.x, outwardDir.z) + (Math.random() - 0.5) * 0.28;
      leafMesh.rotation.y = yawAngle;

      // 叠加向阳微仰角与叶尖微垂微拱 (绝不垂直立起)
      leafMesh.rotation.x = 0.10 + Math.random() * 0.12; // 俯倾 6°~13°
      leafMesh.rotation.z = (Math.random() - 0.5) * 0.12; // 侧向微卷 ±3.5°

      const scale = 0.94 + Math.random() * 0.18;
      leafMesh.scale.set(scale, scale, scale);

      leafMesh.castShadow = true;
      leafMesh.receiveShadow = true;
      this.foliageGroup.add(leafMesh);
    }
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
