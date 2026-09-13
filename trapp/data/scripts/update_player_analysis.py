"""Refresh official 2026/27 records, validate in a staging directory, then publish.
No credentials or third-party packages required. A failure leaves checked-in data intact.
"""
import concurrent.futures
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import urllib.request
import urllib.parse
import build_2627_player_analysis as builder

DATA = builder.DATA
SEASON = builder.SEASON
CLUBS = set(builder.CLUBS.values())
TODAY = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=9)).date().isoformat()
NOW = dt.datetime.now(dt.timezone.utc).isoformat()


def get(url):
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'trapp/1.0 (+https://github.com/tacurry0/2025football_program)', 'Accept-Language': 'ja'})
            with urllib.request.urlopen(request, timeout=35) as response:
                text = response.read().decode('utf-8')
            if 'self.__next_f.push' not in text:
                raise ValueError('Official JSON records missing: ' + url)
            return text
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def parse(jobs):
    """Run only our checked-in parser; downloaded JavaScript is never evaluated."""
    script = r'''
const fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({console,Utilities:{formatDate:(d,z,f)=>new Date(d.getTime()+32400000).toISOString().slice(f==='HH:mm'?11:0,f==='HH:mm'?16:10)}});
vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),c);
const jobs=JSON.parse(fs.readFileSync(0,'utf8'));
process.stdout.write(JSON.stringify(jobs.map(j=>j.type==='detail'?c.jlParseDetail(j.html,j.path):j.type==='standings'?c.jlParseStandings(j.html,j.league):c.jlParseMatches(j.html,j.league))));
'''
    result = subprocess.run(['node', '-e', script, str(DATA.parent / 'gas/JLeague.gs')], input=json.dumps(jobs), text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


def envelope(league, rows, **extra):
    return dict(schemaVersion=2, status=200, season=SEASON, league=league, fetchedAt=NOW,
                stale=False, complete=True, data=rows, **extra)


def write(path, value):
    builder.write(path, value)


def build_insights(stage):
    for club in builder.CLUBS:
        records = {}
        for source in sorted((DATA / 'history' / club).glob('*.json')):
            if source.stem == SEASON:
                source = stage / 'history' / club / source.name
            rows = json.loads(source.read_text())
            for row in rows if isinstance(rows, list) else rows.get('data', []):
                try:
                    hs, aws = int(row['home_score']), int(row['away_score'])
                except (KeyError, ValueError, TypeError):
                    continue
                date = row.get('date', '')
                if not date or date > TODAY or min(hs, aws) < 0:
                    continue
                record = dict(date=date, home=row.get('home_team'), away=row.get('away_team'),
                              home_score=hs, away_score=aws, status='finished',
                              competition=row.get('competition', ''), pk_home_score=row.get('pk_home_score'),
                              pk_away_score=row.get('pk_away_score'), source_url=row.get('url', ''),
                              match_id=row.get('match_card_id', ''))
                records[(date, record['home'], record['away'])] = record
        write(stage / 'insights' / (club + '.json'), dict(through=TODAY, data=sorted(records.values(), key=lambda r:r['date'])))


def main():
    if not '2026-08-01' <= TODAY <= '2027-07-31':
        raise RuntimeError('Season window ended. Configure the next season before updating.')
    # Refresh every season month, including older corrections, with only two requests in flight.
    months = []
    date = dt.date(2026, 8, 1)
    while date.isoformat() <= min(TODAY, '2027-06-30'):
        next_date = (date.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
        months.append((date.isoformat(), (next_date - dt.timedelta(days=1)).isoformat()))
        date = next_date
    jobs = []
    for league in ('j1', 'j2', 'j3', 'leaguecup', 'emperor'):
        for start, end in months:
            routes = [f'{l}/match/search-list/' for l in ('j1', 'j2', 'j3')] if league == 'emperor' else [f'{league}/match/']
            for route in routes:
                jobs.append(dict(type='results', league=league, url=f'https://www.jleague.jp/{route}?category={league}&startdate={start}&enddate={end}'))
    for league in ('j2', 'j3'):
        jobs.append(dict(type='standings', league=league, url=f'https://www.jleague.jp/{league}/standings/?year=2026-27'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for job, html in zip(jobs, pool.map(get, [j['url'] for j in jobs])):
            job['html'] = html
    parsed = parse(jobs)
    with tempfile.TemporaryDirectory(prefix='trapp-analysis-') as temporary:
        stage = Path(temporary)
        for folder in ('results/' + SEASON, 'details/' + SEASON):
            shutil.copytree(DATA / folder, stage / folder)
        results = {league:{} for league in ('j1', 'j2', 'j3', 'leaguecup', 'emperor')}
        for league, rows in results.items():
            source = DATA / 'insights/j1.json' if league == 'j1' else DATA / 'results' / SEASON / (league + '.json')
            for row in json.loads(source.read_text())['data'] if source.exists() else []:
                rows[row['match_id']] = row
        for job, payload in zip(jobs, parsed):
            league = job['league']
            if job['type'] == 'standings':
                write(stage / 'standings' / SEASON / (league + '.json'), envelope(league, payload['data'], sourceUpdatedAt=payload.get('sourceUpdatedAt'), sourceUrl=job['url']))
            else:
                for row in payload:
                    old = results[league].get(row['match_id'], {})
                    if old.get('status') == 'finished' and row.get('status') != 'finished':
                        continue
                    results[league][row['match_id']] = row
        own = []
        for league, by_id in results.items():
            rows = sorted(by_id.values(), key=lambda r:(r['date'], r['match_id']))
            if not any(r.get('status') == 'finished' for r in rows):
                raise ValueError('No finished records for ' + league)
            write(stage / 'insights/j1.json' if league == 'j1' else stage / 'results' / SEASON / (league + '.json'), envelope(league, rows, scope='jleague_clubs' if league == 'emperor' else league))
            own.extend(r for r in rows if r.get('status') == 'finished' and r['date'] <= TODAY and CLUBS.intersection((r['home'], r['away'])))
        # Re-fetch all our season details to include subsequent official corrections.
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            detail_jobs = [dict(type='detail', path=urllib.parse.urlparse(r['source_url']).path.rstrip('/'), html=html) for r, html in zip(own, pool.map(get, [r['source_url'] for r in own]))]
        for original, row in zip(own, parse(detail_jobs)):
            if row.get('status') != 'finished' or not row.get('detail_complete') or any(len(row.get(side + '_starting_members', [])) != 11 for side in ('home', 'away')):
                raise ValueError('Incomplete official detail: ' + original['match_id'])
            if (row['match_id'], row['home_score'], row['away_score']) != (original['match_id'], original['home_score'], original['away_score']):
                raise ValueError('Result/detail mismatch: ' + original['match_id'])
            row['detail_fetched_at'] = NOW
            write(stage / 'details' / SEASON / row['league'] / (row['match_id'] + '.json'), envelope(row['league'], [row]))
        for club in builder.CLUBS:
            target = stage / 'generated' / club
            target.mkdir(parents=True)
            shutil.copy2(DATA / 'generated' / club / 'all_years_player_analysis.json', target)
        previous = builder.DATA
        builder.DATA = stage
        try:
            builder.build(TODAY)
        finally:
            builder.DATA = previous
        build_insights(stage)
        # A revision changes only when the derived analysis changes, not merely on each poll.
        digest = hashlib.sha256()
        for file in sorted((stage / 'generated').rglob('*.json')):
            if file.name != 'metadata.json':
                digest.update(file.read_bytes())
        revision = digest.hexdigest()[:16]
        hashes = {str(p.relative_to(stage)):hashlib.sha256(p.read_bytes()).hexdigest() for folder in ('generated', 'history') for p in sorted((stage / folder).rglob('*.json')) if p.name != 'metadata.json'}
        write(stage / 'generated' / 'update.json', dict(schemaVersion=1, season=SEASON, revision=revision, checkedAt=NOW, files=hashes,
            clubs={club:json.loads((stage / 'generated' / club / SEASON / 'metadata.json').read_text()) for club in builder.CLUBS}))
        # The workflow commits all validated files atomically after this process succeeds.
        for file in sorted(stage.rglob('*.json')):
            target = DATA / file.relative_to(stage)
            target.parent.mkdir(parents=True, exist_ok=True)
            os.replace(file, target)
        print('Validated update:', revision, len(own), 'official matches')


if __name__ == '__main__':
    import urllib.parse
    main()
