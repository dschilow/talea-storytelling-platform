"""textprep.py and audioprep.py are copies of the Thorsten/Kokoro service files (Railway uploads one folder only).

Run: python -m unittest test_shared_modules
"""
import unittest
from pathlib import Path

HERE = Path(__file__).parent
KOKORO = HERE.parent / "tts-thorsten-kokoro-service"


class SharedModulesTest(unittest.TestCase):
    def test_copies_match_kokoro_service(self):
        for name in ("textprep.py", "audioprep.py"):
            self.assertEqual(
                (HERE / name).read_bytes(),
                (KOKORO / name).read_bytes(),
                f"{name} differs from tts-thorsten-kokoro-service/{name}, copy it over (or update both).",
            )


if __name__ == "__main__":
    unittest.main()
