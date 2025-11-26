export class DataManager {
    constructor() {
        this.data = null;
    }

    async loadData() {
        try {
            const response = await fetch('/src/data/house_data.json');
            this.data = await response.json();
            return this.data;
        } catch (error) {
            console.error('Error loading house data:', error);
            return null;
        }
    }

    getPhases() {
        return this.data ? this.data.phases : [];
    }

    getProjectInfo() {
        return this.data ? { project: this.data.project, dimensions: this.data.dimensions } : null;
    }
}
