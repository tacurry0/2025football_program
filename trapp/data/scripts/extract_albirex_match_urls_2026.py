#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Albirex Niigata Full Match Scraper
- アルビレックス新潟の全期間・全大会の試合URLを収集
- リーグ戦、カップ戦、サテライト、天皇杯などすべて取得
- 年別に自動振り分けしてJSON保存 (例: 1999.json, 2026.json)
- 大会名と節（例: 1回戦第1戦）を正確に分離
"""

import json
import re
import time
import unicodedata
from pathlib import Path

import requests
from bs4 import BeautifulSoup

SEARCH_URL = "https://data.j-league.or.jp/SFMS01/search?team_ids=78&home_away_select=0&tv_relay_station_name="
BASE_URL = "https://data.j-league.or.jp"

DATA_DIR = Path("data")
RESUME_FILE = Path("resume.json")
ERROR_LOG = Path("error.log")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
}


def clean(text):
    if text is None:
        return ""
    text = str(text).replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def normalize_text(text):
    return unicodedata.normalize("NFKC", clean(text))


def log_error(msg):
    with open(ERROR_LOG, "a", encoding="utf-8") as f:
        f.write(msg + "\n")


def load_resume():
    if RESUME_FILE.exists():
        return json.loads(RESUME_FILE.read_text(encoding="utf-8"))
    return {"completed": []}


def save_resume(data):
    RESUME_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def get_soup(url):
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or r.encoding
    return BeautifulSoup(r.text, "html.parser")


def collect_match_urls():
    results = []
    seen = set()
    page = 1

    while True:
        url = f"{SEARCH_URL}&page={page}"
        print(f"Fetching match list page {page}...")
        soup = get_soup(url)

        page_matches = 0
        for a in soup.find_all("a", href=True):
            href = a["href"]

            if "SFMS02" not in href:
                continue

            m = re.search(r"match_card_id=(\d+)", href)
            if not m:
                continue

            match_id = m.group(1)
            if match_id in seen:
                continue

            seen.add(match_id)
            full_url = href if href.startswith("http") else BASE_URL + href

            results.append({
                "match_card_id": match_id,
                "url": full_url
            })
            page_matches += 1

        if page_matches == 0:
            break

        page += 1
        time.sleep(1)

    return results


def parse_detail(url):
    soup = get_soup(url)

    data = {
        "url": url,
        "season": "",
        "competition": "",
        "section": "",
        "home_team": "",
        "away_team": "",
        "home_score": "",
        "away_score": "",
        "date": "",
        "kickoff": "",
        "stadium": "",
        "attendance": "",
        "weather": "",
        "temperature": "",
        "humidity": "",
        "home_goals": [],
        "away_goals": [],
        "stats": [],
        "home_details": {
            "starting": [], "substitutes": [], "substitutions": [], "cards": [], "manager": ""
        },
        "away_details": {
            "starting": [], "substitutes": [], "substitutions": [], "cards": [], "manager": ""
        },
        "referees": {}
    }

    t_txt = soup.find("p", class_="t-txt")
    if t_txt:
        title_text = normalize_text(t_txt.get_text(separator=" ", strip=True))

        # 【修正箇所1】カップ戦の「1回戦」「準決勝」やリーグ戦の「第〇節」などに幅広く対応
        m_section = re.search(r"^(.*?)\s+((?:第\d+節|\d+回戦|準々決勝|準決勝|決勝|グループ|プール|順位決定戦).*)$", title_text)
        if m_section:
            front_part = m_section.group(1).strip()
            data["section"] = m_section.group(2).strip()
        else:
            front_part = title_text

        # 【修正箇所2】先頭の4桁の数字「だけ」を確実に年として抜き出す
        m_year = re.search(r"^(\d{4})", front_part)
        if m_year:
            data["season"] = m_year.group(1)
            # 4桁数字以降のテキストを大会名とする。「特別」などの文字が残っていれば消す
            data["competition"] = re.sub(r"^特別\s*", "", front_part[4:].strip())
        else:
            data["competition"] = front_part

    team_l = soup.find("th", id="team-name-l")
    if team_l:
        data["home_team"] = clean(team_l.get_text(strip=True))

    team_r = soup.find("th", id="team-name-r")
    if team_r:
        data["away_team"] = clean(team_r.get_text(strip=True))

    scores = soup.find_all("td", class_="score")
    if len(scores) >= 2:
        data["home_score"] = clean(scores[0].get_text(strip=True))
        data["away_score"] = clean(scores[1].get_text(strip=True))

    score_board = soup.find("div", class_="score-board-pk")
    if score_board:
        l_area = score_board.find("td", class_="left-area")
        r_area = score_board.find("td", class_="right-area")

        def extract_goals(area):
            goals = []
            if area:
                for tr in area.find_all("tr"):
                    tds = tr.find_all("td")
                    if len(tds) >= 2:
                        t1 = clean(tds[0].get_text(strip=True))
                        t2 = clean(tds[1].get_text(strip=True))
                        if "'" in t1:
                            goals.append({"time": t1, "name": t2})
                        else:
                            goals.append({"time": t2, "name": t1})
            return goals

        data["home_goals"] = extract_goals(l_area)
        data["away_goals"] = extract_goals(r_area)

    stats_area = soup.find("div", class_="score-board-other")
    if stats_area:
        for dl in stats_area.find_all("dl", class_="score-board-base"):
            dt = dl.find("dt")
            l_score = dl.find("div", class_="left-score")
            r_score = dl.find("div", class_="right-score")
            if dt and l_score and r_score:
                data["stats"].append({
                    "type": clean(dt.get_text(strip=True)),
                    "home": clean(l_score.get_text(strip=True)),
                    "away": clean(r_score.get_text(strip=True))
                })

    bottom_table = soup.select_one(".two-column-table-bottom table tbody tr")
    if bottom_table:
        tds = bottom_table.find_all("td")
        if len(tds) >= 7:
            data["date"] = clean(tds[0].get_text(strip=True))
            data["kickoff"] = clean(tds[1].get_text(strip=True))
            data["stadium"] = clean(tds[2].get_text(strip=True))
            data["attendance"] = re.sub(r"[^\d]", "", clean(tds[3].get_text()))
            data["weather"] = clean(tds[4].get_text(strip=True))
            data["temperature"] = clean(tds[5].get_text(strip=True))
            data["humidity"] = clean(tds[6].get_text(strip=True))

    ref_areas = soup.select(".two-column-table-bottom .clearbox dl")
    for dl in ref_areas:
        dt = dl.find("dt")
        dd = dl.find("dd")
        if dt and dd:
            data["referees"][clean(dt.get_text(strip=True))] = clean(dd.get_text(strip=True))

    def parse_team_details(box):
        details = {
            "starting": [], "substitutes": [], "substitutions": [], "cards": [], "manager": ""
        }
        if not box:
            return details

        for sec in box.find_all("h4", class_="two-column-table-st-base"):
            sec_title = clean(sec.get_text(strip=True))
            table_div = sec.find_next_sibling("div", class_="two-column-table-base")
            if not table_div:
                continue

            for row in table_div.find_all("tr"):
                cols = [clean(td.get_text(strip=True)) for td in row.find_all(["th", "td"])]
                if not any(cols):
                    continue

                if sec_title == "先発" and len(cols) >= 3:
                    details["starting"].append({"position": cols[0], "number": cols[1], "name": cols[2]})
                elif sec_title == "控え" and len(cols) >= 3:
                    details["substitutes"].append({"position": cols[0], "number": cols[1], "name": cols[2]})
                elif sec_title == "交代" and len(cols) >= 4:
                    details["substitutions"].append({"in_out": cols[1], "name": cols[2], "time": cols[3]})
                elif sec_title in ["警告", "退場"] and len(cols) >= 4:
                    details["cards"].append({"type": sec_title, "name": cols[2], "time": cols[3]})
                elif sec_title == "監督" and len(cols) >= 3:
                    details["manager"] = cols[2]
        return details

    for l_box in soup.select(".two-column-table-box-l"):
        src = parse_team_details(l_box)
        for k in src:
            if isinstance(src[k], list): data["home_details"][k].extend(src[k])
            elif src[k]: data["home_details"][k] = src[k]

    for r_box in soup.select(".two-column-table-box-r"):
        src = parse_team_details(r_box)
        for k in src:
            if isinstance(src[k], list): data["away_details"][k].extend(src[k])
            elif src[k]: data["away_details"][k] = src[k]

    # タイトルから年号が取れなかった場合は試合日から補完
    if not data["season"] and data.get("date"):
        m_date = re.search(r"^(\d{4})", data["date"])
        if m_date:
            data["season"] = m_date.group(1)

    return data


def save_year_record(record):
    # ファイル名に使えない文字が入らないよう念のための処置
    year = str(record.get("season") or "unknown")
    year = re.sub(r'[\\/:*?"<>|]', "_", year)
    
    DATA_DIR.mkdir(exist_ok=True)
    file = DATA_DIR / f"{year}.json"

    if file.exists():
        current = json.loads(file.read_text(encoding="utf-8"))
    else:
        current = []

    current.append(record)

    file.write_text(
        json.dumps(current, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def main():
    print("Collecting match URLs from J.League Data Site...")
    matches = collect_match_urls()
    print(f"Total {len(matches)} matches found across all years.")

    resume = load_resume()
    completed = set(resume.get("completed", []))

    saved_count = 0

    for idx, match in enumerate(matches, start=1):
        match_id = match["match_card_id"]

        if match_id in completed:
            continue

        try:
            detail = parse_detail(match["url"])
            record = {"match_card_id": match_id, **detail}

            save_year_record(record)
            
            completed.add(match_id)
            save_resume({"completed": sorted(completed)})

            saved_count += 1
            print(f"[{idx}/{len(matches)}] OK {match_id} | {record.get('season')} {record.get('competition')} | {record.get('section')}")
            time.sleep(1)

        except Exception as e:
            msg = f"{match_id} {match['url']} {e}"
            print("ERROR", msg)
            log_error(msg)

    print("\nDONE")
    print(f"Total matches saved: {saved_count}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        input("\nEnterキーを押して終了してください...")