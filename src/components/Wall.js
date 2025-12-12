import * as THREE from 'three';
import { Module } from './Module.js';

export class Wall {
    constructor(packageData) {
        this.data = packageData;
        this.mesh = new THREE.Group();
        this.mesh.userData = {
            selectable: true,
            isInteractableRoot: true,
            id: this.data.id,
            type: 'wall'
        };
        this.modules = [];

        this.build();
    }

    build() {
        const { x, y, z } = this.data.position;
        this.mesh.position.set(x, y, z);

        const { x: rx, y: ry, z: rz } = this.data.rotation;
        this.mesh.rotation.set(rx, ry, rz);

        this.data.pieces.forEach(piece => {
            const module = new Module(piece.type);
            // Module pivot is center-bottom (0,0,0).
            // Wall pieces are 50cm wide.
            // If piece.x is 0, it occupies 0-50. Center is 25.
            module.mesh.position.set(piece.x + 25, piece.y, piece.z);

            this.mesh.add(module.mesh);
            this.modules.push({ id: piece.id, instance: module });
        });
    }

    setGhost(isGhost) {
        this.modules.forEach(m => m.instance.setGhost(isGhost));
    }

    setPieceGhost(pieceId, isGhost) {
        const module = this.modules.find(m => m.id === pieceId);
        if (module) {
            module.instance.setGhost(isGhost);
        }
    }
}
