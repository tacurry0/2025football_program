#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Albirex Niigata past extra match scraper & merger

対象:
  https://www.albirex.co.jp/past/seasondata.htm

取得対象:
- 天皇杯
- サテライト / Jサテライトリーグ
- プレシーズンマッチ
- ワールドチャレンジ

除外:
- なでしこリーグ
- レディース
- 女子系ページ

仕様:
- seasondata.htm を CP932 / Shift_JIS 寄りで読む
- 各年の試合結果ページを取得
- 右上プルダウンの <option value="..."> も展開
- 対象大会セクション配下の試合詳細リンクを収集
- 詳細ページから取れる範囲でメンバー・得点者・交代・警告・試合情報を取得
- 新潟県内会場なら home_team=アルビレックス新潟
- 新潟県外会場なら away_team=アルビレックス新潟
- 既存の C:\\Users\\takahashi\\Desktop\\2025football_program\\trapp\\data\\history\\niigata\\{year}.json に混ぜる

Usage:
  cd C:\\Users\\takahashi\\Desktop\\2025football_program\\trapp

  # まず確認
  py .\\data\\scripts\\merge_albirex_past_extra_matches_into_history.py --dry-run --reset-resume

  # 問題なければ本実行
  py .\\data\\scripts\\merge_albirex_past_extra_matches_into_history.py --reset-resume
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import time
import unicodedata
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag, NavigableString


# =========================
# 設定
# =========================

START_URL = "https://www.albirex.co.jp/past/seasondata.htm"

INPUT_DIR = Path(r"C:\Users\takahashi\Desktop\2025football_program\trapp\data\history\niigata")

TEAM_NAME = "アルビレックス新潟"

RESUME_FILE = Path("resume_albirex_past_extra_matches_merge.json")
ERROR_LOG = Path("error_albirex_past_extra_matches_merge.log")
DEBUG_DIR = Path("debug_albirex_past_extra_matches")

SLEEP_SECONDS = 0.8

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
}

TARGET_COMPETITION_KEYWORDS = [
    "天皇杯",
    "サテライト",
    "プレシーズン",
    "ワールドチャレンジ",
]

EXCLUDE_COMPETITION_KEYWORDS = [
    "なでしこ",
    "レディース",
    "女子",
    "プレナス",
]

# 会場名にこの文字列が含まれていたら新潟県内ホーム扱い
NIIGATA_HOME_KEYWORDS = [
    "新潟",
    "東北電力ビッグスワン",
    "ビッグスワン",
    "デンカビッグスワン",
    "新潟スタジアム",
    "新潟市陸上競技場",
    "新発田",
    "五十公野",
    "胎内",
    "長岡",
    "聖籠",
    "十日町",
    "刈羽",
    "柏崎",
    "上越",
]


# =========================
# 共通処理
# =========================

def clean(text) -> str:
    if text is None:
        return ""
    text = str(text)
    text = text.replace("\xa0", " ").replace("\u3000", " ")
    return re.sub(r"\s+", " ", text).strip()


def normalize_text(text) -> str:
    return unicodedata.normalize("NFKC", clean(text))


def normalize_minute(text: str) -> str:
    s = normalize_text(text)
    s = s.replace("’", "'").replace("′", "'").replace("`", "'")
    s = s.replace("※", "'")

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
    with ERROR_LOG.open("a", encoding="utf-8") as f:
        f.write(msg + "\n")


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_resume() -> dict:
    if RESUME_FILE.exists():
        return load_json(RESUME_FILE)
    return {"completed_urls": []}


def save_resume(data: dict) -> None:
    save_json(RESUME_FILE, data)


def decode_html(raw: bytes, url: str, content_type: str = "") -> str:
    content_type_l = content_type.lower()
    head_ascii = raw[:5000].decode("ascii", errors="ignore").lower()

    candidates = []

    if "shift_jis" in content_type_l or "shift_jis" in head_ascii or "x-sjis" in head_ascii:
        candidates += ["cp932", "shift_jis"]

    if "utf-8" in content_type_l or "utf-8" in head_ascii:
        candidates.append("utf-8")

    if "/past/" in url:
        candidates += ["cp932", "shift_jis", "utf-8"]
    else:
        candidates += ["utf-8", "cp932", "shift_jis"]

    seen = set()
    candidates = [x for x in candidates if not (x in seen or seen.add(x))]

    best_text = ""
    best_score = 10**9

    for enc in candidates:
        text = raw.decode(enc, errors="replace")

        bad = text.count("\ufffd")
        bad += text.count("縺") * 3
        bad += text.count("荳") * 3
        bad += text.count("譁") * 3

        good = 0
        for kw in ["アルビレックス", "新潟", "天皇杯", "サテライト", "プレシーズン", "ワールドチャレンジ", "試合", "得点"]:
            good += text.count(kw)

        score = bad * 10 - good

        if score < best_score:
            best_score = score
            best_text = text

    return best_text


def get_soup(url: str) -> BeautifulSoup:
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    html = decode_html(r.content, url, r.headers.get("content-type", ""))
    return BeautifulSoup(html, "html.parser")


def tag_visible_text(tag: Tag) -> str:
    parts = []

    text = tag.get_text(" ", strip=True)
    if text:
        parts.append(text)

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
    lines = []

    for raw in soup.get_text("\n", strip=True).splitlines():
        t = normalize_text(raw)
        if t:
            lines.append(t)

    for tag in soup.find_all(["h1", "h2", "h3", "h4", "h5", "th", "td", "p", "div", "img"]):
        t = tag_visible_text(tag)
        if t and t not in lines:
            lines.append(t)

    return lines


def year_from_text(text: str) -> str:
    m = re.search(r"(19\d{2}|20\d{2})", normalize_text(text))
    return m.group(1) if m else ""


def year_from_url(url: str) -> str:
    m = re.search(r"data(19\d{2}|20\d{2})|_(19\d{2}|20\d{2})|/(19\d{2}|20\d{2})/", url)
    if not m:
        return ""
    for g in m.groups():
        if g:
            return g
    return ""


def is_html_like_url(url: str) -> bool:
    u = url.lower()
    return u.endswith(".htm") or u.endswith(".html") or u.endswith("/")


def score_text_to_pair(score: str) -> tuple[str, str]:
    s = normalize_text(score)
    m = re.search(r"(\d+)\s*[-－]\s*(\d+)", s)
    if not m:
        return "", ""
    return m.group(1), m.group(2)


def pk_text_to_pair(text: str) -> tuple[str, str]:
    s = normalize_text(text)

    m = re.search(r"PK\s*(\d+)\s*[-－]\s*(\d+)", s, re.IGNORECASE)
    if m:
        return m.group(1), m.group(2)

    m = re.search(r"(\d+)\s*PK戦\s*(\d+)", s)
    if m:
        return m.group(1), m.group(2)

    return "", ""


def normalize_team_name(name: str) -> str:
    s = normalize_text(name)
    s = s.replace("ＦＣ", "FC")
    s = s.replace("Ｆ．Ｃ．", "F.C.")
    return s


def normalize_section(section: str) -> str:
    s = normalize_text(section)

    m = re.match(r"^(\d+)回戦$", s)
    if m:
        return f"第{m.group(1)}回戦"

    m = re.match(r"^(\d+)$", s)
    if m:
        return f"第{m.group(1)}回戦"

    return s


def make_match_id(url: str, year: str, competition: str) -> str:
    path = urlparse(url).path
    stem = Path(path).stem or "unknown"

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


def is_niigata_home_venue(stadium: str) -> bool:
    s = normalize_text(stadium)
    return any(k in s for k in NIIGATA_HOME_KEYWORDS)


def contains_target_competition(text: str) -> bool:
    t = normalize_text(text)
    if any(x in t for x in EXCLUDE_COMPETITION_KEYWORDS):
        return False
    return any(x in t for x in TARGET_COMPETITION_KEYWORDS)


def is_navigation_like_heading(text: str) -> bool:
    t = normalize_text(text)
    if not t:
        return False

    comp_terms = [
        "Jリーグ",
        "ディビジョン",
        "J1",
        "J2",
        "ナビスコ",
        "ルヴァン",
        "天皇杯",
        "サテライト",
        "なでしこ",
        "プレナス",
        "プレシーズン",
        "ワールドチャレンジ",
    ]

    hit = sum(1 for x in comp_terms if x in t)

    # 上部ナビのように大会名が複数並ぶものを除外
    if hit >= 3 and len(t) >= 20:
        return True

    return False


def is_target_competition_heading_text(text: str) -> bool:
    t = normalize_text(text)

    if not contains_target_competition(t):
        return False

    if is_navigation_like_heading(t):
        return False

    return True


def is_any_competition_heading_text(text: str) -> bool:
    t = normalize_text(text)
    if not t:
        return False

    comp_terms = [
        "Jリーグ",
        "ディビジョン",
        "J1",
        "J2",
        "ナビスコ",
        "ルヴァン",
        "天皇杯",
        "サテライト",
        "なでしこ",
        "プレナス",
        "プレシーズン",
        "ワールドチャレンジ",
    ]

    if any(x in t for x in comp_terms):
        if not is_navigation_like_heading(t):
            return True

    return False


def normalize_competition_name(text: str) -> str:
    t = normalize_text(text)

    if "なでしこ" in t or "プレナス" in t or "レディース" in t:
        return ""

    m = re.search(r"(第\d+回\s*天皇杯\s*(?:全日本|全国).*?サッカー選手権大会)", t)
    if m:
        return normalize_text(m.group(1))

    if "天皇杯" in t:
        m = re.search(r"(第\d+回\s*天皇杯[^\s]*)", t)
        if m:
            return normalize_text(m.group(1))
        return "天皇杯"

    if "サテライト" in t:
        # 例: 2008 2008 Jサテライトリーグ Bグループ
        t = re.sub(r"^(19\d{2}|20\d{2})\s+(19\d{2}|20\d{2})\s*", "", t)
        t = re.sub(r"^(19\d{2}|20\d{2})\s*", "", t)
        return normalize_text(t) or "Jサテライトリーグ"

    if "プレシーズン" in t:
        return t

    if "ワールドチャレンジ" in t:
        return t

    return t


# =========================
# seasondata / dropdown 展開
# =========================

def collect_dropdown_urls_from_soup(soup: BeautifulSoup, base_url: str, year_hint: str = "") -> list[dict[str, str]]:
    results = []
    seen = set()

    for option in soup.find_all("option"):
        value = clean(option.get("value") or "")
        label = tag_visible_text(option)

        if not value:
            continue

        if value.startswith("#"):
            continue

        if value.lower().startswith("javascript:"):
            continue

        full_url = urljoin(base_url, value)

        if "/past/" not in full_url:
            continue

        if not is_html_like_url(full_url):
            continue

        year = year_from_url(full_url) or year_from_text(label) or year_hint

        if not year:
            continue

        if full_url in seen:
            continue

        seen.add(full_url)

        results.append({
            "year": year,
            "url": full_url,
            "label": label or "dropdown option",
            "source": "dropdown",
        })

    return results


def collect_frame_urls_from_soup(soup: BeautifulSoup, base_url: str, year_hint: str = "") -> list[dict[str, str]]:
    results = []
    seen = set()

    for tag in soup.find_all(["frame", "iframe"]):
        src = clean(tag.get("src") or "")

        if not src:
            continue

        full_url = urljoin(base_url, src)

        if "/past/" not in full_url:
            continue

        if not is_html_like_url(full_url):
            continue

        year = year_from_url(full_url) or year_hint

        if not year:
            continue

        if full_url in seen:
            continue

        seen.add(full_url)

        results.append({
            "year": year,
            "url": full_url,
            "label": "frame",
            "source": "frame",
        })

    return results


def collect_year_game_pages() -> list[dict[str, str]]:
    soup = get_soup(START_URL)

    results = []
    seen = set()
    current_year = ""

    def add_page(year: str, url: str, label: str, source: str):
        if not year or not url:
            return

        if "/past/" not in url:
            return

        if not is_html_like_url(url):
            return

        if url in seen:
            return

        seen.add(url)
        results.append({
            "year": year,
            "url": url,
            "label": label,
            "source": source,
        })

    # seasondata.htm 上の通常リンク
    for elem in soup.find_all(["h1", "h2", "h3", "h4", "h5", "p", "td", "th", "li", "div", "a"]):
        text = tag_visible_text(elem)
        y = year_from_text(text)

        if y:
            current_year = y

        if elem.name != "a":
            continue

        href = elem.get("href") or ""

        if not href:
            continue

        label = tag_visible_text(elem)
        full_url = urljoin(START_URL, href)
        url_year = year_from_url(full_url)
        year = url_year or current_year

        is_game_page = (
            "試合結果" in label
            or "試合日程" in label
            or re.search(r"game[_-]?(19\d{2}|20\d{2})\.html?$", href, re.IGNORECASE)
            or re.search(r"/data(19\d{2}|20\d{2})/index\.htm", full_url, re.IGNORECASE)
        )

        if not is_game_page:
            continue

        add_page(year, full_url, label, "seasondata-link")

    # seasondata.htm 自体のプルダウン
    for item in collect_dropdown_urls_from_soup(soup, START_URL):
        add_page(item["year"], item["url"], item["label"], item["source"])

    # 各年ページ内の右上プルダウン / frame を展開
    queue = list(results)
    checked = set()

    while queue:
        page = queue.pop(0)
        page_url = page["url"]

        if page_url in checked:
            continue

        checked.add(page_url)

        try:
            psoup = get_soup(page_url)
        except Exception as e:
            log_error(f"expand failed: {page_url} {e}")
            continue

        extra_pages = []
        extra_pages.extend(
            collect_dropdown_urls_from_soup(
                psoup,
                page_url,
                year_hint=page.get("year", "")
            )
        )
        extra_pages.extend(
            collect_frame_urls_from_soup(
                psoup,
                page_url,
                year_hint=page.get("year", "")
            )
        )

        for item in extra_pages:
            before = len(results)
            add_page(item["year"], item["url"], item["label"], item["source"])

            if len(results) > before:
                queue.append(results[-1])

        time.sleep(0.3)

    results.sort(key=lambda x: (x["year"], x["url"]))
    return results


# =========================
# 試合リンク抽出
# =========================

def is_probable_match_link(a: Tag, row_text: str) -> bool:
    href = a.get("href") or ""
    href_l = href.lower()
    text = normalize_text(a.get_text(" ", strip=True))
    combined = f"{text} {row_text} {href_l}"

    if any(href_l.endswith(ext) for ext in [".gif", ".jpg", ".jpeg", ".png", ".css", ".js"]):
        return False

    if any(x in combined for x in ["順位", "得点ランキング", "seasondata", "ページtop", "戻る"]):
        return False

    if re.search(r"\d+\s*[-－]\s*\d+", combined):
        return True

    if "result" in href_l:
        return True

    if "kekka" in href_l:
        return True

    if "score" in href_l:
        return True

    return False


def row_text_for_anchor(a: Tag) -> str:
    tr = a.find_parent("tr")
    if tr:
        return tag_visible_text(tr)

    for parent_name in ["li", "p", "div", "td", "th"]:
        p = a.find_parent(parent_name)
        if p:
            return tag_visible_text(p)

    return tag_visible_text(a.parent) if a.parent else tag_visible_text(a)


def parse_schedule_row_context(row_text: str, score_text: str, competition_name: str) -> dict[str, str]:
    text = normalize_text(row_text)

    score = normalize_text(score_text)
    if not score:
        m_score = re.search(r"\d+\s*[-－]\s*\d+", text)
        if m_score:
            score = m_score.group(0)

    pk_home, pk_away = pk_text_to_pair(text)

    section = ""
    date_md = ""
    kickoff = ""
    opponent = ""
    stadium = ""

    if "天皇杯" in competition_name:
        m = re.search(r"(^|\s)(第?\d+回戦|準々決勝|準決勝|決勝|\d+)(?=\s)", text)
        if m:
            sec = m.group(2)
            section = normalize_section(sec)

    else:
        # サテライト等は節・回戦がないことも多いので、無理に数字を節扱いしない
        m = re.search(r"(^|\s)(第?\d+節|第?\d+戦|準々決勝|準決勝|決勝)(?=\s)", text)
        if m:
            section = normalize_section(m.group(2))

    m = re.search(r"(\d{1,2})/(\d{1,2})\s*[（(][^）)]*[）)]", text)
    if m:
        date_md = f"{int(m.group(1)):02d}/{int(m.group(2)):02d}"

    m = re.search(r"(\d{1,2})[:：](\d{2})", text)
    if m:
        kickoff = f"{int(m.group(1)):02d}:{m.group(2)}"

    before_score = text
    if score and score in before_score:
        before_score = before_score.split(score)[0]

    before_score = re.sub(r"^\s*(第?\d+回戦|準々決勝|準決勝|決勝|\d+)\s+", " ", before_score)
    before_score = re.sub(r"\d{1,2}/\d{1,2}\s*[（(][^）)]*[）)]", " ", before_score)
    before_score = re.sub(r"\d{1,2}[:：]\d{2}", " ", before_score)
    before_score = re.sub(r"[○●△□■▲▽]", " ", before_score)
    before_score = re.sub(r"TV・ラジオ中継|結果|対戦チーム|試合会場|開催日|時刻|回戦|節", " ", before_score)
    before_score = normalize_text(before_score)

    tokens = before_score.split()

    # 大会名・見出し系の残骸を削る
    tokens = [
        x for x in tokens
        if not any(k in x for k in ["天皇杯", "サテライト", "プレシーズン", "ワールドチャレンジ", "選手権", "大会", "グループ"])
    ]

    if tokens:
        opponent = normalize_team_name(tokens[0])
        if len(tokens) >= 2:
            stadium = normalize_text(" ".join(tokens[1:]))

    return {
        "score_text": score,
        "pk_albirex_score": pk_home,
        "pk_opponent_score": pk_away,
        "section": section,
        "date_md": date_md,
        "kickoff": kickoff,
        "opponent": opponent,
        "stadium": stadium,
    }


def collect_links_between_heading(heading: Tag, year: str, game_page_url: str, heading_text: str) -> list[dict[str, str]]:
    links = []
    seen = set()
    competition_name = normalize_competition_name(heading_text)

    for elem in heading.next_elements:
        if isinstance(elem, NavigableString):
            continue

        if not isinstance(elem, Tag):
            continue

        if heading in elem.parents:
            continue

        elem_text = tag_visible_text(elem)

        if elem.name != "a" and is_any_competition_heading_text(elem_text):
            break

        if elem.name != "a":
            continue

        href = elem.get("href") or ""
        if not href:
            continue

        row_text = row_text_for_anchor(elem)

        if not is_probable_match_link(elem, row_text):
            continue

        detail_url = urljoin(game_page_url, href)

        if detail_url in seen:
            continue

        seen.add(detail_url)

        score_text = normalize_text(elem.get_text(" ", strip=True))
        ctx = parse_schedule_row_context(row_text, score_text, competition_name)

        links.append({
            "year": year,
            "game_page_url": game_page_url,
            "detail_url": detail_url,
            "competition_heading": heading_text,
            "competition_name": competition_name,
            "row_text": row_text,
            **ctx,
        })

    return links


def collect_match_links_from_page(game_page: dict[str, str]) -> list[dict[str, str]]:
    year = game_page["year"]
    url = game_page["url"]
    soup = get_soup(url)

    links = []
    seen = set()

    heading_tags = []

    for tag in soup.find_all(True):
        txt = tag_visible_text(tag)

        if is_target_competition_heading_text(txt):
            heading_tags.append((tag, txt))

    for heading, heading_text in heading_tags:
        block_links = collect_links_between_heading(heading, year, url, heading_text)

        for item in block_links:
            key = item["detail_url"]

            if key in seen:
                continue

            seen.add(key)
            links.append(item)

    # fallback:
    # 見出しブロックが拾えない古いページ用。
    # 行テキスト自体に対象大会名が入っているリンクだけ拾う。
    if not links:
        for a in soup.find_all("a", href=True):
            row_text = row_text_for_anchor(a)
            combined = normalize_text(f"{tag_visible_text(a)} {row_text} {a.get('href', '')}")

            if not contains_target_competition(combined):
                continue

            if not is_probable_match_link(a, row_text):
                continue

            detail_url = urljoin(url, a["href"])

            if detail_url in seen:
                continue

            seen.add(detail_url)

            heading = ""
            for kw in TARGET_COMPETITION_KEYWORDS:
                if kw in combined:
                    heading = kw
                    break

            competition_name = normalize_competition_name(heading)

            score_text = normalize_text(a.get_text(" ", strip=True))
            ctx = parse_schedule_row_context(row_text, score_text, competition_name)

            links.append({
                "year": year,
                "game_page_url": url,
                "detail_url": detail_url,
                "competition_heading": heading,
                "competition_name": competition_name,
                "row_text": row_text,
                **ctx,
            })

    return links


# =========================
# 詳細ページ抽出
# =========================

def find_detail_title(lines: list[str]) -> str:
    for line in lines:
        s = normalize_text(line)
        if contains_target_competition(s) and ("vs" in s.lower() or "VS" in s or "対" in s):
            return s

    for line in lines:
        s = normalize_text(line)
        if contains_target_competition(s) and ("回戦" in s or "準決勝" in s or "決勝" in s or "グループ" in s):
            return s

    return ""


def parse_title(title: str, fallback_heading: str, fallback_competition: str, fallback_section: str, fallback_opponent: str) -> dict[str, str]:
    title_n = normalize_text(title)

    competition = ""
    section = ""
    opponent = normalize_team_name(fallback_opponent)

    # 天皇杯
    m = re.search(
        r"(第\d+回\s*天皇杯\s*(?:全日本|全国).*?サッカー選手権大会)\s+((?:第)?\d+回戦|準々決勝|準決勝|決勝)\s+(?:vs|VS|対)\s+(.+)$",
        title_n,
    )
    if m:
        competition = normalize_text(m.group(1))
        section = normalize_section(m.group(2))
        opponent = normalize_team_name(m.group(3))

    # その他
    if not competition:
        if contains_target_competition(title_n):
            competition = normalize_competition_name(title_n)

        m_sec = re.search(r"((?:第)?\d+回戦|第?\d+節|第?\d+戦|準々決勝|準決勝|決勝|[A-ZＡ-Ｚ]グループ)", title_n)
        if m_sec:
            section = normalize_section(m_sec.group(1))

        m_opp = re.search(r"(?:vs|VS|対)\s+(.+)$", title_n)
        if m_opp:
            opponent = normalize_team_name(m_opp.group(1))

    if not competition:
        competition = fallback_competition or normalize_competition_name(fallback_heading)

    if not section:
        section = normalize_section(fallback_section)

    return {
        "competition": competition,
        "section": section,
        "opponent": opponent,
    }


def parse_scoreboard_stats(lines: list[str]) -> list[dict[str, str]]:
    stats = []

    for line in lines:
        s = normalize_text(line)

        m = re.search(r"SH\s+(\d+).*?(\d+)\s+SH$", s)
        if m:
            stats.append({"type": "SH", "home": m.group(1), "away": m.group(2)})

        m = re.search(r"GK\s+(\d+).*?(\d+)\s+GK", s)
        if m:
            stats.append({"type": "GK", "home": m.group(1), "away": m.group(2)})

        m = re.search(r"CK\s+(\d+)\s+FK\s+(\d+).*?(\d+)\s+FK\s+(\d+)\s+CK", s)
        if m:
            stats.append({"type": "CK", "home": m.group(1), "away": m.group(4)})
            stats.append({"type": "FK", "home": m.group(2), "away": m.group(3)})

        m = re.search(r"オフサイド\s+(\d+).*?(\d+)\s+オフサイド", s)
        if m:
            stats.append({"type": "オフサイド", "home": m.group(1), "away": m.group(2)})

    dedup = []
    seen = set()

    for st in stats:
        key = (st["type"], st["home"], st["away"])
        if key in seen:
            continue
        seen.add(key)
        dedup.append(st)

    return dedup


def parse_goals(lines: list[str]) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    albirex_goals = []
    opponent_goals = []

    start = None

    for i, line in enumerate(lines):
        s = normalize_text(line)
        if s == "得点" or s.startswith("得点 "):
            start = i
            break

    if start is None:
        return albirex_goals, opponent_goals

    end = len(lines)
    for i in range(start + 1, len(lines)):
        if "監督" in lines[i]:
            end = i
            break

    block = lines[start + 1:end]

    side = "albirex"

    for raw in block:
        line = normalize_text(raw)

        if not line:
            continue

        if line in ["得点", "PK", "延前", "前半", "後半"]:
            continue

        # 旧ページで右側チームの得点に移る区切りとして出ることがある
        if line in ["延後", "相手", "対戦相手"]:
            side = "opponent"
            continue

        m = re.match(r"^(\d{1,3}(?:[′’']\+\d+)?[′’']?|\d{1,3}分)\s*(.+)$", line)
        if not m:
            continue

        minute = normalize_minute(m.group(1))
        name = normalize_text(m.group(2))

        goal = {
            "time": minute,
            "name": name,
        }

        if side == "albirex":
            albirex_goals.append(goal)
        else:
            opponent_goals.append(goal)

    return albirex_goals, opponent_goals


def parse_manager_line(lines: list[str]) -> tuple[str, str]:
    for line in lines:
        s = normalize_text(line)

        if not (s.startswith("監督 ") and s.endswith(" 監督")):
            continue

        middle = re.sub(r"^監督\s*", "", s)
        middle = re.sub(r"\s*監督$", "", middle)

        parts = middle.split()

        if len(parts) >= 4:
            half = len(parts) // 2
            return " ".join(parts[:half]), " ".join(parts[half:])

        if len(parts) == 2:
            return parts[0], parts[1]

    return "", ""


def parse_member_row(line: str):
    s = normalize_text(line)

    m = re.match(r"^(.+?)\s+(\d+)\s+(GK|DF|MF|FW)\s+(GK|DF|MF|FW)\s+(\d+)\s+(.+)$", s)
    if not m:
        return None

    return {
        "albirex": {
            "position": m.group(3),
            "number": m.group(2),
            "name": normalize_text(m.group(1)),
        },
        "opponent": {
            "position": m.group(4),
            "number": m.group(5),
            "name": normalize_text(m.group(6)),
        },
    }


def parse_members(lines: list[str]) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    albirex_starting = []
    opponent_starting = []
    albirex_subs = []
    opponent_subs = []

    mode = ""

    for raw in lines:
        line = normalize_text(raw)

        if "メンバー" in line and "ポジション" in line and "選手名" in line:
            mode = "starting"
            continue

        if "控え選手" in line and "ポジション" in line and "選手名" in line:
            mode = "substitutes"
            continue

        if "交代" in line and "IN/OUT" in line:
            mode = ""
            continue

        row = parse_member_row(line)
        if not row:
            continue

        if mode == "starting":
            albirex_starting.append(row["albirex"])
            opponent_starting.append(row["opponent"])

        elif mode == "substitutes":
            albirex_subs.append(row["albirex"])
            opponent_subs.append(row["opponent"])

    return albirex_starting, opponent_starting, albirex_subs, opponent_subs


def parse_substitutions(lines: list[str]) -> tuple[list[dict], list[dict]]:
    albirex_subs = []
    opponent_subs = []

    in_sub_section = False

    for raw in lines:
        line = normalize_text(raw)

        if "交代" in line and "IN/OUT" in line:
            in_sub_section = True
            continue

        if in_sub_section and ("警告" in line or "退場" in line):
            break

        if not in_sub_section:
            continue

        m = re.match(
            r"^(?:(?P<a_name>.+?)\s+(?P<a_time>\d{1,3}[′’']?(?:\+\d+)?|45※|90※)\s+OUT)?\s*OUT\s+(?P<o_time>\d{1,3}[′’']?(?:\+\d+)?|45※|90※)\s+(?P<o_name>.+)$",
            line,
        )
        if m:
            a_name = normalize_text(m.group("a_name") or "")
            a_time = normalize_minute(m.group("a_time") or "")
            o_name = normalize_text(m.group("o_name") or "")
            o_time = normalize_minute(m.group("o_time") or "")

            if a_name:
                albirex_subs.append({"in_out": "▽", "name": a_name, "time": a_time})
            if o_name:
                opponent_subs.append({"in_out": "▽", "name": o_name, "time": o_time})
            continue

        m = re.match(r"^OUT\s+OUT\s+(?P<o_time>\d{1,3}[′’']?(?:\+\d+)?|45※|90※)\s+(?P<o_name>.+)$", line)
        if m:
            opponent_subs.append({
                "in_out": "▽",
                "name": normalize_text(m.group("o_name")),
                "time": normalize_minute(m.group("o_time")),
            })
            continue

        m = re.match(r"^(?:(?P<a_name>.+?)\s+IN)?\s*IN\s+(?P<o_name>.+)$", line)
        if m:
            a_name = normalize_text(m.group("a_name") or "")
            o_name = normalize_text(m.group("o_name") or "")

            if a_name:
                albirex_subs.append({"in_out": "▲", "name": a_name, "time": ""})
            if o_name:
                opponent_subs.append({"in_out": "▲", "name": o_name, "time": ""})
            continue

        m = re.match(r"^IN\s+IN\s+(?P<o_name>.+)$", line)
        if m:
            opponent_subs.append({
                "in_out": "▲",
                "name": normalize_text(m.group("o_name")),
                "time": "",
            })

    return albirex_subs, opponent_subs


def parse_cards(lines: list[str]) -> tuple[list[dict], list[dict]]:
    albirex_cards = []
    opponent_cards = []

    in_card_section = False
    current_type = "警告"

    for raw in lines:
        line = normalize_text(raw)

        if "警告" in line and "選手名" in line:
            in_card_section = True
            current_type = "警告"
            continue

        if "退場" in line and "選手名" in line:
            in_card_section = True
            current_type = "退場"
            continue

        if in_card_section and line.startswith("日時 "):
            break

        if not in_card_section:
            continue

        time_matches = list(re.finditer(r"(\d{1,3}[′’']?(?:\+\d+)?|45※|90※)", line))
        if not time_matches:
            continue

        if len(time_matches) >= 2:
            t1 = time_matches[0]
            t2 = time_matches[1]

            a_name = normalize_text(line[:t1.start()])
            a_time = normalize_minute(t1.group(1))

            o_name = normalize_text(line[t2.end():])
            o_time = normalize_minute(t2.group(1))

            if a_name:
                albirex_cards.append({"type": current_type, "name": a_name, "time": a_time})
            if o_name:
                opponent_cards.append({"type": current_type, "name": o_name, "time": o_time})

        else:
            t = time_matches[0]
            before = normalize_text(line[:t.start()])
            after = normalize_text(line[t.end():])
            card_time = normalize_minute(t.group(1))

            if before:
                albirex_cards.append({"type": current_type, "name": before, "time": card_time})
            elif after:
                opponent_cards.append({"type": current_type, "name": after, "time": card_time})

    return albirex_cards, opponent_cards


def parse_match_info(lines: list[str], year: str) -> dict[str, str]:
    date = ""
    kickoff = ""
    weather = ""
    wind = ""
    temperature = ""
    stadium = ""
    attendance = ""
    pitch = ""
    referee_main = ""
    referee_assistants = ""

    for raw in lines:
        line = normalize_text(raw)

        if line.startswith("日時 "):
            m = re.search(r"日時\s+(\d{1,2})月(\d{1,2})日.*?(\d{1,2})[:：](\d{2})キックオフ", line)
            if m:
                mm = int(m.group(1))
                dd = int(m.group(2))
                date = f"{year}/{mm:02d}/{dd:02d}"
                kickoff = f"{int(m.group(3)):02d}:{m.group(4)}"

            m = re.search(r"天候\s+(.+?)(?:\s+風|$)", line)
            if m:
                weather = normalize_text(m.group(1))

            m = re.search(r"風[/／]気温\s+(.+?)[/／]\s*([\d.]+℃)", line)
            if m:
                wind = normalize_text(m.group(1))
                temperature = normalize_text(m.group(2))

        if line.startswith("試合会場 "):
            m = re.search(r"試合会場\s+(.+?)\s+入場者人数\s+([\d,]+)人", line)
            if m:
                stadium = normalize_text(m.group(1))
                attendance = m.group(2).replace(",", "")

            m = re.search(r"芝の状態\s+(.+)$", line)
            if m:
                pitch = normalize_text(m.group(1))

        if line.startswith("主審 "):
            m = re.search(r"主審\s+(.+?)\s+副審\s+(.+)$", line)
            if m:
                referee_main = normalize_text(m.group(1))
                referee_assistants = normalize_text(m.group(2).replace("／", "/"))

    return {
        "date": date,
        "kickoff": kickoff,
        "weather": weather,
        "wind": wind,
        "temperature": temperature,
        "stadium": stadium,
        "attendance": attendance,
        "pitch": pitch,
        "referee_main": referee_main,
        "referee_assistants": referee_assistants,
    }


def swap_stats_for_away(stats: list[dict[str, str]]) -> list[dict[str, str]]:
    swapped = []

    for st in stats:
        swapped.append({
            "type": st.get("type", ""),
            "home": st.get("away", ""),
            "away": st.get("home", ""),
        })

    return swapped


def parse_detail_page(link: dict[str, str]) -> dict:
    year = link["year"]
    url = link["detail_url"]
    soup = get_soup(url)
    lines = page_visible_lines(soup)

    title = find_detail_title(lines)

    title_info = parse_title(
        title=title,
        fallback_heading=link.get("competition_heading", ""),
        fallback_competition=link.get("competition_name", ""),
        fallback_section=link.get("section", ""),
        fallback_opponent=link.get("opponent", ""),
    )

    competition = title_info["competition"] or link.get("competition_name", "")
    section = title_info["section"] or link.get("section", "")
    opponent = title_info["opponent"] or link.get("opponent", "")
    opponent = normalize_team_name(opponent) or "不明"

    albirex_score, opponent_score = score_text_to_pair(link.get("score_text", ""))
    pk_albirex_score = link.get("pk_albirex_score", "")
    pk_opponent_score = link.get("pk_opponent_score", "")

    albirex_goals, opponent_goals = parse_goals(lines)
    stats = parse_scoreboard_stats(lines)

    albirex_starting, opponent_starting, albirex_bench, opponent_bench = parse_members(lines)
    albirex_subs, opponent_subs = parse_substitutions(lines)
    albirex_cards, opponent_cards = parse_cards(lines)
    albirex_manager, opponent_manager = parse_manager_line(lines)

    info = parse_match_info(lines, year)

    stadium = info["stadium"] or link.get("stadium", "")
    is_home = is_niigata_home_venue(stadium)

    albirex_details = {
        "starting": albirex_starting,
        "substitutes": albirex_bench,
        "substitutions": albirex_subs,
        "cards": albirex_cards,
        "manager": albirex_manager,
    }

    opponent_details = {
        "starting": opponent_starting,
        "substitutes": opponent_bench,
        "substitutions": opponent_subs,
        "cards": opponent_cards,
        "manager": opponent_manager,
    }

    if is_home:
        home_team = TEAM_NAME
        away_team = opponent
        home_score = albirex_score
        away_score = opponent_score
        pk_home_score = pk_albirex_score
        pk_away_score = pk_opponent_score
        home_goals = albirex_goals
        away_goals = opponent_goals
        home_details = albirex_details
        away_details = opponent_details
        final_stats = stats
        side_note = "新潟県内会場のためhome_teamをアルビレックス新潟に設定"
    else:
        home_team = opponent
        away_team = TEAM_NAME
        home_score = opponent_score
        away_score = albirex_score
        pk_home_score = pk_opponent_score
        pk_away_score = pk_albirex_score
        home_goals = opponent_goals
        away_goals = albirex_goals
        home_details = opponent_details
        away_details = albirex_details
        final_stats = swap_stats_for_away(stats)
        side_note = "新潟県外会場のためaway_teamをアルビレックス新潟に設定"

    record = {
        "match_card_id": make_match_id(url, year, competition),
        "url": url,
        "season": year,
        "competition": competition,
        "section": normalize_section(section),
        "home_team": home_team,
        "away_team": away_team,
        "home_score": home_score,
        "away_score": away_score,
        "pk_home_score": pk_home_score,
        "pk_away_score": pk_away_score,
        "date": info["date"],
        "kickoff": info["kickoff"] or link.get("kickoff", ""),
        "stadium": stadium,
        "attendance": info["attendance"],
        "weather": info["weather"],
        "temperature": info["temperature"],
        "humidity": "",
        "home_goals": home_goals,
        "away_goals": away_goals,
        "stats": final_stats,
        "home_details": home_details,
        "away_details": away_details,
        "referees": {
            "主審": info["referee_main"],
            "副審": info["referee_assistants"],
        },
        "source": {
            "type": "albirex_past",
            "seasondata_url": START_URL,
            "game_page_url": link.get("game_page_url", ""),
            "detail_url": url,
            "row_text": link.get("row_text", ""),
            "competition_heading": link.get("competition_heading", ""),
            "home_away_rule": "新潟県内会場ならホーム、それ以外はアウェイ",
            "note": side_note,
        },
        "extra": {
            "wind": info["wind"],
            "pitch": info["pitch"],
            "detail_title": title,
        },
    }

    return record


# =========================
# マージ処理
# =========================

def validate_record_shape(record: dict) -> list[str]:
    warnings = []

    required_top = [
        "match_card_id",
        "url",
        "season",
        "competition",
        "section",
        "home_team",
        "away_team",
        "home_score",
        "away_score",
        "date",
        "kickoff",
        "stadium",
        "attendance",
        "weather",
        "temperature",
        "humidity",
        "home_goals",
        "away_goals",
        "stats",
        "home_details",
        "away_details",
        "referees",
    ]

    for key in required_top:
        if key not in record:
            warnings.append(f"missing key: {key}")

    for side_key in ["home_details", "away_details"]:
        details = record.get(side_key)

        if not isinstance(details, dict):
            warnings.append(f"{side_key} is not dict")
            continue

        for key in ["starting", "substitutes", "substitutions", "cards", "manager"]:
            if key not in details:
                warnings.append(f"{side_key}.{key} missing")

    if TEAM_NAME not in record.get("home_team", "") and TEAM_NAME not in record.get("away_team", ""):
        warnings.append("target team not found in home_team/away_team")

    if not contains_target_competition(record.get("competition", "")):
        warnings.append(f"competition may be wrong: {record.get('competition')}")

    if any(x in record.get("competition", "") for x in EXCLUDE_COMPETITION_KEYWORDS):
        warnings.append(f"excluded competition detected: {record.get('competition')}")

    return warnings


def backup_file(path: Path) -> Path:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = path.with_suffix(path.suffix + f".bak_{ts}")
    shutil.copy2(path, backup)
    return backup


def merge_record_into_year_file(record: dict, dry_run: bool = False) -> dict:
    year = str(record.get("season") or "")

    if not year:
        raise ValueError("record season is empty")

    year_file = INPUT_DIR / f"{year}.json"

    if year_file.exists():
        existing = load_json(year_file)

        if not isinstance(existing, list):
            raise ValueError(f"{year_file} は配列JSONではありません")
    else:
        existing = []

    match_id = str(record.get("match_card_id", ""))
    url = str(record.get("url", ""))

    before_count = len(existing)

    filtered = [
        item for item in existing
        if str(item.get("match_card_id", "")) != match_id
        and str(item.get("url", "")) != url
    ]

    replaced = len(filtered) != len(existing)

    filtered.append(record)

    def sort_key(item: dict):
        return (
            str(item.get("date", "")),
            str(item.get("kickoff", "")),
            str(item.get("competition", "")),
            str(item.get("section", "")),
            str(item.get("match_card_id", "")),
        )

    filtered.sort(key=sort_key)

    if not dry_run:
        if year_file.exists():
            backup = backup_file(year_file)
            print(f"  backup: {backup}")

        save_json(year_file, filtered)

    return {
        "year_file": str(year_file),
        "before": before_count,
        "after": len(filtered),
        "replaced": replaced,
        "dry_run": dry_run,
    }


# =========================
# メイン
# =========================

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="JSONに書き込まず、抽出と検証だけ行う")
    parser.add_argument("--reset-resume", action="store_true", help="resumeを無視して最初から処理する")
    args = parser.parse_args()

    DEBUG_DIR.mkdir(parents=True, exist_ok=True)

    print(f"[INPUT_DIR] {INPUT_DIR}")
    print(f"[START] {START_URL}")
    print(f"[DRY_RUN] {args.dry_run}")
    print(f"[TARGET] {', '.join(TARGET_COMPETITION_KEYWORDS)}")
    print(f"[EXCLUDE] {', '.join(EXCLUDE_COMPETITION_KEYWORDS)}")

    game_pages = collect_year_game_pages()
    save_json(DEBUG_DIR / "01_game_pages.json", game_pages)
    print(f"[FOUND] year game pages: {len(game_pages)}")

    all_links = []

    for page in game_pages:
        try:
            links = collect_match_links_from_page(page)
            all_links.extend(links)

            print(
                f"[GAME] {page['year']} "
                f"{len(links)} target links: "
                f"{page['url']} "
                f"source={page.get('source', '')}"
            )

            time.sleep(SLEEP_SECONDS)

        except Exception as e:
            msg = f"collect failed: {page['url']} {e}"
            print("[ERROR]", msg)
            log_error(msg)

    # detail_urlで重複除去
    deduped_links = []
    seen_detail_urls = set()

    for link in all_links:
        url = link["detail_url"]

        if url in seen_detail_urls:
            continue

        seen_detail_urls.add(url)
        deduped_links.append(link)

    all_links = deduped_links

    save_json(DEBUG_DIR / "02_target_match_links.json", all_links)

    print(f"[FOUND] target match links: {len(all_links)}")
    print(f"[DEBUG] {DEBUG_DIR / '02_target_match_links.json'}")

    if not all_links:
        print("[STOP] 対象大会リンクが見つかりませんでした。")
        return

    if args.reset_resume:
        resume = {"completed_urls": []}
    else:
        resume = load_resume()

    completed = set(resume.get("completed_urls", []))

    records = []
    saved_count = 0
    skipped_count = 0
    error_count = 0
    warning_count = 0

    for idx, link in enumerate(all_links, start=1):
        url = link["detail_url"]

        if url in completed:
            skipped_count += 1
            print(f"[{idx}/{len(all_links)}] SKIP resume {url}")
            continue

        try:
            record = parse_detail_page(link)
            warnings = validate_record_shape(record)

            if warnings:
                warning_count += len(warnings)
                print(f"[WARN] {record.get('match_card_id')}")
                for w in warnings:
                    print(f"  - {w}")

            merge_info = merge_record_into_year_file(record, dry_run=args.dry_run)
            records.append(record)

            # dry-runではresumeを更新しない
            if not args.dry_run:
                completed.add(url)
                save_resume({"completed_urls": sorted(completed)})

            saved_count += 1

            side = "HOME" if TEAM_NAME in record.get("home_team", "") else "AWAY"

            print(
                f"[{idx}/{len(all_links)}] OK "
                f"{record.get('season')} "
                f"{record.get('competition')} "
                f"{record.get('section')} "
                f"{record.get('home_team')} {record.get('home_score')}-{record.get('away_score')} {record.get('away_team')} "
                f"side={side}"
            )
            print(f"  stadium: {record.get('stadium')}")
            print(
                f"  file: {merge_info['year_file']} "
                f"{merge_info['before']} -> {merge_info['after']} "
                f"replaced={merge_info['replaced']}"
            )

            time.sleep(SLEEP_SECONDS)

        except Exception as e:
            error_count += 1
            msg = f"{url} {e}"
            print("[ERROR]", msg)
            log_error(msg)

    save_json(DEBUG_DIR / "03_extracted_records.json", records)

    print("")
    print("[DONE]")
    print(f"saved/merged: {saved_count}")
    print(f"skipped: {skipped_count}")
    print(f"errors: {error_count}")
    print(f"warnings: {warning_count}")
    print(f"debug links: {DEBUG_DIR / '02_target_match_links.json'}")
    print(f"debug records: {DEBUG_DIR / '03_extracted_records.json'}")


if __name__ == "__main__":
    main()