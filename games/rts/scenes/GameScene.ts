import Phaser from 'phaser';

import { Unit, createUnit } from '../game/Unit.js';
import { Building, createBuilding } from '../game/Building.js';
import { ResourceNode } from '../game/ResourceNode.js';
import { buildMap } from '../game/Map.js';
import { Renderer } from '../game/Renderer.js';
import { InputHandler } from '../game/InputHandler.js';
import {
  updateCombat,
  updateMovement,
  updateResources,
  updateProduction,
  updateStatusEffects,
  updateHeroAuras,
  recalcSupply,
  updateHeroState,
  updateAI,
  updateConstruction,
  triggerFirebomb,
  triggerLoseYourTemper,
  updateTonyAbilities,
  type WorldState,
  type ProjectileRequest,
  type ZoneRequest,
  type SpawnRequest,
} from '../game/Systems.js';
import { ALL_UNITS, ALL_BUILDINGS, FACTION_HERO, HERO_REPURCHASE, WORKER_BUILD_MENU, calcProductionTime } from '../config/index.js';
import type { GameState, Notification } from '../types/index.js';
import { UnitSpriteManager } from '../sprites/UnitSpriteManager.js';
import { registerMafiaFrames } from '../sprites/MafiaAtlas.js';
import { registerFactionFrames } from '../sprites/FactionAtlas.js';
import { registerTerrainFrames, TERRAIN_GROUND_FRAMES } from '../sprites/TerrainAtlas.js';
import { ResourceNodeManager } from '../sprites/ResourceNodeManager.js';

const PLAYER_FACTION: string = 'mafia';
const ENEMY_FACTION:  string = 'spider';

export class GameScene extends Phaser.Scene {
  // World entities
  private playerUnits: Unit[] = [];
  private enemyUnits:  Unit[] = [];
  private playerBuildings: Building[] = [];
  private enemyBuildings:  Building[] = [];
  private allNodes: ResourceNode[] = [];

  // Systems — renamed to avoid Phaser.Scene property conflicts
  private gfxRenderer!: Renderer;
  private ih!: InputHandler;
  private spriteManager!: UnitSpriteManager;
  private nodeManager!: ResourceNodeManager;

  // Persistent cross-frame arrays for system communication
  private projRequests: ProjectileRequest[] = [];
  private zoneRequests: ZoneRequest[] = [];
  private spawnRequests: SpawnRequest[] = [];

  // Selection
  private selectedUnits: Unit[] = [];
  private selectedBuilding: Building | null = null;

  // Enemy passive resource pool
  private enemyIncomeTimer = 0;

  // Game state
  private gameState: GameState = {
    resources: { primary: 400, advanced: 0 },
    supply: 0,
    maxSupply: 10,
    techTier: 1,
    heroAlive: true,
    heroRepurchasable: false,
    heroRepurchaseCooldown: 0,
  };

  private notifications: Notification[] = [];

  // Input state
  private isMouseDown = false;
  private mouseDragStart = { x: 0, y: 0 };
  private attackMoveTargetPos: { x: number; y: number } | null = null;
  private buildPlacementKey: string | null = null;
  private buildPlacementPos: { x: number; y: number; key: string } | null = null;
  private firebombCasterUnit: Unit | null = null;

  // Control groups
  private ctrlGroups = new Map<number, Unit[]>();

  constructor() { super({ key: 'GameScene' }); }

  create(): void {
    this.cameras.main.setBounds(0, 0, 6400, 6400);
    this.cameras.main.setZoom(0.7);

    // ── Register all sprite atlas frames ─────────────────────────────────────
    registerMafiaFrames(this.textures);
    registerFactionFrames(this.textures);
    registerTerrainFrames(this.textures);

    // ── Ground tile background (TileSprite, depth -1) ────────────────────────
    const groundFrame = TERRAIN_GROUND_FRAMES[
      Math.floor(Math.random() * TERRAIN_GROUND_FRAMES.length)
    ]!;
    const groundTile = this.add.tileSprite(3200, 3200, 6400, 6400, 'terrain', groundFrame);
    groundTile.setDepth(-1);

    // ── Depth layers ─────────────────────────────────────────────────────────
    //   -1          ground tile (TileSprite)
    //   55          resource node sprites
    //   unit.y+100  unit sprites (~100–6600)
    //   10000       HP bars, selection rings, overlays (Graphics)
    const graphics = this.add.graphics();
    graphics.setDepth(10000);
    this.gfxRenderer = new Renderer(graphics);
    this.ih = new InputHandler(this);
    this.spriteManager = new UnitSpriteManager(this);
    this.nodeManager   = new ResourceNodeManager(this);

    this.setupWorld();

    this.cameras.main.scrollX = 200;
    this.cameras.main.scrollY = 5000;

    this.bindInput();

    this.scene.launch('UIScene');
    (window as any).__rtsGameScene = this;
  }

  // ─── World setup ─────────────────────────────────────────────────────────────

  private setupWorld(): void {
    const map = buildMap();
    this.allNodes = [...map.playerNodes, ...map.enemyNodes, ...map.neutralNodes];

    // Player base
    const playerHQ = createBuilding('mafia_hq', map.playerBaseX, map.playerBaseY, 'player');
    this.playerBuildings.push(playerHQ);

    const heroKey = FACTION_HERO[PLAYER_FACTION] ?? 'tony';
    const hero = createUnit(heroKey, map.playerBaseX + 120, map.playerBaseY - 60, 'player');
    hero.homeBase = { x: playerHQ.x, y: playerHQ.y };
    this.playerUnits.push(hero);

    for (let i = 0; i < 4; i++) {
      const w = createUnit('associate', map.playerBaseX + (i - 2) * 40, map.playerBaseY + 80, 'player');
      w.homeBase = { x: playerHQ.x, y: playerHQ.y };
      this.playerUnits.push(w);
    }
    for (let i = 0; i < 2; i++) {
      const t = createUnit('street_thug', map.playerBaseX + (i - 1) * 40 + 160, map.playerBaseY - 20, 'player');
      t.homeBase = { x: playerHQ.x, y: playerHQ.y };
      this.playerUnits.push(t);
    }

    recalcSupply(this.buildWorldState());

    // Enemy base (Spider faction)
    const enemyHQ = createBuilding('spider_hive', map.enemyBaseX, map.enemyBaseY, 'enemy');
    this.enemyBuildings.push(enemyHQ);
    const enemySupply = createBuilding('spider_supply_web', map.enemyBaseX + 160, map.enemyBaseY + 40, 'enemy');
    this.enemyBuildings.push(enemySupply);

    const enemyHeroKey = FACTION_HERO[ENEMY_FACTION] ?? 'spider_hero';
    const enemyHero = createUnit(enemyHeroKey, map.enemyBaseX - 100, map.enemyBaseY + 80, 'enemy');
    this.enemyUnits.push(enemyHero);

    for (let i = 0; i < 4; i++) {
      const ew = createUnit('brood_tender', map.enemyBaseX + (i - 2) * 40, map.enemyBaseY + 100, 'enemy');
      ew.homeBase = { x: enemyHQ.x, y: enemyHQ.y };
      this.enemyUnits.push(ew);
    }

    // Assign workers to starting resources
    const primaryNodes = map.playerNodes.filter(n => n.type === 'primary');
    const workers = this.playerUnits.filter(u => u.config.isWorker);
    for (let i = 0; i < workers.length; i++) {
      const node = primaryNodes[i % primaryNodes.length];
      if (node) {
        workers[i]!.gatherTarget = { x: node.x, y: node.y, id: node.id, type: 'primary' };
        workers[i]!.state = 'gathering';
        node.assignWorker(workers[i]!.id);
      }
    }

    const enemyPrimary = map.enemyNodes.filter(n => n.type === 'primary');
    const enemyWorkers = this.enemyUnits.filter(u => u.config.isWorker);
    for (let i = 0; i < enemyWorkers.length; i++) {
      const node = enemyPrimary[i % enemyPrimary.length];
      if (node) {
        enemyWorkers[i]!.gatherTarget = { x: node.x, y: node.y, id: node.id, type: 'primary' };
        enemyWorkers[i]!.state = 'gathering';
        node.assignWorker(enemyWorkers[i]!.id);
      }
    }
  }

  // ─── Input Bindings ───────────────────────────────────────────────────────────

  private bindInput(): void {
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (ptr.rightButtonDown()) return;
      const wx = ptr.worldX;
      const wy = ptr.worldY;
      this.isMouseDown = true;
      this.mouseDragStart = { x: wx, y: wy };
      this.ih.startSelectionBox(wx, wy);
    });

    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      this.ih.updateSelectionBox(ptr.worldX, ptr.worldY);
      if (this.buildPlacementKey) {
        this.buildPlacementPos = { x: ptr.worldX, y: ptr.worldY, key: this.buildPlacementKey };
      }
    });

    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (ptr.rightButtonDown()) return;
      const wx = ptr.worldX;
      const wy = ptr.worldY;
      this.ih.endSelectionBox();
      this.isMouseDown = false;

      const dragDist = Math.hypot(wx - this.mouseDragStart.x, wy - this.mouseDragStart.y);
      if (dragDist > 10) {
        const rect = this.ih.getSelectionRect();
        if (rect) {
          const inBox = this.ih.getUnitsInSelectionBox(this.playerUnits, rect);
          if (inBox.length > 0) {
            this.selectedUnits = inBox.filter(u => u.isAlive);
            this.selectedBuilding = null;
          }
        }
      } else {
        this.handleLeftClick(wx, wy, ptr.event as PointerEvent);
      }
    });

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.rightButtonDown()) return;
      this.handleRightClick(ptr.worldX, ptr.worldY);
    });

    this.game.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      this.ih.handleZoom(e);
    }, { passive: false });

    const kb = this.input.keyboard!;

    kb.on('keydown-A', () => {
      if (this.selectedUnits.length > 0) this.ih.queueAttackMove();
    });
    kb.on('keydown-S', () => {
      for (const u of this.selectedUnits) u.stopMoving();
      this.ih.clearAttackMove();
    });
    kb.on('keydown-F', () => {
      const arsonist = this.selectedUnits.find(u => u.config.key === 'arsonist');
      if (arsonist) { this.firebombCasterUnit = arsonist; this.ih.queueFirebomb(); }
    });
    kb.on('keydown-T', () => {
      const tony = this.selectedUnits.find(u => u.config.key === 'tony');
      if (tony) triggerLoseYourTemper(tony);
    });
    kb.on('keydown-G', () => { this.upgradeTier(); });
    kb.on('keydown-R', () => {
      if (this.gameState.heroRepurchasable) this.repurchaseHero();
    });
    kb.on('keydown-ESC', () => {
      this.selectedUnits = [];
      this.selectedBuilding = null;
      this.buildPlacementKey = null;
      this.buildPlacementPos = null;
      this.ih.clearAttackMove();
      this.ih.clearFirebomb();
    });

    // Building hotkeys B+1..2 (faction-aware: requires a worker selected)
    // 1 = economy building, 2 = military building
    kb.on('keydown-B', () => {
      const worker = this.selectedUnits.find(u => u.config.isWorker && u.isAlive);
      if (!worker) return;
      const menu = WORKER_BUILD_MENU[worker.config.key];
      if (!menu) return;
      (this as any)._buildMenu = menu;
      (this as any)._buildMenuOpen = true;
      setTimeout(() => {
        (this as any)._buildMenuOpen = false;
        (this as any)._buildMenu = null;
      }, 1500);
    });
    for (let i = 1; i <= 2; i++) {
      const idx = i - 1;
      kb.on(`keydown-${i}`, () => {
        if ((this as any)._buildMenuOpen) {
          const menu: string[] | undefined = (this as any)._buildMenu;
          const key = menu?.[idx];
          if (key) {
            this.buildPlacementKey = key;
            (this as any)._buildMenuOpen = false;
            (this as any)._buildMenu = null;
          }
        }
      });
    }

    // Ctrl+1..9 control groups
    for (let i = 1; i <= 9; i++) {
      const num = i;
      kb.on(`keydown-${num}`, (event: KeyboardEvent) => {
        if (event.ctrlKey) {
          this.ctrlGroups.set(num, [...this.selectedUnits]);
        } else if (!event.ctrlKey && !(this as any)._buildMenuOpen) {
          const g = this.ctrlGroups.get(num);
          if (g) { this.selectedUnits = g.filter(u => u.isAlive); this.selectedBuilding = null; }
        }
      });
    }
  }

  // ─── Click Handling ───────────────────────────────────────────────────────────

  private handleLeftClick(wx: number, wy: number, event: PointerEvent): void {
    if (this.buildPlacementKey && this.buildPlacementPos) {
      this.placeBuilding(this.buildPlacementKey, wx, wy);
      this.buildPlacementKey = null;
      this.buildPlacementPos = null;
      return;
    }

    if (this.ih.getAttackMoveQueued()) {
      this.attackMoveTargetPos = { x: wx, y: wy };
      for (const u of this.selectedUnits) {
        u.state = 'moving'; u.isAttackMoveOrder = true; u.targetPos = { x: wx, y: wy };
      }
      this.ih.clearAttackMove();
      setTimeout(() => { this.attackMoveTargetPos = null; }, 800);
      return;
    }

    if (this.ih.getFirebombQueued() && this.firebombCasterUnit?.isAlive) {
      triggerFirebomb(this.firebombCasterUnit, wx, wy, this.buildWorldState());
      this.firebombCasterUnit = null;
      this.ih.clearFirebomb();
      return;
    }

    const clickedUnit = this.ih.getUnitAtPoint(this.playerUnits, wx, wy, 18);
    if (clickedUnit) {
      if (event.shiftKey) {
        const idx = this.selectedUnits.findIndex(u => u.id === clickedUnit.id);
        if (idx >= 0) this.selectedUnits.splice(idx, 1);
        else this.selectedUnits.push(clickedUnit);
      } else {
        this.selectedUnits = [clickedUnit];
        this.selectedBuilding = null;
      }
      return;
    }

    const clickedBuilding = this.ih.getBuildingAtPoint(this.playerBuildings, wx, wy);
    if (clickedBuilding) {
      this.selectedBuilding = clickedBuilding;
      this.selectedUnits = [];
      return;
    }

    if (!event.shiftKey) {
      this.selectedUnits = [];
      this.selectedBuilding = null;
    }
  }

  private handleRightClick(wx: number, wy: number): void {
    if (this.selectedUnits.length === 0) return;

    const enemyUnit = this.ih.getUnitAtPoint(this.enemyUnits, wx, wy, 18);
    if (enemyUnit) {
      for (const u of this.selectedUnits) {
        u.attackTarget = enemyUnit; u.state = 'attacking';
        u.isAttackMoveOrder = false; u.targetPos = { x: enemyUnit.x, y: enemyUnit.y };
      }
      return;
    }

    const enemyBuilding = this.ih.getBuildingAtPoint(this.enemyBuildings, wx, wy);
    if (enemyBuilding) {
      for (const u of this.selectedUnits) {
        u.state = 'moving'; u.isAttackMoveOrder = true;
        u.targetPos = { x: enemyBuilding.x, y: enemyBuilding.y };
      }
      return;
    }

    const node = this.ih.getResourceAtPoint(this.allNodes, wx, wy, 28);
    if (node && this.selectedUnits.some(u => u.config.isWorker)) {
      for (const u of this.selectedUnits) {
        if (!u.config.isWorker) continue;
        if (u.gatherTarget) {
          const prev = this.allNodes.find(n => n.id === u.gatherTarget!.id);
          prev?.removeWorker(u.id);
        }
        u.gatherTarget = { x: node.x, y: node.y, id: node.id, type: node.type };
        u.state = 'gathering'; u.targetPos = { x: node.x, y: node.y };
        node.assignWorker(u.id);
      }
      return;
    }

    // Transport unload
    const transport = this.selectedUnits.find(u => u.config.isTransport);
    if (transport && transport.cargo.length > 0) {
      const unloaded = transport.cargo.splice(0);
      for (let i = 0; i < unloaded.length; i++) {
        const u = unloaded[i]!;
        u.state = 'idle';
        u.x = wx + (i - unloaded.length / 2) * 30;
        u.y = wy + 20;
        this.playerUnits.push(u);
      }
      return;
    }

    this.issueFormationMove(this.selectedUnits, wx, wy);
  }

  private issueFormationMove(units: Unit[], cx: number, cy: number): void {
    const cols = Math.ceil(Math.sqrt(units.length));
    for (let i = 0; i < units.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      units[i]!.state = 'moving';
      units[i]!.isAttackMoveOrder = false;
      units[i]!.attackTarget = null;
      units[i]!.targetPos = {
        x: cx + (col - cols / 2) * 30,
        y: cy + row * 30,
      };
    }
  }

  // ─── Building Placement ───────────────────────────────────────────────────────

  startBuildingPlacement(key: string): void { this.buildPlacementKey = key; }

  private placeBuilding(key: string, wx: number, wy: number): void {
    const cfg = ALL_BUILDINGS[key];
    if (!cfg) return;

    if (this.gameState.resources.primary  < cfg.primaryCost ||
        this.gameState.resources.advanced < cfg.advancedCost) {
      this.notify('Not enough resources!', 'warning'); return;
    }

    let newBuilding: ReturnType<typeof createBuilding>;

    if (cfg.isExtraction) {
      const node = this.allNodes.find(n =>
        n.type === 'advanced' && Math.hypot(n.x - wx, n.y - wy) < 50 && n.extractionBuildingId === null,
      );
      if (!node) { this.notify('Must place on a Sporadic Flow node!', 'warning'); return; }
      newBuilding = createBuilding(key, node.x, node.y, 'player');
      node.extractionBuildingId = newBuilding.id;
      newBuilding.extractionNodeId = node.id;
    } else {
      // Simple AABB overlap check against existing buildings
      const hw = cfg.width / 2 + 8;
      const hh = cfg.height / 2 + 8;
      const overlaps = this.playerBuildings.some(b =>
        b.isAlive &&
        Math.abs(b.x - wx) < (b.config.width / 2 + hw) &&
        Math.abs(b.y - wy) < (b.config.height / 2 + hh),
      );
      if (overlaps) { this.notify('Cannot place here — overlaps a building', 'warning'); return; }
      newBuilding = createBuilding(key, wx, wy, 'player');
    }

    this.playerBuildings.push(newBuilding);
    this.gameState.resources.primary  -= cfg.primaryCost;
    this.gameState.resources.advanced -= cfg.advancedCost;

    // Start construction — buildings with buildTime > 0 require a worker
    if (cfg.buildTime > 0) {
      newBuilding.state = 'under_construction';
      const worker = this.selectedUnits.find(u => u.config.isWorker && u.isAlive);
      if (worker) {
        worker.gatherTarget = null;
        worker.buildTarget = { buildingId: newBuilding.id, x: newBuilding.x, y: newBuilding.y };
        worker.state = 'building';
      } else {
        this.notify('Select a worker to construct the building', 'warning');
      }
    }

    recalcSupply(this.buildWorldState());
  }

  // ─── Production ───────────────────────────────────────────────────────────────

  queueProduction(buildingId: string, unitKey: string): void {
    const building = this.playerBuildings.find(b => b.id === buildingId);
    if (!building) return;
    const cfg = ALL_UNITS[unitKey];
    if (!cfg) return;

    if (this.gameState.resources.primary  < cfg.primaryCost ||
        this.gameState.resources.advanced < cfg.advancedCost) {
      this.notify('Not enough resources!', 'warning'); return;
    }
    if (cfg.tier > this.gameState.techTier) {
      this.notify(`Requires Tier ${cfg.tier}`, 'warning'); return;
    }
    const totalTime = calcProductionTime(cfg.primaryCost, cfg.advancedCost);
    if (building.queueUnitWithTime(unitKey, totalTime)) {
      this.gameState.resources.primary  -= cfg.primaryCost;
      this.gameState.resources.advanced -= cfg.advancedCost;
    }
  }

  repurchaseHero(): void {
    if (!this.gameState.heroRepurchasable) return;
    const heroKey = FACTION_HERO[PLAYER_FACTION] ?? 'tony';
    const cost = HERO_REPURCHASE[heroKey];
    if (!cost) return;
    if (this.gameState.resources.primary  < cost.primary ||
        this.gameState.resources.advanced < cost.advanced) {
      this.notify('Not enough resources to repurchase hero!', 'warning'); return;
    }
    const hq = this.playerBuildings.find(b => b.config.isHQ && b.isAlive);
    if (!hq) return;

    this.gameState.resources.primary  -= cost.primary;
    this.gameState.resources.advanced -= cost.advanced;
    const hero = createUnit(heroKey, hq.x + 100, hq.y - 80, 'player');
    hero.homeBase = { x: hq.x, y: hq.y };
    this.playerUnits.push(hero);
    this.gameState.heroAlive = true;
    this.gameState.heroRepurchasable = false;
    this.notify('Hero returned!', 'info');
  }

  upgradeTier(): void {
    if (this.gameState.techTier >= 3) return;
    const costs = [0, 300, 600];
    const cost = costs[this.gameState.techTier] ?? 0;
    if (this.gameState.resources.primary < cost) {
      this.notify('Not enough resources for tech upgrade', 'warning'); return;
    }
    this.gameState.resources.primary -= cost;
    this.gameState.techTier = (this.gameState.techTier + 1) as 1 | 2 | 3;
    this.notify(`Reached Tier ${this.gameState.techTier}!`, 'info');
    if (this.gameState.techTier === 3 && !this.gameState.heroAlive) {
      this.gameState.heroRepurchaseCooldown = 60;
    }
  }

  // ─── Game Loop ────────────────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    // Clear per-frame request buffers
    this.projRequests.length  = 0;
    this.zoneRequests.length  = 0;
    this.spawnRequests.length = 0;

    const world = this.buildWorldState();

    // Input
    this.ih.handleKeyboardInput(delta);
    this.ih.handleEdgeScrolling(delta);

    // Systems
    updateHeroAuras(world, dt);
    updateCombat(world, dt);
    updateMovement(world, dt);
    updateConstruction(world, dt);
    updateResources(world, dt);
    updateProduction(world, dt, (key, x, y) => {
      const u = createUnit(key, x, y, 'player');
      const hq = this.playerBuildings.find(b => b.config.isHQ);
      u.homeBase = hq ? { x: hq.x, y: hq.y } : null;
      this.playerUnits.push(u);
    });
    updateStatusEffects(world, dt);
    updateHeroState(world, dt);
    recalcSupply(world);

    // Enemy passive income
    this.enemyIncomeTimer += dt;
    if (this.enemyIncomeTimer > 2) { this.enemyIncomeTimer = 0; }
    updateAI(world, dt);

    // Resolve spawn requests
    for (const req of this.spawnRequests) {
      const u = createUnit(req.unitKey, req.x, req.y, req.owner);
      (req.owner === 'enemy' ? this.enemyUnits : this.playerUnits).push(u);
    }

    // Resolve projectile requests + apply damage
    for (const req of this.projRequests) {
      this.gfxRenderer.addProjectile(req.fromX, req.fromY, req.toX, req.toY, req.color, req.speed, req.targetId);
      if (req.damage > 0) {
        const target = [...this.playerUnits, ...this.enemyUnits].find(u => u.id === req.targetId);
        target?.takeDamage(req.damage);
      }
    }

    // Resolve zone requests
    for (const req of this.zoneRequests) {
      this.gfxRenderer.addZoneRequest(req);
    }

    // Tony ability tick
    const tony = this.playerUnits.find(u => u.config.key === 'tony' && u.isAlive);
    if (tony) updateTonyAbilities(tony, dt);

    // Prune dead entities (death animation finished)
    this.playerUnits     = this.playerUnits    .filter(u => !(u.isDead     && u.deathTimer <= 0));
    this.enemyUnits      = this.enemyUnits     .filter(u => !(u.isDead     && u.deathTimer <= 0));
    this.playerBuildings = this.playerBuildings.filter(b => !(b.isDead && b.deathTimer <= 0));
    this.enemyBuildings  = this.enemyBuildings .filter(b => !(b.isDead && b.deathTimer <= 0));

    // Clean selection
    this.selectedUnits = this.selectedUnits.filter(u => u.isAlive);
    if (this.selectedBuilding?.isDead) this.selectedBuilding = null;

    // Tick notifications
    for (let i = this.notifications.length - 1; i >= 0; i--) {
      this.notifications[i]!.ttl -= dt;
      if (this.notifications[i]!.ttl <= 0) this.notifications.splice(i, 1);
    }

    // Update resource node sprites
    this.nodeManager.update(delta, this.allNodes);

    // Update unit sprites
    this.spriteManager.update(delta, [...this.playerUnits, ...this.enemyUnits]);

    // Render overlays (HP bars, selection, status effects, zones, terrain, etc.)
    this.gfxRenderer.update(
      delta,
      world,
      this.selectedUnits,
      this.ih.getSelectionBox(),
      this.buildPlacementPos,
      this.allNodes,
      this.attackMoveTargetPos,
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private buildWorldState(): WorldState {
    return {
      playerUnits:      this.playerUnits,
      enemyUnits:       this.enemyUnits,
      playerBuildings:  this.playerBuildings,
      enemyBuildings:   this.enemyBuildings,
      allNodes:         this.allNodes,
      gameState:        this.gameState,
      playerFaction:    PLAYER_FACTION,
      notifications:    this.notifications,
      projectileRequests: this.projRequests,
      zoneRequests:     this.zoneRequests,
      spawnRequests:    this.spawnRequests,
    };
  }

  private notify(message: string, type: Notification['type']): void {
    this.notifications.push({ message, type, ttl: 3 });
  }

  // ─── Public API (UIScene reads these) ────────────────────────────────────────

  getGameState(): GameState        { return this.gameState; }
  getSelectedUnits(): Unit[]       { return this.selectedUnits; }
  getSelectedBuilding(): Building | null { return this.selectedBuilding; }
  getNotifications(): Notification[] { return this.notifications; }
  getPlayerFaction(): string       { return PLAYER_FACTION; }
  getAllNodes(): ResourceNode[]     { return this.allNodes; }
  getPlayerBuildings(): Building[] { return this.playerBuildings; }
  getEnemyUnitCount(): number      { return this.enemyUnits.filter(u => u.isAlive).length; }
  getPlayerUnitCount(): number     { return this.playerUnits.filter(u => u.isAlive).length; }

  /**
   * Returns the active build menu state for the selected worker, or null if
   * no worker is selected. UIScene reads this to render the build menu overlay.
   */
  getBuildMenuState(): { workerKey: string; menu: [string, string]; isOpen: boolean } | null {
    const worker = this.selectedUnits.find(u => u.config.isWorker && u.isAlive);
    if (!worker) return null;
    const menu = WORKER_BUILD_MENU[worker.config.key];
    if (!menu) return null;
    return {
      workerKey: worker.config.key,
      menu,
      isOpen: !!(this as any)._buildMenuOpen,
    };
  }
}
