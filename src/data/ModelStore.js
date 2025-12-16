import { supabase } from './supabaseClient.js';
import houseData from './house_data.json'; // Default template

export class ModelStore {
    constructor() {
        this.models = [];
        this.isLoaded = false;
        this.loadPromise = this.loadModels();
    }

    async loadModels() {
        if (this.isLoaded) return this.models;

        try {
            if (supabase) {
                // Load from Supabase
                console.log('[ModelStore] Loading from Supabase...');
                const { data, error } = await supabase
                    .from('models')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;

                this.models = data || [];
                console.log(`[ModelStore] Loaded ${this.models.length} models from Supabase`);
            } else {
                // Fallback to local API
                console.log('[ModelStore] Supabase not configured, using local API...');
                const res = await fetch('/api/models');
                if (res.ok) {
                    this.models = await res.json();
                }
            }

            // Seed defaults if empty
            await this.initDefaultModels();
            this.isLoaded = true;

        } catch (e) {
            console.error('[ModelStore] Failed to load models:', e);
            this.models = [];
            await this.initDefaultModels();
            this.isLoaded = true;
        }

        return this.models;
    }

    async initDefaultModels() {
        if (!this.models || this.models.length === 0) {
            console.log('[ModelStore] Seeding default models...');
            const defaults = [
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

            for (const model of defaults) {
                await this.saveModel(model);
            }
        }
    }

    async ensureLoaded() {
        if (!this.isLoaded) {
            await this.loadPromise;
        }
    }

    getModels() {
        return this.models || [];
    }

    getTemplates() {
        return (this.models || []).filter(m => m.type === 'template' || !m.type);
    }

    getProjects() {
        return (this.models || []).filter(m => m.type === 'project');
    }

    getModel(id) {
        if (!id) return undefined;
        return (this.models || []).find(m => m.id.toLowerCase() === id.toLowerCase());
    }

    async createProjectFromTemplate(templateId, projectName) {
        await this.ensureLoaded();

        const template = this.getModel(templateId);
        if (!template) throw new Error('Template not found');

        const newId = this.generateUniqueId();
        const newProject = {
            id: newId,
            type: 'project',
            name: projectName || `${template.name} (Copy)`,
            created_at: new Date().toISOString(),
            data: JSON.parse(JSON.stringify(template.data)),
            progress: 0
        };

        newProject.data.id = newId;

        await this.saveModel(newProject);
        return newProject;
    }

    generateUniqueId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (this.getModel(result)) return this.generateUniqueId();
        return result;
    }

    async saveModel(model) {
        if (!this.models) this.models = [];

        // Update local cache
        const idx = this.models.findIndex(m => m.id === model.id);
        if (idx >= 0) {
            this.models[idx] = model;
        } else {
            this.models.push(model);
        }

        // Save to Supabase or fallback
        if (supabase) {
            try {
                const { error } = await supabase
                    .from('models')
                    .upsert({
                        id: model.id,
                        type: model.type || 'template',
                        name: model.name,
                        data: model.data,
                        progress: model.progress || 0,
                        created_at: model.created_at || new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'id' });

                if (error) throw error;
                console.log('[ModelStore] Saved to Supabase:', model.id);
            } catch (e) {
                console.error('[ModelStore] Supabase save error:', e);
            }
        } else {
            // Fallback to local API
            await this.saveModelsToLocalApi();
        }
    }

    async deleteModel(id) {
        if (!this.models) return;

        const idx = this.models.findIndex(m => m.id.toLowerCase() === id.toLowerCase());
        if (idx < 0) {
            throw new Error('Modelo não encontrado');
        }

        this.models.splice(idx, 1);

        // Delete from Supabase or fallback
        if (supabase) {
            try {
                const { error } = await supabase
                    .from('models')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                console.log('[ModelStore] Deleted from Supabase:', id);
            } catch (e) {
                console.error('[ModelStore] Supabase delete error:', e);
            }
        } else {
            await this.saveModelsToLocalApi();
        }
    }

    async saveModelsToLocalApi() {
        try {
            await fetch('/api/models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.models)
            });
            console.log('[ModelStore] Saved to local API');
        } catch (e) {
            console.error('[ModelStore] Local API save error:', e);
        }
    }
}
