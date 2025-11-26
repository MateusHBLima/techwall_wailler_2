import * as THREE from 'three';

export class Roof {
    constructor(packageData) {
        this.data = packageData;
        this.mesh = new THREE.Group();
        this.pieces = [];

        this.materials = {
            normal: new THREE.MeshStandardMaterial({ color: 0xcc6600, side: THREE.DoubleSide }), // Terracotta
            ghost: new THREE.MeshStandardMaterial({
                color: 0xE5E7EB, // Light gray
                transparent: true,
                opacity: 0.15,
                roughness: 0.1,
                depthWrite: false,
                side: THREE.DoubleSide
            }),
            highlight: new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0x444400 })
        };

        this.edgeMaterial = new THREE.LineBasicMaterial({
            color: 0x374151, // Dark gray
            transparent: true,
            opacity: 0.3
        });

        this.build();
    }

    build() {
        const { x, y, z } = this.data.position;
        this.mesh.position.set(x, y, z);

        const { x: rx, y: ry, z: rz } = this.data.rotation;
        this.mesh.rotation.set(rx, ry, rz);

        this.data.pieces.forEach(piece => {
            let geometry;

            if (piece.type === 'gable_half_left') {
                const shape = new THREE.Shape();
                shape.moveTo(0, 0);
                shape.lineTo(75, 0);
                shape.lineTo(75, 37.5);
                shape.lineTo(0, 0);
                geometry = new THREE.ExtrudeGeometry(shape, { depth: 9, bevelEnabled: false });
                geometry.translate(0, 0, -4.5);

            } else if (piece.type === 'gable_half_right') {
                const shape = new THREE.Shape();
                shape.moveTo(0, 0);
                shape.lineTo(75, 0);
                shape.lineTo(0, 37.5);
                shape.lineTo(0, 0);
                geometry = new THREE.ExtrudeGeometry(shape, { depth: 9, bevelEnabled: false });
                geometry.translate(0, 0, -4.5);
            } else if (piece.type.startsWith('roof_panel')) {
                geometry = new THREE.BoxGeometry(85, 2, 160);
            }

            if (geometry) {
                const mesh = new THREE.Mesh(geometry, this.materials.normal);
                mesh.position.set(piece.x, piece.y, piece.z);
                if (piece.rotY) mesh.rotation.y = piece.rotY;

                if (piece.type === 'roof_panel_left') {
                    // Left side slope - INVERTED ROTATION to form PEAK (A-shape)
                    mesh.rotation.z = 0.463648; // Changed from -0.463648 to positive
                    mesh.position.x += 40;
                    mesh.position.y += 20;
                    mesh.position.z += 75;
                } else if (piece.type === 'roof_panel_right') {
                    // Right side slope - INVERTED ROTATION to form PEAK (A-shape)
                    mesh.rotation.z = -0.463648; // Changed from +0.463648 to negative
                    mesh.position.x += 35;
                    mesh.position.y += 20;
                    mesh.position.z += 75;
                }

                mesh.castShadow = true;
                mesh.receiveShadow = true;

                // Add edge lines for blueprint style
                const edges = new THREE.EdgesGeometry(geometry);
                const line = new THREE.LineSegments(edges, this.edgeMaterial);
                mesh.add(line);

                this.mesh.add(mesh);
                this.pieces.push({ id: piece.id, mesh: mesh });
            }
        });
    }

    setGhost(isGhost) {
        this.pieces.forEach(p => {
            p.mesh.material = isGhost ? this.materials.ghost : this.materials.normal;
        });
    }

    setPieceGhost(pieceId, isGhost) {
        const piece = this.pieces.find(p => p.id === pieceId);
        if (piece) {
            piece.mesh.material = isGhost ? this.materials.ghost : this.materials.normal;
        }
    }
}
