#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Roasso Kumamoto Player Image Scraper (Detail Page Version)
- ロアッソ熊本公式サイトの選手一覧から、各個人の詳細ページへアクセス
- <h1>タグから確実な選手名を取得し、_big.jpg の高画質画像をダウンロード
"""

import os
import re
import time
import unicodedata
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

TARGET_URL = "https://roasso-k.com/clubteam/players"
BASE_URL = "https://roasso-k.com"
SAVE_DIR = "player_images_kumamoto"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
}

def clean(text):
    if text is None:
        return ""
    text = str(text).replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()

def normalize_name(name):
    if not name:
        return ""
    name = re.sub(r"(選手|監督|コーチ|スタッフ|ＧＫ|ＤＦ|ＭＦ|ＦＷ|GK|DF|MF|FW)$", "", name)
    return unicodedata.normalize("NFKC", clean(name))

def main():
    os.makedirs(SAVE_DIR, exist_ok=True)

    print(f"選手一覧ページを取得中: {TARGET_URL}")
    r = requests.get(TARGET_URL, headers=HEADERS)
    r.raise_for_status()
    soup = BeautifulSoup(r.content, "html.parser")

    # 1. 選手一覧ページから、各選手の詳細ページURL（/clubteam/players/数字）をすべて集める
    player_links = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if re.search(r'/clubteam/players/\d+$', href):
            full_url = urljoin(BASE_URL, href)
            player_links.add(full_url)

    print(f"選手詳細ページを {len(player_links)} 件見つけました。順に取得します...\n")

    saved_count = 0
    skipped_count = 0

    # 2. 各詳細ページを1件ずつ巡回して画像と名前を取得する
    for link in player_links:
        try:
            # サーバーに負荷をかけないよう、ページ遷移ごとに1秒待機
            time.sleep(1) 
            
            r_detail = requests.get(link, headers=HEADERS, timeout=10)
            r_detail.raise_for_status()
            soup_detail = BeautifulSoup(r_detail.content, "html.parser")

            # 3. 画像の通り、<h1>タグから選手名を取得する
            h1_tag = soup_detail.find("h1")
            if not h1_tag:
                print(f"[スキップ] 名前(h1)が見つかりません: {link}")
                continue

            raw_name = h1_tag.get_text(strip=True)
            player_key = normalize_name(raw_name)

            if len(player_key) < 2:
                print(f"[スキップ] 名前が短すぎます({raw_name}): {link}")
                continue

            # 4. 選手画像を取得（まずは "_big.jpg" を優先して探し、なければ普通の画像を探す）
            img_tag = soup_detail.find("img", src=re.compile(r'/players/.*_big\.(jpg|png|jpeg)$', re.IGNORECASE))
            if not img_tag:
                img_tag = soup_detail.find("img", src=re.compile(r'/players/.*\.(jpg|png|jpeg)$', re.IGNORECASE))

            if not img_tag:
                print(f"[スキップ] 選手画像が見つかりません: {link}")
                continue

            img_src = img_tag.get("src")
            img_url = urljoin(BASE_URL, img_src)

            # 拡張子を取得してファイル名を作成
            base_url = img_url.split('?')[0]
            ext = os.path.splitext(base_url)[1]
            if not ext:
                ext = ".jpg"

            filename = f"{player_key}{ext}"
            filepath = os.path.join(SAVE_DIR, filename)

            # 既に保存されている場合はスキップ
            if os.path.exists(filepath):
                print(f"保存済み: {filename}")
                skipped_count += 1
                continue

            # 5. 画像をダウンロードして保存
            print(f"保存中: {filename} ({img_url})")
            img_data = requests.get(img_url, headers=HEADERS, timeout=10).content
            with open(filepath, "wb") as f:
                f.write(img_data)
            saved_count += 1

        except Exception as e:
            print(f"エラー発生 ({link}): {e}")

    print("\n--- 処理完了 ---")
    print(f"新しく保存した画像: {saved_count} 枚")
    print(f"スキップした画像: {skipped_count} 枚")
    print(f"保存先フォルダ: ./{SAVE_DIR}/")

if __name__ == "__main__":
    main()