/**
 * UIScene — always-on HUD overlay rendered in screen-space.
 * Reads game state from the GameScene via window.__rtsGameScene.
 * Communicates commands back via the same reference.
 */

import Phaser from 'phaser';
import type { Building } from '../game/Building.js';
import type { Unit } from '../game/Unit.js';
import { ALL_UNITS, ALL_BUILDINGS, FACTION_RESOURCE_NAMES, WORKER_BUILD_MENU } from '../config/index.js';
import type { Faction } from '../types/index.js';

const COL = {
  PANEL_BG:  0x111122,
  TEXT:      0xeeeeff,
  GOLD:      0xffd700,
  GREEN:     0x22ee44,
  RED:       0xff3333,
  ORANGE:    0xff8800,
  CYAN:      0x00e5ff,
  SUPPLY_OK: 0x22ee44,
  SUPPLY_WARN: 0xffcc00,
  SUPPLY_CAP:  0xff3333,
  BTN_BG:    0x223344,
  BTN_HOV:   0x334455,
  BTN_COST:  0xffaa44,
};

const PAD = 8;

export class UIScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];

  // Bottom panel
  private panelH = 140;

  constructor() { super({ key: 'UIScene' }); }

  create(): void {
    this.gfx = this.add.graphics();
    // UIScene uses screen coords (no camera)
  }

  update(): void {
    const gs = this.getGameScene();
    if (!gs) return;

    this.gfx.clear();
    this.clearTexts();

    const W = this.scale.width;
    const H = this.scale.height;

    this.drawTopBar(gs, W);
    this.drawBottomPanel(gs, W, H);
    this.drawNotifications(gs, W, H);
    this.drawMinimap(gs, W, H);
    this.drawHotkeys(W, H);
  }

  // ─── Top Bar ───────────────────────────────────────────────────────────────

  private drawTopBar(gs: any, W: number): void {
    const state = gs.getGameState();
    const faction: Faction = gs.getPlayerFaction() as Faction;
    const resNames = FACTION_RESOURCE_NAMES[faction];

    // Background
    this.gfx.fillStyle(COL.PANEL_BG, 0.85);
    this.gfx.fillRect(0, 0, W, 34);

    // Primary resource (left)
    const primColor = faction === 'mafia' ? 0x55ff55
      : faction === 'spider' ? 0x88ff88
      : faction === 'timecore' ? 0x00e5ff
      : faction === 'verdant' ? 0x44ee44
      : 0xffcc44;

    this.addText(8, 6, `● ${resNames.primary}: ${Math.floor(state.resources.primary)}`, primColor, '14px');

    // Advanced resource
    const advColor = faction === 'mafia' ? 0xff8844
      : faction === 'spider' ? 0xcc88ff
      : faction === 'timecore' ? 0x8888ff
      : faction === 'verdant' ? 0x88ff44
      : 0xff6600;

    this.addText(220, 6, `◆ ${resNames.advanced}: ${Math.floor(state.resources.advanced)}`, advColor, '14px');

    // Supply
    const supplyCol = state.supply >= state.maxSupply ? COL.SUPPLY_CAP
      : state.supply > state.maxSupply * 0.8 ? COL.SUPPLY_WARN
      : COL.SUPPLY_OK;
    this.addText(440, 6, `⬡ Supply: ${state.supply} / ${state.maxSupply}`, supplyCol, '14px');

    // Tech tier
    const tierLabel = `★ Tier ${state.techTier}`;
    this.addText(600, 6, tierLabel, COL.GOLD, '14px');

    // Unit counts
    const playerCount = gs.getPlayerUnitCount();
    const enemyCount  = gs.getEnemyUnitCount();
    this.addText(720, 6, `⚔ ${playerCount} vs ${enemyCount}`, COL.TEXT, '13px');

    // Hero status
    if (!state.heroAlive) {
      const heroMsg = state.heroRepurchasable
        ? `[R] REPURCHASE HERO`
        : state.techTier < 3
          ? `Hero gone until Tier 3`
          : `Hero cd: ${Math.ceil(state.heroRepurchaseCooldown)}s`;
      this.addText(W - 250, 6, heroMsg, state.heroRepurchasable ? COL.GOLD : COL.RED, '13px');
    }
  }

  // ─── Bottom Panel ─────────────────────────────────────────────────────────

  private drawBottomPanel(gs: any, W: number, H: number): void {
    const panelY = H - this.panelH;
    this.gfx.fillStyle(COL.PANEL_BG, 0.9);
    this.gfx.fillRect(0, panelY, W, this.panelH);
    this.gfx.lineStyle(1, 0x334455, 1);
    this.gfx.lineBetween(0, panelY, W, panelY);

    const selectedUnits: Unit[] = gs.getSelectedUnits();
    const selectedBuilding: Building | null = gs.getSelectedBuilding();

    if (selectedBuilding) {
      this.drawBuildingPanel(gs, selectedBuilding, W, H, panelY);
    } else if (selectedUnits.length === 1) {
      this.drawSingleUnitPanel(selectedUnits[0]!, W, H, panelY);
    } else if (selectedUnits.length > 1) {
      this.drawMultiUnitPanel(selectedUnits, W, H, panelY);
    } else {
      this.drawIdlePanel(gs, W, H, panelY);
    }
  }

  private drawSingleUnitPanel(unit: Unit, W: number, _H: number, panelY: number): void {
    const cfg = unit.config;
    const px = PAD * 2;
    const py = panelY + PAD;

    // Unit shape preview
    this.gfx.fillStyle(cfg.color, 1);
    this.gfx.fillCircle(px + 30, py + 40, 18);
    this.gfx.lineStyle(2, unit.owner === 'player' ? 0x88ff88 : 0xff4444, 1);
    this.gfx.strokeCircle(px + 30, py + 40, 18);

    // Name & role
    this.addText(px + 58, py, `${cfg.name}`, COL.GOLD, '16px');
    this.addText(px + 58, py + 18, cfg.role, COL.TEXT, '12px');
    this.addText(px + 58, py + 34, `Tier ${cfg.tier} — ${cfg.faction.toUpperCase()}`, 0x888899, '11px');

    // HP bar
    const hpPct = unit.hp / cfg.maxHp;
    const barW = 180;
    this.gfx.fillStyle(0x330000, 0.8);
    this.gfx.fillRect(px + 58, py + 50, barW, 8);
    const hpCol = hpPct > 0.6 ? COL.GREEN : hpPct > 0.3 ? COL.ORANGE : COL.RED;
    this.gfx.fillStyle(hpCol, 0.9);
    this.gfx.fillRect(px + 58, py + 50, barW * hpPct, 8);
    this.addText(px + 58, py + 62, `HP: ${Math.ceil(unit.hp)} / ${cfg.maxHp}`, COL.TEXT, '11px');

    // Stats
    const sx = px + 260;
    this.addText(sx, py,      `DMG: ${cfg.damage}`, COL.TEXT, '12px');
    this.addText(sx, py + 16, `RNG: ${cfg.attackRange}`, COL.TEXT, '12px');
    this.addText(sx, py + 32, `SPD: ${cfg.moveSpeed}`, COL.TEXT, '12px');
    this.addText(sx, py + 48, `SUP: ${cfg.supply}`, COL.TEXT, '12px');

    // Status effects
    const seX = px + 400;
    let seY = py;
    for (const se of unit.statusEffects) {
      const seColor = se.type === 'fire' || se.type === 'burning' ? COL.ORANGE
        : se.type === 'web' ? 0xccccaa
        : se.type === 'frozen' ? 0x99ddff
        : se.type === 'infected' ? 0x44ff44
        : COL.TEXT;
      this.addText(seX, seY, `${se.type.toUpperCase()} (${se.remainingDuration.toFixed(1)}s)`, seColor, '11px');
      seY += 15;
    }
    if (unit.webBuildup > 0) {
      this.addText(seX, seY, `WEB: ${unit.webBuildup.toFixed(0)}%`, 0xccccaa, '11px');
    }

    // Abilities (non-workers) or build menu (workers)
    const abX = px + 560;
    if (cfg.isWorker) {
      const gs = this.getGameScene();
      if (gs) this.drawWorkerBuildMenu(gs, unit, W, abX, py, panelY);
    } else if (cfg.abilities.length > 0) {
      this.addText(abX, py, 'ABILITIES:', 0xaaaaaa, '11px');
      cfg.abilities.forEach((ab, i) => {
        this.addText(abX, py + 14 + i * 14, `[${getAbilityHotkey(ab)}] ${ab.replace(/_/g, ' ')}`, 0xdddddd, '11px');
      });
    }
  }

  private drawWorkerBuildMenu(gs: any, unit: Unit, W: number, bx: number, py: number, _panelY: number): void {
    const state = gs.getGameState();
    const menuState: ReturnType<typeof gs.getBuildMenuState> = gs.getBuildMenuState?.() ?? null;

    // If this worker is currently constructing a building, show construction status instead
    if ((unit as any).buildTarget) {
      const buildingId = (unit as any).buildTarget.buildingId;
      const building = gs.getPlayerBuildings().find((b: any) => b.id === buildingId);
      if (building) {
        const prog = Math.floor((building.constructionProgress ?? 0) * 100);
        this.addText(bx, py,      'CONSTRUCTING:', 0xffcc44, '12px');
        this.addText(bx, py + 16, building.config.name, COL.GOLD, '13px');

        const barW = 180;
        this.gfx.fillStyle(0x222222, 0.8);
        this.gfx.fillRect(bx, py + 34, barW, 7);
        this.gfx.fillStyle(0xffcc00, 0.9);
        this.gfx.fillRect(bx, py + 34, barW * (building.constructionProgress ?? 0), 7);
        this.addText(bx, py + 44, `${prog}% complete`, 0xaaaaaa, '11px');
        return;
      }
    }

    // Build menu — always visible when a worker is selected
    const menu = menuState?.menu ?? WORKER_BUILD_MENU[(unit as any).config.key];
    if (!menu) return;

    const isOpen = menuState?.isOpen ?? false;

    if (isOpen) {
      // Active state: B was pressed, waiting for 1 or 2
      this.gfx.fillStyle(0x332200, 0.85);
      this.gfx.fillRect(bx - 4, py - 2, W - bx, 110);
      this.gfx.lineStyle(1, 0xffcc44, 0.8);
      this.gfx.strokeRect(bx - 4, py - 2, W - bx, 110);
      this.addText(bx, py, '─ BUILD MENU ─', 0xffcc44, '12px');
    } else {
      this.addText(bx, py, '[B] BUILD:', 0xaaaaaa, '12px');
    }

    menu.forEach((buildingKey: string, i: number) => {
      const cfg = ALL_BUILDINGS[buildingKey];
      if (!cfg) return;

      const rowY = py + 18 + i * 38;
      const tierLocked = cfg.tier > state.techTier;
      const canAfford = !tierLocked &&
        state.resources.primary  >= cfg.primaryCost &&
        state.resources.advanced >= cfg.advancedCost;

      // Row background (highlighted when menu is open)
      if (isOpen) {
        this.gfx.fillStyle(canAfford ? 0x223311 : 0x221100, 0.7);
        this.gfx.fillRect(bx - 4, rowY - 2, W - bx, 34);
        this.gfx.lineStyle(1, canAfford ? 0x44aa22 : 0x554422, 0.6);
        this.gfx.strokeRect(bx - 4, rowY - 2, W - bx, 34);
      }

      // Hotkey badge
      const hotkeyCol = isOpen ? (canAfford ? 0x88ff44 : 0x886644) : 0x666666;
      this.addText(bx, rowY, `[${i + 1}]`, hotkeyCol, '13px');

      // Building name
      const nameCol = tierLocked ? 0x666655
        : canAfford ? COL.TEXT
        : 0x997755;
      this.addText(bx + 26, rowY, cfg.name, nameCol, isOpen ? '13px' : '12px');

      // Cost
      const costCol = tierLocked ? 0x554433 : canAfford ? COL.BTN_COST : COL.RED;
      const advPart = cfg.advancedCost > 0 ? ` / ${cfg.advancedCost}▲` : '';
      this.addText(bx + 26, rowY + 16, `${cfg.primaryCost}●${advPart}`, costCol, '11px');

      // Tier lock / type badge
      if (tierLocked) {
        this.addText(bx + 130, rowY, `T${cfg.tier} LOCKED`, COL.RED, '10px');
      } else {
        const typeLabel = cfg.isExtraction ? 'ECONOMY' : 'MILITARY';
        const typeCol   = cfg.isExtraction ? COL.CYAN : COL.ORANGE;
        this.addText(bx + 130, rowY, typeLabel, typeCol, '10px');
      }
    });

    if (isOpen) {
      this.addText(bx, py + 18 + menu.length * 38 + 4, 'Press 1 or 2 — ESC to cancel', 0x888877, '10px');
    }
  }

  private drawMultiUnitPanel(units: Unit[], W: number, _H: number, panelY: number): void {
    const maxShow = Math.min(units.length, 16);
    this.addText(PAD * 2, panelY + PAD, `${units.length} units selected`, COL.GOLD, '15px');

    for (let i = 0; i < maxShow; i++) {
      const u = units[i]!;
      const bx = PAD * 2 + i * 52;
      const by = panelY + 28;
      const r = 16;

      this.gfx.fillStyle(u.config.color, 1);
      this.gfx.fillCircle(bx + r, by + r, r);
      this.gfx.lineStyle(1, 0x88ff88, 1);
      this.gfx.strokeCircle(bx + r, by + r, r);

      // HP bar under mini icon
      const hpPct = u.hp / u.config.maxHp;
      this.gfx.fillStyle(0x330000, 1);
      this.gfx.fillRect(bx, by + r * 2 + 3, r * 2, 3);
      this.gfx.fillStyle(hpPct > 0.5 ? COL.GREEN : COL.RED, 1);
      this.gfx.fillRect(bx, by + r * 2 + 3, r * 2 * hpPct, 3);
    }

    if (units.length > maxShow) {
      this.addText(PAD * 2 + maxShow * 52, panelY + 38, `+${units.length - maxShow}`, COL.TEXT, '13px');
    }
  }

  private drawBuildingPanel(gs: any, building: Building, W: number, _H: number, panelY: number): void {
    const cfg = building.config;
    const px = PAD * 2;
    const py = panelY + PAD;

    // Building preview rect
    this.gfx.fillStyle(cfg.color, 0.9);
    this.gfx.fillRect(px, py + 4, 56, 48);
    this.gfx.lineStyle(2, 0x88ff88, 1);
    this.gfx.strokeRect(px, py + 4, 56, 48);

    this.addText(px + 64, py,      cfg.name, COL.GOLD, '15px');
    this.addText(px + 64, py + 18, cfg.faction.toUpperCase(), 0x888899, '11px');

    // HP
    const hpPct = building.hp / cfg.maxHp;
    this.gfx.fillStyle(0x330000, 0.8);
    this.gfx.fillRect(px + 64, py + 34, 160, 7);
    const hpCol = hpPct > 0.6 ? COL.GREEN : hpPct > 0.3 ? COL.ORANGE : COL.RED;
    this.gfx.fillStyle(hpCol, 0.9);
    this.gfx.fillRect(px + 64, py + 34, 160 * hpPct, 7);
    this.addText(px + 64, py + 44, `HP: ${Math.ceil(building.hp)} / ${cfg.maxHp}`, COL.TEXT, '11px');

    // Production queue
    if (building.productionQueue.length > 0) {
      const item = building.productionQueue[0]!;
      const unitCfg = ALL_UNITS[item.unitKey];
      if (unitCfg) {
        const qx = px + 240;
        this.addText(qx, py, `PRODUCING: ${unitCfg.name}`, COL.CYAN, '13px');
        this.gfx.fillStyle(0x222222, 0.8);
        this.gfx.fillRect(qx, py + 18, 200, 8);
        this.gfx.fillStyle(COL.CYAN, 0.9);
        this.gfx.fillRect(qx, py + 18, 200 * item.progress, 8);

        if (building.productionQueue.length > 1) {
          this.addText(qx, py + 30, `Queue: ${building.productionQueue.length - 1} more`, 0xaaaaaa, '11px');
        }
      }
    }

    // Production buttons
    if (cfg.produces.length > 0) {
      const bx = px + 460;
      const by = panelY + PAD;
      this.addText(bx, by - 0, 'PRODUCE:', 0xaaaaaa, '11px');

      cfg.produces.forEach((unitKey, i) => {
        const uCfg = ALL_UNITS[unitKey];
        if (!uCfg) return;
        const col = i % 4;
        const row = Math.floor(i / 4);
        const btnX = bx + col * 110;
        const btnY = by + 14 + row * 38;
        const btnW = 104;
        const btnH = 34;

        // Button background
        this.gfx.fillStyle(COL.BTN_BG, 0.9);
        this.gfx.fillRect(btnX, btnY, btnW, btnH);
        this.gfx.lineStyle(1, 0x334466, 1);
        this.gfx.strokeRect(btnX, btnY, btnW, btnH);

        // Unit color dot
        this.gfx.fillStyle(uCfg.color, 1);
        this.gfx.fillCircle(btnX + 10, btnY + 17, 7);

        // Name
        this.addText(btnX + 20, btnY + 4, uCfg.name, COL.TEXT, '11px');
        // Cost
        const state = gs.getGameState();
        const canAfford = state.resources.primary >= uCfg.primaryCost &&
                          state.resources.advanced >= uCfg.advancedCost;
        const costCol = canAfford ? COL.BTN_COST : COL.RED;
        const advPart = uCfg.advancedCost > 0 ? ` / ${uCfg.advancedCost}▲` : '';
        this.addText(btnX + 20, btnY + 19, `${uCfg.primaryCost}●${advPart}`, costCol, '10px');

        // Make buttons interactive (one-time setup via scene input)
        // We use a simpler approach: listen to pointer positions and left-click
      });

      // Register interactive production click area (per-frame scan)
      this.registerProductionClicks(cfg.produces, bx, by + 14, building, gs);
    }

    // Extraction worker count
    if (cfg.isExtraction && building.extractionNodeId) {
      const node = gs.getAllNodes().find((n: any) => n.id === building.extractionNodeId);
      if (node) {
        this.addText(px + 240, py + 44, `Workers: ${node.assignedWorkerIds.size}/3`, COL.TEXT, '11px');
      }
    }
  }

  private productionClickHandlers: Array<() => void> = [];
  private productionHandlersSetup = false;

  private registerProductionClicks(
    produces: string[],
    bx: number,
    by: number,
    building: Building,
    gs: any,
  ): void {
    // Use the scene's pointer event to detect clicks in button regions
    // This is handled once per selected building render; clear and re-register
    this.input.off('pointerdown');

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (ptr.rightButtonDown()) return;
      const { x, y } = ptr;

      produces.forEach((unitKey, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const btnX = bx + col * 110;
        const btnY = by + row * 38;
        const btnW = 104;
        const btnH = 34;

        if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
          gs.queueProduction(building.id, unitKey);
        }
      });

      // Tech upgrade button
      if (x >= this.scale.width - 145 && x <= this.scale.width - 5 &&
          y >= 40 && y <= 70) {
        gs.upgradeTier();
      }

      // Hero repurchase
      const state = gs.getGameState();
      if (state.heroRepurchasable) {
        const btnX = this.scale.width - 220;
        const btnY = 40;
        if (x >= btnX && x <= btnX + 210 && y >= btnY && y <= btnY + 28) {
          gs.repurchaseHero();
        }
      }
    });
  }

  private drawIdlePanel(gs: any, W: number, _H: number, panelY: number): void {
    const state = gs.getGameState();
    this.addText(PAD * 2, panelY + PAD, 'Shattered Timeline RTS', COL.GOLD, '18px');
    this.addText(PAD * 2, panelY + 30, 'Left-click / drag: select   Right-click: command', COL.TEXT, '12px');
    this.addText(PAD * 2, panelY + 46, 'A + left-click: attack-move   F + left-click: firebomb (Arsonist)', COL.TEXT, '12px');
    this.addText(PAD * 2, panelY + 62, 'S: stop   T: Lose Your Temper (Tony)   Esc: deselect', COL.TEXT, '12px');
    this.addText(PAD * 2, panelY + 80, 'Scroll: zoom   Arrow/WASD: camera pan', COL.TEXT, '12px');

    // Build hint (replaces stale hardcoded Mafia list)
    const bx = W - 300;
    this.addText(bx, panelY + PAD,      'WORKER BUILDING:', COL.GOLD, '13px');
    this.addText(bx, panelY + 26, 'Select a worker, then:', COL.TEXT, '11px');
    this.addText(bx, panelY + 42, '[B] open build menu', 0xaaaaaa, '11px');
    this.addText(bx, panelY + 58, '[1] economy structure', 0xaaaaaa, '11px');
    this.addText(bx, panelY + 74, '[2] military structure', 0xaaaaaa, '11px');
    this.addText(bx, panelY + 94, '[G] tech upgrade', 0x888866, '11px');

    // Handle B+1..2 hotkeys to start building placement — registered in GameScene
    // Tech upgrade button
    const tier = state.techTier;
    if (tier < 3) {
      const costs = [0, 300, 600];
      const cost = costs[tier] ?? 0;
      this.gfx.fillStyle(COL.BTN_BG, 0.9);
      this.gfx.fillRect(W - 145, 40, 140, 30);
      this.gfx.lineStyle(1, COL.GOLD, 0.6);
      this.gfx.strokeRect(W - 145, 40, 140, 30);
      this.addText(W - 140, 46, `[G] Tier ${tier + 1}  ${cost}●`, COL.GOLD, '12px');
    }

    if (state.heroRepurchasable) {
      this.gfx.fillStyle(0x443300, 0.9);
      this.gfx.fillRect(W - 220, 40, 210, 28);
      this.gfx.lineStyle(1, COL.GOLD, 0.8);
      this.gfx.strokeRect(W - 220, 40, 210, 28);
      this.addText(W - 215, 46, '[R] Repurchase Hero', COL.GOLD, '12px');
    }
  }

  // ─── Notifications ────────────────────────────────────────────────────────

  private drawNotifications(gs: any, W: number, H: number): void {
    const notes = gs.getNotifications();
    const panelY = H - this.panelH;
    let y = panelY - 22;
    for (let i = notes.length - 1; i >= 0 && i >= notes.length - 5; i--) {
      const n = notes[i]!;
      const col = n.type === 'warning' ? COL.ORANGE
        : n.type === 'alert' ? COL.RED
        : COL.GREEN;
      const alpha = Math.min(1, n.ttl);
      this.addText(W / 2 - 150, y, n.message, col, '14px');
      y -= 20;
    }
  }

  // ─── Minimap ──────────────────────────────────────────────────────────────

  private drawMinimap(gs: any, W: number, H: number): void {
    const mmW = 160;
    const mmH = 160;
    const mmX = W - mmW - PAD;
    const mmY = H - this.panelH - mmH - PAD;
    const scale = mmW / 6400;

    // Background
    this.gfx.fillStyle(0x0a1a0a, 0.85);
    this.gfx.fillRect(mmX, mmY, mmW, mmH);
    this.gfx.lineStyle(1, 0x334433, 1);
    this.gfx.strokeRect(mmX, mmY, mmW, mmH);

    // Terrain (rocks as dark spots)
    this.gfx.fillStyle(0x444433, 1);
    for (let c = 45; c < 60; c++) {
      this.gfx.fillRect(mmX + c * 64 * scale, mmY + 49 * 64 * scale, 64 * scale * 1, 64 * scale * 2);
    }

    // Resource nodes
    for (const node of gs.getAllNodes()) {
      const nx = mmX + node.x * scale;
      const ny = mmY + node.y * scale;
      const nc = node.type === 'primary' ? 0x00e5ff : 0xff2200;
      this.gfx.fillStyle(nc, 0.6);
      this.gfx.fillRect(nx - 1, ny - 1, 2, 2);
    }

    // Player buildings
    for (const b of gs.getPlayerBuildings()) {
      if (!b.isAlive) continue;
      this.gfx.fillStyle(0x22ff88, 0.9);
      this.gfx.fillRect(mmX + b.x * scale - 2, mmY + b.y * scale - 2, 4, 4);
    }

    // Player units (dots)
    const playerUnits = gs.getSelectedUnits().length > 0
      ? gs.getSelectedUnits()
      : [];
    // All player units aren't directly exposed — use a simple approximation
    // (just show selected)
    for (const u of playerUnits) {
      this.gfx.fillStyle(0x88ff88, 0.8);
      this.gfx.fillRect(mmX + u.x * scale - 1, mmY + u.y * scale - 1, 2, 2);
    }

    // Camera viewport rect
    const gs2d: any = this.scene.get('GameScene');
    if (gs2d) {
      const cam = (gs2d as Phaser.Scene).cameras?.main;
      if (cam) {
        const vx = mmX + cam.scrollX * scale;
        const vy = mmY + cam.scrollY * scale;
        const vw = cam.width / cam.zoom * scale;
        const vh = cam.height / cam.zoom * scale;
        this.gfx.lineStyle(1, 0xffffff, 0.5);
        this.gfx.strokeRect(vx, vy, vw, vh);
      }
    }

    // Label
    this.addText(mmX + 2, mmY + mmH - 14, 'MAP', 0x556655, '10px');
  }

  // ─── Hotkey reference ─────────────────────────────────────────────────────

  private drawHotkeys(W: number, _H: number): void {
    // Small hotkey reminder in top-right (below top bar)
    const gs = this.getGameScene();
    if (!gs) return;
    const tier = gs.getGameState().techTier;
    const kb = this.scene.get('GameScene') as Phaser.Scene;
    // G key for tech upgrade
    if (kb) {
      const kb2 = (kb as any).input?.scene?.input?.keyboard;
      if (kb2) {
        const gKey = kb2.addKey?.(Phaser.Input.Keyboard.KeyCodes.G);
        if (gKey && Phaser.Input.Keyboard.JustDown(gKey)) {
          gs.upgradeTier();
        }
        const rKey = kb2.addKey?.(Phaser.Input.Keyboard.KeyCodes.R);
        if (rKey && Phaser.Input.Keyboard.JustDown(rKey)) {
          if (gs.getGameState().heroRepurchasable) gs.repurchaseHero();
        }
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private addText(x: number, y: number, text: string, color: number, size: string): Phaser.GameObjects.Text {
    const hex = '#' + color.toString(16).padStart(6, '0');
    const t = this.add.text(x, y, text, {
      fontFamily: '"Courier New", monospace',
      fontSize: size,
      color: hex,
    });
    this.texts.push(t);
    return t;
  }

  private clearTexts(): void {
    for (const t of this.texts) t.destroy();
    this.texts = [];
  }

  private getGameScene(): any {
    return (window as any).__rtsGameScene ?? null;
  }
}

function getAbilityHotkey(ability: string): string {
  const map: Record<string, string> = {
    lose_your_temper: 'T',
    call_a_favor: 'C',
    make_an_example: 'E',
    firebomb: 'F',
    web_execute: 'X',
    temporal_freeze: 'Z',
    pack_frenzy: 'T',
    spore_burst: 'B',
  };
  return map[ability] ?? '?';
}
