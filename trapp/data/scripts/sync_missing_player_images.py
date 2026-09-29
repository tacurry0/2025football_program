#!/usr/bin/env python3
"""Download missing player portraits from the official J.League directory.

The app resolves portraits by exact player name from data/assets/images/player_*
and the cutout workflow handles transparency and deployment afterwards.
Only names already present in checked-in analysis data are eligible. The current
official J.League site exposes player names and IDs in each club's roster table;
the profile photo itself has the generic alt text "Player", so matching against
image alt text silently skipped every portrait. Match the exact roster link name
and use its official player ID to resolve the high-resolution profile image.
"""
from __future__ import annotations

import json
import re
import time
import unicodedata
from collections import defaultdict
from pathlib import Path
from urllib.parse import urljoin, urlparse
from io import BytesIO

import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageOps


DATA = Path(__file__).resolve().parents[1]
APP = DATA.parent
CLUBS = {
    "niigata": {"name": "アルビレックス新潟", "slug": "niigata", "league": "j2"},
    "kumamoto": {"name": "ロアッソ熊本", "slug": "kumamoto", "league": "j3"},
}
ROSTER_URL = "https://www.jleague.jp/club/{slug}/"
REPORT_PATH = DATA / "assets/images/player_image_sync_report.json"
USER_AGENT = "trapp-player-image-sync/1.0 (personal app; contact: repository owner)"
MIN_IMAGE_EDGE = 96
PAGE_DELAY_SECONDS = 0.4
IMAGE_DELAY_SECONDS = 0.5


def normalized_name(value: object) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    text = text.replace("\u00a0", " ").replace("\u3000", " ")
    text = re.sub(r"\s+", " ", text).strip()
    # The app accepts spaces and Japanese middle dots as equivalent filename
    # variants. Keep every other character so similar names cannot collide.
    return re.sub(r"[\s・･]", "", text)


def canonical_storage_name(name: str, year: int) -> str:
    """Match the historical-name canonicalization used by the player UI."""
    compact = normalized_name(name)
    if compact in {"曺永哲", "チョヨンチョル"}:
        return "曺 永哲"
    if compact in {"マイケルジェームズ", "舞行龍ジェームズ"}:
        return "舞行龍ジェームズ"
    if compact in {"宋株熏", "ソンジュフン"}:
        return "宋 株熏"
    if compact == "アンデルソン":
        return "アンデルソン-2011" if year >= 2011 else "アンデルソン"
    if compact == "シルビーニョ":
        return "シルビーニョ-2019-2020" if year >= 2019 else "シルビーニョ"
    return unicodedata.normalize("NFKC", name).strip()


def source_image_keys(directory: Path) -> set[str]:
    if not directory.exists():
        return set()
    return {
        normalized_name(path.stem)
        for path in directory.iterdir()
        if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    }


def season_to_directory_year(value: object) -> int | None:
    """Analysis data stores the 2026/27 season under 2027; J.League uses 2026."""
    match = re.search(r"\d{4}", str(value or ""))
    if not match:
        return None
    year = int(match.group(0))
    return 2026 if year == 2027 else year


def missing_players(club: str) -> dict[int, dict[str, str]]:
    source = DATA / "generated" / club / "all_years_player_analysis.json"
    if not source.exists():
        raise FileNotFoundError(f"Player analysis file not found: {source}")
    records = json.loads(source.read_text(encoding="utf-8"))
    image_dirs = [
        APP / f"data/assets/images/player_{club}",
        APP / f"data/assets/player_{club}",
    ]
    present = set().union(*(source_image_keys(directory) for directory in image_dirs))
    requested: dict[int, dict[str, str]] = defaultdict(dict)
    for row in records:
        name = str(row.get("player_name") or row.get("player_key") or "").strip()
        year = season_to_directory_year(row.get("season"))
        if not name or year is None:
            continue
        storage_name = canonical_storage_name(name, year)
        if normalized_name(storage_name) not in present:
            # Keep the source spelling for exact matching to that season's roster.
            requested[year][storage_name] = name
    return requested


def official_roster_images(
    html: bytes, requested: dict[str, str], page_url: str, club_slug: str, year: int
) -> dict[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    wanted = {normalized_name(source_name): storage_name for storage_name, source_name in requested.items()}
    players: dict[str, str] = {}

    # Keep compatibility with server-rendered roster links when present.
    for anchor in soup.find_all("a", href=True):
        name = normalized_name(anchor.get_text(" ", strip=True))
        match = re.search(r"/player/(\d+)/", str(anchor["href"]))
        if name in wanted and match:
            players[name] = match.group(1)

    # The current J.League roster is hydrated from a Next.js Flight payload,
    # where player links are represented as escaped JSON rather than HTML anchors.
    player_record = re.compile(
        r'\\"playerId\\"\s*:\s*\\"(?P<id>\d+)\\".*?'
        r'\\"playerName\\"\s*:\s*\\"(?P<name>(?:\\\\.|[^"\\])*)\\"',
        re.DOTALL,
    )
    raw_html = html.decode("utf-8", errors="replace")
    for match in player_record.finditer(raw_html):
        try:
            source_name = json.loads('"' + match.group("name") + '"')
        except json.JSONDecodeError:
            source_name = match.group("name").replace('\\"', '"')
        name = normalized_name(source_name)
        if name in wanted:
            players[name] = match.group("id")

    found: dict[str, str] = {}
    for name, player_id in players.items():
        # Player profile pages use this official, high-resolution image path.
        # The roster thumbnail is only 96x96 and is not suitable for the detail card.
        image_url = urljoin(
            page_url,
            f"/img/cache/{year}/{club_slug}/player/main/{player_id}_l.webp",
        )
        if urlparse(image_url).hostname == "www.jleague.jp":
            found[wanted[name]] = image_url
    return found


def save_jpeg(session: requests.Session, image_url: str, destination: Path) -> None:
    with session.get(image_url, timeout=(12, 30)) as response:
        response.raise_for_status()
        content_type = response.headers.get("Content-Type", "").lower()
        if content_type and not content_type.startswith("image/"):
            raise ValueError(f"Not an image response ({content_type})")
        try:
            image = Image.open(BytesIO(response.content))
            image = ImageOps.exif_transpose(image).convert("RGB")
            image.load()
        except Exception as exc:
            raise ValueError(f"Image could not be decoded: {exc}") from exc
    if min(image.size) < MIN_IMAGE_EDGE:
        raise ValueError(f"Image is too small: {image.width}x{image.height}")
    image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(".jpg.tmp")
    image.save(temporary, format="JPEG", quality=92, optimize=True)
    temporary.replace(destination)


def fetch_roster(
    session: requests.Session, club_config: dict[str, str], year: int
) -> tuple[bytes, str]:
    response = session.get(
        ROSTER_URL.format(slug=club_config["slug"]),
        params={"navicode": club_config["league"]},
        timeout=(12, 35),
    )
    response.raise_for_status()
    if club_config["name"] not in response.text or not re.search(r"/player/\d+/", response.text):
        raise ValueError(f"Unexpected official roster response for {club_config['name']} {year}")
    return response.content, response.url


def write_report(payload: dict) -> None:
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    report = {
        "source": "https://www.jleague.jp/club/{club}/ (official club roster)",
        "downloaded": [],
        "unavailable": [],
        "errors": [],
    }
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"})

    for club in CLUBS:
        by_year = missing_players(club)
        pending = set().union(*(set(names) for names in by_year.values())) if by_year else set()
        if not pending:
            print(f"{club}: no missing player portraits")
            continue

        output = APP / f"data/assets/images/player_{club}"
        # Prefer the newest spelling if the same stored player appears in
        # multiple seasons. The current club roster gives stable official IDs.
        latest_names: dict[str, str] = {}
        for year in sorted(by_year, reverse=True):
            for storage_name, source_name in by_year[year].items():
                latest_names.setdefault(storage_name, source_name)
        official_year = max((season_to_directory_year(year) or year for year in by_year), default=2026)
        try:
            html, page_url = fetch_roster(session, CLUBS[club], official_year)
            matches = official_roster_images(
                html, latest_names, page_url, CLUBS[club]["slug"], official_year
            )
        except Exception as exc:
            report["errors"].append({"club": club, "year": official_year, "error": str(exc)})
            matches = {}

        club_downloaded = 0
        for storage_name in sorted(latest_names):
            if storage_name not in pending:
                continue
            source_name = latest_names[storage_name]
            image_url = matches.get(storage_name)
            if not image_url:
                continue
            destination = output / f"{storage_name}.jpg"
            if destination.exists():
                pending.discard(storage_name)
                continue
            try:
                time.sleep(IMAGE_DELAY_SECONDS)
                save_jpeg(session, image_url, destination)
                report["downloaded"].append({
                    "club": club,
                    "name": storage_name,
                    "official_name": source_name,
                    "year": official_year,
                    "source_url": image_url,
                    "file": destination.relative_to(APP).as_posix(),
                })
                club_downloaded += 1
                pending.discard(storage_name)
                print(f"{club} {storage_name}: saved ({official_year})")
            except Exception as exc:
                report["errors"].append({
                    "club": club, "name": storage_name, "year": official_year, "error": str(exc)
                })
        time.sleep(PAGE_DELAY_SECONDS)

        for name in sorted(pending):
            report["unavailable"].append({"club": club, "name": name})
        print(f"{club}: downloaded {club_downloaded}; still missing {len(pending)}")

    # Keep the report deterministic so an unchanged nightly run does not create
    # a pointless commit and redeploy.
    report["downloaded"].sort(key=lambda row: (row["club"], row["name"]))
    report["unavailable"].sort(key=lambda row: (row["club"], row["name"]))
    report["errors"].sort(key=lambda row: (row.get("club", ""), row.get("name", ""), row.get("year", 0)))
    write_report(report)


if __name__ == "__main__":
    main()
