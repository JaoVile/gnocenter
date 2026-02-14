const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

// CONFIGURAÇÕES
const INPUT_IMAGE = 'mapa-logica.png';
const OUTPUT_FILE = '../frontend/src/data/navGraph.json'; // Salva direto no Frontend
const GRID_SIZE = 15; // Tamanho do "passo" em pixels. 
// 10 = Muito preciso (arquivo pesado), 20 = Mais leve (menos preciso).
// Teste com 15 para começar.

async function generateGraph() {
  console.log(`🔍 Lendo imagem: ${INPUT_IMAGE}...`);
  
  try {
    const image = await Jimp.read(INPUT_IMAGE);
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    
    console.log(`📏 Dimensões: ${width}x${height}`);
    console.log(`⚙️  Grid Size: ${GRID_SIZE}px`);

    const graph = {};
    const nodes = [];

    // 1. ESCANEAR: Criar Nós nos espaços brancos
    for (let y = 0; y < height; y += GRID_SIZE) {
      for (let x = 0; x < width; x += GRID_SIZE) {
        
        // Pega a cor do pixel (Hex)
        const pixelColor = image.getPixelColor(x, y);
        const rgba = Jimp.intToRGBA(pixelColor);

        // Lógica: Se for CLARO (Branco ou quase branco), é caminhável
        // R, G e B > 200 garante que não é preto/cinza escuro
        const isWalkable = rgba.r > 200 && rgba.g > 200 && rgba.b > 200;

        if (isWalkable) {
          const id = `${x}_${y}`;
          graph[id] = { x, y, neighbors: [] };
          nodes.push({ id, x, y });
        }
      }
    }

    console.log(`✅ Nós criados: ${nodes.length}`);
    console.log(`🔗 Criando conexões (arestas)...`);

    // 2. CONECTAR: Ligar nós vizinhos (Cima, Baixo, Esquerda, Direita)
    nodes.forEach(node => {
      const { x, y, id } = node;
      
      // Possíveis vizinhos baseados no Grid Size
      const candidates = [
        `${x + GRID_SIZE}_${y}`,   // Direita
        `${x - GRID_SIZE}_${y}`,   // Esquerda
        `${x}_${y + GRID_SIZE}`,   // Baixo
        `${x}_${y - GRID_SIZE}`    // Cima
        // Se quiser diagonal, adicione aqui, mas aumenta muito o peso
      ];

      candidates.forEach(neighborId => {
        if (graph[neighborId]) {
          graph[id].neighbors.push(neighborId);
        }
      });
    });

    // 3. SALVAR
    const outputData = JSON.stringify(graph);
    // Caminho absoluto para garantir que ache a pasta frontend
    const outputPath = path.resolve(__dirname, OUTPUT_FILE);
    
    fs.writeFileSync(outputPath, outputData);
    console.log(`🎉 Sucesso! Grafo salvo em: ${outputPath}`);

  } catch (err) {
    console.error("❌ Erro ao processar imagem:", err);
  }
}

generateGraph();