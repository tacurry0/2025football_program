"""Build compact, refreshable head-to-head details from checked-in official records."""
import datetime as dt
import json
from pathlib import Path
import re

DATA = Path(__file__).resolve().parents[1]
CLUBS = ('niigata', 'kumamoto')


def integer(value):
    text = str(value).replace(',', '').strip()
    return int(text) if re.fullmatch(r'\d+', text) else None


def goals(rows):
    output = []
    for goal in rows if isinstance(rows, list) else []:
        name = str(goal.get('name') or goal.get('scorer') or goal.get('player') or '').strip()
        minute = str(goal.get('minute') if goal.get('minute') is not None else goal.get('time') or '').replace("'", '').replace('分', '').strip()
        own_goal = bool(goal.get('own_goal') or goal.get('is_own_goal') or 'オウンゴール' in name)
        if name or minute:
            output.append(dict(name=name, minute=minute, own_goal=own_goal))
    return output


def players(row, side):
    details = row.get(side + '_details') or {}
    starting = row.get(side + '_starting_members') or details.get('starting') or []
    substitutions = row.get(side + '_substitutions') or details.get('substitutions') or []
    members = {}
    for player in starting:
        name = player.get('name', '') if isinstance(player, dict) else str(player)
        if name:
            members[name] = 1
    for change in substitutions:
        name = change.get('in') or change.get('inName') or (change.get('name') if change.get('in_out') == '▲' else '')
        if name:
            members.setdefault(name, 0)
    complete = len(starting) >= 11 and row.get('detail_complete') is not False and ('substitutions' in details or side + '_substitutions' in row)
    return [[name, starter] for name, starter in members.items()], complete


def record(row, through):
    date = str(row.get('date', '')).replace('/', '-')
    try:
        dt.date.fromisoformat(date)
    except ValueError:
        return None
    home_score, away_score = integer(row.get('home_score')), integer(row.get('away_score'))
    if date > through or home_score is None or away_score is None:
        return None
    home, away = row.get('home_team') or row.get('home'), row.get('away_team') or row.get('away')
    if not home or not away:
        return None
    season = row.get('season_id') or row.get('season') or date[:4]
    if date >= '2026-07-01' and '_' not in str(season):
        year = int(date[:4]) - (int(date[5:7]) < 7)
        season = f'{year}_{year + 1}'
    output = dict(match_id=str(row.get('match_card_id') or row.get('match_id') or ''),
                  date=date, season=str(season), season_id=str(season), home=home, away=away,
                  home_score=home_score, away_score=away_score, status='finished',
                  competition=row.get('competition', ''), venue=row.get('stadium') or row.get('venue') or '',
                  attendance=integer(row.get('attendance')), source_url=row.get('url') or row.get('source_url') or '')
    for key in ('pk_home_score', 'pk_away_score'):
        if row.get(key) not in (None, ''):
            output[key] = integer(row[key])
    if row.get('competition_id'):
        output['competition_id'] = row['competition_id']
    for side, score in [('home', home_score), ('away', away_score)]:
        events = goals(row.get(side + '_goals'))
        members, complete = players(row, side)
        output[side + '_goals'] = events
        output[side + '_players'] = members
        output[side + '_goals_complete'] = len(events) == score and all(g['name'] for g in events)
        output[side + '_players_complete'] = complete
    return output


def build(source_data=DATA, output_data=None, through=None):
    source_data = Path(source_data)
    output_data = Path(output_data or source_data)
    through = through or (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=9)).date().isoformat()
    for club in CLUBS:
        records = {}
        for original in sorted((source_data / 'history' / club).glob('*.json')):
            staged = output_data / 'history' / club / original.name
            source = staged if staged.exists() else original
            payload = json.loads(source.read_text(encoding='utf-8'))
            for row in payload if isinstance(payload, list) else payload.get('data', []):
                packed = record(row, through)
                if not packed:
                    continue
                key = (packed['date'], packed['home'], packed['away'])
                quality = sum(len(packed[side + '_goals']) + len(packed[side + '_players']) for side in ('home', 'away'))
                previous = records.get(key)
                if not previous or quality >= previous[0]:
                    records[key] = (quality, packed)
        rows = sorted((item[1] for item in records.values()), key=lambda r: (r['date'], r['match_id']))
        target = output_data / 'insights' / (club + '_head_to_head.json')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(dict(schemaVersion=1, club=club, through=through, data=rows), ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
        print(f'{club}: {len(rows)} head-to-head records')


if __name__ == '__main__':
    build()
