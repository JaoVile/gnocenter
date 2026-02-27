import { Marker, Polyline, Popup, useMapEvents } from 'react-leaflet';
import { useState } from 'react';
import L from 'leaflet';

type Node = {
  id: string;
  x: number;
  y: number;
  vizinhos: string[];
};

type ExportNode = {
  x: number;
  y: number;
  vizinhos: string[];
};

const MapDevTools = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const devIcon = new L.DivIcon({
    className: 'dev-node-icon',
    html: '<div style="background:red;width:10px;height:10px;border-radius:50%;border:2px solid white;"></div>',
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });

  useMapEvents({
    click(e) {
      const x = Math.round(e.latlng.lng);
      const y = Math.round(e.latlng.lat);

      if (e.originalEvent.altKey && selectedId) {
        const newNodeId = `node_${Date.now()}`;

        setNodes((prev) =>
          prev.map((node) => {
            if (node.id === selectedId) {
              return { ...node, vizinhos: [...node.vizinhos, newNodeId] };
            }
            return node;
          }),
        );

        setNodes((prev) => [...prev, { id: newNodeId, x, y, vizinhos: [selectedId] }]);
        setSelectedId(newNodeId);
        return;
      }

      const typedId = window.prompt('Nome do ponto (ex: box-10, cruzamento-azul):');
      const id = typedId?.trim() || `node_${Date.now()}`;
      setNodes((prev) => [...prev, { id, x, y, vizinhos: [] }]);
      setSelectedId(id);
    },
  });

  const handleMarkerClick = (id: string, e: L.LeafletMouseEvent) => {
    L.DomEvent.stopPropagation(e);

    if (selectedId && selectedId !== id) {
      setNodes((prev) =>
        prev.map((node) => {
          if (node.id === selectedId && !node.vizinhos.includes(id)) {
            return { ...node, vizinhos: [...node.vizinhos, id] };
          }
          if (node.id === id && !node.vizinhos.includes(selectedId)) {
            return { ...node, vizinhos: [...node.vizinhos, selectedId] };
          }
          return node;
        }),
      );
      window.alert(`Conectado: ${selectedId} <-> ${id}`);
    }

    setSelectedId(id);
  };

  const exportarJSON = () => {
    const exportData = nodes.reduce<Record<string, ExportNode>>((acc, curr) => {
      acc[curr.id] = { x: curr.x, y: curr.y, vizinhos: curr.vizinhos };
      return acc;
    }, {});

    console.log(JSON.stringify(exportData, null, 2));
    window.alert('JSON gerado no Console (F12).');
  };

  return (
    <>
      <div style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 1000 }}>
        <button
          onClick={exportarJSON}
          style={{
            padding: 15,
            fontSize: 16,
            background: 'black',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Gerar JSON no Console
        </button>
        <div style={{ background: 'white', padding: 5, marginTop: 5 }}>
          Selecionado: <b>{selectedId || 'Nenhum'}</b>
        </div>
      </div>

      {nodes.map((node) => (
        <Marker
          key={node.id}
          position={[node.y, node.x]}
          icon={devIcon}
          eventHandlers={{ click: (event) => handleMarkerClick(node.id, event) }}
        >
          <Popup>{node.id}</Popup>
        </Marker>
      ))}

      {nodes.map((node) =>
        node.vizinhos.map((vizinhoId) => {
          const vizinho = nodes.find((item) => item.id === vizinhoId);
          if (!vizinho) return null;
          return (
            <Polyline
              key={`${node.id}-${vizinhoId}`}
              positions={[[node.y, node.x], [vizinho.y, vizinho.x]]}
              color='red'
            />
          );
        }),
      )}
    </>
  );
};

export default MapDevTools;
