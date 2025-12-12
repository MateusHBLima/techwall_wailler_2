import { ProjectStore } from '../data/ProjectStore.js';

export class DashboardPage {
    constructor(container) {
        this.container = container;
        this.projectStore = new ProjectStore();
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="page-header">
                <h2>Meus Projetos</h2>
                <a href="#new-project" class="btn-primary">+ Novo Projeto</a>
            </div>
            <div class="projects-grid" id="projects-list"></div>
        `;

        const list = this.container.querySelector('#projects-list');
        const projects = this.projectStore.getProjects();

        if (projects.length === 0) {
            list.innerHTML = '<p class="empty-state">Nenhum projeto encontrado. Crie o primeiro!</p>';
            return;
        }

        projects.forEach(project => {
            const card = document.createElement('div');
            card.className = 'project-card';
            card.innerHTML = `
                <h3>${project.name}</h3>
                <p>Modelo: ${project.modelName || 'Padrão'}</p>
                <p>Criado em: ${new Date(project.createdAt).toLocaleDateString()}</p>
                <div class="actions">
                    <a href="#project-viewer/${project.id}" class="btn-secondary">Abrir</a>
                </div>
            `;
            list.appendChild(card);
        });
    }
}
