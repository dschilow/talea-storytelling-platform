"""Losslessly convert the existing, OFL-licensed brand font to WOFF2.

Requires fonttools and brotli. Run from the repository root:
python scripts/performance/convert-font.py
"""
from pathlib import Path
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[2]
source = root / 'frontend/public/fonts/fredoka-variable.ttf'
output = source.with_suffix('.woff2')
font = TTFont(source)
font.flavor = 'woff2'
font.save(output)
converted = TTFont(output)
assert font.getBestCmap() == converted.getBestCmap()
assert [(axis.axisTag, axis.minValue, axis.defaultValue, axis.maxValue) for axis in font['fvar'].axes] == [
    (axis.axisTag, axis.minValue, axis.defaultValue, axis.maxValue) for axis in converted['fvar'].axes
]
print(f'{source.name}: {source.stat().st_size} bytes -> {output.name}: {output.stat().st_size} bytes')
