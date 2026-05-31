---
id: feature.product
type: feature
status: draft
related:
  - domain.glossary
  - domain.models
---

# Feature: Product

## Overview

プロダクトのビジョンやプリンシパルを管理するページ

## Users

PM

## Scope

### Included

- ビジョン (`product/vision.md`) の閲覧・編集
- プリンシパル (`product/principles.md`) の閲覧・編集

### Excluded

- product ドキュメントの新規作成・削除（`specs init` が生成する 2 ファイルを編集するのみ）
- 認証・認可（ローカル実行のため不要）

## Requirements

### R-001 [Must] 管理対象

product 配下の以下 2 ファイルを管理する。いずれも frontmatter `type: product` の Markdown。

- `product/vision.md`: プロダクトのビジョン
- `product/principles.md`: プロダクトのプリンシパル

これらは `specs init` で雛形を生成する。

### R-002 [Must] 閲覧

ローカル Web UI のサイドバー「Product」セクションに、ビジョンを先頭、続けて
プリンシパルを表示する。項目を選択すると本文を Markdown として整形表示する。

### R-003 [Must] 編集

詳細画面で編集モードに切り替え、本文（Markdown テキスト）を上書き保存できる。
保存後は一覧のメタ情報（title）も更新される。

### R-004 [Should] 制約

product ドキュメントの新規作成・削除は提供しない（詳細画面に削除ボタンを出さない）。
ID（specs/ からの相対パス）はパストラバーサルを禁止し、`product/` 配下かつ
`.md` で終わるパスのみを受け付ける。

## Screens

画面は `screens/` 配下に 1 画面 1 ファイル（type: screen）で管理する。

- [S-001 ビジョン画面](screens/S-001.md)
- [S-002 プリンシパル画面](screens/S-002.md)
