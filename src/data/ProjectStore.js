export class ProjectStore {
    constructor() {
        this.STORAGE_KEY = 'techwall_projects';
    }

    getProjects() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    }

    getProject(id) {
        const projects = this.getProjects();
        return projects.find(p => p.id === id);
    }

    saveProject(project) {
        const projects = this.getProjects();
        const existingIndex = projects.findIndex(p => p.id === project.id);

        if (existingIndex >= 0) {
            projects[existingIndex] = project;
        } else {
            projects.push(project);
        }

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(projects));
    }

    deleteProject(id) {
        let projects = this.getProjects();
        projects = projects.filter(p => p.id !== id);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(projects));
    }
}
