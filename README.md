# Gnocenter

Aplicacao web de navegacao interna (mapa indoor) para localizar pontos de interesse e tracar rotas dentro do GNOCENTER.

## Visao geral

O projeto entrega uma experiencia de mapa interativo com:

- exibicao de POIs (lojas, entradas e banheiros)
- busca e selecao rapida de locais
- calculo de rota entre origem e destino
- estimativa de distancia e tempo medio de caminhada
- painel de detalhes com imagens, produtos e link de WhatsApp

Hoje, a aplicacao roda no frontend. A pasta `backend/` existe, mas esta vazia no estado atual do repositorio.

## Como funciona (resumo tecnico)

1. O mapa base eh renderizado com `React + Leaflet` usando `ImageOverlay` sobre coordenadas geograficas fixas.
2. Os pontos (POIs) ficam no estado da aplicacao e sao exibidos com icones customizados.
3. Para rotas, cada POI eh associado ao no mais proximo do grafo (`frontend/src/data/navGraph.json`).
4. O algoritmo A* (`frontend/src/utils/pathfinding.tsx`) calcula o caminho entre origem e destino.
5. A rota final eh desenhada no mapa com estimativa de tempo e animacao de deslocamento.

## Stack e dependencias

- Frontend: `React 19`, `TypeScript`, `Vite`, `Leaflet`, `React-Leaflet`, `Turf`
- Scripts auxiliares: `Node.js` + `Jimp` (geracao/atualizacao de grafo de navegacao)

## Estrutura do projeto

```text
gnocenter/
|- frontend/   # aplicacao principal (React + Vite)
|- backend/    # reservado (vazio no estado atual)
|- scripts/    # utilitarios para gerar dados do grafo
`- README.md
```

## Pre-requisitos

- `Node.js` 20+ (recomendado LTS)
- `npm` (ja vem com Node)
- `git` (para clonar o repositorio)

## Instalacao passo a passo

### 1) Clonar o repositorio

```powershell
git clone <URL_DO_REPOSITORIO>
cd gnocenter
```

### 2) Instalar dependencias do frontend (obrigatorio)

```powershell
cd frontend
npm install
cd ..
```

### 3) Instalar dependencias de scripts (opcional, para regenerar o grafo)

```powershell
cd scripts
npm install
cd ..
```

## Como rodar o projeto

### Rodar em desenvolvimento

```powershell
cd frontend
npm run dev
```

Depois, abra no navegador o endereco mostrado no terminal (normalmente `http://localhost:5173`).

### Gerar build de producao

```powershell
cd frontend
npm run build
```

### Visualizar build localmente

```powershell
cd frontend
npm run preview
```

### Rodar lint

```powershell
cd frontend
npm run lint
```

## Comandos uteis

### Regerar o arquivo de grafo (`navGraph.json`)

Use quando atualizar o mapa logico em `scripts/mapa-logica.png`.

```powershell
cd scripts
node scanMap.js
```

Esse comando sobrescreve `frontend/src/data/navGraph.json`.

## Observacoes importantes

- Nao existe `.env` obrigatorio no estado atual do projeto.
- O frontend eh a parte principal e suficiente para executar a aplicacao hoje.
- O modo admin existe na interface (botao `A`) para operacoes de edicao durante uso da aplicacao.
