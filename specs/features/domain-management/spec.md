---
id: feature.domain-management
type: feature
status: draft
related:
  - domain.glossary
  - domain.models
---

# Feature: Domain Management

## Overview

ドメインを管理する

## Users

PM、エンジニア

## Scope

### Included

- ユビキタス言語の管理
- モデルの管理

### Excluded

-

## Requirements

### R-001 [Must] モデルの表示

モデルはmermaidの記法で書く。表示もmermaidのpreviewで表示されるようにする。

### R-002 [Must] データ構造

ユビキタス言語は `domain/glossary/<term>.md` (type: term)、
モデルは `domain/models/<model>.md` (type: model) として 1 件 1 ファイルで管理する。
名前に日本語を許可し、パス区切り (`/` `\`) や `.` 始まりの名前は禁止する。

### R-003 [Should] ユビキタス言語の管理

一覧・詳細・追加・編集・削除ができる。
追加は CLI `specs new term <name>`、または Web UI の「+ 用語」から。

### R-004 [Should] モデルの管理

一覧・詳細・追加・編集・削除ができる。
追加は CLI `specs new model <name>`、または Web UI の「+ モデル」から。
モデルファイルは説明 + mermaid コードブロックを持ち、詳細画面で mermaid を描画する。

## Screens

画面は `screens/` 配下に 1 画面 1 ファイル（type: screen）で管理する。

- [S-001 ユビキタス言語一覧画面](screens/S-001.md)
- [S-002 モデル一覧画面](screens/S-002.md)
