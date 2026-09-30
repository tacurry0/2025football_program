#!/usr/bin/env python3
"""Build reusable player cutouts; originals and failed portraits stay untouched.

Install requirements-player-cutouts.txt, then run from any directory.
Only new/changed source bytes are inferred. The browser never loads the model.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import quote

os.environ['ORT_DISABLE_TELEMETRY'] = '1'
os.environ.setdefault('OMP_NUM_THREADS', '2')
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[3]
APP = ROOT / 'trapp'
OUTPUT = APP / 'data/assets/player_cutouts'
MODEL = 'u2net_human_seg'
RECIPE = 'human-v1-webp-alpha'


def sources():
    for club in ('niigata', 'kumamoto'):
        for base in (APP / f'data/assets/images/player_{club}', APP / f'data/assets/player_{club}'):
            if base.exists():
                yield from sorted(p for p in base.iterdir() if p.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp'))
    official_index = APP / 'player-official-index.js'
    if official_index.exists():
        payload = official_index.read_text(encoding='utf-8').split('window.TrappOfficialPlayers =', 1)[1].strip().rstrip(';')
        clubs = json.loads(payload)
        paths = {item.get('photo', '') for players in clubs.values() for item in players.values()}
        for source in sorted(paths):
            if source.startswith('./data/assets/official_players/') and source.endswith('.webp'):
                path = APP / source.removeprefix('./')
                if path.is_file():
                    yield path


def image_key(path):
    recipe = 'official-fullsize-lossless-v1' if 'official_players' in path.parts else RECIPE
    return hashlib.sha256(recipe.encode() + path.read_bytes()).hexdigest()[:24]


def valid_cutout(image):
    alpha = image.getchannel('A')
    hist = alpha.histogram()
    pixels = image.width * image.height
    # Reject empty masks and masks that kept essentially all background.
    return sum(hist[128:]) / pixels > .08 and sum(hist[:32]) / pixels > .02


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--name', help='Process matching source filenames only (preview); do not write the public index')
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    session = None
    index, errors = {}, []
    previous_index = {}
    index_path = APP / 'player-cutouts-index.js'
    if not args.name and index_path.exists():
        try:
            source = index_path.read_text(encoding='utf-8')
            payload = source.split('window.TrappPlayerCutouts =', 1)[1].strip().rstrip(';')
            previous_index = json.loads(payload)
        except (IndexError, json.JSONDecodeError):
            previous_index = {}
    generated = cached = 0
    paths = [p for p in sources() if not args.name or args.name in p.name]
    for pos, path in enumerate(paths, 1):
        key = image_key(path)
        dest = OUTPUT / f'{key}.webp'
        try:
            official = 'official_players' in path.parts
            original_url = './' + path.relative_to(APP).as_posix()
            if official:
                with Image.open(path) as native:
                    if 'A' in native.getbands() and valid_cutout(native.convert('RGBA')):
                        # The club has already cut out the player. Never infer another
                        # mask or re-encode a native transparent portrait.
                        index[original_url] = original_url
                        cached += 1
                        print(f'[{pos}/{len(paths)}] {path.name}: native club transparency', flush=True)
                        continue
            if not dest.exists():
                import onnxruntime as ort
                ort.disable_telemetry_events()
                from rembg import new_session, remove
                if session is None:
                    session = new_session(MODEL, providers=['CPUExecutionProvider'])
                with Image.open(path) as source:
                    original = ImageOps.exif_transpose(source).convert('RGBA')
                    if not official:
                        original.thumbnail((1000, 1000), Image.Resampling.LANCZOS)
                    cutout = remove(original, session=session, alpha_matting=True,
                                    alpha_matting_foreground_threshold=240,
                                    alpha_matting_background_threshold=10,
                                    alpha_matting_erode_size=5).convert('RGBA')
                if not valid_cutout(cutout):
                    raise ValueError('implausible person mask; original retained')
                # Remove blank margins, retaining a small antialiased edge and the full person.
                bounds = cutout.getchannel('A').getbbox()
                if bounds:
                    l,t,r,b = bounds
                    cutout = cutout.crop((max(0,l-2),max(0,t-2),min(cutout.width,r+2),min(cutout.height,b+2)))
                temp = dest.with_suffix('.tmp')
                if official:
                    cutout.save(temp, format='WEBP', lossless=True, method=6)
                else:
                    cutout.save(temp, format='WEBP', quality=92, method=6)
                temp.replace(dest)
                generated += 1
            else:
                cached += 1
            index[original_url] = './' + quote(dest.relative_to(APP).as_posix(), safe='/')
            print(f'[{pos}/{len(paths)}] {path.name} -> {dest.name}', flush=True)
        except Exception as exc:
            errors.append({'source': path.relative_to(APP).as_posix(), 'error': str(exc)})
            source_url = './' + path.relative_to(APP).as_posix()
            previous_cutout = previous_index.get(source_url)
            if (isinstance(previous_cutout, str)
                    and previous_cutout.startswith('./data/assets/player_cutouts/')
                    and previous_cutout.endswith('.webp')
                    and (APP / previous_cutout.removeprefix('./')).is_file()):
                # A transient decode/model failure must not remove a working
                # cutout from the public index; keep the previous asset while
                # retaining the error in the report for later repair.
                index[source_url] = previous_cutout
            print(f'WARNING {path.name}: {exc}', flush=True)
    if not args.name:
        if not index:
            raise SystemExit('No usable cutouts; refusing to replace the public index')
        payload = '/* Generated by build_player_cutouts.py. */\nwindow.TrappPlayerCutouts = ' + json.dumps(index, ensure_ascii=False, sort_keys=True, indent=2) + ';\n'
        index_path.write_text(payload, encoding='utf-8')
        (OUTPUT / 'report.json').write_text(json.dumps({'recipe': RECIPE, 'sources': len(paths), 'ready': len(index), 'errors': errors}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f'Ready: {len(index)}, generated: {generated}, cached: {cached}, failed: {len(errors)}', flush=True)


if __name__ == '__main__':
    main()
