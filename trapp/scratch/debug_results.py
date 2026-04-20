import json

def cleanGas(name):
    return (name or "").replace("の試合詳細", "").strip()

def gasMatch(gasName, kw):
    c = cleanGas(gasName)
    return c == kw or kw in c

with open('data/results.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

target = "FC大阪"
matches = []
for r in data['data']:
    if gasMatch(r['home'], target) or gasMatch(r['away'], target):
        matches.append(r)

matches.sort(key=lambda x: x['date'], reverse=True)
for m in matches[:5]:
    print(f"Date: {m['date']}, Home: {m['home']}, Away: {m['away']}, Score: {m['home_score']}-{m['away_score']}")
