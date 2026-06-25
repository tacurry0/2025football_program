#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Albirex Niigata old official past match merger - fixed v3

目的:
- https://www.albirex.co.jp/past/seasondata.htm から旧公式の試合結果ページをたどる
- 既存の data/history/niigata/{year}.json の末尾に、天皇杯 / サテライト / プレシーズン / ワールドチャレンジ を追記する
- なでしこ / レディース / 女子 / プレナス は除外する
- 旧公式のフッター、会社情報、郵便番号などを試合として誤検出しない
- 既存JSONのキー順・構造に合わせる

推奨:
  py .\\data\\scripts\\merge_albirex_past_extra_matches_into_history_fixed_v3.py --dry-run
  py .\\data\\scripts\\merge_albirex_past_extra_matches_into_history_fixed_v3.py

必要ライブラリ:
  py -m pip install requests beautifulsoup4
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import time
import unicodedata
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, NavigableString, Tag

START_URL = "https://www.albirex.co.jp/past/seasondata.htm"
DEFAULT_INPUT_DIR = Path(r"C:\Users\takahashi\Desktop\2025football_program\trapp\data\history\niigata")
TEAM_NAME = "アルビレックス新潟"

DEBUG_DIR = Path("debug_albirex_past_extra_matches_fixed_v3")
ERROR_LOG = Path("error_albirex_past_extra_matches_fixed.log")
SLEEP_SECONDS = 0.35

TARGET_COMPETITION_KEYWORDS = ["天皇杯", "サテライト", "プレシーズン", "ワールドチャレンジ"]
EXCLUDE_COMPETITION_KEYWORDS = ["なでしこ", "レディース", "女子", "プレナス"]

# 会場からホーム/アウェイを推定するためのキーワード。旧公式はスコアが新潟目線で載るため、ここが重要。
NIIGATA_HOME_KEYWORDS = [
    "新潟", "東北電力ビッグスワン", "ビッグスワン", "デンカビッグスワン", "新潟スタジアム",
    "新潟市陸上競技場", "新発田市五十公野", "五十公野", "聖籠", "アルビレッジ", "長岡",
    "胎内", "十日町", "柏崎", "刈羽", "上越",
]

TV_OR_NOISE_TOKENS = [
    "BS", "NHK", "J SPORTS", "JSPORTS", "スカイ", "Skp", "SKY", "テレビ", "TV", "ラジオ", "NST",
    "TeNY", "NT21", "BSN", "MX", "TBS", "フジ", "ShowTime", "録", "ライブ", "Ch", "ch",
    "インターネット", "中継", "決定次第", "未定", "※", "こちら", "PDF",
]

VENUE_KEYWORDS = [
    "スタジアム", "競技場", "陸上競技場", "サッカー場", "グラウンド", "球技場", "アリーナ", "ドーム",
    "公園", "広場", "フィールド", "運動場", "体育場", "国立",
]

# 旧公式ページは本文の直後に会社情報・住所・TEL/FAXが続く。
# ここをHTML段階で切り落としてから解析しないと、郵便番号 950-0954 などをスコア候補として拾う事故が起きる。
FOOTER_CUT_MARKERS = [
    "株式会社 アルビレックス新潟",
    "株式会社アルビレックス新潟",
    "〒950-0954",
    "TEL 025",
    "Copyright(C) ALBIREX",
    "Copyright (C) ALBIREX",
]

FATAL_NOISE_WORDS = [
    "株式会社", "〒", "TEL", "FAX", "Copyright", "ページのトップ", "戻る", "お問い合わせ",
    "ALBIREX NIIGATA INC", "新潟市中央区美咲町",
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
}

DEFAULT_SCHEMA_KEYS = [
    "match_card_id", "url", "season", "competition", "section", "home_team", "away_team",
    "home_score", "away_score", "pk_home_score", "pk_away_score", "date", "kickoff", "stadium",
    "attendance", "weather", "temperature", "humidity", "home_goals", "away_goals", "stats",
    "home_details", "away_details", "referees",
]


def clean(text) -> str:
    if text is None:
        return ""
    s = str(text).replace("\xa0", " ").replace("\u3000", " ")
    return re.sub(r"\s+", " ", s).strip()


def normalize_text(text) -> str:
    return unicodedata.normalize("NFKC", clean(text))


def normalize_team_name(name: str) -> str:
    s = normalize_text(name)
    replacements = {
        "ＦＣ": "FC", "Ｆ．Ｃ．": "F.C.", "Ｆ・Ｃ": "F・C", "ＪＥＦ": "JEF",
        "横浜Ｆ・マリノス": "横浜F・マリノス", "横浜ＦＣ": "横浜FC",
        "ジュビロヤマハスタジアム": "ヤマハスタジアム",
    }
    for a, b in replacements.items():
        s = s.replace(a, b)
    return s


def normalize_minute(text: str) -> str:
    s = normalize_text(text).replace("’", "'").replace("′", "'").replace("`", "'").replace("※", "'")
    m = re.search(r"(\d{1,3})\s*'\s*\+\s*(\d{1,2})", s)
    if m:
        return f"{m.group(1)}'+{m.group(2)}"
    m = re.search(r"(\d{1,3})\s*'", s)
    if m:
        return f"{m.group(1)}'"
    m = re.search(r"(\d{1,3})\s*分", s)
    if m:
        return f"{m.group(1)}'"
    m = re.search(r"^(\d{1,3})$", s)
    if m:
        return f"{m.group(1)}'"
    return s


def log_error(msg: str) -> None:
    ERROR_LOG.parent.mkdir(parents=True, exist_ok=True)
    with ERROR_LOG.open("a", encoding="utf-8") as f:
        f.write(msg + "\n")


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def decode_html(raw: bytes, content_type: str = "") -> str:
    head = raw[:6000].decode("ascii", errors="ignore").lower()
    ct = content_type.lower()
    candidates: list[str] = []
    if any(x in head or x in ct for x in ["shift_jis", "x-sjis", "sjis", "windows-31j"]):
        candidates += ["cp932", "shift_jis"]
    if "utf-8" in head or "utf-8" in ct:
        candidates.append("utf-8")
    candidates += ["cp932", "shift_jis", "euc_jp", "utf-8"]

    seen = set()
    candidates = [c for c in candidates if not (c in seen or seen.add(c))]
    best_text = ""
    best_score = 10**9
    for enc in candidates:
        text = raw.decode(enc, errors="replace")
        bad = text.count("\ufffd") + text.count("縺") * 3 + text.count("荳") * 3 + text.count("譁") * 3
        good = sum(text.count(k) for k in ["アルビレックス", "新潟", "天皇杯", "サテライト", "試合", "得点", "監督"])
        score = bad * 10 - good
        if score < best_score:
            best_score = score
            best_text = text
    return best_text


def cut_html_footer(html: str) -> str:
    """本文後の会社情報・住所・TEL/FAXを解析対象から完全に外す。"""
    cut_positions = [html.find(marker) for marker in FOOTER_CUT_MARKERS if html.find(marker) != -1]
    if not cut_positions:
        return html
    return html[:min(cut_positions)]


def fetch_page_html(url: str, *, cut_footer: bool = True) -> str:
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    html = decode_html(r.content, r.headers.get("content-type", ""))
    return cut_html_footer(html) if cut_footer else html


def get_soup(url: str, *, cut_footer: bool = True) -> BeautifulSoup:
    return BeautifulSoup(fetch_page_html(url, cut_footer=cut_footer), "html.parser")


def tag_visible_text(tag: Tag) -> str:
    parts: list[str] = []
    txt = tag.get_text(" ", strip=True)
    if txt:
        parts.append(txt)
    for img in tag.find_all("img"):
        alt = img.get("alt") or img.get("title") or ""
        if alt:
            parts.append(alt)
    if tag.name == "img":
        alt = tag.get("alt") or tag.get("title") or ""
        if alt:
            parts.append(alt)
    return normalize_text(" ".join(parts))


def page_visible_lines(soup: BeautifulSoup) -> list[str]:
    """
    旧公式の詳細ページは表組みで、get_text("\n") だけだと
    「1」「GK」「鈴木 正人」「21」「GK」「野澤 洋輔」のようにセル単位へ分裂する。
    メンバー・得点・交代・警告を取るには、tr単位でセルを結合した行も必ず追加する。
    """
    lines: list[str] = []
    seen: set[str] = set()

    def add(value: str) -> None:
        s = normalize_text(value)
        if s and s not in seen:
            lines.append(s)
            seen.add(s)

    # まず表の行を優先して入れる。選手行・得点行・交代行はここで1行として復元される。
    for tr in soup.find_all("tr"):
        cells = [tag_visible_text(c) for c in tr.find_all(["th", "td"], recursive=False)]
        cells = [c for c in cells if c]
        if cells:
            add(" ".join(cells))

    # 見出しや本文も追加する。試合タイトル、日時、審判、ブロック見出しなどで必要。
    # tableを内包するdiv/body等は、trで復元済みのセルを重複させるため除外する。
    for tag in soup.find_all(["h1", "h2", "h3", "h4", "h5", "p", "div", "li"]):
        if tag.find("table"):
            continue
        add(tag_visible_text(tag))

    # 最後に通常テキストも追加する。ここでもtable内のセル単位テキストは除外する。
    for node in soup.find_all(string=True):
        if node.find_parent("table"):
            continue
        add(str(node))

    return lines


def year_from_text(text: str) -> str:
    m = re.search(r"(19\d{2}|20\d{2})", normalize_text(text))
    return m.group(1) if m else ""


def year_from_url(url: str) -> str:
    m = re.search(r"data(19\d{2}|20\d{2})|_(19\d{2}|20\d{2})|/(19\d{2}|20\d{2})/", url)
    return next((g for g in m.groups() if g), "") if m else ""


def is_html_like_url(url: str) -> bool:
    path = urlparse(url).path.lower()
    return path.endswith(".htm") or path.endswith(".html") or path.endswith("/")


def is_excluded_text(text: str) -> bool:
    s = normalize_text(text)
    return any(k in s for k in EXCLUDE_COMPETITION_KEYWORDS)


def is_target_text(text: str) -> bool:
    s = normalize_text(text)
    return not is_excluded_text(s) and any(k in s for k in TARGET_COMPETITION_KEYWORDS)


def is_competition_heading_text(text: str) -> bool:
    s = normalize_text(text)
    if is_excluded_text(s):
        return False
    terms = ["Jリーグ", "ディビジョン", "J1", "J2", "ナビスコ", "ルヴァン", "天皇杯", "サテライト", "プレシーズン", "ワールドチャレンジ"]
    if not any(t in s for t in terms):
        return False
    # ナビゲーション文字列は「｜Jリーグ｜ナビスコ｜天皇杯｜サテライト｜」のように複数大会が並ぶので見出し扱いしない。
    hit = sum(1 for t in terms if t in s)
    if hit >= 3 and len(s) >= 20:
        return False
    return True


def is_target_competition_heading_text(text: str) -> bool:
    return is_competition_heading_text(text) and is_target_text(text)


def normalize_competition_name(text: str) -> str:
    s = normalize_text(text).strip("■ ｜|")
    s = re.sub(r"^[■\s]+|[■\s]+$", "", s)
    s = s.replace("Ｊ", "J").replace("Ｂ", "B").replace("Ｃ", "C").replace("Ａ", "A")
    if is_excluded_text(s):
        return ""
    m = re.search(r"(第\s*\d+\s*回\s*天皇杯\s*(?:全日本|全国).*?サッカー選手権大会)", s)
    if m:
        return normalize_text(m.group(1)).replace(" ", "") .replace("天皇杯全", "天皇杯 全")
    if "天皇杯" in s:
        return normalize_text(s)
    if "サテライト" in s:
        m = re.search(r"(?:J\s*)?サテライトリーグ\s*([A-ZＡ-Ｚ]\s*グループ)?", s)
        if m:
            grp = normalize_text(m.group(1) or "")
            return normalize_text(f"Jサテライトリーグ {grp}" if grp else "Jサテライトリーグ")
        return "Jサテライトリーグ"
    if "プレシーズン" in s:
        return normalize_text(s)
    if "ワールドチャレンジ" in s:
        return normalize_text(s)
    return s


def normalize_section(section: str, competition: str) -> str:
    s = normalize_text(section)
    if not s:
        return ""
    if "天皇杯" in competition:
        m = re.match(r"^(?:第)?(\d+)回戦$", s)
        if m:
            return f"第{m.group(1)}回戦"
        m = re.match(r"^(\d+)$", s)
        if m:
            return f"第{m.group(1)}回戦"
    return s


def parse_score_pair(text: str) -> tuple[str, str]:
    m = re.search(r"(\d{1,2})\s*[-－]\s*(\d{1,2})", normalize_text(text))
    if not m:
        return "", ""
    return m.group(1), m.group(2)


def parse_pk_pair(text: str, result_mark: str = "") -> tuple[str, str]:
    s = normalize_text(text)
    m = re.search(r"PK\s*(\d{1,2})\s*[-－]\s*(\d{1,2})", s, re.I)
    if not m:
        m = re.search(r"PK\s*(\d{1,2})\s*対\s*(\d{1,2})", s, re.I)
    if not m:
        return "", ""
    a, b = int(m.group(1)), int(m.group(2))
    # 通常は新潟-相手。ただし「●0-0 PK8-7」のように負け表記で左が大きい場合は相手-新潟表記と判断する。
    if result_mark == "●" and a > b:
        return str(b), str(a)
    if result_mark == "○" and a < b:
        return str(b), str(a)
    return str(a), str(b)


def is_valid_score_pair(score_text: str) -> bool:
    a, b = parse_score_pair(score_text)
    if a == "" or b == "":
        return False
    return 0 <= int(a) <= 30 and 0 <= int(b) <= 30


def extract_result_mark(text: str) -> str:
    m = re.search(r"[○●△]", normalize_text(text))
    return m.group(0) if m else ""


def extract_date_from_row(row_text: str, year: str) -> str:
    s = normalize_text(row_text)
    for pat in [
        r"(\d{1,2})/(\d{1,2})\s*[（(][^）)]*[）)]",
        r"(\d{1,2})月(\d{1,2})日\s*[（(][^）)]*[）)]",
        r"(\d{1,2})/(\d{1,2})",
        r"(\d{1,2})月(\d{1,2})日",
    ]:
        m = re.search(pat, s)
        if m:
            return f"{year}/{int(m.group(1)):02d}/{int(m.group(2)):02d}"
    return ""


def extract_kickoff_from_row(row_text: str) -> str:
    m = re.search(r"(\d{1,2})[:：](\d{2})", normalize_text(row_text))
    if not m:
        return ""
    return f"{int(m.group(1)):02d}:{m.group(2)}"


def clean_before_score(before_score: str, competition: str) -> str:
    s = normalize_text(before_score)
    s = re.sub(r"^\s*(\d+|第\d+日|第?\d+節|第?\d+戦|(?:第)?\d+回戦|準々決勝|準決勝|決勝)\s+", " ", s)
    s = re.sub(r"\d{1,2}/\d{1,2}\s*[（(][^）)]*[）)]", " ", s)
    s = re.sub(r"\d{1,2}月\d{1,2}日\s*[（(][^）)]*[）)]", " ", s)
    s = re.sub(r"\d{1,2}/\d{1,2}|\d{1,2}月\d{1,2}日", " ", s)
    s = re.sub(r"\d{1,2}[:：]\d{2}", " ", s)
    s = re.sub(r"[○●△□■▲▽|｜]", " ", s)
    s = re.sub(r"開催日|時刻|対戦チーム|試合会場|会場|TV・ラジオ中継|テレビ中継|結果|節|試合", " ", s)
    s = s.replace("\u00a0", " ")
    # 大会名っぽい語は対戦相手・会場ではないので落とす。
    for k in ["天皇杯", "サテライトリーグ", "サテライト", "プレシーズンマッチ", "プレシーズン", "ワールドチャレンジ", "全日本サッカー選手権大会", "選手権大会", "グループ"]:
        s = s.replace(k, " ")
    return normalize_text(s)


def split_opponent_and_stadium(text: str) -> tuple[str, str]:
    tokens = normalize_text(text).split()
    if not tokens:
        return "", ""

    useful: list[str] = []
    for tok in tokens:
        if any(noise in tok for noise in TV_OR_NOISE_TOKENS):
            break
        if re.fullmatch(r"[\-/()（）\[\]0-9:：]+", tok):
            continue
        useful.append(tok)

    if not useful:
        return "", ""
    opponent = normalize_team_name(useful[0])
    stadium_tokens = useful[1:]

    # 会場らしい語が出たらそこまでを会場とし、その後ろのTV情報などは捨てる。
    if stadium_tokens:
        cut = len(stadium_tokens)
        for i, tok in enumerate(stadium_tokens):
            if any(k in tok for k in VENUE_KEYWORDS):
                cut = i + 1
                break
        stadium_tokens = stadium_tokens[:cut]
    return opponent, normalize_team_name(" ".join(stadium_tokens))


def parse_section_from_row(row_text: str, competition: str) -> str:
    s = normalize_text(row_text)
    if "天皇杯" in competition:
        m = re.match(r"^\s*((?:第)?\d+回戦|\d+回戦|準々決勝|準決勝|決勝)\s+", s)
        return normalize_section(m.group(1), competition) if m else ""
    m = re.match(r"^\s*(第\d+日|第?\d+節|第?\d+戦|準々決勝|準決勝|決勝)\s+", s)
    if m:
        return normalize_section(m.group(1), competition)
    if "サテライト" in competition:
        m = re.search(r"([A-Z]\s*グループ)", competition)
        return normalize_text(m.group(1)) if m else ""
    return ""


def parse_schedule_row(row_text: str, year: str, competition: str, link_text: str) -> dict:
    row = normalize_text(row_text)
    link = normalize_text(link_text)
    score_source = link
    m_score = re.search(r"\d{1,2}\s*[-－]\s*\d{1,2}", score_source)
    score_text = m_score.group(0) if m_score else ""

    result_mark = extract_result_mark(row)
    albirex_score, opponent_score = parse_score_pair(score_text)
    pk_albirex, pk_opponent = parse_pk_pair(row, result_mark)

    before_score = row.split(score_text)[0] if score_text and score_text in row else row
    before_score = clean_before_score(before_score, competition)
    opponent, stadium = split_opponent_and_stadium(before_score)

    return {
        "section": parse_section_from_row(row, competition),
        "date": extract_date_from_row(row, year),
        "kickoff": extract_kickoff_from_row(row),
        "opponent": opponent,
        "stadium": stadium,
        "score_text": score_text,
        "albirex_score": albirex_score,
        "opponent_score": opponent_score,
        "pk_albirex_score": pk_albirex,
        "pk_opponent_score": pk_opponent,
        "result_mark": result_mark,
    }


def row_text_for_anchor(a: Tag) -> str:
    tr = a.find_parent("tr")
    if tr:
        return tag_visible_text(tr)
    for name in ["li", "p", "div", "td", "th"]:
        parent = a.find_parent(name)
        if parent:
            return tag_visible_text(parent)
    return tag_visible_text(a.parent) if a.parent else tag_visible_text(a)


def is_valid_detail_url(url: str, year: str) -> bool:
    parsed = urlparse(url)
    path = parsed.path.lower()
    if not (path.endswith(".htm") or path.endswith(".html")):
        return False
    if f"/past/data{year.lower()}/" not in path:
        return False
    if path.endswith("/index.htm") or path.endswith("/index.html"):
        return False
    if any(x in path for x in ["rank", "ranking", "stand", "juni", "tokuten", "pdf"]):
        return False
    return True


def has_footer_or_company_noise(text: str) -> bool:
    s = normalize_text(text)
    return any(x in s for x in FATAL_NOISE_WORDS)


def anchor_text_is_score(a: Tag) -> bool:
    # 旧公式の一覧では、試合結果のリンク文字そのものが "2-1" のようなスコア。
    # 親要素全体にスコアっぽい数字があるだけでは採用しない。
    return bool(re.fullmatch(r"\s*\d{1,2}\s*[-－]\s*\d{1,2}\s*", normalize_text(a.get_text(" ", strip=True))))


def is_probable_match_anchor(a: Tag, row_text: str, year: str, detail_url: str) -> bool:
    if not is_valid_detail_url(detail_url, year):
        return False
    if has_footer_or_company_noise(row_text) or has_footer_or_company_noise(detail_url):
        return False
    if not extract_date_from_row(row_text, year):
        return False
    # 住所・TELのような親テキストではなく、aタグの表示文字がスコアそのものの場合だけ採用する。
    if not anchor_text_is_score(a):
        return False
    if not is_valid_score_pair(a.get_text(" ", strip=True)):
        return False
    return True


def find_heading_nodes(soup: BeautifulSoup) -> list[tuple[NavigableString, str]]:
    result: list[tuple[NavigableString, str]] = []
    seen = set()
    for node in soup.find_all(string=True):
        text = normalize_text(node)
        if not text or text in seen:
            continue
        if is_target_competition_heading_text(text):
            result.append((node, text))
            seen.add(text)
    return result


def collect_links_between_heading(node: NavigableString, year: str, page_url: str, heading_text: str) -> list[dict]:
    competition = normalize_competition_name(heading_text)
    if not competition:
        return []

    links: list[dict] = []
    seen_urls: set[str] = set()
    for elem in node.next_elements:
        if isinstance(elem, NavigableString):
            txt = normalize_text(elem)
            if txt and txt != normalize_text(heading_text):
                if is_competition_heading_text(txt):
                    break
                if has_footer_or_company_noise(txt):
                    break
            continue
        if isinstance(elem, Tag):
            visible = tag_visible_text(elem)
            # 「▲ページのトップへ」以降は本文ではない。特に最後のサテライト節では次の大会見出しがないため必須。
            if visible and has_footer_or_company_noise(visible):
                break
        if not isinstance(elem, Tag) or elem.name != "a":
            continue

        href = elem.get("href") or ""
        detail_url = urljoin(page_url, href)
        row_text = row_text_for_anchor(elem)
        if detail_url in seen_urls:
            continue
        if is_excluded_text(row_text) or not is_probable_match_anchor(elem, row_text, year, detail_url):
            continue

        row = parse_schedule_row(row_text, year, competition, elem.get_text(" ", strip=True))
        # 最重要ガード: 日付・時刻・相手・常識範囲のスコアがないものは絶対に追加しない。
        if not row["date"] or not row["kickoff"] or not row["opponent"] or not is_valid_score_pair(row["score_text"]):
            continue
        if row["opponent"] in ["株式会社", "〒", "TEL", "FAX", TEAM_NAME]:
            continue
        seen_urls.add(detail_url)
        links.append({
            "year": year,
            "game_page_url": page_url,
            "detail_url": detail_url,
            "competition": competition,
            "competition_heading": heading_text,
            "row_text": row_text,
            **row,
        })
    return links


def collect_game_pages(start_url: str) -> list[dict]:
    soup = get_soup(start_url)
    pages: list[dict] = []
    seen: set[str] = set()
    current_year = ""

    for elem in soup.find_all(["h1", "h2", "h3", "h4", "h5", "p", "td", "th", "li", "div", "a", "option", "frame", "iframe"]):
        text = tag_visible_text(elem)
        y = year_from_text(text)
        if y:
            current_year = y
        href = ""
        if elem.name == "a":
            href = elem.get("href") or ""
        elif elem.name == "option":
            href = elem.get("value") or ""
        elif elem.name in ["frame", "iframe"]:
            href = elem.get("src") or ""
        if not href or href.startswith("#") or href.lower().startswith("javascript:"):
            continue
        url = urljoin(start_url, href)
        year = year_from_url(url) or current_year
        if not year:
            continue
        if ("試合結果" in text or "試合日程" in text or re.search(r"/data\d{4}/index\.html?$", url, re.I)) and url not in seen:
            if "/past/" in url and is_html_like_url(url):
                seen.add(url)
                pages.append({"year": year, "url": url, "label": text, "source": "seasondata"})

    pages.sort(key=lambda x: (x["year"], x["url"]))
    return pages


def collect_match_links_from_page(page: dict) -> list[dict]:
    soup = get_soup(page["url"])
    links: list[dict] = []
    seen: set[str] = set()
    for node, heading_text in find_heading_nodes(soup):
        for link in collect_links_between_heading(node, page["year"], page["url"], heading_text):
            if link["detail_url"] in seen:
                continue
            seen.add(link["detail_url"])
            links.append(link)
    return links


def empty_details() -> dict:
    return {"starting": [], "substitutes": [], "substitutions": [], "cards": [], "manager": ""}


def default_record() -> dict:
    return {
        "match_card_id": "", "url": "", "season": "", "competition": "", "section": "",
        "home_team": "", "away_team": "", "home_score": "", "away_score": "",
        "pk_home_score": "", "pk_away_score": "", "date": "", "kickoff": "", "stadium": "",
        "attendance": "", "weather": "", "temperature": "", "humidity": "",
        "home_goals": [], "away_goals": [], "stats": [],
        "home_details": empty_details(), "away_details": empty_details(), "referees": {},
    }


def make_match_id(url: str, year: str, competition: str, date: str = "", opponent: str = "") -> str:
    stem = Path(urlparse(url).path).stem
    if not stem or stem.lower() in ["index", "unknown"]:
        d = date.replace("/", "") or "unknown"
        op = re.sub(r"[^0-9A-Za-zぁ-んァ-ヶ一-龥]", "", opponent)[:20] or "unknown"
        stem = f"{d}_{op}"
    if "天皇杯" in competition:
        prefix = "emperor"
    elif "サテライト" in competition:
        prefix = "satellite"
    elif "プレシーズン" in competition:
        prefix = "preseason"
    elif "ワールドチャレンジ" in competition:
        prefix = "worldchallenge"
    else:
        prefix = "extra"
    return f"albirex_past_{prefix}_{year}_{stem}"


def get_year_file(input_dir: Path, year: str) -> Path:
    return input_dir / f"{year}.json"


def load_year_records(input_dir: Path, year: str) -> list[dict]:
    path = get_year_file(input_dir, year)
    if not path.exists():
        return []
    data = load_json(path)
    if not isinstance(data, list):
        raise RuntimeError(f"{path} は配列JSONではありません。")
    return data


def get_existing_schema_keys(records: list[dict]) -> list[str]:
    return list(records[0].keys()) if records else DEFAULT_SCHEMA_KEYS[:]


def conform_to_existing_schema(record: dict, schema_keys: list[str]) -> dict:
    result = {}
    for key in schema_keys:
        if key in record:
            result[key] = record[key]
        elif key in ["home_goals", "away_goals", "stats"]:
            result[key] = []
        elif key in ["home_details", "away_details"]:
            result[key] = empty_details()
        elif key == "referees":
            result[key] = {}
        else:
            result[key] = ""
    for key in ["home_details", "away_details"]:
        d = result.get(key, {}) if isinstance(result.get(key, {}), dict) else {}
        result[key] = {
            "starting": d.get("starting", []) if isinstance(d.get("starting", []), list) else [],
            "substitutes": d.get("substitutes", []) if isinstance(d.get("substitutes", []), list) else [],
            "substitutions": d.get("substitutions", []) if isinstance(d.get("substitutions", []), list) else [],
            "cards": d.get("cards", []) if isinstance(d.get("cards", []), list) else [],
            "manager": d.get("manager", "") if isinstance(d.get("manager", ""), str) else "",
        }
    if not isinstance(result.get("referees", {}), dict):
        result["referees"] = {}
    return result


def is_niigata_home_venue(stadium: str) -> bool:
    s = normalize_text(stadium)
    return any(k in s for k in NIIGATA_HOME_KEYWORDS)


def find_detail_title(lines: list[str]) -> str:
    for line in lines:
        s = normalize_text(line)
        if is_target_text(s) and ("vs" in s.lower() or "対" in s):
            return s
    for line in lines:
        s = normalize_text(line)
        if is_target_text(s):
            return s
    return ""


def parse_title_info(title: str, fallback_competition: str, fallback_section: str, fallback_opponent: str) -> dict:
    s = normalize_text(title)
    competition = normalize_competition_name(s) if is_target_text(s) else fallback_competition
    section = fallback_section
    opponent = normalize_team_name(fallback_opponent)

    m = re.search(r"((?:第)?\d+回戦|準々決勝|準決勝|決勝|第\d+日|第?\d+節|[A-Z]\s*グループ)", s)
    if m:
        section = normalize_section(m.group(1), competition)
    m = re.search(r"(?:vs|VS|対)\s+(.+)$", s)
    if m:
        opponent = normalize_team_name(m.group(1))
    return {"competition": competition or fallback_competition, "section": section, "opponent": opponent}


def parse_detail_match_info(lines: list[str], year: str) -> dict:
    info = {"date": "", "kickoff": "", "weather": "", "temperature": "", "humidity": "", "stadium": "", "attendance": "", "referee_main": "", "referee_assistants": "", "referee_4th": ""}
    joined = " ".join(lines)

    m = re.search(r"(?:日時|日時〗|日時\])\s*([0-9]{1,2})月([0-9]{1,2})日.*?([0-9]{1,2})[:：]([0-9]{2})\s*キックオフ", joined)
    if m:
        info["date"] = f"{year}/{int(m.group(1)):02d}/{int(m.group(2)):02d}"
        info["kickoff"] = f"{int(m.group(3)):02d}:{m.group(4)}"

    m = re.search(r"(?:試合会場|会場)〗?\s*([^〖\[]+?)\s*(?:〖|\[)?(?:入場者数|入場者人数)〗?\s*([0-9,]+)人", joined)
    if m:
        info["stadium"] = normalize_team_name(m.group(1))
        info["attendance"] = m.group(2).replace(",", "")
    else:
        m = re.search(r"(?:試合会場|会場)\s+([^\s]+)", joined)
        if m:
            info["stadium"] = normalize_team_name(m.group(1))

    m = re.search(r"天候〗?\s*([^〖\[]+?)(?:\s*(?:〖|\[)?風|\s*(?:〖|\[)?気温|$)", joined)
    if m:
        info["weather"] = normalize_text(m.group(1))
    m = re.search(r"気温〗?\s*([0-9.]+)℃", joined)
    if m:
        info["temperature"] = m.group(1)
    m = re.search(r"湿度〗?\s*([0-9]+%)", joined)
    if m:
        info["humidity"] = m.group(1)

    # 審判は1行にまとまっていることが多い。joinedで拾うと次の行まで巻き込みやすいので行単位で処理する。
    for line in lines:
        s = normalize_text(line)
        if "主審" not in s or "副審" not in s:
            continue
        m = re.search(r"主審〗?\s*([^〖\[]+?)\s*(?:〖|\[)?副審〗?\s*([^〖\[]+?)(?:\s*(?:〖|\[)?第4の審判員〗?\s*(.+))?$", s)
        if m:
            info["referee_main"] = normalize_text(m.group(1))
            info["referee_assistants"] = normalize_text((m.group(2) or "").replace("／", " , ").replace("/", " , "))
            info["referee_4th"] = normalize_text(m.group(3) or "")
            break
    return info


def parse_member_line(line: str) -> dict | None:
    s = normalize_text(line)
    # 形式1: 1 GK 鈴木 正人 21 GK 野澤 洋輔
    m = re.match(r"^(\d{1,2})\s+(GK|DF|MF|FW)\s+(.+?)\s+(\d{1,2})\s+(GK|DF|MF|FW)\s+(.+)$", s)
    if m:
        return {
            "left": {"position": m.group(2), "number": m.group(1), "name": normalize_team_name(m.group(3))},
            "right": {"position": m.group(5), "number": m.group(4), "name": normalize_team_name(m.group(6))},
        }

    # 形式2: GK 1 萩原 達郎 GK 1 木寺 浩一
    m = re.match(r"^(GK|DF|MF|FW)\s+(\d{1,2})\s+(.+?)\s+(GK|DF|MF|FW)\s+(\d{1,2})\s+(.+)$", s)
    if m:
        return {
            "left": {"position": m.group(1), "number": m.group(2), "name": normalize_team_name(m.group(3))},
            "right": {"position": m.group(4), "number": m.group(5), "name": normalize_team_name(m.group(6))},
        }

    # 片側だけの控え行: MF 12 鎌田 直希 / 12 MF 鎌田 直希
    m = re.match(r"^(GK|DF|MF|FW)\s+(\d{1,2})\s+(.+)$", s)
    if m:
        return {"left": {"position": m.group(1), "number": m.group(2), "name": normalize_team_name(m.group(3))}, "right": None}
    m = re.match(r"^(\d{1,2})\s+(GK|DF|MF|FW)\s+(.+)$", s)
    if m:
        return {"left": {"position": m.group(2), "number": m.group(1), "name": normalize_team_name(m.group(3))}, "right": None}

    return None


def parse_members_lr(lines: list[str]) -> tuple[dict, dict]:
    left = empty_details()
    right = empty_details()
    for line in lines:
        row = parse_member_line(line)
        if not row:
            continue
        for side_key, details in [("left", left), ("right", right)]:
            player = row.get(side_key)
            if not player:
                continue
            bucket = "starting" if len(details["starting"]) < 11 else "substitutes"
            details[bucket].append(player)
    return left, right


def names_from_details(details: dict) -> set[str]:
    names = set()
    for key in ["starting", "substitutes"]:
        for p in details.get(key, []):
            n = normalize_team_name(p.get("name", ""))
            if n:
                names.add(n)
    return names


def parse_stats_lr(lines: list[str]) -> list[dict]:
    result = []
    seen = set()
    for line in lines:
        s = normalize_text(line)
        m = re.match(r"^(\d+)\s+(SH|CK|FK)\s+(\d+)$", s)
        if m and m.group(2) not in seen:
            result.append({"type": m.group(2), "left": m.group(1), "right": m.group(3)})
            seen.add(m.group(2))
    order = {"SH": 0, "CK": 1, "FK": 2}
    return sorted(result, key=lambda x: order.get(x["type"], 99))


def split_block(lines: list[str], start_keywords: list[str], end_keywords: list[str]) -> list[str]:
    start = None
    for i, line in enumerate(lines):
        s = normalize_text(line).replace(" ", "")
        if any(k.replace(" ", "") in s for k in start_keywords):
            start = i + 1
            break
    if start is None:
        return []
    end = len(lines)
    for i in range(start, len(lines)):
        s = normalize_text(lines[i]).replace(" ", "")
        if any(k.replace(" ", "") in s for k in end_keywords):
            end = i
            break
    return lines[start:end]


def strip_number_from_name(name: str) -> str:
    return normalize_team_name(re.sub(r"^\d{1,2}\s+", "", normalize_text(name)))


def assign_side_by_name(name: str, left_names: set[str], right_names: set[str], fallback: str = "left") -> str:
    n = strip_number_from_name(name)
    if n in left_names and n not in right_names:
        return "left"
    if n in right_names and n not in left_names:
        return "right"
    return fallback


def parse_goal_events_lr(lines: list[str], left_names: set[str], right_names: set[str]) -> tuple[list[dict], list[dict]]:
    left_goals: list[dict] = []
    right_goals: list[dict] = []
    block = split_block(lines, ["得 点", "得点"], ["交 代", "交代", "警 告", "警告", "退 場", "退場"])
    event_pat = re.compile(r"(\d{1,3}[’'′](?:\+\d+)?|\d{1,3}分)\s+(?:\d{1,2}\s+)?(.+?)(?=\s+\d{1,3}[’'′]|$)")
    for line in block:
        s = normalize_text(line)
        if not s or s == "* * *":
            continue
        events = [(normalize_minute(m.group(1)), strip_number_from_name(m.group(2))) for m in event_pat.finditer(s)]
        if not events:
            continue
        if len(events) >= 2:
            left_goals.append({"time": events[0][0], "name": events[0][1]})
            right_goals.append({"time": events[1][0], "name": events[1][1]})
            for t, n in events[2:]:
                side = assign_side_by_name(n, left_names, right_names, "left")
                (left_goals if side == "left" else right_goals).append({"time": t, "name": n})
        else:
            t, n = events[0]
            side = assign_side_by_name(n, left_names, right_names, "left")
            (left_goals if side == "left" else right_goals).append({"time": t, "name": n})
    return left_goals, right_goals


def parse_substitution_events_lr(lines: list[str], left_names: set[str], right_names: set[str]) -> tuple[list[dict], list[dict]]:
    left_subs: list[dict] = []
    right_subs: list[dict] = []
    block = split_block(lines, ["交 代", "交代"], ["警 告", "警告", "退 場", "退場", "日時", "試合会場"])
    minute_pat = r"\d{1,3}\s*[’'′](?:\+\d+)?|\d{1,3}\s*分"
    # 両対応:
    #   OUT 78’ 20 佐野 裕哉
    #   56′ OUT 6 原崎 政人
    #   IN 12 鎌田 直希  ← 12は背番号なので時刻扱いしない
    event_pat = re.compile(
        rf"(?:(?P<min_pre>{minute_pat})\s+(?P<io_pre>OUT|IN)|(?P<io_post>OUT|IN)(?:\s+(?P<min_post>{minute_pat}))?)"
        rf"\s+(?:\d{{1,2}}\s+)?(?P<name>.+?)(?=\s+(?:(?:{minute_pat})\s+)?(?:OUT|IN)\s+|$)",
        re.I,
    )
    for line in block:
        s = normalize_text(line)
        events = []
        for m in event_pat.finditer(s):
            io = (m.group("io_pre") or m.group("io_post") or "").upper()
            minute = normalize_minute(m.group("min_pre") or m.group("min_post") or "") if io == "OUT" else ""
            name = strip_number_from_name(m.group("name"))
            if name:
                events.append((io, minute, name))
        if not events:
            continue
        if len(events) >= 2:
            # 旧公式は1行に左チーム・右チームのイベントが横並びで出ることが多い。
            sides = [assign_side_by_name(events[0][2], left_names, right_names, "left"), assign_side_by_name(events[1][2], left_names, right_names, "right")]
            sides += [assign_side_by_name(e[2], left_names, right_names, "left") for e in events[2:]]
        else:
            sides = [assign_side_by_name(events[0][2], left_names, right_names, "left")]
        for (io, minute, name), side in zip(events, sides):
            item = {"in_out": "▽" if io == "OUT" else "▲", "name": name, "time": minute}
            (left_subs if side == "left" else right_subs).append(item)
    return left_subs, right_subs


def parse_card_events_lr(lines: list[str], left_names: set[str], right_names: set[str]) -> tuple[list[dict], list[dict]]:
    left_cards: list[dict] = []
    right_cards: list[dict] = []
    block = split_block(lines, ["警 告", "警告", "退 場", "退場"], ["日時", "試合会場", "▲ページ"])
    event_pat = re.compile(r"(\d{1,3}[’'′]?(?:\+\d+)?|\d{1,3}分)\s+(?:\d{1,2}\s+)?(.+?)(?=\s+\d{1,3}[’'′]|$)")
    current_type = "警告"
    for line in block:
        s = normalize_text(line)
        if "退場" in s:
            current_type = "退場"
        events = [(normalize_minute(m.group(1)), strip_number_from_name(m.group(2))) for m in event_pat.finditer(s)]
        if not events:
            continue
        if len(events) >= 2:
            sides = ["left", "right"] + [assign_side_by_name(e[1], left_names, right_names, "left") for e in events[2:]]
        else:
            sides = [assign_side_by_name(events[0][1], left_names, right_names, "left")]
        for (minute, name), side in zip(events, sides):
            item = {"type": current_type, "name": name, "time": minute}
            (left_cards if side == "left" else right_cards).append(item)
    return left_cards, right_cards


def parse_manager_lr(lines: list[str]) -> tuple[str, str]:
    for line in lines:
        s = normalize_text(line)
        m = re.match(r"^監督\s+(.+?)\s+監督\s+(.+)$", s)
        if m:
            return normalize_team_name(m.group(1)), normalize_team_name(m.group(2))
        m = re.match(r"^監督\s+(.+?)\s+(.+?)\s+監督$", s)
        if m:
            return normalize_team_name(m.group(1)), normalize_team_name(m.group(2))
    return "", ""


def convert_stats_lr(stats_lr: list[dict], left_is_home: bool) -> list[dict]:
    out = []
    for s in stats_lr:
        if left_is_home:
            out.append({"type": s["type"], "home": s["left"], "away": s["right"]})
        else:
            out.append({"type": s["type"], "home": s["right"], "away": s["left"]})
    return out


def parse_detail_page(link: dict) -> dict:
    year = link["year"]
    url = link["detail_url"]
    soup = get_soup(url)
    lines = page_visible_lines(soup)

    title_info = parse_title_info(find_detail_title(lines), link.get("competition", ""), link.get("section", ""), link.get("opponent", ""))
    competition = title_info["competition"] or link.get("competition", "")
    section = title_info["section"] or link.get("section", "")
    opponent = normalize_team_name(title_info["opponent"] or link.get("opponent", ""))
    detail_info = parse_detail_match_info(lines, year)

    match_date = detail_info.get("date") or link.get("date", "")
    kickoff = detail_info.get("kickoff") or link.get("kickoff", "")
    stadium = detail_info.get("stadium") or link.get("stadium", "")
    albirex_score = link.get("albirex_score", "")
    opponent_score = link.get("opponent_score", "")

    left_details, right_details = parse_members_lr(lines)
    left_names = names_from_details(left_details)
    right_names = names_from_details(right_details)
    left_manager, right_manager = parse_manager_lr(lines)
    left_details["manager"] = left_manager
    right_details["manager"] = right_manager
    left_goals, right_goals = parse_goal_events_lr(lines, left_names, right_names)
    left_subs, right_subs = parse_substitution_events_lr(lines, left_names, right_names)
    left_cards, right_cards = parse_card_events_lr(lines, left_names, right_names)
    left_details["substitutions"] = left_subs
    right_details["substitutions"] = right_subs
    left_details["cards"] = left_cards
    right_details["cards"] = right_cards
    stats_lr = parse_stats_lr(lines)

    niigata_home = is_niigata_home_venue(stadium)
    if niigata_home:
        home_team = TEAM_NAME
        away_team = opponent or "不明"
        home_score, away_score = albirex_score, opponent_score
        pk_home_score, pk_away_score = link.get("pk_albirex_score", ""), link.get("pk_opponent_score", "")
        # 詳細ページの左右は原則ホームが左。新潟ホームなら左が新潟。
        home_details, away_details = left_details, right_details
        home_goals, away_goals = left_goals, right_goals
        stats = convert_stats_lr(stats_lr, left_is_home=True)
    else:
        home_team = opponent or "不明"
        away_team = TEAM_NAME
        home_score, away_score = opponent_score, albirex_score
        pk_home_score, pk_away_score = link.get("pk_opponent_score", ""), link.get("pk_albirex_score", "")
        # 新潟アウェイなら左が相手、右が新潟。
        home_details, away_details = left_details, right_details
        home_goals, away_goals = left_goals, right_goals
        stats = convert_stats_lr(stats_lr, left_is_home=True)

    referees = {}
    if detail_info.get("referee_main"):
        referees["主審"] = detail_info["referee_main"]
    if detail_info.get("referee_assistants"):
        referees["副審"] = detail_info["referee_assistants"]
    if detail_info.get("referee_4th"):
        referees["第4の審判員"] = detail_info["referee_4th"]

    record = default_record()
    record.update({
        "match_card_id": make_match_id(url, year, competition, match_date, opponent),
        "url": url,
        "season": year,
        "competition": competition,
        "section": normalize_section(section, competition),
        "home_team": home_team,
        "away_team": away_team,
        "home_score": home_score,
        "away_score": away_score,
        "pk_home_score": pk_home_score,
        "pk_away_score": pk_away_score,
        "date": match_date,
        "kickoff": kickoff,
        "stadium": stadium,
        "attendance": detail_info.get("attendance", ""),
        "weather": detail_info.get("weather", ""),
        "temperature": detail_info.get("temperature", ""),
        "humidity": detail_info.get("humidity", ""),
        "home_goals": home_goals,
        "away_goals": away_goals,
        "stats": stats,
        "home_details": home_details,
        "away_details": away_details,
        "referees": referees,
    })
    return record


def validate_record(record: dict) -> list[str]:
    warnings = []
    if not is_target_text(record.get("competition", "")):
        warnings.append(f"対象大会ではない可能性: {record.get('competition')}")
    if is_excluded_text(record.get("competition", "")):
        warnings.append(f"除外対象: {record.get('competition')}")
    for key in ["date", "kickoff", "stadium", "home_team", "away_team", "home_score", "away_score"]:
        if record.get(key, "") == "":
            warnings.append(f"{key} が空")
    for key in ["home_score", "away_score"]:
        v = str(record.get(key, ""))
        if not v.isdigit() or int(v) > 30:
            warnings.append(f"{key} が不正: {v}")
    if TEAM_NAME not in record.get("home_team", "") and TEAM_NAME not in record.get("away_team", ""):
        warnings.append("home_team/away_team にアルビレックス新潟がない")
    record_text = json.dumps(record, ensure_ascii=False)
    if has_footer_or_company_noise(record_text):
        warnings.append("会社情報/フッターらしき文字列が混入")
    url = str(record.get("url", ""))
    year = str(record.get("season", ""))
    if year and not is_valid_detail_url(url, year):
        warnings.append(f"url が試合詳細ではない: {url}")
    return warnings


def backup_file(path: Path) -> Path:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = path.with_suffix(path.suffix + f".bak_{ts}")
    shutil.copy2(path, backup)
    return backup


def should_remove_old_past_record(record: dict) -> bool:
    mid = str(record.get("match_card_id", ""))
    return mid.startswith("albirex_past_")


def is_known_bad_record(record: dict) -> bool:
    # 前回以前の失敗データを確実に掃除する。match_card_idが違っても住所・会社情報混入なら削除対象。
    text = json.dumps(record, ensure_ascii=False)
    if has_footer_or_company_noise(text):
        return True
    for key in ["home_score", "away_score"]:
        v = str(record.get(key, ""))
        if v.isdigit() and int(v) > 30:
            return True
    if str(record.get("away_team", "")) in ["株式会社", "〒", "TEL", "FAX"]:
        return True
    if str(record.get("home_team", "")) in ["株式会社", "〒", "TEL", "FAX"]:
        return True
    return False


def write_grouped_records(input_dir: Path, records: list[dict], *, dry_run: bool, replace_past_extras: bool) -> dict:
    by_year: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        by_year[str(r.get("season", ""))].append(r)

    summary = {"appended": 0, "skipped_duplicate": 0, "removed_old": 0, "files": []}
    for year, add_records in sorted(by_year.items()):
        path = get_year_file(input_dir, year)
        current = load_year_records(input_dir, year)
        schema_keys = get_existing_schema_keys(current)
        before_len = len(current)

        # 住所・郵便番号などが混入した既知の壊れデータは、オプションに関係なく削除する。
        cleaned = [r for r in current if not is_known_bad_record(r)]
        summary["removed_old"] += len(current) - len(cleaned)
        current = cleaned

        if replace_past_extras:
            kept = [r for r in current if not should_remove_old_past_record(r)]
            summary["removed_old"] += len(current) - len(kept)
            current = kept

        existing_ids = {str(r.get("match_card_id", "")) for r in current}
        existing_urls = {str(r.get("url", "")) for r in current}
        for rec in add_records:
            shaped = conform_to_existing_schema(rec, schema_keys)
            mid = str(shaped.get("match_card_id", ""))
            url = str(shaped.get("url", ""))
            if mid in existing_ids or url in existing_urls:
                summary["skipped_duplicate"] += 1
                continue
            current.append(shaped)
            existing_ids.add(mid)
            existing_urls.add(url)
            summary["appended"] += 1

        if not dry_run and current != load_year_records(input_dir, year):
            if path.exists():
                backup = backup_file(path)
                print(f"  backup: {backup}")
            save_json(path, current)
        summary["files"].append({"file": str(path), "before": before_len, "after": len(current)})
    return summary



def run_self_test() -> None:
    """Web取得なしで、旧公式の代表的な2パターンをパーサ単体で検証する。"""
    emperor_lines = """
第84回天皇杯 全日本サッカー選手権大会 4回戦 vs 湘南ベルマーレ
〖日時〗11月13日（土） 18:31キックオフ
〖試合会場〗平塚競技場 〖入場者数〗3,195人
〖天候〗曇 〖風〗弱 〖気温〗13.0℃  〖芝〗全面良芝／乾燥
〖主審〗高山 啓義 〖副審〗佐幸 欣治／竹内 元人 〖第4の審判員〗平山 準
7 SH 8
2 CK 5
28 FK 11
湘南ベルマーレ アルビレックス新潟
1 GK 鈴木 正人 21 GK 野澤 洋輔
18 DF 加藤 大志 29 DF 喜多 靖
13 DF 戸田 賢良 2 DF 丸山 良明
3 DF 浮氣 哲郎 33 DF 松尾 直人
17 DF 北出 勉 4 DF 鈴木 健太郎
28 MF 中町 公祐 17 MF 安 英学
10 MF 吉野 智行 15 MF 本間 勲
9 MF 高田 保則 16 MF 寺川 能人
11 MF 坂本 紘司 18 MF 鈴木 慎吾
20 FW 佐野 裕哉 10 FW エジミウソン
32 FW 柿本 倫明 11 FW 上野 優作
33 GK 植村 慶 1 GK 木寺 浩一
27 DF 池田 学 5 DF 梅山 修
14 MF 石田 祐樹 7 MF 栗原 圭介
19 FW 石原 直樹 28 FW 船越 優蔵
12 FW アマラオ 31 FW ホベルト
監督 上田 栄治 監督 反町 康治
■■ 得 点 ■■
44’ 20 佐野 裕哉 7’ 16 寺川 能人
49’ 20 佐野 裕哉 60’ 11 上野 優作
65’ 11 坂本 紘司
■■ 交 代 ■■
OUT 78’ 20 佐野 裕哉 OUT 70’ 15 本間 勲
IN 78’ 12 アマラオ IN 70’ 7 栗原 圭介
OUT 70’ 18 鈴木 慎吾
IN 70’ 31 ホベルト
OUT 85’ 29 喜多 靖
IN 85’ 28 船越 優蔵
■■ 警 告 ■■
74’ 3 浮氣 哲郎 53’ 17 安 英学
80’ 31 ホベルト
85’ 33 松尾 直人
""".strip().splitlines()
    satellite_lines = """
2004 Jサテライトリーグ Bグループ vs ベガルタ仙台
〖日時〗3月21日(日) 15:02キックオフ
〖試合会場〗仙台スタジアム 〖入場者数〗3,200人
〖天候〗晴 〖風〗弱 〖気温〗10.8℃ 〖芝〗良芝／乾燥
〖主審〗下平 賢吾 〖副審〗北村 武宣／武田 幸信 〖第4の審判員〗高橋 信之
11 SH 21
2 CK 4
15 FK 12
ベガルタ仙台 アルビレックス新潟
GK 1 萩原 達郎 GK 1 木寺 浩一
DF 2 大河内 英樹 DF 5 梅山 修
DF 3 小原 章吾 DF 2 三田 光
DF 4 小山 大輝 DF 14 高橋 直樹
DF 5 梁 勇基 DF 9 宮沢 克行
MF 6 原崎 政人 MF 7 栗原 圭介
MF 7 中田 洋介 MF 4 安 英学
MF 8 村田 達哉 MF 3 阿部 敏之
MF 10 西 洋祐 MF 10 深澤 仁博
FW 11 高橋 正人 FW 6 森田 浩史
FW 9 大久保 剛志 FW 8 船越 優蔵
GK 16 森田 耕一郎 GK 22 北野 貴之
DF 13 伊藤 健二 DF 13 酒井 悠基
MF 14 千葉 直樹 MF 11 栗原 明洋
MF 12 鎌田 直希
■■ 得 点 ■■
14′ 10 西 洋祐 21′ 7 栗原 圭介
66′ 6 森田 浩史
■■ 交 代 ■■
56′ OUT 6 原崎 政人 73′ OUT 6 森田 浩史
IN 12 鎌田 直希 IN 11 栗原 明洋
69′ OUT 11 高橋 正人 79′ OUT 14 高橋 直樹
IN 14 千葉 直樹 IN 13 酒井 悠基
70′ OUT 1 萩原 達郎
IN 16 森田 耕一郎
■■ 警 告 ■■
20′ 6 原崎 政人 39′ 3 阿部 敏之
30′ 2 大河内 英樹 84′ 13 酒井 悠基
89′ 9 宮沢 克行
""".strip().splitlines()

    for label, lines in [("emperor", emperor_lines), ("satellite", satellite_lines)]:
        left, right = parse_members_lr(lines)
        left_names = names_from_details(left)
        right_names = names_from_details(right)
        left_goals, right_goals = parse_goal_events_lr(lines, left_names, right_names)
        left_subs, right_subs = parse_substitution_events_lr(lines, left_names, right_names)
        left_cards, right_cards = parse_card_events_lr(lines, left_names, right_names)
        info = parse_detail_match_info(lines, "2004")
        stats = parse_stats_lr(lines)
        print(f"[SELF_TEST] {label}")
        print(f"  date={info['date']} kickoff={info['kickoff']} stadium={info['stadium']} attendance={info['attendance']} weather={info['weather']} temp={info['temperature']}")
        print(f"  members left={len(left['starting'])}+{len(left['substitutes'])} right={len(right['starting'])}+{len(right['substitutes'])}")
        print(f"  goals left={left_goals} right={right_goals}")
        print(f"  subs left={len(left_subs)} right={len(right_subs)} cards left={len(left_cards)} right={len(right_cards)} stats={stats}")
        assert len(left["starting"]) == 11 and len(right["starting"]) == 11
        assert len(right_goals) >= 1
        assert stats
    print("[SELF_TEST] OK")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", default=str(DEFAULT_INPUT_DIR), help="data/history/niigata のパス")
    parser.add_argument("--dry-run", action="store_true", help="書き込まず確認だけ行う")
    parser.add_argument("--replace-past-extras", action="store_true", default=True, help="既存の albirex_past_* を一度削除してから入れ直す。既定で有効")
    parser.add_argument("--no-replace-past-extras", action="store_true", help="既存の albirex_past_* を残したい場合だけ指定")
    parser.add_argument("--start-url", default=START_URL)
    parser.add_argument("--year", default="", help="指定年だけ処理する。例: --year 2004")
    parser.add_argument("--self-test", action="store_true", help="Web取得なしでパーサ単体テストを実行する")
    args = parser.parse_args()
    if args.self_test:
        run_self_test()
        return
    if args.no_replace_past_extras:
        args.replace_past_extras = False

    input_dir = Path(args.input_dir)
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[INPUT_DIR] {input_dir}")
    print(f"[START] {args.start_url}")
    print(f"[DRY_RUN] {args.dry_run}")
    print(f"[REPLACE_PAST_EXTRAS] {args.replace_past_extras}")

    game_pages = collect_game_pages(args.start_url)
    if args.year:
        game_pages = [p for p in game_pages if str(p.get("year", "")) == str(args.year)]
    save_json(DEBUG_DIR / "01_game_pages.json", game_pages)
    print(f"[FOUND] game pages: {len(game_pages)}")

    all_links: list[dict] = []
    for page in game_pages:
        try:
            links = collect_match_links_from_page(page)
            all_links.extend(links)
            print(f"[PAGE] {page['year']} {len(links)} links {page['url']}")
            time.sleep(SLEEP_SECONDS)
        except Exception as e:
            msg = f"collect failed: {page['url']} {e}"
            print(f"[ERROR] {msg}")
            log_error(msg)

    deduped: list[dict] = []
    seen_urls: set[str] = set()
    for link in all_links:
        if link["detail_url"] in seen_urls:
            continue
        seen_urls.add(link["detail_url"])
        deduped.append(link)
    all_links = deduped
    save_json(DEBUG_DIR / "02_target_match_links.json", all_links)
    print(f"[FOUND] target links: {len(all_links)}")

    records: list[dict] = []
    error_count = 0
    warning_count = 0
    for idx, link in enumerate(all_links, start=1):
        try:
            record = parse_detail_page(link)
            warnings = validate_record(record)
            if warnings:
                warning_count += len(warnings)
                print(f"[WARN] {record.get('match_card_id')}")
                for w in warnings:
                    print(f"  - {w}")
                # 致命的なものは追加しない。日付やスコア不正、フッター混入は前回の事故原因。
                fatal = any("会社情報" in w or "不正" in w or " が空" in w for w in warnings if not w.startswith("attendance"))
                if fatal:
                    print("  -> SKIP fatal warning")
                    continue
            records.append(record)
            side = "HOME" if record.get("home_team") == TEAM_NAME else "AWAY"
            print(
                f"[{idx}/{len(all_links)}] OK {record.get('season')} {record.get('date')} "
                f"{record.get('competition')} {record.get('section')} "
                f"{record.get('home_team')} {record.get('home_score')}-{record.get('away_score')} {record.get('away_team')} side={side}"
            )
            print(f"  kickoff: {record.get('kickoff')} stadium: {record.get('stadium')}")
            print(f"  members: home={len(record.get('home_details', {}).get('starting', []))}+{len(record.get('home_details', {}).get('substitutes', []))} away={len(record.get('away_details', {}).get('starting', []))}+{len(record.get('away_details', {}).get('substitutes', []))} goals={len(record.get('home_goals', []))}+{len(record.get('away_goals', []))}")
            time.sleep(SLEEP_SECONDS)
        except Exception as e:
            error_count += 1
            msg = f"parse failed: {link.get('detail_url')} {e}"
            print(f"[ERROR] {msg}")
            log_error(msg)

    save_json(DEBUG_DIR / "03_records_to_append.json", records)
    summary = write_grouped_records(input_dir, records, dry_run=args.dry_run, replace_past_extras=args.replace_past_extras)

    print("\n[DONE]")
    print(f"records: {len(records)}")
    print(f"appended: {summary['appended']}")
    print(f"skipped_duplicate: {summary['skipped_duplicate']}")
    print(f"removed_old: {summary['removed_old']}")
    print(f"errors: {error_count}")
    print(f"warnings: {warning_count}")
    print(f"debug links: {DEBUG_DIR / '02_target_match_links.json'}")
    print(f"debug records: {DEBUG_DIR / '03_records_to_append.json'}")
    for f in summary["files"]:
        print(f"file: {f['file']} {f['before']} -> {f['after']}")


if __name__ == "__main__":
    main()
