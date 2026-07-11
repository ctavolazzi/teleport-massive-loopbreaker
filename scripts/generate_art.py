#!/usr/bin/env python3
"""Generate the game's pixel art via PixelLab and drop it into assets/sprites/.

Usage:
    cd teleport-massive-loopbreaker
    source .venv/bin/activate   # or: python3 -m venv .venv && pip install pixellab pillow requests
    export PIXELLAB_API_KEY=your-key-here   # or put it in .env (PIXELLAB_API_KEY=...)
    python3 scripts/generate_art.py
    python3 scripts/generate_art.py --force   # regenerate even if a file already exists

Filenames match what index.html's SpriteSet already expects — nothing else
needs to change once these land in assets/sprites/.
"""
import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPRITE_DIR = ROOT / "assets" / "sprites"

# key -> (filename, PixelLab prompt, pixel size)
ASSETS = {
    "player": (
        "signal_runner.png",
        "top-down view sci-fi courier spaceship, sleek blue and white hull, "
        "single pilot, small nimble racing silhouette, glowing engine trail, "
        "clean pixel art, no background",
        48,
    ),
    "grunt": (
        "tmp_compliance_drone.png",
        "top-down view corporate security drone, angular orange and grey hull, "
        "boxy enforcement automaton, small sensor array, menacing but bureaucratic, "
        "clean pixel art, no background",
        40,
    ),
    "weaver": (
        "nexus_acolyte.png",
        "top-down view cultist spacecraft, magenta and black hull, ritualistic "
        "asymmetric wings, glowing sigils, unsettling organic-mechanical fusion, "
        "clean pixel art, no background",
        40,
    ),
    "turret": (
        "gaia_relay_node.png",
        "top-down view floating AI broadcast relay station, purple and chrome, "
        "radial antenna array, glowing central eye, ominous and ancient, "
        "clean pixel art, no background",
        48,
    ),
    "seeker": (
        "ultimatum_seeker.png",
        "top-down view small kamikaze attack drone, yellow and black warning "
        "stripes, minimal aerodynamic shape built for a single fast dive, "
        "clean pixel art, no background",
        32,
    ),
}


def load_api_key():
    key = os.environ.get("PIXELLAB_API_KEY")
    if key:
        return key
    env_path = ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line.startswith("PIXELLAB_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="regenerate even if the file exists")
    parser.add_argument("--only", help="comma-separated asset keys to generate (default: all)")
    args = parser.parse_args()

    key = load_api_key()
    if not key:
        print("PIXELLAB_API_KEY not set. Export it, or add PIXELLAB_API_KEY=... to .env")
        print("Get a key at https://www.pixellab.ai/vibe-coding")
        sys.exit(1)

    import pixellab
    from pixellab.models import ImageSize
    import base64
    from io import BytesIO
    from PIL import Image

    client = pixellab.Client(secret=key)
    try:
        balance = client.get_balance()
        print(f"PixelLab balance: ${balance.usd:.2f}")
    except Exception as e:
        print(f"Could not reach PixelLab with this key: {e}")
        sys.exit(1)

    SPRITE_DIR.mkdir(parents=True, exist_ok=True)
    wanted = set(args.only.split(",")) if args.only else set(ASSETS)

    for key_name, (filename, prompt, size) in ASSETS.items():
        if key_name not in wanted:
            continue
        dest = SPRITE_DIR / filename
        if dest.exists() and not args.force:
            print(f"skip (exists): {filename}")
            continue

        print(f"generating {filename} ...")
        response = client.generate_image_pixflux(
            description=prompt,
            image_size=ImageSize(width=size, height=size),
        )
        image_data = base64.b64decode(response.image.base64)
        img = Image.open(BytesIO(image_data))
        img.save(dest)
        print(f"  saved {dest.relative_to(ROOT)}")

    print("Done. Reload index.html — SpriteSet picks up new files automatically.")


if __name__ == "__main__":
    main()
