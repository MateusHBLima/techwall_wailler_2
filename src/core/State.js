export class State {
    constructor() {
        this.progress = {};
        this.installedPieces = new Set();
        this.currentStepIndex = 0;
        this.currentPieceIndex = -1;
    }

    initializeProgress(data) {
        // Calculate totals for each piece type
        const totals = {};
        data.phases.forEach(phase => {
            phase.packages.forEach(pkg => {
                pkg.pieces.forEach(piece => {
                    if (!totals[piece.type]) {
                        totals[piece.type] = 0;
                    }
                    totals[piece.type]++;
                });
            });
        });

        // Initialize progress tracking
        for (const [type, total] of Object.entries(totals)) {
            this.progress[type] = {
                installed: 0,
                total: total
            };
        }

        console.log('Progress initialized:', this.progress);
    }

    incrementPiece(pieceId, pieceType) {
        if (!this.installedPieces.has(pieceId)) {
            this.installedPieces.add(pieceId);
            if (this.progress[pieceType]) {
                this.progress[pieceType].installed++;
                console.log(`Installed ${pieceType}: ${this.progress[pieceType].installed} / ${this.progress[pieceType].total}`);
            }
        }
    }

    getProgress(pieceType) {
        return this.progress[pieceType] || { installed: 0, total: 0 };
    }

    getAllProgress() {
        return this.progress;
    }

    isInstalled(pieceId) {
        return this.installedPieces.has(pieceId);
    }

    reset() {
        this.installedPieces.clear();
        for (const type in this.progress) {
            this.progress[type].installed = 0;
        }
        this.currentStepIndex = 0;
        this.currentPieceIndex = -1;
        console.log('Progress reset');
    }

    setAssemblyPosition(stepIndex, pieceIndex) {
        this.currentStepIndex = stepIndex;
        this.currentPieceIndex = pieceIndex;
    }

    getAssemblyPosition() {
        return {
            stepIndex: this.currentStepIndex,
            pieceIndex: this.currentPieceIndex
        };
    }
}
