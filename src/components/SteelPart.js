import * as THREE from 'three';
import { ProfileCatalog } from '../data/ProfileCatalog.js';

// Scale Factor: 1 unit = 1 CM. Input Data = MM.
const S = 0.1;

export class SteelPart {
    constructor(data, options = {}) {
        this.data = data; // { id, profileId, length(mm), x(mm)... slope(%) }
        this.showHelper = options.showHelper !== false; // Default to true
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
        // Allow instance overrides for Width (Web) and Height (Flange/Thickness)
        // Note: data.width/height are expected in CM. Profile dims in MM.
        const w = (this.data.width !== undefined ? this.data.width : (profile.width || 100) * S) * SCENE_SCALE;
        const f = (this.data.height !== undefined ? this.data.height : (profile.flange || 40) * S) * SCENE_SCALE;
        const len = (this.data.length || 300) * SCENE_SCALE; // Length in CM, scaled

        let mesh;

        // --- TYPE DISPATCH ---
        if (profile.type === 'box') {
            // GENERIC WALL / BLOCK
            // Dimensions expected in CM from data, converted to scene units consistently
            const SCENE_SCALE = 0.3;

            // Espessura (X) - em CM, convertido para unidades de cena
            const thickness = (this.data.thickness !== undefined ? this.data.thickness : 10) * SCENE_SCALE;
            // Largura (Y) - em CM, convertido para unidades de cena
            const widthCM = this.data.width !== undefined ? this.data.width : 61;
            const width = widthCM * SCENE_SCALE;
            // Altura (Z) - length em CM, convertido para unidades de cena
            const heightCM = this.data.length !== undefined ? this.data.length : 280;
            const height = heightCM * SCENE_SCALE;

            console.log(`WALL_GENERIC dimensions: ${thickness.toFixed(2)} x ${width.toFixed(2)} x ${height.toFixed(2)} (scene units)`);

            // Check if wall has cuts (openings)
            if (this.data.cuts && this.data.cuts.length > 0) {
                // Create wall with cuts using 4 BoxGeometry pieces grouped together
                // This is simpler and more reliable than ExtrudeGeometry with holes
                //
                // Wall dimensions: thickness (X), width (Y), height (Z)
                // Cut creates: BOTTOM, TOP, LEFT, RIGHT pieces around the hole

                // Use first cut for now (support multiple cuts later)
                const cut = this.data.cuts[0];
                const cutStartY = (cut.startY || 0) * SCENE_SCALE;  // horizontal start
                const cutEndY = (cut.endY || widthCM) * SCENE_SCALE;  // horizontal end
                const cutStartZ = (cut.startZ || 0) * SCENE_SCALE;  // vertical start
                const cutEndZ = (cut.endZ || heightCM) * SCENE_SCALE;  // vertical end

                const cutWidth = cutEndY - cutStartY;
                const cutHeight = cutEndZ - cutStartZ;

                console.log(`Creating cut pieces: wall=${width.toFixed(2)}x${height.toFixed(2)}, cut Y=[${cutStartY.toFixed(2)},${cutEndY.toFixed(2)}] Z=[${cutStartZ.toFixed(2)},${cutEndZ.toFixed(2)}]`);

                // Create a Group to hold all pieces
                const group = new THREE.Group();
                const mat = this.materials.wall;

                // BOTTOM piece - full width, from Z=0 to cutStartZ
                if (cutStartZ > 0.01) {
                    const botHeight = cutStartZ;
                    const botGeo = new THREE.BoxGeometry(thickness, width, botHeight);
                    const botMesh = new THREE.Mesh(botGeo, mat);
                    // Position: center of this piece, relative to wall center
                    botMesh.position.set(0, 0, -height / 2 + botHeight / 2);
                    group.add(botMesh);
                    console.log(`  BOTTOM: ${width.toFixed(2)} x ${botHeight.toFixed(2)}`);
                }

                // TOP piece - full width, from cutEndZ to wall height
                const topHeight = height - cutEndZ;
                if (topHeight > 0.01) {
                    const topGeo = new THREE.BoxGeometry(thickness, width, topHeight);
                    const topMesh = new THREE.Mesh(topGeo, mat);
                    topMesh.position.set(0, 0, height / 2 - topHeight / 2);
                    group.add(topMesh);
                    console.log(`  TOP: ${width.toFixed(2)} x ${topHeight.toFixed(2)}`);
                }

                // LEFT piece - between cutStartZ and cutEndZ, from Y=0 to cutStartY
                if (cutStartY > 0.01 && cutHeight > 0.01) {
                    const leftWidth = cutStartY;
                    const leftGeo = new THREE.BoxGeometry(thickness, leftWidth, cutHeight);
                    const leftMesh = new THREE.Mesh(leftGeo, mat);
                    // Y position from wall center
                    leftMesh.position.set(0, -width / 2 + leftWidth / 2, -height / 2 + cutStartZ + cutHeight / 2);
                    group.add(leftMesh);
                    console.log(`  LEFT: ${leftWidth.toFixed(2)} x ${cutHeight.toFixed(2)}`);
                }

                // RIGHT piece - between cutStartZ and cutEndZ, from cutEndY to wall width
                const rightWidth = width - cutEndY;
                if (rightWidth > 0.01 && cutHeight > 0.01) {
                    const rightGeo = new THREE.BoxGeometry(thickness, rightWidth, cutHeight);
                    const rightMesh = new THREE.Mesh(rightGeo, mat);
                    rightMesh.position.set(0, width / 2 - rightWidth / 2, -height / 2 + cutStartZ + cutHeight / 2);
                    group.add(rightMesh);
                    console.log(`  RIGHT: ${rightWidth.toFixed(2)} x ${cutHeight.toFixed(2)}`);
                }

                // The group acts as the mesh
                mesh = group;

            } else {
                // Simple box without holes
                mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, width, height), this.materials.wall);
            }

        } else if (profile.type === 'opening') {
            // DOOR / WINDOW
            const SCENE_SCALE = 0.3;
            // Dimensions in MM -> scaled
            const h = (this.data.height !== undefined ? this.data.height * 10 : (profile.height || 2100)) * S * SCENE_SCALE;
            const width = (this.data.width !== undefined ? this.data.width * 10 : (profile.width || 800)) * S * SCENE_SCALE;
            const depth = 14 * S * SCENE_SCALE; // Frame thickness (standard wall) typically 140mm

            const isWindow = profile.id.includes('WINDOW');

            // Create a Group container
            mesh = new THREE.Group();

            if (isWindow) {
                // Window Logic (Keep simple but separate for now, maybe add frame later)
                const glassMat = this.materials.glass;
                const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff }); // White frame

                // Add Frame Border? For now simple box to match previous behavior but properly grouped
                const mainMesh = new THREE.Mesh(new THREE.BoxGeometry(width, depth, h), glassMat);
                mesh.add(mainMesh);
            } else {
                // ** IMPROVED DOOR DESIGN **
                const frameMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 }); // Dark Wood Frame
                const leafMat = this.materials.wood; // Existing wood material
                const handleMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8, roughness: 0.2 }); // Silver

                const frameW = 5 * S * SCENE_SCALE; // 5cm frame width
                const frameD = depth;               // Full wall depth

                // 1. FRAME (Portal - 3 pieces: Left, Right, Top)
                // Left Post (-X)
                const leftPost = new THREE.Mesh(new THREE.BoxGeometry(frameW, frameD, h), frameMat);
                leftPost.position.set(-width / 2 + frameW / 2, 0, 0);
                mesh.add(leftPost);

                // Right Post (+X)
                const rightPost = new THREE.Mesh(new THREE.BoxGeometry(frameW, frameD, h), frameMat);
                rightPost.position.set(width / 2 - frameW / 2, 0, 0);
                mesh.add(rightPost);

                // Top Header (+Z)
                const topHeader = new THREE.Mesh(new THREE.BoxGeometry(width, frameD, frameW), frameMat);
                topHeader.position.set(0, 0, h / 2 - frameW / 2);
                mesh.add(topHeader);

                // 2. DOOR LEAF (Folha)
                // Fits inside frame components
                const leafW = width - (2 * frameW);
                const leafH = h - frameW; // No bottom frame
                const leafD = 4 * S * SCENE_SCALE; // 4cm thickness

                // Leaf Center Z = (-h/2) + (leafH / 2) -> sits on "floor" relative to box bottom
                const leafZ = -h / 2 + leafH / 2;

                // Group for Leaf (to allow animation later if needed)
                const leafGroup = new THREE.Group();
                leafGroup.position.set(0, 0, leafZ);

                // Main Panel
                const mainPanel = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafD, leafH), leafMat);
                leafGroup.add(mainPanel);

                // Optional: Recessed Panel Detail (simple inset box)
                const panelS = 12 * S * SCENE_SCALE; // 12cm border
                const innerW = leafW - (2 * panelS);
                const innerH = leafH - (2 * panelS);
                if (innerW > 0 && innerH > 0) {
                    // Slightly thinner part in the middle
                    const innerPanel = new THREE.Mesh(new THREE.BoxGeometry(innerW, leafD * 1.2, innerH), frameMat);
                    // frameMat used for contrast (darker) or same mat? Let's use frameMat (darker border look)
                    // Actually maybe an emboss? Let's skip valid geometry detail for performance and stick to simple contrast if needed.
                    // A simple handle is the best improvement.
                }

                mesh.add(leafGroup);

                // 3. HANDLE (Maçaneta)
                const handleHeightFromFloor = 100 * SCENE_SCALE; // ~1m height handle
                const handleZLocal = -leafH / 2 + handleHeightFromFloor;

                // Right side handle
                const handleX = leafW / 2 - (6 * S * SCENE_SCALE);
                const handleDepthOffset = leafD / 2 + (2 * S * SCENE_SCALE); // Protrude

                // Knob Spheres
                const knobGeo = new THREE.SphereGeometry(3 * S * SCENE_SCALE, 16, 16);
                const knob1 = new THREE.Mesh(knobGeo, handleMat);
                knob1.position.set(handleX, handleDepthOffset, handleZLocal); // Front
                leafGroup.add(knob1);

                const knob2 = new THREE.Mesh(knobGeo, handleMat);
                knob2.position.set(handleX, -handleDepthOffset, handleZLocal); // Back
                leafGroup.add(knob2);
            }

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
            const panelWidth = (this.data.width !== undefined ? this.data.width : (profile.width || 610) * S) * SCENE_SCALE;
            const panelThickness = (this.data.thickness !== undefined ? this.data.thickness : (profile.thickness || 90) * S) * SCENE_SCALE;

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
            // OITÃO (Gable Wall) - Procedural Generation via Shape
            const SCENE_SCALE = 0.3;

            // Dimensions in CM, converted to scene units
            const L = (this.data.width !== undefined ? this.data.width : profile.width || 300) * SCENE_SCALE;
            const H_max = (this.data.length !== undefined ? this.data.length : profile.length || 280) * SCENE_SCALE; // Input is MAX height
            const thickness = (this.data.thickness !== undefined ? this.data.thickness : profile.thickness || 10) * SCENE_SCALE;

            // Slope in % (0-100)
            const i = this.data.slope !== undefined ? this.data.slope : (profile.slope || 0);

            // Cut Type: LEFT_HIGH, RIGHT_HIGH, GABLE (defaults to 'center'/'GABLE' for backward compat)
            let cutType = this.data.cutType || profile.cutType || 'GABLE';

            // normalize legacy values
            if (cutType === 'center') cutType = 'GABLE';
            if (cutType === 'left') cutType = 'LEFT_HIGH';
            if (cutType === 'right') cutType = 'RIGHT_HIGH';

            console.log(`OITAO (Top-Down): L=${(L / SCENE_SCALE).toFixed(0)}cm, H_max=${(H_max / SCENE_SCALE).toFixed(0)}cm, slope=${i}%, type=${cutType}`);

            const shape = new THREE.Shape();

            if (cutType === 'RIGHT_HIGH') {
                // Meia-Água (Subindo para a Direita) -> Right side is MAX
                const deltaH = L * (i / 100);
                const H_min = Math.max(0, H_max - deltaH);

                // (0,0) -> (L,0) -> (L, H_max) -> (0, H_min)
                shape.moveTo(0, 0);
                shape.lineTo(L, 0);
                shape.lineTo(L, H_max);
                shape.lineTo(0, H_min);

            } else if (cutType === 'LEFT_HIGH') {
                // Meia-Água (Subindo para a Esquerda) -> Left side is MAX
                const deltaH = L * (i / 100);
                const H_min = Math.max(0, H_max - deltaH);

                // (0,0) -> (L,0) -> (L, H_min) -> (0, H_max)
                shape.moveTo(0, 0);
                shape.lineTo(L, 0);
                shape.lineTo(L, H_min);
                shape.lineTo(0, H_max);

            } else {
                // GABLE (Duas Águas - Central) -> Center is MAX (Peak)
                const deltaH = (L / 2) * (i / 100);
                const H_eave = Math.max(0, H_max - deltaH);

                // (0,0) -> (L,0) -> (L, H_eave) -> (L/2, H_max) -> (0, H_eave)
                shape.moveTo(0, 0);
                shape.lineTo(L, 0);
                shape.lineTo(L, H_eave);
                shape.lineTo(L / 2, H_max);
                shape.lineTo(0, H_eave);
            }

            // Close the shape (implied or explicit)
            shape.lineTo(0, 0);

            const geo = new THREE.ExtrudeGeometry(shape, {
                depth: thickness,
                bevelEnabled: false
            });

            // Center geometry pivot? 
            // The logic above creates shape from (0,0) to positive X/Y.
            // Wall logic usually expects center pivot or bottom-center.
            // Let's keep it as is, but we might need to adjust position if the system expects centered mesh.
            // Previous code used box which is centered.
            // ExtrudeGeometry creates mesh starting at 0,0,0.
            // We should center it manually or adjust position.

            geo.center(); // Center the geometry bounding box

            mesh = new THREE.Mesh(geo, this.materials.wall);

            // Adjust position correction if needed? 
            // geo.center() makes pivot the center of bounding box. 
            // If H varies, the center Y changes.
            // Walls are typically positioned by their center point.
            // So geo.center() is likely correct for the transform behavior.

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

        // Add Frame helper only if enabled (for Model Builder, not for Assembler)
        if (this.showHelper !== false) {
            const box = new THREE.BoxHelper(mesh, 0x000000);
            this.mesh.add(box);
        }
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

    updateWidth(cm) {
        this.data.width = cm;
        this.mesh.userData.width = cm;
        this.build();
    }

    updateHeight(cm) {
        this.data.height = cm;
        this.mesh.userData.height = cm;
        this.build();
    }

    updateProfile(newId) {
        if (ProfileCatalog[newId]) {
            this.data.profileId = newId;
            this.build();
        }
    }

    setGhost(isGhost) {
        const ghostMat = this.materials.ghost;
        if (isGhost) {
            // Traverse entire hierarchy to ghost all meshes (including nested groups)
            this.mesh.traverse(child => {
                if (child.isMesh) {
                    // Store original material if not already stored
                    if (!child.userData._originalMaterial) {
                        child.userData._originalMaterial = child.material;
                    }
                    child.material = ghostMat;
                }
            });
        } else {
            // Restore original materials or rebuild
            let needsRebuild = false;
            this.mesh.traverse(child => {
                if (child.isMesh) {
                    if (child.userData._originalMaterial) {
                        child.material = child.userData._originalMaterial;
                    } else {
                        needsRebuild = true;
                    }
                }
            });
            if (needsRebuild) {
                this.build(); // Rebuild to restore original materials if not stored
            }
        }
    }
}
