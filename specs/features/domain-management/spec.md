---
id: feature.domain-management
type: feature
status: draft
related:
  - domain.glossary
  - domain.models
---

# 機能: Domain Management

## 概要

ドメインを管理する

## ユーザー

PM、エンジニア

## スコープ

### 含む

- ユビキタス言語の管理
- モデルの管理

### 含まない

-

## Requirements

要件は `requirements/` 配下に 1 要件 1 ファイル（type: requirement）で管理する。

:::requirement{id=R-001 priority=must}
[モデルの表示](requirements/R-001.md)
:::

:::requirement{id=R-002 priority=must}
[データ構造](requirements/R-002.md)
:::

:::requirement{id=R-003 priority=should}
[ユビキタス言語の管理](requirements/R-003.md)
:::

:::requirement{id=R-004 priority=should}
[モデルの管理](requirements/R-004.md)
:::

## Screens

画面は `screens/` 配下に 1 画面 1 ファイル（type: screen）で管理する。

::screen-ref[S-001 ユビキタス言語一覧画面]{to=screens/S-001.md}
::screen-ref[S-002 モデル一覧画面]{to=screens/S-002.md}