"""Rohbilder aus scripts/game-art/.cache aufbereiten: zuschneiden, verkleinern, WebP schreiben, Gelenkpunkte messen.

    python scripts/game-art/process.py            # alles
    python scripts/game-art/process.py places parts

Ausgabe:
  frontend/public/game/alibi/places/<ort>.webp        Szenenbild (640 x 640), ersetzt die alten Orts-Bilder
  frontend/public/game/alibi/live/landmarks/<ort>.webp  freistehendes Gebäude für die Dorfkarte
  frontend/public/game/alibi/live/parts/<teil>.webp     Teile für bewegte Figuren
  frontend/public/game/alibi/live/meta.json             Größen, Fußpunkte und Gelenke (in Anteilen des Bildes)
"""
import json
import pathlib
import sys

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
CACHE = pathlib.Path(__file__).resolve().parent / ".cache"
PUB = ROOT / "frontend/public/game/alibi"
LIVE = PUB / "live"
PLACES = ["baeckerei", "bibliothek", "markt", "garten", "turm", "bruecke", "wirtshaus", "schmiede"]


def trim(im: Image.Image, pad: int = 4) -> Image.Image:
    a = np.array(im.split()[-1])
    ys, xs = np.where(a > 12)
    if not len(xs):
        return im
    x0, x1, y0, y1 = max(0, xs.min() - pad), min(im.width, xs.max() + 1 + pad), max(0, ys.min() - pad), min(im.height, ys.max() + 1 + pad)
    return im.crop((x0, y0, x1, y1))


def clean_alpha(im: Image.Image) -> Image.Image:
    """Halbtransparente Reste am Rand entfernen, damit keine hellen Säume über dunklem Grund stehen."""
    arr = np.array(im.convert("RGBA")).astype(np.float32)
    a = arr[..., 3]
    a[a < 10] = 0
    arr[..., 3] = a
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def fit(im: Image.Image, max_w: int, max_h: int) -> Image.Image:
    k = min(max_w / im.width, max_h / im.height, 1.0)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS) if k < 1 else im


def save(im: Image.Image, out: pathlib.Path, q: int = 84):
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, "WEBP", quality=q, method=6)
    return out.stat().st_size


def base_anchor(im: Image.Image) -> float:
    """Fußpunkt eines Gebäudes: Zeile, in der die Bodenplatte am breitesten ist (Mitte der Ellipse), als Anteil der Höhe."""
    a = np.array(im.split()[-1]) > 40
    widths = a.sum(axis=1)
    h = len(widths)
    lo = int(h * 0.62)
    row = lo + int(np.argmax(widths[lo:]))
    return round(row / h, 3)


def places(meta: dict):
    meta["landmarks"] = {}
    for pid in PLACES:
        lm = CACHE / "places" / f"{pid}.landmark.cut.png"
        if lm.exists():
            im = trim(clean_alpha(Image.open(lm)))
            im = fit(im, 520, 520)
            size = save(im, LIVE / "landmarks" / f"{pid}.webp")
            meta["landmarks"][pid] = {"w": im.width, "h": im.height, "foot": base_anchor(im)}
            print(f"  Gebäude {pid}: {im.width}x{im.height}, Fuß {meta['landmarks'][pid]['foot']}, {size // 1024} KB")
        sc = CACHE / "places" / f"{pid}.scene.png"
        if sc.exists():
            im = Image.open(sc).convert("RGB").resize((640, 640), Image.LANCZOS)
            size = save(im, PUB / "places" / f"{pid}.webp", q=82)
            print(f"  Szene {pid}: {size // 1024} KB")


def leg_joints(im: Image.Image) -> dict:
    """Bein (Hose + Stiefel, Spitze nach rechts): Hüfte oben Mitte, Knie, Knöchel (Beginn des Stiefels)."""
    arr = np.array(im.convert("RGBA")).astype(np.float32)
    a = arr[..., 3] > 40
    h, w = a.shape
    # Hosenbein: schmale senkrechte Bahn. Der Stiefel beginnt, wo die Breite deutlich wächst (Spitze nach rechts).
    widths = a.sum(axis=1)
    top_w = np.median(widths[int(h * 0.1) : int(h * 0.4)])
    ankle = next((y for y in range(int(h * 0.45), h) if widths[y] > top_w * 1.25), int(h * 0.72))
    cols = np.where(a[int(h * 0.2)])[0]
    hip_x = (cols.min() + cols.max()) / 2 / w if len(cols) else 0.5
    cols = np.where(a[max(0, ankle - 2)])[0]
    ankle_x = (cols.min() + cols.max()) / 2 / w if len(cols) else hip_x
    return {"hip": [round(hip_x, 3), 0.04], "knee": round(ankle / h * 0.5, 3), "ankle": [round(ankle_x, 3), round(ankle / h, 3)], "legW": round(top_w / w, 3)}


def arm_joints(im: Image.Image) -> dict:
    a = np.array(im.split()[-1]) > 40
    h, w = a.shape
    cols = np.where(a[int(h * 0.08)])[0]
    sx = (cols.min() + cols.max()) / 2 / w if len(cols) else 0.5
    return {"shoulder": [round(sx, 3), 0.07]}


def collar(im: Image.Image) -> dict:
    """Mantel: Halsöffnung oben (wo der Kopf sitzt) und Saum-Breite."""
    a = np.array(im.split()[-1]) > 40
    h, w = a.shape
    rows = np.where(a.any(axis=1))[0]
    top = rows.min()
    cols = np.where(a[top + int(h * 0.04)])[0]
    cx = (cols.min() + cols.max()) / 2 / w if len(cols) else 0.5
    return {"neck": [round(cx, 3), round((top + h * 0.05) / h, 3)]}


PART_SIZES = {
    "cloak": (300, 300),
    "leg": (160, 260),
    "arm": (120, 200),
    "thiefcloak": (320, 340),
    "hood": (320, 340),
    "magpie_body": (360, 220),
    "magpie_wing": (300, 200),
    "foliage": (1400, 400),
}


def parts(meta: dict):
    meta["parts"] = {}
    for name, (mw, mh) in PART_SIZES.items():
        src = CACHE / "parts" / f"{name}.cut.png"
        if not src.exists():
            continue
        im = fit(trim(clean_alpha(Image.open(src))), mw, mh)
        size = save(im, LIVE / "parts" / f"{name}.webp")
        m = {"w": im.width, "h": im.height}
        if name == "leg":
            m.update(leg_joints(im))
        elif name == "arm":
            m.update(arm_joints(im))
        elif name in ("cloak", "thiefcloak", "hood"):
            m.update(collar(im))
        meta["parts"][name] = m
        print(f"  Teil {name}: {im.width}x{im.height} {size // 1024} KB {m}")


def map_(meta: dict, variant: str):
    """Gemalte Dorfkarte -> map/village.webp (1400 px) + village.mask.png (R Wasser, G Baumkronen, B Weizen)."""
    from PIL import ImageFilter
    from scipy import ndimage

    src = CACHE / "map" / f"map.{variant}.png"
    im = Image.open(src).convert("RGB")
    size = save(im.resize((1400, 1400), Image.LANCZOS), PUB / "map" / "village.webp", q=76)
    a = np.array(im.resize((1024, 1024), Image.LANCZOS)).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    v, mn = a.max(-1), a.min(-1)
    sat = (v - mn) / (v + 1)
    water = (b > r + 22) & (g > r) & (b > 120) & (sat > 0.22)
    water = ndimage.binary_opening(ndimage.binary_closing(water, iterations=3), iterations=2)
    lab, n = ndimage.label(water)
    sizes = ndimage.sum(water, lab, range(1, n + 1))
    water = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 2500])
    water = ndimage.binary_fill_holes(water)
    trees = (v < 130) & (g > r + 8) & (g >= b) & (sat > 0.28)
    trees = ndimage.binary_closing(ndimage.binary_opening(trees, iterations=1), iterations=3)
    lab, n = ndimage.label(trees)
    sizes = ndimage.sum(trees, lab, range(1, n + 1))
    trees = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 1500]) & ~water
    wheat = (r > 160) & (g > 130) & (b < 135) & (r > b + 48) & (r >= g)
    wheat = ndimage.binary_closing(ndimage.binary_opening(wheat, iterations=1), iterations=3)
    lab, n = ndimage.label(wheat)
    sizes = ndimage.sum(wheat, lab, range(1, n + 1))
    wheat = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 2500])

    def soft(m, rad):
        return np.array(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(rad)))

    mask = np.stack([soft(water, 2), soft(trees, 3), soft(wheat, 3)], -1).astype(np.uint8)
    Image.fromarray(mask).resize((512, 512), Image.LANCZOS).save(PUB / "map" / "village.mask.png", optimize=True)
    meta["map"] = {"variant": variant, "water": round(float(water.mean()), 3), "trees": round(float(trees.mean()), 3), "wheat": round(float(wheat.mean()), 3)}
    print(f"  Karte {variant}: {size // 1024} KB, Wasser {meta['map']['water']}, Bäume {meta['map']['trees']}, Weizen {meta['map']['wheat']}")


# Tavi: Augen- und Mund-Rechtecke je Pose (Pixel im Original), gemessen mit dunkler Pupillen-/Mundfarbe
TAVI = {
    "kommissar": {"eyes": [(204, 146, 242, 186), (327, 145, 362, 187)], "mouth": (260, 211, 303, 229)},
    "whisper": {"eyes": [(156, 215, 212, 266), (311, 204, 360, 263)], "mouth": None},  # Hand vor dem Mund
    "cheer": {"eyes": [(202, 175, 238, 211), (303, 168, 339, 204)], "mouth": (259, 226, 291, 240)},
    "shrug": {"eyes": [(178, 181, 217, 225), (308, 179, 348, 226)], "mouth": (246, 240, 284, 258)},
    "surprised": {"eyes": [(250, 180, 296, 230), (356, 164, 404, 214)], "mouth": (322, 230, 350, 264)},
}
TAVI_SEED = (768, 768)


def tavi_prep():
    """Vorlagen für das Inpainting: Pose auf Weiß (576 × 768, oben links), Masken für Augen und Mund."""
    from PIL import ImageDraw

    src_dir = ROOT / "frontend/public/game/tavi"
    out = CACHE / "tavi"
    out.mkdir(parents=True, exist_ok=True)
    for pose, g in TAVI.items():
        im = Image.open(src_dir / f"{pose}.webp").convert("RGBA")
        seed = Image.new("RGB", TAVI_SEED, (255, 255, 255))
        seed.paste(im, (0, 0), im)
        seed.save(out / f"{pose}.seed.png")
        for kind, boxes in (("eyes", g["eyes"]), ("mouth", [g["mouth"]] if g["mouth"] else [])):
            if not boxes:
                continue
            m = Image.new("L", TAVI_SEED, 0)
            d = ImageDraw.Draw(m)
            for x0, y0, x1, y1 in boxes:
                w, h = x1 - x0, y1 - y0
                px, py = (0.45, 0.42) if kind == "eyes" else (0.9, 1.4)
                d.ellipse((x0 - w * px, y0 - h * py, x1 + w * px, y1 + h * py), fill=255)
            m.save(out / f"{pose}.{kind}.mask.png")


def _shift(a, b):
    """Ganzzahlige Verschiebung (dy, dx), um b auf a zu legen."""
    fa, fb = np.fft.fft2(a - a.mean()), np.fft.fft2(b - b.mean())
    r = fa * np.conj(fb)
    r /= np.abs(r) + 1e-9
    c = np.abs(np.fft.ifft2(r))
    y, x = np.unravel_index(np.argmax(c), c.shape)
    h, w = a.shape
    dy, dx = (y if y < h // 2 else y - h), (x if x < w // 2 else x - w)
    return int(-dy), int(-dx)


def tavi(meta: dict):
    """Varianten zurück auf das Original setzen (nur im Maskenbereich, weich überblendet) -> public/game/tavi/live/."""
    from PIL import ImageFilter

    src_dir = ROOT / "frontend/public/game/tavi"
    dst = src_dir / "live"
    dst.mkdir(parents=True, exist_ok=True)
    meta["tavi"] = {}
    for pose, g in TAVI.items():
        base = Image.open(src_dir / f"{pose}.webp").convert("RGBA")
        frames = {}
        for kind, mk in (("blink", "eyes"), ("talk1", "mouth"), ("talk2", "mouth")):
            f = CACHE / "tavi" / f"{pose}.{kind}.png"
            if not f.exists():
                continue
            gen_full = Image.open(f).convert("RGB")
            # Verschiebung gegenüber dem Original messen (Phasenkorrelation) und ausgleichen
            dy, dx = _shift(np.array(Image.open(CACHE / "tavi" / f"{pose}.seed.png").convert("L")).astype(np.float32), np.array(gen_full.convert("L")).astype(np.float32))
            if dx or dy:
                print(f"    {pose}.{kind}: verschoben um ({dx}, {dy}) px, ausgeglichen")
            gen = gen_full.transform(gen_full.size, Image.AFFINE, (1, 0, dx, 0, 1, dy)).crop((0, 0, base.width, base.height))
            mask = Image.open(CACHE / "tavi" / f"{pose}.{mk}.mask.png").crop((0, 0, base.width, base.height)).filter(ImageFilter.GaussianBlur(3))
            # nur der Maskenbereich, und nur wo das Original deckend ist (Alpha bleibt)
            alpha = np.array(base.split()[-1]).astype(np.float32) / 255
            mk_a = np.array(mask).astype(np.float32) / 255 * alpha
            out = np.array(base).astype(np.float32)
            g_arr = np.array(gen).astype(np.float32)
            out[..., :3] = out[..., :3] * (1 - mk_a[..., None]) + g_arr * mk_a[..., None]
            # Ausschnitt um die Maske speichern (klein), Position im Bild merken
            ys, xs = np.where(mk_a > 0.01)
            x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
            patch = Image.fromarray(out.astype(np.uint8), "RGBA").crop((x0, y0, x1, y1))
            pa = np.array(patch).astype(np.float32)
            pa[..., 3] = (mk_a[y0:y1, x0:x1] * 255).clip(0, 255)
            Image.fromarray(pa.astype(np.uint8), "RGBA").save(dst / f"{pose}.{kind}.webp", "WEBP", quality=90, method=6)
            frames[kind] = [round(x0 / base.width, 4), round(y0 / base.height, 4), round((x1 - x0) / base.width, 4), round((y1 - y0) / base.height, 4)]
        meta["tavi"][pose] = {"w": base.width, "h": base.height, "frames": frames}
        print(f"  Tavi {pose}: {', '.join(frames)}")


def sights():
    """Freigestellte Beobachtungen -> public/game/alibi/live/sights/<id>.webp (für Tiere und Dinge in den Ortsbühnen)."""
    src = CACHE / "sights"
    n = 0
    for f in sorted(src.glob("*.png")):
        im = fit(trim(clean_alpha(Image.open(f))), 300, 300)
        save(im, LIVE / "sights" / f"{f.stem}.webp", q=86)
        n += 1
    print(f"  {n} Beobachtungen freigestellt")


def main(argv):
    if argv and argv[0] == "sights":
        sights()
        return
    if argv and argv[0] == "tavi-prep":
        tavi_prep()
        return
    if argv and argv[0] == "tavi":
        mpath = LIVE / "meta.json"
        meta = json.loads(mpath.read_text(encoding="utf8")) if mpath.exists() else {}
        tavi(meta)
        mpath.write_text(json.dumps(meta, indent=1), encoding="utf8")
        write_ts(meta)
        return
    if argv and argv[0] == "map":
        mpath = LIVE / "meta.json"
        meta = json.loads(mpath.read_text(encoding="utf8")) if mpath.exists() else {}
        map_(meta, argv[1] if len(argv) > 1 else "12")
        mpath.write_text(json.dumps(meta, indent=1), encoding="utf8")
        write_ts(meta)
        return
    which = argv or ["places", "parts"]
    LIVE.mkdir(parents=True, exist_ok=True)
    mpath = LIVE / "meta.json"
    meta = json.loads(mpath.read_text(encoding="utf8")) if mpath.exists() else {}
    if "places" in which:
        places(meta)
    if "parts" in which:
        parts(meta)
    mpath.write_text(json.dumps(meta, indent=1), encoding="utf8")
    write_ts(meta)
    print(f"-> {mpath.relative_to(ROOT)}")


def write_ts(meta: dict):
    """Maße auch als TypeScript, damit der Code sie ohne Nachladen kennt."""
    out = ROOT / "frontend/screens/Game/alibi/live/art.gen.ts"
    body = json.dumps({k: meta[k] for k in ("landmarks", "parts", "tavi") if k in meta}, indent=2)
    out.write_text(
        "/* Erzeugt von scripts/game-art/process.py – nicht von Hand ändern. Maße der Bilder in public/game/alibi/live. */\n"
        f"export const ART = {body} as const;\n",
        encoding="utf8",
    )


if __name__ == "__main__":
    main(sys.argv[1:])
