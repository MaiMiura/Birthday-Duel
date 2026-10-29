#!/usr/bin/env python3
"""Wikidata から、指定した誕生日と職業の有名人一覧を取ってくる。

例:
    python3 birthday_people.py 10-29 歌手
    python3 birthday_people.py 3/14 Q33999 --limit 10
    python3 birthday_people.py 12-25 actor --json
    python3 birthday_people.py 10-29 歌手 --sort sitelinks

並び順（--sort）:
    views     日本語版 Wikipedia の直近 30 日の閲覧数順（記事がある人だけ。既定）
    ja        日本語版 Wikipedia に記事がある人を先に、その中は記事のある言語数順
    sitelinks 記事のある言語数順（世界的な知名度）
標準ライブラリだけで動く。
"""

import argparse
import datetime
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ENDPOINT = "https://query.wikidata.org/sparql"
PAGEVIEWS = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/ja.wikipedia.org/all-access/user"
USER_AGENT = "BirthdayDuel/0.1 (https://github.com/MaiMiura/Birthday-Duel)"


def parse_birthday(text):
    """'10-29' / '10/29' / '1029' を (月, 日) にする。"""
    m = re.fullmatch(r"\s*(\d{1,2})\s*[-/.月]?\s*(\d{1,2})\s*日?\s*", text)
    if not m:
        raise ValueError(f"誕生日の形式がわかりません: {text!r}（例: 10-29）")
    month, day = int(m.group(1)), int(m.group(2))
    days_in_month = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    if not (1 <= month <= 12 and 1 <= day <= days_in_month[month - 1]):
        raise ValueError(f"存在しない日付です: {month}月{day}日")
    return month, day


def occupation_clause(occupation):
    """職業を Q-ID か名前（日本語・英語のラベル）で指定する部分を作る。"""
    if re.fullmatch(r"[Qq]\d+", occupation):
        return f"VALUES ?occ {{ wd:{occupation.upper()} }}"
    label = json.dumps(occupation, ensure_ascii=False)  # SPARQL の文字列リテラルとしてエスケープ
    return f"VALUES ?occName {{ {label}@ja {label}@en }}\n  ?occ rdfs:label ?occName ."


def build_query(month, day, occupation, limit, lang, sort="views"):
    ja_article = """?jaArticle schema:about ?person ;
             schema:isPartOf <https://ja.wikipedia.org/> ;
             schema:name ?jaTitle ."""
    if sort == "views":
        ja_clause = ja_article  # 閲覧数は日本語版の記事がないと取れないので必須にする
    else:
        ja_clause = f"OPTIONAL {{\n    {ja_article}\n  }}"
    order = "DESC(?sitelinks)" if sort == "sitelinks" else "DESC(BOUND(?jaTitle)) DESC(?sitelinks)"
    return f"""
SELECT ?person ?personLabel ?personDescription (MIN(?birth) AS ?dob) ?sitelinks ?jaTitle
       (GROUP_CONCAT(DISTINCT ?occLabel; separator=" / ") AS ?occupations)
WHERE {{
  {occupation_clause(occupation)}
  ?person wdt:P106 ?occ ;
          wdt:P31 wd:Q5 ;
          p:P569 ?dobStatement ;
          wikibase:sitelinks ?sitelinks .
  ?dobStatement psv:P569 ?dobNode ;
                wikibase:rank ?dobRank .
  FILTER(?dobRank != wikibase:DeprecatedRank)
  ?dobNode wikibase:timeValue ?birth ;
           wikibase:timePrecision 11 .
  FILTER(MONTH(?birth) = {month} && DAY(?birth) = {day})
  {ja_clause}
  SERVICE wikibase:label {{
    bd:serviceParam wikibase:language "{lang},en,mul" .
    ?person rdfs:label ?personLabel ; schema:description ?personDescription .
    ?occ rdfs:label ?occLabel .
  }}
}}
GROUP BY ?person ?personLabel ?personDescription ?sitelinks ?jaTitle
ORDER BY {order}
LIMIT {limit}
"""


def fetch_json(url, timeout=90):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.load(res)


def run_query(query):
    return fetch_json(ENDPOINT + "?" + urllib.parse.urlencode({"query": query, "format": "json"}))


def ja_pageviews(title, days=30, today=None):
    """日本語版 Wikipedia の記事の、昨日までの days 日間の閲覧数（人間のみ）。"""
    end = (today or datetime.date.today()) - datetime.timedelta(days=1)
    start = end - datetime.timedelta(days=days - 1)
    article = urllib.parse.quote(title.replace(" ", "_"), safe="")
    url = f"{PAGEVIEWS}/{article}/daily/{start:%Y%m%d}/{end:%Y%m%d}"
    try:
        data = fetch_json(url, timeout=30)
    except urllib.error.HTTPError as e:
        if e.code == 404:  # 期間中に閲覧記録がない
            return 0
        raise
    return sum(item["views"] for item in data.get("items", []))


def add_pageviews(people):
    titles = [p["ja_title"] for p in people]
    with ThreadPoolExecutor(max_workers=5) as pool:  # Wikimedia の API に負担をかけすぎない程度に並列
        for p, views in zip(people, pool.map(ja_pageviews, titles)):
            p["ja_views_30d"] = views


def to_people(data):
    people = []
    for row in data["results"]["bindings"]:
        get = lambda key: row.get(key, {}).get("value", "")
        people.append({
            "id": get("person").rsplit("/", 1)[-1],
            "name": get("personLabel"),
            "description": get("personDescription"),
            "birth_date": get("dob")[:10].lstrip("+"),
            "occupations": get("occupations"),
            "sitelinks": int(get("sitelinks") or 0),
            "ja_title": get("jaTitle"),
            "url": get("person"),
        })
    return people


def print_table(people):
    if not people:
        print("見つかりませんでした。職業名を Q-ID で指定するか、英語名でも試してみてください。")
        return
    for i, p in enumerate(people, 1):
        desc = f" — {p['description']}" if p["description"] else ""
        print(f"{i:>3}. {p['name']} ({p['birth_date']}){desc}")
        stats = [p["occupations"], f"記事 {p['sitelinks']} 言語"]
        if "ja_views_30d" in p:
            stats.append(f"日本語版 30日 {p['ja_views_30d']:,} 閲覧")
        elif not p["ja_title"]:
            stats.append("日本語版なし")
        print(f"     {' / '.join(stats)} / {p['url']}")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Wikidata から誕生日と職業で有名人を探す")
    ap.add_argument("birthday", help="誕生日（例: 10-29, 3/14, 12月25日）")
    ap.add_argument("occupation", help="職業。日本語・英語の名前（歌手, actor）か Q-ID（Q33999）")
    ap.add_argument("-n", "--limit", type=int, default=20, help="最大件数（既定 20）")
    ap.add_argument("--sort", choices=["views", "ja", "sitelinks"], default="views",
                    help="並び順。views=日本語版の閲覧数順（既定）, ja=日本語版に記事がある人を優先, "
                         "sitelinks=記事のある言語数順")
    ap.add_argument("--candidates", type=int, default=100,
                    help="--sort views のとき閲覧数を調べる候補の人数（既定 100）")
    ap.add_argument("--lang", default="ja", help="表示言語（既定 ja）")
    ap.add_argument("--json", action="store_true", help="JSON で出力する")
    ap.add_argument("--print-query", action="store_true", help="SPARQL を表示するだけで終わる")
    args = ap.parse_args(argv)

    try:
        month, day = parse_birthday(args.birthday)
    except ValueError as e:
        ap.error(str(e))
    if not re.fullmatch(r"[a-z]{2,3}(-[a-z]+)?", args.lang):
        ap.error(f"言語コードが不正です: {args.lang}")

    limit = max(1, args.limit)
    # 閲覧数順は、言語数の多い候補を多めに取ってから閲覧数で並べ直す
    fetch_limit = max(limit, args.candidates) if args.sort == "views" else limit
    query = build_query(month, day, args.occupation, fetch_limit, args.lang, args.sort)
    if args.print_query:
        print(query)
        return 0

    try:
        people = to_people(run_query(query))
    except Exception as e:  # ネットワーク・タイムアウト・HTTP エラー
        print(f"Wikidata への問い合わせに失敗しました: {e}", file=sys.stderr)
        return 1

    if args.sort == "views":
        try:
            add_pageviews(people)
        except Exception as e:
            print(f"閲覧数の取得に失敗しました: {e}", file=sys.stderr)
            return 1
        people = sorted(people, key=lambda p: p["ja_views_30d"], reverse=True)[:limit]

    if args.json:
        print(json.dumps(people, ensure_ascii=False, indent=2))
    else:
        print_table(people)
    return 0


if __name__ == "__main__":
    sys.exit(main())
