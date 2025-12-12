import { SceneManager } from '../core/SceneManager.js';
import { House } from '../components/House.js';
import { UIManager } from '../ui/UIManager.js';
import { State } from '../core/State.js';
import { ProjectStore } from '../data/ProjectStore.js';
import { InteractionManager } from '../core/InteractionManager.js';

export class ProjectViewerPage {
    constructor(container, params) {
        this.container = container;
        this.projectId = params.id;
        this.projectStore = new ProjectStore();
        this.render();
    }

    async render() {
        const project = this.projectStore.getProject(this.projectId);

        if (!project) {
            this.container.innerHTML = '<p>Projeto não encontrado.</p>';
            return;
        }

        this.container.innerHTML = `
            <div id="viewer-container" style="position: relative; width: 100%; height: 100%;">
                <canvas id="viewer-canvas" style="width: 100%; height: 100%; display: block;"></canvas>
            </div>
        `;

        const canvas = this.container.querySelector('#viewer-canvas');

        this.sceneManager = new SceneManager(canvas);
        this.state = new State();

        const data = project.data;
        console.log('Loading Project Data:', data);

        if (data) {
            this.state.initializeProgress(data);
            const house = new House(this.sceneManager.scene, data);
            house.setGhostMode(true); // Overview mode

            // We use InteractionManager here too? Or just standard viewer?
            // "The first is the home page ... where I can follow its progress."
            // Assuming this is the "Assembly/Viewer" we built before.

            // Reuse UIManager (Overview + Assembly)
            // InteractionManager is optional here if we just want to view?
            // "Model Builder" has the Gizmo. Does "Project Viewer"? 
            // Probably yes, for inspecting? Or no, for assembly.
            // Let's add InteractionManager for consistency but maybe disable gizmo if not builder?
            // For now, full features.

            const interactionManager = new InteractionManager(this.sceneManager, null);
            this.uiManager = new UIManager(data, house, this.sceneManager, this.state, interactionManager);
            interactionManager.uiManager = this.uiManager;
        }

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

    destroy() {
        this.active = false;
        window.removeEventListener('resize', this.resizeHandler);
        if (this.uiManager && this.uiManager.container) {
            this.uiManager.container.remove();
        }
        const props = document.getElementById('properties-panel');
        if (props) props.remove();
    }
}
