import json
import unicodedata

def normalize(s):
    return unicodedata.normalize('NFKC', s or '').strip()

def clean_gas(name):
    return (name or '').replace('の試合詳細', '').strip()

J_TEAM_KWS = [
    'FC東京','東京V','横浜FM','横浜FC','YS横浜','FC大阪','G大阪','C大阪',
    'FC岐阜','FC今治','FC琉球','栃木SC','栃木C','札幌','鹿島','浦和','柏',
    '町田','川崎','湘南','新潟','富山','金沢','清水','藤枝','沼津','磐田',
    '名古屋','岐阜','京都','神戸','奈良','鳥取','岡山','広島','山口','讃岐',
    '徳島','愛媛','今治','福岡','北九州','鳥栖','長崎','熊本','大分','宮崎',
    '鹿児島','琉球','高知','滋賀','八戸','盛岡','秋田','山形','仙台','福島',
    '水戸','群馬','栃木','大宮','千葉','相模原','甲府','松本','長野'
]

def gas_match_strict(gas_name, kw):
    c = normalize(clean_gas(gas_name))
    n_kw = normalize(kw)
    if len(n_kw) < 2:
        return False
    if c == n_kw:
        return True
    if n_kw not in c:
        return False
    # Ensure no longer keyword also matches (prevent 大阪 matching FC大阪)
    for other_kw in J_TEAM_KWS:
        n_other = normalize(other_kw)
        if n_other != n_kw and len(n_other) > len(n_kw) and n_other in c:
            return False
    return True

with open('data/results.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
results = data['data']

def find_prev(team_kw, cutoff):
    past = [r for r in results
            if (gas_match_strict(r['home'], team_kw) or gas_match_strict(r['away'], team_kw))
            and r['date'] < cutoff
            and r['home_score'] not in ('', None)]
    past.sort(key=lambda r: r['date'], reverse=True)
    if not past:
        return '-'
    m = past[0]
    is_home = gas_match_strict(m['home'], team_kw)
    sM = m['home_score'] if is_home else m['away_score']
    sO = m['away_score'] if is_home else m['home_score']
    op = clean_gas(m['away'] if is_home else m['home'])
    wl = '○' if int(sM) > int(sO) else ('●' if int(sM) < int(sO) else '△')
    if m.get('pk') and int(sM) == int(sO):
        wl = 'PK'
    return f"{m['date']} vs {op} {sM}-{sO} {wl} (pk={m.get('pk','')})"

cutoff = '2026-04-25'
print('=== MW12 (2026-04-25) 前節確認 ===')
print()
print(f'【新潟】 前節:     {find_prev("新潟", cutoff)}')
print(f'【FC大阪】 前節:   {find_prev("FC大阪", cutoff)}')
print()
print(f'【熊本】 前節:     {find_prev("熊本", cutoff)}')
print(f'【ガイナーレ鳥取】 前節: {find_prev("鳥取", cutoff)}')
print()

# Also verify wrong match doesn't happen
print('=== 誤マッチテスト ===')
# 大阪 が FC大阪 を拾わないか
test_cases = [
    ('大阪', 'FC大阪'),  # 大阪 should NOT match FC大阪
    ('今治', 'FC今治'),  # 今治 should NOT match FC今治
    ('FC大阪', '大阪'),  # FC大阪 should NOT match 大阪
]
for kw, gas_name in test_cases:
    result = gas_match_strict(gas_name, kw)
    expected = (kw == gas_name or kw in gas_name and len(kw) == len(gas_name))
    # FC大阪 should match FC大阪, but 大阪 should not match FC大阪
    if kw == 'FC大阪' and gas_name == '大阪':
        expected_result = False  # FC大阪 should NOT match raw text "大阪"
    elif kw == 'FC大阪' and gas_name == 'FC大阪':
        expected_result = True
    elif kw == '大阪' and gas_name == 'FC大阪':
        expected_result = False  # 大阪 should NOT match FC大阪 (prevented by longer-match rule)
    else:
        expected_result = None
    print(f'  gasMatchStrict("{gas_name}", "{kw}") = {result} {"✓" if result == expected_result else "✗ (予期値=" + str(expected_result) + ")"}')
