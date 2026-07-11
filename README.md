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
- **Middle click** — special ability, once the charge meter is full
- Cutscenes advance on click / space / enter

The first playthrough is framed as the **TMP Training Simulation** — the
vector-graphics build you're looking at right now. On your first death, Sam
Iker gets asked "ready for the real world?" and the game hands off to the
real thing. Once PixelLab art lands in `assets/sprites/`, the same build
upgrades automatically — no code changes required (see `gamekit`'s
`SpriteSet`).

## Project structure

```
index.html              the game: entities, waves, cutscene scripts, HUD
gamekit/gamekit.js       reusable engine (Game loop, Input helpers, Bullet,
                         Spawner, SpriteSet, VisualNovel, MusicPlayer, BestRun)
docs/gamekit-api.md      full API reference for gamekit
scripts/generate_art.py  PixelLab batch sprite generator
assets/audio/            background music
assets/sprites/          generated art drops here (empty until you run the script)
```

## Generating art (PixelLab)

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install pixellab pillow requests
export PIXELLAB_API_KEY=your-key-here   # https://www.pixellab.ai/vibe-coding
python3 scripts/generate_art.py
```

Sprites are saved under the exact filenames `index.html` already looks for,
so no other wiring is needed — reload the page and the vector-shape
placeholders are replaced by the generated art.

## Lore

Set in the same universe as the Teleport Massive radio show: 2111, post-
singularity, teleportation as infrastructure, a retrocausal loop that makes
death cheap and consequence expensive. Cutscene cast: Sam Iker, Aziah
Calderon, Lyra Caeli, and GAIA.
