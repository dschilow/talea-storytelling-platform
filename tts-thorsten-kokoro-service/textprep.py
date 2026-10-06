"""Text preparation for the Thorsten-Voice (Kokoro) service.

Pure Python without model imports, so it can be unit tested without torch.
normalize_text() turns story text into something the German G2P reads cleanly,
build_segments() cuts it into sentences and decides the silence after each one.
"""
import re
import unicodedata
from typing import List, NamedTuple, Tuple

try:
    from num2words import num2words
except Exception:  # pragma: no cover - optional dependency
    num2words = None


class Pauses(NamedTuple):
    """Silence in seconds after a segment, chosen by how the segment ends."""

    clause: float = 0.15
    colon: float = 0.35
    sentence: float = 0.45
    exclamation: float = 0.5
    question: float = 0.55
    ellipsis: float = 0.8
    paragraph: float = 1.0
    end: float = 0.8  # after the last segment, so consecutive chunks do not run into each other


class Segment(NamedTuple):
    text: str
    pause: float


# -----------------------------------------------------------------------------
# Normalisation
# -----------------------------------------------------------------------------
_INLINE_TAG_RE = re.compile(r"\[[A-Za-z][A-Za-z \-]{1,24}\]")  # e.g. [pause], [laugh] (xAI speech tags)
_WRAP_TAG_RE = re.compile(r"</?[A-Za-z][A-Za-z\-]{1,24}>")  # e.g. <whisper>...</whisper>
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_MARKDOWN_LINE_RE = re.compile(r"(?m)^[ \t]*(?:#{1,6}|>|[-*+](?=\s))[ \t]*")
_THOUSANDS_RE = re.compile(r"(?<![\d.,])(\d{1,3}(?:\.\d{3})+)(?![\d])")
_DECIMAL_RE = re.compile(r"(?<![\d])(\d+),(\d+)(?![\d])")
_NUMBER_RE = re.compile(r"(?<![\w])\d+(?![\w])")
_TIME_RE = re.compile(r"(?<![\d])(\d{1,2})[:.](\d{2})\s*Uhr\b")
_YEAR_CONTEXT_RE = re.compile(
    r"\b(Jahr|Jahre|Jahres|Jahren|im|seit|bis|ab|von|um|vor|nach|anno|Anno|Ende|Anfang|Mitte)\s+(1[1-9]\d\d|20\d\d)(?!\d)"
)
_MONTHS = "Januar|Februar|M\u00e4rz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember"
_DATE_RE = re.compile(r"(?<![\d])(\d{1,2})\.\s*(" + _MONTHS + r")\b")
_ORDINAL_RE = re.compile(r"\b(?i:(am|im|zum|vom|beim|zur|den|dem))\s+(\d{1,2})\.(?=\s+[A-Z\u00c4\u00d6\u00dc])")
_LETTER = r"[^\W\d_]"
_HYPHEN_COMPOUND_RE = re.compile(rf"(?<={_LETTER})-(?={_LETTER})")
_ELONGATION_RE = re.compile(rf"({_LETTER})\1{{3,}}")

_ABBREVIATIONS = [
    (re.compile(r"\bz\.\s?B\."), "zum Beispiel"),
    (re.compile(r"\bu\.\s?a\."), "unter anderem"),
    (re.compile(r"\bd\.\s?h\."), "das hei\u00dft"),
    (re.compile(r"\bu\.\s?U\."), "unter Umst\u00e4nden"),
    (re.compile(r"\bo\.\s?\u00c4\."), "oder \u00c4hnliches"),
    (re.compile(r"\bbzw\."), "beziehungsweise"),
    (re.compile(r"\bca\."), "circa"),
    (re.compile(r"\bevtl\."), "eventuell"),
    (re.compile(r"\bggf\."), "gegebenenfalls"),
    (re.compile(r"\bvgl\."), "vergleiche"),
    (re.compile(r"\bDr\."), "Doktor"),
    (re.compile(r"\bProf\."), "Professor"),
    (re.compile(r"\bHr\."), "Herr"),
    (re.compile(r"\bNr\."), "Nummer"),
    (re.compile(r"\bSt\.(?=\s+[A-Z\u00c4\u00d6\u00dc])"), "Sankt"),
    (re.compile(r"\bMio\."), "Millionen"),
    (re.compile(r"\bMrd\."), "Milliarden"),
    (re.compile(r"\bJh\."), "Jahrhundert"),
]
# These may end a sentence; the period is kept when a new sentence follows.
_FINAL_ABBREVIATIONS = [
    (re.compile(r"\busw\."), "und so weiter"),
    (re.compile(r"\betc\."), "et cetera"),
]
_UNITS = [
    (re.compile(r"(?<=\d)\s*\u00b0\s*C\b"), " Grad Celsius"),
    (re.compile(r"(?<=\d)\s*\u00b0"), " Grad"),
    (re.compile(r"(?<=\d)\s*km/h\b"), " Kilometer pro Stunde"),
    (re.compile(r"(?<=\d)\s*km\b"), " Kilometer"),
    (re.compile(r"(?<=\d)\s*kg\b"), " Kilogramm"),
    (re.compile(r"(?<=\d)\s*cm\b"), " Zentimeter"),
    (re.compile(r"(?<=\d)\s*mm\b"), " Millimeter"),
    (re.compile(r"(?<=\d)\s*m\b"), " Meter"),
]
_DROPPED_CATEGORIES = {"So", "Sk", "Cf", "Co", "Cs", "Cn"}  # emoji, symbols, zero-width/format chars


def _spell_number(match: "re.Match[str]") -> str:
    raw = match.group(0)
    try:
        value = int(raw)
        if num2words is None:
            return raw
        return num2words(value, lang="de")
    except Exception:
        return raw


def _spell_decimal(match: "re.Match[str]") -> str:
    if num2words is None:
        return match.group(0)
    try:
        whole = num2words(int(match.group(1)), lang="de")
        frac = " ".join(num2words(int(d), lang="de") for d in match.group(2))
        return f"{whole} Komma {frac}"
    except Exception:
        return match.group(0)


def _ordinal(value: int, suffix: str = "n") -> str:
    if num2words is None:
        return str(value)
    try:
        base = num2words(value, lang="de", to="ordinal")  # e.g. "zweite"
        return base + suffix if not base.endswith("n") else base
    except Exception:
        return str(value)


def _cardinal_thousands(match: "re.Match[str]") -> str:
    digits = match.group(1).replace(".", "")
    try:
        return num2words(int(digits), lang="de") if num2words else digits
    except Exception:
        return digits


def _year_in_context(match: "re.Match[str]") -> str:
    try:
        return f"{match.group(1)} {num2words(int(match.group(2)), lang='de', to='year')}"
    except Exception:
        return match.group(0)


def _clock_time(match: "re.Match[str]") -> str:
    hours, minutes = int(match.group(1)), int(match.group(2))
    if num2words is None or hours > 24 or minutes > 59:
        return match.group(0)
    spoken = f"{num2words(hours, lang='de')} Uhr"
    return f"{spoken} {num2words(minutes, lang='de')}" if minutes else spoken


def _expand_final_abbreviation(replacement: str):
    def expand(match: "re.Match[str]") -> str:
        rest = match.string[match.end():].lstrip(" \t")
        ends_sentence = not rest or rest[0] == "\n" or rest[0].isupper()
        return replacement + ("." if ends_sentence else "")

    return expand


def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFC", text or "")
    text = _CONTROL_RE.sub("", text)
    text = _INLINE_TAG_RE.sub(" ", text)
    text = _WRAP_TAG_RE.sub("", text)
    # Units need their symbols (e.g. the degree sign), so they go before the symbol filter.
    for pattern, replacement in _UNITS:
        text = pattern.sub(replacement, text)
    text = "".join(ch for ch in text if unicodedata.category(ch) not in _DROPPED_CATEGORIES)
    # Markdown leftovers from generated stories: headings, quotes, bullets, emphasis
    text = _MARKDOWN_LINE_RE.sub("", text)
    text = re.sub(r"[*~`]+", "", text)
    text = text.replace("_", " ")
    # Quotes: German/French/typographic -> plain ASCII
    text = re.sub("[\u201c\u201d\u201e\u201f\u00ab\u00bb\u2033\u301d\u301e\u301f\uff02]", '"', text)
    text = re.sub("[\u2018\u2019\u201a\u201b\u2039\u203a\u2032\uff07]", "'", text)
    # Asides in parentheses are read with a short pause instead of the brackets
    text = re.sub(r"[ \t]*[()][ \t]*", ", ", text)
    # Dashes become a soft pause, ellipsis stays a pause
    text = re.sub(r"[ \t]*[\u2013\u2014\u2015][ \t]*", ", ", text)
    text = re.sub(r"[ \t]+-[ \t]+", ", ", text)
    text = text.replace("\u2026", "...")
    text = re.sub(r"\.{4,}", "...", text)
    text = re.sub(r"(?<!\.)\.\.(?!\.)", ".", text)
    text = re.sub(r"[!?]*\?[!?]*", "?", text)
    text = re.sub(r"!{2,}", "!", text)
    for pattern, replacement in _ABBREVIATIONS:
        text = pattern.sub(replacement, text)
    for pattern, replacement in _FINAL_ABBREVIATIONS:
        text = pattern.sub(_expand_final_abbreviation(replacement), text)
    text = text.replace("&", " und ").replace("%", " Prozent").replace("\u20ac", " Euro")
    # Numbers -> German words
    text = _TIME_RE.sub(_clock_time, text)
    text = _DATE_RE.sub(lambda m: f"{_ordinal(int(m.group(1)))} {m.group(2)}", text)
    text = _ORDINAL_RE.sub(lambda m: f"{m.group(1)} {_ordinal(int(m.group(2)))}", text)
    text = _THOUSANDS_RE.sub(_cardinal_thousands, text)
    text = _YEAR_CONTEXT_RE.sub(_year_in_context, text)
    text = _DECIMAL_RE.sub(_spell_decimal, text)
    text = _NUMBER_RE.sub(_spell_number, text)
    # Hyphenated compounds make the G2P stumble (known model limitation); "Neeeein" -> "Neein"
    text = _HYPHEN_COMPOUND_RE.sub(" ", text)
    text = _ELONGATION_RE.sub(r"\1\1", text)
    # Tidy up punctuation left behind by the replacements above
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r",( *,)+", ",", text)
    text = re.sub(r", *(?=[.!?:;])", "", text)
    text = re.sub(r" +(?=[,.!?:;])", "", text)
    text = re.sub(r"(?m)^[, ]+", "", text)
    text = re.sub(r"(?m)[, ]+$", "", text)
    return text.strip()


# -----------------------------------------------------------------------------
# Segmentation
# -----------------------------------------------------------------------------
_BOUNDARY_RE = re.compile(r"(\.\.\.|[.!?])([\"')\]]*)(\s+)")
_CLOSING_RE = re.compile(r"[\"')\]]+$")
_SHORT_SENTENCE_MAX_CHARS = 10


def _ending_kind(sentence: str) -> str:
    core = _CLOSING_RE.sub("", sentence.rstrip())
    if core.endswith("..."):
        return "ellipsis"
    if core.endswith("?"):
        return "question"
    if core.endswith("!"):
        return "exclamation"
    if core.endswith((":", ";")):
        return "colon"
    return "sentence"


def split_sentences(paragraph: str) -> List[Tuple[str, str]]:
    """Return [(sentence, ending_kind)] for one paragraph."""
    out: List[Tuple[str, str]] = []
    start = 0
    for match in _BOUNDARY_RE.finditer(paragraph):
        following = paragraph[match.end():match.end() + 1]
        if not following:
            continue
        if following.isupper() or following.isdigit() or following in "\"'(":
            kind = None
        elif match.group(1) in (".", "..."):
            # "Und dann... war es still": a suspense pause inside the sentence. A lone "."
            # before a lowercase word is an ellipsis that upstream normalisation flattened.
            kind = "ellipsis"
        else:
            continue  # '"Hilfe!" rief er' - the dialogue tag belongs to the same sentence
        sentence = paragraph[start:match.end()].strip()
        if sentence:
            out.append((sentence, kind or _ending_kind(sentence)))
        start = match.end()
    tail = paragraph[start:].strip()
    if tail:
        out.append((tail, _ending_kind(tail)))
    return out


def _split_long(sentence: str, limit: int) -> List[str]:
    """Split an over-long sentence at clause boundaries, then at spaces."""
    if len(sentence) <= limit:
        return [sentence]
    parts = re.split(r"(?<=[,;:])\s+", sentence)
    out, buf = [], ""
    for part in parts:
        candidate = f"{buf} {part}".strip() if buf else part
        if len(candidate) <= limit:
            buf = candidate
            continue
        if buf:
            out.append(buf)
        if len(part) <= limit:
            buf = part
            continue
        words, cur = part.split(" "), ""
        for word in words:
            nxt = f"{cur} {word}".strip()
            if len(nxt) > limit and cur:
                out.append(cur)
                cur = word
            else:
                cur = nxt
        buf = cur
    if buf:
        out.append(buf)
    return out


def _merge_short(sentences: List[Tuple[str, str]], limit: int) -> List[Tuple[str, str]]:
    """Attach one-word sentences ("Oh!", "Ja.") to the next one; alone they come out clipped."""
    merged: List[Tuple[str, str]] = []
    carry = ""
    for sentence, kind in sentences:
        if carry:
            candidate = f"{carry} {sentence}"
            if len(candidate) <= limit:
                sentence = candidate
            else:
                merged.append((carry, _ending_kind(carry)))
            carry = ""
        is_short = " " not in sentence and len(sentence) <= _SHORT_SENTENCE_MAX_CHARS
        if is_short and kind != "ellipsis":
            carry = sentence
            continue
        merged.append((sentence, kind))
    if carry:
        merged.append((carry, _ending_kind(carry)))
    return merged


def build_segments(text: str, pauses: Pauses, max_chars: int) -> List[Segment]:
    """Cut normalised text into sentence segments with the silence that follows each."""
    segments: List[Segment] = []
    paragraphs = [p.strip() for p in re.split(r"\n+", text) if p.strip()]
    for p_index, paragraph in enumerate(paragraphs):
        paragraph_segments: List[Segment] = []
        for sentence, kind in _merge_short(split_sentences(paragraph), max_chars):
            parts = _split_long(sentence, max_chars)
            for i, part in enumerate(parts):
                if i < len(parts) - 1:
                    part_kind = "colon" if part.endswith((":", ";")) else "clause"
                else:
                    part_kind = kind
                paragraph_segments.append(Segment(part, getattr(pauses, part_kind)))
        if not paragraph_segments:
            continue
        last = paragraph_segments[-1]
        closing = pauses.end if p_index == len(paragraphs) - 1 else pauses.paragraph
        paragraph_segments[-1] = Segment(last.text, max(last.pause, closing))
        segments.extend(paragraph_segments)
    return segments
