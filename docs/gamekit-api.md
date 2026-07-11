# gamekit — API reference

`gamekit/gamekit.js` is a dependency-free ES module for building top-down arcade
shooters on a `<canvas>`. No build step: import it directly with a `<script type="module">`.

```js
import { Game, Input, Vec2, Entity, Bullet, Spawner, SpriteSet, circleHit, dist2, clamp, reap } from "./gamekit/gamekit.js";
```

## Game

Owns the canvas, the render loop, and dt clamping.

```js
const game = new Game(canvas);
game.onUpdate = (dt) => { /* move things, spawn things, resolve collisions */ };
game.onDraw = (ctx) => { /* clear + draw everything */ };
game.start();   // begins requestAnimationFrame loop
game.stop();    // pauses onUpdate (onDraw still runs so you can render a paused frame)
```

`game.w` / `game.h` mirror the canvas's `width` / `height` attributes.

## Input

Lowercased, deduped keyboard state.

```js
const input = new Input();
const dx = input.axis(["arrowleft", "a"], ["arrowright", "d"]);
const dy = input.axis(["arrowup", "w"], ["arrowdown", "s"]);
if (input.has(" ")) fire();
```

Call `input.dispose()` if you ever tear the game down (removes listeners).

## Entity / Bullet

`Entity` is the base shape every game object needs: `x`, `y`, `r` (collision
radius), `dead` (set true to have it reaped). Subclass it for players,
enemies, pickups.

`Bullet` is a ready-made projectile: constant velocity, culled once it leaves
the play field.

```js
bullets.push(new Bullet(x, y, angle, speed, { r: 5, color: "#5ec8ff", hostile: false }));
// each frame:
for (const b of bullets) b.update(dt, { w: game.w, h: game.h });
bullets = reap(bullets);
```

`hostile: true` marks enemy fire — your collision code decides what that
means (usually: hostile bullets hurt the player, non-hostile hurt enemies).

## Spawner

Drives wave-based enemy spawning without hardcoding your game's difficulty
curve into the engine.

```js
const spawner = new Spawner({
  rateFn: (wave) => Math.max(0.35, 1.1 - wave * 0.08),   // seconds between spawns
  spawnFn: (wave) => enemies.push(makeEnemyForWave(wave)),
  waveLengthSec: 20,
  onWaveChange: (wave) => waveEl.textContent = "WAVE " + wave,
});
// each frame:
spawner.update(dt);
```

## Collision helpers

```js
circleHit(a, b)        // true if two {x,y,r} overlap
dist2(ax, ay, bx, by)   // squared distance, for cheap comparisons
clamp(v, lo, hi)
```

## SpriteSet

Bridges vector-shape placeholders to real art with zero call-site changes.
Register a fallback draw function per key; swap in a URL later (e.g. once
PixelLab generates it) and the game silently switches to the image.

```js
const sprites = new SpriteSet();
sprites.set("player-ship", "assets/sprites/player_ship.png");

function drawPlayer(ctx, x, y) {
  sprites.draw(ctx, "player-ship", x, y, 32, 32, (ctx, x, y) => {
    // vector fallback while the sprite loads or if it's missing
    ctx.fillStyle = "#bfe6ff";
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
  });
}
```

## reap

```js
enemies = reap(enemies); // enemies.filter(e => !e.dead)
```

## VisualNovel

DOM-based dialogue box for cutscenes wedged between waves: portrait-color
speaker tag, typewriter text, click/space/Enter to advance. Linear scripts
only (no branching) — this is a cutscene box, not a full VN engine.

```js
const vn = new VisualNovel(document.getElementById("wrap"));
vn.play(
  [
    { speaker: "GAIA", color: "#c85eff", text: "Every loop ends the same way. You already know that." },
    { speaker: "SIGNAL RUNNER", color: "#7fd8ff", text: "Then it won't cost me anything to keep running." },
  ],
  () => { /* resume gameplay */ }
);
```

Clicking mid-typewriter snaps the current line to full text before advancing
(standard VN behavior — impatient players can blow through dialogue).

## MusicPlayer

Looping background music with a mute flag persisted to `localStorage`.

```js
const music = new MusicPlayer("assets/audio/tpm-loop-theme.mp3", { storageKey: "my-game-muted" });
startButton.addEventListener("click", () => music.playFromGesture()); // autoplay needs a user gesture
muteButton.addEventListener("click", () => { muteButton.textContent = music.toggleMute() ? "🔇" : "🔊"; });
```

## BestRun

localStorage-backed best-run tracker for roguelike meta-progression (best
score, best wave/cycle reached, etc. across permadeath runs).

```js
const best = new BestRun("my-game-best", ["score", "wave"]);
// on game over:
const improved = best.report({ score, wave });
if (improved) showNewRecordBanner();
console.log(best.best.score, best.best.wave);
```

## Design notes

- Everything is plain data + plain functions. No hidden global state, no
  singleton scene graph — you own your entity arrays and call the helpers.
- The engine doesn't know about weapons, upgrades, or themes. That's
  intentional: `gamekit` is the substrate every future top-down shooter in
  this workspace can start from; game-specific rules live in the game's own
  file (see `index.html` in this repo for a full worked example).
- Extending it: if a second game needs something new (e.g. tilemaps, a
  particle system), add it here rather than forking the file, so both games
  benefit.
