export const ProfileCatalog = {
    "U90": {
        id: "U90",
        name: "Guia U90",
        type: "track", // guia (horizontal)
        width: 90,    // mm (base)
        flange: 30,   // mm (aba)
        thickness: 0.95, // mm
        color: 0xcccccc
    },
    "U140": {
        id: "U140",
        name: "Guia U140",
        type: "track",
        width: 140,
        flange: 30,
        thickness: 0.95,
        color: 0xeeeeee
    },
    "C90": {
        id: "C90",
        name: "Montante C90",
        type: "stud", // montante (vertical)
        width: 90,
        flange: 40,
        lip: 12, // enrijecedor
        thickness: 0.95,
        color: 0xaaffaa // Greenish for distinction? Or just steel.
    },
    "C140": {
        id: "C140",
        name: "Montante C140",
        type: "stud",
        width: 140,
        flange: 40,
        lip: 12,
        thickness: 0.95,
        color: 0xaaffaa
    },
    // --- NOVOS MATERIAIS ---
    "WALL_GENERIC": {
        id: "WALL_GENERIC",
        name: "Parede (Bloco)",
        type: "box", // Geometria simples
        // Dimensões padrão em CM
        width: 61,       // Largura padrão (cm)
        thickness: 10,   // Espessura padrão (cm)
        length: 280,     // Altura padrão (cm)
        color: 0xeeeeee
    },
    "ROOF_PANEL": {
        id: "ROOF_PANEL",
        name: "Telha Sanduíche",
        type: "plate", // Perfil ondulado/trapezoidal
        width: 1000, // Largura útil
        flange: 30,  // Altura da onda
        thickness: 0.5,
        color: 0xcc4444
    },
    "DOOR_STD": {
        id: "DOOR_STD",
        name: "Porta Padrão 80",
        type: "opening",
        width: 800,
        height: 2100, // Altura fixa inicial
        color: 0x8b4513
    },
    "WINDOW_STD": {
        id: "WINDOW_STD",
        name: "Janela 120x120",
        type: "opening",
        width: 1200,
        height: 1200,
        color: 0x87ceeb
    },
    // --- TRAMA PROFILES (Notched Panel / Painel Dentado) ---
    "TRAMA_1": {
        id: "TRAMA_1",
        name: "Detalhe Trama 1 (Dente Topo/Dir)",
        type: "notched_panel",
        // Dimensions in mm
        length: 2800,     // Altura Z
        width: 610,       // Largura X
        thickness: 90,    // Profundidade Y
        // Geometry rules
        notchSide: "RIGHT",      // Dentes apontam para a direita (+X)
        startPattern: "TOOTH",   // Começa com Dente (Cheio) no topo
        segmentHeight: 467,      // Altura de cada segmento
        notchDepth: 305,         // Profundidade do recorte (metade da largura)
        color: 0xcccccc
    },
    "TRAMA_2": {
        id: "TRAMA_2",
        name: "Detalhe Trama 2 (Dente Baixo/Esq)",
        type: "notched_panel",
        length: 2800,
        width: 610,
        thickness: 90,
        notchSide: "LEFT",       // Dentes apontam para a esquerda (-X)
        startPattern: "GAP",     // Começa com Vazio (Recuo) no topo
        segmentHeight: 467,
        notchDepth: 305,
        color: 0xaaaaaa
    },
    // --- OITÃO (Gable Wall) ---
    "OITAO": {
        id: "OITAO",
        name: "Oitão (Empena)",
        type: "gable",
        // Dimensões em CM
        width: 300,         // Largura da base (cm)
        length: 280,        // Altura (cm)
        thickness: 10,      // Espessura (cm)
        // Inclinação do corte triangular (0 = retângulo, sem corte)
        slope: 0,           // Inclinação em % (i = x%)
        // Tipo de corte: 'center' = pico no centro, 'left' = inclinação esquerda, 'right' = direita
        cutType: 'center',
        color: 0xddddcc
    }
};
