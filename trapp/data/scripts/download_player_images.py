#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Albirex Niigata 30th Directory Image Scraper
- アルビレックス新潟30周年特設サイトから選手画像をダウンロード
- データ成型スクリプト(build_niigata_player_analysis.py)と名前(player_key)を一致させて保存
"""

import os
import re
import time
import unicodedata
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

TARGET_URL = "https://www.albirex.co.jp/30th/directory/"
SAVE_DIR = "player_images"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
}

# ==========================================
# 既存の成型スクリプトと全く同じ正規化関数を使う
# これにより JSONの player_key == 画像ファイル名 になります
# ==========================================
def clean(text):
    if text is None:
        return ""
    text = str(text).replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()

def normalize_name(name):
    if not name:
        return ""
    return unicodedata.normalize("NFKC", clean(name))

def main():
    # 画像保存用のフォルダを作成
    os.makedirs(SAVE_DIR, exist_ok=True)

    print(f"ページを取得中: {TARGET_URL}")
    r = requests.get(TARGET_URL, headers=HEADERS)
    r.raise_for_status()
    # 文字化け対策（念のため生のバイトデータを渡す）
    soup = BeautifulSoup(r.content, "html.parser")

    # ページ内のすべての画像タグを取得
    images = soup.find_all("img")
    
    saved_count = 0
    skipped_count = 0

    print("画像のダウンロードを開始します...")
    
    for img in images:
        src = img.get("src")
        alt = img.get("alt", "")

        if not src or not alt:
            continue
            
        # 画像のalt属性（代替テキスト）に選手名が入っていると仮定し、それをキー化する
        player_key = normalize_name(alt)
        
        # 名前が短すぎる（1文字など）、またはURLに明らかにロゴやアイコンを示す文字がある場合はスキップ
        if len(player_key) < 2 or "logo" in src.lower() or "icon" in src.lower():
            continue
            
        # 相対パス（/assets/img/...）を絶対URL（https://...）に変換
        img_url = urljoin(TARGET_URL, src)
        
        # 拡張子の取得 (.jpg, .png など)
        base_url = img_url.split('?')[0] # ?v=123 のようなパラメータを除去
        ext = os.path.splitext(base_url)[1]
        if not ext:
            ext = ".jpg" # 拡張子がない場合のデフォルト

        # 保存するファイル名（例: "田中 達也.jpg"）
        filename = f"{player_key}{ext}"
        filepath = os.path.join(SAVE_DIR, filename)

        # すでにダウンロード済みの画像はスキップ（中断して再開した時用）
        if os.path.exists(filepath):
            skipped_count += 1
            continue

        print(f"保存中: {filename} ({img_url})")
        try:
            img_data = requests.get(img_url, headers=HEADERS, timeout=10).content
            with open(filepath, "wb") as f:
                f.write(img_data)
            saved_count += 1
            time.sleep(1) # サーバーに負荷をかけないように1秒待機
            
        except Exception as e:
            print(f"エラー発生 ({filename}): {e}")

    print("\n--- 処理完了 ---")
    print(f"新しく保存した画像: {saved_count} 枚")
    print(f"スキップした画像（保存済み）: {skipped_count} 枚")
    print(f"保存先フォルダ: ./{SAVE_DIR}/")

if __name__ == "__main__":
    main()