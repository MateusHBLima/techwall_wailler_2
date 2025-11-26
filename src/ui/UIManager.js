export class UIManager {
    constructor(data, house, sceneManager, state) {
        this.data = data;
        this.house = house;
        this.sceneManager = sceneManager;
        this.state = state;
        this.container = document.createElement('div');
        this.container.id = 'ui-container';
        document.body.appendChild(this.container);

        this.renderOverview();
    }

    renderOverview() {
        this.container.innerHTML = '';

        const panel = document.createElement('div');
        panel.className = 'panel overview-panel';

        const title = document.createElement('h1');
        title.textContent = 'Casinha 150 WMS';
        panel.appendChild(title);

        const inventoryList = document.createElement('ul');
        inventoryList.className = 'inventory-list';

        const inventory = this.calculateInventory();

        for (const [type, count] of Object.entries(inventory)) {
            const item = document.createElement('li');
            const progress = this.state.getProgress(type);
            item.textContent = `${this.formatType(type)}: ${progress.installed} / ${count}`;
            item.onclick = () => this.house.highlightPiece(null);
            inventoryList.appendChild(item);
        }

        panel.appendChild(inventoryList);

        const startBtn = document.createElement('button');
        startBtn.textContent = 'INICIAR MONTAGEM';
        startBtn.className = 'btn-primary';
        startBtn.onclick = () => this.startAssembly();
        panel.appendChild(startBtn);

        this.container.appendChild(panel);
    }

    calculateInventory() {
        const counts = {};
        this.data.phases.forEach(phase => {
            phase.packages.forEach(pkg => {
                pkg.pieces.forEach(piece => {
                    counts[piece.type] = (counts[piece.type] || 0) + 1;
                });
            });
        });
        return counts;
    }

    formatType(type) {
        return type.replace(/_/g, ' ').toUpperCase();
    }

    startAssembly() {
        console.log('Starting Assembly...');
        this.assemblySteps = [];
        this.data.phases.forEach(phase => {
            phase.packages.forEach(pkg => {
                this.assemblySteps.push({ ...pkg, phaseName: phase.name });
            });
        });

        this.currentStepIndex = 0;
        this.currentPieceIndex = -1;

        // Focus camera on first package
        const firstPkg = this.assemblySteps[0];
        if (firstPkg && firstPkg.position) {
            this.sceneManager.focusOnPosition(firstPkg.position.x, firstPkg.position.y, firstPkg.position.z);
        }

        // Lock camera (no rotation) during assembly
        this.sceneManager.setFixedCamera(true);

        this.updateAssemblyState();
    }

    updateAssemblyState() {
        const currentPkg = this.assemblySteps[this.currentStepIndex];
        this.house.updateAssemblyState(currentPkg.id, this.currentPieceIndex, this.assemblySteps);

        // Focus camera on current package when starting a new package
        if (this.currentPieceIndex === -1 && currentPkg.position) {
            this.sceneManager.focusOnPosition(currentPkg.position.x, currentPkg.position.y, currentPkg.position.z);
        }

        this.renderAssemblyUI();
    }

    renderAssemblyUI() {
        this.container.innerHTML = '';
        const currentPkg = this.assemblySteps[this.currentStepIndex];

        const panel = document.createElement('div');
        panel.className = 'panel assembly-panel';

        const header = document.createElement('div');
        header.innerHTML = `<h3>${currentPkg.phaseName}</h3><h2>${currentPkg.name}</h2>`;
        panel.appendChild(header);

        const instructions = document.createElement('p');
        instructions.textContent = currentPkg.description || "Siga as instruções de montagem.";
        panel.appendChild(instructions);

        const inventoryList = document.createElement('ul');
        inventoryList.className = 'inventory-list';
        const localCounts = {};
        currentPkg.pieces.forEach(p => localCounts[p.type] = (localCounts[p.type] || 0) + 1);

        for (const [type, count] of Object.entries(localCounts)) {
            const item = document.createElement('li');
            item.textContent = `${this.formatType(type)}: ${count}`;
            inventoryList.appendChild(item);
        }
        panel.appendChild(inventoryList);

        const navDiv = document.createElement('div');
        navDiv.className = 'nav-buttons';

        const prevBtn = document.createElement('button');
        prevBtn.textContent = 'Anterior';
        prevBtn.disabled = this.currentStepIndex === 0 && this.currentPieceIndex <= -1;
        prevBtn.onclick = () => this.prevStep();
        navDiv.appendChild(prevBtn);

        const nextBtn = document.createElement('button');
        nextBtn.textContent = (this.currentStepIndex === this.assemblySteps.length - 1 && this.currentPieceIndex === currentPkg.pieces.length - 1) ? 'Concluir' : 'Próximo';
        nextBtn.onclick = () => this.nextStep();
        navDiv.appendChild(nextBtn);

        const exitBtn = document.createElement('button');
        exitBtn.textContent = 'Sair';
        exitBtn.className = 'btn-exit';
        exitBtn.onclick = () => this.exitAssembly();
        navDiv.appendChild(exitBtn);

        panel.appendChild(navDiv);
        this.container.appendChild(panel);
    }

    nextStep() {
        const currentPkg = this.assemblySteps[this.currentStepIndex];

        if (this.currentPieceIndex < currentPkg.pieces.length - 1) {
            this.currentPieceIndex++;
            // Track the newly installed piece
            const piece = currentPkg.pieces[this.currentPieceIndex];
            this.state.incrementPiece(piece.id, piece.type);
            this.updateAssemblyState();
        } else {
            if (this.currentStepIndex < this.assemblySteps.length - 1) {
                this.currentStepIndex++;
                this.currentPieceIndex = -1;
                this.updateAssemblyState();
            } else {
                alert("Montagem Concluída!");
                this.exitAssembly();
            }
        }
    }

    prevStep() {
        if (this.currentPieceIndex > -1) {
            this.currentPieceIndex--;
            this.updateAssemblyState();
        } else {
            if (this.currentStepIndex > 0) {
                this.currentStepIndex--;
                const prevPkg = this.assemblySteps[this.currentStepIndex];
                this.currentPieceIndex = prevPkg.pieces.length - 1;
                this.updateAssemblyState();
            }
        }
    }

    exitAssembly() {
        // Save current assembly position
        this.state.setAssemblyPosition(this.currentStepIndex, this.currentPieceIndex);

        // Reset camera to overview position
        if (this.sceneManager && this.sceneManager.resetCamera) {
            this.sceneManager.resetCamera();
        }

        // Unlock camera for overview mode
        this.sceneManager.setFixedCamera(false);

        // Maintain visual progress: show completed pieces as solid, future as ghost
        this.house.updateAssemblyState(
            this.assemblySteps[this.currentStepIndex].id,
            this.currentPieceIndex,
            this.assemblySteps
        );

        this.renderOverview();
    }
}
