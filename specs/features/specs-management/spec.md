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
- 仕様書本体（spec.md / api.yaml）の任意単体追加（作成はfeature単位）
- WYSIWYGエディタ（編集はMarkdownテキストで行う）
- DBによる管理（Markdownファイルを唯一の正とする）

## Requirements

### R-001 [Must] 仕様書の対象範囲

仕様書として扱うのは以下とする。

- `features/<feature>/spec.md`（type: feature）
- `features/<feature>/api.yaml`（type: api / OpenAPI 3.1）
- `features/<feature>/screens/*.md`（type: screen）
- `domain/glossary/*.md`（type: term）, `domain/models/*.md`（type: model）
- `product/*.md`（type: product）— ビジョン / プリンシパル（[product feature](../product/spec.md) が管理）

### R-002 [Must] ローカルWeb UIの起動

`specs serve [--addr host:port]` でローカルHTTPサーバを起動する。
デフォルトの待受は `127.0.0.1:8787`。
specs/ が未初期化の場合はエラーを表示し、`specs init` を促す。

### R-003 [Must] 一覧の表示

仕様書を feature 単位でグループ化して表示する。
各項目は ファイル名・type（frontmatterのtype）を表示する。

### R-004 [Must] 詳細の表示

仕様書を種別に応じて整形表示する。

- Markdown（spec.md / screen / term）: frontmatter をメタ情報として区別し本文を描画
- model: mermaid コードブロックを図として描画
- api.yaml: OpenAPI として paths / operations / schemas を軽量ビューで表示

### R-005 [Must] 更新

詳細画面で編集モードに切り替え、本文（Markdown / YAML テキスト）を上書き保存できる。
api.yaml は保存前に **OpenAPI スキーマ検証**を行い、不正な場合はエラーを表示して保存しない。
保存後は一覧のメタ情報（title など）も更新される。

### R-006 [Must] 新規作成

- feature 作成: feature 名を入力すると `spec.md` / `api.yaml`（OpenAPI 3.1 雛形）を生成する。
  CLI の `specs new feature <name>` と同一の生成ロジック・テンプレートを用いる。
  feature 名に使えるのは英数字・`.`・`_`・`-` のみ。
- 画面作成: feature を指定して画面を追加すると `screens/S-00n[-<slug>].md`
  を生成する。番号 (S-00n) と order は既存画面の次の値を自動採番する。
  CLI は `specs new screen <feature> <name>`。

### R-007 [Should] 削除

仕様書ファイルを削除する。削除によって `screens/` や feature 配下が
空になった場合は当該ディレクトリも削除する（`features/` 自体は残す）。

### R-008 [Could] 画面の並び替え

一覧上のドラッグ&ドロップで同一 feature 内の画面の表示順を変更できる。
並び順は各画面ファイルの frontmatter の `order` に永続化する。
一覧は domain → feature 昇順 → feature 内は spec.md, api.yaml, その後 screen を
order 昇順で表示する。

### R-009 [Must] 安全性

ID（specs/ からの相対パス）はパストラバーサルを禁止し、
管理対象ルート（`product/`, `features/`, `domain/glossary/`, `domain/models/`）配下かつ
`.md` / `.yaml` で終わるパスのみを受け付ける。

### R-010 [Could] MoSCoW

各要件に MoSCoW 優先度（Must / Should / Could / Won't）を付けられる。

要件見出しに角括弧タグで記述する。表記は `### R-001 [Must] タイトル` の形式。
詳細画面（Markdown ビュー）では見出し右端に色分けバッジとして描画する
（Must=赤 / Should=橙 / Could=青 / Won't=灰）。タグの無い見出しはバッジ無し。
タグは Markdown 上の記法であり、ファイル（Markdown を唯一の正とする）に保存される。

### R-011 [Should] AI Prompt

各要件や仕様を簡単に AI に渡せるよう、参照パスをクリップボードにコピーできる。
形式は `@specs/features/specs-management/spec.md L10` のように
`@specs/<相対パス>`（仕様単位）と `@specs/<相対パス> L<行番号>`（要件単位）。

- 詳細画面ツールバーの「パスをコピー」で仕様ファイルの参照 `@specs/<id>` をコピーする。
- Markdown ビューの各見出しにホバーで現れる 🔗 で、その見出しの参照
  `@specs/<id> L<行番号>` をコピーする。行番号は frontmatter を含む実ファイル行。

## Screens

画面は `screens/` 配下に 1 画面 1 ファイル（type: screen）で管理する。

- [S-001 仕様書一覧画面](screens/S-001.md)
- [S-002 仕様書詳細画面](screens/S-002.md)
