import * as THREE from 'three';
import { ProfileCatalog } from '../data/ProfileCatalog.js';

// Scale Factor: 1 unit = 1 CM. Input Data = MM.
const S = 0.1;

export class SteelPart {
    constructor(data) {
        this.data = data; // { id, profileId, length(mm), x(mm)... slope(%) }
        this.mesh = new THREE.Group();
        this.mesh.userData = {
            ...data,
            selectable: true,
            isPart: true
        };

        this.materials = {
            steel: new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide }),
            wall: new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.9, flatShading: true }),
            roof: new THREE.MeshStandardMaterial({ color: 0xcc4444, side: THREE.DoubleSide }),
            wood: new THREE.MeshStandardMaterial({ color: 0x8b4513 }),
            glass: new THREE.MeshStandardMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.6 }),
            ghost: new THREE.MeshStandardMaterial({ color: 0xcccccc, transparent: true, opacity: 0.3, depthWrite: false })
        };

        this.build();
    }

    build() {
        this.clear();

        const profile = ProfileCatalog[this.data.profileId];
        if (!profile) return;

        // Common Dimensions
        // Profile dimensions in MM, multiply by S (0.1) to get CM
        // Then scale to scene units (1 unit = ~3cm for good visibility)
        const SCENE_SCALE = 0.3; // Adjust this value to change overall size
        const w = (profile.width || 100) * S * SCENE_SCALE;  // Profile width
        const f = (profile.flange || 40) * S * SCENE_SCALE;  // Profile flange
        const len = (this.data.length || 300) * SCENE_SCALE; // Length in CM, scaled

        let mesh;

        // --- TYPE DISPATCH ---
        if (profile.type === 'box') {
            // GENERIC WALL / BLOCK
            // Dimensions expected in CM from data, converted to scene units consistently
            // Default dimensions: 280cm altura X 61cm largura X 10cm espessura
            const SCENE_SCALE = 0.3;

            // Espessura (X) - em CM, convertido para unidades de cena
            const thickness = (this.data.thickness !== undefined ? this.data.thickness : 10) * SCENE_SCALE;
            // Largura (Y) - em CM, convertido para unidades de cena
            const width = (this.data.width !== undefined ? this.data.width : 61) * SCENE_SCALE;
            // Altura (Z) - length em CM, convertido para unidades de cena
            const height = (this.data.length !== undefined ? this.data.length : 280) * SCENE_SCALE;

            console.log(`WALL_GENERIC dimensions: ${thickness.toFixed(2)} x ${width.toFixed(2)} x ${height.toFixed(2)} (scene units)`);
            console.log(`Original values: thickness=${this.data.thickness || 10}cm, width=${this.data.width || 61}cm, height=${this.data.length || 280}cm`);

            mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, width, height), this.materials.wall);

        } else if (profile.type === 'opening') {
            // DOOR / WINDOW
            const SCENE_SCALE = 0.3;
            const h = (profile.height || 2100) * S * SCENE_SCALE;
            const width = (profile.width || 800) * S * SCENE_SCALE;
            const depth = 15 * S * SCENE_SCALE; // Frame thickness

            const mat = profile.id.includes('WINDOW') ? this.materials.glass : this.materials.wood;
            mesh = new THREE.Mesh(new THREE.BoxGeometry(width, depth, h), mat);

            // Adjust pivots if needed. Currently center-based by BoxGeom.
            // Shift to verify ground alignment.
            mesh.position.y = h / 2; // Stand on ground?

        } else if (profile.type === 'plate') {
            // ROOF SANDWICH (ZigZag)
            const shape = new THREE.Shape();
            const waves = 5;
            const stride = w / waves;
            shape.moveTo(0, 0);
            for (let i = 0; i < waves; i++) {
                shape.lineTo(i * stride + stride / 2, f); // Peak
                shape.lineTo((i + 1) * stride, 0);      // Trough
            }

            const geo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
            mesh = new THREE.Mesh(geo, this.materials.roof);

        } else if (profile.type === 'notched_panel') {
            // TRAMA - NOTCHED PANEL (Painel Dentado)
            const SCENE_SCALE = 0.3;
            const panelLength = (this.data.length || 280) * SCENE_SCALE; // CM -> Scene
            const panelWidth = (profile.width || 610) * S * SCENE_SCALE; // mm -> scene
            const panelThickness = (profile.thickness || 90) * S * SCENE_SCALE; // mm -> scene

            // Calculate segment height proportionally (6 segments)
            const numSegments = 6;
            const segmentH = panelLength / numSegments;
            const notchD = (profile.notchDepth || 305) * S * SCENE_SCALE; // mm -> scene

            const isRight = profile.notchSide === 'RIGHT';
            const startWithTooth = profile.startPattern === 'TOOTH';

            // Build the shape in XZ plane (X = width, Z = height/length)
            const shape = new THREE.Shape();

            // Start at bottom-left
            shape.moveTo(0, 0);

            // Move up the left side (or create notches if LEFT side)
            if (!isRight) {
                // LEFT side notches
                for (let i = 0; i < numSegments; i++) {
                    const segStart = i * segmentH;
                    const segEnd = (i + 1) * segmentH;
                    const isTooth = startWithTooth ? (i % 2 === 0) : (i % 2 === 1);

                    if (isTooth) {
                        // Tooth protrudes to LEFT (negative X)
                        shape.lineTo(0, segStart);
                        shape.lineTo(-notchD, segStart);
                        shape.lineTo(-notchD, segEnd);
                        shape.lineTo(0, segEnd);
                    } else {
                        // Gap - straight line
                        shape.lineTo(0, segEnd);
                    }
                }
            } else {
                // Straight left side
                shape.lineTo(0, panelLength);
            }

            // Move across the top
            shape.lineTo(panelWidth, panelLength);

            // Move down the right side (or create notches if RIGHT side)
            if (isRight) {
                // RIGHT side notches - going DOWN from top to bottom
                for (let i = numSegments - 1; i >= 0; i--) {
                    const segStart = i * segmentH;
                    const segEnd = (i + 1) * segmentH;
                    const isTooth = startWithTooth ? (i % 2 === 0) : (i % 2 === 1);

                    if (isTooth) {
                        // Tooth protrudes to RIGHT (positive X from panelWidth)
                        shape.lineTo(panelWidth, segEnd);
                        shape.lineTo(panelWidth + notchD, segEnd);
                        shape.lineTo(panelWidth + notchD, segStart);
                        shape.lineTo(panelWidth, segStart);
                    } else {
                        // Gap - straight line down
                        shape.lineTo(panelWidth, segStart);
                    }
                }
            } else {
                // Straight right side
                shape.lineTo(panelWidth, 0);
            }

            // Close the shape
            shape.lineTo(0, 0);

            const geo = new THREE.ExtrudeGeometry(shape, {
                depth: panelThickness,
                bevelEnabled: false
            });
            mesh = new THREE.Mesh(geo, this.materials.steel);

        } else if (profile.type === 'gable') {
            // OITÃO (Gable Wall) - Parede retangular com opção de corte triangular
            const SCENE_SCALE = 0.3;

            // Dimensões em CM, convertidas para unidades de cena
            const baseWidth = (this.data.width !== undefined ? this.data.width : profile.width || 300) * SCENE_SCALE;
            const height = (this.data.length !== undefined ? this.data.length : profile.length || 280) * SCENE_SCALE;
            const thickness = (this.data.thickness !== undefined ? this.data.thickness : profile.thickness || 10) * SCENE_SCALE;

            // Inclinação do corte em % (0 = sem corte, retângulo puro)
            const slopePercent = this.data.slope !== undefined ? this.data.slope : (profile.slope || 0);
            const cutType = this.data.cutType || profile.cutType || 'center';

            console.log(`OITAO: width=${(baseWidth / SCENE_SCALE).toFixed(0)}cm, height=${(height / SCENE_SCALE).toFixed(0)}cm, slope=${slopePercent}%, cutType=${cutType}`);

            // Se slope = 0, renderizar como retângulo simples
            if (slopePercent === 0) {
                mesh = new THREE.Mesh(new THREE.BoxGeometry(baseWidth, thickness, height), this.materials.wall);
            } else {
                // Calcular altura do pico baseado na inclinação
                // slope = x% significa para cada 100cm horizontal, sobe x cm vertical
                let peakHeight;
                if (cutType === 'center') {
                    // Pico no centro: usa metade da largura
                    peakHeight = (baseWidth / 2) * (slopePercent / 100);
                } else {
                    // Pico na lateral: usa largura total
                    peakHeight = baseWidth * (slopePercent / 100);
                }

                // Construir a forma do oitão no plano XZ (X = largura, Z = altura)
                const shape = new THREE.Shape();

                // Começar no canto inferior esquerdo
                shape.moveTo(0, 0);

                // Subir pela esquerda até a altura
                shape.lineTo(0, height);

                // Fazer o corte triangular baseado no tipo
                if (cutType === 'center') {
                    // Pico no centro (telhado duas águas)
                    shape.lineTo(baseWidth / 2, height + peakHeight);
                    shape.lineTo(baseWidth, height);
                } else if (cutType === 'left') {
                    // Inclinação da esquerda alta para direita baixa
                    shape.lineTo(0, height + peakHeight);
                    shape.lineTo(baseWidth, height);
                } else if (cutType === 'right') {
                    // Inclinação da esquerda baixa para direita alta
                    shape.lineTo(baseWidth, height + peakHeight);
                }

                // Fechar a forma
                shape.lineTo(baseWidth, 0);
                shape.lineTo(0, 0);

                const geo = new THREE.ExtrudeGeometry(shape, {
                    depth: thickness,
                    bevelEnabled: false
                });
                mesh = new THREE.Mesh(geo, this.materials.wall);
            }

        } else {
            // STANDARD STEEL PROFILE (U/C)
            const shape = new THREE.Shape();
            const t = (profile.thickness || 1) * S;
            const lip = (profile.lip || 0) * S;

            // Draw C or U shape
            shape.moveTo(0, f); shape.lineTo(0, 0); shape.lineTo(w, 0); shape.lineTo(w, f);
            if (lip > 0) { shape.lineTo(w - t, f); shape.lineTo(w - t, t); shape.lineTo(t, t); shape.lineTo(t, f); shape.lineTo(0, f); }
            else { shape.lineTo(w - t, f); shape.lineTo(w - t, t); shape.lineTo(t, t); shape.lineTo(t, f); shape.lineTo(0, f); }

            const geo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
            mesh = new THREE.Mesh(geo, this.materials.steel);
        }

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.mesh.add(mesh);

        // Add Frame helper
        const box = new THREE.BoxHelper(mesh, 0x000000);
        this.mesh.add(box);
    }

    clear() {
        while (this.mesh.children.length > 0) {
            const c = this.mesh.children[0];
            if (c.geometry) c.geometry.dispose();
            this.mesh.remove(c);
        }
    }

    updateLength(mm) {
        this.data.length = mm;
        this.mesh.userData.length = mm;
        this.build();
    }

    updateProfile(newId) {
        if (ProfileCatalog[newId]) {
            this.data.profileId = newId;
            this.build();
        }
    }

    setGhost(isGhost) {
        const mat = isGhost ? this.materials.ghost : null; // Use build() defaults
        if (isGhost) {
            this.mesh.children.forEach(c => { if (c.isMesh) c.material = mat; });
        } else {
            this.build(); // Rebuild to restore original materials
        }
    }
}
