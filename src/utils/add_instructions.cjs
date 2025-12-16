/**
 * Script para adicionar instruções de montagem ao modelo Casa Catarina
 * 
 * Execute: node add_instructions.js
 */

const fs = require('fs');
const path = require('path');

// Caminho do arquivo de modelos
const modelsPath = path.join(__dirname, '..', 'data', 'local_models.json');

// Templates de instruções
const instructionTemplates = {
    'WALL_GENERIC': {
        standard: {
            text: `PAINEL DE PAREDE

1. Verifique as dimensões da peça: comprimento e largura
2. Posicione na estrutura conforme indicado
3. Alinhe com as peças adjacentes já instaladas
4. Fixe com parafusos autoperfurantes nos montantes

📐 Mantenha o espaçamento uniforme entre painéis.`,
            notes: 'Painel sanduíche para fechamento'
        },
        withCuts: {
            text: `PAINEL COM ABERTURA

1. Este painel possui recorte para porta ou janela
2. Verifique as dimensões do vão cortado
3. Posicione alinhado com a abertura correspondente
4. A parte cortada deve coincidir com a esquadria
5. Fixe primeiro os cantos, depois o centro

⚠️ ATENÇÃO: Confira se o vão está correto antes de fixar.`,
            notes: 'Painel com recorte para abertura'
        }
    },
    'TRAMA_1': {
        standard: {
            text: `TRAMA DE FECHAMENTO (Tipo 1)

1. Encaixe na extremidade da parede
2. Alinhe com o topo e base dos painéis
3. Serve como arremate lateral
4. Fixe com parafusos a cada 40cm

📋 Peça de acabamento para bordas.`,
            notes: 'Trama de fechamento lateral'
        }
    },
    'TRAMA_2': {
        standard: {
            text: `TRAMA DE FECHAMENTO (Tipo 2)

1. Posicione na junção entre paredes
2. Serve como elemento de travamento
3. Alinhe verticalmente com as tramas adjacentes
4. Fixe firmemente para garantir rigidez

📋 Elemento estrutural de travamento.`,
            notes: 'Trama de travamento'
        }
    },
    'OITAO': {
        standard: {
            text: `OITÃO / EMPENA

1. Monte após a conclusão das paredes
2. Posicione sobre o topo das paredes laterais
3. O ápice deve alinhar com a cumeeira do telhado
4. Verifique a inclinação conforme projeto
5. Fixe nas bordas das paredes

⚠️ ATENÇÃO: Trabalhe com auxílio para peças grandes.`,
            notes: 'Fechamento triangular para telhado'
        }
    },
    'DOOR_STD': {
        standard: {
            text: `INSTALAÇÃO DE PORTA

1. Confira as dimensões do vão (86x219cm padrão)
2. Posicione o batente nivelado
3. Calce se necessário para ajuste
4. Fixe o marco com espuma ou parafusos
5. Instale as dobradiças e folha da porta
6. Ajuste a fechadura e maçaneta

📋 Deixe 3mm de folga no piso para ventilação.`,
            notes: 'Porta interna padrão'
        }
    },
    'WINDOW_STD': {
        standard: {
            text: `INSTALAÇÃO DE JANELA

1. Verifique as dimensões do vão
2. Centralize a esquadria no vão
3. Calce para nivelar
4. Fixe com parafusos nos pontos indicados
5. Aplique silicone nas bordas externas
6. Teste a abertura e fechamento

📋 Verifique a vedação contra infiltrações.`,
            notes: 'Janela de alumínio/PVC'
        }
    },
    'U140': {
        standard: {
            text: `GUIA U140 (ESTRUTURAL)

1. Esta guia serve como apoio para cobertura
2. Posicione sobre as paredes/oitões
3. Alinhe com as outras guias instaladas
4. Fixe a cada 60cm com parafusos

📋 Elemento estrutural para receber telhas.`,
            notes: 'Guia estrutural para cobertura'
        }
    },
    'ROOF_PANEL': {
        standard: {
            text: `TELHA DE COBERTURA

1. Use EPI para trabalho em altura
2. Inicie pela borda inferior do telhado
3. Sobreponha as telhas conforme especificação
4. Fixe com parafusos com arruela de vedação
5. Avance em direção à cumeeira

⚠️ ATENÇÃO: Trabalho em altura - cuidado redobrado!`,
            notes: 'Telha sanduíche/trapezoidal'
        }
    }
};

// Carregar modelos
const modelsJson = fs.readFileSync(modelsPath, 'utf8');
const models = JSON.parse(modelsJson);

console.log('Total de modelos:', models.length);

let piecesUpdated = 0;

// Função para adicionar instruções a uma peça
function addInstructionsToPiece(piece, pkgName) {
    const profileId = piece.profileId;
    const hasCuts = piece.cuts && piece.cuts.length > 0;

    const template = instructionTemplates[profileId];
    if (!template) {
        // Fallback genérico
        piece.instructions = {
            text: `PEÇA: ${piece.id}\n\nSiga as instruções gerais de montagem.\nVerifique alinhamento e fixação.`,
            notes: `Perfil: ${profileId}`,
            images: [],
            video: ''
        };
        piecesUpdated++;
        return;
    }

    const instruction = hasCuts && template.withCuts ? template.withCuts : template.standard;

    piece.instructions = {
        text: instruction.text,
        notes: instruction.notes + ` | Pacote: ${pkgName}`,
        images: [],
        video: ''
    };
    piecesUpdated++;
}

// Processar TODOS os modelos
models.forEach(model => {
    if (!model.data) return;

    console.log(`Processando: ${model.name} (${model.id})`);

    // Processar peças soltas
    if (model.data.looseParts) {
        model.data.looseParts.forEach(piece => {
            addInstructionsToPiece(piece, 'Peças Soltas');
        });
    }

    // Processar pacotes
    if (model.data.phases) {
        model.data.phases.forEach(phase => {
            if (phase.packages) {
                phase.packages.forEach(pkg => {
                    if (pkg.pieces) {
                        pkg.pieces.forEach(piece => {
                            addInstructionsToPiece(piece, pkg.name);
                        });
                    }
                });
            }
        });
    }
});

// Salvar modelos atualizados
fs.writeFileSync(modelsPath, JSON.stringify(models), 'utf8');

console.log(`\n✅ Instruções adicionadas a ${piecesUpdated} peças!`);
console.log(`Arquivo salvo: ${modelsPath}`);

