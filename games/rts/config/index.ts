import type { UnitConfig, BuildingConfig, Faction } from '../types/index.js';

// ─── Resource naming per faction ─────────────────────────────────────────────

export const FACTION_RESOURCE_NAMES: Record<Faction, { primary: string; advanced: string }> = {
  mafia:   { primary: 'Cash',      advanced: 'Contraband' },
  spider:  { primary: 'Biomass',   advanced: 'Essence'    },
  timecore:{ primary: 'Energy',    advanced: 'Chrono'     },
  verdant: { primary: 'Nutrients', advanced: 'Spores'     },
  primal:  { primary: 'Food',      advanced: 'Instinct'   },
};

// ─── MAFIA UNITS ─────────────────────────────────────────────────────────────

export const MAFIA_UNITS: Record<string, UnitConfig> = {
  tony: {
    key: 'tony', name: 'Tony', faction: 'mafia', tier: 1, role: 'Boss Hero',
    maxHp: 250, primaryCost: 0, advancedCost: 0, supply: 0,
    damage: 18, attackRange: 90, attackRate: 1.2, moveSpeed: 120,
    isHero: true, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: ['lose_your_temper', 'call_a_favor', 'make_an_example'],
    producedAt: ['mafia_hq'], requirements: [],
    color: 0xffd700, radius: 14, shape: 'diamond',
  },
  associate: {
    key: 'associate', name: 'Associate', faction: 'mafia', tier: 1, role: 'Worker',
    maxHp: 60, primaryCost: 50, advancedCost: 0, supply: 1,
    damage: 4, attackRange: 20, attackRate: 0.5, moveSpeed: 95,
    isHero: false, isWorker: true, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: [], producedAt: ['mafia_hq'], requirements: [],
    color: 0x8b5e3c, radius: 8, shape: 'circle',
  },
  street_thug: {
    key: 'street_thug', name: 'Street Thug', faction: 'mafia', tier: 1, role: 'Melee Infantry',
    maxHp: 50, primaryCost: 50, advancedCost: 0, supply: 1,
    damage: 8, attackRange: 22, attackRate: 1.0, moveSpeed: 110,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: [], producedAt: ['mafia_hq'], requirements: [],
    color: 0xcc4400, radius: 9, shape: 'circle',
  },
  soldier: {
    key: 'soldier', name: 'Soldier', faction: 'mafia', tier: 1, role: 'Basic Ranged',
    maxHp: 45, primaryCost: 75, advancedCost: 0, supply: 2,
    damage: 10, attackRange: 160, attackRate: 0.9, moveSpeed: 100,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: [], producedAt: ['mafia_hq'], requirements: [],
    color: 0xdd6600, radius: 9, shape: 'circle',
  },
  lookout: {
    key: 'lookout', name: 'Lookout', faction: 'mafia', tier: 1, role: 'Scout',
    maxHp: 35, primaryCost: 40, advancedCost: 0, supply: 1,
    damage: 4, attackRange: 60, attackRate: 0.8, moveSpeed: 135,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: ['detect'], producedAt: ['mafia_hq'], requirements: [],
    color: 0xffaa00, radius: 7, shape: 'circle',
  },
  gangster: {
    key: 'gangster', name: 'Gangster', faction: 'mafia', tier: 2, role: 'Core Combat',
    maxHp: 70, primaryCost: 100, advancedCost: 15, supply: 2,
    damage: 14, attackRange: 140, attackRate: 1.0, moveSpeed: 105,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: [], producedAt: ['mafia_barracks'], requirements: ['mafia_barracks'],
    color: 0xee5500, radius: 10, shape: 'circle',
  },
  launderer: {
    key: 'launderer', name: 'Launderer', faction: 'mafia', tier: 2, role: 'Economy Support',
    maxHp: 50, primaryCost: 75, advancedCost: 25, supply: 2,
    damage: 5, attackRange: 40, attackRate: 0.5, moveSpeed: 90,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: ['boost_income'], producedAt: ['mafia_barracks'], requirements: ['mafia_barracks'],
    color: 0x88bb44, radius: 9, shape: 'circle',
  },
  enforcer: {
    key: 'enforcer', name: 'Enforcer', faction: 'mafia', tier: 2, role: 'Close-range Bruiser',
    maxHp: 110, primaryCost: 125, advancedCost: 40, supply: 3,
    damage: 20, attackRange: 28, attackRate: 0.8, moveSpeed: 100,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: [], producedAt: ['mafia_barracks'], requirements: ['mafia_barracks'],
    color: 0xbb2200, radius: 12, shape: 'rect',
  },
  arsonist: {
    key: 'arsonist', name: 'Arsonist', faction: 'mafia', tier: 2, role: 'Fire Support',
    maxHp: 70, primaryCost: 120, advancedCost: 50, supply: 3,
    damage: 8, attackRange: 130, attackRate: 0.7, moveSpeed: 95,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: ['firebomb'], producedAt: ['mafia_barracks'], requirements: ['mafia_barracks'],
    color: 0xff4400, radius: 10, shape: 'circle',
  },
  suv_crew: {
    key: 'suv_crew', name: 'SUV Crew', faction: 'mafia', tier: 2, role: 'Transport',
    maxHp: 140, primaryCost: 150, advancedCost: 60, supply: 4,
    damage: 12, attackRange: 120, attackRate: 0.8, moveSpeed: 145,
    isHero: false, isWorker: false, isTransport: true, cargoSlots: 5, isAir: false,
    abilities: ['load', 'unload'], producedAt: ['mafia_garage'], requirements: ['mafia_garage'],
    color: 0x334455, radius: 14, shape: 'rect',
  },
  caporegime: {
    key: 'caporegime', name: 'Caporegime', faction: 'mafia', tier: 3, role: 'Support Commander',
    maxHp: 100, primaryCost: 125, advancedCost: 60, supply: 3,
    damage: 10, attackRange: 100, attackRate: 1.0, moveSpeed: 105,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: ['command_aura'], producedAt: ['mafia_underboss_hall'], requirements: ['mafia_underboss_hall'],
    color: 0xffcc00, radius: 11, shape: 'diamond',
  },
  assassin: {
    key: 'assassin', name: 'Assassin', faction: 'mafia', tier: 3, role: 'Stealth Killer',
    maxHp: 90, primaryCost: 150, advancedCost: 80, supply: 4,
    damage: 28, attackRange: 55, attackRate: 0.7, moveSpeed: 140,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: ['stealth', 'backstab'], producedAt: ['mafia_underboss_hall'], requirements: ['mafia_underboss_hall'],
    color: 0x1a1a2e, radius: 9, shape: 'circle',
  },
  armored_heist_car: {
    key: 'armored_heist_car', name: 'Armored Heist Car', faction: 'mafia', tier: 3, role: 'Raid Vehicle',
    maxHp: 260, primaryCost: 200, advancedCost: 100, supply: 6,
    damage: 22, attackRange: 130, attackRate: 0.9, moveSpeed: 130,
    isHero: false, isWorker: false, isTransport: true, cargoSlots: 2, isAir: false,
    abilities: ['steal_resources', 'ram'], producedAt: ['mafia_garage'], requirements: ['mafia_garage', 'mafia_underboss_hall'],
    color: 0x222233, radius: 16, shape: 'rect',
  },
};

// ─── SPIDER UNITS ─────────────────────────────────────────────────────────────

export const SPIDER_UNITS: Record<string, UnitConfig> = {
  spider_hero: {
    key: 'spider_hero', name: 'Spider Queen', faction: 'spider', tier: 1, role: 'Execution Hero',
    maxHp: 220, primaryCost: 0, advancedCost: 0, supply: 0,
    damage: 12, attackRange: 120, attackRate: 1.0, moveSpeed: 115,
    isHero: true, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: ['web_execute', 'web_burst'],
    producedAt: ['spider_hive'], requirements: [],
    color: 0x9900cc, radius: 14, shape: 'diamond',
  },
  brood_tender: {
    key: 'brood_tender', name: 'Brood Tender', faction: 'spider', tier: 1, role: 'Worker',
    maxHp: 50, primaryCost: 50, advancedCost: 0, supply: 1,
    damage: 4, attackRange: 20, attackRate: 0.5, moveSpeed: 95,
    isHero: false, isWorker: true, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: [], producedAt: ['spider_hive'], requirements: [],
    color: 0x663399, radius: 8, shape: 'circle',
  },
  webling: {
    key: 'webling', name: 'Webling', faction: 'spider', tier: 1, role: 'Setup Unit',
    maxHp: 35, primaryCost: 40, advancedCost: 0, supply: 1,
    damage: 5, attackRange: 80, attackRate: 0.8, moveSpeed: 105,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: ['web_slow'], producedAt: ['spider_hive'], requirements: [],
    color: 0xaaaacc, radius: 7, shape: 'circle',
  },
  skitterer: {
    key: 'skitterer', name: 'Skitterer', faction: 'spider', tier: 1, role: 'Fast Swarm',
    maxHp: 45, primaryCost: 50, advancedCost: 0, supply: 1,
    damage: 7, attackRange: 25, attackRate: 1.2, moveSpeed: 155,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: ['web_slow'], producedAt: ['spider_hive'], requirements: [],
    color: 0x8855bb, radius: 8, shape: 'circle',
  },
  web_spitter: {
    key: 'web_spitter', name: 'Web Spitter', faction: 'spider', tier: 2, role: 'Ranged Web',
    maxHp: 60, primaryCost: 75, advancedCost: 15, supply: 2,
    damage: 9, attackRange: 150, attackRate: 0.9, moveSpeed: 95,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: ['web_slow'], producedAt: ['spider_burrow'], requirements: ['spider_burrow'],
    color: 0xcc88ff, radius: 10, shape: 'circle',
  },
  web_beast: {
    key: 'web_beast', name: 'Web Beast', faction: 'spider', tier: 3, role: 'Heavy Bruiser',
    maxHp: 140, primaryCost: 150, advancedCost: 60, supply: 4,
    damage: 20, attackRange: 40, attackRate: 0.7, moveSpeed: 100,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: ['web_slow'], producedAt: ['spider_queen_chamber'], requirements: ['spider_queen_chamber'],
    color: 0x660099, radius: 14, shape: 'rect',
  },
};

// ─── TIME CORE UNITS ──────────────────────────────────────────────────────────

export const TIMECORE_UNITS: Record<string, UnitConfig> = {
  time_anchor: {
    key: 'time_anchor', name: 'Time Anchor', faction: 'timecore', tier: 1, role: 'Control Hero',
    maxHp: 300, primaryCost: 0, advancedCost: 0, supply: 0,
    damage: 16, attackRange: 180, attackRate: 0.9, moveSpeed: 110,
    isHero: true, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: ['temporal_freeze', 'time_lock'],
    producedAt: ['time_nexus'], requirements: [],
    color: 0x00ccff, radius: 14, shape: 'diamond',
  },
  chrono_harvester: {
    key: 'chrono_harvester', name: 'Chrono Harvester', faction: 'timecore', tier: 1, role: 'Worker',
    maxHp: 80, primaryCost: 60, advancedCost: 0, supply: 2,
    damage: 4, attackRange: 20, attackRate: 0.5, moveSpeed: 90,
    isHero: false, isWorker: true, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: [], producedAt: ['time_nexus'], requirements: [],
    color: 0x0088aa, radius: 9, shape: 'circle',
  },
  time_fragment: {
    key: 'time_fragment', name: 'Time Fragment', faction: 'timecore', tier: 1, role: 'Elite Basic',
    maxHp: 100, primaryCost: 120, advancedCost: 0, supply: 2,
    damage: 13, attackRange: 160, attackRate: 1.0, moveSpeed: 110,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: [], producedAt: ['time_nexus'], requirements: [],
    color: 0x44ddff, radius: 10, shape: 'circle',
  },
  cryo_enforcer: {
    key: 'cryo_enforcer', name: 'Cryo Enforcer', faction: 'timecore', tier: 2, role: 'Freeze / Sac Shatter',
    maxHp: 140, primaryCost: 130, advancedCost: 75, supply: 4,
    damage: 15, attackRange: 110, attackRate: 0.8, moveSpeed: 95,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: ['cryo_blast', 'shatter_sac'], producedAt: ['time_forge'], requirements: ['time_forge'],
    color: 0x99eeff, radius: 12, shape: 'rect',
  },
  chrono_tank: {
    key: 'chrono_tank', name: 'Chrono Tank', faction: 'timecore', tier: 3, role: 'Frontline Anchor',
    maxHp: 320, primaryCost: 260, advancedCost: 175, supply: 8,
    damage: 30, attackRange: 200, attackRate: 0.6, moveSpeed: 75,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: ['coolant_zone'], producedAt: ['time_citadel'], requirements: ['time_citadel'],
    color: 0x0055aa, radius: 18, shape: 'rect',
  },
};

// ─── VERDANT PLAGUE UNITS ─────────────────────────────────────────────────────

export const VERDANT_UNITS: Record<string, UnitConfig> = {
  bloom_tyrant: {
    key: 'bloom_tyrant', name: 'Bloom Tyrant', faction: 'verdant', tier: 1, role: 'Infection Commander',
    maxHp: 240, primaryCost: 0, advancedCost: 0, supply: 0,
    damage: 14, attackRange: 130, attackRate: 1.0, moveSpeed: 105,
    isHero: true, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: ['spore_burst', 'overgrowth', 'plague_mark'],
    producedAt: ['verdant_mycelium'], requirements: [],
    color: 0x22cc44, radius: 14, shape: 'diamond',
  },
  spore_tender: {
    key: 'spore_tender', name: 'Spore Tender', faction: 'verdant', tier: 1, role: 'Worker',
    maxHp: 55, primaryCost: 50, advancedCost: 0, supply: 1,
    damage: 4, attackRange: 20, attackRate: 0.5, moveSpeed: 95,
    isHero: false, isWorker: true, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: [], producedAt: ['verdant_mycelium'], requirements: [],
    color: 0x448833, radius: 8, shape: 'circle',
  },
  sproutling: {
    key: 'sproutling', name: 'Sproutling', faction: 'verdant', tier: 1, role: 'Basic Infected',
    maxHp: 50, primaryCost: 50, advancedCost: 0, supply: 1,
    damage: 8, attackRange: 30, attackRate: 1.0, moveSpeed: 100,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: ['infect'], producedAt: ['verdant_mycelium'], requirements: [],
    color: 0x55aa22, radius: 9, shape: 'circle',
  },
  plague_behemoth: {
    key: 'plague_behemoth', name: 'Plague Behemoth', faction: 'verdant', tier: 3, role: 'Heavy Fungal Monster',
    maxHp: 260, primaryCost: 225, advancedCost: 125, supply: 6,
    damage: 28, attackRange: 50, attackRate: 0.6, moveSpeed: 80,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: ['spore_cloud', 'slime_spread'], producedAt: ['verdant_sporarium'], requirements: ['verdant_sporarium'],
    color: 0x116622, radius: 18, shape: 'rect',
  },
};

// ─── PRIMAL DOMINION UNITS ────────────────────────────────────────────────────

export const PRIMAL_UNITS: Record<string, UnitConfig> = {
  apex_alpha: {
    key: 'apex_alpha', name: 'Apex Alpha', faction: 'primal', tier: 1, role: 'Pack Leader',
    maxHp: 300, primaryCost: 0, advancedCost: 0, supply: 0,
    damage: 20, attackRange: 45, attackRate: 1.1, moveSpeed: 130,
    isHero: true, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: ['pack_frenzy', 'alpha_roar'],
    producedAt: ['primal_nest'], requirements: [],
    color: 0xdd8800, radius: 14, shape: 'diamond',
  },
  nest_tender: {
    key: 'nest_tender', name: 'Nest Tender', faction: 'primal', tier: 1, role: 'Worker',
    maxHp: 65, primaryCost: 50, advancedCost: 0, supply: 1,
    damage: 4, attackRange: 20, attackRate: 0.5, moveSpeed: 95,
    isHero: false, isWorker: true, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: [], producedAt: ['primal_nest'], requirements: [],
    color: 0xaa6600, radius: 8, shape: 'circle',
  },
  raptor: {
    key: 'raptor', name: 'Raptor', faction: 'primal', tier: 1, role: 'Fast Melee Pack',
    maxHp: 60, primaryCost: 50, advancedCost: 0, supply: 1,
    damage: 10, attackRange: 28, attackRate: 1.3, moveSpeed: 155,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: [], producedAt: ['primal_nest'], requirements: [],
    color: 0xcc7700, radius: 9, shape: 'circle',
  },
  tyrant_rex: {
    key: 'tyrant_rex', name: 'Tyrant Rex', faction: 'primal', tier: 3, role: 'Apex Predator',
    maxHp: 380, primaryCost: 300, advancedCost: 150, supply: 8,
    damage: 38, attackRange: 60, attackRate: 0.5, moveSpeed: 110,
    isHero: false, isWorker: false, isTransport: false, cargoSlots: 0, isAir: false,
    abilities: ['trample', 'frenzy_bite'], producedAt: ['primal_apex_den'], requirements: ['primal_apex_den'],
    color: 0x883300, radius: 20, shape: 'rect',
  },
};

// ─── ALL UNITS MERGED ─────────────────────────────────────────────────────────

export const ALL_UNITS: Record<string, UnitConfig> = {
  ...MAFIA_UNITS,
  ...SPIDER_UNITS,
  ...TIMECORE_UNITS,
  ...VERDANT_UNITS,
  ...PRIMAL_UNITS,
};

// ─── MAFIA BUILDINGS ──────────────────────────────────────────────────────────

export const MAFIA_BUILDINGS: Record<string, BuildingConfig> = {
  mafia_hq: {
    key: 'mafia_hq', name: 'The Family HQ', faction: 'mafia', tier: 1,
    primaryCost: 0, advancedCost: 0, maxHp: 1000,
    supplyProvided: 10, isHQ: true, isExtraction: false, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 0, canDetect: false,
    width: 96, height: 80,
    color: 0xffd700,
    produces: ['associate', 'street_thug', 'soldier', 'lookout', 'tony'],
  },
  mafia_contraband_den: {
    key: 'mafia_contraband_den', name: 'Contraband Den', faction: 'mafia', tier: 1,
    primaryCost: 100, advancedCost: 0, maxHp: 400,
    supplyProvided: 0, isHQ: false, isExtraction: true, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 30, canDetect: false,
    width: 64, height: 56,
    color: 0x993300,
    produces: [],
    builtBy: ['associate'],
  },
  mafia_barracks: {
    key: 'mafia_barracks', name: 'Crew Barracks', faction: 'mafia', tier: 2,
    primaryCost: 150, advancedCost: 50, maxHp: 600,
    supplyProvided: 0, isHQ: false, isExtraction: false, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 45, canDetect: false,
    width: 80, height: 64,
    color: 0xcc5500,
    produces: ['gangster', 'launderer', 'enforcer', 'arsonist'],
    builtBy: ['associate'],
  },
  mafia_garage: {
    key: 'mafia_garage', name: 'Garage', faction: 'mafia', tier: 2,
    primaryCost: 200, advancedCost: 75, maxHp: 500,
    supplyProvided: 0, isHQ: false, isExtraction: false, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 40, canDetect: false,
    width: 80, height: 64,
    color: 0x334455,
    produces: ['suv_crew'],
  },
  mafia_supply_depot: {
    key: 'mafia_supply_depot', name: 'Supply Depot', faction: 'mafia', tier: 1,
    primaryCost: 100, advancedCost: 0, maxHp: 500,
    supplyProvided: 16, isHQ: false, isExtraction: false, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 20, canDetect: false,
    width: 64, height: 48,
    color: 0x888855,
    produces: [],
  },
  mafia_watchtower: {
    key: 'mafia_watchtower', name: 'Speakeasy Watchtower', faction: 'mafia', tier: 1,
    primaryCost: 120, advancedCost: 30, maxHp: 350,
    supplyProvided: 0, isHQ: false, isExtraction: false, isTower: true,
    towerRange: 280, towerDamage: 12, towerAttackRate: 1.0,
    buildTime: 25, canDetect: true,
    width: 48, height: 48,
    color: 0x666633,
    produces: [],
  },
  mafia_underboss_hall: {
    key: 'mafia_underboss_hall', name: 'Underboss Hall', faction: 'mafia', tier: 3,
    primaryCost: 300, advancedCost: 150, maxHp: 700,
    supplyProvided: 0, isHQ: false, isExtraction: false, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 60, canDetect: false,
    width: 96, height: 80,
    color: 0xddaa00,
    produces: ['caporegime', 'assassin', 'armored_heist_car'],
  },
};

// ─── SPIDER BUILDINGS ─────────────────────────────────────────────────────────

export const SPIDER_BUILDINGS: Record<string, BuildingConfig> = {
  spider_hive: {
    key: 'spider_hive', name: 'Brood Hive', faction: 'spider', tier: 1,
    primaryCost: 0, advancedCost: 0, maxHp: 1000,
    supplyProvided: 10, isHQ: true, isExtraction: false, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 0, canDetect: false,
    width: 96, height: 80, color: 0x9900cc,
    produces: ['brood_tender', 'webling', 'skitterer', 'spider_hero'],
  },
  spider_essence_sac: {
    key: 'spider_essence_sac', name: 'Essence Sac', faction: 'spider', tier: 1,
    primaryCost: 100, advancedCost: 0, maxHp: 400,
    supplyProvided: 0, isHQ: false, isExtraction: true, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 30, canDetect: false,
    width: 64, height: 56, color: 0x660099, produces: [],
    builtBy: ['brood_tender'],
  },
  spider_supply_web: {
    key: 'spider_supply_web', name: 'Supply Web', faction: 'spider', tier: 1,
    primaryCost: 100, advancedCost: 0, maxHp: 400,
    supplyProvided: 16, isHQ: false, isExtraction: false, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 20, canDetect: false,
    width: 64, height: 48, color: 0xaa88cc, produces: [],
  },
  spider_trapdoor_den: {
    key: 'spider_trapdoor_den', name: 'Trapdoor Spider Den', faction: 'spider', tier: 1,
    primaryCost: 120, advancedCost: 30, maxHp: 350,
    supplyProvided: 0, isHQ: false, isExtraction: false, isTower: true,
    towerRange: 160, towerDamage: 18, towerAttackRate: 0.4,
    buildTime: 25, canDetect: false,
    width: 48, height: 48, color: 0x553366, produces: [],
  },
  spider_web_spire: {
    key: 'spider_web_spire', name: 'Web Spire', faction: 'spider', tier: 2,
    primaryCost: 150, advancedCost: 50, maxHp: 300,
    supplyProvided: 0, isHQ: false, isExtraction: false, isTower: true,
    towerRange: 250, towerDamage: 8, towerAttackRate: 0.8,
    buildTime: 30, canDetect: false,
    width: 40, height: 56, color: 0x9966bb, produces: [],
  },
  spider_burrow: {
    key: 'spider_burrow', name: 'Brood Burrow', faction: 'spider', tier: 2,
    primaryCost: 150, advancedCost: 50, maxHp: 500,
    supplyProvided: 0, isHQ: false, isExtraction: false, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 40, canDetect: false,
    width: 80, height: 64, color: 0x7722aa, produces: ['web_spitter'],
    builtBy: ['brood_tender'],
  },
  spider_queen_chamber: {
    key: 'spider_queen_chamber', name: "Queen's Chamber", faction: 'spider', tier: 3,
    primaryCost: 300, advancedCost: 150, maxHp: 800,
    supplyProvided: 0, isHQ: false, isExtraction: false, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 60, canDetect: false,
    width: 96, height: 80, color: 0x550088, produces: ['web_beast'],
  },
};

// ─── TIME CORE BUILDINGS ──────────────────────────────────────────────────────

export const TIMECORE_BUILDINGS: Record<string, BuildingConfig> = {
  time_nexus: {
    key: 'time_nexus', name: 'Time Nexus', faction: 'timecore', tier: 1,
    primaryCost: 0, advancedCost: 0, maxHp: 1200,
    supplyProvided: 10, isHQ: true, isExtraction: false, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 0, canDetect: false,
    width: 96, height: 80, color: 0x00aacc,
    produces: ['chrono_harvester', 'time_fragment', 'time_anchor'],
  },
  time_chrono_extractor: {
    key: 'time_chrono_extractor', name: 'Chrono Extractor', faction: 'timecore', tier: 1,
    primaryCost: 100, advancedCost: 0, maxHp: 400,
    supplyProvided: 0, isHQ: false, isExtraction: true, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 30, canDetect: false,
    width: 64, height: 56, color: 0x004488, produces: [],
    builtBy: ['chrono_harvester'],
  },
  time_supply_relay: {
    key: 'time_supply_relay', name: 'Supply Relay', faction: 'timecore', tier: 1,
    primaryCost: 100, advancedCost: 0, maxHp: 400,
    supplyProvided: 16, isHQ: false, isExtraction: false, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 20, canDetect: false,
    width: 64, height: 48, color: 0x005577, produces: [],
  },
  time_prism_tower: {
    key: 'time_prism_tower', name: 'Chrono Prism Tower', faction: 'timecore', tier: 1,
    primaryCost: 130, advancedCost: 40, maxHp: 400,
    supplyProvided: 0, isHQ: false, isExtraction: false, isTower: true,
    towerRange: 300, towerDamage: 14, towerAttackRate: 0.9,
    buildTime: 25, canDetect: true,
    width: 48, height: 64, color: 0x0099bb, produces: [],
  },
  time_forge: {
    key: 'time_forge', name: 'Time Forge', faction: 'timecore', tier: 2,
    primaryCost: 200, advancedCost: 100, maxHp: 600,
    supplyProvided: 0, isHQ: false, isExtraction: false, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 45, canDetect: false,
    width: 80, height: 64, color: 0x0077aa, produces: ['cryo_enforcer'],
    builtBy: ['chrono_harvester'],
  },
  time_citadel: {
    key: 'time_citadel', name: 'Time Citadel', faction: 'timecore', tier: 3,
    primaryCost: 350, advancedCost: 200, maxHp: 1000,
    supplyProvided: 0, isHQ: false, isExtraction: false, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 70, canDetect: false,
    width: 96, height: 80, color: 0x003388, produces: ['chrono_tank'],
  },
};

// ─── VERDANT PLAGUE BUILDINGS ─────────────────────────────────────────────────

export const VERDANT_BUILDINGS: Record<string, BuildingConfig> = {
  verdant_mycelium: {
    key: 'verdant_mycelium', name: 'Mycelium Core', faction: 'verdant', tier: 1,
    primaryCost: 0, advancedCost: 0, maxHp: 1000,
    supplyProvided: 10, isHQ: true, isExtraction: false, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 0, canDetect: false,
    width: 96, height: 80, color: 0x228833,
    produces: ['spore_tender', 'sproutling', 'bloom_tyrant'],
  },
  verdant_spore_extractor: {
    key: 'verdant_spore_extractor', name: 'Spore Extractor', faction: 'verdant', tier: 1,
    primaryCost: 100, advancedCost: 0, maxHp: 400,
    supplyProvided: 0, isHQ: false, isExtraction: true, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 30, canDetect: false,
    width: 64, height: 56, color: 0x116622, produces: [],
    builtBy: ['spore_tender'],
  },
  verdant_supply_root: {
    key: 'verdant_supply_root', name: 'Supply Root', faction: 'verdant', tier: 1,
    primaryCost: 100, advancedCost: 0, maxHp: 400,
    supplyProvided: 16, isHQ: false, isExtraction: false, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 20, canDetect: false,
    width: 64, height: 48, color: 0x448833, produces: [],
  },
  verdant_spore_tower: {
    key: 'verdant_spore_tower', name: 'Mushroom Spore Tower', faction: 'verdant', tier: 1,
    primaryCost: 120, advancedCost: 30, maxHp: 350,
    supplyProvided: 0, isHQ: false, isExtraction: false, isTower: true,
    towerRange: 260, towerDamage: 6, towerAttackRate: 0.5,
    buildTime: 25, canDetect: false,
    width: 48, height: 64, color: 0x55bb22, produces: [],
  },
  verdant_sporarium: {
    key: 'verdant_sporarium', name: 'Sporarium', faction: 'verdant', tier: 3,
    primaryCost: 300, advancedCost: 150, maxHp: 700,
    supplyProvided: 0, isHQ: false, isExtraction: false, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 60, canDetect: false,
    width: 96, height: 80, color: 0x116611, produces: ['plague_behemoth'],
    builtBy: ['spore_tender'],
  },
};

// ─── PRIMAL DOMINION BUILDINGS ────────────────────────────────────────────────

export const PRIMAL_BUILDINGS: Record<string, BuildingConfig> = {
  primal_nest: {
    key: 'primal_nest', name: 'Primal Nest', faction: 'primal', tier: 1,
    primaryCost: 0, advancedCost: 0, maxHp: 1100,
    supplyProvided: 10, isHQ: true, isExtraction: false, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 0, canDetect: false,
    width: 96, height: 80, color: 0xcc7700,
    produces: ['nest_tender', 'raptor', 'apex_alpha'],
  },
  primal_instinct_pit: {
    key: 'primal_instinct_pit', name: 'Instinct Pit', faction: 'primal', tier: 1,
    primaryCost: 100, advancedCost: 0, maxHp: 400,
    supplyProvided: 0, isHQ: false, isExtraction: true, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 30, canDetect: false,
    width: 64, height: 56, color: 0x884400, produces: [],
    builtBy: ['nest_tender'],
  },
  primal_supply_burrow: {
    key: 'primal_supply_burrow', name: 'Supply Burrow', faction: 'primal', tier: 1,
    primaryCost: 100, advancedCost: 0, maxHp: 500,
    supplyProvided: 16, isHQ: false, isExtraction: false, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 20, canDetect: false,
    width: 64, height: 48, color: 0x995500, produces: [],
  },
  primal_bone_spire: {
    key: 'primal_bone_spire', name: 'Bone Spire', faction: 'primal', tier: 1,
    primaryCost: 120, advancedCost: 30, maxHp: 400,
    supplyProvided: 0, isHQ: false, isExtraction: false, isTower: true,
    towerRange: 270, towerDamage: 14, towerAttackRate: 0.8,
    buildTime: 25, canDetect: false,
    width: 40, height: 64, color: 0xddbb77, produces: [],
  },
  primal_apex_den: {
    key: 'primal_apex_den', name: 'Apex Den', faction: 'primal', tier: 3,
    primaryCost: 300, advancedCost: 150, maxHp: 800,
    supplyProvided: 0, isHQ: false, isExtraction: false, isTower: false,
    towerRange: 0, towerDamage: 0, towerAttackRate: 0,
    buildTime: 60, canDetect: false,
    width: 96, height: 80, color: 0x993300, produces: ['tyrant_rex'],
    builtBy: ['nest_tender'],
  },
};

// ─── ALL BUILDINGS MERGED ─────────────────────────────────────────────────────

export const ALL_BUILDINGS: Record<string, BuildingConfig> = {
  ...MAFIA_BUILDINGS,
  ...SPIDER_BUILDINGS,
  ...TIMECORE_BUILDINGS,
  ...VERDANT_BUILDINGS,
  ...PRIMAL_BUILDINGS,
};

// ─── HERO REPURCHASE COSTS ────────────────────────────────────────────────────

export const HERO_REPURCHASE: Record<string, { primary: number; advanced: number }> = {
  tony:         { primary: 300, advanced: 200 },
  spider_hero:  { primary: 275, advanced: 200 },
  time_anchor:  { primary: 350, advanced: 250 },
  bloom_tyrant: { primary: 300, advanced: 200 },
  apex_alpha:   { primary: 325, advanced: 200 },
};

export const HERO_REPURCHASE_COOLDOWN = 60; // seconds after Tier 3

// ─── FACTION HEROES ───────────────────────────────────────────────────────────

export const FACTION_HERO: Record<string, string> = {
  mafia:    'tony',
  spider:   'spider_hero',
  timecore: 'time_anchor',
  verdant:  'bloom_tyrant',
  primal:   'apex_alpha',
};

// ─── WORKER BUILD MENUS ───────────────────────────────────────────────────────
// Maps each worker unit key to [economy building key, military building key].
// Index 0 = hotkey 1 (economy), index 1 = hotkey 2 (military).

export const WORKER_BUILD_MENU: Record<string, [string, string]> = {
  associate:        ['mafia_contraband_den',    'mafia_barracks'],
  brood_tender:     ['spider_essence_sac',       'spider_burrow'],
  chrono_harvester: ['time_chrono_extractor',    'time_forge'],
  spore_tender:     ['verdant_spore_extractor',  'verdant_sporarium'],
  nest_tender:      ['primal_instinct_pit',       'primal_apex_den'],
};

// Production times (in seconds) based on cost
export function calcProductionTime(primaryCost: number, advancedCost: number): number {
  return Math.max(8, Math.floor((primaryCost + advancedCost * 2) / 12));
}
