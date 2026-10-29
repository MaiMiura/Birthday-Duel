#!/usr/bin/env python3
"""Wikidata から、指定した誕生日と職業の有名人一覧を取ってくる。

例:
    python3 birthday_people.py 10-29 歌手
    python3 birthday_people.py 3/14 Q33999 --limit 10
    python3 birthday_people.py 12-25 actor --json

有名度は Wikipedia などのサイトリンク数（何言語に記事があるか）で並べる。
標準ライブラリだけで動く。
"""

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request

ENDPOINT = "https://query.wikidata.org/sparql"
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


def build_query(month, day, occupation, limit, lang):
    return f"""
SELECT ?person ?personLabel ?personDescription (MIN(?birth) AS ?dob) ?sitelinks
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
  SERVICE wikibase:label {{
    bd:serviceParam wikibase:language "{lang},en,mul" .
    ?person rdfs:label ?personLabel ; schema:description ?personDescription .
    ?occ rdfs:label ?occLabel .
  }}
}}
GROUP BY ?person ?personLabel ?personDescription ?sitelinks
ORDER BY DESC(?sitelinks)
LIMIT {limit}
"""


def run_query(query, timeout=90):
    url = ENDPOINT + "?" + urllib.parse.urlencode({"query": query, "format": "json"})
    req = urllib.request.Request(
        url, headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.load(res)


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
        print(f"     {p['occupations']} / 記事 {p['sitelinks']} 言語 / {p['url']}")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Wikidata から誕生日と職業で有名人を探す")
    ap.add_argument("birthday", help="誕生日（例: 10-29, 3/14, 12月25日）")
    ap.add_argument("occupation", help="職業。日本語・英語の名前（歌手, actor）か Q-ID（Q33999）")
    ap.add_argument("-n", "--limit", type=int, default=20, help="最大件数（既定 20）")
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

    query = build_query(month, day, args.occupation, max(1, args.limit), args.lang)
    if args.print_query:
        print(query)
        return 0

    try:
        people = to_people(run_query(query))
    except Exception as e:  # ネットワーク・タイムアウト・HTTP エラー
        print(f"Wikidata への問い合わせに失敗しました: {e}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(people, ensure_ascii=False, indent=2))
    else:
        print_table(people)
    return 0


if __name__ == "__main__":
    sys.exit(main())
