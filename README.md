仕様書を管理するCLIツールを作りたい。

```
specs init
specs new feature <name>
```

## initで生成されるディレクトリ

```
specs/
├── product/
│   ├── vision.md
│   └── principles.md
├── domain/
│   ├── glossary.md
│   └── models.md
└── features/
```

## ファイルテンプレート
```md:vision.md
---
id: product.vision
type: product
status: draft
---

# Vision

## Background

<!-- なぜこのプロダクトが必要か -->

## Purpose

<!-- 何を実現するか -->

## Target Users

<!-- 誰のためのプロダクトか -->

## Value Proposition

<!-- どのような価値を提供するか -->

## Non-goals

<!-- 初期スコープから外すもの -->
```

```md:principles.md
---
id: product.principles
type: product
status: draft
---

# Product Principles

## Principle 1

<!-- 判断基準となる原則を書く -->

## Principle 2

<!-- 判断基準となる原則を書く -->

## Principle 3

<!-- 判断基準となる原則を書く -->
```

```md:glossary.md
---
id: domain.glossary
type: domain
status: draft
---

# Glossary

## Term

### Definition

<!-- 用語の定義 -->

### Notes

<!-- 補足 -->

### Related

<!-- 関連する用語・Feature -->
```

```md:models.md
---
id: domain.models
type: domain
status: draft
---

# Domain Models

## Model

### Description

<!-- モデルの説明 -->

### Attributes

- id

### Relationships

<!-- 他モデルとの関係 -->

### Rules

<!-- 業務ルール・制約 -->
```

```md:feature/name/spec.md
---
id: feature.<name>
type: feature
status: draft
related:
  - domain.glossary
  - domain.models
---

# Feature: <Name>

## Overview

<!-- この機能の概要 -->

## Users

<!-- この機能を使うユーザー -->

## Scope

### Included

- 

### Excluded

- 

## Requirements

### R-001

<!-- 要件を書く -->

## Screens

### S-001

#### Purpose

<!-- 画面の目的 -->

#### Fields

- 

#### Actions

- 

#### Errors

-
```

```md:feature/name/api.md
---
id: feature.<name>.api
type: api
status: draft
related:
  - feature.<name>
  - domain.models
---

# API Specification: <Name>

## Common

### Base URL

/api

...
```


