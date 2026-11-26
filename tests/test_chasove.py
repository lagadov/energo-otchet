import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from chasove import minuti, po_etapi  # noqa: E402


class TestChasove(unittest.TestCase):
    def test_minuti(self):
        self.assertEqual(minuti("10:36", "11:16"), 40)

    def test_krai_predi_nachalo(self):
        with self.assertRaises(ValueError):
            minuti("12:00", "11:00")

    def test_po_etapi(self):
        redove = [
            {"етап": "Е1", "начало": "10:00", "край": "11:30"},
            {"етап": "Е2", "начало": "12:00", "край": "12:30"},
            {"етап": "Е1", "начало": "13:00", "край": "13:30"},
        ]
        self.assertEqual(dict(po_etapi(redove)), {"Е1": 2.0, "Е2": 0.5})


if __name__ == "__main__":
    unittest.main()
