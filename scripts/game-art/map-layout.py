"""Grundriss der Dorfkarte (Plätze, Wege, Fluss, Wald, Häuser, Felder) als Vorlage für die Bildgenerierung.

Die Geometrie hier (nach dem Malen auf der Karte nachgemessen) ist die Wahrheit für das Spiel: Platzmitten (MAP_POS) und Wegkurven landen in
frontend/screens/Game/alibi/live/roads.ts (siehe ROADS unten). Wird hier etwas verschoben, beides angleichen.

    python scripts/game-art/map-layout.py      -> .cache/map/layout.png (2048 x 2048)
"""
import math
import pathlib

from PIL import Image, ImageDraw, ImageFilter

OUT = pathlib.Path(__file__).resolve().parent / ".cache" / "map"
S = 2048

PLACES = {
    "turm": (49.9, 11.7),
    "bibliothek": (22.0, 22.8),
    "wirtshaus": (79.0, 23.1),
    "markt": (49.7, 48.7),
    "baeckerei": (13.7, 50.0),
    "schmiede": (85.2, 50.1),
    "garten": (23.9, 79.4),
    "bruecke": (71.8, 79.4),
}
# Wege als quadratische Kurven: (von, nach, Kontrollpunkt in %)
ROADS = [
    ("markt", "turm", (55.1, 30.2)),
    ("markt", "bibliothek", (37.0, 34.3)),
    ("markt", "wirtshaus", (65.2, 36.8)),
    ("markt", "baeckerei", (31.3, 51.1)),
    ("markt", "schmiede", (67.3, 50.5)),
    ("markt", "garten", (39.9, 67.2)),
    ("markt", "bruecke", (61.0, 63.9)),
    ("turm", "bibliothek", (35.2, 15.7)),
    ("turm", "wirtshaus", (64.6, 17.1)),
    ("bibliothek", "baeckerei", (18.7, 36.7)),
    ("wirtshaus", "schmiede", (83.9, 36.0)),
    ("baeckerei", "garten", (19.8, 64.2)),
    ("schmiede", "bruecke", (77.7, 64.4)),
    ("garten", "bruecke", (47.6, 87.9)),
]
# Fluss: kommt oben rechts herein, fließt unter der Brücke durch, verlässt die Karte unten links
RIVER = [(103, 30), (96, 36), (92, 46), (90.5, 58), (86, 68), (78, 75), (71.8, 79.6), (64, 86), (54, 92), (42, 95), (30, 97), (18, 99.5), (6, 103)]

P = lambda xy: (xy[0] / 100 * S, xy[1] / 100 * S)


def bez(a, c, b, n=60):
    return [((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]) for t in (i / n for i in range(n + 1))]


def smooth(pts, n=12):
    """Catmull-Rom durch die Punkte."""
    out = []
    pts = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in range(2)))
    out.append(pts[-2])
    return out


def thick(d, pts, w, fill):
    d.line(pts, fill=fill, width=int(w), joint="curve")
    r = w / 2
    for x, y in (pts[0], pts[-1]):
        d.ellipse((x - r, y - r, x + r, y + r), fill=fill)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    im = Image.new("RGB", (S, S), (126, 168, 92))
    d = ImageDraw.Draw(im)
    # Felder und Wiesen in den Ecken (Streifen), Wald am Rand
    fields = [((60, 2), (92, 10)), ((2, 86), (14, 98)), ((88, 86), (99, 99)), ((2, 2), (12, 12))]
    for (x0, y0), (x1, y1) in fields:
        for k in range(10):
            yy0 = y0 + (y1 - y0) * k / 10
            col = (214, 190, 110) if k % 2 else (176, 170, 86)
            d.rectangle((*P((x0, yy0)), *P((x1, yy0 + (y1 - y0) / 10))), fill=col)
    forest = [(0, 30, 6), (3, 62, 5), (95, 66, 5), (94, 4, 6), (30, 2, 5), (4, 74, 4), (97, 92, 4), (60, 99, 4), (88, 30, 3.2)]
    for x, y, r in forest:
        for k in range(14):
            a = k * 2.4
            cx, cy = x + math.cos(a) * r * 0.7, y + math.sin(a) * r * 0.7
            rr = r * (0.45 + 0.25 * ((k * 7) % 5) / 5)
            d.ellipse((*P((cx - rr, cy - rr)), *P((cx + rr, cy + rr))), fill=(46, 92, 58))
    # Teich und Häuschen (Deko, keine Spielorte)
    d.ellipse((*P((32, 58)), *P((40, 64))), fill=(92, 156, 196))
    houses = [(36, 22, 0), (63, 24, 0), (31, 42, 1), (68, 42, 1), (8, 38, 0), (91, 38, 1), (38, 74, 0), (60, 74, 1), (12, 63, 0), (82, 60, 0), (44, 6, 1), (57, 5, 0)]
    for x, y, rot in houses:
        w, h = (3.6, 2.6) if rot else (2.6, 3.6)
        d.rectangle((*P((x - w / 2, y - h / 2)), *P((x + w / 2, y + h / 2))), fill=(176, 84, 64))
    # Fluss mit Ufer
    river = [P(p) for p in smooth(RIVER, 16)]
    thick(d, river, S * 0.075, (160, 140, 110))
    thick(d, river, S * 0.055, (70, 140, 190))
    # Wege
    for a, b, c in ROADS:
        pts = [P(p) for p in bez(PLACES[a], c, PLACES[b])]
        thick(d, pts, S * 0.042, (150, 128, 100))
        thick(d, pts, S * 0.034, (214, 188, 140))
    # Plätze
    for name, (x, y) in PLACES.items():
        r = 7.2
        d.ellipse((*P((x - r, y - r)), *P((x + r, y + r))), fill=(150, 128, 100))
        r = 6.6
        d.ellipse((*P((x - r, y - r)), *P((x + r, y + r))), fill=(196, 178, 150))
    # Brücke: der Platz liegt auf dem Fluss, die Straße quert ihn
    im = im.filter(ImageFilter.GaussianBlur(3))
    im.save(OUT / "layout.png")
    print(f"-> {OUT / 'layout.png'}")


if __name__ == "__main__":
    main()
