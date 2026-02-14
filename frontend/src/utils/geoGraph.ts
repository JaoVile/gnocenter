// src/utils/geoGraph.ts

// Definindo a estrutura do nosso Grafo
// Um dicionário onde a chave é o ID do ponto ("x_y") e o valor são seus vizinhos
type Graph = Record<string, { x: number; y: number; neighbors: string[] }>;

export const buildGraphFromGeoJSON = (geoJSON: any): Graph => {
  const graph: Graph = {};

  // Função auxiliar para criar um ID único para cada coordenada
  // Arredondamos para evitar que 100.00001 seja diferente de 100.00000
  const getCoordId = (x: number, y: number) => `${Math.round(x)}_${Math.round(y)}`;

  // Varre todas as linhas desenhadas (features)
  geoJSON.features.forEach((feature: any) => {
    // Só nos interessa se for uma Linha (Caminho/Corredor)
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates; // Array de pontos [[x,y], [x,y]]

      // Percorre os pontos da linha par a par (A -> B, B -> C...)
      for (let i = 0; i < coords.length - 1; i++) {
        // GeoJSON padrão é [Longitude(X), Latitude(Y)]
        // Leaflet usa [Latitude(Y), Longitude(X)]
        // Mantenha consistente com o que você desenhou. Vamos assumir [Y, X] aqui se for imagem simples.
        const [y1, x1] = coords[i]; 
        const [y2, x2] = coords[i + 1];

        const idA = getCoordId(x1, y1);
        const idB = getCoordId(x2, y2);

        // Se o nó A não existe no grafo, cria
        if (!graph[idA]) {
          graph[idA] = { x: x1, y: y1, neighbors: [] };
        }
        
        // Se o nó B não existe no grafo, cria
        if (!graph[idB]) {
          graph[idB] = { x: x2, y: y2, neighbors: [] };
        }

        // Cria a conexão de mão dupla (A pode ir para B, e B pode ir para A)
        if (!graph[idA].neighbors.includes(idB)) {
          graph[idA].neighbors.push(idB);
        }
        if (!graph[idB].neighbors.includes(idA)) {
          graph[idB].neighbors.push(idA);
        }
      }
    }
  });

  return graph;
}; 