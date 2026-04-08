// ─── Enumerations ────────────────────────────────────────────────────────────

export type Faction = 'mafia' | 'spider' | 'timecore' | 'verdant' | 'primal';
export type TechTier = 1 | 2 | 3;
export type OwnerType = 'player' | 'enemy' | 'neutral';
export type UnitState =
  | 'idle'
  | 'moving'
  | 'attacking'
  | 'gathering'
  | 'returning'
  | 'following'
  | 'loaded'        // inside a transport
  | 'building';     // worker constructing a building
export type BuildingState = 'idle' | 'producing' | 'under_construction';
export type StatusEffectType = 'fire' | 'web' | 'frozen' | 'infected' | 'slowed' | 'burning';

// ─── Static Configs (from design tables) ─────────────────────────────────────

export interface UnitConfig {
  key: string;
  name: string;
  faction: Faction;
  tier: TechTier;
  role: string;
  maxHp: number;
  primaryCost: number;
  advancedCost: number;
  supply: number;
  damage: number;
  attackRange: number;      // pixels
  attackRate: number;       // attacks per second
  moveSpeed: number;        // pixels per second
  isHero: boolean;
  isWorker: boolean;
  isTransport: boolean;
  cargoSlots: number;
  isAir: boolean;
  abilities: string[];
  producedAt: string[];     // building keys
  requirements: string[];   // required building keys (tech gate)
  /** hex number like 0xff8800 */
  color: number;
  /** draw radius in pixels */
  radius: number;
  /** shape: 'circle' | 'rect' | 'diamond' */
  shape: 'circle' | 'rect' | 'diamond';
}

export interface BuildingConfig {
  key: string;
  name: string;
  faction: Faction;
  tier: TechTier;
  primaryCost: number;
  advancedCost: number;
  maxHp: number;
  supplyProvided: number;
  isHQ: boolean;
  isExtraction: boolean;   // must be placed on a Sporadic Flow node
  isTower: boolean;
  towerRange: number;
  towerDamage: number;
  towerAttackRate: number;
  buildTime: number;       // seconds
  canDetect: boolean;
  width: number;
  height: number;
  color: number;
  /** unit keys this building can produce (ordered) */
  produces: string[];
  /** worker unit keys that can construct this building; omit or empty = not worker-buildable */
  builtBy?: string[];
}

// ─── Runtime Types ────────────────────────────────────────────────────────────

export interface Vec2 { x: number; y: number; }

export interface StatusEffect {
  type: StatusEffectType;
  totalDuration: number;
  remainingDuration: number;
  intensity: number;
  /** 0–100 — only meaningful for 'web' type */
  webBuildup: number;
  sourceId: string;
}

export interface ProductionItem {
  unitKey: string;
  progress: number;   // 0–1
  totalTime: number;  // seconds
}

export interface GameResources {
  primary: number;    // Cash / Biomass / Energy / Nutrients / Food
  advanced: number;   // Contraband / Essence / Chrono / Spores / Instinct
}

export interface GameState {
  resources: GameResources;
  supply: number;
  maxSupply: number;
  techTier: TechTier;
  heroAlive: boolean;
  heroRepurchasable: boolean;
  heroRepurchaseCooldown: number;  // seconds remaining
}

export type NotificationType = 'info' | 'warning' | 'alert';

export interface Notification {
  message: string;
  type: NotificationType;
  ttl: number; // seconds remaining
}
