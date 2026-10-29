# Birthday Duel

## birthday_people.py

Wikidata から、指定した誕生日と職業の有名人一覧を取ってくる小さなスクリプトです。Python 3 の標準ライブラリだけで動きます。

```sh
python3 birthday_people.py 10-29 歌手
python3 birthday_people.py 3/14 Q33999 --limit 10   # 職業を Q-ID で指定（Q33999 = 俳優）
python3 birthday_people.py 12月25日 actor --json
python3 birthday_people.py 10-29 歌手 --sort views   # 日本語版 Wikipedia の閲覧数順
```

| 引数 | 内容 |
| --- | --- |
| `birthday` | 誕生日。`10-29` `3/14` `12月25日` `1029` など |
| `occupation` | 職業。日本語か英語の名前（Wikidata のラベルと完全一致）か Q-ID |
| `-n`, `--limit` | 最大件数（既定 20） |
| `--sort` | 並び順。`ja`（既定）/ `views` / `sitelinks`（下の表） |
| `--candidates` | `--sort views` のとき閲覧数を調べる候補の人数（既定 100） |
| `--lang` | 名前・説明の表示言語（既定 `ja`、なければ英語） |
| `--json` | JSON で出力 |
| `--print-query` | 送る SPARQL を表示するだけ（[Wikidata Query Service](https://query.wikidata.org/) に貼って試せます） |

### 並び順

| `--sort` | 並び方 |
| --- | --- |
| `ja`（既定） | 日本語版 Wikipedia に記事がある人を先に、その中は記事のある言語数が多い順 |
| `views` | 日本語版 Wikipedia の直近 30 日の閲覧数が多い順（日本語版に記事がある人だけ） |
| `sitelinks` | 記事のある言語数が多い順（世界的な知名度） |

`views` は、言語数の多い順に `--candidates` 人まで候補を取り、その人たちの閲覧数を [Wikimedia の閲覧数 API](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/) で調べて並べ直します。候補から漏れた人は出てこないので、取りこぼしが気になるときは `--candidates 300` のように増やしてください（そのぶん時間がかかります）。

### 補足

- 生年月日が日付まで分かっている人だけを対象にしています（年だけの人は除外）。
- 職業名で見つからないときは、Q-ID か英語名（`singer`, `actor` など）で試してください。
- 俳優のように人数の多い職業では、問い合わせに数十秒かかることがあります。
