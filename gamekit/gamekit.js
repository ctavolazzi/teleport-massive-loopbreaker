// gamekit.js — tiny reusable engine for top-down arcade shooters (canvas 2D).
// No build step, no dependencies. Import as an ES module:
//   import { Game, Input, Vec2, Entity, Bullet, Spawner, circleHit, SpriteSet } from "./gamekit/gamekit.js";
// See docs/gamekit-api.md for the full reference.

export class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  static fromAngle(angle, len = 1) { return new Vec2(Math.cos(angle) * len, Math.sin(angle) * len); }
  clone() { return new Vec2(this.x, this.y); }
  add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
  scale(s) { return new Vec2(this.x * s, this.y * s); }
  len() { return Math.hypot(this.x, this.y); }
  normalized() {
    const l = this.len();
    return l === 0 ? new Vec2(0, 0) : new Vec2(this.x / l, this.y / l);
  }
}

export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

// True if two circles (x, y, r) overlap.
export function circleHit(a, b) {
  const rr = (a.r + b.r) * (a.r + b.r);
  return dist2(a.x, a.y, b.x, b.y) < rr;
}

// Base class for anything that lives in the entity lists: has position,
// radius (for collision), and a `dead` flag the Game loop uses to reap it.
export class Entity {
  constructor(x, y, r) {
    this.x = x; this.y = y; this.r = r;
    this.dead = false;
  }
  update(_dt) {}
  draw(_ctx) {}
}

// A projectile moving at a fixed velocity, culled once it leaves the bounds
// passed to `update`. `hostile` distinguishes player bullets from enemy fire
// so damage systems can filter on it.
export class Bullet extends Entity {
  constructor(x, y, angle, speed, { r = 5, color = "#fff", hostile = false } = {}) {
    super(x, y, r);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.color = color;
    this.hostile = hostile;
  }
  update(dt, bounds) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (bounds) {
      const { w, h, margin = 20 } = bounds;
      if (this.x < -margin || this.x > w + margin || this.y < -margin || this.y > h + margin) {
        this.dead = true;
      }
    }
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Time-based wave spawner. `rateFn(waveNumber) -> seconds between spawns`
// and `spawnFn(waveNumber)` (called each tick the cooldown elapses) are the
// only two hooks a game needs to provide.
export class Spawner {
  constructor({ rateFn, spawnFn, waveLengthSec = 20, onWaveChange = null }) {
    this.rateFn = rateFn;
    this.spawnFn = spawnFn;
    this.waveLengthSec = waveLengthSec;
    this.onWaveChange = onWaveChange;
    this.wave = 1;
    this.waveTimer = 0;
    this.spawnTimer = 0;
  }
  update(dt) {
    this.waveTimer += dt;
    if (this.waveTimer > this.waveLengthSec) {
      this.waveTimer = 0;
      this.wave++;
      if (this.onWaveChange) this.onWaveChange(this.wave);
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnFn(this.wave);
      this.spawnTimer = this.rateFn(this.wave);
    }
  }
}

// Lowercased, deduped keyboard state. `.has("arrowleft")` / `.has("a")`.
export class Input {
  constructor(target = window) {
    this.keys = new Set();
    this._down = (e) => this.keys.add(e.key.toLowerCase());
    this._up = (e) => this.keys.delete(e.key.toLowerCase());
    target.addEventListener("keydown", this._down);
    target.addEventListener("keyup", this._up);
  }
  has(key) { return this.keys.has(key); }
  axis(negKeys, posKeys) {
    let v = 0;
    if (negKeys.some((k) => this.keys.has(k))) v -= 1;
    if (posKeys.some((k) => this.keys.has(k))) v += 1;
    return v;
  }
  dispose(target = window) {
    target.removeEventListener("keydown", this._down);
    target.removeEventListener("keyup", this._up);
  }
}

// Loads a named set of images and draws them centered on an entity, with a
// per-key fallback drawFn(ctx, entity) used until the image resolves (or if
// the key was never registered). This is what lets a game start on vector
// placeholders and upgrade to PixelLab (or any) art with no code changes
// beyond calling `.set(key, url)`.
export class SpriteSet {
  constructor() {
    this.images = new Map();
    this.ready = new Map();
  }
  set(key, url) {
    const img = new Image();
    this.ready.set(key, false);
    img.onload = () => this.ready.set(key, true);
    img.src = url;
    this.images.set(key, img);
    return img;
  }
  isReady(key) { return this.ready.get(key) === true; }
  draw(ctx, key, x, y, w, h, fallback) {
    if (this.isReady(key)) {
      const img = this.images.get(key);
      ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
    } else if (fallback) {
      fallback(ctx, x, y);
    }
  }
}

// Owns the canvas, the fixed-step-ish game loop (rAF with clamped dt), and
// the three entity buckets every top-down shooter needs. A game wires up
// `onUpdate(dt)` / `onDraw(ctx)` and calls `game.start()`.
export class Game {
  constructor(canvas, { maxDt = 0.033 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false; // crisp pixel-art scaling
    this.w = canvas.width;
    this.h = canvas.height;
    this.maxDt = maxDt;
    this.running = false;
    this._last = null;
    this.onUpdate = null;
    this.onDraw = null;
    this._loop = this._loop.bind(this);
  }
  start() {
    this.running = true;
    this._last = null;
    requestAnimationFrame(this._loop);
  }
  stop() { this.running = false; }
  _loop(ts) {
    if (this._last === null) this._last = ts;
    const dt = Math.min(this.maxDt, (ts - this._last) / 1000);
    this._last = ts;
    if (this.running && this.onUpdate) this.onUpdate(dt);
    if (this.onDraw) this.onDraw(this.ctx);
    requestAnimationFrame(this._loop);
  }
}

// Filters `dead` entries out of an array in place-ish (returns a new array;
// assign it back: `bullets = reap(bullets)`).
export function reap(list) {
  return list.filter((e) => !e.dead);
}

// DOM-based visual-novel dialogue box: portrait swatch + speaker name +
// typewriter text, advanced by click or a key. Built for cutscenes wedged
// between waves of an action game, not a full VN engine — linear scripts
// only, no branching. Injects its own scoped styles on first use.
let _vnStyleInjected = false;
function _injectVnStyles() {
  if (_vnStyleInjected) return;
  _vnStyleInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .gk-vn { position: absolute; inset: 0; display: none; align-items: flex-end;
      justify-content: center; padding: 24px; box-sizing: border-box;
      background: rgba(2, 4, 10, 0.55); font-family: "Courier New", monospace; }
    .gk-vn.gk-vn-open { display: flex; }
    .gk-vn-box { width: 100%; max-width: 440px; background: #0b0e18; border: 1px solid #3f8fd6;
      box-shadow: 0 0 24px rgba(80, 160, 255, 0.2); padding: 14px 16px; cursor: pointer;
      color: #d7ecff; }
    .gk-vn-row { display: flex; gap: 12px; align-items: flex-start; }
    .gk-vn-portrait { width: 56px; height: 56px; flex: 0 0 56px; border: 1px solid #234064;
      display: flex; align-items: center; justify-content: center; font-size: 22px;
      font-weight: bold; image-rendering: pixelated; overflow: hidden; }
    .gk-vn-portrait img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
    .gk-vn-portrait.gk-vn-noportrait { display: none; }
    .gk-vn-main { flex: 1; min-width: 0; }
    .gk-vn-speaker { font-size: 12px; letter-spacing: 1px; font-weight: bold; margin-bottom: 6px; }
    .gk-vn-text { font-size: 13px; line-height: 1.6; min-height: 3.2em; white-space: pre-wrap; }
    .gk-vn-hint { text-align: right; font-size: 11px; color: #6f8bab; margin-top: 8px; opacity: 0.8; }
  `;
  document.head.appendChild(style);
}

export class VisualNovel {
  // `portraits` maps a portrait key to { src, color, initial }. When a line
  // carries `portrait: key`, the box shows the image at `src` if it loads
  // (PixelLab art drops in here), otherwise a colored initial swatch.
  constructor(container, { charsPerSec = 45, portraits = {} } = {}) {
    _injectVnStyles();
    this.charsPerSec = charsPerSec;
    this.portraits = portraits;
    this.root = document.createElement("div");
    this.root.className = "gk-vn";
    this.root.innerHTML = `
      <div class="gk-vn-box">
        <div class="gk-vn-row">
          <div class="gk-vn-portrait gk-vn-noportrait"></div>
          <div class="gk-vn-main">
            <div class="gk-vn-speaker"></div>
            <div class="gk-vn-text"></div>
          </div>
        </div>
        <div class="gk-vn-hint">click / space to continue</div>
      </div>`;
    container.appendChild(this.root);
    this.portraitEl = this.root.querySelector(".gk-vn-portrait");
    this.speakerEl = this.root.querySelector(".gk-vn-speaker");
    this.textEl = this.root.querySelector(".gk-vn-text");
    this.lines = [];
    this.index = 0;
    this.onComplete = null;
    this._typing = null;

    const advance = () => this.advance();
    this.root.addEventListener("click", advance);
    this._keyHandler = (e) => {
      if (!this.isOpen()) return;
      if (e.key === " " || e.key === "Enter") advance();
    };
    window.addEventListener("keydown", this._keyHandler);
  }

  isOpen() { return this.root.classList.contains("gk-vn-open"); }

  play(lines, onComplete) {
    this.lines = lines;
    this.index = 0;
    this.onComplete = onComplete || null;
    this.root.classList.add("gk-vn-open");
    this._showLine();
  }

  _showPortrait(line) {
    const p = this.portraits[line.portrait];
    if (!p) {
      this.portraitEl.classList.add("gk-vn-noportrait");
      this.portraitEl.innerHTML = "";
      return;
    }
    this.portraitEl.classList.remove("gk-vn-noportrait");
    this.portraitEl.style.background = "#0d1526";
    this.portraitEl.style.color = p.color || line.color || "#7fd8ff";
    const fallback = () => {
      this.portraitEl.innerHTML = "";
      this.portraitEl.textContent = p.initial || (line.speaker || "?").charAt(0);
    };
    if (p.src) {
      const img = new Image();
      img.onload = () => { this.portraitEl.innerHTML = ""; this.portraitEl.appendChild(img); };
      img.onerror = fallback;
      img.src = p.src;
      fallback(); // show initial immediately; swapped if/when the image loads
    } else {
      fallback();
    }
  }

  _showLine() {
    const line = this.lines[this.index];
    this._showPortrait(line);
    this.speakerEl.textContent = line.speaker || "";
    this.speakerEl.style.color = line.color || "#7fd8ff";
    this.textEl.textContent = "";
    clearInterval(this._typing);
    let i = 0;
    const full = line.text;
    this._typing = setInterval(() => {
      i++;
      this.textEl.textContent = full.slice(0, i);
      if (i >= full.length) clearInterval(this._typing);
    }, 1000 / this.charsPerSec);
  }

  advance() {
    const line = this.lines[this.index];
    if (this.textEl.textContent.length < line.text.length) {
      clearInterval(this._typing);
      this.textEl.textContent = line.text;
      return;
    }
    this.index++;
    if (this.index >= this.lines.length) {
      this.root.classList.remove("gk-vn-open");
      const cb = this.onComplete;
      this.onComplete = null;
      if (cb) cb();
      return;
    }
    this._showLine();
  }

  dispose() {
    window.removeEventListener("keydown", this._keyHandler);
    this.root.remove();
  }
}

// Thin wrapper around <audio> for a looping music bed with a persisted
// mute flag (localStorage) so "modern feature" #1 — a mute button that
// remembers your choice across sessions — is one call, not boilerplate.
export class MusicPlayer {
  constructor(src, { storageKey = "gamekit-muted", volume = 0.6 } = {}) {
    this.storageKey = storageKey;
    this.audio = new Audio(src);
    this.audio.loop = true;
    this.audio.volume = volume;
    this.audio.muted = localStorage.getItem(storageKey) === "1";
  }
  // Call from a user-gesture handler (click, keydown) — browsers block
  // unprompted audio playback.
  playFromGesture() {
    this.audio.play().catch(() => {});
  }
  toggleMute() {
    this.audio.muted = !this.audio.muted;
    localStorage.setItem(this.storageKey, this.audio.muted ? "1" : "0");
    return this.audio.muted;
  }
  get muted() { return this.audio.muted; }
}

// Tiny localStorage-backed best-run tracker for roguelike meta-progression
// (best score / best depth surviving a permadeath run). `fields` is the
// list of numeric keys to track; `report()` returns whether any field in
// the passed record beat its stored best, updating storage if so.
export class BestRun {
  constructor(storageKey, fields) {
    this.storageKey = storageKey;
    this.fields = fields;
    this.best = this._load();
  }
  _load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) return JSON.parse(raw);
    } catch (_e) { /* corrupt or inaccessible storage: fall through */ }
    return Object.fromEntries(this.fields.map((f) => [f, 0]));
  }
  report(record) {
    let improved = false;
    for (const f of this.fields) {
      if ((record[f] || 0) > (this.best[f] || 0)) {
        this.best[f] = record[f];
        improved = true;
      }
    }
    if (improved) localStorage.setItem(this.storageKey, JSON.stringify(this.best));
    return improved;
  }
}
