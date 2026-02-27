// src/utils/geoGraph.ts

type Graph = Record<string, { x: number; y: number; neighbors: string[] }>;

type GeoJsonCoordinate = [number, number];

type GeoJsonFeature = {
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
};

type GeoJsonFeatureCollection = {
  features?: GeoJsonFeature[];
};

const isCoordinateList = (value: unknown): value is GeoJsonCoordinate[] => {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      Array.isArray(item) &&
      item.length >= 2 &&
      typeof item[0] === 'number' &&
      typeof item[1] === 'number',
  );
};

export const buildGraphFromGeoJSON = (geoJSON: GeoJsonFeatureCollection): Graph => {
  const graph: Graph = {};

  const getCoordId = (x: number, y: number) => `${Math.round(x)}_${Math.round(y)}`;

  const features = geoJSON.features ?? [];

  features.forEach((feature) => {
    if (feature.geometry?.type !== 'LineString') return;
    if (!isCoordinateList(feature.geometry.coordinates)) return;

    const coords = feature.geometry.coordinates;

    for (let i = 0; i < coords.length - 1; i += 1) {
      // In this project, each coordinate pair is treated as [y, x].
      const [y1, x1] = coords[i];
      const [y2, x2] = coords[i + 1];

      const idA = getCoordId(x1, y1);
      const idB = getCoordId(x2, y2);

      if (!graph[idA]) {
        graph[idA] = { x: x1, y: y1, neighbors: [] };
      }

      if (!graph[idB]) {
        graph[idB] = { x: x2, y: y2, neighbors: [] };
      }

      if (!graph[idA].neighbors.includes(idB)) {
        graph[idA].neighbors.push(idB);
      }

      if (!graph[idB].neighbors.includes(idA)) {
        graph[idB].neighbors.push(idA);
      }
    }
  });

  return graph;
};
