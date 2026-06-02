---
id: feature.product
type: feature
status: draft
related:
  - domain.glossary
  - domain.models
---

# 機能: Product

## 概要

プロダクトのビジョンやプリンシパルを管理するページ

## ユーザー

PM

## スコープ

### 含む

- ビジョン (`product/vision.md`) の閲覧・編集
- プリンシパル (`product/principles.md`) の閲覧・編集

### 含まない

- product ドキュメントの新規作成・削除（`specs init` が生成する 2 ファイルを編集するのみ）
- 認証・認可（ローカル実行のため不要）

## Requirements

要件は `requirements/` 配下に 1 要件 1 ファイル（type: requirement）で管理する。

:::requirement{id=R-001 priority=must}
[管理対象](requirements/R-001.md)
:::

:::requirement{id=R-002 priority=must}
[閲覧](requirements/R-002.md)
:::

:::requirement{id=R-003 priority=must}
[編集](requirements/R-003.md)
:::

:::requirement{id=R-004 priority=should}
[制約](requirements/R-004.md)
:::

## Screens

画面は `screens/` 配下に 1 画面 1 ファイル（type: screen）で管理する。

::screen-ref[S-001 ビジョン画面]{to=screens/S-001.md}
::screen-ref[S-002 プリンシパル画面]{to=screens/S-002.md}