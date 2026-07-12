#!/usr/bin/env python3
"""pixelforge — manifest-driven PixelLab asset pipeline for gamekit games.

The game declares everything it needs in `assets/manifest.json` (sprites,
portraits, sizes, prompts). pixelforge reads the manifest, generates whatever
is missing via PixelLab, and writes files exactly where the game's SpriteSet /
VisualNovel portraits already look. The game never needs code changes when
art lands — that contract is the whole point.

Usage:
    export PIXELLAB_API_KEY=...        # or PIXELLAB_API_KEY=... in .env
    python3 gamekit/pixelforge.py status              # what exists / what's missing
    python3 gamekit/pixelforge.py generate            # generate everything missing
    python3 gamekit/pixelforge.py generate --force    # regenerate all
    python3 gamekit/pixelforge.py generate --only player,sam
    python3 gamekit/pixelforge.py balance             # PixelLab credit balance

Library use:
    from pixelforge import Forge
    forge = Forge()          # finds manifest + key from repo root
    forge.generate(only={"player"}, force=False)
"""
import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
MANIFEST_PATH = ASSETS / "manifest.json"


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


class Forge:
    def __init__(self, manifest_path: Path = MANIFEST_PATH, api_key: str | None = None):
        self.manifest_path = manifest_path
        self.manifest = json.loads(manifest_path.read_text())
        self.api_key = api_key or load_api_key()
        self._client = None

    # ---- manifest access ----

    def entries(self):
        """Yield (key, category, spec) for every asset in the manifest."""
        for category in ("sprites", "portraits"):
            for key, spec in self.manifest.get(category, {}).items():
                yield key, category, spec

    def path_for(self, spec) -> Path:
        return ASSETS / spec["file"]

    def status(self):
        """Return {key: {"exists": bool, "path": Path, "category": str}}."""
        out = {}
        for key, category, spec in self.entries():
            p = self.path_for(spec)
            out[key] = {"exists": p.exists(), "path": p, "category": category}
        return out

    # ---- PixelLab ----

    def client(self):
        if self._client is None:
            if not self.api_key:
                raise RuntimeError(
                    "PIXELLAB_API_KEY not set. Export it or add it to .env "
                    "(get a key at https://www.pixellab.ai/vibe-coding)"
                )
            import pixellab
            self._client = pixellab.Client(secret=self.api_key)
        return self._client

    def balance(self) -> float:
        return self.client().get_balance().usd

    def generate_one(self, key: str, spec) -> Path:
        from pixellab.models import ImageSize
        import base64
        from io import BytesIO
        from PIL import Image

        style = self.manifest.get("style", "")
        prompt = f"{spec['prompt']}, {style}" if style else spec["prompt"]
        size = spec.get("size", 48)

        response = self.client().generate_image_pixflux(
            description=prompt,
            image_size=ImageSize(width=size, height=size),
        )
        image_data = base64.b64decode(response.image.base64)
        img = Image.open(BytesIO(image_data))
        dest = self.path_for(spec)
        dest.parent.mkdir(parents=True, exist_ok=True)
        img.save(dest)
        return dest

    def generate(self, only: set[str] | None = None, force: bool = False, log=print):
        generated, skipped = [], []
        for key, _category, spec in self.entries():
            if only and key not in only:
                continue
            dest = self.path_for(spec)
            if dest.exists() and not force:
                skipped.append(key)
                continue
            log(f"generating {key} -> {spec['file']} ...")
            self.generate_one(key, spec)
            generated.append(key)
            log(f"  saved {spec['file']}")
        return generated, skipped


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("status", help="show which manifest assets exist on disk")
    sub.add_parser("balance", help="show PixelLab credit balance")

    gen = sub.add_parser("generate", help="generate missing assets via PixelLab")
    gen.add_argument("--force", action="store_true", help="regenerate even if files exist")
    gen.add_argument("--only", help="comma-separated asset keys")

    args = parser.parse_args()
    forge = Forge()

    if args.cmd == "status":
        st = forge.status()
        missing = 0
        for key, info in st.items():
            mark = "✓" if info["exists"] else "✗"
            if not info["exists"]:
                missing += 1
            print(f"  {mark} {info['category'][:-1]:9s} {key:12s} {info['path'].relative_to(ROOT)}")
        print(f"{len(st) - missing}/{len(st)} present, {missing} missing")
        sys.exit(0)

    if args.cmd == "balance":
        try:
            print(f"PixelLab balance: ${forge.balance():.2f}")
        except Exception as e:
            print(f"PixelLab unreachable: {e}")
            sys.exit(1)
        sys.exit(0)

    if args.cmd == "generate":
        try:
            print(f"PixelLab balance: ${forge.balance():.2f}")
        except Exception as e:
            print(f"Cannot generate — PixelLab unreachable with this key: {e}")
            sys.exit(1)
        only = set(args.only.split(",")) if args.only else None
        generated, skipped = forge.generate(only=only, force=args.force)
        if skipped:
            print(f"skipped (exist): {', '.join(skipped)}")
        print(f"generated {len(generated)} asset(s). Reload the game — no code changes needed.")


if __name__ == "__main__":
    main()
