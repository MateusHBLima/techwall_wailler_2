import * as THREE from 'three';
import { SceneManager } from '../core/SceneManager.js';
import { InteractionManager } from '../core/InteractionManager.js';
import { ModelStore } from '../data/ModelStore.js';
import { SteelPart } from '../components/SteelPart.js';
import { ProfileCatalog } from '../data/ProfileCatalog.js';

export class ModelBuilderPage {
    constructor(container, params) {
        this.container = container;
        this.params = params || {};
        this.modelStore = new ModelStore();
        this.partsMap = new Map();
        this.packageGroups = new Map(); // Stores THREE.Group for each package
        this.suspendInspector = false; // Initialize flag
        this.selectedObjects = []; // Local selection tracking

        // Undo stack for Ctrl+Z
        this.undoStack = [];
        this.maxUndoSteps = 20;

        this.render();
    }

    async render() {
        // Ensure models are loaded first
        if (this.modelStore.loadModels) {
            await this.modelStore.loadModels();
        }

        const modelId = this.params.id;

        if (!modelId) {
            this.renderMenu();
            return;
        }

        // --- EDITOR MODE ---
        this.renderEditorLayout();

        // Initialize 3D Scene
        const canvas = this.container.querySelector('#builder-canvas');
        this.sceneManager = new SceneManager(canvas);
        this.interactionManager = new InteractionManager(this.sceneManager, this);

        // Load or Create
        if (modelId === 'new') {
            this.modelData = {
                id: 'MODEL_' + crypto.randomUUID().slice(0, 4),
                name: 'Novo Modelo',
                looseParts: [], // Parts not in any package
                phases: [{ id: 'MAIN', name: 'Principal', packages: [] }]
            };
        } else {
            const saved = this.modelStore.getModel(modelId);
            if (saved) {
                this.modelData = saved.data;
                if (!this.modelData.phases) this.modelData.phases = [{ id: 'MAIN', name: 'Principal', packages: [] }];
                if (!this.modelData.looseParts) this.modelData.looseParts = []; // Ensure looseParts exists
            } else {
                alert("Modelo não encontrado!");
                window.location.hash = 'model-builder';
                return;
            }
        }

        this.currentModelId = modelId === 'new' ? this.modelData.id : modelId;

        this.buildSceneFromData();
        this.bindEditorEvents();

        this.animate = () => {
            if (!this.active) return;
            requestAnimationFrame(this.animate);
            this.sceneManager.update();
        };
        this.active = true;
        this.animate();

        this.resizeHandler = () => this.sceneManager.onWindowResize();
        window.addEventListener('resize', this.resizeHandler);
    }

    async renderMenu() {
        if (this.modelStore.loadModels) await this.modelStore.loadModels(); // Ensure fresh

        const templates = this.modelStore.getTemplates();
        const projects = this.modelStore.getProjects();
        const view = this.params.view || 'all'; // 'projects', 'new', 'templates', 'all'

        let contentHtml = '';

        // SECTION: PROJECTS (Meus Projetos)
        if (view === 'projects' || view === 'all') {
            contentHtml += `
                <div style="margin-bottom:40px;">
                    <h3 style="border-bottom:1px solid #444; padding-bottom:10px; color:#007acc;">Projetos Ativos (Montagem)</h3>
                    <div class="projects-grid">
                        ${projects.length === 0 ? '<p style="color:#666;">Nenhum projeto criado ainda.</p>' : ''}
                        ${projects.map(p => {
                const progress = p.progress || 0;
                const progressColor = progress >= 100 ? '#28a745' : progress > 50 ? '#ffc107' : '#007acc';
                return `
                            <div class="project-card" style="border-left:4px solid ${progressColor};">
                                <h3>${p.name}</h3>
                                <p style="font-family:monospace; font-size:1.2rem; color:#fff; background:#222; padding:5px; text-align:center; border-radius:4px; margin:10px 0;">
                                    COD: ${p.id}
                                </p>
                                
                                <!-- Progress Bar -->
                                <div style="margin:15px 0;">
                                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                                        <span style="font-size:0.8rem; color:#888;">Progresso da Montagem</span>
                                        <span style="font-size:0.9rem; font-weight:bold; color:${progressColor};">${progress}%</span>
                                    </div>
                                    <div style="background:#333; border-radius:4px; height:8px; overflow:hidden;">
                                        <div style="background:${progressColor}; height:100%; width:${progress}%; transition:width 0.3s;"></div>
                                    </div>
                                    <div style="font-size:0.7rem; color:#666; margin-top:3px; text-align:right;">
                                        ${progress >= 100 ? '✓ Concluído' : progress > 0 ? 'Em andamento' : 'Não iniciado'}
                                    </div>
                                </div>
                                
                                <p style="font-size:0.8rem; color:#aaa;">Modelo Base: ${p.data?.project || 'Custom'}</p>
                                <div class="actions" style="display:flex; gap:8px; flex-wrap:wrap;">
                                    <a href="#model-builder/${p.id}" class="btn-secondary" style="flex:1;">Editar / Gerenciar</a>
                                    <button class="btn-danger" onclick="window.deleteProject('${p.id}')" style="background:#ff4444; border:1px solid #ff6666; color:#fff; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:0.85rem;">🗑️ Excluir</button>
                                </div>
                            </div>
                        `}).join('')}
                    </div>
                </div>
            `;
        }

        // SECTION: MODEL BUILDER (Templates - Combined with New Project)
        if (view === 'new' || view === 'templates' || view === 'all') {
            contentHtml += `
                <div>
                    <h3 style="border-bottom:1px solid #444; padding-bottom:10px; color:#ff8800;">
                        Modelos / Templates
                        <span style="font-size:0.7rem; color:#888; font-weight:normal; margin-left:10px;">Crie projetos a partir destes modelos</span>
                    </h3>
                    <div class="projects-grid">
                        ${templates.map(m => `
                            <div class="project-card" style="border-left:4px solid #ff8800;">
                                <h3>${m.name}</h3>
                                <p style="font-size:0.75rem; color:#666; margin:5px 0;">ID: ${m.id}</p>
                                <div class="actions" style="display:flex; flex-direction:column; gap:8px; margin-top:15px;">
                                    <div style="display:flex; gap:8px;">
                                        <a href="#model-builder/${m.id}" class="btn-secondary" style="flex:1; text-align:center;">Editar Modelo</a>
                                        <button class="btn-primary btn-create-proj" data-template-id="${m.id}" style="flex:1;">+ Criar Projeto</button>
                                    </div>
                                    <button onclick="window.deleteTemplate('${m.id}')" style="background:#dc3545; border:none; color:white; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:0.8rem;">🗑️ Excluir Modelo</button>
                                </div>
                            </div>
                        `).join('')}
                         <div class="project-card" style="border:2px dashed #555; display:flex; align-items:center; justify-content:center; cursor:pointer; min-height:150px;" onclick="window.location.hash='model-builder/new'">
                            <span style="color:#888; font-size:1.1rem;">+ Novo Template Vazio</span>
                        </div>
                    </div>
                </div>
            `;
        }

        this.container.innerHTML = `
            <div class="page-header">
                <h2>Gerenciador de Projetos (Admin)</h2>
                <div style="display:flex; gap:10px;">
                     <a href="#assembler" class="btn-secondary">Ir para Área do Montador</a>
                </div>
            </div>
            
            <div style="padding:30px; overflow-y:auto; height:calc(100% - 80px);">
                ${contentHtml}
            </div>
        `;

        // Event Delegation for Create Project
        this.container.onclick = (e) => {
            if (e.target.classList.contains('btn-create-proj')) {
                const templateId = e.target.getAttribute('data-template-id');
                const name = prompt("Nome do Cliente / Projeto:");
                if (name) {
                    try {
                        const newProj = this.modelStore.createProjectFromTemplate(templateId, name);
                        alert(`Projeto Criado com Sucesso!\n\nCódigo de Acesso: ${newProj.id}\n\n(Copie este código para o montador)`);
                        // Force visual update or redirect
                        window.location.hash = 'dashboard';
                    } catch (err) {
                        console.error(err);
                        alert("Erro ao criar projeto: " + err.message);
                    }
                }
            }
        };

        // Global function for delete button (inline onclick)
        window.deleteTemplate = (templateId) => {
            const template = this.modelStore.getModel(templateId);
            if (!template) {
                alert("Modelo não encontrado!");
                return;
            }

            if (confirm(`Tem certeza que deseja EXCLUIR o modelo "${template.name}"?\n\nEsta ação não pode ser desfeita.`)) {
                try {
                    this.modelStore.deleteModel(templateId);
                    alert("Modelo excluído com sucesso!");
                    window.location.reload(); // Reload page to refresh list
                } catch (err) {
                    console.error(err);
                }
            }
        };

        // Global function for delete PROJECT button (inline onclick)
        window.deleteProject = (projectId) => {
            const project = this.modelStore.getModel(projectId);
            if (!project) {
                alert("Projeto não encontrado!");
                return;
            }

            if (confirm(`Tem certeza que deseja EXCLUIR o projeto "${project.name}"?\n\nTodo o progresso de montagem será perdido.\nEsta ação não pode ser desfeita.`)) {
                try {
                    this.modelStore.deleteModel(projectId);
                    alert("Projeto excluído com sucesso!");
                    window.location.reload(); // Reload page to refresh list
                } catch (err) {
                    console.error(err);
                    alert("Erro ao excluir: " + err.message);
                }
            }
        };
    }

    renderEditorLayout() {
        this.container.innerHTML = `
            <div class="builder-layout">
                <div class="builder-sidebar">
                    <!-- Tree -->
                    <div class="sidebar-header">
                        <span>ESTRUTURA</span>
                        <div style="display:flex; gap:5px;">
                            <button id="btn-sidebar-add-part" class="tool-btn" title="Nova Peça" style="width:100%">➕ Peça</button>
                        </div>
                    </div>
                    <div id="tree-container" class="tree-view"></div>

                    <!-- Inspector -->
                    <div class="sidebar-header">
                        <span>PROPRIEDADES</span>
                    </div>
                    <div id="inspector-container" class="inspector-panel"></div>
                </div>

                <div class="canvas-container">
                    <canvas id="builder-canvas"></canvas>
                    <!-- Visual Debug Console -->
                    <div id="debug-overlay" style="position:absolute; top:50px; left:10px; width:300px; height:200px; background:rgba(0,0,0,0.8); color:#0f0; font-family:monospace; font-size:10px; overflow-y:auto; pointer-events:none; z-index:9999; padding:5px;">
                        Debug Console Initialized...
                    </div>
                    
                    <div class="canvas-toolbar">
                        <button id="tool-back" class="tool-btn" style="border:1px solid #ff4444; color:#ff8888;">&larr; Voltar</button>
                        <div style="width:1px; background:#555; margin:0 5px;"></div>
                        <button id="tool-move" class="tool-btn">Mov (T)</button>
                        <button id="tool-rotate" class="tool-btn">Rot (R)</button>
                        <button id="tool-select" class="tool-btn" style="border:1px solid #00ccff; color:#00ccff;">✓ Seleção</button>
                        <div style="width:1px; background:#555; margin:0 5px;"></div>
                        <select id="sel-profile" class="tool-btn" style="background:#222;">
                            ${Object.keys(ProfileCatalog).map(k => `<option value="${k}">${ProfileCatalog[k].name}</option>`).join('')}
                        </select>
                        <div style="width:1px; background:#555; margin:0 5px;"></div>
                        <button id="tool-clone" class="tool-btn">Clone</button>
                        <button id="tool-del" class="tool-btn" style="color:#ff6666;">Del</button>
                        <div style="width:1px; background:#555; margin:0 5px;"></div>
                        <button id="tool-group" class="tool-btn" style="border:1px solid #ffee00; color:#ffee00;">🔗 Agrupar</button>
                        <button id="tool-ungroup" class="tool-btn" style="border:1px solid #ff8800; color:#ff8800;">🔓 Desagrupar</button>
                         <button id="tool-auto" class="tool-btn" style="background:#553388; border-color:#8855dd;">🪄 Auto</button>
                         <button id="tool-save" class="tool-btn" style="border-color:#007acc; color:#007acc;">Salvar</button>
                    </div>
                    <div class="timeline-control">
                        <span style="font-size:0.8rem; color:#aaa;">PASSO:</span>
                        <input type="range" id="timeline-slider" class="timeline-slider" min="0" max="100" value="100">
                        <span id="timeline-value" style="font-size:0.9rem; font-weight:bold; min-width:30px; text-align:right;">ALL</span>
                    </div>
                </div>
                
                <!-- Custom Modal for Prompts -->
                <div id="custom-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:10000; justify-content:center; align-items:center;">
                    <div style="background:#1a1a2e; padding:30px; border-radius:12px; min-width:350px; box-shadow:0 8px 32px rgba(0,0,0,0.5); border:1px solid #444;">
                        <h3 id="modal-title" style="margin:0 0 20px 0; color:#fff; font-size:1.2rem;"></h3>
                        <input type="text" id="modal-input" style="width:100%; padding:12px; border:2px solid #555; border-radius:8px; background:#222; color:#fff; font-size:1rem; margin-bottom:20px; box-sizing:border-box;">
                        <div style="display:flex; gap:10px; justify-content:flex-end;">
                            <button id="modal-cancel" style="padding:10px 20px; background:#444; border:none; border-radius:6px; color:#aaa; cursor:pointer;">Cancelar</button>
                            <button id="modal-confirm" style="padding:10px 25px; background:#00aaff; border:none; border-radius:6px; color:#fff; cursor:pointer; font-weight:bold;">Confirmar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Initialize Visual Debugger INSIDE the method
        setTimeout(() => {
            const dbg = document.getElementById('debug-overlay');
            if (dbg) {
                const oldLog = console.log;
                const oldErr = console.error;
                console.log = (...args) => {
                    oldLog(...args);
                    dbg.innerHTML += `<div>LOG: ${args.join(' ')}</div>`;
                    dbg.scrollTop = dbg.scrollHeight;
                };
                console.error = (...args) => {
                    oldErr(...args);
                    dbg.innerHTML += `<div style="color:red">ERR: ${args.join(' ')}</div>`;
                    dbg.scrollTop = dbg.scrollHeight;
                };
            }
        }, 100);
    }

    bindEditorEvents() {
        console.log("Binding Editor Events...");
        // Helper
        const bind = (id, fn) => {
            const el = this.container.querySelector('#' + id);
            if (el) {
                el.onclick = (e) => {
                    console.log('Click:', id);
                    try { fn(e); } catch (err) { console.error(err); alert(err.message); }
                };
            } else {
                console.error('Missing button:', id);
            }
        };

        bind('tool-back', () => window.location.hash = 'model-builder');
        bind('tool-move', () => this.interactionManager.setMode('translate'));
        // User requested "Rot" button to rotate 90 degrees right immediately
        bind('tool-rotate', () => {
            console.log("Quick Rotate 90 Triggered");
            this.interactionManager.rotateSelectionY(-90);
        });
        bind('btn-sidebar-add-part', () => this.createPart());
        bind('tool-clone', () => {
            // Check if selection is a package
            const selection = this.interactionManager.selectedObjects;
            if (selection && selection.length === 1 && selection[0].userData.isPackage) {
                this.clonePackage(selection[0].userData.id);
            } else {
                this.smartClone();
            }
        });
        bind('tool-del', () => this.deleteSelection());
        bind('tool-group', () => this.createPackageFromSelection());
        bind('tool-ungroup', () => this.ungroupSelection());
        bind('tool-auto', () => this.runAutoBuild());
        bind('tool-save', () => this.saveModel());

        // Selection Mode Toggle
        const selectBtn = this.container.querySelector('#tool-select');
        if (selectBtn) {
            selectBtn.onclick = () => {
                const active = this.interactionManager.toggleSelectionMode();
                selectBtn.style.background = active ? '#00ccff' : '';
                selectBtn.style.color = active ? '#000' : '#00ccff';
            };
        }

        const slider = this.container.querySelector('#timeline-slider');
        if (slider) slider.oninput = (e) => this.updateTimeline(parseInt(e.target.value));

        window.addEventListener('keydown', (e) => {
            if (!this.active) return;
            if (e.key === 'Delete') this.deleteSelection();
            // Ctrl+Z for undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                this.undo();
            }
        });
    }

    // ... createPackageFromSelection ...

    // ... findPackage ...

    // ... createPackage ...

    // ... createPart ... (Updated in previous steps)

    // ... instantiatePart ...

    /**
     * Shows a custom modal prompt (replaces native prompt() which may be blocked)
     * @param {string} title - The title/question for the modal
     * @param {string} defaultValue - Default value for the input
     * @returns {Promise<string|null>} - Resolves with the input value or null if cancelled
     */
    showPrompt(title, defaultValue = '') {
        return new Promise((resolve) => {
            const modal = this.container.querySelector('#custom-modal');
            const titleEl = this.container.querySelector('#modal-title');
            const input = this.container.querySelector('#modal-input');
            const confirmBtn = this.container.querySelector('#modal-confirm');
            const cancelBtn = this.container.querySelector('#modal-cancel');

            if (!modal || !titleEl || !input) {
                console.error("Modal elements not found!");
                resolve(null);
                return;
            }

            titleEl.textContent = title;
            input.value = defaultValue;
            modal.style.display = 'flex';
            input.focus();
            input.select();

            const cleanup = () => {
                modal.style.display = 'none';
                confirmBtn.onclick = null;
                cancelBtn.onclick = null;
                input.onkeydown = null;
            };

            confirmBtn.onclick = () => {
                const value = input.value.trim();
                cleanup();
                resolve(value || null);
            };

            cancelBtn.onclick = () => {
                cleanup();
                resolve(null);
            };

            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    confirmBtn.click();
                } else if (e.key === 'Escape') {
                    cancelBtn.click();
                }
            };
        });
    }

    smartClone(sourceObjects = null, autoSelect = true) {
        // Multi-clone support
        let selection = sourceObjects;
        if (!selection) selection = this.interactionManager.selectedObjects;

        console.log(`smartClone: ${selection ? selection.length : 0} source(s)`);

        if (!selection || selection.length === 0) {
            console.log("smartClone: No selection found.");
            return [];
        }

        // Save state for undo
        this.saveUndoState();

        // Safety check for .length
        if (!Array.isArray(selection)) {
            console.log("smartClone: Selection is not an array");
            return [];
        }
        if (selection.length === 0) return [];

        const createdParts = [];

        // Clone each source part
        selection.forEach(selected => {
            try {
                // Handle both ThreeJS objects (with userData) and raw data objects
                // If selected is null?
                if (!selected) return;

                const partId = selected.userData ? selected.userData.id : selected.id;
                console.log(`smartClone forEach: partId=${partId}`);
                if (!partId) { console.log("smartClone: No partId found"); return; }

                const part = this.partsMap.get(partId);
                if (!part) { console.log("smartClone: Part not in map: " + partId); return; }

                const data = part.data;
                const profile = ProfileCatalog[data.profileId];
                if (!profile) { console.log("smartClone: Profile not found: " + data.profileId); return; }

                let offX = 0, offY = 0;

                if (profile.type === 'stud') offX = 60; // 60cm
                else offY = 300;
                if (profile.type === 'box') { offX = 0; offY = 0; }

                // Default offset if none
                if (offX === 0 && offY === 0) { offX = 10; offY = 10; }

                const newId = data.profileId + '_' + crypto.randomUUID().slice(0, 4);

                // INCREMENT STEP logic
                const currentStep = parseInt(data.step || 1);
                const newStep = currentStep + 1;

                const newData = { ...data, id: newId, x: data.x + offX, y: data.y + offY, step: newStep };

                const pkg = this.findPackage(data.packageId);
                if (pkg) {
                    pkg.pieces.push(newData);
                    const newPart = this.instantiatePart(newData, pkg.id);
                    createdParts.push(newPart.mesh);

                    // Only select if requested (default behavior)
                    if (autoSelect) {
                        this.interactionManager.select(newPart.mesh, false);
                        if (!this.suspendInspector) this.renderTree();
                    }
                } else { console.log("smartClone: Package not found: " + data.packageId); }
            } catch (err) {
                console.error("Error inside smartClone loop:", err);
            }
        });

        console.log(`smartClone: created ${createdParts.length} part(s)`);
        return createdParts;
    }

    async createPackageFromSelection() {
        console.log("createPackageFromSelection called");
        const selection = this.interactionManager.selectedObjects;
        console.log("Selection count:", selection ? selection.length : 0);

        // Debug each selected object
        if (selection) {
            selection.forEach((obj, idx) => {
                console.log(`Selection[${idx}]:`, {
                    id: obj.userData?.id,
                    isPackage: obj.userData?.isPackage,
                    isLoose: obj.userData?.isLoose,
                    packageId: obj.userData?.packageId
                });
            });
        }

        if (!selection || selection.length === 0) {
            alert("Selecione peças para agrupar.");
            return;
        }

        // Check if any selected object is already a package - can't group packages
        const hasPackage = selection.some(obj => obj.userData?.isPackage === true);
        console.log("hasPackage check:", hasPackage);

        if (hasPackage) {
            alert("Não é possível agrupar pacotes. Selecione apenas peças soltas.");
            return;
        }

        // Show custom modal prompt for package name (replaces native prompt)
        console.log("Showing custom modal for group name...");
        const name = await this.showPrompt("Nome do Grupo:", "Pacote " + (this.modelData.phases[0].packages.length + 1));
        console.log("User entered name:", name);
        if (!name) {
            console.log("User cancelled or entered empty name.");
            return;
        }

        // Create New Package with custom name
        const pkg = {
            id: 'PKG_' + crypto.randomUUID().slice(0, 4),
            name: name,
            pieces: [],
            params: { profileId: 'C90', length: 300, qty: 1, spacing: 60 }
        };

        this.modelData.phases[0].packages.push(pkg);

        // Calculate center of selection to place group origin correctly
        const box = new THREE.Box3();
        selection.forEach(obj => box.expandByObject(obj));
        const center = new THREE.Vector3();
        box.getCenter(center);

        // Create 3D Group for this package at the center
        const pkgGroup = new THREE.Group();
        pkgGroup.position.copy(center); // Set group pivot to center of selection

        pkgGroup.userData = { id: pkg.id, isPackage: true, selectable: true, data: pkg };
        this.sceneManager.scene.add(pkgGroup);
        this.packageGroups.set(pkg.id, pkgGroup);

        // Update package text data to match group position
        pkg.x = center.x;
        pkg.y = center.y;
        pkg.z = center.z;

        let count = 0;
        selection.forEach(obj => {
            const partId = obj.userData.id;
            console.log("Processing part:", partId);
            const part = this.partsMap.get(partId);

            if (part && part.data) {
                // Check if it's a loose part
                if (obj.userData.isLoose || !part.data.packageId) {
                    // Remove from looseParts array
                    this.modelData.looseParts = this.modelData.looseParts.filter(p => p.id !== partId);
                } else {
                    // Remove from old package
                    const oldPkg = this.findPackageByPieceId(partId);
                    if (oldPkg) {
                        oldPkg.pieces = oldPkg.pieces.filter(p => p.id !== partId);
                    }
                }

                // Add to new package data list
                part.data.packageId = pkg.id;
                pkg.pieces.push(part.data);

                // 3D Reparent - attach preserves world transform
                // Since group is at 'center', children local positions will be relative to it
                pkgGroup.attach(obj);
                obj.userData.isLoose = false;
                obj.userData.packageId = pkg.id;

                count++;
            } else {
                console.warn("Part not found in partsMap:", partId, obj.userData);
            }
        });

        console.log(`Grouped ${count} items into "${name}"`);
        this.renderTree();
        this.interactionManager.deselectAll();
        // Select the new package
        this.interactionManager.select(pkgGroup);
    }

    ungroupSelection() {
        const selection = this.interactionManager.selectedObjects;
        if (!selection || selection.length === 0) {
            alert("Selecione peças ou um pacote para desagrupar.");
            return;
        }

        let count = 0;
        const toProcess = [...selection];

        toProcess.forEach(obj => {
            if (obj.userData.isPackage) {
                // Ungroup entire package - move all pieces to loose
                const pkgId = obj.userData.id;
                const pkg = this.findPackage(pkgId);
                if (pkg) {
                    // Move each piece to loose
                    [...pkg.pieces].forEach(pieceData => {
                        const part = this.partsMap.get(pieceData.id);
                        if (part) {
                            // Add to loose parts
                            pieceData.packageId = null;
                            this.modelData.looseParts.push(pieceData);

                            // Reparent to scene
                            this.sceneManager.scene.attach(part.mesh);
                            part.mesh.userData.isLoose = true;
                            part.mesh.userData.packageId = null;

                            count++;
                        }
                    });

                    // Remove package from data
                    this.modelData.phases[0].packages = this.modelData.phases[0].packages.filter(p => p.id !== pkgId);

                    // Remove 3D group
                    const group = this.packageGroups.get(pkgId);
                    if (group) {
                        this.sceneManager.scene.remove(group);
                        this.packageGroups.delete(pkgId);
                    }
                }
            } else {
                // Ungroup single part from its package
                const partId = obj.userData.id;
                const part = this.partsMap.get(partId);
                if (part && part.data.packageId) {
                    // Remove from package data
                    const pkg = this.findPackageByPieceId(partId);
                    if (pkg) {
                        pkg.pieces = pkg.pieces.filter(p => p.id !== partId);
                    }

                    // Add to loose parts
                    part.data.packageId = null;
                    this.modelData.looseParts.push(part.data);

                    // Reparent to scene
                    this.sceneManager.scene.attach(obj);
                    obj.userData.isLoose = true;
                    obj.userData.packageId = null;

                    count++;
                }
            }
        });

        console.log(`Ungrouped ${count} items`);
        this.interactionManager.deselectAll();
        this.renderTree();
    }

    findPackage(pkgId) {
        console.log(`findPackage(${pkgId}). Available:`, this.modelData.phases.map(ph => ph.packages.map(p => p.id)));
        for (const ph of this.modelData.phases) {
            const pkg = ph.packages.find(p => p.id === pkgId);
            if (pkg) return pkg;
        }
        return null;
    }

    createPackage() {
        console.log("createPackage called");
        // No prompt! Auto name.
        const nextIdx = this.modelData.phases[0].packages.length + 1;
        const name = "Pacote " + nextIdx;

        const pkg = {
            id: 'PKG_' + crypto.randomUUID().slice(0, 4),
            name: name,
            pieces: [],
            params: { // Default Generative Params
                profileId: 'C90',
                length: 300,
                qty: 1,
                spacing: 60
            }
        };

        this.modelData.phases[0].packages.push(pkg);
        this.buildSceneFromData(); // Rebuild to create group
        console.log("Package created:", name);
        return pkg; // Return the created package
    }

    clonePackage(pkgId) {
        const originalPkg = this.findPackage(pkgId);
        if (!originalPkg) {
            console.log("clonePackage: Package not found:", pkgId);
            return null;
        }

        console.log(`Cloning package ${originalPkg.name} with ${originalPkg.pieces.length} pieces`);

        // Create new package
        const nextIdx = this.modelData.phases[0].packages.length + 1;
        const newPkg = {
            id: 'PKG_' + crypto.randomUUID().slice(0, 4),
            name: originalPkg.name + " (Cópia)",
            pieces: [],
            params: { ...originalPkg.params }
        };

        // Clone all pieces with new IDs and offset position
        const offsetX = 100; // Offset the whole package
        originalPkg.pieces.forEach((piece, idx) => {
            const newPiece = {
                ...piece,
                id: piece.profileId + '_' + crypto.randomUUID().slice(0, 4),
                x: piece.x + offsetX,
                packageId: newPkg.id
            };
            newPkg.pieces.push(newPiece);
        });

        this.modelData.phases[0].packages.push(newPkg);
        this.buildSceneFromData(); // Rebuild to create group and parts

        // Select the new package
        const newGroup = this.packageGroups.get(newPkg.id);
        if (newGroup) {
            this.interactionManager.deselectAll();
            this.interactionManager.select(newGroup);
        }

        this.renderTree();
        console.log(`Package cloned: ${newPkg.name} with ${newPkg.pieces.length} pieces`);
        return newPkg;
    }

    createPart() {
        console.log("createPart called");

        const profileId = this.container.querySelector('#sel-profile').value;
        const id = profileId + '_' + crypto.randomUUID().slice(0, 4);

        // Auto-Rotate Vertical for Studs/Walls
        let rx = 0;
        const pro = ProfileCatalog[profileId];
        if (pro && (pro.type === 'stud' || pro.type === 'box')) rx = -Math.PI / 2;

        // Set default length based on profile type (in CM)
        let defaultLength = 300; // Default 300cm for most profiles
        if (pro && pro.type === 'notched_panel') {
            defaultLength = 280; // 280cm for TRAMA
        }

        const newPiece = {
            id, profileId, length: defaultLength,
            x: 0, y: 0, z: 0,
            rx: rx, ry: 0, rz: 0,
            step: 1,
            packageId: null // Loose part - not in any package
        };

        // Add to loose parts data
        this.modelData.looseParts.push(newPiece);

        // Instantiate as loose part (no package)
        const part = this.instantiateLoosePart(newPiece);

        // Select the new part immediately for moving
        this.interactionManager.select(part.mesh);
        this.renderTree();

        // Switch to Translate Mode automatically
        this.interactionManager.setMode('translate');

        console.log("Loose part created:", id);
    }

    instantiateLoosePart(data) {
        const part = new SteelPart(data, { showHelper: false });


        // Add directly to scene (not to a package group)
        part.mesh.position.set(data.x || 0, data.y || 0, data.z || 0);
        part.mesh.rotation.set(data.rx || 0, data.ry || 0, data.rz || 0);
        this.sceneManager.scene.add(part.mesh);

        this.partsMap.set(data.id, part);
        data.packageId = null; // Mark as loose
        part.mesh.userData.id = data.id;
        part.mesh.userData.packageId = null;
        part.mesh.userData.isLoose = true;
        return part;
    }

    async runAutoBuild() {
        if (!confirm("Isso apagará o modelo atual e construirá o protótipo. Continuar?")) return;

        console.log("🤖 Auto-Building Initiated...");

        // Reset
        this.modelData.phases[0].packages = [];
        this.buildSceneFromData();

        const create = (profile, len, x, y, z, rx, ry, rz, step) => {
            let pkg = this.modelData.phases[0].packages[0];
            if (!pkg) {
                const newPkg = { id: 'PKG_DEMO', name: "Parede Demo", pieces: [] };
                this.modelData.phases[0].packages.push(newPkg);
                pkg = newPkg;
            }

            const id = profile + '_' + crypto.randomUUID().slice(0, 4);
            const data = { id, profileId: profile, length: len, x, y, z, rx, ry, rz, step };

            pkg.pieces.push(data);
            const part = this.instantiatePart(data, pkg.id);
            this.interactionManager.select(part.mesh);
            return part;
        };

        // 1. U90 Track (300cm)
        create('U90', 300, 0, 0, 0, 0, 0, 0, 1);

        // 2. C90 Stud (Vertical 280cm)
        // Position: 5cm inside (local coords in wall?) 
        // Note: With Groups, if Wall Group is at 0,0, Pieces at 0,0 are at Wall 0,0.
        const stud = create('C90', 280, 5, 0, 0, -Math.PI / 2, 0, 0, 2);

        // 3. Clone x 4
        this.interactionManager.select(stud.mesh);
        for (let i = 0; i < 4; i++) this.smartClone();

        // 4. Top Track
        create('U90', 300, 0, 280, 0, 0, 0, Math.PI, 3);

        this.renderTree();
        console.log("✅ Build Complete!");
    }

    buildSceneFromData() {
        this.partsMap.clear();
        this.packageGroups = this.packageGroups || new Map();

        // Clear Groups
        this.packageGroups.forEach(g => this.sceneManager.scene.remove(g));
        this.packageGroups.clear();

        // Clear orphaned parts
        const toRemove = [];
        this.sceneManager.scene.traverse(c => { if (c.userData.isPart) toRemove.push(c); });
        toRemove.forEach(c => this.sceneManager.scene.remove(c));

        // Build Packages
        this.modelData.phases.forEach(phase => {
            phase.packages.forEach(pkg => {
                // Create GROUP
                const group = new THREE.Group();
                group.userData = { id: pkg.id, isPackage: true, data: pkg, selectable: true };

                // Set Transform
                group.position.set(pkg.x || 0, pkg.y || 0, pkg.z || 0);
                group.rotation.set(pkg.rx || 0, pkg.ry || 0, pkg.rz || 0);

                this.sceneManager.scene.add(group);
                this.packageGroups.set(pkg.id, group);

                // Add BoxHelper for selection visualization
                const gh = new THREE.BoxHelper(group, 0xffff00);
                gh.visible = false;
                group.add(gh);

                pkg.pieces.forEach(p => this.instantiatePart(p, pkg.id));
            });
        });

        // Build Loose Parts
        if (this.modelData.looseParts) {
            this.modelData.looseParts.forEach(p => this.instantiateLoosePart(p));
        }

        this.renderTree();
    }

    instantiatePart(data, packageId) {
        const part = new SteelPart(data, { showHelper: false });

        // Get Group
        const group = this.packageGroups.get(packageId);
        if (group) {
            // Add to Group (Local Coords)
            part.mesh.position.set(data.x || 0, data.y || 0, data.z || 0);
            part.mesh.rotation.set(data.rx || 0, data.ry || 0, data.rz || 0);
            group.add(part.mesh);
        } else {
            console.warn("No group for package", packageId);
            this.sceneManager.scene.add(part.mesh); // Fallback
        }

        this.partsMap.set(data.id, part);
        data.packageId = packageId; // CRITICAL: Store packageId in data for cloning
        part.mesh.userData.id = data.id; // CRITICAL: Required for clone chain lookup
        part.mesh.userData.packageId = packageId;
        return part;
    }

    smartClone() {
        const selected = this.interactionManager.selectedObject;
        if (!selected) return;

        // If Package selected, clone package? (Future feature)
        // If Part selected:
        const part = this.partsMap.get(selected.userData.id);
        if (!part) return;

        const data = part.data;
        const profile = ProfileCatalog[data.profileId];
        let offX = 0, offY = 0;

        if (profile.type === 'stud') offX = 60; // 60cm
        else offY = 300; // 3m

        const newId = data.profileId + '_' + crypto.randomUUID().slice(0, 4);
        const newData = { ...data, id: newId, x: data.x + offX, y: data.y + offY };

        const pkg = this.findPackage(data.id);
        if (pkg) {
            pkg.pieces.push(newData);
            const newPart = this.instantiatePart(newData, pkg.id);
            this.interactionManager.select(newPart.mesh);
            this.renderTree();
        }
    }

    deleteSelection() {
        const selection = this.interactionManager.selectedObjects;
        if (!selection || selection.length === 0) return;

        // Save state for undo
        this.saveUndoState();

        // Copy array since we'll be modifying during iteration
        const toDelete = [...selection];

        toDelete.forEach(selected => {
            if (selected.userData.isPackage) {
                // Delete Package
                const pkgId = selected.userData.id;
                console.log("Deleting package:", pkgId);
                this.modelData.phases[0].packages = this.modelData.phases[0].packages.filter(p => p.id !== pkgId);
                // Remove 3D Group
                const group = this.packageGroups.get(pkgId);
                if (group) {
                    this.sceneManager.scene.remove(group);
                    this.packageGroups.delete(pkgId);
                }
            } else {
                // Delete Part
                const id = selected.userData.id;
                console.log("Deleting part:", id);

                // Check if loose part
                if (selected.userData.isLoose) {
                    this.modelData.looseParts = this.modelData.looseParts.filter(p => p.id !== id);
                    console.log("Removed loose part:", id);
                } else {
                    // Find the package containing this piece
                    const pkg = this.findPackageByPieceId(id);
                    if (pkg) {
                        const beforeCount = pkg.pieces.length;
                        pkg.pieces = pkg.pieces.filter(p => p.id !== id);
                        console.log(`Removed ${id} from ${pkg.name}: ${beforeCount} -> ${pkg.pieces.length}`);
                    } else {
                        // Try looseParts as fallback
                        this.modelData.looseParts = this.modelData.looseParts.filter(p => p.id !== id);
                    }
                }

                // Remove mesh from parent
                if (selected.parent) selected.parent.remove(selected);
                this.partsMap.delete(id);
            }
        });

        this.interactionManager.deselectAll();
        this.renderTree();
        console.log(`Deleted ${toDelete.length} items.`);
    }

    findPackageByPieceId(pieceId) {
        for (const ph of this.modelData.phases) {
            for (const pkg of ph.packages) {
                if (pkg.pieces.find(p => p.id === pieceId)) return pkg;
            }
        }
        return null;
    }

    onObjectSelected(object) {
        if (!object) return;

        this.updateTreeSelection(object);

        if (object.userData.isPackage) {
            this.renderPackageInspector(object.userData.data);
        } else {
            this.renderInspector(object);
        }
    }

    renderPackageInspector(pkgData) {
        const pan = this.container.querySelector('#inspector-container');
        if (!pkgData) return;

        // Defaults
        pkgData.params = pkgData.params || { profileId: 'C90', length: 300, qty: 1, spacing: 60 };
        const p = pkgData.params;

        pan.innerHTML = `
            <div class="inspector-header" style="border-bottom:1px solid #444; margin-bottom:10px; padding-bottom:5px;">
                <strong>📦 ${pkgData.name}</strong>
            </div>
            <div class="inspector-row">
                <button id="btn-rename-pkg" class="btn-secondary" style="width:100%; font-size:0.8rem;">Renomear</button>
            </div>
            <div class="inspector-row">
                <button id="btn-recenter-pivot" class="btn-secondary" style="width:100%; font-size:0.8rem; margin-top:5px;">📍 Centralizar Pivot</button>
            </div>
             <div class="inspector-row">
                <label>Pos (Global)</label>
                <div class="input-group-3">
                    <input type="number" id="pkg-x" value="${(pkgData.x || 0).toFixed(0)}">
                    <input type="number" id="pkg-y" value="${(pkgData.y || 0).toFixed(0)}">
                    <input type="number" id="pkg-z" value="${(pkgData.z || 0).toFixed(0)}">
                </div>
            </div>
            <div class="inspector-row">
                <label>Rot (Global)</label>
                <div class="input-group-3">
                    <input type="number" id="pkg-rx" value="${((pkgData.rx || 0) * 180 / Math.PI).toFixed(0)}">
                    <input type="number" id="pkg-ry" value="${((pkgData.ry || 0) * 180 / Math.PI).toFixed(0)}">
                    <input type="number" id="pkg-rz" value="${((pkgData.rz || 0) * 180 / Math.PI).toFixed(0)}">
                </div>
            </div>
            
            <div style="margin-top:20px; border-top:1px solid #444; padding-top:10px;">
                <label style="color:#007acc; font-weight:bold;">Gerador Automático</label>
            </div>
            <div class="inspector-row"><label>Perfil</label>
                 <select id="gen-profile" style="width:100%">${Object.keys(ProfileCatalog).map(k => `<option value="${k}" ${p.profileId === k ? 'selected' : ''}>${ProfileCatalog[k].name}</option>`).join('')}</select>
            </div>
            <div class="inspector-row"><label>Comp. (cm)</label><input type="number" id="gen-len" value="${p.length}"></div>
            <div class="inspector-row"><label>Qtd.</label><input type="number" id="gen-qty" value="${p.qty}"></div>
            <div class="inspector-row"><label>Espaç. (cm)</label><input type="number" id="gen-spi" value="${p.spacing}"></div>
            <div class="inspector-row">
                <button id="btn-generate" class="btn-primary" style="width:100%; background:#2a8f2a;">♻️ Gerar / Atualizar</button>
            </div>
        `;

        // Bindings
        pan.querySelector('#btn-rename-pkg').onclick = () => {
            const n = prompt("Novo nome:", pkgData.name);
            if (n) { pkgData.name = n; this.renderTree(); this.renderPackageInspector(pkgData); }
        };

        // Recenter Pivot Logic
        pan.querySelector('#btn-recenter-pivot').onclick = () => {
            const group = this.packageGroups.get(pkgData.id);
            if (group) {
                // Detach interact controls temporarily
                this.interactionManager.deselectAll();

                // 1. Calculate new center of all children (in world space)
                const box = new THREE.Box3();
                group.children.forEach(child => {
                    // Since children are inside group, child.position is local.
                    // We need world bounding box.
                    const tempBox = new THREE.Box3().setFromObject(child);
                    box.union(tempBox);
                });

                if (box.isEmpty()) return;

                const newCenter = new THREE.Vector3();
                box.getCenter(newCenter);

                // 2. Detach children to Scene (preserves World Transform)
                const children = [...group.children];
                children.forEach(child => this.sceneManager.scene.attach(child));

                // 3. Move Group to new Center
                group.position.copy(newCenter);
                group.rotation.set(0, 0, 0); // Reset local rotation for simplicity or keep?
                // Ideally keep rotation but pivot moves. Moving pivot with rotation is hard.
                // Resetting rotation is safer for "Recenter". 
                // Wait, if we attach back, relative transform is calculated.
                // If we want to keep rotation, we just set position.

                // 4. Re-attach children
                children.forEach(child => group.attach(child));

                // 5. Update Data Model
                pkgData.x = group.position.x;
                pkgData.y = group.position.y;
                pkgData.z = group.position.z;
                pkgData.rx = group.rotation.x;
                pkgData.ry = group.rotation.y;
                pkgData.rz = group.rotation.z;

                // 6. Select again
                this.interactionManager.select(group);
            }
        };

        ['#gen-len', '#gen-qty', '#gen-spi'].forEach(id => {
            pan.querySelector(id).onchange = (e) => {
                const val = parseFloat(e.target.value);
                const key = id === '#gen-len' ? 'length' : id === '#gen-qty' ? 'qty' : 'spacing';
                p[key] = val;
            };
        });
        pan.querySelector('#gen-profile').onchange = e => p.profileId = e.target.value;

        pan.querySelector('#btn-generate').onclick = () => this.generatePackageContent(pkgData);

        // Group Transform Binding
        const updateGrp = () => {
            const group = this.packageGroups.get(pkgData.id);
            if (group) {
                const x = parseFloat(pan.querySelector('#pkg-x').value);
                const y = parseFloat(pan.querySelector('#pkg-y').value);
                const z = parseFloat(pan.querySelector('#pkg-z').value);

                const rx = parseFloat(pan.querySelector('#pkg-rx').value) * Math.PI / 180;
                const ry = parseFloat(pan.querySelector('#pkg-ry').value) * Math.PI / 180;
                const rz = parseFloat(pan.querySelector('#pkg-rz').value) * Math.PI / 180;

                group.position.set(x, y, z);
                group.rotation.set(rx, ry, rz);

                pkgData.x = x; pkgData.y = y; pkgData.z = z;
                pkgData.rx = rx; pkgData.ry = ry; pkgData.rz = rz;

                this.interactionManager.control.attach(group);
            }
        };
        ['#pkg-x', '#pkg-y', '#pkg-z', '#pkg-rx', '#pkg-ry', '#pkg-rz'].forEach(id => pan.querySelector(id).onchange = updateGrp);
    }

    generatePackageContent(pkg) {
        console.log("Generating content for", pkg.name, pkg.params);
        pkg.pieces = []; // Clear
        const p = pkg.params;

        for (let i = 0; i < p.qty; i++) {
            const x = i * p.spacing;
            const newPiece = {
                id: p.profileId + '_' + crypto.randomUUID().slice(0, 4),
                profileId: p.profileId,
                length: p.length,
                x: x, y: 0, z: 0,
                rx: 0, ry: 0, rz: 0,
                step: 1
            };

            // Auto-Rotate Studs
            const pro = ProfileCatalog[p.profileId];
            if (pro && (pro.type === 'stud' || pro.type === 'box')) { // Wall/Stud vertical
                newPiece.rx = -Math.PI / 2;
            }
            // Rotate Doors/Windows to stand up
            if (pro && pro.type === 'opening') {
                // Openings are boxes. Default geometry is Flat?
                // BoxGeometry(w, d, h). Mesh(box).
                // If created at 0,0 with H=210.
                // Box center is at 0,0,0.
                // We shift Y by h/2 in SteelPart.
                // So rotation might not be needed if box is aligned to Y.
            }

            pkg.pieces.push(newPiece);
        }

        this.buildSceneFromData();
        // Re-simulate selection of group
        const newGrp = this.packageGroups.get(pkg.id);
        if (newGrp) this.interactionManager.select(newGrp);
    }

    updatePropertiesPanel(object) {
        // Handle Group Update from Gizmo
        if (object.userData.isPackage) {
            const data = object.userData.data;
            data.x = object.position.x;
            data.y = object.position.y;
            data.z = object.position.z;
            data.rx = object.rotation.x;
            data.ry = object.rotation.y;
            data.rz = object.rotation.z;

            // Update UI Inputs if Visible
            const pX = this.container.querySelector('#pkg-x');
            if (pX) {
                pX.value = data.x.toFixed(0);
                this.container.querySelector('#pkg-y').value = data.y.toFixed(0);
                this.container.querySelector('#pkg-z').value = data.z.toFixed(0);

                const pRX = this.container.querySelector('#pkg-rx');
                if (pRX) {
                    pRX.value = (data.rx * 180 / Math.PI).toFixed(0);
                    this.container.querySelector('#pkg-ry').value = (data.ry * 180 / Math.PI).toFixed(0);
                    this.container.querySelector('#pkg-rz').value = (data.rz * 180 / Math.PI).toFixed(0);
                }
            }
            return;
        }

        const part = this.partsMap.get(object.userData.id);
        if (part) {
            part.data.x = object.position.x;
            part.data.y = object.position.y;
            part.data.z = object.position.z;
            part.data.ry = object.rotation.y;
            this.refreshInspectorValues(part.data);
            return;
        }
    }

    renderTree() {
        const tree = this.container.querySelector('#tree-container');
        tree.innerHTML = '';

        // Show Loose Parts first
        if (this.modelData.looseParts && this.modelData.looseParts.length > 0) {
            const looseHeader = document.createElement('div');
            looseHeader.className = 'tree-group-header';
            looseHeader.style.color = '#aaa';
            looseHeader.textContent = `🔓 Peças Soltas (${this.modelData.looseParts.length})`;
            tree.appendChild(looseHeader);

            this.modelData.looseParts.forEach(p => {
                const el = document.createElement('div');
                el.className = 'tree-item';
                el.textContent = `🔹 ${p.id}`;
                el.dataset.id = p.id;
                el.onclick = (e) => {
                    const part = this.partsMap.get(p.id);
                    if (part) this.interactionManager.select(part.mesh);
                    e.stopPropagation();
                };
                tree.appendChild(el);
            });
        }

        // Show Packages
        this.modelData.phases.forEach(ph => {
            ph.packages.forEach(pkg => {
                const grp = document.createElement('div');
                grp.className = 'tree-group-header';
                grp.textContent = `📦 ${pkg.name} (${pkg.pieces.length})`;
                grp.onclick = (e) => {
                    const group = this.packageGroups.get(pkg.id);
                    if (group) this.interactionManager.select(group);
                    e.stopPropagation();
                };
                tree.appendChild(grp);
                pkg.pieces.forEach(p => {
                    const el = document.createElement('div');
                    el.className = 'tree-item';
                    el.style.paddingLeft = '20px'; // Indent
                    el.textContent = `🔹 ${p.id}`;
                    el.dataset.id = p.id;
                    el.onclick = (e) => {
                        const part = this.partsMap.get(p.id);
                        if (part) this.interactionManager.select(part.mesh);
                        e.stopPropagation();
                    };
                    tree.appendChild(el);
                });
            });
        });
    }

    renderInspector(object) {
        console.log(`renderInspector called. suspendInspector=${this.suspendInspector}`);
        if (this.suspendInspector) {
            console.log("renderInspector BLOCKED by suspendInspector.");
            return;
        }
        const pan = this.container.querySelector('#inspector-container');
        if (!object) { pan.innerHTML = ''; return; }

        const part = this.partsMap.get(object.userData.id);
        if (!part) return; // Should not happen

        const data = part.data;
        const profile = ProfileCatalog[data.profileId];
        const isBox = (profile?.type === 'box');
        const isGable = (profile?.type === 'gable');
        const isTrama = (profile?.type === 'notched_panel');
        const isPlate = (profile?.type === 'plate');

        const isOpening = (profile?.type === 'opening');

        console.log(`Inspect: ID=${data.id} Profile=${data.profileId} Type=${profile?.type} isPlate=${isPlate} IsBox=${isBox} IsGable=${isGable} IsTrama=${isTrama} IsOpening=${isOpening}`);

        // Highlight overlapping parts in red if this is a window/door
        if (isOpening) {
            this.highlightOverlappingParts(part);
        }

        pan.innerHTML = `
            <div class="inspector-row"><label>ID</label><input type="text" id="inp-id" value="${data.id}"></div>
            <div class="inspector-row"><label>Profile</label>
                 <select id="inp-profile">${Object.keys(ProfileCatalog).map(k => `<option value="${k}" ${data.profileId === k ? 'selected' : ''}>${ProfileCatalog[k].name}</option>`).join('')}</select>
            </div>
            
            <div class="inspector-row"><label>${isBox || isGable ? 'Altura (cm)' : 'Comp. (cm)'}</label><input type="number" id="inp-len" value="${(data.length).toFixed(1)}"></div>
            
            ${isBox || isGable || isTrama ? `
            <div class="inspector-row"><label>Largura (cm)</label><input type="number" id="inp-wid" value="${(data.width !== undefined ? data.width : (isTrama ? 61 : 100)).toFixed(1)}"></div>
            <div class="inspector-row"><label>Espessura</label><input type="number" id="inp-thk" value="${(data.thickness !== undefined ? data.thickness : (isTrama ? 9 : 10)).toFixed(1)}"></div>
            ` : ''}

            ${isPlate ? `
            <div class="inspector-row"><label>Largura (cm)</label><input type="number" id="inp-wid" value="${(data.width !== undefined ? data.width : (profile.width ? profile.width * 0.1 : 100)).toFixed(1)}"></div>
            <div class="inspector-row"><label>Alt. Onda</label><input type="number" id="inp-hei" value="${(data.height !== undefined ? data.height : (profile.flange ? profile.flange * 0.1 : 4)).toFixed(1)}"></div>
            ` : ''}
            
            ${isBox ? `
            <div style="margin-top:10px; border-top:1px solid #666; padding-top:8px;">
                <label style="color:#ff9944; font-weight:bold;">✂️ Definir Corte (Abertura)</label>
                <div class="inspector-row"><label>Início Horiz. (cm)</label><input type="number" id="cut-start-y" value="${data.cutStartY !== undefined ? data.cutStartY : 20}" min="0"></div>
                <div class="inspector-row"><label>Fim Horiz. (cm)</label><input type="number" id="cut-end-y" value="${data.cutEndY !== undefined ? data.cutEndY : 80}" min="0"></div>
                <div class="inspector-row"><label>Início Vert. (cm)</label><input type="number" id="cut-start-z" value="${data.cutStartZ !== undefined ? data.cutStartZ : 50}" min="0"></div>
                <div class="inspector-row"><label>Fim Vert. (cm)</label><input type="number" id="cut-end-z" value="${data.cutEndZ !== undefined ? data.cutEndZ : 200}" min="0"></div>
                <button id="btn-preview-cut" class="tool-btn" style="width:100%; margin-top:8px; border:2px solid #ffaa00; color:#ffaa00; background:#332200;">
                    👁️ Pré-visualizar Corte
                </button>
                <button id="btn-confirm-cut" class="tool-btn" style="width:100%; margin-top:6px; border:2px solid #44ff44; color:#44ff44; background:#113311; display:none;">
                    ✅ Confirmar Corte
                </button>
                <button id="btn-cancel-cut" class="tool-btn" style="width:100%; margin-top:4px; border:1px solid #888; color:#888; display:none;">
                    ❌ Cancelar Preview
                </button>
            </div>
            ` : ''}

            ${profile?.type === 'opening' ? `
            <div class="inspector-row"><label>Largura (cm)</label><input type="number" id="inp-wid" value="${(data.width !== undefined ? data.width : (profile.width ? profile.width / 10 : 80)).toFixed(1)}"></div>
            <div class="inspector-row"><label>Altura (cm)</label><input type="number" id="inp-hei" value="${(data.height !== undefined ? data.height : (profile.height ? profile.height / 10 : 210)).toFixed(1)}"></div>
            <div style="margin-top:10px; margin-bottom:10px;">
                <button id="btn-cut-walls" class="tool-btn" style="width:100%; border:1px solid #ff4444; color:#ff4444;">✂️ Cortar Sobreposições</button>
            </div>
            ` : ''}
            
            ${isGable ? `
            <div class="inspector-row"><label>Inclinação (%)</label><input type="number" id="inp-slope" value="${data.slope !== undefined ? data.slope : 0}" min="0" max="100"></div>
            <div class="inspector-row"><label>Tipo Corte</label>
            <select id="inp-cutType">
            <option value="GABLE" ${(data.cutType === 'center' || data.cutType === 'GABLE') ? 'selected' : ''}>Duas Águas (Central)</option>
            <option value="LEFT_HIGH" ${(data.cutType === 'left' || data.cutType === 'LEFT_HIGH') ? 'selected' : ''}>Meia-Água (Sobe p/ Esq.)</option>
            <option value="RIGHT_HIGH" ${(data.cutType === 'right' || data.cutType === 'RIGHT_HIGH') ? 'selected' : ''}>Meia-Água (Sobe p/ Dir.)</option>
            </select>
            </div>
            ` : ''}

            <div class="inspector-row"><label>Pos</label>
                <div class="input-group-3">
                    <input type="number" id="inp-x" value="${(data.x).toFixed(1)}">
                    <input type="number" id="inp-y" value="${(data.y).toFixed(1)}">
                    <input type="number" id="inp-z" value="${(data.z).toFixed(1)}">
                </div>
            </div>
            <div class="inspector-row"><label>Rot</label>
                <div class="input-group-3">
                    <input type="number" id="inp-rx" value="${(data.rx * 180 / Math.PI || 0).toFixed(0)}">
                    <input type="number" id="inp-ry" value="${(data.ry * 180 / Math.PI || 0).toFixed(0)}">
                    <input type="number" id="inp-rz" value="${(data.rz * 180 / Math.PI || 0).toFixed(0)}">
                </div>
            </div>
             <div class="inspector-row"><label>Passo</label><input type="number" id="inp-step" value="${data.step || 1}"></div>
             
             <div style="margin-top:10px; border-top:1px solid #444; padding-top:5px;">
                <label>Duplicação</label>
                <div class="inspector-row">
                    <input type="number" id="clone-qty" value="1" min="1" style="width:50px">
                    <button id="btn-prop-clone" class="btn-secondary" style="flex:1;">Clonar</button>
                </div>
             </div>

             <!-- Assembly Instructions Section -->
             <div style="margin-top:15px; border-top:1px solid #444; padding-top:10px;">
                <div id="instructions-header" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                    <label style="font-weight:bold;">📝 Instruções de Montagem</label>
                    <span id="instructions-toggle" style="color:#888;">▼</span>
                </div>
                <div id="instructions-body" style="display:none; margin-top:10px;">
                    <div class="inspector-row" style="flex-direction:column; align-items:stretch;">
                        <label style="margin-bottom:5px;">Texto:</label>
                        <textarea id="inp-instructions-text" rows="4" style="width:100%; background:#333; color:#fff; border:1px solid #555; border-radius:4px; padding:8px; resize:vertical;">${data.instructions?.text || ''}</textarea>
                    </div>
                    <div class="inspector-row" style="flex-direction:column; align-items:stretch; margin-top:10px;">
                        <label style="margin-bottom:5px;">Imagens:</label>
                        <div id="instructions-images" style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:8px;">
                            ${(data.instructions?.images || []).map((img, i) => `
                                <div style="position:relative; width:60px; height:60px;">
                                    <img src="${img}" style="width:100%; height:100%; object-fit:cover; border-radius:4px; border:1px solid #555;">
                                    <button class="remove-img-btn" data-idx="${i}" style="position:absolute; top:-5px; right:-5px; background:#ff4444; color:#fff; border:none; border-radius:50%; width:18px; height:18px; font-size:10px; cursor:pointer;">×</button>
                                </div>
                            `).join('')}
                        </div>
                        <input type="file" id="inp-instructions-img" accept="image/*" style="font-size:0.8rem;">
                    </div>
                    <div class="inspector-row" style="flex-direction:column; align-items:stretch; margin-top:10px;">
                        <label style="margin-bottom:5px;">Vídeo (YouTube/Vimeo URL):</label>
                        <input type="text" id="inp-instructions-video" placeholder="https://youtube.com/watch?v=..." value="${data.instructions?.video || ''}" style="background:#333; color:#fff; border:1px solid #555; border-radius:4px; padding:6px;">
                    </div>
                    <div class="inspector-row" style="flex-direction:column; align-items:stretch; margin-top:10px;">
                        <label style="margin-bottom:5px;">Notas Adicionais:</label>
                        <input type="text" id="inp-instructions-notes" placeholder="Observações..." value="${data.instructions?.notes || ''}" style="background:#333; color:#fff; border:1px solid #555; border-radius:4px; padding:6px;">
                    </div>
                </div>
             </div>
        `;

        pan.querySelector('#inp-len').onchange = (e) => part.updateLength(parseFloat(e.target.value)); // Already in CM
        pan.querySelector('#inp-profile').onchange = (e) => part.updateProfile(e.target.value);
        pan.querySelector('#inp-id').onchange = (e) => {
            const newId = e.target.value;
            this.partsMap.delete(data.id);
            data.id = newId;
            part.mesh.userData.id = newId;
            this.partsMap.set(newId, part);
            this.renderTree();
        };

        // Bind Clone Button - SIMPLE DIRECT APPROACH
        pan.querySelector('#btn-prop-clone').onclick = () => {
            const qty = parseInt(pan.querySelector('#clone-qty').value) || 1;
            console.log(`Cloning ${qty} copies of ${data.id}`);

            // Get profile info for offset calculation
            const profile = ProfileCatalog[data.profileId];
            let offX = 60; // Default 60cm spacing
            if (profile && profile.type === 'track') offX = 0; // Tracks stack at same X?
            // For simplicity, always offset Y by small amount to avoid overlap
            const offY = 10;

            // Find the package this part belongs to (or null if loose)
            const isLoose = part.mesh.userData.isLoose || !data.packageId;
            let packageId = data.packageId || part.mesh.userData.packageId;
            let pkg = null;

            if (!isLoose && packageId) {
                pkg = this.findPackage(packageId);
            }

            // Clone N times
            let lastStep = parseInt(data.step || 1);
            let lastX = data.x;
            let lastY = data.y;

            const createdMeshes = [];

            for (let i = 0; i < qty; i++) {
                lastStep++;
                lastX += offX;
                lastY += offY;

                const newId = data.profileId + '_' + crypto.randomUUID().slice(0, 4);

                const newPiece = {
                    ...data, // Copy all properties
                    id: newId,
                    x: lastX,
                    y: lastY,
                    step: lastStep,
                    packageId: isLoose ? null : packageId
                };

                let newPart;
                if (isLoose || !pkg) {
                    // Clone as loose part
                    this.modelData.looseParts.push(newPiece);
                    newPart = this.instantiateLoosePart(newPiece);
                } else {
                    // Clone into package
                    pkg.pieces.push(newPiece);
                    newPart = this.instantiatePart(newPiece, pkg.id);
                }
                createdMeshes.push(newPart.mesh);

                console.log(`Created clone ${i + 1}/${qty}: ${newId} (step ${lastStep})`);
            }

            console.log(`Clone complete. Created ${createdMeshes.length} parts.`);

            // Select the last created part
            if (createdMeshes.length > 0) {
                this.interactionManager.deselectAll();
                this.interactionManager.select(createdMeshes[createdMeshes.length - 1]);
            }

            this.renderTree();
            // Refresh Inspector with the last created part
            if (createdMeshes.length > 0) {
                this.renderInspector(createdMeshes[createdMeshes.length - 1]);
            }
        };

        // Bind Resize Handlers for Windows
        const inpWid = pan.querySelector('#inp-wid');
        if (inpWid) inpWid.onchange = (e) => part.updateWidth(parseFloat(e.target.value));

        const inpHei = pan.querySelector('#inp-hei');
        if (inpHei) inpHei.onchange = (e) => part.updateHeight(parseFloat(e.target.value));

        const btnCut = pan.querySelector('#btn-cut-walls');
        console.log("Cut button found:", btnCut);
        if (btnCut) {
            btnCut.onclick = () => {
                console.log("CUT BUTTON CLICKED! Calling handleCutOverlap...");
                this.handleCutOverlap(part);
            };
        }

        if (isBox || isGable || isTrama) {
            pan.querySelector('#inp-wid').onchange = (e) => { data.width = parseFloat(e.target.value); part.build(); };
            pan.querySelector('#inp-thk').onchange = (e) => { data.thickness = parseFloat(e.target.value); part.build(); };
        }

        if (isPlate) {
            pan.querySelector('#inp-wid').onchange = (e) => { data.width = parseFloat(e.target.value); part.build(); };
            pan.querySelector('#inp-hei').onchange = (e) => { data.height = parseFloat(e.target.value); part.build(); };
        }

        if (isGable) {
            const inpSlope = pan.querySelector('#inp-slope');
            if (inpSlope) inpSlope.onchange = (e) => { data.slope = parseFloat(e.target.value); part.build(); };

            const inpCutType = pan.querySelector('#inp-cutType');
            if (inpCutType) inpCutType.onchange = (e) => { data.cutType = e.target.value; part.build(); };
        }

        // Wall Cut Preview/Confirm Handlers
        const btnPreviewCut = pan.querySelector('#btn-preview-cut');
        const btnConfirmCut = pan.querySelector('#btn-confirm-cut');
        const btnCancelCut = pan.querySelector('#btn-cancel-cut');

        if (btnPreviewCut) {
            // Function to update the cut preview box
            const updateCutPreview = () => {
                const cutStartY = parseFloat(pan.querySelector('#cut-start-y').value) || 0;
                const cutEndY = parseFloat(pan.querySelector('#cut-end-y').value) || 0;
                const cutStartZ = parseFloat(pan.querySelector('#cut-start-z').value) || 0;
                const cutEndZ = parseFloat(pan.querySelector('#cut-end-z').value) || 0;

                this.showCutPreview(part, cutStartY, cutEndY, cutStartZ, cutEndZ);
            };

            // Preview button shows the red box
            btnPreviewCut.onclick = () => {
                updateCutPreview();
                // Show confirm and cancel buttons
                btnConfirmCut.style.display = 'block';
                btnCancelCut.style.display = 'block';
                // Disable piece interaction and camera controls during cut mode
                this.cutModeActive = true;
                if (this.interactionManager) {
                    this.interactionManager.enabled = false;
                }
                // Disable orbit controls so we can drag the cut preview
                if (this.sceneManager && this.sceneManager.controls) {
                    this.sceneManager.controls.enabled = false;
                }
            };

            // Update preview when inputs change
            ['#cut-start-y', '#cut-end-y', '#cut-start-z', '#cut-end-z'].forEach(sel => {
                const input = pan.querySelector(sel);
                if (input) {
                    input.oninput = () => {
                        if (btnConfirmCut.style.display === 'block') {
                            updateCutPreview();
                        }
                    };
                }
            });

            // Confirm button applies the cut
            if (btnConfirmCut) {
                btnConfirmCut.onclick = () => {
                    const cutStartY = parseFloat(pan.querySelector('#cut-start-y').value);
                    const cutEndY = parseFloat(pan.querySelector('#cut-end-y').value);
                    const cutStartZ = parseFloat(pan.querySelector('#cut-start-z').value);
                    const cutEndZ = parseFloat(pan.querySelector('#cut-end-z').value);

                    this.clearCutPreview();
                    this.applyWallCut(part, cutStartY, cutEndY, cutStartZ, cutEndZ);

                    // Hide buttons and re-enable interaction
                    btnConfirmCut.style.display = 'none';
                    btnCancelCut.style.display = 'none';
                    this.cutModeActive = false;
                    if (this.interactionManager) {
                        this.interactionManager.enabled = true;
                    }
                    // Re-enable orbit controls
                    if (this.sceneManager && this.sceneManager.controls) {
                        this.sceneManager.controls.enabled = true;
                    }
                };
            }

            // Cancel button removes preview
            if (btnCancelCut) {
                btnCancelCut.onclick = () => {
                    this.clearCutPreview();
                    btnConfirmCut.style.display = 'none';
                    btnCancelCut.style.display = 'none';
                    // Re-enable piece interaction
                    this.cutModeActive = false;
                    if (this.interactionManager) {
                        this.interactionManager.enabled = true;
                    }
                    // Re-enable orbit controls
                    if (this.sceneManager && this.sceneManager.controls) {
                        this.sceneManager.controls.enabled = true;
                    }
                };
            }
        }

        if (isGable) {
            pan.querySelector('#inp-slope').onchange = (e) => { data.slope = parseFloat(e.target.value); part.build(); };
            pan.querySelector('#inp-cutType').onchange = (e) => { data.cutType = e.target.value; part.build(); };
        }

        const updatePos = () => {
            const x = parseFloat(pan.querySelector('#inp-x').value);
            const y = parseFloat(pan.querySelector('#inp-y').value);
            const z = parseFloat(pan.querySelector('#inp-z').value);
            const rx = parseFloat(pan.querySelector('#inp-rx').value) * Math.PI / 180;
            const ry = parseFloat(pan.querySelector('#inp-ry').value) * Math.PI / 180;
            const rz = parseFloat(pan.querySelector('#inp-rz').value) * Math.PI / 180;
            const st = parseInt(pan.querySelector('#inp-step').value);

            part.mesh.position.set(x, y, z);
            part.mesh.rotation.set(rx, ry, rz);
            data.x = x; data.y = y; data.z = z; data.rx = rx; data.ry = ry; data.rz = rz; data.step = st;
            this.interactionManager.control.attach(part.mesh);
        };
        ['#inp-x', '#inp-y', '#inp-z', '#inp-rx', '#inp-ry', '#inp-rz', '#inp-step'].forEach(sel => pan.querySelector(sel).onchange = updatePos);

        // --- INSTRUCTIONS BINDINGS ---
        // Toggle accordion
        const instructionsHeader = pan.querySelector('#instructions-header');
        const instructionsBody = pan.querySelector('#instructions-body');
        const instructionsToggle = pan.querySelector('#instructions-toggle');
        if (instructionsHeader && instructionsBody) {
            instructionsHeader.onclick = () => {
                const isHidden = instructionsBody.style.display === 'none';
                instructionsBody.style.display = isHidden ? 'block' : 'none';
                instructionsToggle.textContent = isHidden ? '▲' : '▼';
            };
        }

        // Initialize instructions object if not exists
        if (!data.instructions) {
            data.instructions = { text: '', images: [], video: '', notes: '' };
        }

        // Save text on change
        const inpText = pan.querySelector('#inp-instructions-text');
        if (inpText) {
            inpText.onchange = () => { data.instructions.text = inpText.value; };
        }

        // Save video URL on change
        const inpVideo = pan.querySelector('#inp-instructions-video');
        if (inpVideo) {
            inpVideo.onchange = () => { data.instructions.video = inpVideo.value; };
        }

        // Save notes on change
        const inpNotes = pan.querySelector('#inp-instructions-notes');
        if (inpNotes) {
            inpNotes.onchange = () => { data.instructions.notes = inpNotes.value; };
        }

        // Image upload (base64)
        const inpImg = pan.querySelector('#inp-instructions-img');
        if (inpImg) {
            inpImg.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (!data.instructions.images) data.instructions.images = [];
                    data.instructions.images.push(ev.target.result); // base64 string
                    this.renderInspector(object); // Re-render to show new image
                };
                reader.readAsDataURL(file);
            };
        }

        // Remove image buttons
        pan.querySelectorAll('.remove-img-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.idx);
                if (data.instructions.images && data.instructions.images[idx] !== undefined) {
                    data.instructions.images.splice(idx, 1);
                    this.renderInspector(object); // Re-render
                }
            };
        });
    }

    refreshInspectorValues(data) {
        const pan = this.container.querySelector('#inspector-container');
        const inpX = pan.querySelector('#inp-x');
        if (inpX) {
            inpX.value = (data.x).toFixed(1);
            pan.querySelector('#inp-y').value = (data.y).toFixed(1);
            pan.querySelector('#inp-z').value = (data.z).toFixed(1);
        }
    }

    updateTimeline(val) {
        this.container.querySelector('#timeline-value').textContent = val;
        const limit = Math.ceil(val / 10);
        this.partsMap.forEach(part => {
            const visible = (part.data.step || 1) <= limit;
            part.setGhost(!visible);
        });
    }

    updateTreeSelection(object) {
        this.container.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
        if (object && object.userData.id) {
            const el = this.container.querySelector(`.tree-item[data-id="${object.userData.id}"]`);
            if (el) el.classList.add('selected');
        }
    }

    onObjectSelected(object) {
        this.renderInspector(object);
        this.updateTreeSelection(object);
    }

    updatePropertiesPanel(object) {
        if (object && object.userData.isPackage) {
            this.renderPackageInspector(object.userData.data);
        } else {
            this.renderInspector(object);
        }
    }

    async saveModel() {
        // Ask for project name using custom modal
        const projectName = await this.showPrompt("Nome do Projeto:", this.modelData.name || "Novo Projeto");
        if (!projectName) {
            console.log("Save cancelled by user.");
            return;
        }
        this.modelData.name = projectName;

        console.log("Saving model:", this.modelData.name);

        // Update package positions from 3D groups
        this.packageGroups.forEach((group, pkgId) => {
            const pkg = this.findPackage(pkgId);
            if (pkg) {
                pkg.x = group.position.x;
                pkg.y = group.position.y;
                pkg.z = group.position.z;
                pkg.rx = group.rotation.x;
                pkg.ry = group.rotation.y;
                pkg.rz = group.rotation.z;
            }
        });

        // Update part positions from 3D meshes
        this.partsMap.forEach((part, partId) => {
            if (part.mesh && part.data) {
                part.data.x = part.mesh.position.x;
                part.data.y = part.mesh.position.y;
                part.data.z = part.mesh.position.z;
                part.data.rx = part.mesh.rotation.x;
                part.data.ry = part.mesh.rotation.y;
                part.data.rz = part.mesh.rotation.z;
            }
        });

        const modelToSave = {
            id: this.currentModelId,
            name: this.modelData.name || 'Modelo sem nome',
            data: this.modelData
        };

        this.modelStore.saveModel(modelToSave);
        alert("Modelo salvo com sucesso!");
        console.log("Model saved:", modelToSave);
    }

    updateToolState(mode) {
        const moveBtn = this.container.querySelector('#tool-move');
        const rotBtn = this.container.querySelector('#tool-rotate');

        if (moveBtn) {
            moveBtn.style.background = mode === 'translate' ? '#444' : '';
            moveBtn.style.borderColor = mode === 'translate' ? '#fff' : '#555';
            moveBtn.style.color = mode === 'translate' ? '#fff' : '#eee';
        }
        if (rotBtn) {
            rotBtn.style.background = mode === 'rotate' ? '#444' : '';
            rotBtn.style.borderColor = mode === 'rotate' ? '#fff' : '#555';
            rotBtn.style.color = mode === 'rotate' ? '#fff' : '#eee';
        }
    }

    destroy() {
        this.active = false;
        window.removeEventListener('resize', this.resizeHandler);
        if (this.interactionManager) this.interactionManager.control.detach();
    }

    highlightOverlappingParts(windowPart) {
        // First clear any previous highlights
        this.clearOverlapHighlights();

        const windowMesh = windowPart.mesh;
        windowMesh.updateMatrixWorld(true);
        const winBox = new THREE.Box3().setFromObject(windowMesh);

        console.log("Checking overlaps for window:", windowPart.data.id, winBox.min, winBox.max);

        // Store preview meshes for cleanup
        if (!this.overlapPreviewMeshes) this.overlapPreviewMeshes = [];

        // Create red material for intersection visualization
        const redMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.7,
            depthTest: true
        });

        this.partsMap.forEach(part => {
            if (part.data.id === windowPart.data.id) return;

            const profile = ProfileCatalog[part.data.profileId];
            if (!profile) return;

            const isStud = (profile.type === 'stud');
            const isBox = (profile.type === 'box');

            if (!isStud && !isBox) return;

            const targetMesh = part.mesh;
            targetMesh.updateMatrixWorld(true);
            const targetBox = new THREE.Box3().setFromObject(targetMesh);

            if (winBox.intersectsBox(targetBox)) {
                console.log("OVERLAP FOUND:", part.data.id);

                // Calculate the INTERSECTION box (only the overlapping volume)
                const intersectionBox = new THREE.Box3();
                intersectionBox.min.x = Math.max(winBox.min.x, targetBox.min.x);
                intersectionBox.min.y = Math.max(winBox.min.y, targetBox.min.y);
                intersectionBox.min.z = Math.max(winBox.min.z, targetBox.min.z);
                intersectionBox.max.x = Math.min(winBox.max.x, targetBox.max.x);
                intersectionBox.max.y = Math.min(winBox.max.y, targetBox.max.y);
                intersectionBox.max.z = Math.min(winBox.max.z, targetBox.max.z);

                // Create a box mesh for the intersection volume
                const size = new THREE.Vector3();
                intersectionBox.getSize(size);

                const center = new THREE.Vector3();
                intersectionBox.getCenter(center);

                console.log("Intersection size:", size, "center:", center);

                if (size.x > 0.1 && size.y > 0.1 && size.z > 0.1) {
                    const previewGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
                    const previewMesh = new THREE.Mesh(previewGeo, redMaterial);
                    previewMesh.position.copy(center);

                    // Add wireframe for clarity
                    const edges = new THREE.EdgesGeometry(previewGeo);
                    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
                    const wireframe = new THREE.LineSegments(edges, lineMat);
                    previewMesh.add(wireframe);

                    this.sceneManager.scene.add(previewMesh);
                    this.overlapPreviewMeshes.push(previewMesh);
                }
            }
        });
    }

    clearOverlapHighlights() {
        // Remove preview meshes
        if (this.overlapPreviewMeshes) {
            this.overlapPreviewMeshes.forEach(mesh => {
                this.sceneManager.scene.remove(mesh);
                if (mesh.geometry) mesh.geometry.dispose();
            });
            this.overlapPreviewMeshes = [];
        }
    }

    /**
     * Show a red preview box indicating where the cut will be made on a wall
     * Adds preview as CHILD of wall mesh so it moves with the wall
     */
    showCutPreview(wallPart, cutStartY, cutEndY, cutStartZ, cutEndZ) {
        // Clear any existing preview
        this.clearCutPreview();

        const wallData = wallPart.data;
        const wallMesh = wallPart.mesh;
        const SCALE = 0.3;

        // Wall dimensions in scene units
        const wallThickness = (wallData.thickness || 10) * SCALE;
        const wallWidth = (wallData.width || 61) * SCALE;
        const wallHeight = (wallData.length || 280) * SCALE;

        // Cut dimensions in scene units
        const cutWidth = (cutEndY - cutStartY) * SCALE;
        const cutHeight = (cutEndZ - cutStartZ) * SCALE;

        // Calculate LOCAL position within wall (wall center is at 0,0,0 locally)
        const localY = (cutStartY * SCALE) + (cutWidth / 2) - (wallWidth / 2);
        const localZ = (cutStartZ * SCALE) + (cutHeight / 2) - (wallHeight / 2);

        console.log(`Cut preview: dims=${cutWidth.toFixed(2)}x${cutHeight.toFixed(2)}, pos=(${localY.toFixed(2)}, ${localZ.toFixed(2)})`);

        // Create red semi-transparent box for the cut area
        const previewGeo = new THREE.BoxGeometry(wallThickness * 1.05, cutWidth, cutHeight);
        const previewMat = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.8,
            depthTest: false,
            side: THREE.DoubleSide
        });

        const previewMesh = new THREE.Mesh(previewGeo, previewMat);
        previewMesh.position.set(0, localY, localZ);

        // Add wireframe edges
        const edges = new THREE.EdgesGeometry(previewGeo);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 });
        const wireframe = new THREE.LineSegments(edges, lineMat);
        previewMesh.add(wireframe);

        // Add as child of wall mesh
        wallMesh.add(previewMesh);

        // Store data for dragging
        this.cutPreviewMesh = previewMesh;
        this.cutPreviewParent = wallMesh;
        this.cutPreviewData = {
            wallPart: wallPart,
            wallWidth: wallWidth,
            wallHeight: wallHeight,
            cutWidth: cutWidth,
            cutHeight: cutHeight,
            scale: SCALE
        };

        // Mark as draggable for interaction
        previewMesh.userData.isDraggable = true;
        previewMesh.userData.type = 'cutPreview';

        // Enable dragging mode
        this.setupCutDragging();
    }

    /**
     * Setup mouse handlers for dragging the cut preview
     * During cut mode, any drag on canvas moves the preview
     */
    setupCutDragging() {
        if (this.cutDragHandlersSetup) return;

        const canvas = this.sceneManager.renderer.domElement;
        let isDragging = false;

        const onMouseDown = (e) => {
            if (!this.cutModeActive || !this.cutPreviewMesh) return;
            isDragging = true;
            canvas.style.cursor = 'grabbing';
            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (!isDragging || !this.cutPreviewMesh || !this.cutPreviewData) return;

            const data = this.cutPreviewData;
            // movementX/Y are in pixels, scale down for scene movement
            const movementY = e.movementX * 0.02;  // horizontal mouse -> Y axis
            const movementZ = -e.movementY * 0.02; // vertical mouse -> Z axis (inverted)

            // Update position - no clamping, allow cuts outside wall bounds
            let newY = this.cutPreviewMesh.position.y + movementY;
            let newZ = this.cutPreviewMesh.position.z + movementZ;

            this.cutPreviewMesh.position.y = newY;
            this.cutPreviewMesh.position.z = newZ;

            // Update input fields
            this.updateCutInputsFromPreview();
        };

        const onMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                canvas.style.cursor = 'default';
            }
        };

        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('mouseleave', onMouseUp);

        this.cutDragHandlersSetup = true;
        this.cutDragCleanup = () => {
            canvas.removeEventListener('mousedown', onMouseDown);
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('mouseup', onMouseUp);
            canvas.removeEventListener('mouseleave', onMouseUp);
            this.cutDragHandlersSetup = false;
        };
    }

    /**
     * Update cut input fields from preview position
     */
    updateCutInputsFromPreview() {
        if (!this.cutPreviewMesh || !this.cutPreviewData) return;

        const data = this.cutPreviewData;
        const pos = this.cutPreviewMesh.position;

        // Convert from local position back to cm values
        // pos.y is offset from wall center, add half wall width to get from corner
        // pos.z is offset from wall center, add half wall height to get from corner
        const cutCenterY = pos.y + data.wallWidth / 2;
        const cutCenterZ = pos.z + data.wallHeight / 2;

        const startY = (cutCenterY - data.cutWidth / 2) / data.scale;
        const endY = (cutCenterY + data.cutWidth / 2) / data.scale;
        const startZ = (cutCenterZ - data.cutHeight / 2) / data.scale;
        const endZ = (cutCenterZ + data.cutHeight / 2) / data.scale;

        console.log(`updateCutInputsFromPreview: pos.y=${pos.y.toFixed(2)}, pos.z=${pos.z.toFixed(2)}`);
        console.log(`  -> startY=${startY.toFixed(1)}, endY=${endY.toFixed(1)}, startZ=${startZ.toFixed(1)}, endZ=${endZ.toFixed(1)}`);

        // Update input fields - use document.getElementById since inputs have unique IDs
        const inpStartY = document.getElementById('cut-start-y');
        const inpEndY = document.getElementById('cut-end-y');
        const inpStartZ = document.getElementById('cut-start-z');
        const inpEndZ = document.getElementById('cut-end-z');

        console.log(`Found inputs: startY=${!!inpStartY}, endY=${!!inpEndY}, startZ=${!!inpStartZ}, endZ=${!!inpEndZ}`);

        if (inpStartY) inpStartY.value = startY.toFixed(1);
        if (inpEndY) inpEndY.value = endY.toFixed(1);
        if (inpStartZ) inpStartZ.value = startZ.toFixed(1);
        if (inpEndZ) inpEndZ.value = endZ.toFixed(1);
    }

    /**
     * Clear the cut preview box
     */
    clearCutPreview() {
        if (this.cutPreviewMesh && this.cutPreviewParent) {
            this.cutPreviewParent.remove(this.cutPreviewMesh);
            if (this.cutPreviewMesh.geometry) this.cutPreviewMesh.geometry.dispose();
            if (this.cutPreviewMesh.material) this.cutPreviewMesh.material.dispose();
            this.cutPreviewMesh = null;
            this.cutPreviewParent = null;
        } else if (this.cutPreviewMesh) {
            this.sceneManager.scene.remove(this.cutPreviewMesh);
            if (this.cutPreviewMesh.geometry) this.cutPreviewMesh.geometry.dispose();
            if (this.cutPreviewMesh.material) this.cutPreviewMesh.material.dispose();
            this.cutPreviewMesh = null;
        }
    }

    /**
     * Apply a cut (hole) to a wall - keeps wall as single piece with opening
     * Adds cut to wall.data.cuts array and rebuilds geometry
     */
    applyWallCut(wallPart, cutStartY, cutEndY, cutStartZ, cutEndZ) {
        console.log("=== APPLYING WALL CUT (SINGLE PIECE) ===");

        // Save state for undo
        this.saveUndoState();

        const wallData = wallPart.data;
        const wallWidth = wallData.width || 100; // Y axis (horizontal)
        const wallHeight = wallData.length || 280; // Z axis (vertical)

        console.log(`Wall: width=${wallWidth}cm, height=${wallHeight}cm`);
        console.log(`Cut: Y=[${cutStartY}, ${cutEndY}], Z=[${cutStartZ}, ${cutEndZ}]`);

        // Clamp cut values to wall bounds (for edge cuts that go outside)
        const clampedStartY = Math.max(0, cutStartY);
        const clampedEndY = Math.min(wallWidth, cutEndY);
        const clampedStartZ = Math.max(0, cutStartZ);
        const clampedEndZ = Math.min(wallHeight, cutEndZ);

        console.log(`Clamped cut: Y=[${clampedStartY}, ${clampedEndY}], Z=[${clampedStartZ}, ${clampedEndZ}]`);

        // Validate that there's actually something to cut after clamping
        if (clampedStartY >= clampedEndY || clampedStartZ >= clampedEndZ) {
            alert("O corte está fora da parede ou tem dimensões inválidas!");
            return;
        }

        // Initialize cuts array if doesn't exist
        if (!wallData.cuts) {
            wallData.cuts = [];
        }

        // Add the new cut to the array (use clamped values)
        const newCut = {
            startY: clampedStartY,
            endY: clampedEndY,
            startZ: clampedStartZ,
            endZ: clampedEndZ
        };
        wallData.cuts.push(newCut);

        console.log(`Wall now has ${wallData.cuts.length} cut(s)`);

        // Rebuild the wall geometry
        wallPart.build();

        this.renderTree();
        alert(`Corte adicionado!\nA parede agora tem ${wallData.cuts.length} abertura(s).`);
        console.log("=== WALL CUT COMPLETE ===");
    }

    handleCutOverlap(windowPart) {
        try {
            // Clear preview highlights first
            this.clearOverlapHighlights();

            // Skip confirm for now to debug - just execute
            console.log("=== STARTING WALL CUT (NO CONFIRM) ===");
            console.log("Window Part ID:", windowPart.data.id);

            // Get Window Bounding Box in World Space
            const windowMesh = windowPart.mesh;
            windowMesh.updateMatrixWorld(true);
            const winBox = new THREE.Box3().setFromObject(windowMesh);

            console.log("Window BBox min:", winBox.min.x.toFixed(2), winBox.min.y.toFixed(2), winBox.min.z.toFixed(2));
            console.log("Window BBox max:", winBox.max.x.toFixed(2), winBox.max.y.toFixed(2), winBox.max.z.toFixed(2));

            const partsToRemove = [];
            const partsToAdd = [];

            // Find all parts that intersect with the window
            this.partsMap.forEach((part, partId) => {
                if (part.data.id === windowPart.data.id) return; // Skip self

                const profile = ProfileCatalog[part.data.profileId];
                if (!profile) return;

                // Only process walls and studs
                if (profile.type !== 'stud' && profile.type !== 'box') return;

                const targetMesh = part.mesh;
                targetMesh.updateMatrixWorld(true);
                const targetBox = new THREE.Box3().setFromObject(targetMesh);

                console.log(`Checking ${part.data.id} (${profile.type})`);

                if (winBox.intersectsBox(targetBox)) {
                    console.log(`  ==> COLLISION!`);

                    // Get wall dimensions from DATA (local, in cm)
                    const wallData = part.data;
                    const wallHeight = wallData.length || 280; // Z in scene = height
                    const wallWidth = wallData.width || 61; // Y in scene = width
                    const wallThickness = wallData.thickness || 10; // X in scene

                    // Get wall position from DATA
                    const wallX = wallData.x || 0;
                    const wallY = wallData.y || 0;
                    const wallZ = wallData.z || 0;

                    console.log(`  Wall data: height=${wallHeight}cm, width=${wallWidth}cm, pos=(${wallX}, ${wallY}, ${wallZ})`);

                    // Calculate window bounds relative to wall's local coordinate system
                    // Window is in world space, wall is positioned at wallX, wallY, wallZ
                    const SCALE = 0.3;

                    // Get window dimensions relative to the wall position
                    // Convert world bbox to local wall coordinates
                    const winMinLocalY = (winBox.min.y - (wallY * SCALE)) / SCALE; // Y in scene = width axis
                    const winMaxLocalY = (winBox.max.y - (wallY * SCALE)) / SCALE;
                    const winMinLocalZ = (winBox.min.z - (wallZ * SCALE)) / SCALE; // Z in scene = height axis
                    const winMaxLocalZ = (winBox.max.z - (wallZ * SCALE)) / SCALE;

                    console.log(`  Window local bounds: Y=[${winMinLocalY.toFixed(1)}, ${winMaxLocalY.toFixed(1)}], Z=[${winMinLocalZ.toFixed(1)}, ${winMaxLocalZ.toFixed(1)}]`);
                    console.log(`  Wall local bounds:   Y=[0, ${wallWidth}], Z=[0, ${wallHeight}]`);

                    // Clamp window bounds to wall bounds
                    const cutMinY = Math.max(0, winMinLocalY);
                    const cutMaxY = Math.min(wallWidth, winMaxLocalY);
                    const cutMinZ = Math.max(0, winMinLocalZ);
                    const cutMaxZ = Math.min(wallHeight, winMaxLocalZ);

                    const cutWidth = cutMaxY - cutMinY;
                    const cutHeight = cutMaxZ - cutMinZ;

                    console.log(`  Cut region: Y=[${cutMinY.toFixed(1)}, ${cutMaxY.toFixed(1)}] (${cutWidth.toFixed(1)}cm), Z=[${cutMinZ.toFixed(1)}, ${cutMaxZ.toFixed(1)}] (${cutHeight.toFixed(1)}cm)`);

                    // If cut is too small, skip
                    if (cutWidth < 1 || cutHeight < 1) {
                        console.log(`  Cut too small, skipping`);
                        return;
                    }

                    // Create remaining pieces (only if they have substantial size)
                    const MIN_SIZE = 5; // Minimum 5cm for a piece

                    // BOTTOM piece (from Z=0 to cutMinZ)
                    if (cutMinZ > MIN_SIZE) {
                        const pBot = { ...wallData };
                        pBot.id = wallData.profileId + '_BOT_' + Math.random().toString(36).slice(2, 6);
                        pBot.length = cutMinZ; // Height (Z)
                        // Keep same Y/width and X/Z position
                        partsToAdd.push(pBot);
                        console.log(`  Created BOTTOM: height=${cutMinZ.toFixed(1)}cm`);
                    }

                    // TOP piece (from cutMaxZ to wallHeight)
                    const topHeight = wallHeight - cutMaxZ;
                    if (topHeight > MIN_SIZE) {
                        const pTop = { ...wallData };
                        pTop.id = wallData.profileId + '_TOP_' + Math.random().toString(36).slice(2, 6);
                        pTop.length = topHeight; // Height (Z)
                        pTop.z = wallZ + cutMaxZ * SCALE; // Shift up by the cut max position
                        partsToAdd.push(pTop);
                        console.log(`  Created TOP: height=${topHeight.toFixed(1)}cm at z=${pTop.z.toFixed(1)}`);
                    }

                    // LEFT piece (from Y=0 to cutMinY, full height of cut region)
                    if (cutMinY > MIN_SIZE) {
                        const pLeft = { ...wallData };
                        pLeft.id = wallData.profileId + '_LEFT_' + Math.random().toString(36).slice(2, 6);
                        pLeft.width = cutMinY; // Width (Y)
                        pLeft.length = cutHeight; // Height = just the middle section
                        pLeft.z = wallZ + cutMinZ * SCALE; // Start at cut bottom
                        partsToAdd.push(pLeft);
                        console.log(`  Created LEFT: width=${cutMinY.toFixed(1)}cm, height=${cutHeight.toFixed(1)}cm`);
                    }

                    // RIGHT piece (from cutMaxY to wallWidth, full height of cut region)
                    const rightWidth = wallWidth - cutMaxY;
                    if (rightWidth > MIN_SIZE) {
                        const pRight = { ...wallData };
                        pRight.id = wallData.profileId + '_RIGHT_' + Math.random().toString(36).slice(2, 6);
                        pRight.width = rightWidth; // Width (Y)
                        pRight.length = cutHeight; // Height = just the middle section
                        pRight.y = wallY + cutMaxY * SCALE; // Shift right
                        pRight.z = wallZ + cutMinZ * SCALE; // Start at cut bottom
                        partsToAdd.push(pRight);
                        console.log(`  Created RIGHT: width=${rightWidth.toFixed(1)}cm at y=${pRight.y.toFixed(1)}`);
                    }

                    partsToRemove.push(part);
                } else {
                    console.log(`  No collision.`);
                }
            });

            // Execute Changes
            console.log(`\n=== EXECUTING CUT ===`);
            console.log(`Parts to remove: ${partsToRemove.length}`);
            console.log(`Parts to add: ${partsToAdd.length}`);

            if (partsToRemove.length === 0) {
                alert("Nenhuma colisão detectada. Certifique-se de que a janela está sobrepondo as paredes.");
                return;
            }

            // Remove old parts
            partsToRemove.forEach(p => {
                console.log(`Removing: ${p.data.id}`);
                this.deletePart(p);
            });

            // Add new parts
            partsToAdd.forEach(pData => {
                console.log(`Adding: ${pData.id} (width=${pData.width}, length=${pData.length})`);
                this.modelData.looseParts.push(pData);
                this.instantiateLoosePart(pData);
            });

            this.renderTree();
            alert(`Corte realizado!\n${partsToRemove.length} peça(s) removida(s)\n${partsToAdd.length} nova(s) peça(s) criada(s)`);
            console.log("=== CUT COMPLETE ===");
        } catch (error) {
            console.error("ERROR in handleCutOverlap:", error);
            alert("Erro ao cortar: " + error.message);
        }
    }

    deletePart(part) {
        console.log(`deletePart: Removing ${part.data.id}`);
        console.log(`  Mesh parent before: ${part.mesh.parent ? part.mesh.parent.type : 'null'}`);

        // Use scene.remove if removeFromParent doesn't work
        if (part.mesh.parent) {
            part.mesh.parent.remove(part.mesh);
        }
        // Also try direct scene removal
        this.sceneManager.scene.remove(part.mesh);

        console.log(`  Mesh parent after: ${part.mesh.parent ? part.mesh.parent.type : 'null'}`);

        // Remove from Map
        const deleted = this.partsMap.delete(part.data.id);
        console.log(`  Removed from partsMap: ${deleted}`);

        // Remove from Data Arrays
        if (part.data.packageId) {
            const pkg = this.findPackage(part.data.packageId);
            if (pkg) {
                const beforeLen = pkg.pieces.length;
                pkg.pieces = pkg.pieces.filter(p => p.id !== part.data.id);
                console.log(`  Removed from package ${part.data.packageId}: ${beforeLen} -> ${pkg.pieces.length}`);
            }
        } else {
            const beforeLen = this.modelData.looseParts.length;
            this.modelData.looseParts = this.modelData.looseParts.filter(p => p.id !== part.data.id);
            console.log(`  Removed from looseParts: ${beforeLen} -> ${this.modelData.looseParts.length}`);
        }

        // Dispose geometry and material to free memory
        if (part.mesh.geometry) part.mesh.geometry.dispose();
        if (part.mesh.material) {
            if (Array.isArray(part.mesh.material)) {
                part.mesh.material.forEach(m => m.dispose());
            } else {
                part.mesh.material.dispose();
            }
        }

        console.log(`  Part ${part.data.id} deleted successfully`);
    }

    /**
     * Save current state to undo stack
     * Call this before making any destructive changes
     */
    saveUndoState() {
        if (!this.modelData) return;

        // Deep clone the current model data
        const snapshot = JSON.parse(JSON.stringify(this.modelData));

        this.undoStack.push(snapshot);

        // Limit stack size
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }

        console.log(`Undo state saved. Stack size: ${this.undoStack.length}`);
    }

    /**
     * Undo the last change - restore previous state
     */
    undo() {
        if (!this.undoStack || this.undoStack.length === 0) {
            console.log("Nothing to undo");
            return;
        }

        // Pop the last saved state
        const previousState = this.undoStack.pop();
        console.log(`Undoing... Stack remaining: ${this.undoStack.length}`);

        // Restore the model data
        this.modelData = previousState;

        // Clear current scene objects
        this.partsMap.forEach(part => {
            if (part.mesh) {
                if (part.mesh.parent) part.mesh.parent.remove(part.mesh);
                this.sceneManager.scene.remove(part.mesh);
            }
        });
        this.partsMap.clear();

        // Clear package groups
        this.packageGroups.forEach(group => {
            this.sceneManager.scene.remove(group);
        });
        this.packageGroups.clear();

        // Rebuild scene from restored data
        this.buildSceneFromData();
        this.renderTree();

        // Deselect all
        if (this.interactionManager) {
            this.interactionManager.deselectAll();
        }

        console.log("Undo complete");
    }
}
