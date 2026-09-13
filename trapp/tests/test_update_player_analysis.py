"""An incomplete upstream response must never overwrite a good snapshot."""
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1] / 'data/scripts'
sys.path.insert(0, str(SCRIPTS))
import update_player_analysis as updater


class SafePublication(unittest.TestCase):
    def test_missing_starting_eleven_keeps_last_good_files(self):
        original = updater.DATA
        tables = {l: json.loads((original / 'standings/2026_2027' / (l + '.json')).read_text()) for l in ('j2', 'j3')}
        def parse(jobs):
            if jobs[0]['type'] == 'detail':
                return [{'status':'finished', 'detail_complete':False} for _ in jobs]
            return [tables[j['league']] if j['type'] == 'standings' else [] for j in jobs]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for folder in ('results/2026_2027', 'details/2026_2027', 'insights'):
                shutil.copytree(original / folder, root / folder)
            before = {str(p.relative_to(root)):p.read_bytes() for p in root.rglob('*.json')}
            with patch.object(updater, 'DATA', root), patch.object(updater, 'TODAY', '2026-09-13'), patch.object(updater, 'get', return_value='fixture'), patch.object(updater, 'parse', side_effect=parse):
                with self.assertRaisesRegex(ValueError, 'Incomplete official detail'):
                    updater.main()
            after = {str(p.relative_to(root)):p.read_bytes() for p in root.rglob('*.json')}
            self.assertEqual(before, after)


if __name__ == '__main__':
    unittest.main()
