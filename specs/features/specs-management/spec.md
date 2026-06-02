---
id: feature.specs-management
type: feature
status: draft
related:
  - domain.glossary
  - domain.models
---

# 機能: Specs Management

## 概要

仕様書を管理する。仕様書とはfeature配下のmdを差す。
ローカルファーストな思想に基づき、`specs serve` で起動するローカルWeb UIから
仕様書の一覧・詳細・作成・更新・削除・並び替えを行う。

## ユーザー

エンジニア

## スコープ

### 含む

- 仕様書の一覧閲覧
- 仕様書の新規作成
- 仕様書の削除
- 仕様書の詳細閲覧
- 仕様書の更新
- 仕様書の並び変え

- 画面（Screen）の管理（追加・並び替え・編集・削除）

### 含まない

- 認証・認可（ローカル実行のため不要）
- 仕様書本体（spec.md）の任意単体追加（作成はfeature単位）
- WYSIWYGエディタ（編集はMarkdownテキストで行う）
- DBによる管理（Markdownファイルを唯一の正とする）

## Requirements

要件は `requirements/` 配下に 1 要件 1 ファイル（type: requirement）で管理する。

:::requirement{id=R-001 priority=must}
[仕様書の対象範囲](requirements/R-001.md)
:::

:::requirement{id=R-002 priority=must}
[ローカルWeb UIの起動](requirements/R-002.md)
:::

:::requirement{id=R-003 priority=must}
[一覧の表示](requirements/R-003.md)
:::

:::requirement{id=R-004 priority=must}
[詳細の表示](requirements/R-004.md)
:::

:::requirement{id=R-005 priority=must}
[更新](requirements/R-005.md)
:::

:::requirement{id=R-006 priority=must}
[新規作成](requirements/R-006.md)
:::

:::requirement{id=R-007 priority=should}
[削除](requirements/R-007.md)
:::

:::requirement{id=R-008 priority=could}
[画面の並び替え](requirements/R-008.md)
:::

:::requirement{id=R-009 priority=must}
[安全性](requirements/R-009.md)
:::

:::requirement{id=R-010 priority=could}
[MoSCoW](requirements/R-010.md)
:::

:::requirement{id=R-011 priority=should}
[AI Prompt](requirements/R-011.md)
:::

## Screens

画面は `screens/` 配下に 1 画面 1 ファイル（type: screen）で管理する。

::screen-ref[S-001 仕様書一覧画面]{to=screens/S-001.md}
::screen-ref[S-002 仕様書詳細画面]{to=screens/S-002.md}