import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

export class InteractionManager {
    constructor(sceneManager, uiManager) {
        this.sceneManager = sceneManager;
        this.camera = sceneManager.camera;
        this.scene = sceneManager.scene;
        this.canvas = sceneManager.renderer.domElement;
        this.uiManager = uiManager;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Gizmo
        this.control = new TransformControls(this.camera, this.canvas);
        this.control.setSpace('local');
        this.control.addEventListener('dragging-changed', (event) => {
            this.sceneManager.controls.enabled = !event.value;
        });

        // Single Gizmo for the "Primary" selection
        this.scene.add(this.control);

        // Snapping defaults
        this.control.setTranslationSnap(1); // 1cm default
        this.control.setRotationSnap(THREE.MathUtils.degToRad(15)); // 15 degrees

        // MULTI-SELECTION
        this.selectedObjects = [];
        this.selectionMode = false; // When true, clicking adds to selection

        this.initEvents();
    }

    initEvents() {
        this.control.addEventListener('change', () => {
            // If Gizmo moves the primary object, we might want to move others too?
            // For now, Gizmo only affects the primary selected object.
            if (this.selectedObjects.length > 0 && this.uiManager) {
                this.uiManager.updatePropertiesPanel(this.selectedObjects[this.selectedObjects.length - 1]);
            }
        });

        this.canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
        this.canvas.addEventListener('pointermove', (event) => this.onPointerMove(event));
        this.canvas.addEventListener('pointerup', (event) => this.onPointerUp(event));

        window.addEventListener('keydown', (event) => {
            switch (event.key.toLowerCase()) {
                case 't': this.setMode('translate'); break;
                case 'r': this.setMode('rotate'); break;
                case 'escape': this.deselectAll(); break;
            }
        });

        // Drag Helpers
        this.dragPlane = new THREE.Plane();
        this.isDragging = false;
        this.dragStartPoint = new THREE.Vector3();
        this.initialPositions = new Map(); // Store initial pos for all selected
    }

    updateMouse(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    onPointerDown(event) {
        if (this.control.axis) return; // Gizmo interaction

        this.updateMouse(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        // Multi-select with Ctrl, or when in Selection Mode
        const isMulti = event.ctrlKey || event.metaKey || this.selectionMode;

        if (intersects.length > 0) {
            const hit = intersects[0];

            // Traverse to find selectable root
            // If part belongs to a package (not loose), select the whole package (group behavior)
            let curr = hit.object;
            let selectableRoot = null;
            let packageRoot = null;
            let hitPart = null; // The actual part that was clicked

            while (curr) {
                if (curr === this.scene) break;

                // Check if this is a package (group)
                if (curr.userData && curr.userData.isPackage) {
                    packageRoot = curr;
                }

                // Check if this is individually selectable (a part)
                if (this.isSelectable(curr)) {
                    selectableRoot = curr;
                    if (!hitPart) hitPart = curr; // First selectable found is the clicked part
                }

                curr = curr.parent;
            }

            // ONLY select package if the clicked part is NOT loose
            // Loose parts should be selected individually to allow grouping
            if (packageRoot && hitPart && !hitPart.userData.isLoose) {
                // DRILL-DOWN LOGIC:
                // Normal click: Selects the whole package (Group)
                // Alt + Click: Selects the specific part inside package

                if (event.altKey) {
                    selectableRoot = hitPart;
                } else {
                    selectableRoot = packageRoot;
                }
            }

            if (selectableRoot) {
                // Check if already selected
                const isSelected = this.selectedObjects.includes(selectableRoot);

                if (isMulti) {
                    // Toggle Selection via Ctrl
                    if (isSelected) {
                        this.deselect(selectableRoot);
                    } else {
                        this.select(selectableRoot, true);
                    }
                } else {
                    // Single Select Mode
                    if (!isSelected) {
                        // If not selected, clear others and select this
                        this.deselectAll();
                        this.select(selectableRoot, false);
                    }
                    // If already selected, do nothing (keep selection for drag)
                }

                // DRAG LOGIC (Immediate)
                console.log("Control mode:", this.control.getMode());
                if (this.control.getMode() === 'translate') {
                    console.log("Starting drag...");
                    this.startDrag(hit.point, event.shiftKey);
                }
                return;
            }
        }

        // Clicked empty space
        if (!isMulti) this.deselectAll();
    }

    startDrag(hitPoint, isVertical) {
        this.isDragging = true;
        this.sceneManager.controls.enabled = false;

        // Setup Drag Plane
        if (isVertical) {
            // Vertical Drag: Plane facing camera, but restricted to Y axis interaction
            const normal = new THREE.Vector3();
            this.camera.getWorldDirection(normal); // Get camera look direction
            normal.y = 0; // Project to XZ plane
            if (normal.lengthSq() < 0.01) {
                // Camera is looking straight down/up. Use a fallback Z-plane
                normal.set(0, 0, 1);
            } else {
                normal.normalize();
            }
            this.dragPlane.setFromNormalAndCoplanarPoint(normal, hitPoint);
            this.dragMode = 'Y';
        } else {
            // Horizontal XZ Drag
            this.dragPlane.set(new THREE.Vector3(0, 1, 0), -hitPoint.y);
            this.dragMode = 'XZ';
        }

        // Find intersection on plane to establish start offset
        const planeIntersect = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.dragPlane, planeIntersect);

        if (planeIntersect) {
            this.dragStartPoint.copy(planeIntersect);

            // Snapshot initial positions
            this.initialPositions.clear();
            this.selectedObjects.forEach(obj => {
                this.initialPositions.set(obj.id, obj.position.clone());
            });
        }
    }

    onPointerMove(event) {
        if (!this.isDragging || this.selectedObjects.length === 0) return;

        this.updateMouse(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const planeIntersect = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.dragPlane, planeIntersect);

        if (planeIntersect) {
            // Calculate Delta
            const delta = new THREE.Vector3().subVectors(planeIntersect, this.dragStartPoint);

            // Constrain Delta based on Mode
            if (this.dragMode === 'Y') {
                delta.x = 0;
                delta.z = 0;
            } else {
                delta.y = 0;
            }

            // Apply Snap (Local to delta to keep relative positions)
            const snap = 10; // 10 cm
            if (this.dragMode === 'Y') {
                delta.y = Math.round(delta.y / snap) * snap;
            } else {
                delta.x = Math.round(delta.x / snap) * snap;
                delta.z = Math.round(delta.z / snap) * snap;
            }

            // Apply to all selected objects
            this.selectedObjects.forEach(obj => {
                const initial = this.initialPositions.get(obj.id);
                if (initial) {
                    const newPos = initial.clone().add(delta);

                    // Ground constraint: prevent going below Y=0
                    if (newPos.y < 0) newPos.y = 0;

                    obj.position.copy(newPos);

                    // Update data model if possible (cheap way)
                    if (obj.userData.id && this.uiManager && this.uiManager.partsMap) {
                        const part = this.uiManager.partsMap.get(obj.userData.id);
                        if (part && part.data) {
                            // This is a bit hackerish, usually we'd call a method
                            part.data.x = obj.position.x;
                            part.data.y = obj.position.y;
                            part.data.z = obj.position.z;
                        }
                    }
                }
            });

            // Update UI for the primary selection
            if (this.uiManager && this.selectedObjects.length > 0) {
                this.uiManager.updatePropertiesPanel(this.selectedObjects[this.selectedObjects.length - 1]);
            }
        }
    }

    onPointerUp(event) {
        if (this.isDragging) {
            this.isDragging = false;
            this.sceneManager.controls.enabled = true;
            this.initialPositions.clear();
        }
    }

    isSelectable(object) {
        return object.userData && (object.userData.selectable || object.userData.partId || object.userData.packageId);
    }

    select(object, add = false) {
        if (!add) {
            this.deselectAll();
        }
        if (!this.selectedObjects.includes(object)) {
            this.selectedObjects.push(object);

            // Store selection data for reference (including unique ID)
            const selectionData = {
                id: object.userData?.id,
                isPackage: object.userData?.isPackage || false,
                isLoose: object.userData?.isLoose || false,
                packageId: object.userData?.packageId || null,
                position: object.position ? object.position.clone() : null,
                rotation: object.rotation ? {
                    x: object.rotation.x,
                    y: object.rotation.y,
                    z: object.rotation.z
                } : null,
                object: object
            };

            // Store in a selection data array
            if (!this.selectionData) this.selectionData = [];
            this.selectionData.push(selectionData);

            console.log("Selected piece stored:", selectionData.id);

            // Highlight Visual - Change to yellow
            this.highlightObject(object, true);

            // Attach Gizmo to the LAST selected
            this.control.attach(object);

            if (this.uiManager) this.uiManager.onObjectSelected(object);
        }
    }

    deselect(object) {
        const index = this.selectedObjects.indexOf(object);
        if (index > -1) {
            // Remove highlight
            this.highlightObject(object, false);

            this.selectedObjects.splice(index, 1);

            // Remove from selectionData
            if (this.selectionData) {
                this.selectionData = this.selectionData.filter(d => d.object !== object);
            }

            if (this.control.object === object) {
                this.control.detach();
                // Attach to previous if exists
                if (this.selectedObjects.length > 0) {
                    this.control.attach(this.selectedObjects[this.selectedObjects.length - 1]);
                }
            }
        }
    }

    deselectAll() {
        // Remove highlight from all
        this.selectedObjects.forEach(obj => this.highlightObject(obj, false));

        this.selectedObjects = [];
        this.selectionData = []; // Clear selection data
        this.control.detach();
        if (this.uiManager) this.uiManager.onObjectSelected(null);
    }

    highlightObject(object, isSelected) {
        const color = isSelected ? 0xffff00 : null; // Yellow for selected

        // Traverse all meshes in the object (could be a Group)
        object.traverse(child => {
            if (child.isMesh && child.material) {
                if (isSelected) {
                    // Store original color if not already stored
                    if (child.userData.originalColor === undefined) {
                        child.userData.originalColor = child.material.color.getHex();
                    }
                    child.material.color.setHex(0xffff00); // Yellow
                    child.material.emissive?.setHex(0x444400); // Slight glow
                } else {
                    // Restore original color
                    if (child.userData.originalColor !== undefined) {
                        child.material.color.setHex(child.userData.originalColor);
                        child.material.emissive?.setHex(0x000000);
                    }
                }
            }
        });
    }

    setMode(mode) {
        // console.log(`Setting mode to: ${mode}`);
        this.control.setMode(mode);

        // Force refresh of the gizmo visual state
        if (this.selectedObjects.length > 0) {
            const current = this.control.object;
            if (current) this.control.detach();
            this.control.attach(this.selectedObjects[this.selectedObjects.length - 1]);
        }
    }

    toggleSelectionMode() {
        this.selectionMode = !this.selectionMode;
        console.log("Selection mode:", this.selectionMode);
        return this.selectionMode;
    }

    setSnapping(translation, rotation) {
        if (translation !== undefined) this.control.setTranslationSnap(translation);
    }
}
