import * as THREE from 'three';

export class Module {
    constructor(type, width = 50, height = 150, thickness = 9) {
        this.type = type;
        this.width = width;
        this.height = height;
        this.thickness = thickness;
        this.mesh = new THREE.Group();

        this.materials = {
            normal: new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
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
        if (this.type === 'panel_solid') {
            this.createBox(this.width, this.height, this.thickness, 0, this.height / 2, 0);
        } else if (this.type === 'panel_window') {
            // Bottom (Peitoril) - 50cm high
            this.createBox(this.width, 50, this.thickness, 0, 25, 0);
            // Top (Verga) - 50cm high, starts at 100cm
            this.createBox(this.width, 50, this.thickness, 0, 125, 0);
        } else if (this.type === 'panel_door') {
            // Top (Verga) - 50cm high, starts at 100cm
            this.createBox(this.width, 50, this.thickness, 0, 125, 0);
        }
    }

    createBox(w, h, d, x, y, z) {
        const geometry = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geometry, this.materials.normal);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Edges
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, this.edgeMaterial);
        mesh.add(line);

        this.mesh.add(mesh);
    }

    setGhost(isGhost) {
        this.mesh.children.forEach(child => {
            if (child.isMesh) {
                child.material = isGhost ? this.materials.ghost : this.materials.normal;
                // Keep edges visible in ghost mode for blueprint style
                const line = child.children.find(c => c.isLineSegments);
                if (line) line.visible = true; // Always visible
            }
        });
    }

    setHighlight(isHighlight) {
        this.mesh.children.forEach(child => {
            if (child.isMesh) {
                child.material = isHighlight ? this.materials.highlight : this.materials.normal;
            }
        });
    }
}
