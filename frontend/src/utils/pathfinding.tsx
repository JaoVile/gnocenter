// src/utils/pathfinding.tsx
import rawGraph from '../data/navGraph.json';

// Define o tipo do nó do grafo
type GraphNode = {
  x: number;
  y: number;
  neighbors: string[];
};

// Define o tipo do Grafo completo
type Graph = Record<string, GraphNode>;

// Força o JSON a ser tratado como o tipo Graph
const graph: Graph = rawGraph as unknown as Graph;

// Heurística: Distância Manhattan (rápida para grids)
const heuristic = (nodeA: string, nodeB: string): number => {
  const a = graph[nodeA];
  const b = graph[nodeB];
  if (!a || !b) return 0;
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
};

// Encontra o nó mais próximo do clique (com tolerância de distância)
export const findNearestNode = (x: number, y: number, maxDistance = 50): string | null => {
  let nearestId = null;
  let minDist = Infinity;

  // Busca simples pelo nó mais próximo
  for (const id in graph) {
    const node = graph[id];
    // Distância Euclidiana (Pitagoras)
    const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
    
    // Se estiver a menos de 50 pixels de um nó, considera válido
    if (dist < maxDistance && dist < minDist) {
      minDist = dist;
      nearestId = id;
    }
  }
  return nearestId;
};

// O Algoritmo A* (A-Star)
export const findPath = (startId: string, endId: string) => {
  // Se os nós não existirem no grafo, aborta
  if (!graph[startId] || !graph[endId]) {
    console.error("Nós de origem ou destino inválidos");
    return null;
  }

  // --- CORREÇÃO DO ERRO ---
  // Dizemos explicitamente ao TS: "Este Set vai guardar strings!"
  const openSet = new Set<string>([startId]);
  
  const cameFrom: Record<string, string> = {};
  
  const gScore: Record<string, number> = {}; 
  gScore[startId] = 0;

  const fScore: Record<string, number> = {}; 
  fScore[startId] = heuristic(startId, endId);

  const getLowestF = () => {
    let lowestNode = null;
    let lowestVal = Infinity;
    openSet.forEach(node => {
      const score = fScore[node] ?? Infinity;
      if (score < lowestVal) {
        lowestVal = score;
        lowestNode = node;
      }
    });
    return lowestNode;
  };

  while (openSet.size > 0) {
    const current = getLowestF();
    
    // Se não tem mais para onde ir ou achou o destino
    if (!current) break;
    if (current === endId) {
      return reconstructPath(cameFrom, current);
    }

    openSet.delete(current);

    const neighbors = graph[current].neighbors || [];
    for (const neighbor of neighbors) {
      const tentativeGScore = (gScore[current] ?? Infinity) + 1;

      if (tentativeGScore < (gScore[neighbor] ?? Infinity)) {
        cameFrom[neighbor] = current;
        gScore[neighbor] = tentativeGScore;
        fScore[neighbor] = tentativeGScore + heuristic(neighbor, endId);
        
        if (!openSet.has(neighbor)) {
          openSet.add(neighbor); // Agora isso funciona!
        }
      }
    }
  }

  return null; // Caminho não encontrado
};

// Função auxiliar para remontar o caminho de trás para frente
const reconstructPath = (cameFrom: Record<string, string>, current: string) => {
  // --- CORREÇÃO DO ERRO ---
  // Dizemos explicitamente: "Isso é um array de arrays de números"
  const path: number[][] = [];
  let temp = current;
  
  while (temp) {
    const node = graph[temp];
    // Leaflet pede [Lat, Lng], no nosso caso [Y, X]
    path.push([node.y, node.x]);
    temp = cameFrom[temp];
  }
  return path.reverse();
};
