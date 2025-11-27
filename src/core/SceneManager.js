import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x202020); // Dark gray background

    this.screenDimensions = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    this.clock = new THREE.Clock();

    this.buildCamera();
    this.buildRenderer();
    this.buildLights();
    this.buildControls();

    // Grid Helper
    const gridHelper = new THREE.GridHelper(500, 50);
    this.scene.add(gridHelper);

    // Axes Helper
    const axesHelper = new THREE.AxesHelper(50);
    this.scene.add(axesHelper);

    console.log('SceneManager initialized. Canvas size:', this.screenDimensions);
  }

  buildCamera() {
    const aspectRatio = this.screenDimensions.width / this.screenDimensions.height;
    this.camera = new THREE.PerspectiveCamera(60, aspectRatio, 1, 1000);
    this.camera.position.set(100, 150, 200); // Closer to house
    this.camera.lookAt(75, 75, 75);
  }

  buildRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.screenDimensions.width, this.screenDimensions.height);
    this.renderer.shadowMap.enabled = true;
    console.log('Renderer initialized. Size:', this.screenDimensions);
  }

  buildLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 200, 100);
    dirLight.castShadow = true;
    this.scene.add(dirLight);
  }

  buildControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(75, 75, 75); // Focus on the center of the house
  }

  update() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    const { width, height } = this.canvas.parentElement.getBoundingClientRect();
    this.screenDimensions.width = width;
    this.screenDimensions.height = height;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  setCardinalView(viewName) {
    const center = { x: 75, y: 75, z: 75 };
    let pos = { x: 100, y: 150, z: 200 }; // Default

    // Fixed Isometric Views (approx 45 degrees down)
    switch (viewName) {
      case 'FRONT':
        pos = { x: 75, y: 250, z: 350 };
        break;
      case 'BACK':
        pos = { x: 75, y: 250, z: -200 };
        break;
      case 'LEFT':
        pos = { x: -200, y: 250, z: 75 };
        break;
      case 'RIGHT':
        pos = { x: 350, y: 250, z: 75 };
        break;
    }

    this.animateCamera(pos, center);
  }

  animateCamera(targetPos, targetLook) {
    const duration = 1000;
    const startTime = Date.now();
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      this.camera.position.x = startPos.x + (targetPos.x - startPos.x) * eased;
      this.camera.position.y = startPos.y + (targetPos.y - startPos.y) * eased;
      this.camera.position.z = startPos.z + (targetPos.z - startPos.z) * eased;

      this.controls.target.x = startTarget.x + (targetLook.x - startTarget.x) * eased;
      this.controls.target.y = startTarget.y + (targetLook.y - startTarget.y) * eased;
      this.controls.target.z = startTarget.z + (targetLook.z - startTarget.z) * eased;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  focusOnPosition(x, y, z) {
    // Deprecated in favor of setCardinalView, but kept for compatibility
    // Redirects to a default view if called
    this.setCardinalView('FRONT');
  }

  resetCamera() {
    // Reset to overview position
    this.focusOnPosition(75, 75, 75); // Center of house
    const targetPos = { x: 100, y: 150, z: 200 };

    const duration = 1000;
    const startTime = Date.now();
    const startPos = this.camera.position.clone();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      this.camera.position.x = startPos.x + (targetPos.x - startPos.x) * eased;
      this.camera.position.y = startPos.y + (targetPos.y - startPos.y) * eased;
      this.camera.position.z = startPos.z + (targetPos.z - startPos.z) * eased;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  setFixedCamera(isFixed) {
    // Disable/enable rotation during assembly mode
    this.controls.enabled = !isFixed;
    if (isFixed) {
      console.log('Camera locked (no rotation) for assembly mode');
    } else {
      console.log('Camera unlocked for overview mode');
    }
  }
}
