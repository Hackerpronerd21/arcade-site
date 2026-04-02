# CLAUDE.md — Arcade Site Project Instructions

This file governs AI behavior for the arcade-site project.

---

## Project Overview

A neil.fun-style multi-game arcade website. Each game is a self-contained Phaser 3 app
in its own subfolder under `/games/`. The root `index.html` is the hub page linking to all games.

---

## Tech Stack

| Tool | Role |
|---|---|
| Phaser 3 (^3.60) | Game engine for ALL games |
| TypeScript (strict) | Language for all .ts files |
| Vite | Build tool and dev server |
| Node.js / npm | Runtime and package manager |

---

## Phaser Rules

- **Always use Phaser 3 syntax.** Never use Phaser 2 / CE syntax or APIs.
- **Never use deprecated Phaser APIs.** Check the Phaser 3.60+ changelog if unsure.
- Use **Arcade Physics** for all simple games (platformers, shooters, snake, etc.).
- Use **Matter.js** only when slopes, complex polygons, or joints are required.
- Use **object pooling** for any repeatedly spawned objects (bullets, particles, enemies).
- Use **Phaser.Time.addEvent** for fixed-tick game loops (e.g. snake movement), not the raw update() loop.
- Use **Phaser Graphics primitives** (rectangles, circles) for all v1 games — no external sprite assets required.

---

## Architecture Rules

### Scene Structure (minimum per game)
Every game must have at least these scenes:
1. `BootScene` — sets scale mode, any global config
2. `PreloadScene` — loads assets (even if just setting font)
3. `GameScene` — main gameplay
4. `GameOverScene` — end state with score + replay button

### Class Design
- Game entities (Snake, Food, Player, Enemy) must be **TypeScript classes**, not plain objects.
- Keep **game logic separate from rendering** — a Snake class tracks coordinates; the scene handles drawing.
- Use **named exports**, never default exports.
- No implicit `any`. All types must be explicit.

---

## File Structure

```
arcade-site/
├── CLAUDE.md              ← This file
├── index.html             ← Hub homepage (neil.fun style)
├── src/
│   └── main.ts            ← Hub page logic (minimal)
├── games/
│   └── [game-name]/       ← One folder per game
│       ├── index.html     ← Game entry point
│       └── src/
│           └── main.ts    ← Phaser game bootstrap
├── public/
│   └── assets/            ← Sprites, sounds (future)
├── vite.config.ts
└── package.json
```

Each game's `index.html` must include a "← Back to Arcade" link to `/`.

---

## Hub Page Rules

- Background: `#0a0a0a` (near-black)
- Font: "Press Start 2P" from Google Fonts
- Layout: CSS grid of game cards, centered, responsive
- Each card: game title, short description, colored accent, PLAY button linking to `/games/[name]/`
- No frameworks — plain HTML + CSS + minimal vanilla JS

---

## Do Not

- Do not add games outside the `/games/` subfolder structure
- Do not use global singletons for game state — pass data through scene registry or events
- Do not hardcode canvas sizes in CSS — let Phaser handle scaling
- Do not install new npm packages without stating the name, version, and reason first
- Do not leave `console.log` statements in production paths
