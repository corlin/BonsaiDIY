import * as THREE from 'three';

export interface BonsaiSegmentData {
  id: number;
  order: number;
  radius: number;
  start: THREE.Vector3;
  end: THREE.Vector3;
}

// Order-based color palette for Skeleton Perspective Mode
const SKELETON_ORDER_COLORS: number[] = [
  0xef4444, // Order 0: Trunk (Coral Red)
  0x3b82f6, // Order 1: Primary Branch (Vibrant Blue)
  0x10b981, // Order 2: Secondary Branch (Emerald Green)
  0xf59e0b, // Order 3: Tertiary Branch (Warm Amber)
  0x8b5cf6, // Order 4+: Fine Branchlet (Violet)
];

const ORGANIC_BARK_COLOR = 0x533d2c;
const ORGANIC_BRANCH_COLOR = 0x694f3b;

export class TreeRenderer {
  private parentScene: THREE.Scene;
  private treeGroup: THREE.Group;
  private spineGroup: THREE.Group;
  private segments: BonsaiSegmentData[] = [];
  private segmentMeshes: Map<number, THREE.Mesh[]> = new Map();
  private interactiveMeshes: THREE.Mesh[] = [];
  private isSkeletonMode: boolean = false;
  private hoveredSegmentId: number | null = null;
  private evidenceSegmentId: number | null = null;

  constructor(scene: THREE.Scene) {
    this.parentScene = scene;
    this.treeGroup = new THREE.Group();
    this.spineGroup = new THREE.Group();
    this.parentScene.add(this.treeGroup);
    this.parentScene.add(this.spineGroup);
  }

  /**
   * Unpacks Float32Array from WASM get_segments_buffer()
   * Stride = 9: [id, order, radius, sx, sy, sz, ex, ey, ez]
   */
  public parseSegmentsBuffer(buffer: Float32Array): BonsaiSegmentData[] {
    const segments: BonsaiSegmentData[] = [];
    const stride = 9;
    const count = Math.floor(buffer.length / stride);

    for (let i = 0; i < count; i++) {
      const offset = i * stride;
      segments.push({
        id: Math.round(buffer[offset]),
        order: Math.round(buffer[offset + 1]),
        radius: buffer[offset + 2],
        start: new THREE.Vector3(buffer[offset + 3], buffer[offset + 4], buffer[offset + 5]),
        end: new THREE.Vector3(buffer[offset + 6], buffer[offset + 7], buffer[offset + 8]),
      });
    }

    return segments;
  }

  /**
   * Rebuilds the 3D meshes from the WASM buffer
   */
  public updateTree(buffer: Float32Array): void {
    this.clear();
    this.segments = this.parseSegmentsBuffer(buffer);

    for (const seg of this.segments) {
      const meshes: THREE.Mesh[] = [];
      const dir = new THREE.Vector3().subVectors(seg.end, seg.start);
      const len = dir.length();
      if (len < 0.001) continue;

      const normDir = dir.clone().normalize();
      const mid = new THREE.Vector3().addVectors(seg.start, seg.end).multiplyScalar(0.5);

      // Branch Cylinder: natural taper towards the end
      const radiusBottom = Math.max(0.015, seg.radius);
      const radiusTop = Math.max(0.012, seg.radius * 0.82);
      const cylinderGeo = new THREE.CylinderGeometry(radiusTop, radiusBottom, len, 16);
      
      const mat = this.createSegmentMaterial(seg.order);
      const cylinderMesh = new THREE.Mesh(cylinderGeo, mat);
      
      // Orient cylinder: default Three.js cylinder is along Y-axis
      const up = new THREE.Vector3(0, 1, 0);
      const orientation = new THREE.Quaternion().setFromUnitVectors(up, normDir);
      cylinderMesh.quaternion.copy(orientation);
      cylinderMesh.position.copy(mid);
      cylinderMesh.castShadow = true;
      cylinderMesh.receiveShadow = true;

      // Attach user metadata for raycasting
      cylinderMesh.userData = {
        segmentId: seg.id,
        order: seg.order,
        radius: seg.radius,
        isBranch: true,
      };

      this.treeGroup.add(cylinderMesh);
      meshes.push(cylinderMesh);
      this.interactiveMeshes.push(cylinderMesh);

      // Node joint sphere for smooth branch forking
      const jointRadius = radiusBottom * 1.02;
      const jointGeo = new THREE.SphereGeometry(jointRadius, 12, 12);
      const jointMat = this.createSegmentMaterial(seg.order);
      const jointMesh = new THREE.Mesh(jointGeo, jointMat);
      jointMesh.position.copy(seg.start);
      jointMesh.castShadow = true;
      jointMesh.receiveShadow = true;
      jointMesh.userData = {
        segmentId: seg.id,
        order: seg.order,
        radius: seg.radius,
        isJoint: true,
      };

      this.treeGroup.add(jointMesh);
      meshes.push(jointMesh);
      this.interactiveMeshes.push(jointMesh);

      this.segmentMeshes.set(seg.id, meshes);
    }

    this.rebuildSpineVisuals();
  }

  /**
   * In skeleton mode, creates central glowing spine lines through each internode
   */
  private rebuildSpineVisuals(): void {
    // Clear old spine lines
    while (this.spineGroup.children.length > 0) {
      const child = this.spineGroup.children.pop();
      if (child && 'geometry' in child) {
        (child as THREE.Line).geometry.dispose();
      }
    }

    if (!this.isSkeletonMode) {
      this.spineGroup.visible = false;
      return;
    }

    this.spineGroup.visible = true;

    for (const seg of this.segments) {
      const points = [seg.start, seg.end];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const color = SKELETON_ORDER_COLORS[Math.min(seg.order, SKELETON_ORDER_COLORS.length - 1)];
      const lineMat = new THREE.LineBasicMaterial({
        color: color,
        linewidth: 2,
        transparent: true,
        opacity: 0.9,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      this.spineGroup.add(line);
    }
  }

  private createSegmentMaterial(order: number): THREE.MeshStandardMaterial {
    if (this.isSkeletonMode) {
      const color = SKELETON_ORDER_COLORS[Math.min(order, SKELETON_ORDER_COLORS.length - 1)];
      return new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.35,
        metalness: 0.1,
        transparent: true,
        opacity: 0.78,
      });
    } else {
      const baseColor = order === 0 ? ORGANIC_BARK_COLOR : ORGANIC_BRANCH_COLOR;
      return new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.88,
        metalness: 0.05,
      });
    }
  }

  /**
   * Toggles skeleton perspective mode
   */
  public setSkeletonMode(enabled: boolean): void {
    this.isSkeletonMode = enabled;
    for (const [id, meshes] of this.segmentMeshes.entries()) {
      const seg = this.segments.find(s => s.id === id);
      const order = seg ? seg.order : 0;
      for (const mesh of meshes) {
        mesh.material = this.createSegmentMaterial(order);
      }
    }
    this.rebuildSpineVisuals();
    if (this.hoveredSegmentId !== null) {
      this.highlightSegment(this.hoveredSegmentId);
    }
  }

  public getSkeletonMode(): boolean {
    return this.isSkeletonMode;
  }

  /**
   * Sets the segment ID identified as a rule diagnostic evidence issue.
   * This branch will pulse with an alert red warning emissive light.
   */
  public setEvidenceHighlight(segmentId: number | null): void {
    if (this.evidenceSegmentId !== null && this.evidenceSegmentId !== segmentId) {
      const prevMeshes = this.segmentMeshes.get(this.evidenceSegmentId);
      if (prevMeshes) {
        for (const m of prevMeshes) {
          const mat = m.material as THREE.MeshStandardMaterial;
          if (this.hoveredSegmentId === this.evidenceSegmentId) {
            mat.emissive.setHex(0x38bdf8);
            mat.emissiveIntensity = 0.6;
          } else {
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0.0;
          }
        }
      }
    }

    this.evidenceSegmentId = segmentId;

    if (segmentId !== null && segmentId !== this.hoveredSegmentId) {
      const currentMeshes = this.segmentMeshes.get(segmentId);
      if (currentMeshes) {
        for (const m of currentMeshes) {
          const mat = m.material as THREE.MeshStandardMaterial;
          mat.emissive.setHex(0xef4444);
          mat.emissiveIntensity = 0.7;
        }
      }
    }
  }

  public getEvidenceHighlight(): number | null {
    return this.evidenceSegmentId;
  }

  /**
   * Called per frame to animate the warning pulse of the evidence branch.
   */
  public updatePulse(timeSeconds: number): void {
    if (this.evidenceSegmentId === null) return;
    if (this.evidenceSegmentId === this.hoveredSegmentId) return;

    const meshes = this.segmentMeshes.get(this.evidenceSegmentId);
    if (!meshes) return;

    // Smooth pulse between 0.4 and 0.95 intensity
    const intensity = 0.65 + 0.35 * Math.sin(timeSeconds * 5.0);
    for (const m of meshes) {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(0xef4444);
      mat.emissiveIntensity = intensity;
    }
  }

  /**
   * Highlights or unhighlights a hovered segment
   */
  public highlightSegment(segmentId: number | null): void {
    // Restore previous hovered meshes
    if (this.hoveredSegmentId !== null && this.hoveredSegmentId !== segmentId) {
      const prevMeshes = this.segmentMeshes.get(this.hoveredSegmentId);
      if (prevMeshes) {
        for (const m of prevMeshes) {
          const mat = m.material as THREE.MeshStandardMaterial;
          if (this.hoveredSegmentId === this.evidenceSegmentId) {
            mat.emissive.setHex(0xef4444);
            mat.emissiveIntensity = 0.7;
          } else {
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0.0;
          }
        }
      }
    }

    this.hoveredSegmentId = segmentId;

    if (segmentId !== null) {
      const currentMeshes = this.segmentMeshes.get(segmentId);
      if (currentMeshes) {
        for (const m of currentMeshes) {
          const mat = m.material as THREE.MeshStandardMaterial;
          mat.emissive.setHex(0x38bdf8);
          mat.emissiveIntensity = 0.6;
        }
      }
    }
  }

  public getInteractiveMeshes(): THREE.Mesh[] {
    return this.interactiveMeshes;
  }

  public getSegmentCount(): number {
    return this.segments.length;
  }

  /**
   * Clears all segment meshes and geometries
   */
  public clear(): void {
    for (const mesh of this.interactiveMeshes) {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }

    while (this.treeGroup.children.length > 0) {
      this.treeGroup.remove(this.treeGroup.children[0]);
    }

    this.segmentMeshes.clear();
    this.interactiveMeshes = [];
    this.segments = [];
    this.hoveredSegmentId = null;
    this.evidenceSegmentId = null;
  }
}
