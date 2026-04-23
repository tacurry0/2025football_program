
import json
import re

results_data = {
    "data": [
        {"section": 11, "date": "2026-04-18", "home": "新潟", "away": "今治の試合詳細", "home_score": "1", "away_score": "0", "pk": "", "status": "finished"},
        {"section": 11, "date": "2026-04-17", "home": "FC大阪", "away": "愛媛の試合詳細", "home_score": "0", "away_score": "1", "pk": "", "status": "finished"}
    ]
}

def clean_gas(nm):
    if not nm: return ""
    return nm.replace("の試合詳細", "").replace("の結果", "").strip()

full_kws = ["FC東京","FC大阪","FC今治","FC岐阜","FC琉球","YS横浜","京都サンガF.C.","鹿島アントラーズ","浦和レッズ","ガンバ大阪","セレッソ大阪","ヴィッセル神戸"]

def team_match(gas_name, kw):
    c = clean_gas(gas_name)
    if len(kw) < 2: return False
    if c == kw: return True
    if kw not in c: return False
    for fkw in full_kws:
        if fkw != kw and kw in fkw and fkw in c:
            return False
    return True

def find_prev(data, team_kw, cutoff):
    past = [r for r in data if r['date'] < cutoff and (team_match(r['home'], team_kw) or team_match(r['away'], team_kw)) and r['home_score'] != "" and (r['status'] == "finished" or r['status'] == "FT")]
    past.sort(key=lambda x: x['date'], reverse=True)
    if not past: return "Not Found"
    return f"Found: {past[0]['home']} vs {past[0]['away']}"

print("Niigata:", find_prev(results_data['data'], "新潟", "2026-04-25"))
print("FC Osaka:", find_prev(results_data['data'], "FC大阪", "2026-04-25"))
