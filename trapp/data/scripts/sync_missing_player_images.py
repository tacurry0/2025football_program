#!/usr/bin/env python3
"""Synchronize current player portraits AND profiles from the two club websites.

Niigata's detail PNG already has alpha: retain its pixels and alpha losslessly.
Kumamoto's detail _big image is retained at its original resolution. The cutout
builder handles opaque photos afterwards. Historical profiles/photos are kept.
"""
from __future__ import annotations

import hashlib
import argparse
import json
import re
import time
import unicodedata
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageOps

DATA = Path(__file__).resolve().parents[1]
APP = DATA.parent
ASSETS = DATA / "assets/official_players"
INDEX = APP / "player-official-index.js"
REPORT = DATA / "assets/images/player_image_sync_report.json"
CLUBS = {
    "niigata": {"name": "アルビレックス新潟", "short": "新潟", "url": "https://www.albirex.co.jp/team/player/"},
    "kumamoto": {"name": "ロアッソ熊本", "short": "熊本", "url": "https://roasso-k.com/clubteam/players"},
}
DELAY = 0.35
USER_AGENT = "Mozilla/5.0 (compatible; trapp-club-player-sync/2.0)"


def clean(value):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", str(value or ""))).strip()


def normalized_name(value):
    return re.sub(r"[\s・･]", "", clean(value))


def player_name(value):
    # Registration labels on Kumamoto's roster are not part of a player's name.
    return clean(re.sub(r"[（(][^）)]*(?:登録|指定)[^）)]*[）)]", "", str(value)))


def text(node):
    return clean(node.get_text(" ", strip=True)) if node else ""


def get_page(session, url):
    time.sleep(DELAY)
    r = session.get(url, timeout=(12, 40))
    r.raise_for_status()
    if urlparse(r.url).hostname != urlparse(url).hostname:
        raise ValueError(f"Unexpected redirect: {r.url}")
    return BeautifulSoup(r.content, "html.parser"), r.url


def roster(session, club):
    soup, url = get_page(session, CLUBS[club]["url"])
    if club == "niigata":
        # Discover the latest published season rather than guessing player URLs.
        seasons = set(re.findall(r"/team/player/(\d{4}(?:-\d{2})?)/", str(soup)))
        if seasons:
            season = max(seasons, key=lambda s: (int(s[:4]), "-" in s))
            latest = urljoin(url, f"/team/player/{season}/")
            if latest != url:
                soup, url = get_page(session, latest)
        players = []
        for a in soup.select("a.player-item[href]"):
            if not re.search(r"/team/player/\d{4}(?:-\d{2})?/\d+/$", a["href"]):
                continue
            players.append({"name": text(a.select_one(".player-name_jp")),
                            "name_en": text(a.select_one(".player-name_en")),
                            "position": text(a.select_one(".player-pos")),
                            "number": text(a.select_one(".player-number")),
                            "url": urljoin(url, a["href"])})
    else:
        players = []
        for a in soup.select("a[href]"):
            if not re.search(r"/clubteam/players/\d+$", a["href"]):
                continue
            img = a.find("img")
            number = text(a.select_one("h3 strong"))
            if not img or "_staff" in img.get("src", "") or not number.isdigit():
                continue
            heading = a.find_previous("h2")
            pos = re.match(r"(GK|DF|MF|FW)\b", text(heading))
            players.append({"name": player_name(text(a.find("p"))), "name_en": "",
                            "position": pos.group(1) if pos else "", "number": number,
                            "url": urljoin(url, a["href"])})
    unique = {p["url"]: p for p in players if p["name"]}
    if not unique:
        raise ValueError(f"No players found on official roster: {url}")
    return list(unique.values()), url


def detail(session, club, entry):
    soup, url = get_page(session, entry["url"])
    fields = {}
    if club == "niigata":
        for dl in soup.find_all("dl"):
            key, value = dl.find("dt"), dl.find("dd")
            if key and value:
                fields[text(key)] = text(value)
        portrait = soup.find("img", src=re.compile(r"/files/player/[^/]+/detail/"))
        name = fields.get("名前", entry["name"])
        english = text(soup.select_one(".player-head-detail .name")) or entry["name_en"]
    else:
        for tr in soup.select("table tr"):
            th, td = tr.find("th"), tr.find("td")
            if th and td:
                # Some official Q&A rows nest td inside an unclosed th.
                key = clean(" ".join(th.find_all(string=True, recursive=False)))
                fields[key or text(th)] = text(td)
        tables = soup.find_all("table")
        history = next((t for t in tables if len(t.select("td[colspan='2']")) and not t.find("th")), None)
        if history:
            fields["経歴"] = text(history)
        portrait = soup.find("img", src=re.compile(r"/img/players/\d+_big\.(?:jpg|jpeg|png|webp)(?:\?|$)", re.I))
        name = player_name(text(soup.find("h1"))) or entry["name"]
        english = entry["name_en"]
    if normalized_name(name) != normalized_name(entry["name"]):
        raise ValueError(f"Profile identity mismatch: {entry['name']} / {name}")
    if not portrait:
        raise ValueError(f"No detail portrait for {name}: {url}")
    image_url = urljoin(url, portrait["src"])
    if urlparse(image_url).hostname != urlparse(url).hostname:
        raise ValueError(f"Non-club portrait URL: {image_url}")
    birth = re.search(r"(\d{4})[年/.-](\d{1,2})[月/.-](\d{1,2})", fields.get("生年月日", ""))
    size = fields.get("身長/体重", "")
    height = re.search(r"(\d+)\s*cm", fields.get("身長", size))
    weight = re.search(r"(\d+)\.?\s*kg", fields.get("体重", size))
    if not birth or not height or not weight:
        raise ValueError(f"Incomplete basic profile for {name}: {url}")
    career = [clean(t) for t in re.split(r"\s*(?:→|～|〜|－)\s*", fields.get("経歴", "")) if clean(t)]
    current = CLUBS[club]["name"]
    if not career or normalized_name(career[-1]) != normalized_name(current):
        career.append(current)
    return {
        "source": "club_official", "source_confidence": "high", "club": club,
        "app_player_name": name, "name": name, "official_name": name,
        "name_en": english, "position": entry["position"], "number": entry["number"],
        "birth_date": f"{int(birth[1]):04d}/{int(birth[2]):02d}/{int(birth[3]):02d}",
        "birthplace": fields.get("出身地", ""), "height_cm": int(height[1]), "weight_kg": int(weight[1]),
        "final_team": CLUBS[club]["short"], "affiliated_teams": career,
        "nickname": fields.get("ニックネーム", ""), "blood_type": fields.get("血液型", ""),
        "dominant_foot": fields.get("利き足", ""), "club_profile_fields": fields,
        "links": {"club_official": url}, "image_source_url": image_url,
    }


def save_portrait(session, club, url):
    time.sleep(DELAY)
    r = session.get(url, timeout=(12, 45))
    r.raise_for_status()
    if urlparse(r.url).hostname != urlparse(url).hostname:
        raise ValueError(f"Unexpected portrait redirect: {r.url}")
    with Image.open(BytesIO(r.content)) as source:
        image = ImageOps.exif_transpose(source)
        image.load()
        if min(image.size) < 300:
            raise ValueError(f"Refusing small portrait: {image.size}")
        has_alpha = "A" in image.getbands() and image.getchannel("A").getextrema()[0] < 255
        if club == "niigata" and not has_alpha:
            raise ValueError("Niigata detail portrait is not transparent; refusing thumbnail fallback")
        # Lossless WebP keeps every source pixel and native alpha; never resize.
        encoded = BytesIO()
        image.convert("RGBA" if has_alpha else "RGB").save(encoded, format="WEBP", lossless=True, method=6)
        data = encoded.getvalue()
        digest = hashlib.sha256(data).hexdigest()[:24]
        target = ASSETS / club / f"{digest}.webp"
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            target.write_bytes(data)
        return {"photo": "./" + target.relative_to(APP).as_posix(), "source_url": url,
                "width": image.width, "height": image.height, "native_alpha": has_alpha}


def write_json(path, data):
    content = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.read_text(encoding="utf-8") != content:
        path.write_text(content, encoding="utf-8")


def load_index():
    if INDEX.exists():
        return json.loads(INDEX.read_text(encoding="utf-8").split("window.TrappOfficialPlayers =", 1)[1].strip().rstrip(";"))
    return {}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", help="Refresh only names containing this text, preserving the other entries")
    args = parser.parse_args()
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "ja"})
    report = {"source": "club official player detail pages", "synced": [], "errors": []}
    if args.name and REPORT.exists():
        report = json.loads(REPORT.read_text(encoding="utf-8"))
        for field in ("synced", "errors"):
            report[field] = [row for row in report.get(field, []) if normalized_name(args.name) not in normalized_name(row.get("name", ""))]
    index = load_index()
    for club in CLUBS:
        path = DATA / "players" / f"{club}.json"
        profiles = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        try:
            players, roster_url = roster(session, club)
        except Exception as exc:
            report["errors"].append({"club": club, "error": str(exc)})
            continue
        keys = {normalized_name(k): k for k in profiles if k != "_meta"}
        club_index = index.setdefault(club, {})
        changed = False
        print(f"{club}: {len(players)} official player profiles", flush=True)
        for entry in players:
            if args.name and normalized_name(args.name) not in normalized_name(entry["name"]):
                continue
            try:
                fresh = detail(session, club, entry)
                name = keys.get(normalized_name(fresh["name"]), fresh["name"])
                previous = profiles.get(name, {})
                # Keep league milestones and past annual records already in the app.
                merged = {**previous, **{k: v for k, v in fresh.items() if v not in (None, "")}}
                merged["app_player_name"] = name
                merged["links"] = {**previous.get("links", {}), **fresh["links"]}
                if merged != previous:
                    merged["fetched_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
                    profiles[name] = merged
                    changed = True
                photo = save_portrait(session, club, fresh["image_source_url"])
                key = normalized_name(name)
                club_index[key] = {"name": name, "official_name": fresh["name"], "profile_url": fresh["links"]["club_official"], **photo}
                report["synced"].append({"club": club, **club_index[key]})
                print(f"{club} {name}: {photo['width']}x{photo['height']} native-alpha={photo['native_alpha']}; profile saved", flush=True)
            except Exception as exc:
                report["errors"].append({"club": club, "name": entry["name"], "error": str(exc)})
                print(f"WARNING {club} {entry['name']}: {exc}", flush=True)
        if changed:
            profiles.setdefault("_meta", {}).update({"club_official_source": roster_url,
                "club_official_synced_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "club_official_players": len(players)})
            write_json(path, profiles)
    payload = "/* Generated from club official player detail pages. */\nwindow.TrappOfficialPlayers = " + json.dumps(index, ensure_ascii=False, sort_keys=True, indent=2) + ";\n"
    if not INDEX.exists() or INDEX.read_text(encoding="utf-8") != payload:
        INDEX.write_text(payload, encoding="utf-8")
    referenced = {APP / p["photo"].removeprefix("./") for players in index.values() for p in players.values()}
    for path in ASSETS.glob("*/*.webp"):
        if path not in referenced:
            path.unlink()
    write_json(REPORT, report)
    print(f"Synced {len(report['synced'])} portraits/profiles; errors {len(report['errors'])}", flush=True)
    if report["errors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
