import unittest

from textprep import Pauses, build_segments, normalize_text, split_sentences

PAUSES = Pauses()


class NormalizeTextTests(unittest.TestCase):
    def test_expands_abbreviations_without_breaking_sentences(self):
        self.assertEqual(normalize_text("Er traf z. B. Dr. Igel."), "Er traf zum Beispiel Doktor Igel.")

    def test_keeps_sentence_end_after_final_abbreviation(self):
        self.assertEqual(
            normalize_text("Äpfel, Birnen usw. Dann ging er."),
            "Äpfel, Birnen und so weiter. Dann ging er.",
        )
        self.assertEqual(normalize_text("Äpfel usw., aber keine Birnen."), "Äpfel und so weiter, aber keine Birnen.")

    def test_reads_times_units_and_numbers(self):
        self.assertEqual(
            normalize_text("Um 9:30 Uhr war es 25 °C und der Turm 330 m hoch."),
            "Um neun Uhr dreißig war es fünfundzwanzig Grad Celsius und der Turm dreihundertdreißig Meter hoch.",
        )

    def test_strips_markdown_emoji_and_repeated_punctuation(self):
        self.assertEqual(normalize_text("**Hilfe!!!** \U0001F43B Wirklich?!"), "Hilfe! Wirklich?")

    def test_reads_parentheses_as_pauses_and_splits_hyphenated_compounds(self):
        self.assertEqual(
            normalize_text("Der Igel (ganz klein) war atmosphärisch-optisch toll."),
            "Der Igel, ganz klein, war atmosphärisch optisch toll.",
        )

    def test_keeps_paragraph_breaks(self):
        self.assertEqual(normalize_text("Erster Absatz.\n\n\u2014 Zweiter Absatz."), "Erster Absatz.\n\nZweiter Absatz.")


class SegmentTests(unittest.TestCase):
    def test_dialogue_tag_stays_with_its_quote(self):
        self.assertEqual(
            split_sentences('"Hilfe!" rief er. Dann rannte er.'),
            [('"Hilfe!" rief er.', "sentence"), ("Dann rannte er.", "sentence")],
        )

    def test_pause_depends_on_punctuation(self):
        segments = build_segments("Wer ist da? Niemand antwortete. Es war still!", PAUSES, 220)
        self.assertEqual([s.pause for s in segments], [PAUSES.question, PAUSES.sentence, PAUSES.end])

    def test_ellipsis_before_lowercase_becomes_suspense_pause(self):
        segments = build_segments("Und dann... war es still. Ganz still.", PAUSES, 220)
        self.assertEqual(
            segments,
            [("Und dann...", PAUSES.ellipsis), ("war es still.", PAUSES.sentence), ("Ganz still.", PAUSES.end)],
        )
        flattened = build_segments("Und dann. war es still.", PAUSES, 220)
        self.assertEqual(flattened[0], ("Und dann.", PAUSES.ellipsis))

    def test_one_word_sentence_joins_the_next(self):
        segments = build_segments("Oh! Da ist ein Igel.", PAUSES, 220)
        self.assertEqual([s.text for s in segments], ["Oh! Da ist ein Igel."])

    def test_paragraph_and_end_pauses(self):
        segments = build_segments("Erster Satz.\nZweiter Satz.", PAUSES, 220)
        self.assertEqual([s.pause for s in segments], [PAUSES.paragraph, PAUSES.end])

    def test_long_sentence_is_split_at_clauses_without_losing_text(self):
        sentence = ", ".join(["Der kleine Fuchs lief durch den Wald"] * 8) + "."
        segments = build_segments(sentence, PAUSES, 120)
        self.assertTrue(all(len(s.text) <= 120 for s in segments))
        self.assertEqual(segments[0].pause, PAUSES.clause)
        self.assertEqual(" ".join(s.text for s in segments), sentence)


if __name__ == "__main__":
    unittest.main()
