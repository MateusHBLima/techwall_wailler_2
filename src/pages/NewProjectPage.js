import { ProjectStore } from '../data/ProjectStore.js';
import { ModelStore } from '../data/ModelStore.js';

export class NewProjectPage {
    constructor(container) {
        this.container = container;
        this.projectStore = new ProjectStore();
        this.modelStore = new ModelStore();
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="page-header">
                <h2>Novo Projeto</h2>
            </div>
            <div class="form-container">
                <form id="new-project-form">
                    <div class="form-group">
                        <label for="p-name">Nome do Projeto</label>
                        <input type="text" id="p-name" required placeholder="Ex: Minha Casa">
                    </div>
                    <div class="form-group">
                        <label for="p-model">Modelo</label>
                        <select id="p-model" required></select>
                    </div>
                    <button type="submit" class="btn-primary">Criar Projeto</button>
                    <a href="#dashboard" class="btn-text">Cancelar</a>
                </form>
            </div>
        `;

        const select = this.container.querySelector('#p-model');
        const models = this.modelStore.getModels();
        models.forEach(model => {
            const opt = document.createElement('option');
            opt.value = model.id;
            opt.textContent = model.name;
            select.appendChild(opt);
        });

        const form = this.container.querySelector('#new-project-form');
        form.onsubmit = (e) => this.handleSubmit(e);
    }

    handleSubmit(e) {
        e.preventDefault();
        const name = this.container.querySelector('#p-name').value;
        const modelId = this.container.querySelector('#p-model').value;
        const model = this.modelStore.getModel(modelId);

        const newProject = {
            id: crypto.randomUUID(),
            name: name,
            modelId: modelId,
            modelName: model ? model.name : 'Unknown',
            createdAt: new Date().toISOString(),
            data: model ? JSON.parse(JSON.stringify(model.data)) : null // Clone initial data
        };

        this.projectStore.saveProject(newProject);
        window.location.hash = 'dashboard';
    }
}
