import { useMapEvents, Polyline, Marker, Popup } from 'react-leaflet'; // Removido 'Circle'
import { useState } from 'react';
import L from 'leaflet';

// Define o tipo do Nó
type Node = {
  id: string;
  x: number;
  y: number;
  vizinhos: string[];
};

const MapDevTools = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Ícone temporário para o editor
  const devIcon = new L.DivIcon({
    className: 'dev-node-icon',
    html: '<div style="background: red; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white;"></div>',
    iconSize: [10, 10],
    iconAnchor: [5, 5]
  });

  useMapEvents({
    click(e) {
      const x = Math.round(e.latlng.lng);
      const y = Math.round(e.latlng.lat);
      
      // Se estiver segurando ALT, conecta com o último selecionado
      if (e.originalEvent.altKey && selectedId) {
        const newNodeId = `node_${Date.now()}`;

        // 1. Atualiza o nó anterior para apontar para o novo
        setNodes(prev => prev.map(node => {
          if (node.id === selectedId) {
            return { ...node, vizinhos: [...node.vizinhos, newNodeId] };
          }
          return node;
        }));

        // 2. Cria o novo nó
        setNodes(prev => [
          ...prev, 
          { id: newNodeId, x, y, vizinhos: [selectedId] }
        ]);
        setSelectedId(newNodeId);

      } else {
        // Clique normal
        const id = prompt("Nome do Ponto (ex: box-10, cruzamento-azul):") || `node_${Date.now()}`;
        setNodes(prev => [...prev, { id, x, y, vizinhos: [] }]);
        setSelectedId(id);
      }
    },
  });

  const handleMarkerClick = (id: string, e: L.LeafletMouseEvent) => {
    L.DomEvent.stopPropagation(e);
    
    if (selectedId && selectedId !== id) {
      setNodes(prev => prev.map(n => {
        if (n.id === selectedId && !n.vizinhos.includes(id)) {
          return { ...n, vizinhos: [...n.vizinhos, id] };
        }
        if (n.id === id && !n.vizinhos.includes(selectedId)) {
          return { ...n, vizinhos: [...n.vizinhos, selectedId] };
        }
        return n;
      }));
      alert(`Conectado: ${selectedId} <-> ${id}`);
    }
    setSelectedId(id);
  };

  const exportarJSON = () => {
    const exportData = nodes.reduce((acc, curr) => {
      // @ts-ignore
      acc[curr.id] = { x: curr.x, y: curr.y, vizinhos: curr.vizinhos };
      return acc;
    }, {} as any);

    console.log(JSON.stringify(exportData, null, 2));
    alert("JSON copiado para o Console (F12)!");
  };

  return (
    <>
      <div style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 1000 }}>
        <button onClick={exportarJSON} style={{ padding: 15, fontSize: 16, background: 'black', color: 'white', cursor: 'pointer' }}>
          💾 Gerar JSON no Console
        </button>
        <div style={{ background: 'white', padding: 5, marginTop: 5 }}>
          Selecionado: <b>{selectedId || 'Nenhum'}</b>
        </div>
      </div>

      {nodes.map(node => (
        <Marker 
          key={node.id} 
          position={[node.y, node.x]} 
          icon={devIcon}
          eventHandlers={{ click: (e) => handleMarkerClick(node.id, e) }}
        >
          <Popup>{node.id}</Popup>
        </Marker>
      ))}

      {nodes.map(node => 
        node.vizinhos.map(vizinhoId => {
          const vizinho = nodes.find(n => n.id === vizinhoId);
          if (!vizinho) return null;
          return (
            <Polyline 
              key={`${node.id}-${vizinhoId}`} 
              positions={[[node.y, node.x], [vizinho.y, vizinho.x]]} 
              color="red" 
            />
          );
        })
      )}
    </>
  );
};

export default MapDevTools;