import houseData from './house_data.json'; // Default model

export class ModelStore {
    constructor() {
        this.STORAGE_KEY = 'techwall_models';
        // Initialize with API load if possible, but constructor cannot be async.
        // We will load on demand or init.
        this.loadModels();
    }

    async loadModels() {
        try {
            const res = await fetch('/api/models');
            if (res.ok) {
                const models = await res.json();
                this.models = models;

                // Seed defaults if empty
                this.initDefaultModels();
            }
        } catch (e) {
            console.error("Failed to load models", e);
            this.models = [];
            this.initDefaultModels();
        }
    }

    initDefaultModels() {
        // Only seed defaults if the file is completely empty
        // This prevents re-adding deleted templates
        if (!this.models || this.models.length === 0) {
            console.log("[ModelStore] Seeding default models...");
            this.models = [
                {
                    id: 'casa-prototipo-2',
                    type: 'template',
                    name: 'Casa Protótipo 2 (Demo V2)',
                    data: {
                        id: 'casa-prototipo-2',
                        phases: [
                            {
                                id: 'PHASE_WALL',
                                name: 'Parede Frontal',
                                packages: [
                                    {
                                        id: 'PKG_WALL_01',
                                        name: 'Estrutura Parede',
                                        pieces: [
                                            { id: 'guia_inf', profileId: 'U90', length: 3000, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, step: 1 },
                                            { id: 'mont_01', profileId: 'C90', length: 2800, x: 0, y: 0, z: 0, rx: -Math.PI / 2, ry: 0, rz: 0, step: 2 },
                                            { id: 'mont_02', profileId: 'C90', length: 2800, x: 600, y: 0, z: 0, rx: -Math.PI / 2, ry: 0, rz: 0, step: 2 },
                                            { id: 'mont_03', profileId: 'C90', length: 2800, x: 1200, y: 0, z: 0, rx: -Math.PI / 2, ry: 0, rz: 0, step: 2 },
                                            { id: 'mont_04', profileId: 'C90', length: 2800, x: 1800, y: 0, z: 0, rx: -Math.PI / 2, ry: 0, rz: 0, step: 2 },
                                            { id: 'guia_sup', profileId: 'U90', length: 3000, x: 0, y: 2800, z: 0, rx: 0, ry: 0, rz: Math.PI, step: 3 }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    id: 'casa-prototipo',
                    type: 'template',
                    name: 'Casa Protótipo (Padrão)',
                    data: houseData
                }
            ];
            this.saveModelsToApi();
        }
    }

    getModels() {
        return this.models || [];
    }

    // Get only templates for the "New Project" screen
    getTemplates() {
        return (this.models || []).filter(m => m.type === 'template' || !m.type); // Fallback for old data
    }

    // Get only active projects
    getProjects() {
        return (this.models || []).filter(m => m.type === 'project');
    }

    getModel(id) {
        if (!id) return undefined;
        return (this.models || []).find(m => m.id.toLowerCase() === id.toLowerCase());
    }

    // Create a new Project from a Template
    createProjectFromTemplate(templateId, projectName) {
        const template = this.getModel(templateId);
        if (!template) throw new Error("Template not found");

        const newId = this.generateUniqueId();
        const newProject = {
            id: newId,
            type: 'project',
            name: projectName || `${template.name} (Copy)`,
            created: new Date().toISOString(),
            data: JSON.parse(JSON.stringify(template.data)) // Deep copy data
        };

        // Ensure data ID matches project ID (if used internally)
        newProject.data.id = newId;

        this.models.push(newProject);
        this.saveModelsToApi();
        return newProject;
    }

    generateUniqueId() {
        // Generate a short 6-char clean code (e.g., K9X-2M4 or just A1B2C3)
        // Let's use 6 chars alphanumeric uppercase
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 1, 0 to avoid confusion
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        // Check collision
        if (this.getModel(result)) return this.generateUniqueId();
        return result;
    }

    saveModel(model) {
        if (!this.models) this.models = [];
        const idx = this.models.findIndex(m => m.id === model.id);
        if (idx >= 0) this.models[idx] = model;
        else this.models.push(model);

        this.saveModelsToApi();
    }

    deleteModel(id) {
        if (!this.models) return;
        const idx = this.models.findIndex(m => m.id.toLowerCase() === id.toLowerCase());
        if (idx >= 0) {
            this.models.splice(idx, 1);
            this.saveModelsToApi();
            console.log("Model deleted:", id);
        } else {
            throw new Error("Modelo não encontrado");
        }
    }

    async saveModelsToApi() {
        try {
            await fetch('/api/models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.models)
            });
            console.log("Saved models to API");
        } catch (e) {
            console.error("Failed to save models", e);
        }
    }
}
