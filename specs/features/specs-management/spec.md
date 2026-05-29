---
id: feature.specs-management
type: feature
status: draft
related:
  - domain.glossary
  - domain.models
---

# Feature: Specs Management

## Overview

仕様書を管理する。仕様書とはfeature配下のmdを差す。
ローカルファーストな思想に基づき、`specs serve` で起動するローカルWeb UIから
仕様書の一覧・詳細・作成・更新・削除・並び替えを行う。

## Users

エンジニア

## Scope

### Included

- 仕様書の一覧閲覧
- 仕様書の新規作成
- 仕様書の削除
- 仕様書の詳細閲覧
- 仕様書の更新
- 仕様書の並び変え

- 画面（Screen）の管理（追加・並び替え・編集・削除）

### Excluded

- 認証・認可（ローカル実行のため不要）
- 仕様書本体（spec.md / api.md）の任意単体追加（作成はfeature単位）
- WYSIWYGエディタ（編集はMarkdownテキストで行う）
- DBによる管理（Markdownファイルを唯一の正とする）

## Requirements

### R-001 仕様書の対象範囲

仕様書として扱うのは `specs/features/<feature>/*.md` のみとする。
product / domain 配下のファイルは対象外とする。

### R-002 ローカルWeb UIの起動

`specs serve [--addr host:port]` でローカルHTTPサーバを起動する。
デフォルトの待受は `127.0.0.1:8787`。
specs/ が未初期化の場合はエラーを表示し、`specs init` を促す。

### R-003 一覧の表示

仕様書を feature 単位でグループ化して表示する。
各項目は ファイル名・type（frontmatterのtype）を表示する。

### R-004 詳細の表示

選択した仕様書をMarkdownとして整形表示する。
frontmatter はメタ情報として区別して表示する。

### R-005 更新

詳細画面で編集モードに切り替え、本文を上書き保存できる。
保存後は一覧のメタ情報（title / status）も更新される。

### R-006 新規作成

- feature 作成: feature 名を入力すると `spec.md` / `api.md` を生成する。
  CLI の `specs new feature <name>` と同一の生成ロジック・テンプレートを用いる。
  feature 名に使えるのは英数字・`.`・`_`・`-` のみ。
- 画面作成: feature を指定して画面を追加すると `screens/S-00n[-<slug>].md`
  を生成する。番号 (S-00n) と order は既存画面の次の値を自動採番する。
  CLI は `specs new screen <feature> <name>`。

### R-007 削除

仕様書ファイルを削除する。削除によって `screens/` や feature 配下が
空になった場合は当該ディレクトリも削除する（`features/` 自体は残す）。

### R-008 画面の並び替え

一覧上のドラッグ&ドロップで同一 feature 内の画面の表示順を変更できる。
並び順は各画面ファイルの frontmatter の `order` に永続化する。
一覧は feature 昇順 → feature 内は spec.md, api.md, その後 screen を
order 昇順で表示する。

### R-009 安全性

ID（specs/ からの相対パス）はパストラバーサルを禁止し、
`features/` 配下かつ `.md` で終わるパスのみを受け付ける。

## Screens

画面は `screens/` 配下に 1 画面 1 ファイル（type: screen）で管理する。

- [S-001 仕様書一覧画面](screens/S-001.md)
- [S-002 仕様書詳細画面](screens/S-002.md)
