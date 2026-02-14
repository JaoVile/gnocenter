// src/data/mockData.ts

// 1. O Grafo de Navegação (Nós e Conexões)
// Imagine que isso são os "cruzamentos" dos corredores do Moda Center
export const nodes = {
  "entrada-principal": { x: 2025, y: 100, vizinhos: ["centro-amarelo", "centro-azul"] },
  "centro-amarelo": { x: 1500, y: 3000, vizinhos: ["entrada-principal", "box-10", "praca-alimentacao"] },
  "centro-azul": { x: 2500, y: 3000, vizinhos: ["entrada-principal", "box-55"] },
  "box-10": { x: 1400, y: 3200, vizinhos: ["centro-amarelo"] }, // Loja do João
  "box-55": { x: 2600, y: 3200, vizinhos: ["centro-azul"] },    // Loja do Marcos
  "praca-alimentacao": { x: 2025, y: 4000, vizinhos: ["centro-amarelo"] }
};

// 2. As Lojas (Vitrine)
export const stores = [
  {
    id: "loja-1",
    nome: "João Jeans Atacado",
    nodeId: "box-10", // Onde ela fica no grafo
    whatsapp: "81999999999",
    categoria: "Jeans",
    produtos: [
      { nome: "Calça Skinny", preco: "R$ 45,00" },
      { nome: "Shorts Destroyed", preco: "R$ 35,00" }
    ]
  },
  {
    id: "loja-2",
    nome: "Marcos Moda Praia",
    nodeId: "box-55",
    whatsapp: "81988888888",
    categoria: "Praia",
    produtos: [
      { nome: "Biquíni Asa Delta", preco: "R$ 60,00" },
      { nome: "Sunga Box", preco: "R$ 40,00" }
    ]
  }
];