---
id: feature.domain-management.api
type: api
status: draft
related:
  - feature.domain-management
  - domain.models
---

# API Specification: Domain Management

## Common

### Base URL

/api

### Notes

- 一覧・詳細・更新・削除は仕様書共通の `/api/specs` を利用する
  （[specs-management の API](../specs-management/api.md) E-001〜E-004 を参照）。
  domain エントリの `{id}` は `domain/glossary/<term>.md` / `domain/models/<model>.md`。
- 本ドキュメントでは domain 固有の「作成」エンドポイントを定義する。

## Endpoints

### E-001 ユビキタス言語の作成

#### Method

POST

#### Path

/api/domain/terms

#### Request

```json
{ "name": "仕様書" }
```

#### Response

```json
{ "created": "domain/glossary/仕様書.md" }
```

#### Errors

- 400: 名前が空 / `/` `\` を含む / `.` で始まる / 既に存在する

### E-002 モデルの作成

#### Method

POST

#### Path

/api/domain/models

#### Request

```json
{ "name": "User" }
```

#### Response

```json
{ "created": "domain/models/User.md" }
```

モデルファイルは説明 + mermaid コードブロックのテンプレートで生成される。

#### Errors

- 400: 名前が空 / `/` `\` を含む / `.` で始まる / 既に存在する
