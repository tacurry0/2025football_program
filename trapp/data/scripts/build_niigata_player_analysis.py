import json
import re
from pathlib import Path
from collections import defaultdict


# =========================
# 設定
# =========================

INPUT_DIR = Path(r"C:\Users\takahashi\Desktop\2025football_program\trapp\data\history\niigata")

OUTPUT_DIR = Path(r"C:\Users\takahashi\Desktop\2025football_program\trapp\data\generated\niigata")

TARGET_TEAM_NAME = "アルビレックス新潟"

START_YEAR = 1999
END_YEAR = 2026


# =========================
# 共通処理
# =========================

def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def to_int(value, default=0):
    try:
        if value is None or value == "":
            return default
        return int(str(value).replace(",", ""))
    except ValueError:
        return default


def normalize_name(name: str) -> str:
    if not name:
        return ""
    return re.sub(r"\s+", " ", str(name).strip())


def make_player_key(name: str) -> str:
    """
    まずは名前ベースでキー化。
    将来的に player_id を作るならここを差し替える。
    """
    return normalize_name(name)


def parse_minute(time_text: str):
    """
    "77'"      -> 77
    "45'+2"   -> 47
    "90'+3"   -> 93
    "105'+1"  -> 106
    ""        -> None
    """
    if not time_text:
        return None

    s = str(time_text).replace("’", "'").strip()

    m = re.match(r"^(\d+)'(?:\+(\d+))?$", s)
    if not m:
        return None

    base = int(m.group(1))
    add = int(m.group(2)) if m.group(2) else 0
    return base + add


def get_target_side(match):
    home = match.get("home_team", "")
    away = match.get("away_team", "")

    if TARGET_TEAM_NAME in home:
        return "home"
    if TARGET_TEAM_NAME in away:
        return "away"

    return None


def get_result_for_target(match, side):
    home_score = to_int(match.get("home_score"))
    away_score = to_int(match.get("away_score"))

    if side == "home":
        target_score = home_score
        opponent_score = away_score
    else:
        target_score = away_score
        opponent_score = home_score

    if target_score > opponent_score:
        result = "win"
        points = 3
    elif target_score < opponent_score:
        result = "loss"
        points = 0
    else:
        result = "draw"
        points = 1

    return {
        "target_score": target_score,
        "opponent_score": opponent_score,
        "result": result,
        "points": points,
    }


def result_counter():
    return {
        "matches": 0,
        "wins": 0,
        "draws": 0,
        "losses": 0,
        "points": 0,
        "win_rate": None,
        "points_per_match": None,
    }


def add_result(counter, result):
    counter["matches"] += 1

    if result == "win":
        counter["wins"] += 1
        counter["points"] += 3
    elif result == "draw":
        counter["draws"] += 1
        counter["points"] += 1
    elif result == "loss":
        counter["losses"] += 1

    if counter["matches"] > 0:
        counter["win_rate"] = round(counter["wins"] / counter["matches"] * 100, 1)
        counter["points_per_match"] = round(counter["points"] / counter["matches"], 2)


def get_team_details(match, side):
    if side == "home":
        return match.get("home_details", {}) or {}
    return match.get("away_details", {}) or {}


def get_team_goals(match, side):
    if side == "home":
        return match.get("home_goals", []) or []
    return match.get("away_goals", []) or []


def build_substitution_map(details):
    """
    Jリーグデータの substitutions はだいたい
    ▽ OUT選手 timeあり
    ▲ IN選手 time空
    の順で並ぶ。

    これを
    out_map[name] = minute_out
    in_map[name] = minute_in
    に変換する。
    """
    substitutions = details.get("substitutions", []) or []

    out_map = {}
    in_map = {}

    pending_out = None

    for sub in substitutions:
        mark = sub.get("in_out", "")
        name = make_player_key(sub.get("name", ""))
        minute = parse_minute(sub.get("time", ""))

        if not name:
            continue

        if mark == "▽":
            pending_out = {
                "name": name,
                "minute": minute,
            }
            out_map[name] = minute

        elif mark == "▲":
            if pending_out:
                in_map[name] = pending_out["minute"]
                pending_out = None
            else:
                in_map[name] = minute

    return out_map, in_map


def get_player_base(player):
    return {
        "player_name": normalize_name(player.get("name", "")),
        "number": str(player.get("number", "")),
        "position": player.get("position", ""),
    }


# =========================
# 年別処理
# =========================

def process_year(year: int, source_path: Path):
    raw_matches = load_json(source_path)

    if not isinstance(raw_matches, list):
        raise ValueError(f"{source_path} は配列JSONではありません")

    matches_out = []
    players_out = {}
    appearances_out = []
    goals_out = []
    cards_out = []

    analysis = defaultdict(lambda: {
        "player_key": "",
        "player_name": "",
        "numbers": set(),
        "positions": set(),

        "played": result_counter(),
        "starter": result_counter(),
        "sub": result_counter(),
        "bench_only": result_counter(),
        "not_played_but_benched": result_counter(),

        "goals": 0,
        "scored_matches_set": set(),
        "scored": result_counter(),

        "yellow_cards": 0,
        "red_cards": 0,
        "carded_matches_set": set(),
        "carded": result_counter(),
    })

    for match in raw_matches:
        side = get_target_side(match)
        if side is None:
            continue

        match_id = str(match.get("match_card_id", "")).strip()
        if not match_id:
            continue

        result_info = get_result_for_target(match, side)
        target_result = result_info["result"]

        opponent = match.get("away_team") if side == "home" else match.get("home_team")

        normalized_match = {
            "match_id": match_id,
            "url": match.get("url", ""),
            "season": str(match.get("season", year)),
            "competition": match.get("competition", ""),
            "section": match.get("section", ""),
            "date": match.get("date", ""),
            "kickoff": match.get("kickoff", ""),
            "stadium": match.get("stadium", ""),
            "attendance": to_int(match.get("attendance")),
            "weather": match.get("weather", ""),
            "home_team": match.get("home_team", ""),
            "away_team": match.get("away_team", ""),
            "home_score": to_int(match.get("home_score")),
            "away_score": to_int(match.get("away_score")),
            "target_team": TARGET_TEAM_NAME,
            "target_side": side,
            "opponent": opponent,
            "target_score": result_info["target_score"],
            "opponent_score": result_info["opponent_score"],
            "result": target_result,
            "points": result_info["points"],
        }
        matches_out.append(normalized_match)

        details = get_team_details(match, side)
        starting = details.get("starting", []) or []
        substitutes = details.get("substitutes", []) or []
        cards = details.get("cards", []) or []

        out_map, in_map = build_substitution_map(details)

        starter_keys = set()
        substitute_keys = set()
        played_keys = set()

        # -------------------------
        # スタメン
        # -------------------------
        for p in starting:
            base = get_player_base(p)
            player_name = base["player_name"]
            player_key = make_player_key(player_name)

            if not player_key:
                continue

            starter_keys.add(player_key)
            played_keys.add(player_key)

            minute_out = out_map.get(player_key)
            minute_in = 0

            players_out[player_key] = {
                "player_key": player_key,
                "player_name": player_name,
            }

            analysis[player_key]["player_key"] = player_key
            analysis[player_key]["player_name"] = player_name
            analysis[player_key]["numbers"].add(base["number"])
            analysis[player_key]["positions"].add(base["position"])
            add_result(analysis[player_key]["played"], target_result)
            add_result(analysis[player_key]["starter"], target_result)

            appearances_out.append({
                "match_id": match_id,
                "season": year,
                "player_key": player_key,
                "player_name": player_name,
                "number": base["number"],
                "position": base["position"],
                "appearance_type": "starter",
                "starter": True,
                "sub_in": False,
                "bench": False,
                "played": True,
                "minute_in": minute_in,
                "minute_out": minute_out,
            })

        # -------------------------
        # ベンチ・途中出場
        # -------------------------
        for p in substitutes:
            base = get_player_base(p)
            player_name = base["player_name"]
            player_key = make_player_key(player_name)

            if not player_key:
                continue

            substitute_keys.add(player_key)

            players_out[player_key] = {
                "player_key": player_key,
                "player_name": player_name,
            }

            analysis[player_key]["player_key"] = player_key
            analysis[player_key]["player_name"] = player_name
            analysis[player_key]["numbers"].add(base["number"])
            analysis[player_key]["positions"].add(base["position"])

            if player_key in in_map:
                played_keys.add(player_key)
                minute_in = in_map.get(player_key)

                add_result(analysis[player_key]["played"], target_result)
                add_result(analysis[player_key]["sub"], target_result)

                appearances_out.append({
                    "match_id": match_id,
                    "season": year,
                    "player_key": player_key,
                    "player_name": player_name,
                    "number": base["number"],
                    "position": base["position"],
                    "appearance_type": "sub",
                    "starter": False,
                    "sub_in": True,
                    "bench": True,
                    "played": True,
                    "minute_in": minute_in,
                    "minute_out": None,
                })
            else:
                add_result(analysis[player_key]["bench_only"], target_result)
                add_result(analysis[player_key]["not_played_but_benched"], target_result)

                appearances_out.append({
                    "match_id": match_id,
                    "season": year,
                    "player_key": player_key,
                    "player_name": player_name,
                    "number": base["number"],
                    "position": base["position"],
                    "appearance_type": "bench_only",
                    "starter": False,
                    "sub_in": False,
                    "bench": True,
                    "played": False,
                    "minute_in": None,
                    "minute_out": None,
                })

        # -------------------------
        # ゴール
        # -------------------------
        scored_in_this_match = set()

        for goal in get_team_goals(match, side):
            scorer_name = normalize_name(goal.get("name", ""))
            scorer_key = make_player_key(scorer_name)

            # オウンゴールは選手個人の得点から除外
            if not scorer_key or "オウンゴール" in scorer_key:
                goals_out.append({
                    "match_id": match_id,
                    "season": year,
                    "player_key": None,
                    "player_name": scorer_name,
                    "time": goal.get("time", ""),
                    "minute": parse_minute(goal.get("time", "")),
                    "is_own_goal": True,
                })
                continue

            goals_out.append({
                "match_id": match_id,
                "season": year,
                "player_key": scorer_key,
                "player_name": scorer_name,
                "time": goal.get("time", ""),
                "minute": parse_minute(goal.get("time", "")),
                "is_own_goal": False,
            })

            analysis[scorer_key]["player_key"] = scorer_key
            analysis[scorer_key]["player_name"] = scorer_name
            analysis[scorer_key]["goals"] += 1
            analysis[scorer_key]["scored_matches_set"].add(match_id)

            if scorer_key not in scored_in_this_match:
                add_result(analysis[scorer_key]["scored"], target_result)
                scored_in_this_match.add(scorer_key)

        # -------------------------
        # カード
        # -------------------------
        carded_in_this_match = set()

        for card in cards:
            card_name = normalize_name(card.get("name", ""))
            card_key = make_player_key(card_name)
            card_type = card.get("type", "")

            if not card_key:
                continue

            cards_out.append({
                "match_id": match_id,
                "season": year,
                "player_key": card_key,
                "player_name": card_name,
                "type": card_type,
                "time": card.get("time", ""),
                "minute": parse_minute(card.get("time", "")),
            })

            analysis[card_key]["player_key"] = card_key
            analysis[card_key]["player_name"] = card_name

            if "警告" in card_type:
                analysis[card_key]["yellow_cards"] += 1
            elif "退場" in card_type:
                analysis[card_key]["red_cards"] += 1

            analysis[card_key]["carded_matches_set"].add(match_id)

            if card_key not in carded_in_this_match:
                add_result(analysis[card_key]["carded"], target_result)
                carded_in_this_match.add(card_key)

    # =========================
    # analysis をJSON化
    # =========================

    analysis_out = []

    for player_key, a in analysis.items():
        scored_matches = len(a["scored_matches_set"])
        carded_matches = len(a["carded_matches_set"])

        row = {
            "season": year,
            "team": TARGET_TEAM_NAME,
            "player_key": player_key,
            "player_name": a["player_name"],

            "numbers": sorted([x for x in a["numbers"] if x != ""]),
            "positions": sorted([x for x in a["positions"] if x != ""]),

            "played_matches": a["played"]["matches"],
            "played_wins": a["played"]["wins"],
            "played_draws": a["played"]["draws"],
            "played_losses": a["played"]["losses"],
            "played_win_rate": a["played"]["win_rate"],
            "played_points_per_match": a["played"]["points_per_match"],

            "starter_matches": a["starter"]["matches"],
            "starter_wins": a["starter"]["wins"],
            "starter_draws": a["starter"]["draws"],
            "starter_losses": a["starter"]["losses"],
            "starter_win_rate": a["starter"]["win_rate"],
            "starter_points_per_match": a["starter"]["points_per_match"],

            "sub_matches": a["sub"]["matches"],
            "sub_wins": a["sub"]["wins"],
            "sub_draws": a["sub"]["draws"],
            "sub_losses": a["sub"]["losses"],
            "sub_win_rate": a["sub"]["win_rate"],
            "sub_points_per_match": a["sub"]["points_per_match"],

            "bench_only_matches": a["bench_only"]["matches"],

            "goals": a["goals"],
            "scored_matches": scored_matches,
            "scored_wins": a["scored"]["wins"],
            "scored_draws": a["scored"]["draws"],
            "scored_losses": a["scored"]["losses"],
            "scored_win_rate": a["scored"]["win_rate"],
            "scored_points_per_match": a["scored"]["points_per_match"],

            "yellow_cards": a["yellow_cards"],
            "red_cards": a["red_cards"],
            "carded_matches": carded_matches,
            "carded_wins": a["carded"]["wins"],
            "carded_draws": a["carded"]["draws"],
            "carded_losses": a["carded"]["losses"],
            "carded_win_rate": a["carded"]["win_rate"],
        }

        analysis_out.append(row)

    analysis_out.sort(
        key=lambda x: (
            -x["played_matches"],
            -x["goals"],
            x["player_name"]
        )
    )

    players_list = sorted(
        players_out.values(),
        key=lambda x: x["player_name"]
    )

    return {
        "matches": matches_out,
        "players": players_list,
        "appearances": appearances_out,
        "goals": goals_out,
        "cards": cards_out,
        "analysis": analysis_out,
    }


# =========================
# メイン処理
# =========================

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    all_years_analysis = []

    for year in range(START_YEAR, END_YEAR + 1):
        source_path = INPUT_DIR / f"{year}.json"

        if not source_path.exists():
            print(f"[SKIP] {year}.json がありません")
            continue

        print(f"[READ] {source_path}")

        try:
            result = process_year(year, source_path)
        except Exception as e:
            print(f"[ERROR] {year}.json の処理に失敗: {e}")
            continue

        year_dir = OUTPUT_DIR / str(year)

        save_json(year_dir / "matches.json", result["matches"])
        save_json(year_dir / "players.json", result["players"])
        save_json(year_dir / "appearances.json", result["appearances"])
        save_json(year_dir / "goals.json", result["goals"])
        save_json(year_dir / "cards.json", result["cards"])
        save_json(year_dir / "player_analysis.json", result["analysis"])

        all_years_analysis.extend(result["analysis"])

        print(
            f"[OK] {year}: "
            f"matches={len(result['matches'])}, "
            f"players={len(result['players'])}, "
            f"appearances={len(result['appearances'])}, "
            f"goals={len(result['goals'])}, "
            f"analysis={len(result['analysis'])}"
        )

    save_json(OUTPUT_DIR / "all_years_player_analysis.json", all_years_analysis)

    print("")
    print("[DONE] 出力完了")
    print(f"出力先: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()