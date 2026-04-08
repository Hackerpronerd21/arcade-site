import { ResourceNode } from './ResourceNode.js';

export const WORLD_W = 6400;
export const WORLD_H = 6400;
export const TILE_SIZE = 64;

export type TileType = 'grass' | 'dirt' | 'rock' | 'water';

/** Sparse set of impassable tiles (world pixel coords of tile corners) */
const ROCK_TILES: Array<[number, number]> = [
  // Center cluster - horizontal barrier
  ...range(45, 60).map(c => [c, 50] as [number, number]),
  ...range(45, 60).map(c => [c, 49] as [number, number]),
  // Two flanking walls
  ...range(20, 30).map(r => [50, r] as [number, number]),
  ...range(70, 80).map(r => [50, r] as [number, number]),
  // Top-right cluster
  ...range(68, 78).map(c => [c, 18] as [number, number]),
  ...range(68, 78).map(c => [c, 19] as [number, number]),
  // Bottom-left cluster
  ...range(20, 30).map(c => [c, 78] as [number, number]),
  ...range(20, 30).map(c => [c, 79] as [number, number]),
];

function range(start: number, end: number): number[] {
  const result: number[] = [];
  for (let i = start; i < end; i++) result.push(i);
  return result;
}

const rockSet = new Set(ROCK_TILES.map(([c, r]) => `${c},${r}`));

export function getTileType(tileCol: number, tileRow: number): TileType {
  if (rockSet.has(`${tileCol},${tileRow}`)) return 'rock';
  return 'grass';
}

export function isPassable(worldX: number, worldY: number): boolean {
  const c = Math.floor(worldX / TILE_SIZE);
  const r = Math.floor(worldY / TILE_SIZE);
  return getTileType(c, r) !== 'rock';
}

// ─── Resource node layout ─────────────────────────────────────────────────────

/** Create a full set of resource nodes around a base center */
function makeBaseResources(
  baseCx: number,
  baseCy: number,
  facing: 'northeast' | 'southwest',
): ResourceNode[] {
  const nodes: ResourceNode[] = [];

  // 16 primary (Clean Flow) patches in two arcs
  const patchOffsets: Array<[number, number]> = [
    [-160, -80], [-96, -80], [-32, -80], [32, -80],
    [96, -80], [160, -80], [-160, -128], [-96, -128],
    [-32, -128], [32, -128], [96, -128], [160, -128],
    [-64, -176], [0, -176], [64, -176], [128, -176],
  ];

  const sign = facing === 'northeast' ? 1 : -1;

  for (const [dx, dy] of patchOffsets) {
    nodes.push(new ResourceNode(
      'primary',
      baseCx + dx * sign,
      baseCy + dy * sign,
      1500,
    ));
  }

  // 2 advanced (Sporadic Flow) nodes further from base
  nodes.push(new ResourceNode('advanced', baseCx + 240 * sign, baseCy - 200 * sign, 600));
  nodes.push(new ResourceNode('advanced', baseCx - 240 * sign, baseCy - 200 * sign, 600));

  return nodes;
}

export interface MapData {
  playerBaseX: number;
  playerBaseY: number;
  enemyBaseX: number;
  enemyBaseY: number;
  playerNodes: ResourceNode[];
  enemyNodes: ResourceNode[];
  neutralNodes: ResourceNode[];
}

export function buildMap(): MapData {
  const playerBaseX = 900;
  const playerBaseY = 5500;
  const enemyBaseX  = 5500;
  const enemyBaseY  = 900;

  const playerNodes  = makeBaseResources(playerBaseX, playerBaseY, 'northeast');
  const enemyNodes   = makeBaseResources(enemyBaseX,  enemyBaseY,  'southwest');

  // Neutral nodes in mid-map for expansion incentive
  const neutralNodes: ResourceNode[] = [
    new ResourceNode('primary', 3200, 3200, 1200),
    new ResourceNode('primary', 3100, 3100, 1200),
    new ResourceNode('primary', 3300, 3100, 1200),
    new ResourceNode('primary', 3200, 3300, 1200),
    new ResourceNode('advanced', 3200, 2900, 500),
    new ResourceNode('advanced', 3200, 3500, 500),

    // Third bases
    new ResourceNode('primary', 1800, 3600, 1200),
    new ResourceNode('primary', 1700, 3500, 1200),
    new ResourceNode('primary', 1900, 3700, 1200),
    new ResourceNode('advanced', 1600, 3400, 500),

    new ResourceNode('primary', 4600, 2800, 1200),
    new ResourceNode('primary', 4700, 2900, 1200),
    new ResourceNode('primary', 4500, 2700, 1200),
    new ResourceNode('advanced', 4800, 3000, 500),
  ];

  return { playerBaseX, playerBaseY, enemyBaseX, enemyBaseY, playerNodes, enemyNodes, neutralNodes };
}
