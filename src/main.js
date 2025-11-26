import './style.css';
import { SceneManager } from './core/SceneManager.js';
import { DataManager } from './core/DataManager.js';
import { State } from './core/State.js';
import { House } from './components/House.js';
import { UIManager } from './ui/UIManager.js';

const canvas = document.getElementById('app-canvas');
const sceneManager = new SceneManager(canvas);
const dataManager = new DataManager();
const state = new State();

async function init() {
  const data = await dataManager.loadData();
  if (data) {
    console.log('House Data Loaded:', data);
    state.initializeProgress(data);
    const house = new House(sceneManager.scene, data);
    house.setGhostMode(true); // Start in Overview Mode (Ghost)
    const uiManager = new UIManager(data, house, sceneManager, state);
  }
}

function animate() {
  requestAnimationFrame(animate);
  sceneManager.update();
}

init();
animate();

window.addEventListener('resize', () => {
  sceneManager.onWindowResize();
});
