# Handoff: specs Web UI（ローカル仕様管理ツールの UI 刷新）

## 概要

`specs` / `specs-cli` は、ソフトウェアの「仕様書」を Markdown / YAML ファイル（`specs/` 配下）で
ローカル管理する CLI ツールです。`specs serve` で起動するローカル Web UI から、仕様書の
**一覧 / 詳細 / 作成 / 編集 / 削除 / 並び替え** を行います。

本ハンドオフは、その Web UI を刷新したデザイン案（コンセプト「静かに読める開発ドキュメント」）を、
実プロダクトに実装するための仕様書です。情報設計（2 ペイン構成・データモデル）は現状を維持し、
ビジュアルと UX を刷新しています。

---

## このバンドルのデザインファイルについて

`design/` 配下のファイルは **HTML で作られたデザインリファレンス**です。最終的な見た目と
挙動を示すプロトタイプであり、そのまま本番コードとしてコピーするものではありません。

タスクは、これらの HTML デザインを **対象コードベースの環境（後述の想定スタック）で再現する**
ことです。プロトタイプは React + Babel（ブラウザ内トランスパイル）+ CDN ライブラリで動いて
いますが、本番では Vite ビルド・npm 依存・TypeScript 化が前提です。

### プロトタイプ特有の事情（本番では置き換えるもの）

| プロトタイプ | 本番実装 |
|---|---|
| ファイル本文を `<script type="text/plain" id="spec:...">` に埋め込み、`getRaw()` で読む | バックエンド API（`GET /api/specs/{id}`）から取得 |
| `overrides` state にメモリ保存（保存しても消える） | `PUT /api/specs/{id}` でファイルへ永続化 |
| `marked` でMarkdown描画 | **react-markdown**（指定スタック） |
| `js-yaml` でYAML解析 | `js-yaml` または `yaml`（OpenAPI軽量ビュー用） |
| `mermaid` CDN | `mermaid` npm |
| 自前の `parseFront()` 簡易frontmatterパーサ | `gray-matter` 等の堅牢なパーサ推奨 |
| Tweaksパネル（テーマ等の検証用UI） | **実装不要**。テーマ切り替えのみ残す（後述） |

---

## 想定スタック（制約）

ブリーフ記載の制約に従ってください。

- **React + Vite + TypeScript**（ビルド成果物を Go バイナリに埋め込み配信）
- Markdown 描画: **react-markdown**（+ `remark-gfm`）
- 図: **mermaid**
- OpenAPI: 外部レンダラを使わず **軽量な自前ビュー**（`js-yaml` でパースしてReact描画）
- 認証なし（`127.0.0.1` で 1 人が使う前提）
- 派手な独自描画・過度なアニメは避け、**開発ツールとしての信頼感・可読性・素早い操作**を優先

---

## フィデリティ

**ハイファイ（hifi）**です。色・タイポgrafィ・余白・角丸・状態遷移まで最終形を意図しています。
`design/styles.css` の値をそのまま実装の正とみなして、ピクセル単位で再現してください。
ライト/ダーク両テーマ対応。

---

## 全体レイアウト

3 カラム構成（左サイドバー / 中央ドキュメント / 右情報レール）。すべて `100vh`・`overflow:hidden` の
アプリシェル内に収まり、各カラムが個別にスクロールします。

```
┌──────────────────────────────────────────────────────────────┐
│ TopBar (h:52px)                                              │
├──────────────┬───────────────────────────────┬──────────────┤
│ Sidebar      │ DetailToolbar (h:48px)        │              │
│ (w:320px)    ├───────────────────────────────┤  InfoRail    │
│              │                               │  (w:268px)   │
│ 検索         │ Document / Editor             │  情報パネル  │
│ ▸プロダクト  │ (max-width:820px, 中央寄せ)   │  (開閉可)    │
│ ▸ドメイン    │                               │              │
│ ▸機能        │                               │              │
└──────────────┴───────────────────────────────┴──────────────┘
```

- **左サイドバー**: `width:320px`、`collapsed` 時 `margin-left:-320px` でスライド収納。
- **右情報レール**: `width:268px`、`hidden` 時 `margin-right:-269px`。⌐デフォルトはビューポート幅 > 1180px のとき開。
- レスポンシブ:
  - `≤1100px`: 情報レールは `position:absolute` のオーバーレイに。
  - `≤860px`: サイドバーもオーバーレイ化（背後にスクリム）。ドキュメントの padding 縮小。

---

## 画面 / ビュー

### 1. TopBar（ヘッダー）

- 高さ `52px`、`backdrop-filter: blur(10px)` の半透明パネル、下境界線。
- 左から:
  1. サイドバー開閉アイコンボタン（`panel` / `panelOpen` アイコン、`32×32`）
  2. ブランド: `§` グリフ（`26×26`, `border-radius:7px`, 前景色=`--text` 背景, 文字=`--bg`）+ 「spec**s**」（`s` のみ `--accent` 色）
  3. パスヒント `~/project/specs · 127.0.0.1:8787`（等幅・`--faint`）
  4. （右寄せ）テーマ切り替えアイコン（`sun`/`moon`）
  5. プライマリボタン「**＋ 新規 feature**」（`--accent` 背景）

### 2. Sidebar（左ツリー）

検索フィールド（`height:34px`、虫眼鏡アイコン + `/` ショートカットヒント。**プロトタイプでは未配線** —
本番では title + パスの前方一致でフィルタ推奨）。

その下に **3 つの均一な折りたたみセクション**（すべて開閉可能、`Disclosure` コンポーネント）:

1. **プロダクト**
   - ビジョン（`product/vision.md`）
   - プロダクト原則（`product/principles.md`）
   - ※ Vision を常に先頭表示。
2. **ドメイン**
   - **ユビキタス言語**（折りたたみ・「＋」で用語追加）: 用語項目（type=term）
   - **モデル**（折りたたみ・「＋」でモデル追加）: モデル項目（type=model）
3. **機能**（「＋」で新規 feature）
   - feature ごとに **折りたたみノード**（`cube` アイコン + feature 名を等幅表示）:
     - 機能仕様（ラベル「機能仕様」+ 等幅ヒント `spec.md`、type=feature）
     - API 仕様（ラベル「API 仕様」+ 等幅ヒント `api.yaml`、type=api）
     - **画面**（折りたたみ・「＋」で画面追加）: 画面項目（type=screen、ドラッグ&ドロップで並び替え）
       - 0 件のとき「画面がありません」（`--faint`、クリック不可）

**ネスト仕様**: 各階層は `depth` プロパティで `padding-left = 8 + depth*13px`（見出し）/
`9 + depth*13px`（行）。階層は 見出し depth 0→1→2、行 depth 1〜3。

**行（Row）**:
- `display:flex; gap:8px; padding: var(--density-pad) 9px; border-radius:7px`
- ホバー: 背景 `--panel-2`。選択中(`.active`): 背景 `--accent-wash` + 左に `2.5px` のアクセント縦ライン（`::before`）、ラベル太字。
- 画面項目は先頭に画面番号 `S-00n`（等幅・`--faint`）。
- feature 直下の仕様は末尾にファイル名ヒント（等幅・`--faint`）。
- 右端に **type バッジ**。
- 画面項目のみ `draggable`: ホバーで grip アイコン表示、ドラッグ中 `opacity:0.4`、ドロップ対象は上端に `inset 0 2px 0 var(--accent)`。

**type バッジ**（日本語ラベル）:

| type | ラベル | 色トークン |
|---|---|---|
| product | プロダクト | `--t-product` |
| feature | 機能 | `--t-feature` |
| api | API | `--t-api` |
| screen | 画面 | `--t-screen` |
| term | 用語 | `--t-term` |
| model | モデル | `--t-model` |

バッジ: `font-size:10px; font-weight:600; padding:1px 6px; border-radius:5px`、
背景 = `color-mix(in oklch, <色> 13%, transparent)`、文字 = 色そのもの、境界 = `<色> 22%`。

### 3. DetailToolbar（詳細上部ツールバー）

- 高さ `48px`、半透明 + blur、下境界線。
- 左: **パンくず**（`id` を `/` で分割、等幅、最後のセグメントのみ `--text` 太字、他は `--muted`）。
- 右（閲覧時）: 「**編集**」ボタン / （product 以外）「**削除**」アイコンボタン（`--danger`）/ 情報パネル開閉アイコン（ⓘ、`on` 時に背景強調）。
- 右（編集時）: 「編集中」インジケータ（パルスするドット）/ 「キャンセル」/ 「**保存**」（プライマリ）。

### 4. Document（中央・閲覧）

`max-width:820px` 中央寄せ、`padding:40px 56px 120px`。種別で出し分け（下記「4 表示モード」）。

### 5. InfoRail（右情報パネル）

frontmatter は **本文には表示せず**、この右レールに集約します（「frontmatter は読まないので本文の邪魔をしない」要件）。
`width:268px`、`--bg-2` 背景、左境界線。ⓘ ボタンで開閉。中身（`info-block` 単位、上から）:

1. **種別**: type バッジ + ステータスピル（`draft`→「下書き」、`review`→「レビュー中」、`done`→「確定」）。
2. **画面番号**（screen のみ）: `S-00n · 表示順 N`。
3. **frontmatter**: type/status/related を除いた残りのキー（`id` など）を等幅 key/value で。空なら非表示。
4. **関連**（frontmatter `related` がある場合）: dotted-id（例 `domain.glossary`）をリンク表示。クリックで該当仕様へ遷移（`onRelated` 解決ロジック参照）。
5. **目次**: 本文の H2/H3 を抽出。クリックで中央スクロール領域を `scrollTo({top, behavior:'smooth'})`。H3 はインデント + 小さめ。
6. **パス**: `specs/<id>` を等幅・インセット枠で。

---

## 4 つの表示モード（中央ペイン）

### A. Markdown（product / feature / screen / term）

`react-markdown` + `remark-gfm` で描画。`design/styles.css` の `.md *` を適用。
- H1 `30px/600`、H2 `18px/600`+下境界線、H3 `15px`、H4 `13.5px`（`--muted`）。
- 本文 `line-height:1.6`、リスト marker は `--faint`。
- リンクは `--accent` + 下線（`--accent-line`）。コード/preは `--inset` 背景 + 境界。
- 引用は左 `3px` アクセント境界 + `--panel-2` 背景。
- テーブルは border-collapse、ヘッダ `--panel-2`。
- **HTML コメント**（`<!-- ... -->`）は隠さず、薄いイタリック注釈 `// ...`（`.md-comment`、`--faint`）として表示。`<!-- 補足 -->` のような空テンプレ部分の意図が見えるように。
- **内部リンク**（`screens/S-001.md`、`Feature.md` 等の相対リンク）はクリックで該当仕様へSPA遷移（現在の id のディレクトリ基準で解決、`..` を畳む）。外部 `http(s)` リンクは通常遷移。

### B. mermaid モデル図（model）

本文中の ```` ```mermaid ```` フェンスを図としてレンダリング。それ以外の部分は通常の Markdown。
- `mermaid.initialize({ theme:'base', securityLevel:'loose', themeVariables, fontFamily:'"IBM Plex Sans JP"...' })`。
- `themeVariables` はライト/ダークで切り替え（`design/lib.jsx` の `mermaidVars()` 参照）。テーマ変更時に再レンダリング必須。
- レンダ枠 `.mermaid-wrap`: `padding:24px`、`--panel` 背景、境界、中央寄せ、横スクロール可。SVGは `max-width:100%`。
- レンダ中はスケルトン表示。

### C. OpenAPI 軽量ビュー（api.yaml）

`js-yaml` で YAML をパースし、自前 React コンポーネントで描画（外部 Swagger UI は使わない）。
`design/openapi.jsx` がリファレンス実装。

- **ヒーロー**: `info.title`（`24px/600`）+ バージョンピル（`v0.1.0`）+ `OpenAPI 3.1.0` ピル + `info.description` + `servers`（`base /api` チップ）。
- **Paths**: 各 operation をカード化（`{path}`×methods を展開）。
  - ヘッダ行: **メソッドバッジ**（色分け・下表）+ パス（`{var}` は `--accent` 着色）+ summary（右寄せ）+ 開閉キャレット。クリックで展開。
  - 展開時: `operationId` / `description` / **Parameters** テーブル（name/in/type/required/description）/ **Request body**（`$ref` 解決してフィールド行、required は `*`）/ **Responses**（ステータスコードを 2xx=緑 / 4xx5xx=赤 で色分け、`→ schema名`）。
  - `$ref`（`#/components/...`）は解決して表示。最初の operation はデフォルト展開。
- **Schemas**: `components.schemas` をカード一覧化（フィールド名 + required `*` + enum チップ + 型ラベル。`array<X>` 形式で配列を表記）。

**HTTP メソッド色**（`oklch`、ライト時）:

| メソッド | トークン | 値（light） |
|---|---|---|
| GET | `--m-get` | `oklch(0.55 0.13 256)` |
| POST | `--m-post` | `oklch(0.55 0.12 152)` |
| PUT | `--m-put` | `oklch(0.62 0.12 78)` |
| PATCH | `--m-patch` | `oklch(0.54 0.15 305)` |
| DELETE | `--m-delete` | `oklch(0.55 0.17 27)` |

（ダーク時の値は `styles.css` の `[data-theme="dark"]` ブロック参照）

### D. 編集モード（全種別）

- 等幅 `textarea` で Markdown / YAML を直接編集。`.editor-area` は `max-width:980px`。
- `textarea`: `--panel` 背景、`13px/1.7`、フォーカスで `--accent-line` 境界 + `--accent-wash` リング。
- `⌘S` / `Ctrl+S` で保存。
- **api.yaml の保存時は OpenAPI 検証**: `openapi` フィールド必須、`info.title` 必須、`paths` がオブジェクトであること。不正なら `.editor-err`（赤枠）にエラー表示し**保存しない**＋エラートースト。編集モードは維持。
- 保存成功で本文を永続化し、一覧のメタ（title/status）を再導出（H1 から title 抽出。feature は `Feature: X` のまま、screen は `Screen:` プレフィックスを除去）。

---

## インタラクション & 振る舞い

### 選択・ナビゲーション
- 一覧項目クリック → 詳細表示。**URL ハッシュ** `#/<id>` で状態保持（リロード復元・戻る/進む対応）。
- 選択時に短いスケルトン（~140ms）を挟んでローディング状態を表現。
- 狭幅（`≤860px`）では選択後サイドバーを自動的に閉じる。

### 新規作成（モーダル）
4 種別（feature / 画面 / 用語 / モデル）。`design/data.js` の `CREATE_COPY` にコピー実データ:

| 種別 | タイトル | ヒント | プレースホルダ | 生成物 |
|---|---|---|---|---|
| feature | 新規 feature | 英数字 . _ - が使えます。spec.md と api.yaml が生成されます。 | feature 名 (例: user-login) | `spec.md` / `api.yaml` |
| screen | 画面を追加 — `<feature>` | 画面名を入力。S-00n が自動採番され screens/ に生成されます。 | 画面名 (例: ログイン画面) | `screens/S-00n.md` |
| term | 用語を追加 | ユビキタス言語を domain/glossary/ に作成します。 | 用語名 (例: 仕様書) | `domain/glossary/<name>.md` |
| model | モデルを追加 | mermaid 記法のモデルを domain/models/ に作成します。 | モデル名 (例: User) | `domain/models/<name>.md` |

- 入力に応じて**生成ファイルのライブプレビュー**（`+ features/<n>/spec.md` 等）。
- Enter で作成、Esc / スクリム / キャンセルで閉じる。作成後その新規仕様を選択。
- 画面の番号（S-00n）と order は既存画面の次の値を自動採番。
- 生成テンプレートは `design/app.jsx` の `tmplFeatureSpec` / `tmplApi` / `tmplScreen` / `tmplTerm` / `tmplModel` 参照（CLI の `specs new ...` と同一ロジックにすること）。

### 画面のドラッグ&ドロップ並び替え
- 同一 feature 内の画面のみ。`order`（frontmatter）を 1 始まりで再採番し永続化。
- 完了時トースト「並び順を保存しました」。

### 削除
- product 以外。`window.confirm` で確認 → 削除 → 隣接項目を選択。トースト表示。
- （実装: 空になった `screens/` や feature 配下ディレクトリも削除。`features/` 自体は残す。）

### トースト（右下）
- 種類: `ok`（緑チェック）/ `err`（赤警告）/ `info`。本文 + サブテキスト（等幅）。
- 出現アニメ（右からスライド）、約 2.6s 後にフェードアウト。
- メッセージ例: 「保存しました」「並び順を保存しました」「削除しました」「検証エラー: 保存しませんでした」「関連先が見つかりません」。

### 状態デザイン
- **空状態**（未選択）: 中央にアイコン枠 + 「仕様書が選択されていません」+ 補助文。
- **ローディング**: スケルトン（`shimmer` アニメ）。
- **エラー**（編集検証）: 赤枠 `.editor-err`。
- **0 件**（画面なし）: 「画面がありません」。

---

## 状態管理（プロトタイプの shape — 本番は API 連携に置換）

| state | 型 | 説明 |
|---|---|---|
| `specs` | `Spec[]` | 一覧メタ（id/type/feature/file/title/status/number/order）。本番は `GET /api/specs` |
| `selectedId` | `string` | 選択中 id。URL ハッシュと双方向同期 |
| `editing` | `boolean` | 編集モード |
| `draft` | `string` | 編集中テキスト |
| `editErr` | `string\|null` | 検証エラー |
| `modal` | `{kind, feature}\|null` | 作成モーダル |
| `collapsed` | `Record<string,boolean>` | 折りたたみ状態（`g:product`, `sub:terms`, `feat:<name>`, `screens:<name>` 等のキー） |
| `sbOpen` / `infoOpen` | `boolean` | サイドバー / 情報レールの開閉 |
| `toasts` | `Toast[]` | トースト列 |
| `drag` | `{id, over}` | D&D 状態 |
| テーマ | `'light'\|'dark'` | `<html data-theme>` に反映。`localStorage` 永続化推奨 |

`Spec` のデータモデルは `design/data.js` 冒頭の `SPECS` 配列と、OpenAPI の `components.schemas.Spec` を正とする。

---

## デザイントークン

すべて `design/styles.css` の `:root`（light）/ `[data-theme="dark"]`（dark）に定義済み。`oklch` 採用。

### カラー（light）
| トークン | 用途 | 値 |
|---|---|---|
| `--bg` | 背景 | `oklch(0.985 0.004 85)` |
| `--bg-2` | サイド/レール背景 | `oklch(0.972 0.004 85)` |
| `--panel` | パネル | `oklch(1 0 0)` |
| `--panel-2` | パネル(2) | `oklch(0.976 0.004 85)` |
| `--inset` | インセット | `oklch(0.965 0.005 85)` |
| `--border` | 境界 | `oklch(0.915 0.004 85)` |
| `--border-2` | 境界(強) | `oklch(0.86 0.005 85)` |
| `--text` | 文字 | `oklch(0.29 0.008 75)` |
| `--muted` | ミュート | `oklch(0.55 0.01 75)` |
| `--faint` | 微弱 | `oklch(0.7 0.008 75)` |
| `--accent` | アクセント | `oklch(0.55 0.15 256)`（hue可変 `--accent-h`） |
| `--danger` | 危険 | `oklch(0.55 0.18 25)` |

ダークは同名トークンを `[data-theme="dark"]` で上書き（背景 `oklch(0.185 ...)` 系）。
`--accent-wash` / `--accent-line` は `color-mix` で派生。

### タイポグラフィ
- UI / 本文: **IBM Plex Sans JP**（weights 400/500/600/700）
- コード / メタ / パス / バッジ補助: **IBM Plex Mono**（400/500/600）
- ベース `14px`（`--ui-scale` 倍率）/ `line-height:1.6`
- スケール: H1 `30px` / H2 `18px` / H3 `15px` / H4 `13.5px` / 本文 `13–14px` / バッジ `10px`

### 余白・形状
- 角丸: `--radius` 既定 `9px`（要素により `5–14px`）。ボタン `8px`、モーダル `14px`、トースト `10px`。
- サイドバー行の縦 padding: `--density-pad`（compact `5` / regular `7` / comfy `10`）。
- 影: `--shadow`（モーダル/トースト/オーバーレイ）/ `--shadow-sm`。ほぼフラット、薄い境界中心。

### アイコン
`design/lib.jsx` の `ICON` に SVG パスを定義（`20×20` viewBox、stroke 1.6）。
plus / search / chevron / caret / sun / moon / trash / pencil / check / x / panel / grip / doc / info / cube / link など。本番は既存アイコンライブラリ（lucide 等）への置換可。

---

## API（バックエンド連携）

プロトタイプはメモリ完結ですが、本番は `design/Specs UI.html` 内に埋め込まれた各 `api.yaml`
（特に **Specs Management API**）が正の契約です。主要エンドポイント:

- `GET /api/specs` — 一覧
- `GET /api/specs/{id}` — 詳細（`{ spec, content }`）
- `PUT /api/specs/{id}` — 更新（api.yaml は OpenAPI 検証後に保存）
- `DELETE /api/specs/{id}` — 削除
- `POST /api/features` — feature 作成（spec.md / api.yaml 生成）
- `POST /api/features/{feature}/screens` — 画面作成（S-00n 採番）
- `PUT /api/features/{feature}/screens/order` — 画面並び替え（order 更新）

`{id}` は specs/ からの相対パス。**パストラバーサル禁止**、管理対象ルート配下かつ `.md`/`.yaml` のみ受理。

---

## 改善提案（現状 IA への指摘）

1. **frontmatter の右レール化**（実装済み）: 本文冒頭の frontmatter は読み飛ばされがちなので、
   右「情報」パネルに移設。本文は H1 から始まり読書体験が途切れません。
2. **サイドバー検索の実装**: UI は配置済みだが未配線。title + パスの前方一致で十分。
3. **関連（related）のグラフ化**: 用語/モデル/feature 間の `related` を双方向リンク化すると回遊性が上がる。
4. **画面数バッジ**: feature ノードに画面数を添えると俯瞰しやすい。

---

## ファイル一覧（`design/`）

| ファイル | 内容 |
|---|---|
| `Specs UI.html` | エントリ。各仕様ファイル本文を `<script type="text/plain">` で埋め込み + ライブラリ読込 |
| `styles.css` | **全デザイントークン + 全コンポーネントスタイル**（実装の正） |
| `app.jsx` | メインアプリ（App / TopBar / Sidebar / Disclosure / Main / InfoPanel / CreateModal / 生成テンプレ） |
| `lib.jsx` | アイコン / type バッジ / frontmatter メタ / Markdown + mermaid レンダラ |
| `openapi.jsx` | OpenAPI 軽量ビュー（Operation / SchemaCard / `$ref` 解決） |
| `data.js` | SPECS メタ配列 / FEATURE_ORDER / CREATE_COPY / parseFront / getRaw |
| `tweaks-panel.jsx` | プロトタイプ用 Tweaks（**本番実装不要**。テーマ切替のみ残す） |

プロトタイプの動作確認は `Specs UI.html` をブラウザで開く（ビルド不要）。
