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
      roughness: 0.35,
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

    // 计算各子树深度 (Subtree Depth Memo)，用于最深主轴连续性判定
    const depthMemo = new Map<number, number>();
    const getSubtreeDepth = (segId: number): number => {
      if (depthMemo.has(segId)) return depthMemo.get(segId)!;
      const children = childrenMap.get(segId) ?? [];
      if (children.length === 0) {
        depthMemo.set(segId, 1);
        return 1;
      }
      let maxD = 0;
      for (const child of children) {
        maxD = Math.max(maxD, getSubtreeDepth(child.id));
      }
      const d = maxD + 1;
      depthMemo.set(segId, d);
      return d;
    };

    // ===== 最深主轴连续性判定 (Deepest-Spine Continuation) =====
    // 彻底杜绝在粗枝分叉处将粗干截断成滑稽火箭头！
    const continuationChildMap = new Map<number, TreeSegmentRenderData | null>();
    for (const seg of segments) {
      const children = childrenMap.get(seg.id) ?? [];
      let contChild: TreeSegmentRenderData | null = null;

      if (children.length > 0) {
        const dirParent = new THREE.Vector3().subVectors(seg.end, seg.start).normalize();

        // 排序规则：
        // 1. 同级 order 优先 (直系延续)；
        // 2. 否则按子树深度从深到浅排列 (主干通向最深微梢)；
        // 3. 深度相同时按夹角偏角从直向到斜向排列 (选偏角最小者)。
        const sorted = [...children].sort((a, b) => {
          const sameOrderA = a.order === seg.order ? 1 : 0;
          const sameOrderB = b.order === seg.order ? 1 : 0;
          if (sameOrderA !== sameOrderB) return sameOrderB - sameOrderA;

          const depthA = getSubtreeDepth(a.id);
          const depthB = getSubtreeDepth(b.id);
          if (depthA !== depthB) return depthB - depthA;

          const dirA = new THREE.Vector3().subVectors(a.end, a.start).normalize();
          const dirB = new THREE.Vector3().subVectors(b.end, b.start).normalize();
          return dirB.dot(dirParent) - dirA.dot(dirParent);
        });

        contChild = sorted[0];
      }
      continuationChildMap.set(seg.id, contChild);
    }

    // 寻找根节点 (order 0 且 parent 为空)
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

    // ===== 全局角平分标架与半径传播体系 =====
    interface SegmentSplineState {
      startFrame: Frame3D;
      endFrame: Frame3D;
      startRadius: number;
      endRadius: number;
    }
    const splineStateMap = new Map<number, SegmentSplineState>();

    // 自顶向下遍历骨架主轴并计算角平分无缝贴合标架
    const processBranchSpine = (seg: TreeSegmentRenderData, incomingFrame: Frame3D, incomingRadius: number) => {
      let currentSeg: TreeSegmentRenderData | null = seg;
      let curFrame = incomingFrame;
      let curRadius = incomingRadius;

      while (currentSeg) {
        const pStart = currentSeg.start.clone();
        const pEnd = currentSeg.end.clone();
        const dirCurr = new THREE.Vector3().subVectors(pEnd, pStart).normalize();

        // 沿当前段平行输运得到段中切线标架
        const midFrame = parallelTransport(curFrame, dirCurr);

        const contChild: TreeSegmentRenderData | null = continuationChildMap.get(currentSeg.id) ?? null;
        let endFrame: Frame3D;
        let endRadius: number;

        if (contChild) {
          // 直系延续段：在相交节点计算严格的角平分法向 N_miter = normalize(dirCurr + dirChild)
          // 彻底根除两段相互倾斜造成的阶梯断层与裂缝！
          const dirChild = new THREE.Vector3().subVectors(contChild.end, contChild.start).normalize();
          let miterNormal = new THREE.Vector3().addVectors(dirCurr, dirChild).normalize();
          if (miterNormal.lengthSq() < 1e-4) {
            miterNormal = dirCurr.clone();
          }

          endFrame = parallelTransport(midFrame, miterNormal);
          // 终点半径平滑过渡到延续子段
          endRadius = contChild.radius;
        } else {
          // 真正的末梢梢头：Order >= 2 细梢精准收窄至 3.5mm 真实微细尺度
          endFrame = parallelTransport(midFrame, dirCurr);
          endRadius = currentSeg.order >= 2 ? 0.0035 : currentSeg.radius * 0.65;
        }

        splineStateMap.set(currentSeg.id, {
          startFrame: curFrame,
          endFrame,
          startRadius: curRadius,
          endRadius,
        });

        // 递归遍历所有从当前段分出的侧向分枝 (Lateral Side Branches)
        const allChildren = childrenMap.get(currentSeg.id) ?? [];
        for (const child of allChildren) {
          if (child.id !== contChild?.id) {
            // 侧枝从母枝交接处萌生，继承当前节点标架并旋转至侧枝生长方向
            const childDir = new THREE.Vector3().subVectors(child.end, child.start).normalize();
            const childInitFrame = parallelTransport(endFrame, childDir);
            // 侧枝基部施加木栓质枝领膨大
            const branchCollarRadius = child.radius * 1.35;
            processBranchSpine(child, childInitFrame, branchCollarRadius);
          }
        }

        // 沿直系主轴无缝延续推进
        if (contChild) {
          currentSeg = contChild;
          // 子段起点标架与终点标架 100% 严格一致，顶点完全贴合！
          curFrame = endFrame;
          curRadius = endRadius;
        } else {
          currentSeg = null;
        }
      }
    };

    // 根节点初始正交基
    const rootDir = new THREE.Vector3().subVectors(rootSeg.end, rootSeg.start).normalize();
    let rootRef = new THREE.Vector3(0, 0, 1);
    if (Math.abs(rootDir.dot(rootRef)) > 0.85) {
      rootRef = new THREE.Vector3(1, 0, 0);
    }
    const rootU = new THREE.Vector3().crossVectors(rootDir, rootRef).normalize();
    const rootV = new THREE.Vector3().crossVectors(rootDir, rootU).normalize();
    const initialRootFrame: Frame3D = { u: rootU, v: rootV, t: rootDir };

    const rootBaseRadius = rootSeg.radius * 1.35;
    processBranchSpine(rootSeg, initialRootFrame, rootBaseRadius);

    // 兜底补全
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
          endRadius: seg.order >= 2 ? 0.0035 : seg.radius * 0.70,
        });
      }
    }

    // ===== 生成各节段无缝流形三维网格 =====
    for (const seg of segments) {
      const parentSeg = parentMap.get(seg.id) ?? null;
      const contChild = continuationChildMap.get(seg.id) ?? null;
      const splineState = splineStateMap.get(seg.id)!;

      const mesh = this.createContinuousSegmentMesh(seg, parentSeg, contChild, splineState);
      this.segmentMeshes.set(seg.id, mesh);
      this.interactiveMeshes.push(mesh);
      this.treeGroup.add(mesh);

      // 仅在真正的末梢细梢外缘挂载饱满向阳枝托云片，老干主枝露骨显苍！
      const children = childrenMap.get(seg.id) ?? [];
      if (children.length === 0 && seg.order >= 2) {
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
   * 生成角平分无缝贴合样条网格 (Miter Joint Spline Mesh)
   * 1. 严格使用角平分正交基，彻底消灭斜切阶梯裂痕与断层；
   * 2. 侧枝深潜入母干内部，彻底消灭空心吸管卷边；
   * 3. 根底深埋闭合，俯视 100% 封闭实心老木；
   * 4. 仅在真正的 3.5mm 细梢末端平滑闭合卵形微芽，彻底消除粗大火箭尖头。
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
      // 侧分枝起点深埋入母枝髓心内部 90% 母枝半径，杜绝吸管卷边与外露切面
      const parentRadius = parentSeg.radius;
      pStart.addScaledVector(dir, -parentRadius * 0.90);
    }

    const radialSegments = 24;
    const lengthSlices = 5;

    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // 从起点标架向终点角平分标架做平滑平行输运过渡
    const frameSlices: Frame3D[] = [];
    for (let slice = 0; slice <= lengthSlices; slice++) {
      const t = slice / lengthSlices;
      const sliceTangent = new THREE.Vector3().lerpVectors(splineState.startFrame.t, splineState.endFrame.t, t).normalize();
      const f = parallelTransport(splineState.startFrame, sliceTangent);
      frameSlices.push(f);
    }

    for (let slice = 0; slice <= lengthSlices; slice++) {
      const t = slice / lengthSlices;
      const center = new THREE.Vector3().lerpVectors(pStart, pEnd, t);
      const f = frameSlices[slice];

      // 半径沿样条平滑过渡
      let curRadius = THREE.MathUtils.lerp(splineState.startRadius, splineState.endRadius, t);

      // 侧枝基部木栓质枝领在第 0~1 环保留隆起萌发态
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

        uvs.push(j / radialSegments, seg.id + t * 0.85);
      }
    }

    // 缝合圆柱侧壁四边形
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

    // 2. 只有真正的最末梢小细枝 (Order >= 2 且无子节点) 才在 3.5mm 处收拢微芽！
    // 粗大枝干中途绝不封盖，100% 消除滑稽火箭头！
    if (!continuationChild && seg.order >= 2) {
      const tipCenterIndex = vertices.length / 3;
      // 微观夏栎卵形顶芽微微隆起 4mm
      const budTipPos = pEnd.clone().addScaledVector(dir, 0.004);
      vertices.push(budTipPos.x, budTipPos.y, budTipPos.z);
      normals.push(dir.x, dir.y, dir.z);
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
   * 生成标准夏栎立体微卷单叶几何体
   */
  private createFlatOakLeafGeometry(width: number, length: number): THREE.BufferGeometry {
    const nx = 4;
    const nz = 4;
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let iz = 0; iz <= nz; iz++) {
      const v = iz / nz;
      const z = v * length;

      for (let ix = 0; ix <= nx; ix++) {
        const u = ix / nx;
        const x = (u - 0.5) * width;

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
   * 1:1 还原名木夏栎“枝穿入托、三层叠翠、向阳饱满”的顶级枝托云片
   */
  private attachOakFoliagePad(seg: TreeSegmentRenderData): void {
    const leafCount = 48;
    const padRadiusX = 0.16;
    const padRadiusZ = 0.13;

    const branchDir = new THREE.Vector3().subVectors(seg.end, seg.start).normalize();
    const padCenter = seg.end.clone();

    const up = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3().crossVectors(branchDir, up).normalize();
    if (right.lengthSq() < 0.05) {
      right = new THREE.Vector3(1, 0, 0);
    }
    const forward = new THREE.Vector3().crossVectors(right, up).normalize();

    // 三层致密叠瓦分布
    for (let i = 0; i < leafCount; i++) {
      let distRatio: number;
      let tierHeight: number;

      if (i < 14) {
        // 内层：贴近细梢端头，紧密遮盖木质部
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

      leafMesh.rotation.x = 0.12 + Math.random() * 0.10;
      leafMesh.rotation.z = (Math.random() - 0.5) * 0.10;

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
          this.leafMaterial.color.setHex(0x65af38);
          break;
        case 'Summer':
          this.leafMaterial.color.setHex(0x3e8620);
          break;
        case 'Autumn':
          this.leafMaterial.color.setHex(0xb86f1e);
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
