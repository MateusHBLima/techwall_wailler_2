/**
 * Script de Instruções de Montagem - Casa Catarina
 * 
 * Execute este script no console do navegador após abrir o Model Builder
 * com o modelo Casa Catarina carregado.
 * 
 * Como usar:
 * 1. Abra o Model Builder com o modelo Casa Catarina
 * 2. Abra o Console do navegador (F12 > Console)
 * 3. Cole e execute este script
 */

(function addCasaCatarinaInstructions() {
    // Acessa o ModelStore via a página
    const app = window.app || window;

    // Instruções base para cada tipo de perfil
    const instructionTemplates = {
        'U90': {
            guia_inferior: {
                text: `GUIA INFERIOR (U90)

1. Verifique se o piso está nivelado e limpo
2. Posicione a guia U90 na marcação do piso
3. Fixe com parafusos autoperfurantes a cada 60cm
4. Verifique o alinhamento com nível de bolha

⚠️ ATENÇÃO: A abertura do "U" deve ficar voltada para cima para receber os montantes.`,
                notes: 'Material: Guia U90 galvanizado | Fixação: Parafusos 4.2x32mm'
            },
            guia_superior: {
                text: `GUIA SUPERIOR (U90)

1. Encaixe a guia sobre os montantes já instalados
2. Alinhe com a guia inferior usando prumo ou laser
3. Fixe cada montante na guia com 2 parafusos
4. Verifique esquadro nos cantos

⚠️ ATENÇÃO: Deixe folga de 5mm para dilatação térmica em vãos maiores que 3m.`,
                notes: 'Material: Guia U90 galvanizado | Fixação: Parafusos 4.2x13mm'
            }
        },
        'C90': {
            montante: {
                text: `MONTANTE VERTICAL (C90)

1. Meça e corte o montante no comprimento exato (pé-direito - 10mm)
2. Encaixe o montante na guia inferior
3. Alinhe verticalmente usando prumo
4. Fixe na guia inferior com parafusos
5. Mantenha espaçamento de 60cm entre montantes

⚠️ ATENÇÃO: A alma do montante deve ficar voltada para o lado de aplicação da placa.`,
                notes: 'Material: Montante C90 galvanizado | Espaçamento: 600mm eixo a eixo'
            }
        },
        'WALL_GENERIC': {
            parede_simples: {
                text: `PAREDE (BLOCO)

1. Posicione a parede na localização indicada
2. Verifique o alinhamento com as paredes adjacentes
3. Fixe conforme especificação do projeto

📋 Esta é uma parede de bloco para visualização geral.`,
                notes: 'Elemento de parede completa'
            },
            parede_cortada: {
                text: `PAREDE COM ABERTURA

1. Esta parede possui abertura para porta/janela
2. Verifique as dimensões do vão antes de posicionar
3. A abertura deve estar alinhada com a esquadria correspondente
4. Reforce as laterais da abertura se necessário

⚠️ ATENÇÃO: Confira as medidas do vão com a esquadria antes de fixar.`,
                notes: 'Parede com recorte para abertura'
            }
        },
        'DOOR_STD': {
            porta: {
                text: `PORTA PADRÃO

1. Verifique se o vão está preparado e nivelado
2. Posicione o batente/marco na abertura
3. Nivele e aprume o marco
4. Fixe com espuma expansiva ou parafusos
5. Instale a folha da porta nas dobradiças
6. Ajuste a maçaneta e fechadura

⚠️ ATENÇÃO: Deixe folga de 3mm entre a folha e o piso para ventilação.`,
                notes: 'Porta padrão 80x210cm'
            }
        },
        'WINDOW_STD': {
            janela: {
                text: `JANELA PADRÃO

1. Confira as medidas do vão
2. Posicione a janela centralizada no vão
3. Calce e nivele a esquadria
4. Fixe com parafusos nos pontos indicados
5. Aplique silicone estrutural nas bordas
6. Teste a abertura e fechamento

📋 Certifique-se de que a vedação está correta para evitar infiltrações.`,
                notes: 'Janela padrão 120x120cm'
            }
        },
        'OITAO': {
            oitao: {
                text: `OITÃO (EMPENA)

1. Esta peça forma o fechamento triangular do telhado
2. Posicione após a montagem das paredes laterais
3. Alinhe o ápice com a cumeeira do telhado
4. Fixe nas paredes adjacentes

⚠️ ATENÇÃO: O ângulo deve corresponder à inclinação do telhado.`,
                notes: 'Oitão/Empena para fechamento'
            }
        },
        'ROOF_PANEL': {
            telha: {
                text: `TELHA DE COBERTURA

1. Inicie a instalação pela beirada inferior
2. Sobreponha as telhas conforme especificação
3. Fixe com parafusos autoperfurantes com arruela de vedação
4. Avance em direção à cumeeira

⚠️ ATENÇÃO: Use EPI adequado para trabalho em altura.`,
                notes: 'Telha sanduíche ou trapezoidal'
            }
        }
    };

    // Função para determinar o tipo de instrução baseado na peça
    function getInstructionForPiece(piece, stepIndex, totalPieces) {
        const profileId = piece.profileId;
        const id = piece.id?.toLowerCase() || '';
        const hasCuts = piece.cuts && piece.cuts.length > 0;

        let template = null;
        let key = '';

        if (profileId === 'U90') {
            if (id.includes('inf') || id.includes('base') || stepIndex === 0) {
                template = instructionTemplates.U90.guia_inferior;
                key = 'Guia Inferior';
            } else {
                template = instructionTemplates.U90.guia_superior;
                key = 'Guia Superior';
            }
        } else if (profileId === 'C90' || profileId === 'C140') {
            template = instructionTemplates.C90.montante;
            key = 'Montante';
        } else if (profileId === 'WALL_GENERIC') {
            if (hasCuts) {
                template = instructionTemplates.WALL_GENERIC.parede_cortada;
                key = 'Parede com Abertura';
            } else {
                template = instructionTemplates.WALL_GENERIC.parede_simples;
                key = 'Parede';
            }
        } else if (profileId === 'DOOR_STD') {
            template = instructionTemplates.DOOR_STD.porta;
            key = 'Porta';
        } else if (profileId === 'WINDOW_STD') {
            template = instructionTemplates.WINDOW_STD.janela;
            key = 'Janela';
        } else if (profileId === 'OITAO') {
            template = instructionTemplates.OITAO.oitao;
            key = 'Oitão';
        } else if (profileId === 'ROOF_PANEL') {
            template = instructionTemplates.ROOF_PANEL.telha;
            key = 'Telha';
        }

        if (!template) {
            return {
                text: `Peça ${piece.id || 'desconhecida'}\n\nSiga as instruções gerais de montagem para este tipo de perfil.`,
                notes: `Perfil: ${profileId}`
            };
        }

        return {
            text: template.text,
            notes: template.notes,
            key: key
        };
    }

    console.log('=== Iniciando adição de instruções ===');

    // Este script precisa ser executado no contexto da página ModelBuilderPage
    // Vamos retornar as instruções para que possam ser copiadas

    console.log('📋 Instruções disponíveis para os seguintes tipos de peças:');
    console.log('- U90 (Guia): Inferior e Superior');
    console.log('- C90/C140 (Montante): Vertical');
    console.log('- WALL_GENERIC: Simples e Com Abertura');
    console.log('- DOOR_STD: Porta');
    console.log('- WINDOW_STD: Janela');
    console.log('- OITAO: Empena/Oitão');
    console.log('- ROOF_PANEL: Telha');

    console.log('\n📝 Para adicionar instruções a uma peça:');
    console.log('1. Selecione a peça no Model Builder');
    console.log('2. Expanda "📝 Instruções de Montagem"');
    console.log('3. Cole o texto apropriado do template acima');

    // Exporta as funções para uso manual
    window.getInstructionForPiece = getInstructionForPiece;
    window.instructionTemplates = instructionTemplates;

    console.log('\n✅ Templates de instruções carregados!');
    console.log('Use: window.instructionTemplates para ver todos os templates');
    console.log('Use: window.getInstructionForPiece(piece, stepIndex, totalPieces) para obter instrução específica');

    return instructionTemplates;
})();
