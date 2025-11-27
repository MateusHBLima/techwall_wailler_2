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

        // Check for saved progress to resume
        const savedPos = this.state.getAssemblyPosition();
        if (savedPos.stepIndex > 0 || savedPos.pieceIndex > -1) {
            console.log('Resuming assembly from:', savedPos);
            this.currentStepIndex = savedPos.stepIndex;
            this.currentPieceIndex = savedPos.pieceIndex;
        } else {
            this.currentStepIndex = 0;
            this.currentPieceIndex = -1;
        }

        // Initial View (Back for P01)
        this.sceneManager.setCardinalView('BACK');

        // Lock camera (no rotation) during assembly
        this.sceneManager.setFixedCamera(true);

        this.updateAssemblyState();
    }

    updateAssemblyState() {
        const currentPkg = this.assemblySteps[this.currentStepIndex];
        this.house.updateAssemblyState(currentPkg.id, this.currentPieceIndex, this.assemblySteps);

        // Determine Cardinal View
        let viewName = 'FRONT'; // Default

        if (currentPkg.id === 'P01_FUNDO') viewName = 'BACK';
        else if (currentPkg.id === 'P02_DIREITA') viewName = 'RIGHT';
        else if (currentPkg.id === 'P03_FRENTE') viewName = 'FRONT';
        else if (currentPkg.id === 'P04_ESQUERDA') viewName = 'LEFT';
        else if (currentPkg.id === 'P05_OITOES') {
            // Check piece Z position to decide Front vs Back
            if (this.currentPieceIndex > -1) {
                const piece = currentPkg.pieces[this.currentPieceIndex];
                if (piece.z < 75) viewName = 'BACK';
                else viewName = 'FRONT';
            } else {
                // Default start of package
                viewName = 'BACK';
            }
        }
        else if (currentPkg.id === 'P06_COBERTURA') {
            // Check piece type for Left vs Right
            if (this.currentPieceIndex > -1) {
                const piece = currentPkg.pieces[this.currentPieceIndex];
                if (piece.type.includes('left')) viewName = 'LEFT';
                else viewName = 'RIGHT';
            } else {
                viewName = 'LEFT';
            }
        }

        this.sceneManager.setCardinalView(viewName);

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

        // Calculate installed pieces for this specific step
        const installedInStep = {};
        // Check pieces up to currentPieceIndex
        for (let i = 0; i <= this.currentPieceIndex; i++) {
            const p = currentPkg.pieces[i];
            if (p) {
                installedInStep[p.type] = (installedInStep[p.type] || 0) + 1;
            }
        }

        for (const [type, count] of Object.entries(localCounts)) {
            const item = document.createElement('li');
            const installed = installedInStep[type] || 0;
            item.textContent = `${this.formatType(type)}: ${installed}/${count}`;
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
