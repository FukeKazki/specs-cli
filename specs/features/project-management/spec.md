---
id: feature.project-management
type: feature
status: draft
related:
  - domain.glossary
  - domain.models
---

# 機能: Project Management

## 概要

プロジェクト管理機能。
**要件（Requirement）単位**で、PM 目線でプロジェクトの進行状況を管理する。
各要件（`features/<feature>/requirements/R-00n.md`）にステータス・担当・期間を付与し、
ガントチャート・かんばん・リストの 3 ビューで進捗を可視化する。要件は feature 単位でまとめる。
本機能は「どの要件が、いつ、誰の担当で、どこまで進んでいるか」を扱う。
個別のタスク / issue 管理は本機能の対象外とする。
[specs-management](../specs-management/spec.md) と同じく、進捗データは各要件ファイルの
frontmatter を唯一の正（ローカルファースト / DB レス）とする。

## ユーザー

PM、エンジニア

## スコープ

### 含む

- 要件（Requirement）単位での進捗管理（PM 目線）
- 要件の追加（feature ごとに R-00n を自動採番）
- ステータス管理（かんばんでの遷移を含む）
- リスト / かんばん / ガントの 3 ビュー
- 担当・期間（開始 / 期限）・要件間の依存関係の設定
- feature・priority・status・担当でのフィルタ / グルーピング

### 含まない

- 個別タスク / issue の管理（本機能の対象外）
- 認証・認可（ローカル実行のため不要）
- DB による管理（Markdown を唯一の正とする）
- 外部 PM ツール（Jira / GitHub Projects 等）との連携
- 工数・コスト管理、バーンダウン等の高度な分析
- 仕様書（spec.md / requirement / screen）の新規作成・削除（[specs-management](../specs-management/spec.md) が担う）

## Requirements

要件は `requirements/` 配下に 1 要件 1 ファイル（type: requirement）で管理する。
各要件は frontmatter に `priority`（MoSCoW）・`status`・`assignee`・`start`・`due`・`depends_on`
を持ち、本機能の 3 ビュー（リスト / かんばん / ガント）の管理単位となる。

:::requirement{id=R-001 priority=must}
[進捗管理の単位（要件）](requirements/R-001.md)
:::

:::requirement{id=R-002 priority=must}
[ステータス](requirements/R-002.md)
:::

:::requirement{id=R-003 priority=must}
[スケジュール属性](requirements/R-003.md)
:::

:::requirement{id=R-004 priority=must}
[リストビュー](requirements/R-004.md)
:::

:::requirement{id=R-005 priority=must}
[かんばんビュー](requirements/R-005.md)
:::

:::requirement{id=R-006 priority=must}
[ガントチャートビュー](requirements/R-006.md)
:::

:::requirement{id=R-007 priority=should}
[フィルタ / グルーピング](requirements/R-007.md)
:::

:::requirement{id=R-008 priority=should}
[編集の反映](requirements/R-008.md)
:::

:::requirement{id=R-009 priority=could}
[進捗サマリ](requirements/R-009.md)
:::

:::requirement{id=R-010 priority=must}
[データの永続化と安全性](requirements/R-010.md)
:::

## Screens

画面は `screens/` 配下に 1 画面 1 ファイル（type: screen）で管理する。

::screen-ref[S-001 リストビュー画面]{to=screens/S-001.md}
::screen-ref[S-002 かんばんビュー画面]{to=screens/S-002.md}
::screen-ref[S-003 ガントチャート画面]{to=screens/S-003.md}