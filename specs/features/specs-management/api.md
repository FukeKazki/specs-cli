---
id: feature.specs-management.api
type: api
status: draft
related:
  - feature.specs-management
  - domain.models
---

# API Specification: Specs Management

## Common

### Base URL

/api

### Notes

- ローカル実行を前提とし、認証は持たない。
- リクエスト / レスポンスは `application/json; charset=utf-8`。
- 仕様書の `{id}` は specs/ からの相対パス（例: `features/user-login/spec.md`）。
- エラー時は該当ステータスコードと `{"error": string}` を返す。
  - 不正なID: 400 / 存在しない仕様書: 404 / その他: 500

## Endpoints

### E-001 仕様書一覧の取得

#### Method

GET

#### Path

/api/specs

#### Request

なし

#### Response

```json
{
  "specs": [
    {
      "id": "features/specs-management/spec.md",
      "feature": "specs-management",
      "file": "spec.md",
      "type": "feature",
      "title": "Feature: Specs Management",
      "status": "draft"
    }
  ]
}
```

並び順は `.order.json` に従う。

#### Errors

- 500: 一覧取得に失敗

### E-002 仕様書詳細の取得

#### Method

GET

#### Path

/api/specs/{id}

#### Request

なし

#### Response

```json
{
  "spec": { "id": "...", "feature": "...", "file": "...", "type": "...", "title": "...", "status": "..." },
  "content": "---\nid: ...\n---\n# ..."
}
```

#### Errors

- 400: 不正なID
- 404: 仕様書が存在しない

### E-003 仕様書の更新

#### Method

PUT

#### Path

/api/specs/{id}

#### Request

```json
{ "content": "更新後のMarkdown全文" }
```

#### Response

```json
{ "ok": true }
```

#### Errors

- 400: 不正なID / リクエスト不正
- 404: 仕様書が存在しない

### E-004 仕様書の削除

#### Method

DELETE

#### Path

/api/specs/{id}

#### Request

なし

#### Response

```json
{ "ok": true }
```

feature 配下が空になった場合は feature ディレクトリも削除する。

#### Errors

- 400: 不正なID
- 404: 仕様書が存在しない

### E-005 featureの新規作成

#### Method

POST

#### Path

/api/features

#### Request

```json
{ "name": "user-login" }
```

#### Response

```json
{ "created": ["features/user-login/api.md", "features/user-login/spec.md"] }
```

`spec.md` / `api.md` をテンプレートから生成する。

#### Errors

- 400: feature名が空 / 不正な文字 / 既に存在する

### E-006 画面の新規作成

#### Method

POST

#### Path

/api/features/{feature}/screens

#### Request

```json
{ "name": "仕様書一覧画面" }
```

#### Response

```json
{ "created": "features/specs-management/screens/S-001.md" }
```

番号 (S-00n) と order は既存画面の次の値を自動採番する。

#### Errors

- 400: 画面名が空 / feature が存在しない

### E-007 画面の並び替え

#### Method

PUT

#### Path

/api/features/{feature}/screens/order

#### Request

```json
{ "order": ["features/specs-management/screens/S-002.md", "features/specs-management/screens/S-001.md"] }
```

#### Response

```json
{ "ok": true }
```

与えられた順に各画面ファイルの frontmatter の `order` を 1 から振り直す。

#### Errors

- 400: 不正なID / 対象 feature の画面でない
- 404: 画面が存在しない
