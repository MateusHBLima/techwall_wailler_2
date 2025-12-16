
import * as THREE from 'three';
import { SceneManager } from '../core/SceneManager.js';
import { ModelStore } from '../data/ModelStore.js';

export class AssemblerViewerPage {
    constructor(container, params) {
        this.container = container;
        this.params = params;
        this.modelStore = new ModelStore();

        // Package management
        this.packages = []; // { id, name, group, pieces[], visible }
        this.focusedPackageId = null; // null = show all
        this.allPieces = [];
        this.partsMap = new Map();

        this.render();
    }

    async render() {
        if (this.modelStore.loadModels) {
            await this.modelStore.loadModels();
        }

        const projectId = this.params.id;
        const project = this.modelStore.getModel(projectId);

        if (!project) {
            alert("Projeto não encontrado: " + projectId);
            window.location.hash = 'assembler';
            return;
        }

        this.container.innerHTML = `
            <div style="position:relative; width:100%; height:100%; overflow:hidden; background:#1a1a1a;">
                
                <!-- 3D Canvas -->
                <canvas id="assembler-canvas" style="width:100%; height:100%; display:block; outline:none;"></canvas>

                <!-- Top Left Overlay: Project Info -->
                <div style="position:absolute; top:20px; left:20px; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); padding:15px; border-radius:12px; border-left:4px solid #007acc; color:#fff; max-width:320px;">
                    <h2 style="margin:0; font-size:1.1rem; font-weight:700;">${project.name}</h2>
                    <div style="margin-top:5px; font-size:0.85rem; color:#ccc; font-family:monospace;">COD: <span style="color:#fff; font-weight:bold;">${project.id}</span></div>
                    <div id="step-display" style="margin-top:10px; font-size:1.2rem; font-weight:300; color:#00ccff;">ETAPA: CARREGANDO...</div>
                </div>

                <!-- Top Right: Package Selector -->
                <div id="package-panel" style="position:absolute; top:20px; right:20px; background:rgba(0,0,0,0.85); backdrop-filter:blur(4px); padding:15px; border-radius:12px; border:1px solid #333; color:#fff; min-width:220px; max-height:60vh; overflow-y:auto;">
                    <h3 style="margin:0 0 10px 0; font-size:0.9rem; color:#888; text-transform:uppercase; letter-spacing:1px;">Pacotes / Grupos</h3>
                    <div id="package-list" style="display:flex; flex-direction:column; gap:6px;">
                        <!-- Filled dynamically -->
                    </div>
                    <div style="margin-top:15px; border-top:1px solid #333; padding-top:10px;">
                        <button id="btn-show-all" style="width:100%; padding:8px; background:#007acc; border:none; color:white; border-radius:6px; cursor:pointer; font-size:0.85rem;">Ver Tudo</button>
                    </div>
                </div>

                <!-- Exit Button -->
                <a href="#assembler" style="position:absolute; bottom:120px; right:20px; background:rgba(0,0,0,0.6); color:#fff; padding:10px 18px; border-radius:20px; text-decoration:none; font-size:0.85rem; border:1px solid #444;">Sair</a>

                <!-- Instructions Panel (Left Side) -->
                <div id="instructions-panel" style="position:absolute; bottom:120px; left:20px; background:rgba(0,0,0,0.9); backdrop-filter:blur(8px); padding:15px; border-radius:12px; border:1px solid #444; color:#fff; width:320px; max-height:50vh; overflow-y:auto; display:none;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <h3 style="margin:0; font-size:1rem; color:#00ccff;">📋 Instruções</h3>
                        <button id="btn-close-instructions" style="background:none; border:none; color:#888; font-size:1.2rem; cursor:pointer;">×</button>
                    </div>
                    <div id="instructions-piece-name" style="font-size:0.85rem; color:#aaa; margin-bottom:10px;"></div>
                    <div id="instructions-text" style="font-size:0.9rem; line-height:1.4; margin-bottom:15px; white-space:pre-wrap;"></div>
                    <div id="instructions-images" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:15px;"></div>
                    <div id="instructions-video" style="margin-bottom:15px;"></div>
                    <div id="instructions-notes" style="font-size:0.8rem; color:#888; font-style:italic;"></div>
                </div>

                <!-- Toggle Instructions Button -->
                <button id="btn-toggle-instructions" style="position:absolute; bottom:120px; left:20px; background:rgba(0,0,0,0.7); border:1px solid #444; color:#fff; padding:10px 15px; border-radius:8px; cursor:pointer; font-size:0.9rem;">📋 Ver Instruções</button>

                <!-- Bottom Controls: Timeline (Big Slider) -->
                <div style="position:absolute; bottom:30px; left:50%; transform:translateX(-50%); width:90%; max-width:800px; background:rgba(20,20,20,0.95); padding:15px 20px; border-radius:40px; display:flex; gap:20px; border:1px solid #444; align-items:center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                     
                     <button id="btn-prev" style="background:#333; border:none; color:white; cursor:pointer; font-size:1.5rem; width:50px; height:50px; border-radius:50%; display:flex; align-items:center; justify-content:center; transition:0.2s;">◀</button>
                     
                     <div style="flex:1; display:flex; flex-direction:column; gap:5px;">
                        <input type="range" id="timeline-slider" class="timeline-slider" min="0" max="10" value="10" style="width:100%; height:12px; -webkit-appearance:none; background:#444; border-radius:6px; outline:none;">
                        <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#888; padding:0 5px;">
                            <span>INÍCIO</span>
                            <span id="timeline-context" style="color:#00ccff;">Todos os Pacotes</span>
                            <span>CONCLUSÃO</span>
                        </div>
                     </div>

                     <button id="btn-next" style="background:#007acc; border:none; color:white; cursor:pointer; font-size:1.5rem; width:50px; height:50px; border-radius:50%; display:flex; align-items:center; justify-content:center; transition:0.2s;">▶</button>
                </div>
            </div>
            
            <style>
                #timeline-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 24px;
                    height: 24px;
                    background: #fff;
                    cursor: pointer;
                    border-radius: 50%;
                    box-shadow: 0 0 10px rgba(0,0,0,0.5);
                }
                #btn-prev:active, #btn-next:active { transform: scale(0.9); }
                .pkg-item { display:flex; align-items:center; gap:8px; padding:8px 10px; background:#222; border-radius:6px; cursor:pointer; transition:0.2s; }
                .pkg-item:hover { background:#333; }
                .pkg-item.focused { background:#007acc; }
                .pkg-item input[type="checkbox"] { width:18px; height:18px; cursor:pointer; }
                .pkg-item label { flex:1; cursor:pointer; font-size:0.9rem; }
                .pkg-item .focus-btn { background:none; border:1px solid #555; color:#aaa; padding:4px 8px; border-radius:4px; font-size:0.7rem; cursor:pointer; }
                .pkg-item .focus-btn:hover { border-color:#007acc; color:#007acc; }
                .pkg-item.focused .focus-btn { background:#fff; color:#007acc; border-color:#fff; }
                .piece-item:hover { background:#444 !important; }
                .piece-item:active { background:#555 !important; }
                .pkg-pieces { border-left: 2px solid #444; padding-left: 8px; }
            </style>
        `;

        // Init 3D Scene
        const canvas = this.container.querySelector('#assembler-canvas');
        this.sceneManager = new SceneManager(canvas);

        this.modelData = project.data;
        this.buildSceneFromData();

        // Button bindings
        this.container.querySelector('#btn-show-all').onclick = () => this.showAllPackages();

        // Instructions panel bindings
        const instructionsPanel = this.container.querySelector('#instructions-panel');
        const toggleBtn = this.container.querySelector('#btn-toggle-instructions');
        const closeBtn = this.container.querySelector('#btn-close-instructions');

        if (toggleBtn && instructionsPanel) {
            toggleBtn.onclick = () => {
                instructionsPanel.style.display = 'block';
                toggleBtn.style.display = 'none';
            };
        }
        if (closeBtn && instructionsPanel && toggleBtn) {
            closeBtn.onclick = () => {
                instructionsPanel.style.display = 'none';
                toggleBtn.style.display = 'block';
            };
        }

        // Animation Loop
        this.active = true;
        this.animate = () => {
            if (!this.active) return;
            requestAnimationFrame(this.animate);
            this.sceneManager.update();
        };
        this.animate();

        this.resizeHandler = () => this.sceneManager.onWindowResize();
        window.addEventListener('resize', this.resizeHandler);
    }

    buildSceneFromData() {
        if (!this.modelData) return;
        this.importWholeModel(this.modelData);
    }

    importWholeModel(data) {
        import('../components/SteelPart.js').then(({ SteelPart }) => {
            try {
                this.packages = [];
                this.allPieces = [];

                const phases = data.phases || [];

                phases.forEach(phase => {
                    (phase.packages || []).forEach(pkgData => {
                        // Create Group
                        const group = new THREE.Group();
                        // Support both position formats: pkgData.x OR pkgData.position.x
                        const px = pkgData.x !== undefined ? pkgData.x : (pkgData.position?.x || 0);
                        const py = pkgData.y !== undefined ? pkgData.y : (pkgData.position?.y || 0);
                        const pz = pkgData.z !== undefined ? pkgData.z : (pkgData.position?.z || 0);
                        const rx = pkgData.rx !== undefined ? pkgData.rx : (pkgData.rotation?.x || 0);
                        const ry = pkgData.ry !== undefined ? pkgData.ry : (pkgData.rotation?.y || 0);
                        const rz = pkgData.rz !== undefined ? pkgData.rz : (pkgData.rotation?.z || 0);
                        group.position.set(px, py, pz);
                        group.rotation.set(rx, ry, rz);
                        group.userData = { isPackage: true, data: pkgData, id: pkgData.id };

                        const pkgPieces = [];
                        const pieces = pkgData.pieces || [];

                        pieces.forEach(pieceData => {
                            const realPart = new SteelPart(pieceData, { showHelper: false });
                            const mesh = realPart.mesh;

                            mesh.position.set(pieceData.x || 0, pieceData.y || 0, pieceData.z || 0);
                            mesh.rotation.set(pieceData.rx || 0, pieceData.ry || 0, pieceData.rz || 0);
                            mesh.userData = { id: pieceData.id, data: pieceData, partId: pieceData.id, packageId: pkgData.id };
                            group.add(mesh);

                            this.partsMap.set(pieceData.id, realPart);

                            const pieceEntry = {
                                id: pieceData.id,
                                step: pieceData.step || 999,
                                part: realPart,
                                packageId: pkgData.id
                            };
                            pkgPieces.push(pieceEntry);
                            this.allPieces.push(pieceEntry);
                        });

                        this.sceneManager.scene.add(group);

                        // Store package reference
                        this.packages.push({
                            id: pkgData.id,
                            name: pkgData.name || pkgData.id,
                            group: group,
                            pieces: pkgPieces,
                            visible: true
                        });
                    });
                });

                // Process looseParts (pieces not in any package, like roof panels)
                const looseParts = data.looseParts || [];
                if (looseParts.length > 0) {
                    const looseGroup = new THREE.Group();
                    looseGroup.userData = { isPackage: true, data: { id: 'LOOSE_PARTS', name: 'Peças Soltas' }, id: 'LOOSE_PARTS' };

                    const loosePieces = [];

                    looseParts.forEach(pieceData => {
                        const realPart = new SteelPart(pieceData, { showHelper: false });
                        const mesh = realPart.mesh;

                        mesh.position.set(pieceData.x || 0, pieceData.y || 0, pieceData.z || 0);
                        mesh.rotation.set(pieceData.rx || 0, pieceData.ry || 0, pieceData.rz || 0);
                        mesh.userData = { id: pieceData.id, data: pieceData, partId: pieceData.id, packageId: 'LOOSE_PARTS' };
                        looseGroup.add(mesh);

                        this.partsMap.set(pieceData.id, realPart);

                        const pieceEntry = {
                            id: pieceData.id,
                            step: pieceData.step || 999,
                            part: realPart,
                            packageId: 'LOOSE_PARTS'
                        };
                        loosePieces.push(pieceEntry);
                        this.allPieces.push(pieceEntry);
                    });

                    this.sceneManager.scene.add(looseGroup);

                    this.packages.push({
                        id: 'LOOSE_PARTS',
                        name: 'Peças Soltas',
                        group: looseGroup,
                        pieces: loosePieces,
                        visible: true
                    });

                    console.log("[ASSEMBLER] Loose Parts:", looseParts.length);
                }

                console.log("[ASSEMBLER] Packages:", this.packages.length);
                console.log("[ASSEMBLER] Total Pieces:", this.allPieces.length);

                this.renderPackageList();
                this.setupTimelineBindings();
                this.recalculateTimeline();

            } catch (err) {
                console.error("[ASSEMBLER] Error during model import:", err);
            }
        }).catch(err => {
            console.error("[ASSEMBLER] Failed to import SteelPart module:", err);
        });
    }

    renderPackageList() {
        const listEl = this.container.querySelector('#package-list');
        if (!listEl) return;

        // Track expanded packages
        if (!this.expandedPackages) this.expandedPackages = new Set();

        listEl.innerHTML = this.packages.map(pkg => {
            const isExpanded = this.expandedPackages.has(pkg.id);
            const piecesList = isExpanded ? `
                <div class="pkg-pieces" style="margin-left:20px; margin-top:5px; display:flex; flex-direction:column; gap:3px; max-height:200px; overflow-y:auto;">
                    ${pkg.pieces.map(p => `
                        <div class="piece-item" data-piece-id="${p.id}" style="padding:4px 8px; background:#333; border-radius:4px; font-size:0.75rem; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                            <span>${p.id}</span>
                            <span style="color:#888; font-size:0.65rem;">P${p.step}</span>
                        </div>
                    `).join('')}
                </div>
            ` : '';

            return `
                <div class="pkg-item ${this.focusedPackageId === pkg.id ? 'focused' : ''}" data-pkg-id="${pkg.id}">
                    <input type="checkbox" id="chk-${pkg.id}" ${pkg.visible ? 'checked' : ''}>
                    <label class="pkg-label" data-pkg-id="${pkg.id}" style="flex:1; cursor:pointer;">${pkg.name} <span style="color:#666; font-size:0.7rem;">(${pkg.pieces.length})</span></label>
                    <button class="focus-btn" data-focus="${pkg.id}">FOCO</button>
                </div>
                ${piecesList}
            `;
        }).join('');

        // Bind checkbox events
        listEl.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            chk.onchange = (e) => {
                const pkgId = e.target.closest('.pkg-item').dataset.pkgId;
                this.togglePackageVisibility(pkgId, e.target.checked);
            };
        });

        // Bind focus button events
        listEl.querySelectorAll('.focus-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const pkgId = e.target.dataset.focus;
                this.focusPackage(pkgId);
            };
        });

        // Bind label click to expand/collapse pieces list AND blink group
        listEl.querySelectorAll('.pkg-label').forEach(lbl => {
            lbl.onclick = (e) => {
                e.stopPropagation();
                const pkgId = lbl.dataset.pkgId;

                // Toggle expansion
                if (this.expandedPackages.has(pkgId)) {
                    this.expandedPackages.delete(pkgId);
                } else {
                    this.expandedPackages.add(pkgId);
                }

                // Blink the package group
                this.blinkPackage(pkgId);

                // Re-render
                this.renderPackageList();
            };
        });

        // Bind piece item click to blink individual piece
        listEl.querySelectorAll('.piece-item').forEach(item => {
            item.onclick = (e) => {
                e.stopPropagation();
                const pieceId = item.dataset.pieceId;
                this.blinkPiece(pieceId);
            };
        });
    }

    blinkPackage(pkgId) {
        const pkg = this.packages.find(p => p.id === pkgId);
        if (!pkg) return;

        // Stop any existing blink animation
        if (this._blinkInterval) {
            clearInterval(this._blinkInterval);
            // Reset all materials
            this.packages.forEach(p => p.pieces.forEach(piece => piece.part.setGhost(false)));
        }

        let blinkCount = 0;
        const maxBlinks = 6;

        this._blinkInterval = setInterval(() => {
            const isVisible = blinkCount % 2 === 0;
            pkg.pieces.forEach(piece => {
                piece.part.setGhost(!isVisible);
            });

            blinkCount++;
            if (blinkCount >= maxBlinks) {
                clearInterval(this._blinkInterval);
                this._blinkInterval = null;
                // Restore to normal state
                pkg.pieces.forEach(piece => piece.part.setGhost(false));
            }
        }, 200);

        // Focus camera on the package
        this.focusCameraOnGroup(pkg.group);
    }

    blinkPiece(pieceId) {
        const piece = this.allPieces.find(p => p.id === pieceId);
        if (!piece) return;

        // Stop any existing blink animation
        if (this._blinkInterval) {
            clearInterval(this._blinkInterval);
        }

        let blinkCount = 0;
        const maxBlinks = 8;

        this._blinkInterval = setInterval(() => {
            const isVisible = blinkCount % 2 === 0;
            piece.part.setGhost(!isVisible);

            blinkCount++;
            if (blinkCount >= maxBlinks) {
                clearInterval(this._blinkInterval);
                this._blinkInterval = null;
                piece.part.setGhost(false);
            }
        }, 150);

        // Focus camera on the piece's mesh
        if (piece.part.mesh) {
            const box = new THREE.Box3().setFromObject(piece.part.mesh);
            const center = box.getCenter(new THREE.Vector3());
            if (this.sceneManager.controls) {
                this.sceneManager.controls.target.copy(center);
                this.sceneManager.controls.update();
            }
        }
    }

    togglePackageVisibility(pkgId, visible) {
        const pkg = this.packages.find(p => p.id === pkgId);
        if (!pkg) return;

        pkg.visible = visible;
        pkg.group.visible = visible;

        // If hiding the focused package, unfocus
        if (!visible && this.focusedPackageId === pkgId) {
            this.focusedPackageId = null;
        }

        this.recalculateTimeline();
        this.renderPackageList();
    }

    focusPackage(pkgId) {
        // Toggle focus
        if (this.focusedPackageId === pkgId) {
            this.focusedPackageId = null;
        } else {
            this.focusedPackageId = pkgId;
        }

        // Update visibility: focused package solid, others ghost or hidden
        this.packages.forEach(pkg => {
            if (this.focusedPackageId === null) {
                // Show all visible
                pkg.group.visible = pkg.visible;
                pkg.pieces.forEach(p => p.part.setGhost(false));
            } else {
                if (pkg.id === this.focusedPackageId) {
                    pkg.group.visible = true;
                    pkg.pieces.forEach(p => p.part.setGhost(false));
                } else {
                    // Ghost the others
                    pkg.group.visible = true;
                    pkg.pieces.forEach(p => p.part.setGhost(true));
                }
            }
        });

        // Focus camera on the package
        if (this.focusedPackageId) {
            const pkg = this.packages.find(p => p.id === this.focusedPackageId);
            if (pkg && pkg.group) {
                this.focusCameraOnGroup(pkg.group);
            }
        }

        this.recalculateTimeline();
        this.renderPackageList();
    }

    focusCameraOnGroup(group) {
        if (!group) return;
        const box = new THREE.Box3().setFromObject(group);
        if (box.isEmpty()) return;

        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        if (this.sceneManager.controls) {
            this.sceneManager.controls.target.copy(center);
            // Optionally zoom to fit
            const camera = this.sceneManager.camera;
            if (camera) {
                const distance = maxDim * 1.5;
                camera.position.copy(center);
                camera.position.z += distance;
                camera.position.y += distance * 0.5;
            }
            this.sceneManager.controls.update();
        }
    }

    showAllPackages() {
        this.focusedPackageId = null;
        this.packages.forEach(pkg => {
            pkg.visible = true;
            pkg.group.visible = true;
        });
        this.recalculateTimeline();
        this.renderPackageList();

        // Reset camera
        if (this.sceneManager.controls) {
            this.sceneManager.controls.target.set(0, 0, 0);
            this.sceneManager.controls.update();
        }
    }

    setupTimelineBindings() {
        const slider = this.container.querySelector('#timeline-slider');
        if (!slider) return;

        slider.oninput = (e) => {
            const val = parseInt(e.target.value);
            this.updateTimeline(val);
        };

        this.container.querySelector('#btn-prev').onclick = () => {
            slider.value = Math.max(0, parseInt(slider.value) - 1);
            this.updateTimeline(parseInt(slider.value));
        };

        this.container.querySelector('#btn-next').onclick = () => {
            slider.value = Math.min(parseInt(slider.max), parseInt(slider.value) + 1);
            this.updateTimeline(parseInt(slider.value));
        };
    }

    recalculateTimeline() {
        // Get pieces in context (focused package or all visible)
        let contextPieces;
        let contextName;

        if (this.focusedPackageId) {
            const pkg = this.packages.find(p => p.id === this.focusedPackageId);
            contextPieces = pkg ? pkg.pieces : [];
            contextName = pkg ? pkg.name : 'Pacote';
        } else {
            // All visible packages
            contextPieces = this.packages
                .filter(p => p.visible)
                .flatMap(p => p.pieces);
            contextName = 'Todos os Pacotes';
        }

        this.contextPieces = contextPieces;

        // Get unique steps for this context
        const uniqueSteps = [...new Set(contextPieces.map(p => p.step))].sort((a, b) => a - b);
        this.stepNumbers = uniqueSteps;

        // Update slider
        const slider = this.container.querySelector('#timeline-slider');
        const contextLabel = this.container.querySelector('#timeline-context');

        if (slider) {
            const maxStep = uniqueSteps.length > 0 ? uniqueSteps[uniqueSteps.length - 1] : 0;
            slider.min = 0;
            slider.max = maxStep;
            slider.value = 0; // Start at beginning (0%)
        }

        if (contextLabel) {
            contextLabel.textContent = contextName;
        }

        // Apply timeline state
        this.updateTimeline(parseInt(slider?.value || 0));
    }

    updateTimeline(stepValue) {
        const currentStep = parseInt(stepValue) || 0;
        const contextPieces = this.contextPieces || [];
        const maxStep = this.stepNumbers && this.stepNumbers.length > 0
            ? this.stepNumbers[this.stepNumbers.length - 1]
            : 0;

        // Count visible pieces
        const visibleCount = contextPieces.filter(p => p.step <= currentStep).length;
        const totalCount = contextPieces.length || 1;
        const percentage = Math.round((visibleCount / totalCount) * 100);

        // Update display
        const display = this.container.querySelector('#step-display');
        if (display) {
            let stepText;
            if (currentStep === 0) {
                stepText = "INÍCIO";
            } else if (currentStep >= maxStep && maxStep > 0) {
                stepText = "FINALIZADO";
            } else {
                stepText = `PASSO ${currentStep}`;
            }
            display.innerHTML = `ETAPA: <span style="color:#fff;">${percentage}%</span> <span style="font-size:0.8rem; color:#aaa; margin-left:10px;">(${stepText})</span>`;
        }

        // Apply ghosting to context pieces only
        contextPieces.forEach(item => {
            const isVisible = item.step <= currentStep;
            item.part.setGhost(!isVisible);
        });

        // Calculate and save GLOBAL progress (all pieces, not just context)
        // This is for the dashboard view
        if (this.allPieces.length > 0 && !this.focusedPackageId) {
            // Only save global progress when not in focus mode
            const globalMaxStep = Math.max(...this.allPieces.map(p => p.step));
            const globalVisibleCount = this.allPieces.filter(p => p.step <= currentStep).length;
            const globalProgress = Math.round((globalVisibleCount / this.allPieces.length) * 100);

            this.saveProgress(globalProgress);
        }

        // Update instructions panel
        this.updateInstructionsPanel(currentStep, contextPieces);
    }

    updateInstructionsPanel(currentStep, contextPieces) {
        const panel = this.container.querySelector('#instructions-panel');
        if (!panel) return;

        const textEl = this.container.querySelector('#instructions-text');
        const imagesEl = this.container.querySelector('#instructions-images');
        const videoEl = this.container.querySelector('#instructions-video');
        const notesEl = this.container.querySelector('#instructions-notes');
        const nameEl = this.container.querySelector('#instructions-piece-name');

        // Find pieces at exactly current step (newly visible)
        const currentPieces = contextPieces.filter(p => p.step === currentStep);

        // Collect all instructions from current step pieces
        let allText = [];
        let allImages = [];
        let allVideos = [];
        let allNotes = [];
        let pieceNames = [];

        currentPieces.forEach(item => {
            const data = item.part.data;
            console.log('[DEBUG] Piece:', data.id, 'Has instructions:', !!data.instructions, 'Data:', data);
            if (data.instructions) {
                if (data.instructions.text) allText.push(data.instructions.text);
                if (data.instructions.images) allImages.push(...data.instructions.images);
                if (data.instructions.video) allVideos.push(data.instructions.video);
                if (data.instructions.notes) allNotes.push(data.instructions.notes);
            }
            pieceNames.push(data.id || 'Peça');
        });

        // Update piece names
        if (nameEl) {
            nameEl.textContent = pieceNames.length > 0 ? `Peças: ${pieceNames.join(', ')}` : 'Nenhuma peça neste passo';
        }

        // Update text
        if (textEl) {
            textEl.textContent = allText.join('\n\n') || 'Sem instruções de texto.';
        }

        // Update images
        if (imagesEl) {
            imagesEl.innerHTML = allImages.map(img =>
                `<img src="${img}" style="width:80px; height:80px; object-fit:cover; border-radius:4px; cursor:pointer; border:1px solid #555;" onclick="window.open('${img}', '_blank')">`
            ).join('') || '';
        }

        // Update video (YouTube/Vimeo embed)
        if (videoEl) {
            if (allVideos.length > 0) {
                const embedUrl = this.getVideoEmbedUrl(allVideos[0]);
                if (embedUrl) {
                    videoEl.innerHTML = `<iframe src="${embedUrl}" width="100%" height="180" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="border-radius:8px;"></iframe>`;
                } else {
                    videoEl.innerHTML = `<a href="${allVideos[0]}" target="_blank" style="color:#00ccff;">🎬 Ver Vídeo</a>`;
                }
            } else {
                videoEl.innerHTML = '';
            }
        }

        // Update notes
        if (notesEl) {
            notesEl.textContent = allNotes.join(' | ') || '';
        }
    }

    getVideoEmbedUrl(url) {
        if (!url) return null;
        // YouTube
        let match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
        if (match) return `https://www.youtube.com/embed/${match[1]}`;
        // Vimeo
        match = url.match(/vimeo\.com\/(\d+)/);
        if (match) return `https://player.vimeo.com/video/${match[1]}`;
        return null;
    }

    saveProgress(progress) {
        // Debounce to avoid excessive saves
        if (this._saveTimeout) clearTimeout(this._saveTimeout);

        this._saveTimeout = setTimeout(() => {
            const projectId = this.params.id;
            const project = this.modelStore.getModel(projectId);

            if (project && project.progress !== progress) {
                project.progress = progress;
                this.modelStore.saveModel(project);
                console.log(`[ASSEMBLER] Progress saved: ${progress}%`);
            }
        }, 500);
    }

    destroy() {
        this.active = false;
        window.removeEventListener('resize', this.resizeHandler);
    }
}

