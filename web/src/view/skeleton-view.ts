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

interface Frame3D {
  u: THREE.Vector3;
  v: THREE.Vector3;
  t: THREE.Vector3;
}

/**
 * 沿样条切线平滑平行输运 (Parallel Transport / Bishop Frame)
 * 数学上严格保证绕主轴角速度为 0，绝对杜绝任何万向节翻转与沙漏扭拧！
 */
function parallelTransport(frame: Frame3D, nextTangent: THREE.Vector3): Frame3D {
  const t1 = frame.t.clone().normalize();
  const t2 = nextTangent.clone().normalize();
  const axis = new THREE.Vector3().crossVectors(t1, t2);
  const sinA = axis.length();
  const cosA = t1.dot(t2);

  if (sinA < 1e-6) {
    return {
      u: frame.u.clone(),
      v: frame.v.clone(),
      t: t2,
    };
  }

  axis.normalize();
  const angle = Math.atan2(sinA, Math.max(-1.0, Math.min(1.0, cosA)));
  const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);

  const uNext = frame.u.clone().applyQuaternion(q).normalize();
  const vNext = new THREE.Vector3().crossVectors(t2, uNext).normalize();

  return {
    u: uNext,
    v: vNext,
    t: t2,
  };
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
    this.barkSet.trunkBark.side = THREE.DoubleSide;
    this.barkSet.primaryBark.side = THREE.DoubleSide;
    this.barkSet.twigBark.side = THREE.DoubleSide;

    // 2. 真实夏栎波浪圆齿羽裂单叶 (带蜡质角质层高光与背光半透明)
    const { texture: leafTex, alphaTest } = createOakLeafAtlas();
    this.leafMaterial = new THREE.MeshStandardMaterial({
      map: leafTex,
      transparent: true,
      alphaTest: alphaTest,
      roughness: 0.35, // 植物角质层微弱蜡质光泽
      metalness: 0.02,
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide,
    });

    // 预构建标准夏栎微卷立体单叶网格 (法向朝天，叶柄在原点，中脉微凹，长 5.2cm × 宽 3.2cm)
    this.leafGeometry = this.createFlatOakLeafGeometry(0.032, 0.052);
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
        // leafGeometry 复用无需清理
      }
    }
    this.treeGroup.add(this.foliageGroup);

    const segments = this.parseSegmentsBuffer(buffer);
    if (segments.length === 0) return;

    // 构建段间拓扑邻接图
    const segMap = new Map<number, TreeSegmentRenderData>();
    const childrenMap = new Map<number, TreeSegmentRenderData[]>();
    const parentMap = new Map<number, TreeSegmentRenderData>();

    for (const seg of segments) {
      segMap.set(seg.id, seg);
      childrenMap.set(seg.id, []);
    }

    for (const seg of segments) {
      for (const candidate of segments) {
        if (candidate.id !== seg.id && candidate.end.distanceToSquared(seg.start) < 1e-4) {
          parentMap.set(seg.id, candidate);
          childrenMap.get(candidate.id)?.push(seg);
          break;
        }
      }
    }

    // 寻找直系主轴延续子节点 (Continuation Child)，确定主干与各大枝条的主轴走向
    const continuationChildMap = new Map<number, TreeSegmentRenderData | null>();
    for (const seg of segments) {
      const children = childrenMap.get(seg.id) ?? [];
      let contChild: TreeSegmentRenderData | null = null;
      if (children.length > 0) {
        // 优先同 order 作为延续
        contChild = children.find((c) => c.order === seg.order) ?? null;
        if (!contChild && seg.order === 0) {
          // 主干顶端延续
          const sorted = [...children].sort((a, b) => a.order - b.order);
          contChild = sorted[0];
        } else if (!contChild && children.length === 1) {
          contChild = children[0];
        }
      }
      continuationChildMap.set(seg.id, contChild);
    }

    // 寻找根节点 (通常为 order 0 且 parent 为空)
    let rootSeg: TreeSegmentRenderData | null = null;
    for (const seg of segments) {
      if (seg.order === 0 && !parentMap.has(seg.id)) {
        rootSeg = seg;
        break;
      }
    }
    if (!rootSeg) {
      rootSeg = segments[0];
    }

    // ===== 全局平行输运标架传播 (Hierarchical Bishop Frame Propagation) =====
    // 存储每个 segment 起点与终点的标架和半径，确保直系相邻段 100% 无缝重合！
    interface SegmentSplineState {
      startFrame: Frame3D;
      endFrame: Frame3D;
      startRadius: number;
      endRadius: number;
    }
    const splineStateMap = new Map<number, SegmentSplineState>();

    // 递归自顶向下计算标架
    const processBranchSpine = (seg: TreeSegmentRenderData, incomingFrame: Frame3D, incomingRadius: number) => {
      let currentSeg: TreeSegmentRenderData | null = seg;
      let curFrame = incomingFrame;
      let curRadius = incomingRadius;

      while (currentSeg) {
        const pStart = currentSeg.start.clone();
        const pEnd = currentSeg.end.clone();
        const dir = new THREE.Vector3().subVectors(pEnd, pStart).normalize();

        // 平行输运得到当前段起点的无扭标架
        const startFrame = parallelTransport(curFrame, dir);

        // 确定终点半径
        const contChild: TreeSegmentRenderData | null = continuationChildMap.get(currentSeg.id) ?? null;

        let endRadius: number;
        if (contChild) {
          // 直系延续段：终点半径平滑过渡到子段
          endRadius = contChild.radius;
        } else {
          // 末梢梢头：Order 3 及以上小细枝精准收窄至 3.5mm 真实微细尺度
          endRadius = currentSeg.order >= 3 ? 0.0035 : currentSeg.radius * 0.70;
        }

        // 沿当前段平行输运至终点
        const endFrame = parallelTransport(startFrame, dir);

        splineStateMap.set(currentSeg.id, {
          startFrame,
          endFrame,
          startRadius: curRadius,
          endRadius,
        });

        // 遍历所有从当前段端点萌发的侧枝 (Lateral Side Branches)
        const allChildren = childrenMap.get(currentSeg.id) ?? [];
        for (const child of allChildren) {
          if (child.id !== contChild?.id) {
            // 侧枝从母枝终点处萌发，继承母枝终点的标架并平滑旋转至侧枝走向
            const childDir = new THREE.Vector3().subVectors(child.end, child.start).normalize();
            const childInitFrame = parallelTransport(endFrame, childDir);
            // 侧枝基部赋予木栓质枝领膨大
            const branchCollarRadius = child.radius * 1.35;
            processBranchSpine(child, childInitFrame, branchCollarRadius);
          }
        }

        // 沿直系延续段继续向前
        if (contChild) {
          currentSeg = contChild;
          curFrame = endFrame;
          curRadius = endRadius;
        } else {
          currentSeg = null;
        }
      }
    };

    // 初始化根节点初始正交基
    const rootDir = new THREE.Vector3().subVectors(rootSeg.end, rootSeg.start).normalize();
    let rootRef = new THREE.Vector3(0, 0, 1);
    if (Math.abs(rootDir.dot(rootRef)) > 0.85) {
      rootRef = new THREE.Vector3(1, 0, 0);
    }
    const rootU = new THREE.Vector3().crossVectors(rootDir, rootRef).normalize();
    const rootV = new THREE.Vector3().crossVectors(rootDir, rootU).normalize();
    const initialRootFrame: Frame3D = { u: rootU, v: rootV, t: rootDir };

    // 根盘出土部苍老稳健喇叭口膨大
    const rootBaseRadius = rootSeg.radius * 1.35;
    processBranchSpine(rootSeg, initialRootFrame, rootBaseRadius);

    // 兜底补全未被遍历到的独立孤立分支
    for (const seg of segments) {
      if (!splineStateMap.has(seg.id)) {
        const dir = new THREE.Vector3().subVectors(seg.end, seg.start).normalize();
        let ref = new THREE.Vector3(0, 1, 0);
        if (Math.abs(dir.y) > 0.85) ref = new THREE.Vector3(1, 0, 0);
        const u = new THREE.Vector3().crossVectors(dir, ref).normalize();
        const v = new THREE.Vector3().crossVectors(dir, u).normalize();
        const f: Frame3D = { u, v, t: dir };
        splineStateMap.set(seg.id, {
          startFrame: f,
          endFrame: f,
          startRadius: seg.radius,
          endRadius: seg.order >= 3 ? 0.0035 : seg.radius * 0.75,
        });
      }
    }

    // ===== 生成每个节段的无缝流形三维网格 =====
    for (const seg of segments) {
      const parentSeg = parentMap.get(seg.id) ?? null;
      const contChild = continuationChildMap.get(seg.id) ?? null;
      const splineState = splineStateMap.get(seg.id)!;

      const mesh = this.createContinuousSegmentMesh(seg, parentSeg, contChild, splineState);
      this.segmentMeshes.set(seg.id, mesh);
      this.interactiveMeshes.push(mesh);
      this.treeGroup.add(mesh);

      // 仅在真实末梢细枝梢头挂载平展向阳微拱枝托云片 (细枝真正深穿入云托内部)
      const children = childrenMap.get(seg.id) ?? [];
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
   * 生成无扭绞连续样条放样网格 (Continuous Spline Mesh)
   * 1. 严格使用 Bishop 输运正交基，彻底杜绝沙漏掐脖子；
   * 2. 侧枝深埋入母干木质部内部，废除外露斜切面；
   * 3. 根底深埋闭合，俯视 100% 封闭实心老木；
   * 4. 梢头末梢平滑闭合为卵形顶芽 (Ovoid Bud)，彻底消除截肢香肠粗头。
   */
  private createContinuousSegmentMesh(
    seg: TreeSegmentRenderData,
    parentSeg: TreeSegmentRenderData | null,
    continuationChild: TreeSegmentRenderData | null,
    splineState: { startFrame: Frame3D; endFrame: Frame3D; startRadius: number; endRadius: number }
  ): THREE.Mesh {
    const isRootBase = seg.order === 0 && !parentSeg;
    const isSideBranch = parentSeg !== null && (seg.order > parentSeg.order || (parentSeg.order === 0 && seg.order > 0));

    const pStart = seg.start.clone();
    const pEnd = seg.end.clone();
    const dir = new THREE.Vector3().subVectors(pEnd, pStart).normalize();

    if (isRootBase) {
      // 主干最基底向下深埋至土丘深处 (y=0.10)，稳健扎根
      pStart.y = 0.10;
    } else if (isSideBranch && parentSeg) {
      // 侧分枝起点深埋入母枝髓心内部 85% 母枝半径，杜绝截面戳出
      const parentRadius = parentSeg.radius;
      pStart.addScaledVector(dir, -parentRadius * 0.85);
    }

    const radialSegments = 24;
    const lengthSlices = 5;

    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // 沿段内样条切线平滑平行输运正交基
    let curFrame = splineState.startFrame;
    const frameSlices: Frame3D[] = [curFrame];

    for (let slice = 1; slice <= lengthSlices; slice++) {
      curFrame = parallelTransport(curFrame, dir);
      frameSlices.push(curFrame);
    }

    for (let slice = 0; slice <= lengthSlices; slice++) {
      const t = slice / lengthSlices;
      const center = new THREE.Vector3().lerpVectors(pStart, pEnd, t);
      const f = frameSlices[slice];

      // 半径非线性平滑收尖放样
      let curRadius = THREE.MathUtils.lerp(splineState.startRadius, splineState.endRadius, t);

      // 侧枝基部木栓枝领在第 0~1 环保留隆起，随后平滑过渡
      if (isSideBranch && t < 0.35) {
        const collarBlend = Math.cos(t * Math.PI / 0.35 * 0.5);
        curRadius = Math.max(curRadius, seg.radius * (1.0 + 0.35 * collarBlend));
      }

      for (let j = 0; j <= radialSegments; j++) {
        const theta = (j / radialSegments) * Math.PI * 2;
        let flute = 1.0;
        if (seg.order === 0) {
          // 古老夏栎主干特有的纵向木栓质厚实筋肋
          flute = 1.0 + 0.05 * (1.0 - t * 0.4) * Math.cos(5 * theta) + 0.02 * Math.sin(3 * theta);
        }

        const effRadius = curRadius * flute;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        const vx = center.x + (cosT * f.u.x + sinT * f.v.x) * effRadius;
        const vy = center.y + (cosT * f.u.y + sinT * f.v.y) * effRadius;
        const vz = center.z + (cosT * f.u.z + sinT * f.v.z) * effRadius;

        vertices.push(vx, vy, vz);

        const nx = cosT * f.u.x + sinT * f.v.x;
        const ny = cosT * f.u.y + sinT * f.v.y;
        const nz = cosT * f.u.z + sinT * f.v.z;
        normals.push(nx, ny, nz);

        // UV 坐标沿主干连续滚动展开
        uvs.push(j / radialSegments, seg.id + t * 0.85);
      }
    }

    // 缝合圆柱侧壁四边形 (拆分为两个三角形)
    for (let slice = 0; slice < lengthSlices; slice++) {
      for (let j = 0; j < radialSegments; j++) {
        const row1 = slice * (radialSegments + 1);
        const row2 = (slice + 1) * (radialSegments + 1);
        indices.push(row1 + j, row2 + j, row1 + j + 1);
        indices.push(row1 + j + 1, row2 + j, row2 + j + 1);
      }
    }

    // 1. 树干基底深埋实心底盖 (Solid Bottom Cap) - 彻底消灭俯视空心烟囱！
    if (isRootBase) {
      const bottomCenterIndex = vertices.length / 3;
      vertices.push(pStart.x, pStart.y - 0.005, pStart.z);
      normals.push(0, -1, 0);
      uvs.push(0.5, 0.0);

      for (let j = 0; j < radialSegments; j++) {
        indices.push(bottomCenterIndex, j, j + 1);
      }
    }

    // 2. 梢头平滑闭合卵形顶芽 (Ovoid Terminal Bud) - 彻底消灭截肢香肠粗头！
    if (!continuationChild) {
      const tipCenterIndex = vertices.length / 3;
      // 芽苞向前微微延伸 4.5mm
      const budTipPos = pEnd.clone().addScaledVector(dir, 0.0045);
      vertices.push(budTipPos.x, budTipPos.y, budTipPos.z);
      normals.push(dir.x, dir.y, dir.z);
      uvs.push(0.5, seg.id + 1.0);

      const lastRow = lengthSlices * (radialSegments + 1);
      for (let j = 0; j < radialSegments; j++) {
        indices.push(lastRow + j, tipCenterIndex, lastRow + j + 1);
      }
    }

    // 注意：侧枝起点深埋在母枝髓心内部，绝不生成外露平底盖，彻底消除戳出截面！

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
   * 生成标准夏栎立体微卷单叶几何体
   * - 叶柄锚定于原点 (0, 0, 0)
   * - 叶尖朝向 +Z 轴延伸
   * - 叶面朝天 +Y 迎向天光
   * - 具微凹中脉与微拱微垂立体曲率
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

        // 自然微观立体曲度：中脉微凹，叶尖微垂，叶缘微舒展
        const midribDist = Math.abs(u - 0.5) * 2.0;
        const midribCup = (1.0 - Math.pow(midribDist, 2)) * -0.003;
        const tipDroop = -Math.pow(v, 2) * 0.007;
        const y = midribCup + tipDroop;

        vertices.push(x, y, z);
        normals.push(0, 1, 0);
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
   * 1:1 还原参考名品夏栎“枝穿入托、三层叠翠、致密向阳”的饱满枝托云片：
   * 彻底根除半空中漂浮的单薄碎屑！
   * 细梢端点真正深入云托中央，48 片叶以三层叠瓦致密包裹细梢，内层紧贴木质部萌生彻底遮挡枝头！
   */
  private attachOakFoliagePad(seg: TreeSegmentRenderData): void {
    const leafCount = 48; // 致密饱满的云托密度
    const padRadiusX = 0.16; // 紧凑适度，紧紧凝聚于枝头
    const padRadiusZ = 0.13;

    const branchDir = new THREE.Vector3().subVectors(seg.end, seg.start).normalize();
    // 枝托中心就是细梢顶端节点，树枝真正穿入云托内部！
    const padCenter = seg.end.clone();

    // 水平枝托正交基向量
    const up = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3().crossVectors(branchDir, up).normalize();
    if (right.lengthSq() < 0.05) {
      right = new THREE.Vector3(1, 0, 0);
    }
    const forward = new THREE.Vector3().crossVectors(right, up).normalize();

    // 三层致密叠瓦分布：
    // Tier 0 (内层丛生，覆盖细梢木质部与顶芽): i < 14
    // Tier 1 (中层向阳展开): 14 <= i < 34
    // Tier 2 (外缘微垂舒展): 34 <= i < 48
    for (let i = 0; i < leafCount; i++) {
      let distRatio: number;
      let tierHeight: number;

      if (i < 14) {
        // 内层：贴近细梢端头，彻底遮盖木质部顶芽
        distRatio = 0.03 + Math.sqrt(Math.random()) * 0.35;
        tierHeight = 0.003 + (Math.random() - 0.5) * 0.008;
      } else if (i < 34) {
        // 中层：向外水平平展铺开
        distRatio = 0.30 + Math.sqrt(Math.random()) * 0.45;
        tierHeight = 0.015 + (Math.random() - 0.5) * 0.008;
      } else {
        // 外缘层：向边缘微拱微垂
        distRatio = 0.65 + Math.sqrt(Math.random()) * 0.35;
        tierHeight = 0.006 - Math.pow(distRatio, 2) * 0.015;
      }

      const angle = (i * Math.PI * 2) / 14 + (Math.random() - 0.5) * 0.35;
      const offsetX = Math.cos(angle) * padRadiusX * distRatio;
      const offsetZ = Math.sin(angle) * padRadiusZ * distRatio;

      const leafPos = padCenter.clone()
        .addScaledVector(right, offsetX)
        .addScaledVector(forward, offsetZ)
        .add(new THREE.Vector3(0, tierHeight, 0));

      const leafMesh = new THREE.Mesh(this.leafGeometry, this.leafMaterial);
      leafMesh.position.copy(leafPos);

      // 单叶朝向：叶柄在内，叶尖沿径向向外展开
      let outwardDir: THREE.Vector3;
      if (Math.hypot(offsetX, offsetZ) > 0.01) {
        outwardDir = new THREE.Vector3()
          .addScaledVector(right, offsetX)
          .addScaledVector(forward, offsetZ)
          .normalize();
      } else {
        outwardDir = branchDir.clone();
      }

      const yawAngle = Math.atan2(outwardDir.x, outwardDir.z) + (Math.random() - 0.5) * 0.25;
      leafMesh.rotation.y = yawAngle;

      // 叠加向阳微仰角与叶尖微垂微拱 (绝不垂直立起)
      leafMesh.rotation.x = 0.12 + Math.random() * 0.10; // 俯倾 7°~12°
      leafMesh.rotation.z = (Math.random() - 0.5) * 0.10; // 侧向微卷 ±3°

      const scale = 0.95 + Math.random() * 0.18;
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
