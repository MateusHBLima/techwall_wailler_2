import * as THREE from 'three';
import { Wall } from './Wall.js';
import { Roof } from './Roof.js';

export class House {
    constructor(scene, data) {
        this.scene = scene;
        this.data = data;
        this.components = [];
        this.pieceMap = new Map();

        this.build();
    }

    build() {
        console.log('Building house components...');
        this.data.phases.forEach(phase => {
            console.log('Phase:', phase.name);
            phase.packages.forEach(pkg => {
                let component;
                if (phase.id === 'PHASE_WALLS') {
                    component = new Wall(pkg);
                    console.log('Created Wall:', pkg.id, 'at position:', pkg.position);
                } else if (phase.id === 'PHASE_ROOF') {
                    component = new Roof(pkg);
                    console.log('Created Roof:', pkg.id);
                }

                if (component) {
                    this.scene.add(component.mesh);
                    console.log('Added component to scene. Mesh children:', component.mesh.children.length);
                    this.components.push({ id: pkg.id, instance: component, type: phase.id });

                    if (component.modules) {
                        component.modules.forEach(m => this.pieceMap.set(m.id, m.instance));
                    }
                    if (component.pieces) {
                        component.pieces.forEach(p => this.pieceMap.set(p.id, p.mesh));
                    }
                }
            });
        });
        console.log('House built. Total components:', this.components.length);
        console.log('Scene children count:', this.scene.children.length);
    }

    setGhostMode(isGhost) {
        this.components.forEach(c => {
            if (c.instance.setGhost) {
                c.instance.setGhost(isGhost);
            }
        });
    }

    highlightPiece(pieceId) {
        this.pieceMap.forEach((obj) => {
            if (obj.setHighlight) obj.setHighlight(false);
            else if (obj.material && obj.userData.originalMaterial) obj.material = obj.userData.originalMaterial;
        });

        if (!pieceId) return;

        const target = this.pieceMap.get(pieceId);
        if (target) {
            if (target.setHighlight) {
                target.setHighlight(true);
            } else if (target.material) {
                if (!target.userData.originalMaterial) target.userData.originalMaterial = target.material;
                target.material.emissive = new THREE.Color(0x444400);
            }
        }
    }

    blinkPiece(pieceType) {
        // TODO: Implement blink
    }

    updateAssemblyState(currentPackageId, currentPieceIndex, allPackages) {
        let isPast = true;
        for (const pkg of allPackages) {
            const component = this.components.find(c => c.id === pkg.id);
            if (!component) continue;

            if (pkg.id === currentPackageId) {
                isPast = false;
                // Current Package: Mixed State
                pkg.pieces.forEach((piece, index) => {
                    const isVisible = index <= currentPieceIndex;
                    if (component.instance.setPieceGhost) {
                        component.instance.setPieceGhost(piece.id, !isVisible);
                    }
                });
            } else if (isPast) {
                // Completed: All Solid
                component.instance.setGhost(false);
            } else {
                // Future: All Ghost
                component.instance.setGhost(true);
            }
        }
    }

    getPackagePosition(packageId) {
        const component = this.components.find(c => c.id === packageId);
        if (component) {
            return component.instance.mesh.position.clone();
        }
        return new THREE.Vector3();
    }
}
