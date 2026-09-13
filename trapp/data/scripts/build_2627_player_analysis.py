"""Build 2026/27 analysis from checked-in official GAS detail snapshots.

Usage: python trapp/data/scripts/build_2627_player_analysis.py --through 2026-09-12
The numeric analysis key is the ending year (2027); files use 2026_2027.
Only finished games with both starting elevens are accepted. Missing known
results fail the build, so an incomplete refresh cannot silently replace it.
"""
import argparse
import importlib.util
import json
import re
from pathlib import Path

DATA = Path(__file__).resolve().parents[1]
SEASON = "2026_2027"
ANALYSIS_YEAR = 2027
CLUBS = {"niigata": "アルビレックス新潟", "kumamoto": "ロアッソ熊本"}


def minute(value):
    parts = re.findall(r"\d+", str(value or ""))
    return sum(map(int, parts)) if parts else None


def time_text(value):
    # Preserve stoppage-time notation so the UI distinguishes it from extra time.
    text = str(value or "").replace("’", "'").replace("'", "")
    if not text:
        return ""
    base, *extra = text.split("+")
    return base + "'" + ("+" + extra[0] if extra else "")


def substitutions(details):
    # Each new-source event has its own time; never pair unrelated IN/OUT rows.
    out_map, in_map = {}, {}
    for row in details.get("substitutions", []):
        target = out_map if row["in_out"] == "▽" else in_map
        target[row["name"]] = minute(row["time"])
    return out_map, in_map


def history_record(row):
    record = {
        "match_card_id": row["match_id"], "url": row["source_url"],
        "season": str(ANALYSIS_YEAR), "season_id": SEASON,
        "competition": row["competition"], "competition_id": row["competition_id"],
        "section": (f"第{row['section']}節" if row.get("section") else row.get("round", "")),
        "date": row["date"], "kickoff": row["time"], "stadium": row["venue"],
        "attendance": row.get("attendance"), "weather": row.get("weather", ""),
        "temperature": row.get("temperature"), "humidity": row.get("humidity"),
        "home_team": row["home"], "away_team": row["away"],
        "home_score": row["home_score"], "away_score": row["away_score"],
        "referee": row.get("referee", ""), "assistant_referees": row.get("assistant_referees", []),
        "fourth_official": row.get("fourth_official", ""),
        "detail_complete": True, "source_fetched_at": row.get("detail_fetched_at"),
    }
    pk = re.search(r"(\d+)\s*PK\s*(\d+)", row.get("pk", ""))
    record.update(pk_home_score=pk[1] if pk else "", pk_away_score=pk[2] if pk else "")
    for side in ("home", "away"):
        changes = []
        for change in row.get(side + "_substitutions", []):
            for key, mark in (("out", "▽"), ("in", "▲")):
                if change.get(key):
                    changes.append({"name": change[key], "in_out": mark, "time": time_text(change["minute"])})
        record[side + "_details"] = {
            "starting": row[side + "_starting_members"],
            "substitutes": row[side + "_bench_members"],
            "manager": row.get(side + "_manager", ""),
            "substitutions": changes,
            "cards": [{"name": c["player"], "time": time_text(c["minute"]),
                       "type": "警告" if c["card"] == "yellow" else "退場"}
                      for c in row.get(side + "_cards", [])],
        }
        record[side + "_goals"] = [
            {"name": "オウンゴール" if g.get("own_goal") else g["scorer"], "time": time_text(g["minute"])}
            for g in row.get(side + "_goals", [])
        ]
    return record


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build(through):
    details = {}
    for path in (DATA / "details" / SEASON).glob("*/*.json"):
        for row in json.loads(path.read_text(encoding="utf-8")).get("data", []):
            if row.get("status") == "finished" and row["date"] <= through:
                assert row.get("detail_complete"), f"Incomplete record: {path}"
                assert all(len(row.get(side + "_starting_members", [])) == 11 for side in ("home", "away")), path
                details[row["match_id"]] = row
    for path in (DATA / "results" / SEASON).glob("*.json"):
        for row in json.loads(path.read_text(encoding="utf-8")).get("data", []):
            if row.get("status") == "finished" and row["date"] <= through and any(
                name in (row["home"], row["away"]) for name in CLUBS.values()
            ):
                assert row["match_id"] in details, f"Missing official details: {row['match_id']}"

    for club, name in CLUBS.items():
        selected = sorted((r for r in details.values() if name in (r["home"], r["away"])), key=lambda r: (r["date"], r["match_id"]))
        assert selected, f"No matches for {club}"
        records = [history_record(r) for r in selected]
        source = DATA / "history" / club / (SEASON + ".json")
        write(source, records)
        spec = importlib.util.spec_from_file_location("builder", Path(__file__).with_name(f"build_{club}_player_analysis.py"))
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)
        builder.parse_minute = minute
        builder.build_substitution_map = substitutions
        result = builder.process_year(ANALYSIS_YEAR, source)
        # Players substituted on can also be substituted off; preserve both times.
        by_id = {r["match_card_id"]: r for r in records}
        for appearance in result["appearances"]:
            record = by_id[appearance["match_id"]]
            side = "home" if record["home_team"] == name else "away"
            outs, _ = substitutions(record[side + "_details"])
            appearance["minute_out"] = outs.get(appearance["player_key"])
        for match in result["matches"]:
            record = by_id[match["match_id"]]
            match.update(season_id=SEASON, competition_id=record["competition_id"],
                         pk_home_score=record["pk_home_score"], pk_away_score=record["pk_away_score"])
        out = DATA / "generated" / club
        for key, value in result.items():
            filename = "player_analysis" if key == "analysis" else key
            write(out / SEASON / (filename + ".json"), value)
        aggregate_path = out / "all_years_player_analysis.json"
        aggregate = json.loads(aggregate_path.read_text(encoding="utf-8")) if aggregate_path.exists() else []
        aggregate = [r for r in aggregate if str(r.get("season")) != str(ANALYSIS_YEAR)] + result["analysis"]
        write(aggregate_path, aggregate)
        write(out / SEASON / "metadata.json", {
            "season": SEASON, "label": "2026/27", "analysis_year": ANALYSIS_YEAR,
            "through": through, "last_match_date": selected[-1]["date"],
            "matches": len(selected), "players": len(result["players"]),
            "scope": "J2/J3・ルヴァンカップ・天皇杯の終了済み公式記録（練習試合・県予選を除く）",
            "sources": [r["source_url"] for r in selected],
        })
        print(f"{club}: {len(selected)} matches / {len(result['players'])} players / through {through}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--through", required=True, help="Last included date, YYYY-MM-DD")
    args = parser.parse_args()
    import datetime
    datetime.date.fromisoformat(args.through)
    build(args.through)
