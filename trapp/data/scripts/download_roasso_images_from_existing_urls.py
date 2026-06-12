#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Roasso Kumamoto Player Image Downloader from existing image URL list

前提:
  roasso_existing_player_images.json
  [
    {
      "id": 3128,
      "url": "https://roasso-k.com/img/players/3128_big.jpg",
      ...
    }
  ]

やること:
  1. 画像URLからIDを取得
  2. https://roasso-k.com/clubteam/players/{id} を開く
  3. 詳細ページの h1 から選手名を取得
  4. 既存の _big.jpg 画像URLを保存
  5. URL・名前・保存ファイル名を JSON / CSV に出力

出力:
  player_images_kumamoto/
    青木 俊輔.jpg
    ...
  roasso_players_with_images.json
  roasso_players_with_images.csv
"""

import argparse
import csv
import json
import os
import re
import time
import unicodedata
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup


BASE_URL = "https://roasso-k.com"
DETAIL_URL_TEMPLATE = "https://roasso-k.com/clubteam/players/{id}"

DEFAULT_INPUT_JSON = "roasso_existing_player_images.json"
DEFAULT_SAVE_DIR = "player_images_kumamoto"
DEFAULT_OUTPUT_JSON = "roasso_players_with_images.json"
DEFAULT_OUTPUT_CSV = "roasso_players_with_images.csv"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
}


def clean(text: Any) -> str:
    if text is None:
        return ""
    text = str(text).replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def normalize_name(name: str) -> str:
    """ページから取った名前を保存・出力向けに軽く整える"""
    name = clean(name)
    name = re.sub(r"(選手|監督|コーチ|スタッフ|ＧＫ|ＤＦ|ＭＦ|ＦＷ|GK|DF|MF|FW)$", "", name)
    return unicodedata.normalize("NFKC", clean(name))


def safe_filename(text: str) -> str:
    """Windowsで使えない文字を置換"""
    text = normalize_name(text)
    text = re.sub(r'[\\/:*?"<>|]', "_", text)
    text = text.rstrip(". ")
    return text or "unknown"




def unique_filepath(filepath: Path) -> Path:
    """同名ファイルがある場合は 青木 俊輔(2).jpg のように重複回避"""
    if not filepath.exists():
        return filepath

    stem = filepath.stem
    suffix = filepath.suffix
    parent = filepath.parent

    n = 2
    while True:
        candidate = parent / f"{stem}({n}){suffix}"
        if not candidate.exists():
            return candidate
        n += 1

def extract_player_id(item: Dict[str, Any]) -> Optional[int]:
    """JSONの id または URL から選手IDを取得"""
    if item.get("id") is not None:
        try:
            return int(item["id"])
        except (TypeError, ValueError):
            pass

    url = str(item.get("url", ""))
    m = re.search(r"/players/(\d+)(?:_big)?\.(?:jpg|jpeg|png|webp)$", url, re.IGNORECASE)
    if m:
        return int(m.group(1))

    return None


def image_url_to_detail_url(image_url: str, player_id: Optional[int] = None) -> str:
    """
    画像URL:
      https://roasso-k.com/img/players/3128_big.jpg
    詳細ページ:
      https://roasso-k.com/clubteam/players/3128
    """
    if player_id is None:
        m = re.search(r"/players/(\d+)(?:_big)?\.", image_url, re.IGNORECASE)
        if not m:
            raise ValueError(f"画像URLからIDを取得できません: {image_url}")
        player_id = int(m.group(1))

    return DETAIL_URL_TEMPLATE.format(id=player_id)


def get_player_name_from_detail_page(session: requests.Session, detail_url: str) -> str:
    """詳細ページを開き、h1優先で選手名を取得"""
    r = session.get(detail_url, headers=HEADERS, timeout=20)
    r.raise_for_status()

    soup = BeautifulSoup(r.content, "html.parser")

    # ロアッソ公式の詳細ページは、本文中の h1 に選手名が入っている
    h1 = soup.find("h1")
    if h1:
        name = normalize_name(h1.get_text(" ", strip=True))
        if len(name) >= 2:
            return name

    # 念のため title からも拾う
    if soup.title and soup.title.string:
        title = clean(soup.title.string)
        # 例: 青木 俊輔｜ロアッソ熊本 公式サイト...
        name = normalize_name(re.split(r"[｜|]", title)[0])
        if len(name) >= 2:
            return name

    raise ValueError("詳細ページから選手名を取得できませんでした")


def download_image(session: requests.Session, image_url: str, filepath: Path) -> str:
    """画像を保存。すでにあればスキップ"""
    if filepath.exists() and filepath.stat().st_size > 0:
        return "already_exists"

    r = session.get(image_url, headers=HEADERS, timeout=30, stream=True)
    r.raise_for_status()

    content_type = r.headers.get("Content-Type", "")
    if "image" not in content_type.lower():
        raise ValueError(f"画像ではないレスポンスです: Content-Type={content_type}")

    tmp_path = filepath.with_suffix(filepath.suffix + ".tmp")
    with tmp_path.open("wb") as f:
        for chunk in r.iter_content(chunk_size=1024 * 64):
            if chunk:
                f.write(chunk)

    tmp_path.replace(filepath)
    return "saved"


def load_items(input_json: Path) -> List[Dict[str, Any]]:
    with input_json.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("入力JSONは配列形式にしてください")

    return data


def write_outputs(records: List[Dict[str, Any]], output_json: Path, output_csv: Path) -> None:
    with output_json.open("w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    fieldnames = [
        "id",
        "name",
        "detail_url",
        "image_url",
        "filename",
        "filepath",
        "status",
        "error",
    ]

    with output_csv.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for record in records:
            writer.writerow({key: record.get(key, "") for key in fieldnames})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=DEFAULT_INPUT_JSON, help="存在確認済み画像URLのJSON")
    parser.add_argument("--save-dir", default=DEFAULT_SAVE_DIR, help="画像保存フォルダ")
    parser.add_argument("--output-json", default=DEFAULT_OUTPUT_JSON, help="結果JSON")
    parser.add_argument("--output-csv", default=DEFAULT_OUTPUT_CSV, help="結果CSV")
    parser.add_argument("--sleep", type=float, default=1.0, help="1件ごとの待機秒数")
    args = parser.parse_args()

    input_json = Path(args.input)
    save_dir = Path(args.save_dir)
    output_json = Path(args.output_json)
    output_csv = Path(args.output_csv)

    save_dir.mkdir(parents=True, exist_ok=True)

    items = load_items(input_json)
    print(f"入力JSON: {input_json}")
    print(f"対象件数: {len(items)}")
    print(f"保存先: {save_dir}")
    print()

    records: List[Dict[str, Any]] = []

    with requests.Session() as session:
        for index, item in enumerate(items, start=1):
            player_id = extract_player_id(item)
            image_url = str(item.get("url", "")).strip()

            record: Dict[str, Any] = {
                "id": player_id if player_id is not None else "",
                "name": "",
                "detail_url": "",
                "image_url": image_url,
                "filename": "",
                "filepath": "",
                "status": "",
                "error": "",
            }

            try:
                if player_id is None:
                    raise ValueError("IDを取得できません")

                if not image_url:
                    raise ValueError("画像URLが空です")

                detail_url = image_url_to_detail_url(image_url, player_id)
                record["detail_url"] = detail_url

                print(f"[{index}/{len(items)}] 詳細ページ確認: {detail_url}")
                name = get_player_name_from_detail_page(session, detail_url)
                record["name"] = name

                ext = os.path.splitext(image_url.split("?", 1)[0])[1] or ".jpg"
                filepath = unique_filepath(save_dir / f"{safe_filename(name)}{ext}")
                filename = filepath.name

                record["filename"] = filename
                record["filepath"] = str(filepath)

                result = download_image(session, image_url, filepath)
                record["status"] = result

                if result == "already_exists":
                    print(f"  保存済み: {filename}")
                else:
                    print(f"  保存完了: {filename}")

            except Exception as e:
                record["status"] = "error"
                record["error"] = str(e)
                print(f"  エラー: {e}")

            records.append(record)

            if args.sleep > 0 and index < len(items):
                time.sleep(args.sleep)

    write_outputs(records, output_json, output_csv)

    saved = sum(1 for r in records if r.get("status") == "saved")
    already = sum(1 for r in records if r.get("status") == "already_exists")
    errors = sum(1 for r in records if r.get("status") == "error")

    print()
    print("--- 処理完了 ---")
    print(f"新規保存: {saved}")
    print(f"保存済み: {already}")
    print(f"エラー: {errors}")
    print(f"結果JSON: {output_json}")
    print(f"結果CSV: {output_csv}")
    print(f"画像フォルダ: {save_dir}")


if __name__ == "__main__":
    main()
