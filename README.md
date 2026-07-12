# Teleport Massive: Loop Breaker

A top-down bullet-hell shmup in the Tyrian lineage (weapon tiers, consumable
missiles, sidekick drones, wave escalation), set in the
[Teleport Massive](https://www.youtube.com/@thecoffeejesus) universe. No build
step, no dependencies — open `index.html` in a browser.

## Play

```bash
python3 -m http.server 8930
# open http://localhost:8930/index.html
```

(Serving over HTTP rather than `file://` is required for the ES module import
in `index.html` to load `gamekit/gamekit.js`.)

**Controls**
- **Mouse** — the Signal Runner follows your cursor
- **Left click (hold)** — front cannon
- **Right click** — fire a missile (limited ordnance, restocked by drops + slow regen)
- **Middle click** — Loop Rewind special, once the charge meter is full
- **ESC** — pause menu (restart, return to hangar, main menu)
- Cutscenes advance on click / space / enter

## Structure (the demo)

- **Training Gauntlet** — the TMP Training Simulation, diegetically rendered
  in vector graphics. Teaching stages on your first run, then endless loops
  that get harder forever. It is technically unwinnable; the score is how many
  loops you survive with your current ship configuration. Survive 3 loops once
  to unlock the real world.
- **Missions** — Armored Core-style contracts. Mission 1 ends in a boss fight
  against a TMP Censor-class Enforcer; killing it completes the stage and
  unlocks the next. Credits buy hangar upgrades between missions; flawless
  runs (no armor damage) pay a worthiness bonus and gate legendary gear.
- **The real world uses pixel-art sprites** (from `assets/sprites/` +
  `assets/portraits/`); the sim intentionally stays vector. Art is generated
  once, stored in the repo, and refined by hand — never regenerated at runtime.

## Project structure

```
index.html               the game: entities, gauntlet, missions, boss, hangar, HUD
gamekit/gamekit.js       reusable engine (Game loop, Bullet, Spawner, SpriteSet,
                         VisualNovel with portraits, MusicPlayer, BestRun)
gamekit/pixelforge.py    manifest-driven PixelLab asset pipeline (one-time generation)
assets/manifest.json     declares every sprite/portrait: file, size, prompt
docs/gamekit-api.md      full API reference for gamekit
assets/audio/            background music
assets/sprites/          game sprites (real-world art)
assets/portraits/        VN dialogue portraits
```

## Generating art (pixelforge + PixelLab)

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install pixellab pillow requests
cp .env.example .env     # put your PIXELLAB_API_KEY in .env
python3 gamekit/pixelforge.py status     # what exists / what's missing
python3 gamekit/pixelforge.py generate   # generate ONLY missing assets
```

Generation is one-time: existing files are never regenerated (use `--force`
deliberately). Files land at the exact paths the game already reads, so art
upgrades require zero code changes. Requires an active PixelLab subscription
or credits.

## Lore

Set in the same universe as the Teleport Massive radio show: 2111, post-
singularity, teleportation as infrastructure, a retrocausal loop that makes
death cheap and consequence expensive. Cutscene cast: Sam Iker, Aziah
Calderon, Lyra Caeli, and GAIA.
