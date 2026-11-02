import * as THREE from 'three';
import { FoliageGenerator } from './foliage-generator';

export interface TreeSegmentRenderData {
  id: number;
  order: number;
  radius: number;
  start: THREE.Vector3;
  end: THREE.Vector3;
}

export class TreeRenderer {
  private barkMaterial: THREE.MeshStandardMaterial;
  private foliageGen: FoliageGenerator;
  public treeGroup: THREE.Group;
  public foliageGroup: THREE.Group;
  private segmentMeshes: Map<number, THREE.Mesh> = new Map();
  private interactiveMeshes: THREE.Mesh[] = [];
  private isSkeletonMode = false;
  private hoveredMesh: THREE.Mesh | null = null;
  private evidenceSegmentId: number | null = null;

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
    this.foliageGen = new FoliageGenerator();

    if (scene) {
      scene.add(this.treeGroup);
    }

    this.barkMaterial = new THREE.MeshStandardMaterial({
      color: 0x4f3728,
      roughness: 0.82,
      metalness: 0.05,
      flatShading: false,
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
    }
    this.treeGroup.add(this.foliageGroup);

    const segments = this.parseSegmentsBuffer(buffer);

    for (const seg of segments) {
      const mesh = this.createSegmentMesh(seg);
      this.segmentMeshes.set(seg.id, mesh);
      this.interactiveMeshes.push(mesh);
      this.treeGroup.add(mesh);

      // 分叉接缝平滑过渡
      const jointGeom = new THREE.SphereGeometry(seg.radius * 1.02, 16, 16);
      const joint = new THREE.Mesh(jointGeom, this.barkMaterial);
      joint.position.copy(seg.start);
      joint.userData = { isJoint: true, segmentId: seg.id, order: seg.order };
      joint.castShadow = true;
      this.interactiveMeshes.push(joint);
      this.treeGroup.add(joint);

      // 只有 Order >= 2 的细分末端枝条才点缀轻盈小云片
      if (seg.order >= 2) {
        const cloudScale = Math.min(0.12, Math.max(0.05, seg.radius * 2.5));
        const foliageCloud = this.foliageGen.createFoliageCloud(seg.end, cloudScale);
        this.foliageGroup.add(foliageCloud);
      }
    }

    this.applyDisplayMode();
  }

  private createSegmentMesh(seg: TreeSegmentRenderData): THREE.Mesh {
    const dir = new THREE.Vector3().subVectors(seg.end, seg.start);
    const len = dir.length();
    const normDir = dir.clone().normalize();

    const radiusBottom = seg.radius;
    const radiusTop = seg.radius * 0.82;
    const geom = new THREE.CylinderGeometry(radiusTop, radiusBottom, len, 20);

    const mesh = new THREE.Mesh(geom, this.barkMaterial.clone());
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

  private applyDisplayMode(): void {
    this.foliageGroup.visible = !this.isSkeletonMode;

    for (const mesh of this.segmentMeshes.values()) {
      if (this.isSkeletonMode) {
        const order = mesh.userData.order ?? 0;
        const color = this.orderColors[Math.min(order, this.orderColors.length - 1)];
        mesh.material = new THREE.MeshBasicMaterial({
          color,
          wireframe: false,
        });
      } else {
        mesh.material = this.barkMaterial.clone();
      }
    }
  }

  public getEvidenceHighlight(): number | null {
    return this.evidenceSegmentId;
  }

  public setEvidenceHighlight(segmentId: number | null): void {
    if (this.evidenceSegmentId && this.evidenceSegmentId !== segmentId) {
      const prev = this.segmentMeshes.get(this.evidenceSegmentId);
      if (prev && prev.material instanceof THREE.MeshStandardMaterial) {
        prev.material.emissive.setHex(0x000000);
        prev.material.emissiveIntensity = 0;
      }
    }
    this.evidenceSegmentId = segmentId;
  }

  public highlightSegment(segmentId: number | null): void {
    if (segmentId === null) {
      this.setHover(null);
      return;
    }
    const mesh = this.segmentMeshes.get(segmentId);
    this.setHover(mesh || null);
  }

  public updatePulse(timeSeconds: number): void {
    if (!this.evidenceSegmentId) return;
    const mesh = this.segmentMeshes.get(this.evidenceSegmentId);
    if (!mesh) return;

    const pulse = 0.5 + 0.5 * Math.sin(timeSeconds * 6.0);
    if (mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material.emissive.setHex(0xef4444);
      mesh.material.emissiveIntensity = 0.4 + pulse * 1.2;
    }
  }

  public setHover(mesh: THREE.Mesh | null): void {
    if (this.hoveredMesh === mesh) return;

    if (this.hoveredMesh && this.hoveredMesh.material instanceof THREE.MeshStandardMaterial) {
      this.hoveredMesh.material.emissive.setHex(0x000000);
      this.hoveredMesh.material.emissiveIntensity = 0;
    }

    this.hoveredMesh = mesh;
    if (this.hoveredMesh && this.hoveredMesh.material instanceof THREE.MeshStandardMaterial) {
      this.hoveredMesh.material.emissive.setHex(0x38bdf8);
      this.hoveredMesh.material.emissiveIntensity = 0.6;
    }
  }
}
