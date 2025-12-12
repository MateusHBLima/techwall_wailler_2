import houseData from './house_data.json'; // Default model

export class ModelStore {
    constructor() {
        this.STORAGE_KEY = 'techwall_models';
        this.initDefaultModels();
    }

    initDefaultModels() {
        const models = this.getModels();
        // Since we want to FORCE inject Proto 2, we check if it exists, if not we push it.
        // Actually for this test let's overwrite or ensure it's there.

        // Let's create the data object for "Casa Protótipo 2"
        // 3m x 2.8m Wall
        const proto2 = {
            id: 'casa-prototipo-2',
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
                                    // Guia Inferior (Track)
                                    // L: 300cm. No rotation. U90.
                                    { id: 'guia_inf', profileId: 'U90', length: 3000, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, step: 1 },

                                    // Montante 1 (Stud) - Left
                                    // L: 280cm. Vertical.
                                    // SteelPart Extrudes Z. To make it Vertical (Y), Rotate X -90 deg.
                                    // x: 0, y: 0, z: 0 (Pivot at corner). 
                                    // If we rotate X -90, Z becomes Y.
                                    { id: 'mont_01', profileId: 'C90', length: 2800, x: 0, y: 0, z: 0, rx: -Math.PI / 2, ry: 0, rz: 0, step: 2 },

                                    // Montante 2 (Stud) - 60cm
                                    { id: 'mont_02', profileId: 'C90', length: 2800, x: 600, y: 0, z: 0, rx: -Math.PI / 2, ry: 0, rz: 0, step: 2 },

                                    // Montante 3 (Stud) - 120cm
                                    { id: 'mont_03', profileId: 'C90', length: 2800, x: 1200, y: 0, z: 0, rx: -Math.PI / 2, ry: 0, rz: 0, step: 2 },

                                    // Montante 4 (Stud) - 180cm
                                    { id: 'mont_04', profileId: 'C90', length: 2800, x: 1800, y: 0, z: 0, rx: -Math.PI / 2, ry: 0, rz: 0, step: 2 },

                                    // Montante 5 (Stud) - 240cm
                                    { id: 'mont_05', profileId: 'C90', length: 2800, x: 2400, y: 0, z: 0, rx: -Math.PI / 2, ry: 0, rz: 0, step: 2 },

                                    // Montante 6 (Stud) - 300cm (End)
                                    // Needs to fit inside track? Usually C is rotated 180 to face inward?
                                    // Let's simple place it at 2910mm (3000 - 90 width)
                                    { id: 'mont_end', profileId: 'C90', length: 2800, x: 2910, y: 0, z: 0, rx: -Math.PI / 2, ry: 0, rz: 0, step: 2 },

                                    // Guia Superior (Track)
                                    // Y: 2800. Needs to be inverted (Open down)?
                                    // Rotate Z 180? Or just placed on top.
                                    // Usually top track is "cap". Profile U open down?
                                    // If U default is Open Up (Flanges +Y), then to Open Down we Rotate Z 180 (or X 180).
                                    // y: 2800 (Height of studs).
                                    { id: 'guia_sup', profileId: 'U90', length: 3000, x: 0, y: 2800, z: 0, rx: 0, ry: 0, rz: Math.PI, step: 3 }
                                ]
                            }
                        ]
                    }
                ]
            }
        };

        // Add if not exists
        if (!models.find(m => m.id === proto2.id)) {
            models.push(proto2);
        }

        // Allow re-seeding if user wants?
        // Let's just update it if it exists to ensure freshness
        const idx = models.findIndex(m => m.id === proto2.id);
        if (idx !== -1) models[idx] = proto2;
        else models.push(proto2);

        // Also ensure default
        if (!models.find(m => m.id === 'casa-prototipo')) {
            models.push({ id: 'casa-prototipo', name: 'Casa Protótipo (Padrão)', data: houseData });
        }

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(models));
    }

    getModels() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    }

    getModel(id) {
        const models = this.getModels();
        return models.find(m => m.id === id);
    }

    saveModel(model) {
        const models = this.getModels();
        const existingIndex = models.findIndex(m => m.id === model.id);

        if (existingIndex >= 0) {
            models[existingIndex] = model;
        } else {
            models.push(model);
        }

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(models));
    }
}
