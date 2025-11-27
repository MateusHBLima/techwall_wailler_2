import houseData from '../data/house_data.json';

export class DataManager {
    constructor() {
        this.data = null;
    }

    async loadData() {
        try {
            // Imported directly to ensure bundling
            this.data = houseData;
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
