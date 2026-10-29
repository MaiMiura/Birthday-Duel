# Birthday Duel

## birthday_people.py

Wikidata から、指定した誕生日と職業の有名人一覧を取ってくる小さなスクリプトです。Python 3 の標準ライブラリだけで動きます。

```sh
python3 birthday_people.py 10-29 歌手
python3 birthday_people.py 3/14 Q33999 --limit 10   # 職業を Q-ID で指定（Q33999 = 俳優）
python3 birthday_people.py 12月25日 actor --json
```

| 引数 | 内容 |
| --- | --- |
| `birthday` | 誕生日。`10-29` `3/14` `12月25日` `1029` など |
| `occupation` | 職業。日本語か英語の名前（Wikidata のラベルと完全一致）か Q-ID |
| `-n`, `--limit` | 最大件数（既定 20） |
| `--lang` | 名前・説明の表示言語（既定 `ja`、なければ英語） |
| `--json` | JSON で出力 |
| `--print-query` | 送る SPARQL を表示するだけ（[Wikidata Query Service](https://query.wikidata.org/) に貼って試せます） |

- 「有名さ」は Wikipedia などのサイトリンク数（何言語に記事があるか）で並べています。
- 生年月日が日付まで分かっている人だけを対象にしています（年だけの人は除外）。
- 職業名で見つからないときは、Q-ID か英語名（`singer`, `actor` など）で試してください。
- 俳優のように人数の多い職業では、問い合わせに数十秒かかることがあります。
