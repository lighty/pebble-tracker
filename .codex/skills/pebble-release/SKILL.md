---
name: pebble-release
description: Pebble Tracker リポジトリで、変更をコミットし、リモートへ push し、リリースタグを切り、GitHub Release を作成するときに使う。manifest.json と versions.json の version 整合、release assets、本文作成、push 権限エラー時の扱いまで含めた公開フロー用 skill。
---

# Pebble Release

この skill は Pebble Tracker の公開作業を一貫して進めるときに使う。

対象:
- 変更をコミットする
- 現在のブランチを push する
- 新しい release tag を作る
- GitHub Release を作る

## 前提

- リポジトリは `lighty/pebble-tracker`
- Release assets は `manifest.json`, `main.js`, `styles.css`
- バージョンは `manifest.json` と `versions.json` の両方で整合している必要がある
- GitHub Release 作成は `gh release create` を使う
- sandbox 制約がある環境では、最初に承認ルールを保存してもらうと以後の確認を減らせる

## 使い方

ユーザーが「コミットして push して release を作って」「タグを切って公開して」のように依頼したら使う。

## 手順

1. 作業ツリーを確認する
- `git status --short`
- `git branch --show-current`
- `git remote -v`
- `git tag --sort=-creatordate`

1.5. 承認ルールを先に揃える
- commit, push, tag, release 作成が sandbox の承認対象なら、最初から `prefix_rule` 付きで承認を求める
- 推奨する `prefix_rule` は以下
- `["git", "commit"]`
- `["git", "push", "origin"]`
- `["git", "tag"]`
- `["gh", "release", "create"]`
- これにより、同じ公開フロー中の再確認を減らせる

2. 次のリリース番号を決める
- 既存 tag と `manifest.json` の `version` を確認する
- 新しい release tag を切るなら、通常は `vX.Y.Z` を 1 つ上げる
- `manifest.json` の `version` と `versions.json` のエントリを同じ `X.Y.Z` に更新する

3. 最低限の確認を行う
- `node --check main.js`
- 必要なら `git diff -- ...` で release 対象差分を確認する

4. コミットする
- 変更ファイルだけを stage する
- コミットメッセージは命令形で短く書く
- 承認が必要な環境では `["git", "commit"]` の `prefix_rule` を付ける

5. push する
- 現在のブランチを `origin` に push する
- 承認が必要な環境では `["git", "push", "origin"]` の `prefix_rule` を付ける
- 権限エラーや認証エラーが出た場合は、何が拒否されたかをそのままユーザーへ伝える
- `gh auth status` が通っていても、remote が HTTPS なら別資格情報が使われることがある
- `git remote -v` が HTTPS で、`gh auth status` が SSH なら、remote を SSH に切り替える案を示す

6. tag を作る
- `git tag vX.Y.Z`
- 既に tag がある場合は再作成しない
- push 済みでなければ `git push origin vX.Y.Z`
- 承認が必要な環境では `["git", "tag"]` を使う。tag push は必要に応じて `["git", "push", "origin"]` で通す

7. Release 本文を作る
- 本文は簡潔にする
- まず「変更内容」を 2-4 行で要約する
- 必要なら「含まれるファイル」を列挙する
- 誇張した表現は避ける

本文テンプレート:

```md
## 変更内容

- ...
- ...

## 含まれるファイル

- `manifest.json`
- `main.js`
- `styles.css`
```

8. GitHub Release を作る
- `gh release view vX.Y.Z --repo lighty/pebble-tracker` で既存 release を確認する
- 未作成なら `gh release create vX.Y.Z manifest.json main.js styles.css --repo lighty/pebble-tracker --title "vX.Y.Z" --notes-file <notes-file>`
- 承認が必要な環境では `["gh", "release", "create"]` の `prefix_rule` を付ける

## 注意点

- Release の前に `manifest.json` と `versions.json` の version 不一致を放置しない
- push できていない状態では、Release 作成より先に認証または remote 設定を解決する
- 既存の未コミット変更が混ざっている場合は、今回の release 対象だけをコミットする
- 既存 tag や既存 Release がある場合は重複作成しない

## 完了時に返す内容

- 作成したコミット SHA
- push 結果
- 作成した tag
- Release URL
- 実行できなかった工程があれば、その理由
