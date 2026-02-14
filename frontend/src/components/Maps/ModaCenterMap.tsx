import {
  ImageOverlay,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { findNearestNode, findPath } from '../../utils/pathfinding';

type PoiType = 'loja' | 'banheiro' | 'entrada';

type StoreProduct = {
  nome: string;
  preco: string;
  imagemUrl?: string;
};

type PoiAccessCount = Record<string, number>;

interface PointData {
  id: string;
  x: number;
  y: number;
  nome: string;
  tipo: PoiType;
  descricao?: string;
  imagemUrl?: string;
  contato?: string;
  produtos?: StoreProduct[];
  nodeId?: string;
}

type EditingPoi = Partial<PointData> & {
  produtosText?: string;
};

const createIcon = (label: string, color: string, size = 30, isHighlighted = false) =>
  new L.DivIcon({
    html: `<div style='background:${color}; color:white; width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:${isHighlighted ? 3 : 2}px solid white; box-shadow:${isHighlighted ? '0 10px 22px rgba(15,23,42,0.42)' : '0 3px 8px rgba(15,23,42,0.35)'}; font-size:${size * 0.45}px; font-weight:700; transform:${isHighlighted ? 'scale(1.06)' : 'scale(1)'};'>${label}</div>`,
    className: 'custom-poi-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const poiGlyphs = {
  entrada:
    "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M3.8 3.8H12.2V20.2H3.8Z' stroke='white' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'/><path d='M20.2 12H9.2' stroke='white' stroke-width='1.9' stroke-linecap='round'/><path d='M15.3 7.2L20.1 12L15.3 16.8' stroke='white' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'/></svg>",
  banheiro:
    "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' xmlns='http://www.w3.org/2000/svg'><circle cx='8' cy='5.6' r='1.9' stroke='white' stroke-width='1.8'/><circle cx='16' cy='5.6' r='1.9' stroke='white' stroke-width='1.8'/><path d='M8 8.4V19.6M6 12H10M16 8.4V19.6M14 11.4H18' stroke='white' stroke-width='1.8' stroke-linecap='round'/></svg>",
  loja:
    "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M3 8.9L5.1 4H18.9L21 8.9' stroke='white' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'/><path d='M4.1 8.9V20H19.9V8.9' stroke='white' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'/><path d='M9 20V14.2H15V20' stroke='white' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'/></svg>",
};

const createPoiIcon = (
  type: PoiType,
  fromColor: string,
  toColor: string,
  size = 34,
  isHighlighted = false,
) =>
  new L.DivIcon({
    html: `<div style='position:relative; width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center; border-radius:999px; background:linear-gradient(145deg, ${fromColor}, ${toColor}); border:${isHighlighted ? 3 : 2}px solid rgba(255,255,255,0.95); box-shadow:${isHighlighted ? '0 12px 24px rgba(15,23,42,0.42)' : '0 5px 12px rgba(15,23,42,0.3)'}; transform:${isHighlighted ? 'scale(1.08)' : 'scale(1)'};'><div style='position:absolute; z-index:0; bottom:-5px; left:50%; width:${Math.max(10, Math.round(size * 0.34))}px; height:${Math.max(10, Math.round(size * 0.34))}px; background:${toColor}; transform:translateX(-50%) rotate(45deg); border-radius:0 0 4px 0; opacity:0.9;'></div><div style='position:relative; z-index:1; width:${Math.max(18, Math.round(size * 0.58))}px; height:${Math.max(18, Math.round(size * 0.58))}px; display:flex; align-items:center; justify-content:center; border-radius:999px; background:rgba(255,255,255,0.14);'>${poiGlyphs[type]}</div></div>`,
    className: 'custom-poi-icon',
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, Math.round(size * 0.88)],
    popupAnchor: [0, -Math.round(size * 0.68)],
  });

const poiIcons = {
  entrada: {
    normal: createPoiIcon('entrada', '#34d399', '#16a34a', 36),
    active: createPoiIcon('entrada', '#22c55e', '#15803d', 46, true),
  },
  banheiro: {
    normal: createPoiIcon('banheiro', '#38bdf8', '#0284c7', 36),
    active: createPoiIcon('banheiro', '#0ea5e9', '#0369a1', 46, true),
  },
  loja: {
    normal: createPoiIcon('loja', '#f59e0b', '#d97706', 36),
    active: createPoiIcon('loja', '#f97316', '#c2410c', 46, true),
  },
};

const stateIcons = {
  novo: createIcon('+', '#ef4444', 22),
  origem: createIcon('O', '#0ea5e9', 40, true),
  destino: createIcon('D', '#f43f5e', 40, true),
};

const MAP_WIDTH = 800;
const MAP_HEIGHT = 1280;
const MAP_NORTH = -7.943406;
const MAP_SOUTH = -7.947571;
const MAP_WEST = -36.228084;
const MAP_EAST = -36.22518;
const MAP_CENTER: [number, number] = [-7.9455693404289525, -36.226693372971];
const MAP_DEFAULT_ZOOM = 17.2;
const MAP_FOCUS_ZOOM = 17.9;
const MAP_MIN_ZOOM = 16.4;
const MAP_MAX_ZOOM = 20.5;
const mapBounds = new L.LatLngBounds([MAP_SOUTH, MAP_WEST], [MAP_NORTH, MAP_EAST]);
const MAP_VIEWPORT_BOUNDS = mapBounds.pad(2.8);
const AVERAGE_WALKING_SPEED_MPS = 1.35;
const WALKER_ANIMATION_MIN_MS = 8500;
const WALKER_ANIMATION_MAX_MS = 42000;
const WALKER_ANIMATION_TIME_SCALE = 12;

const imageToLatLng = (x: number, y: number): [number, number] => {
  const latSpan = MAP_NORTH - MAP_SOUTH;
  const lngSpan = MAP_EAST - MAP_WEST;
  const lat = MAP_NORTH - (y / MAP_HEIGHT) * latSpan;
  const lng = MAP_WEST + (x / MAP_WIDTH) * lngSpan;
  return [lat, lng];
};

const latLngToImage = (lat: number, lng: number): { x: number; y: number } => {
  const latSpan = MAP_NORTH - MAP_SOUTH;
  const lngSpan = MAP_EAST - MAP_WEST;
  const xRatio = (lng - MAP_WEST) / lngSpan;
  const yRatio = (MAP_NORTH - lat) / latSpan;
  return {
    x: Math.max(0, Math.min(MAP_WIDTH, xRatio * MAP_WIDTH)),
    y: Math.max(0, Math.min(MAP_HEIGHT, yRatio * MAP_HEIGHT)),
  };
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const getLatLngDistanceMeters = (from: [number, number], to: [number, number]) => {
  const earthRadius = 6371000;
  const [fromLat, fromLng] = from;
  const [toLat, toLng] = to;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const haversine = sinLat ** 2 + Math.cos(lat1) * Math.cos(lat2) * sinLng ** 2;
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadius * centralAngle;
};

const getPathDistanceMeters = (positions: [number, number][]) => {
  if (positions.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < positions.length; i += 1) {
    total += getLatLngDistanceMeters(positions[i - 1], positions[i]);
  }
  return total;
};

const formatDistanceLabel = (meters: number) => {
  if (!Number.isFinite(meters) || meters <= 0) return '0 m';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
  const rounded = Math.max(5, Math.round(meters / 5) * 5);
  return `${rounded} m`;
};

const formatWalkingTimeLabel = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0.45) return '< 1 min';
  const rounded = Math.max(1, Math.round(minutes));
  if (rounded >= 60) {
    const hours = Math.floor(rounded / 60);
    const restMinutes = rounded % 60;
    return restMinutes > 0 ? `${hours}h ${restMinutes}min` : `${hours}h`;
  }
  return `${rounded} min`;
};

const getPointAlongPath = (positions: [number, number][], progress: number): [number, number] => {
  if (positions.length === 0) return [MAP_CENTER[0], MAP_CENTER[1]];
  if (positions.length === 1) return positions[0];

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const segmentDistances: number[] = [];
  let totalDistance = 0;
  for (let i = 1; i < positions.length; i += 1) {
    const distance = getLatLngDistanceMeters(positions[i - 1], positions[i]);
    segmentDistances.push(distance);
    totalDistance += distance;
  }

  if (totalDistance <= 0) return positions[positions.length - 1];

  const targetDistance = totalDistance * clampedProgress;
  let coveredDistance = 0;

  for (let i = 1; i < positions.length; i += 1) {
    const segmentDistance = segmentDistances[i - 1];
    if (coveredDistance + segmentDistance >= targetDistance) {
      const ratio =
        segmentDistance > 0 ? (targetDistance - coveredDistance) / segmentDistance : 0;
      const [startLat, startLng] = positions[i - 1];
      const [endLat, endLng] = positions[i];
      return [startLat + (endLat - startLat) * ratio, startLng + (endLng - startLng) * ratio];
    }
    coveredDistance += segmentDistance;
  }

  return positions[positions.length - 1];
};
const MAX_DEFAULT_VISIBLE_PINS = 20;
const POI_ACCESS_STORAGE_KEY = 'gnocenter.poiAccessCount';
const TUTORIAL_STORAGE_KEY = 'gnocenter.mapTutorialSeen';
const MOBILE_MEDIA_QUERY = '(max-width: 900px)';
const STORE_OPENING_HOUR = 8;
const STORE_CLOSING_HOUR = 22;

const defaultPoiImages: Record<PoiType, string> = {
  entrada: '/images/pois/indicadores/entrada.svg',
  banheiro: '/images/pois/indicadores/banheiro.svg',
  loja: '/images/pois/indicadores/loja.svg',
};

const poiTypeLabels: Record<PoiType, string> = {
  loja: 'Lojas',
  banheiro: 'Banheiros',
  entrada: 'Entradas',
};

const storeProductImageUrls: Record<string, string[]> = {
  loja_jeans: [
    '/images/pois/lojas/Itens/Cal%C3%A7amassa.avif',
    '/images/pois/lojas/Itens/Cal%C3%A7amassafeminina.avif',
    '/images/pois/lojas/Itens/Cal%C3%A7asmassas2.avif',
  ],
  loja_kids: [
    '/images/pois/lojas/Itens/Roupainfantil.avif',
    '/images/pois/lojas/Itens/Roupainfantil2.avif',
    '/images/pois/lojas/Itens/Conjuntoinfantil3.avif',
  ],
  loja_praia: [
    '/images/pois/lojas/Itens/boladepraia.avif',
    '/images/pois/lojas/Itens/Cosmeticodepraia.avif',
    '/images/pois/lojas/Itens/protetorsolar.avif',
  ],
  loja_plus: [
    '/images/pois/lojas/Itens/Conjuntoelegante.avif',
    '/images/pois/lojas/Itens/Roupaelegante.avif',
    '/images/pois/lojas/Itens/Casacoelegante.avif',
  ],
  loja_calcados: [
    '/images/pois/lojas/Itens/sapato.avif',
    '/images/pois/lojas/Itens/sapatocaro.avif',
    '/images/pois/lojas/Itens/sapatofit.avif',
  ],
};

const storeGalleryUrls: Record<string, string[]> = {
  loja_jeans: ['/images/pois/lojas/LOJADEJEANS.jpg'],
  loja_kids: ['/images/pois/lojas/LOJADEKIDS.jpg'],
  loja_praia: ['/images/pois/lojas/LOJAMODAPRAIA.jpg'],
  loja_plus: ['/images/pois/lojas/LOJAPLUSSIZE.jpg'],
  loja_calcados: ['/images/pois/lojas/LOJADECA%C3%87ADOSFEM.jpg'],
};

const tutorialSteps = [
  {
    title: 'Bem-vindo ao mapa',
    text: 'Use os botoes Pins e Rota para abrir apenas o painel que voce precisa. A tela fica mais limpa e rapida.',
  },
  {
    title: 'Encontre locais rapido',
    text: 'No painel Pins, pesquise por lojas e pontos. Clique em Ver para abrir detalhes e focar no mapa.',
  },
  {
    title: 'Digite para tracar rota',
    text: 'No painel Rota, digite origem e destino. As sugestoes aparecem enquanto voce escreve: ex. E -> Entrada.',
  },
  {
    title: 'Pronto para usar',
    text: 'Toque em um pin para abrir o card completo e use Obter direcoes para navegar entre os pontos.',
  },
] as const;

const rawInitialPois: PointData[] = [
  {
    id: 'entrada_norte',
    nome: 'Entrada Norte',
    tipo: 'entrada',
    x: 390,
    y: 90,
    descricao: 'Acesso norte do centro de compras.',
    imagemUrl: '/images/pois/indicadores/ENTRADANORTE.jpg',
  },
  {
    id: 'entrada_sul',
    nome: 'Entrada Sul',
    tipo: 'entrada',
    x: 390,
    y: 1200,
    descricao: 'Acesso principal na parte sul.',
    imagemUrl: '/images/pois/indicadores/ENTRADASUL.jpg',
  },
  {
    id: 'entrada_leste',
    nome: 'Entrada Leste',
    tipo: 'entrada',
    x: 705,
    y: 630,
    descricao: 'Acesso lateral leste.',
    imagemUrl: '/images/pois/indicadores/ENTRADALESTE.jpg',
  },
  {
    id: 'banheiro_norte',
    nome: 'Banheiro Norte',
    tipo: 'banheiro',
    x: 230,
    y: 260,
    descricao: 'Banheiro proximo ao corredor norte.',
    imagemUrl: '/images/pois/indicadores/BANHEIRO.JPG',
  },
  {
    id: 'banheiro_oeste',
    nome: 'Banheiro Oeste',
    tipo: 'banheiro',
    x: 140,
    y: 620,
    descricao: 'Banheiro ao lado da ala oeste.',
    imagemUrl: '/images/pois/indicadores/BANHEIRO.JPG',
  },
  {
    id: 'banheiro_leste',
    nome: 'Banheiro Leste',
    tipo: 'banheiro',
    x: 650,
    y: 610,
    descricao: 'Banheiro proximo ao corredor leste.',
    imagemUrl: '/images/pois/indicadores/BANHEIRO.JPG',
  },
  {
    id: 'banheiro_sul',
    nome: 'Banheiro Sul',
    tipo: 'banheiro',
    x: 380,
    y: 980,
    descricao: 'Banheiro na area central sul.',
    imagemUrl: '/images/pois/indicadores/BANHEIRO.JPG',
  },
  {
    id: 'loja_jeans',
    nome: 'Loja de Jeans',
    tipo: 'loja',
    x: 150,
    y: 300,
    descricao: 'Jeans premium e basicos para revenda.',
    imagemUrl: storeGalleryUrls.loja_jeans[0],
    contato: '(81) 99911-0001',
    produtos: [
      { nome: 'Calca jeans skinny', preco: 'R$ 49,90', imagemUrl: storeProductImageUrls.loja_jeans[0] },
      { nome: 'Calca wide leg', preco: 'R$ 62,90', imagemUrl: storeProductImageUrls.loja_jeans[1] },
      { nome: 'Calca premium', preco: 'R$ 79,90', imagemUrl: storeProductImageUrls.loja_jeans[2] },
    ],
  },
  {
    id: 'loja_kids',
    nome: 'Loja Kids',
    tipo: 'loja',
    x: 305,
    y: 470,
    descricao: 'Moda infantil em atacado com foco em conforto.',
    imagemUrl: storeGalleryUrls.loja_kids[0],
    contato: '(81) 99911-0002',
    produtos: [
      { nome: 'Conjunto infantil', preco: 'R$ 34,90', imagemUrl: storeProductImageUrls.loja_kids[0] },
      { nome: 'Vestido kids', preco: 'R$ 42,00', imagemUrl: storeProductImageUrls.loja_kids[1] },
      { nome: 'Conjunto festa', preco: 'R$ 58,90', imagemUrl: storeProductImageUrls.loja_kids[2] },
    ],
  },
  {
    id: 'loja_praia',
    nome: 'Loja Moda Praia',
    tipo: 'loja',
    x: 560,
    y: 300,
    descricao: 'Linha praia completa e resort wear.',
    imagemUrl: storeGalleryUrls.loja_praia[0],
    contato: '(81) 99911-0003',
    produtos: [
      { nome: 'Kit bola de praia', preco: 'R$ 29,90', imagemUrl: storeProductImageUrls.loja_praia[0] },
      { nome: 'Kit praia premium', preco: 'R$ 59,90', imagemUrl: storeProductImageUrls.loja_praia[1] },
      { nome: 'Protetor solar', preco: 'R$ 35,00', imagemUrl: storeProductImageUrls.loja_praia[2] },
    ],
  },
  {
    id: 'loja_plus',
    nome: 'Loja Plus Size',
    tipo: 'loja',
    x: 255,
    y: 900,
    descricao: 'Moda plus size feminina com pecas atuais.',
    imagemUrl: storeGalleryUrls.loja_plus[0],
    contato: '(81) 99911-0004',
    produtos: [
      { nome: 'Conjunto elegante', preco: 'R$ 89,00', imagemUrl: storeProductImageUrls.loja_plus[0] },
      { nome: 'Look casual plus', preco: 'R$ 67,00', imagemUrl: storeProductImageUrls.loja_plus[1] },
      { nome: 'Casaco sofisticado', preco: 'R$ 99,00', imagemUrl: storeProductImageUrls.loja_plus[2] },
    ],
  },
  {
    id: 'loja_calcados',
    nome: 'Loja de Calcados Femininos',
    tipo: 'loja',
    x: 565,
    y: 900,
    descricao: 'Calcados femininos com tendencia e conforto.',
    imagemUrl: storeGalleryUrls.loja_calcados[0],
    contato: '(81) 99911-0005',
    produtos: [
      { nome: 'Tenis casual', preco: 'R$ 95,00', imagemUrl: storeProductImageUrls.loja_calcados[0] },
      { nome: 'Sandalia premium', preco: 'R$ 78,00', imagemUrl: storeProductImageUrls.loja_calcados[1] },
      { nome: 'Sapatilha confort', preco: 'R$ 109,00', imagemUrl: storeProductImageUrls.loja_calcados[2] },
    ],
  },
];

const attachNearestNode = (poi: PointData): PointData => {
  const nearestNode = findNearestNode(poi.x, poi.y, 120);
  return { ...poi, nodeId: nearestNode ?? undefined };
};

const productsToText = (produtos?: StoreProduct[]) => {
  if (!produtos || produtos.length === 0) return '';
  return produtos
    .map((item) => [item.nome, item.preco, item.imagemUrl?.trim()].filter(Boolean).join(' | '))
    .join('\n');
};

const textToProducts = (text: string): StoreProduct[] => {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [nome, preco, imagemUrl] = line.split('|').map((part) => part.trim());
      return {
        nome: nome || 'Produto',
        preco: preco || 'Sob consulta',
        imagemUrl: imagemUrl || undefined,
      };
    });
};

const normalizeContact = (value?: string) => value?.trim() ?? '';
const toWhatsappLink = (contact?: string) => {
  const digits = (contact ?? '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
};
const normalizeForSearch = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const loadPoiAccessCount = (): PoiAccessCount => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(POI_ACCESS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PoiAccessCount;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
};

const persistPoiAccessCount = (value: PoiAccessCount) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(POI_ACCESS_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignora erro de storage para nao quebrar a UX.
  }
};

const getStoreStatus = () => {
  const hour = new Date().getHours();
  const isOpen = hour >= STORE_OPENING_HOUR && hour < STORE_CLOSING_HOUR;
  return {
    label: isOpen ? 'ABERTO' : 'FECHADO',
    color: isOpen ? '#16a34a' : '#dc2626',
    closeText: `Fecha ${STORE_CLOSING_HOUR}:00`,
  };
};

const getPoiGalleryImages = (poi: PointData) => {
  const fallback = [poi.imagemUrl || defaultPoiImages[poi.tipo]].filter(Boolean) as string[];
  if (poi.tipo !== 'loja') return fallback;

  const gallery = storeGalleryUrls[poi.id] ?? [];
  const combined = [poi.imagemUrl, ...gallery].filter(Boolean) as string[];
  return Array.from(new Set(combined));
};

const getProductPreviewImage = (poi: PointData, product: StoreProduct, index: number) => {
  const directImage = product.imagemUrl?.trim();
  if (directImage) return directImage;

  const storeImagePool = storeProductImageUrls[poi.id] ?? [];
  if (storeImagePool[index]) return storeImagePool[index];

  const usedByProducts = new Set(
    (poi.produtos ?? []).map((item) => item.imagemUrl?.trim()).filter(Boolean) as string[],
  );
  const firstUnusedStoreImage = storeImagePool.find((url) => !usedByProducts.has(url));
  if (firstUnusedStoreImage) return firstUnusedStoreImage;

  const gallery = getPoiGalleryImages(poi);
  if (gallery[index] && !usedByProducts.has(gallery[index])) return gallery[index];
  const firstUnusedGalleryImage = gallery.find((url) => !usedByProducts.has(url));
  if (firstUnusedGalleryImage) return firstUnusedGalleryImage;
  if (gallery[0]) return gallery[0];

  return defaultPoiImages.loja;
};

const getStorePreviewProducts = (poi: PointData, maxItems = 3): StoreProduct[] => {
  if (poi.tipo !== 'loja') return [];

  const products = poi.produtos ?? [];
  const uniqueProducts: StoreProduct[] = [];
  const usedPreviewImages = new Set<string>();

  products.forEach((product, index) => {
    if (uniqueProducts.length >= maxItems) return;

    const previewImage = getProductPreviewImage(poi, product, index);
    const imageKey = previewImage?.trim() || `${product.nome}-${product.preco}-${index}`;
    if (usedPreviewImages.has(imageKey)) return;

    usedPreviewImages.add(imageKey);
    uniqueProducts.push({
      ...product,
      imagemUrl: previewImage || product.imagemUrl,
    });
  });

  return uniqueProducts;
};

const MapController = ({
  focusPoint,
  isMobile,
}: {
  focusPoint: PointData | null;
  isMobile: boolean;
}) => {
  const map = useMap();

  useEffect(() => {
    if (focusPoint) {
      map.stop();
      map.flyTo(imageToLatLng(focusPoint.x, focusPoint.y), MAP_FOCUS_ZOOM, {
        duration: isMobile ? 0.55 : 1.05,
        easeLinearity: 0.25,
      });
    }
  }, [focusPoint, map, isMobile]);

  return null;
};

const ModaCenterMap = () => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MEDIA_QUERY).matches : false,
  );
  const [isPinsPanelOpen, setIsPinsPanelOpen] = useState(() =>
    typeof window !== 'undefined' ? !window.matchMedia(MOBILE_MEDIA_QUERY).matches : true,
  );
  const [isRoutePanelOpen, setIsRoutePanelOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pois, setPois] = useState<PointData[]>(() => rawInitialPois.map(attachNearestNode));
  const [rota, setRota] = useState<number[][] | null>(null);
  const [editingPoi, setEditingPoi] = useState<EditingPoi | null>(null);
  const [focusPoint, setFocusPoint] = useState<PointData | null>(null);
  const [activePoiId, setActivePoiId] = useState<string | null>(null);
  const [poiAccessCount, setPoiAccessCount] = useState<PoiAccessCount>(loadPoiAccessCount);
  const [searchTerm, setSearchTerm] = useState('');
  const [enabledTypes, setEnabledTypes] = useState<Record<PoiType, boolean>>({
    loja: true,
    banheiro: true,
    entrada: true,
  });
  const [manualVisiblePoiIds, setManualVisiblePoiIds] = useState<string[]>([]);
  const [selectedOriginId, setSelectedOriginId] = useState('');
  const [selectedDestinationId, setSelectedDestinationId] = useState('');
  const [originQuery, setOriginQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(TUTORIAL_STORAGE_KEY) !== '1';
  });
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const [routeMessage, setRouteMessage] = useState('Marque seu local atual e escolha para onde quer ir.');
  const [walkerProgress, setWalkerProgress] = useState(0);
  const [walkerPosition, setWalkerPosition] = useState<[number, number] | null>(null);
  const walkerTimerRef = useRef<number | null>(null);
  const [mobileSheetHeight, setMobileSheetHeight] = useState(0);
  const [isMobileSheetDragging, setIsMobileSheetDragging] = useState(false);
  const mobileSheetHeightRef = useRef(0);
  const sheetDragStartYRef = useRef<number | null>(null);
  const sheetDragStartHeightRef = useRef(0);

  const activePoi = useMemo(
    () => (activePoiId ? pois.find((poi) => poi.id === activePoiId) ?? null : null),
    [activePoiId, pois],
  );

  const walkerIcon = useMemo(
    () =>
      new L.DivIcon({
        className: 'gps-walker-wrapper',
        html: `<div class='gps-walker-icon'><span class='gps-walker-pulse'></span><span class='gps-walker-core'><svg viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'><circle cx='12' cy='4.6' r='2.2' fill='white'/><path d='M12 7.6L10.3 12.2L6.6 15.6M12 7.6L14.6 11.8L17.8 10.4M10.8 12.4L13.2 16.4L11 20.2M13.1 16.4L16.6 20.2' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg></span></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      }),
    [],
  );

  const routeLatLngPoints = useMemo<[number, number][]>(
    () => (rota ? rota.map(([y, x]) => imageToLatLng(x, y)) : []),
    [rota],
  );

  const routeDistanceMeters = useMemo(() => getPathDistanceMeters(routeLatLngPoints), [routeLatLngPoints]);
  const routeEtaMinutes = routeDistanceMeters / (AVERAGE_WALKING_SPEED_MPS * 60);
  const routeRemainingEtaLabel =
    walkerProgress >= 0.995
      ? 'chegando'
      : formatWalkingTimeLabel(routeEtaMinutes * Math.max(0, 1 - walkerProgress));

  const getMobileSheetBounds = () => {
    const viewportHeight =
      typeof window !== 'undefined' ? Math.round(window.visualViewport?.height ?? window.innerHeight) : 780;
    const minHeight = Math.max(164, Math.round(viewportHeight * 0.24));
    const maxHeight = Math.max(minHeight + 90, Math.round(viewportHeight * 0.7));
    const defaultHeight = Math.max(minHeight, Math.min(maxHeight, Math.round(viewportHeight * 0.32)));
    return { minHeight, maxHeight, defaultHeight };
  };

  const clampMobileSheetHeight = (value: number) => {
    const bounds = getMobileSheetBounds();
    return Math.max(bounds.minHeight, Math.min(bounds.maxHeight, value));
  };

  const handleMobileSheetPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isMobile) return;
    event.preventDefault();

    const bounds = getMobileSheetBounds();
    const currentHeight = clampMobileSheetHeight(mobileSheetHeightRef.current || bounds.defaultHeight);
    sheetDragStartYRef.current = event.clientY;
    sheetDragStartHeightRef.current = currentHeight;
    setMobileSheetHeight(currentHeight);
    setIsMobileSheetDragging(true);
  };

  const orderedByAccessPois = useMemo(() => {
    return [...pois].sort((a, b) => {
      const accessDiff = (poiAccessCount[b.id] ?? 0) - (poiAccessCount[a.id] ?? 0);
      if (accessDiff !== 0) return accessDiff;
      return a.nome.localeCompare(b.nome);
    });
  }, [pois, poiAccessCount]);

  const searchablePois = useMemo(() => {
    const query = normalizeForSearch(searchTerm.trim());
    return orderedByAccessPois.filter((poi) => {
      if (!enabledTypes[poi.tipo]) return false;
      if (!query) return true;
      return (
        normalizeForSearch(poi.nome).includes(query) ||
        normalizeForSearch(poi.descricao ?? '').includes(query) ||
        normalizeForSearch(poi.tipo).includes(query)
      );
    });
  }, [orderedByAccessPois, searchTerm, enabledTypes]);

  const routeSuggestionPois = useMemo(
    () => [...orderedByAccessPois].sort((a, b) => a.nome.localeCompare(b.nome)),
    [orderedByAccessPois],
  );

  const getRouteSuggestions = (rawQuery: string) => {
    const query = normalizeForSearch(rawQuery.trim());
    const baseList = query
      ? routeSuggestionPois.filter((poi) => {
          const normalizedName = normalizeForSearch(poi.nome);
          const normalizedType = normalizeForSearch(poi.tipo);
          return normalizedName.includes(query) || normalizedType.includes(query);
        })
      : routeSuggestionPois;

    return [...baseList]
      .sort((a, b) => {
        if (!query) return a.nome.localeCompare(b.nome);

        const aName = normalizeForSearch(a.nome);
        const bName = normalizeForSearch(b.nome);
        const aType = normalizeForSearch(a.tipo);
        const bType = normalizeForSearch(b.tipo);

        const aStarts = Number(aName.startsWith(query));
        const bStarts = Number(bName.startsWith(query));
        if (aStarts !== bStarts) return bStarts - aStarts;

        const aTypeStarts = Number(aType.startsWith(query));
        const bTypeStarts = Number(bType.startsWith(query));
        if (aTypeStarts !== bTypeStarts) return bTypeStarts - aTypeStarts;

        return a.nome.localeCompare(b.nome);
      })
      .slice(0, 8);
  };

  const originSuggestions = useMemo(() => {
    return getRouteSuggestions(originQuery);
  }, [originQuery, routeSuggestionPois]);

  const destinationSuggestions = useMemo(() => {
    return getRouteSuggestions(destinationQuery);
  }, [destinationQuery, routeSuggestionPois]);

  const autoVisiblePois = useMemo(() => {
    return orderedByAccessPois.filter((poi) => enabledTypes[poi.tipo]).slice(0, MAX_DEFAULT_VISIBLE_PINS);
  }, [orderedByAccessPois, enabledTypes]);

  const visiblePois = useMemo(() => {
    if (isAdmin) return pois;

    const manualSelectionSet = new Set(manualVisiblePoiIds);
    const basePois =
      manualVisiblePoiIds.length > 0
        ? pois.filter((poi) => manualSelectionSet.has(poi.id) && enabledTypes[poi.tipo])
        : autoVisiblePois;

    const resultById = new Map(basePois.map((poi) => [poi.id, poi]));
    [activePoiId, selectedOriginId, selectedDestinationId].forEach((id) => {
      if (!id) return;
      const poi = pois.find((item) => item.id === id);
      if (poi) resultById.set(poi.id, poi);
    });

    return Array.from(resultById.values());
  }, [
    isAdmin,
    pois,
    manualVisiblePoiIds,
    enabledTypes,
    autoVisiblePois,
    activePoiId,
    selectedOriginId,
    selectedDestinationId,
  ]);

  const getPoiById = (id: string) => pois.find((poi) => poi.id === id);

  const clearRoute = () => {
    setSelectedOriginId('');
    setSelectedDestinationId('');
    setOriginQuery('');
    setDestinationQuery('');
    setShowOriginSuggestions(false);
    setShowDestinationSuggestions(false);
    setRota(null);
    setRouteMessage('Rota limpa. Marque seu local atual e escolha o destino.');
  };

  const selectOriginPoi = (poi: PointData) => {
    setSelectedOriginId(poi.id);
    setOriginQuery(poi.nome);
    setShowOriginSuggestions(false);
  };

  const selectDestinationPoi = (poi: PointData) => {
    setSelectedDestinationId(poi.id);
    setDestinationQuery(poi.nome);
    setShowDestinationSuggestions(false);
  };

  const closeTutorial = () => {
    setIsTutorialOpen(false);
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, '1');
  };

  const registerPoiAccess = (poiId: string) => {
    setPoiAccessCount((prev) => ({
      ...prev,
      [poiId]: (prev[poiId] ?? 0) + 1,
    }));
  };

  const focusPoi = (poi: PointData, registerAccess = true) => {
    if (registerAccess) registerPoiAccess(poi.id);
    if (isMobile) setIsPinsPanelOpen(false);
    setActivePoiId(poi.id);
    setFocusPoint(poi);
  };

  const buildRoute = (originId: string, destinationId: string) => {
    const origem = getPoiById(originId);
    const destino = getPoiById(destinationId);

    if (!origem || !destino) {
      setRota(null);
      setRouteMessage('Selecione local atual e destino validos.');
      return;
    }

    if (origem.id === destino.id) {
      setRota(null);
      setRouteMessage('Local atual e destino precisam ser diferentes.');
      return;
    }

    if (!origem.nodeId || !destino.nodeId) {
      setRota(null);
      setRouteMessage('Um dos pontos nao esta conectado ao grafo de rotas.');
      return;
    }

    const caminho = findPath(origem.nodeId, destino.nodeId);
    if (!caminho) {
      setRota(null);
      setRouteMessage(`Sem rota entre ${origem.nome} e ${destino.nome}.`);
      return;
    }

    const caminhoLatLng = caminho.map(([y, x]) => imageToLatLng(x, y));
    const distanceMeters = getPathDistanceMeters(caminhoLatLng);
    const etaMinutes = distanceMeters / (AVERAGE_WALKING_SPEED_MPS * 60);
    const distanceLabel = formatDistanceLabel(distanceMeters);
    const etaLabel = formatWalkingTimeLabel(etaMinutes);

    setRota(caminho);
    setRouteMessage(
      `Rota ativa: ${origem.nome} -> ${destino.nome}. Distancia aprox.: ${distanceLabel} | Tempo medio a pe: ${etaLabel}.`,
    );
  };

  const markPoiAsCurrentLocation = (poi: PointData) => {
    if (!poi.nodeId) {
      setRouteMessage(`"${poi.nome}" nao esta ligado ao grafo de rotas.`);
      return;
    }

    selectOriginPoi(poi);

    if (!selectedDestinationId) {
      setRota(null);
      setRouteMessage(`Local atual marcado: ${poi.nome}. Agora toque em "Ir para o local".`);
      return;
    }

    if (selectedDestinationId === poi.id) {
      setRota(null);
      setRouteMessage(`Voce ja esta em ${poi.nome}. Escolha outro destino.`);
      return;
    }

    buildRoute(poi.id, selectedDestinationId);
  };

  const navigateToPoi = (poi: PointData) => {
    if (!poi.nodeId) {
      setRouteMessage(`"${poi.nome}" nao esta ligado ao grafo de rotas.`);
      return;
    }

    selectDestinationPoi(poi);

    if (!selectedOriginId) {
      setRota(null);
      setRouteMessage(`Destino definido: ${poi.nome}. Primeiro marque seu local atual.`);
      return;
    }

    if (selectedOriginId === poi.id) {
      setRota(null);
      setRouteMessage(`Voce ja esta em ${poi.nome}.`);
      return;
    }

    buildRoute(selectedOriginId, poi.id);
  };

  const handleDirectionsFromActivePoi = () => {
    if (!activePoi) {
      setRouteMessage('Selecione um ponto antes de pedir direcoes.');
      return;
    }

    navigateToPoi(activePoi);
  };

  const setActivePoiAsOrigin = () => {
    if (!activePoi) return;
    markPoiAsCurrentLocation(activePoi);
  };

  const setActivePoiAsDestination = () => {
    if (!activePoi) return;
    navigateToPoi(activePoi);
  };

  const handleMarkerSelection = (poi: PointData) => {
    if (isAdmin) {
      setEditingPoi({ ...poi, produtosText: productsToText(poi.produtos) });
      setFocusPoint(poi);
      return;
    }

    focusPoi(poi, true);

    if (!poi.nodeId) {
      setRouteMessage(`"${poi.nome}" nao esta ligado ao grafo de rotas.`);
      return;
    }

    if (selectedOriginId && selectedOriginId !== poi.id && !selectedDestinationId) {
      selectDestinationPoi(poi);
      buildRoute(selectedOriginId, poi.id);
    }
  };

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        if (!isAdmin) {
          setActivePoiId(null);
          return;
        }

        const mapped = latLngToImage(e.latlng.lat, e.latlng.lng);
        const x = Math.round(mapped.x);
        const y = Math.round(mapped.y);

        setEditingPoi({
          nome: '',
          tipo: 'loja',
          x,
          y,
          descricao: '',
          imagemUrl: defaultPoiImages.loja,
          contato: '',
          produtosText: '',
        });
      },
    });

    return null;
  };

  const salvarPonto = () => {
    if (!editingPoi || !editingPoi.nome || !editingPoi.tipo) {
      alert('Informe nome e tipo do ponto.');
      return;
    }

    if (typeof editingPoi.x !== 'number' || typeof editingPoi.y !== 'number') {
      alert('Coordenadas invalidas para o ponto.');
      return;
    }

    const nearestNode = findNearestNode(editingPoi.x, editingPoi.y, 120);
    if (!nearestNode) {
      alert('Este ponto esta longe dos corredores de rota. Marque mais perto de um caminho.');
      return;
    }

    const baseId = editingPoi.nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const parsedProducts =
      editingPoi.tipo === 'loja' ? textToProducts(editingPoi.produtosText ?? '') : undefined;

    const novoPonto: PointData = {
      id: editingPoi.id || `${baseId || 'ponto'}_${Date.now()}`,
      x: editingPoi.x,
      y: editingPoi.y,
      nome: editingPoi.nome.trim(),
      tipo: editingPoi.tipo,
      descricao: editingPoi.descricao?.trim() || undefined,
      imagemUrl: editingPoi.imagemUrl?.trim() || defaultPoiImages[editingPoi.tipo],
      contato: editingPoi.tipo === 'loja' ? normalizeContact(editingPoi.contato) : undefined,
      produtos: editingPoi.tipo === 'loja' ? parsedProducts : undefined,
      nodeId: nearestNode,
    };

    setPois((prev) => {
      const index = prev.findIndex((item) => item.id === novoPonto.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = novoPonto;
        return updated;
      }
      return [...prev, novoPonto];
    });

    setEditingPoi(null);
  };

  const deletarPonto = (id: string) => {
    if (!window.confirm('Apagar este ponto permanentemente?')) return;

    setPois((prev) => prev.filter((poi) => poi.id !== id));
    setPoiAccessCount((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setManualVisiblePoiIds((prev) => prev.filter((poiId) => poiId !== id));
    if (activePoiId === id) setActivePoiId(null);
    if (selectedOriginId === id || selectedDestinationId === id) {
      clearRoute();
    }
    setEditingPoi(null);
  };

  const toggleType = (type: PoiType) => {
    setEnabledTypes((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const toggleManualVisibility = (poiId: string) => {
    setManualVisiblePoiIds((prev) =>
      prev.includes(poiId) ? prev.filter((id) => id !== poiId) : [...prev, poiId],
    );
  };

  const baixarJson = () => {
    const payload = JSON.stringify(pois, null, 2);
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(payload)}`;
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', 'locais_modacenter.json');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleManualRoute = () => {
    if (!selectedOriginId || !selectedDestinationId) {
      setRouteMessage('Defina local atual e destino antes de tracar a rota.');
      return;
    }

    buildRoute(selectedOriginId, selectedDestinationId);
  };

  useEffect(() => {
    if (walkerTimerRef.current !== null) {
      window.clearInterval(walkerTimerRef.current);
      walkerTimerRef.current = null;
    }

    if (routeLatLngPoints.length === 0) {
      setWalkerPosition(null);
      setWalkerProgress(0);
      return;
    }

    if (routeLatLngPoints.length === 1) {
      setWalkerPosition(routeLatLngPoints[0]);
      setWalkerProgress(1);
      return;
    }

    setWalkerPosition(routeLatLngPoints[0]);
    setWalkerProgress(0);

    const realWalkingDurationMs = (routeDistanceMeters / AVERAGE_WALKING_SPEED_MPS) * 1000;
    const animationDurationMs = Math.min(
      WALKER_ANIMATION_MAX_MS,
      Math.max(WALKER_ANIMATION_MIN_MS, realWalkingDurationMs / WALKER_ANIMATION_TIME_SCALE),
    );
    const tickMs = isMobile ? 90 : 55;
    const animationStart = performance.now();

    const tickWalker = () => {
      const elapsed = performance.now() - animationStart;
      const progress = Math.min(1, elapsed / animationDurationMs);
      setWalkerProgress(progress);
      setWalkerPosition(getPointAlongPath(routeLatLngPoints, progress));

      if (progress >= 1 && walkerTimerRef.current !== null) {
        window.clearInterval(walkerTimerRef.current);
        walkerTimerRef.current = null;
      }
    };

    tickWalker();
    walkerTimerRef.current = window.setInterval(tickWalker, tickMs);

    return () => {
      if (walkerTimerRef.current !== null) {
        window.clearInterval(walkerTimerRef.current);
        walkerTimerRef.current = null;
      }
    };
  }, [routeLatLngPoints, routeDistanceMeters, isMobile]);

  useEffect(() => {
    mobileSheetHeightRef.current = mobileSheetHeight;
  }, [mobileSheetHeight]);

  useEffect(() => {
    if (!isMobile || !activePoi) {
      setMobileSheetHeight(0);
      return;
    }
    const { defaultHeight } = getMobileSheetBounds();
    setMobileSheetHeight(defaultHeight);
  }, [isMobile, activePoiId]);

  useEffect(() => {
    if (!isMobile || !activePoi || typeof window === 'undefined') return;

    const syncMobileSheetSize = () => {
      const { defaultHeight } = getMobileSheetBounds();
      const currentHeight = mobileSheetHeightRef.current || defaultHeight;
      setMobileSheetHeight(clampMobileSheetHeight(currentHeight));
    };

    syncMobileSheetSize();
    window.addEventListener('resize', syncMobileSheetSize);
    window.visualViewport?.addEventListener('resize', syncMobileSheetSize);
    return () => {
      window.removeEventListener('resize', syncMobileSheetSize);
      window.visualViewport?.removeEventListener('resize', syncMobileSheetSize);
    };
  }, [isMobile, activePoiId]);

  useEffect(() => {
    if (!isMobileSheetDragging || typeof window === 'undefined') return;

    const previousTouchAction = document.body.style.touchAction;
    document.body.style.touchAction = 'none';

    const onPointerMove = (event: PointerEvent) => {
      if (sheetDragStartYRef.current === null) return;
      event.preventDefault();
      const deltaY = sheetDragStartYRef.current - event.clientY;
      const nextHeight = sheetDragStartHeightRef.current + deltaY;
      setMobileSheetHeight(clampMobileSheetHeight(nextHeight));
    };

    const finishDrag = () => {
      sheetDragStartYRef.current = null;
      setIsMobileSheetDragging(false);
      const { minHeight, maxHeight } = getMobileSheetBounds();
      const middle = (minHeight + maxHeight) / 2;
      setMobileSheetHeight((prev) => (prev > middle ? maxHeight : Math.max(minHeight, prev)));
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    return () => {
      document.body.style.touchAction = previousTouchAction;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [isMobileSheetDragging]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const handleMediaChange = () => setIsMobile(mediaQuery.matches);

    handleMediaChange();
    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setIsPinsPanelOpen(false);
      setIsRoutePanelOpen(false);
      return;
    }

    setIsPinsPanelOpen(true);
  }, [isMobile]);

  useEffect(() => {
    if (!selectedOriginId) return;
    const origin = pois.find((poi) => poi.id === selectedOriginId);
    if (origin) setOriginQuery(origin.nome);
  }, [selectedOriginId, pois]);

  useEffect(() => {
    if (!selectedDestinationId) return;
    const destination = pois.find((poi) => poi.id === selectedDestinationId);
    if (destination) setDestinationQuery(destination.nome);
  }, [selectedDestinationId, pois]);

  useEffect(() => {
    persistPoiAccessCount(poiAccessCount);
  }, [poiAccessCount]);

  useEffect(() => {
    setManualVisiblePoiIds((prev) => prev.filter((id) => pois.some((poi) => poi.id === id)));
  }, [pois]);

  useEffect(() => {
    if (activePoiId && !pois.some((poi) => poi.id === activePoiId)) {
      setActivePoiId(null);
    }
  }, [activePoiId, pois]);

  const getMarkerIcon = (poi: PointData, isActive: boolean) => {
    if (!isAdmin) {
      if (poi.id === selectedOriginId) return stateIcons.origem;
      if (poi.id === selectedDestinationId) return stateIcons.destino;
      if (isActive) return poiIcons[poi.tipo].active;
    }
    return poiIcons[poi.tipo].normal;
  };

  const storeStatus = getStoreStatus();
  const activeWhatsappLink = activePoi ? toWhatsappLink(activePoi.contato) : null;
  const activeGalleryImages = activePoi ? getPoiGalleryImages(activePoi) : [];
  const activePreviewProducts = activePoi ? getStorePreviewProducts(activePoi, 3) : [];
  const activePanelGalleryImages = isMobile ? activeGalleryImages.slice(0, 1) : activeGalleryImages.slice(0, 2);
  const activePanelPreviewProducts = isMobile ? activePreviewProducts.slice(0, 2) : activePreviewProducts;
  const currentTutorialStep = tutorialSteps[tutorialStepIndex];
  const mobileSheetBounds = isMobile ? getMobileSheetBounds() : null;
  const resolvedMobileSheetHeight =
    isMobile && mobileSheetBounds
      ? clampMobileSheetHeight(mobileSheetHeight || mobileSheetBounds.defaultHeight)
      : 0;

  return (
    <div
      style={{
        width: '100vw',
        height: '100dvh',
        minHeight: '100vh',
        display: 'flex',
        overflow: 'hidden',
        background: '#eceff1',
      }}
    >
      <div
        style={{
          width: isAdmin ? '340px' : '0px',
          transition: 'width 0.3s ease',
          background: 'white',
          borderRight: '1px solid #dce1e6',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '2px 0 10px rgba(0,0,0,0.08)',
          zIndex: 1200,
        }}
      >
        {isAdmin && (
          <>
            <div style={{ padding: '18px', background: '#1f2d3d', color: 'white' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>Painel Admin</h2>
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', opacity: 0.8 }}>
                {pois.length} pontos cadastrados
              </p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
              {pois.map((poi) => (
                <button
                  key={poi.id}
                  onClick={() => {
                    setEditingPoi({ ...poi, produtosText: productsToText(poi.produtos) });
                    setFocusPoint(poi);
                  }}
                  style={{
                    width: '100%',
                    border: '1px solid #edf1f4',
                    borderRadius: '8px',
                    background: editingPoi?.id === poi.id ? '#eef6ff' : 'white',
                    marginBottom: '8px',
                    textAlign: 'left',
                    padding: '10px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{poi.nome}</div>
                  <div style={{ fontSize: '11px', color: '#5f6c7a', marginTop: '2px' }}>
                    {poi.tipo.toUpperCase()} {poi.nodeId ? '| conectado' : '| sem rota'}
                  </div>
                </button>
              ))}
            </div>

            <div
              style={{
                padding: '14px',
                borderTop: '1px solid #dce1e6',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <button
                onClick={baixarJson}
                style={{
                  background: '#27ae60',
                  color: 'white',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                Baixar JSON
              </button>
              <button
                onClick={() => {
                  setIsAdmin(false);
                  setEditingPoi(null);
                }}
                style={{
                  background: '#c0392b',
                  color: 'white',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Sair do modo admin
              </button>
            </div>
          </>
        )}
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        {isAdmin && editingPoi && (
          <div
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              width: '330px',
              maxHeight: '86vh',
              overflowY: 'auto',
              background: 'white',
              padding: '18px',
              borderRadius: '12px',
              boxShadow: '0 8px 26px rgba(0,0,0,0.18)',
              zIndex: 3000,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '12px' }}>
              {editingPoi.id ? 'Editar ponto' : 'Novo ponto'}
            </h3>

            <label style={{ fontSize: '12px', fontWeight: 700 }}>Nome</label>
            <input
              value={editingPoi.nome || ''}
              onChange={(e) => setEditingPoi({ ...editingPoi, nome: e.target.value })}
              style={inputStyle}
              placeholder='Ex: Loja da Ana'
            />

            <label style={{ fontSize: '12px', fontWeight: 700 }}>Tipo</label>
            <select
              value={editingPoi.tipo || 'loja'}
              onChange={(e) => setEditingPoi({ ...editingPoi, tipo: e.target.value as PoiType })}
              style={inputStyle}
            >
              <option value='loja'>Loja</option>
              <option value='banheiro'>Banheiro</option>
              <option value='entrada'>Entrada</option>
            </select>

            <label style={{ fontSize: '12px', fontWeight: 700 }}>Descricao</label>
            <input
              value={editingPoi.descricao || ''}
              onChange={(e) => setEditingPoi({ ...editingPoi, descricao: e.target.value })}
              style={inputStyle}
              placeholder='Informacao curta sobre o ponto'
            />

            <label style={{ fontSize: '12px', fontWeight: 700 }}>URL da foto</label>
            <input
              value={editingPoi.imagemUrl || ''}
              onChange={(e) => setEditingPoi({ ...editingPoi, imagemUrl: e.target.value })}
              style={inputStyle}
              placeholder='https://...'
            />

            {editingPoi.tipo === 'loja' && (
              <>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Contato</label>
                <input
                  value={editingPoi.contato || ''}
                  onChange={(e) => setEditingPoi({ ...editingPoi, contato: e.target.value })}
                  style={inputStyle}
                  placeholder='(81) 99999-9999'
                />

                <label style={{ fontSize: '12px', fontWeight: 700 }}>Produtos (um por linha)</label>
                <textarea
                  value={editingPoi.produtosText || ''}
                  onChange={(e) => setEditingPoi({ ...editingPoi, produtosText: e.target.value })}
                  style={{ ...inputStyle, minHeight: '92px', resize: 'vertical' }}
                  placeholder={'Exemplo:\nCalca Skinny | R$ 49,90\nShort Jeans | R$ 39,90'}
                />
              </>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button onClick={salvarPonto} style={{ ...actionButton, background: '#2563eb' }}>
                Salvar
              </button>
              {editingPoi.id && (
                <button
                  onClick={() => deletarPonto(editingPoi.id!)}
                  style={{ ...actionButton, background: '#dc2626', width: '56px', flex: 'unset' }}
                >
                  Del
                </button>
              )}
              <button
                onClick={() => setEditingPoi(null)}
                style={{ ...actionButton, background: '#64748b', width: '56px', flex: 'unset' }}
              >
                X
              </button>
            </div>
          </div>
        )}

        {!isAdmin && (
          <div
            style={{
              position: 'absolute',
              top: isMobile ? 'calc(env(safe-area-inset-top, 0px) + 62px)' : 18,
              left: isMobile ? 8 : 70,
              zIndex: 1120,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              background: 'rgba(255,255,255,0.95)',
              border: '1px solid #dbe4ea',
              borderRadius: 999,
              boxShadow: '0 10px 18px rgba(15,23,42,0.15)',
              padding: '6px',
            }}
          >
            <button
              onClick={() => {
                setIsPinsPanelOpen((prev) => !prev);
                setIsRoutePanelOpen(false);
              }}
              style={{
                border: isPinsPanelOpen ? '1px solid #2563eb' : '1px solid #cbd5e1',
                background: isPinsPanelOpen ? '#eff6ff' : 'white',
                color: isPinsPanelOpen ? '#1d4ed8' : '#334155',
                borderRadius: 999,
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Pins ({visiblePois.length})
            </button>
            <button
              onClick={() => {
                setIsRoutePanelOpen((prev) => !prev);
                setIsPinsPanelOpen(false);
              }}
              style={{
                border: isRoutePanelOpen ? '1px solid #2563eb' : '1px solid #cbd5e1',
                background: isRoutePanelOpen ? '#eff6ff' : 'white',
                color: isRoutePanelOpen ? '#1d4ed8' : '#334155',
                borderRadius: 999,
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Rota
            </button>
            <button
              onClick={() => {
                setTutorialStepIndex(0);
                setIsTutorialOpen(true);
              }}
              style={{
                border: '1px solid #cbd5e1',
                background: 'white',
                color: '#334155',
                borderRadius: 999,
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Tutorial
            </button>
          </div>
        )}

        {!isAdmin && isPinsPanelOpen && (
          <div
            style={{
              position: 'absolute',
              top: isMobile ? 'calc(env(safe-area-inset-top, 0px) + 108px)' : 66,
              left: isMobile ? 8 : 70,
              right: isMobile ? 8 : 'auto',
              zIndex: 1110,
              width: isMobile ? 'calc(100vw - 16px)' : 360,
              maxHeight: isMobile ? 'calc(44dvh - env(safe-area-inset-bottom, 0px))' : '58vh',
              overflowY: 'auto',
              background: 'rgba(255,255,255,0.97)',
              border: '1px solid #dbe4ea',
              borderRadius: 12,
              boxShadow: '0 12px 24px rgba(15,23,42,0.2)',
              padding: isMobile ? 10 : 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Painel de pins</div>
              <button
                onClick={() => setIsPinsPanelOpen(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#64748b',
                  fontSize: 18,
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
                title='Fechar painel de pins'
              >
                x
              </button>
            </div>

            <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>
              {manualVisiblePoiIds.length > 0
                ? `Selecao manual ativa (${manualVisiblePoiIds.length} pins).`
                : `Automatico: ate ${MAX_DEFAULT_VISIBLE_PINS} pins mais acessados.`}
            </div>

            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder='Procurar loja, banheiro ou entrada...'
                style={{ ...inputStyle, marginBottom: 0, paddingRight: 34 }}
              />
              <span style={{ position: 'absolute', right: 12, top: 11, color: '#94a3b8', fontSize: 14 }}>
                Buscar
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {(Object.keys(poiTypeLabels) as PoiType[]).map((type) => (
                <button
                  key={`filter_${type}`}
                  onClick={() => toggleType(type)}
                  style={{
                    border: enabledTypes[type] ? '1px solid #2563eb' : '1px solid #cbd5e1',
                    background: enabledTypes[type] ? '#eff6ff' : 'white',
                    color: enabledTypes[type] ? '#1d4ed8' : '#334155',
                    borderRadius: 999,
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {poiTypeLabels[type]}
                </button>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
                fontSize: 12,
                color: '#475569',
              }}
            >
              <span>{visiblePois.length} pins visiveis</span>
              <button
                onClick={() => setManualVisiblePoiIds([])}
                disabled={manualVisiblePoiIds.length === 0}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: manualVisiblePoiIds.length > 0 ? '#2563eb' : '#94a3b8',
                  fontWeight: 700,
                  cursor: manualVisiblePoiIds.length > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                Usar automatico
              </button>
            </div>

            <div
              style={{
                maxHeight: isMobile ? 140 : 220,
                overflowY: 'auto',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: 8,
                display: 'grid',
                gap: 6,
              }}
            >
              {searchablePois.map((poi) => {
                const checked = manualVisiblePoiIds.includes(poi.id);
                return (
                  <div
                    key={`catalog_${poi.id}`}
                    style={{
                      border: checked ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                      borderRadius: 8,
                      background: checked ? '#f0f9ff' : 'white',
                      padding: '6px 8px',
                      display: 'grid',
                      gridTemplateColumns: '18px 1fr auto',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <input
                      type='checkbox'
                      checked={checked}
                      onChange={() => toggleManualVisibility(poi.id)}
                      title='Controlar visibilidade manual deste pin'
                    />
                    <button
                      onClick={() => focusPoi(poi, true)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        padding: 0,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{poi.nome}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {poi.tipo.toUpperCase()} | {poiAccessCount[poi.id] ?? 0} acessos
                      </div>
                    </button>
                    <button
                      onClick={() => focusPoi(poi, true)}
                      style={{
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        background: 'white',
                        fontSize: 11,
                        padding: '4px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      Ver
                    </button>
                  </div>
                );
              })}

              {searchablePois.length === 0 && (
                <div style={{ fontSize: 12, color: '#64748b', padding: '6px 2px' }}>
                  Nenhum ponto encontrado para esse filtro.
                </div>
              )}
            </div>
          </div>
        )}

        {!isAdmin && isRoutePanelOpen && (
          <div
            style={{
              position: 'absolute',
              top: isMobile ? 'calc(env(safe-area-inset-top, 0px) + 108px)' : 'auto',
              left: isMobile ? 8 : 70,
              right: isMobile ? 8 : 'auto',
              bottom: isMobile ? 'auto' : 18,
              zIndex: 1110,
              width: isMobile ? 'calc(100vw - 16px)' : 360,
              maxHeight: isMobile ? 'calc(46dvh - env(safe-area-inset-bottom, 0px))' : '46vh',
              overflowY: 'auto',
              background: 'rgba(255,255,255,0.97)',
              border: '1px solid #dbe4ea',
              borderRadius: 12,
              boxShadow: '0 12px 24px rgba(15,23,42,0.2)',
              padding: isMobile ? 10 : 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Painel de rota</div>
              <button
                onClick={() => setIsRoutePanelOpen(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#64748b',
                  fontSize: 18,
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
                title='Fechar painel de rota'
              >
                x
              </button>
            </div>

            <label style={{ fontSize: 12, fontWeight: 700 }}>Local atual (digite para sugerir)</label>
            <div style={{ position: 'relative', marginTop: 4, marginBottom: 10 }}>
              <input
                value={originQuery}
                onChange={(e) => {
                  setOriginQuery(e.target.value);
                  setSelectedOriginId('');
                  setShowOriginSuggestions(true);
                }}
                onFocus={() => setShowOriginSuggestions(true)}
                onBlur={() => window.setTimeout(() => setShowOriginSuggestions(false), 120)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && originSuggestions.length > 0) {
                    e.preventDefault();
                    selectOriginPoi(originSuggestions[0]);
                  }
                }}
                style={{ ...inputStyle, margin: 0 }}
                placeholder='Ex: Entrada Sul, banheiro...'
              />
              {showOriginSuggestions && (
                <div className='route-suggestions'>
                  {originSuggestions.map((poi) => (
                    <button
                      key={`origin_suggestion_${poi.id}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectOriginPoi(poi)}
                      className='route-suggestion-item'
                    >
                      <span>{poi.nome}</span>
                      <span>{poi.tipo.toUpperCase()}</span>
                    </button>
                  ))}
                  {originSuggestions.length === 0 && (
                    <div className='route-suggestion-empty'>Nenhuma sugestao para local atual.</div>
                  )}
                </div>
              )}
            </div>

            <label style={{ fontSize: 12, fontWeight: 700 }}>Ir para o local (destino)</label>
            <div style={{ position: 'relative', marginTop: 4, marginBottom: 10 }}>
              <input
                value={destinationQuery}
                onChange={(e) => {
                  setDestinationQuery(e.target.value);
                  setSelectedDestinationId('');
                  setShowDestinationSuggestions(true);
                }}
                onFocus={() => setShowDestinationSuggestions(true)}
                onBlur={() => window.setTimeout(() => setShowDestinationSuggestions(false), 120)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && destinationSuggestions.length > 0) {
                    e.preventDefault();
                    selectDestinationPoi(destinationSuggestions[0]);
                  }
                }}
                style={{ ...inputStyle, margin: 0 }}
                placeholder='Ex: Loja Kids, banheiro...'
              />
              {showDestinationSuggestions && (
                <div className='route-suggestions'>
                  {destinationSuggestions.map((poi) => (
                    <button
                      key={`destination_suggestion_${poi.id}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectDestinationPoi(poi)}
                      className='route-suggestion-item'
                    >
                      <span>{poi.nome}</span>
                      <span>{poi.tipo.toUpperCase()}</span>
                    </button>
                  ))}
                  {destinationSuggestions.length === 0 && (
                    <div className='route-suggestion-empty'>Nenhuma sugestao para destino.</div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button onClick={handleManualRoute} style={{ ...actionButton, background: '#2563eb' }}>
                Tracar rota
              </button>
              <button onClick={clearRoute} style={{ ...actionButton, background: '#64748b' }}>
                Limpar
              </button>
            </div>

            <div
              style={{
                fontSize: 12,
                lineHeight: 1.4,
                color: '#334155',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 8,
              }}
            >
              {routeMessage}
            </div>
            {routeDistanceMeters > 0 && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  lineHeight: 1.45,
                  color: '#475569',
                  background: '#f1f5f9',
                  border: '1px solid #dbe4ea',
                  borderRadius: 8,
                  padding: '7px 8px',
                }}
              >
                {`Distancia: ${formatDistanceLabel(routeDistanceMeters)} | Tempo medio: ${formatWalkingTimeLabel(routeEtaMinutes)} | Progresso: ${Math.round(walkerProgress * 100)}%`}
              </div>
            )}
          </div>
        )}

        {!isAdmin && isTutorialOpen && (
          <div className='map-tutorial-overlay'>
            <div className='map-tutorial-card'>
              <div className='map-tutorial-progress'>
                {tutorialSteps.map((step, index) => (
                  <div
                    key={step.title}
                    className={`map-tutorial-progress-item ${index <= tutorialStepIndex ? 'active' : ''}`}
                  />
                ))}
              </div>

              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>
                PASSO {tutorialStepIndex + 1} DE {tutorialSteps.length}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                {currentTutorialStep.title}
              </div>
              <div style={{ fontSize: 14, color: '#334155', marginTop: 8, lineHeight: 1.45 }}>
                {currentTutorialStep.text}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button
                  onClick={closeTutorial}
                  style={{
                    ...actionButton,
                    background: '#e2e8f0',
                    color: '#334155',
                    fontWeight: 700,
                  }}
                >
                  Pular
                </button>

                {tutorialStepIndex > 0 && (
                  <button
                    onClick={() => setTutorialStepIndex((prev) => Math.max(0, prev - 1))}
                    style={{ ...actionButton, background: '#64748b' }}
                  >
                    Voltar
                  </button>
                )}

                {tutorialStepIndex < tutorialSteps.length - 1 ? (
                  <button
                    onClick={() =>
                      setTutorialStepIndex((prev) => Math.min(tutorialSteps.length - 1, prev + 1))
                    }
                    style={{ ...actionButton, background: '#2563eb' }}
                  >
                    Proximo
                  </button>
                ) : (
                  <button onClick={closeTutorial} style={{ ...actionButton, background: '#16a34a' }}>
                    Comecar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {!isAdmin && activePoi && (
          <div
            style={{
              position: 'absolute',
              top: isMobile ? 'auto' : 18,
              right: isMobile ? 6 : 18,
              bottom: isMobile ? 'calc(8px + env(safe-area-inset-bottom, 0px))' : 'auto',
              left: isMobile ? 6 : 'auto',
              zIndex: 1100,
              width: isMobile ? 'calc(100vw - 12px)' : 'min(360px, calc(100vw - 36px))',
              height: isMobile ? `${resolvedMobileSheetHeight}px` : 'auto',
              minHeight: isMobile && mobileSheetBounds ? `${mobileSheetBounds.minHeight}px` : undefined,
              maxHeight: isMobile && mobileSheetBounds ? `${mobileSheetBounds.maxHeight}px` : 'min(78dvh, 690px)',
              overflowY: isMobile ? 'hidden' : 'auto',
              background: 'rgba(255,255,255,0.98)',
              border: '1px solid #dbe4ea',
              borderRadius: 14,
              boxShadow: isMobile ? '0 8px 20px rgba(15,23,42,0.2)' : '0 18px 30px rgba(15,23,42,0.25)',
              padding: isMobile ? 0 : 12,
              display: isMobile ? 'flex' : 'block',
              flexDirection: isMobile ? 'column' : undefined,
              transition: isMobile && !isMobileSheetDragging ? 'height 180ms ease' : undefined,
            }}
          >
            {isMobile && (
              <button
                type='button'
                onPointerDown={handleMobileSheetPointerDown}
                aria-label='Arrastar painel de detalhes'
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'rgba(248,250,252,0.96)',
                  borderBottom: '1px solid #e2e8f0',
                  padding: '7px 0 6px',
                  cursor: 'ns-resize',
                  touchAction: 'none',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: 46,
                    height: 5,
                    borderRadius: 999,
                    background: '#94a3b8',
                    margin: '0 auto',
                  }}
                />
                <span style={{ display: 'block', marginTop: 4, fontSize: 10, color: '#64748b', fontWeight: 700 }}>
                  Arraste para ver mais
                </span>
              </button>
            )}

            <div
              style={{
                padding: isMobile ? '8px 8px 10px' : 0,
                overflowY: isMobile ? 'auto' : 'visible',
                WebkitOverflowScrolling: 'touch',
                flex: isMobile ? 1 : undefined,
              }}
            >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 800, color: '#0f172a' }}>{activePoi.nome}</div>
              <button
                onClick={() => setActivePoiId(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#64748b',
                  fontSize: isMobile ? 18 : 20,
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
                title='Fechar detalhes'
              >
                x
              </button>
            </div>

            <div style={{ fontSize: isMobile ? 12 : 13, color: '#475569', marginBottom: 8 }}>
              Nivel 0 / GNOCENTER - {activePoi.tipo.toUpperCase()}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <button
                onClick={handleDirectionsFromActivePoi}
                style={{ ...actionButton, background: '#2563eb', padding: isMobile ? '9px 8px' : '10px 9px' }}
              >
                Ir para o local
              </button>
              <button
                onClick={setActivePoiAsOrigin}
                style={{ ...actionButton, background: '#0ea5e9', padding: isMobile ? '9px 8px' : '10px 9px' }}
              >
                Marcar local
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <button
                onClick={setActivePoiAsDestination}
                style={{ ...actionButton, background: '#f43f5e', padding: isMobile ? '9px 8px' : '10px 9px' }}
              >
                Atualizar destino
              </button>
              {activeWhatsappLink ? (
                <a
                  href={activeWhatsappLink}
                  target='_blank'
                  rel='noreferrer'
                  style={{
                    ...actionButton,
                    background: '#10b981',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: isMobile ? '9px 8px' : '10px 9px',
                  }}
                >
                  WhatsApp
                </a>
              ) : (
                <button
                  disabled
                  style={{
                    ...actionButton,
                    background: '#cbd5e1',
                    cursor: 'not-allowed',
                    padding: '10px',
                  }}
                >
                  Sem contato
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span
                style={{
                  background: `${storeStatus.color}1F`,
                  color: storeStatus.color,
                  borderRadius: 999,
                  fontSize: isMobile ? 11 : 12,
                  fontWeight: 700,
                  padding: isMobile ? '3px 8px' : '4px 10px',
                }}
              >
                {storeStatus.label}
              </span>
              <span style={{ color: '#334155', fontSize: isMobile ? 11 : 13 }}>{storeStatus.closeText}</span>
              <span style={{ color: '#64748b', fontSize: isMobile ? 11 : 12 }}>
                {poiAccessCount[activePoi.id] ?? 0} acessos
              </span>
            </div>

            {activePanelGalleryImages.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: activePanelGalleryImages.length > 1 ? '1.2fr 1fr' : '1fr',
                  gap: isMobile ? 6 : 8,
                  marginBottom: 8,
                }}
              >
                {activePanelGalleryImages.map((imgUrl, index) => (
                  <img
                    key={`active_gallery_${activePoi.id}_${index}`}
                    src={imgUrl}
                    alt={`${activePoi.nome} ${index + 1}`}
                    loading='lazy'
                    decoding='async'
                    style={{
                      width: '100%',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      objectFit: 'cover',
                      height: index === 0 ? (isMobile ? 104 : 146) : isMobile ? 62 : 74,
                    }}
                  />
                ))}
              </div>
            )}

            {activePanelPreviewProducts.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
                  gap: isMobile ? 6 : 5,
                  marginBottom: 8,
                }}
              >
                {activePanelPreviewProducts.map((produto, index) => (
                  <article
                    key={`product_preview_${activePoi.id}_${index}`}
                    className='product-preview-card'
                    style={{
                      border: '1px solid #dbe4ea',
                      borderRadius: 9,
                      overflow: 'hidden',
                      background: 'white',
                      boxShadow: '0 6px 14px rgba(15,23,42,0.08)',
                    }}
                  >
                    <img
                      src={getProductPreviewImage(activePoi, produto, index)}
                      alt={produto.nome}
                      loading='lazy'
                      decoding='async'
                      style={{
                        width: '100%',
                        height: isMobile ? 50 : 54,
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                    <div style={{ padding: isMobile ? '4px 5px' : '5px 6px' }}>
                      <div
                        style={{
                          fontSize: isMobile ? 9 : 10,
                          fontWeight: 700,
                          color: '#1e293b',
                          lineHeight: 1.2,
                          marginBottom: 2,
                          minHeight: isMobile ? 20 : 24,
                          overflow: 'hidden',
                        }}
                      >
                        {produto.nome}
                      </div>
                      <div style={{ fontSize: isMobile ? 9 : 10, fontWeight: 800, color: '#0f172a' }}>
                        {produto.preco}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div style={{ fontSize: isMobile ? 13 : 14, color: '#1e293b', lineHeight: 1.4 }}>
              {activePoi.descricao || 'Sem descricao cadastrada para este ponto.'}
            </div>
            </div>
          </div>
        )}

        {!isAdmin && (
          <button
            onClick={() => setIsAdmin(true)}
            style={{
              position: 'absolute',
              top: isMobile ? 'calc(env(safe-area-inset-top, 0px) + 10px)' : 14,
              left: 12,
              zIndex: 1100,
              background: 'white',
              border: '2px solid #334155',
              borderRadius: '50%',
              width: 40,
              height: 40,
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
              fontWeight: 700,
            }}
            title='Abrir painel admin'
          >
            A
          </button>
        )}

        <MapContainer
          bounds={mapBounds}
          center={MAP_CENTER}
          zoom={MAP_DEFAULT_ZOOM}
          minZoom={MAP_MIN_ZOOM}
          maxZoom={MAP_MAX_ZOOM}
          maxBounds={MAP_VIEWPORT_BOUNDS}
          maxBoundsViscosity={0.75}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          preferCanvas={false}
          zoomAnimation={!isMobile}
          markerZoomAnimation={!isMobile}
          fadeAnimation={!isMobile}
        >
          <TileLayer
            url='https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          />
          <ImageOverlay url='/maps/mapa-visual.jpg' bounds={mapBounds} opacity={0.64} />
          <MapEvents />
          <MapController focusPoint={focusPoint} isMobile={isMobile} />

          {routeLatLngPoints.length > 1 && (
            <>
              <Polyline
                positions={routeLatLngPoints}
                pathOptions={{
                  color: '#3b82f6',
                  weight: isMobile ? 13 : 15,
                  opacity: 0.24,
                  lineCap: 'round',
                  lineJoin: 'round',
                  className: 'route-glow-line',
                }}
              />
              <Polyline
                positions={routeLatLngPoints}
                pathOptions={{
                  color: '#1d87ff',
                  weight: isMobile ? 7 : 8,
                  opacity: 0.95,
                  lineCap: 'round',
                  lineJoin: 'round',
                  className: 'route-main-line',
                }}
              />
              <Polyline
                positions={routeLatLngPoints}
                pathOptions={{
                  color: '#dff1ff',
                  weight: isMobile ? 3.4 : 4,
                  opacity: 0.95,
                  dashArray: '10, 16',
                  lineCap: 'round',
                  lineJoin: 'round',
                  className: 'route-flow-line',
                }}
              />
              {walkerPosition && (
                <Marker position={walkerPosition} icon={walkerIcon} interactive={false} zIndexOffset={1900}>
                  <Tooltip permanent direction='top' offset={[0, -14]} className='route-walker-label'>
                    {routeRemainingEtaLabel === 'chegando'
                      ? 'Chegando ao destino'
                      : `Chegada em ~${routeRemainingEtaLabel}`}
                  </Tooltip>
                </Marker>
              )}
            </>
          )}

          {visiblePois.map((poi) => {
            const isActive = poi.id === activePoiId;
            const popupImage = poi.imagemUrl || defaultPoiImages[poi.tipo];
            const isStore = poi.tipo === 'loja';
            const popupGallery = getPoiGalleryImages(poi).slice(0, isMobile ? 1 : 2);
            return (
              <Marker
                key={poi.id}
                position={imageToLatLng(poi.x, poi.y)}
                icon={getMarkerIcon(poi, isActive)}
                eventHandlers={{ click: () => handleMarkerSelection(poi) }}
              >
                <Popup minWidth={isMobile ? 220 : 244} maxWidth={isMobile ? 286 : 320}>
                  <div
                    style={{
                      minWidth: isMobile ? 210 : 236,
                      maxWidth: isMobile ? 268 : 300,
                      maxHeight: isMobile ? 'min(48vh, 320px)' : 'min(54vh, 460px)',
                      overflowY: 'auto',
                      WebkitOverflowScrolling: 'touch',
                      textAlign: 'left',
                    }}
                    className='store-popup-card'
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                      <img
                        src={popupImage}
                        alt={poi.nome}
                        loading='lazy'
                        decoding='async'
                        style={{
                          height: isMobile ? 40 : 44,
                          width: isMobile ? 40 : 44,
                          borderRadius: 8,
                          objectFit: 'cover',
                          border: '1px solid #e2e8f0',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: isMobile ? 14 : 15,
                            fontWeight: 800,
                            color: '#0f172a',
                            lineHeight: 1.15,
                          }}
                        >
                          {poi.nome}
                        </div>
                        <div style={{ fontSize: isMobile ? 11 : 12, color: '#64748b', marginTop: 2 }}>
                          Nivel 0 / Gnocenter
                        </div>
                      </div>
                    </div>

                    {isStore && (
                      <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 6,
                          }}
                        >
                        <span
                          style={{
                            background: `${storeStatus.color}1F`,
                            color: storeStatus.color,
                            borderRadius: 999,
                              fontSize: isMobile ? 10 : 11,
                              fontWeight: 800,
                              padding: isMobile ? '3px 8px' : '4px 10px',
                            }}
                          >
                            {storeStatus.label}
                          </span>
                          <span style={{ fontSize: isMobile ? 11 : 12, color: '#334155' }}>{storeStatus.closeText}</span>
                        </div>
                      )}

                    {isStore && popupGallery.length > 0 && (
                      <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: popupGallery.length > 1 ? '1.2fr 1fr' : '1fr',
                            gap: 5,
                            marginBottom: 6,
                          }}
                        >
                        {popupGallery.map((imgUrl, index) => (
                          <img
                            key={`popup_gallery_${poi.id}_${index}`}
                            src={imgUrl}
                            alt={`${poi.nome} ${index + 1}`}
                            loading='lazy'
                            decoding='async'
                            style={{
                              width: '100%',
                              height: popupGallery.length > 1 ? (isMobile ? 64 : 72) : isMobile ? 76 : 88,
                              borderRadius: 7,
                              objectFit: 'cover',
                              border: '1px solid #e2e8f0',
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {poi.descricao && (
                      <div style={{ fontSize: isMobile ? 11 : 12, color: '#334155', marginBottom: 7, lineHeight: 1.35 }}>
                        {poi.descricao}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <button
                            onClick={() => {
                              focusPoi(poi, true);
                              markPoiAsCurrentLocation(poi);
                            }}
                            style={{
                              border: 'none',
                              borderRadius: 10,
                              background: '#2563eb',
                              color: 'white',
                              fontSize: isMobile ? 11 : 12,
                              fontWeight: 800,
                              padding: isMobile ? '8px 8px' : '8px 9px',
                              cursor: 'pointer',
                              boxShadow: '0 6px 14px rgba(37,99,235,0.22)',
                            }}
                      >
                        Marcar local
                      </button>
                      <button
                        onClick={() => {
                          focusPoi(poi, true);
                          navigateToPoi(poi);
                        }}
                        style={{
                          border: '1px solid #cbd5e1',
                          borderRadius: 10,
                              background: 'white',
                              color: '#334155',
                              fontSize: isMobile ? 11 : 12,
                              fontWeight: 800,
                              padding: isMobile ? '8px 8px' : '8px 9px',
                              cursor: 'pointer',
                            }}
                      >
                        Ir para o local
                      </button>
                    </div>
                  </div>
                </Popup>

                {isActive && (
                  <Tooltip permanent direction='bottom' offset={[0, 18]} className='poi-selected-label'>
                    {poi.nome}
                  </Tooltip>
                )}
              </Marker>
            );
          })}

          {isAdmin &&
            editingPoi &&
            !editingPoi.id &&
            typeof editingPoi.x === 'number' &&
            typeof editingPoi.y === 'number' && (
              <Marker position={imageToLatLng(editingPoi.x, editingPoi.y)} icon={stateIcons.novo} />
            )}
        </MapContainer>
      </div>
    </div>
  );
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px',
  marginTop: '4px',
  marginBottom: '10px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  boxSizing: 'border-box',
};

const actionButton: CSSProperties = {
  flex: 1,
  color: 'white',
  border: 'none',
  padding: '10px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 700,
};

export default ModaCenterMap;
