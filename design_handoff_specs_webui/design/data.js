/* ============================================================
   specs — data layer
   - SPECS: flat metadata list (sidebar uses this)
   - getRaw(id): full file text, read from <script type="text/plain"> blocks
   - parseFront(raw): { front: {...}, body: "..." }
   ============================================================ */
(function () {
  // Flat list — sidebar grouping/ordering is derived in app.jsx.
  // order matters only inside a feature's Screens.
  window.SPECS = [
    // ---- Product ----
    { id: "product/vision.md",      type: "product", file: "vision.md",     title: "Vision",             status: "draft" },
    { id: "product/principles.md",  type: "product", file: "principles.md", title: "Product Principles", status: "draft" },

    // ---- Domain · Ubiquitous Language (terms) ----
    { id: "domain/glossary/仕様書.md",       type: "term", file: "仕様書.md",       title: "仕様書",       status: "draft" },
    { id: "domain/glossary/ページ仕様書.md", type: "term", file: "ページ仕様書.md", title: "ページ仕様書", status: "draft" },

    // ---- Domain · Models ----
    { id: "domain/models/Feature.md", type: "model", file: "Feature.md", title: "Feature", status: "draft" },
    { id: "domain/models/Screen.md",  type: "model", file: "Screen.md",  title: "Screen",  status: "draft" },
    { id: "domain/models/Spec.md",    type: "model", file: "Spec.md",    title: "Spec",    status: "draft" },

    // ---- feature: domain-management ----
    { id: "features/domain-management/spec.md", type: "feature", feature: "domain-management", file: "spec.md",  title: "Feature: Domain Management", status: "draft" },
    { id: "features/domain-management/api.yaml", type: "api",    feature: "domain-management", file: "api.yaml", title: "Domain Management API",      status: "draft" },
    { id: "features/domain-management/screens/S-001.md", type: "screen", feature: "domain-management", file: "S-001.md", title: "ユビキタス言語一覧画面", status: "draft", number: "S-001", order: 1 },
    { id: "features/domain-management/screens/S-002.md", type: "screen", feature: "domain-management", file: "S-002.md", title: "モデル一覧画面",         status: "draft", number: "S-002", order: 2 },

    // ---- feature: product ----
    { id: "features/product/spec.md",  type: "feature", feature: "product", file: "spec.md",  title: "Feature: Product", status: "draft" },
    { id: "features/product/api.yaml", type: "api",     feature: "product", file: "api.yaml", title: "Product API",      status: "draft" },
    { id: "features/product/screens/S-001.md", type: "screen", feature: "product", file: "S-001.md", title: "ビジョン画面",     status: "draft", number: "S-001", order: 1 },
    { id: "features/product/screens/S-002.md", type: "screen", feature: "product", file: "S-002.md", title: "プリンシパル画面", status: "draft", number: "S-002", order: 2 },

    // ---- feature: specs-management ----
    { id: "features/specs-management/spec.md",  type: "feature", feature: "specs-management", file: "spec.md",  title: "Feature: Specs Management", status: "draft" },
    { id: "features/specs-management/api.yaml", type: "api",     feature: "specs-management", file: "api.yaml", title: "Specs Management API",      status: "draft" },
    { id: "features/specs-management/screens/S-001.md", type: "screen", feature: "specs-management", file: "S-001.md", title: "仕様書一覧画面", status: "draft", number: "S-001", order: 1 },
    { id: "features/specs-management/screens/S-002.md", type: "screen", feature: "specs-management", file: "S-002.md", title: "仕様書詳細画面", status: "draft", number: "S-002", order: 2 },
  ];

  window.FEATURE_ORDER = ["domain-management", "product", "specs-management"];

  // create-modal copy (real data from the brief)
  window.CREATE_COPY = {
    feature: { title: "新規 feature",  hint: "英数字 . _ - が使えます。spec.md と api.yaml が生成されます。", placeholder: "feature 名 (例: user-login)", files: ["spec.md", "api.yaml"] },
    screen:  { title: "画面を追加",    hint: "画面名を入力。S-00n が自動採番され screens/ に生成されます。", placeholder: "画面名 (例: ログイン画面)", files: ["screens/S-00n.md"] },
    term:    { title: "用語を追加",    hint: "ユビキタス言語を domain/glossary/ に作成します。",          placeholder: "用語名 (例: 仕様書)",        files: ["domain/glossary/<name>.md"] },
    model:   { title: "モデルを追加",  hint: "mermaid 記法のモデルを domain/models/ に作成します。",       placeholder: "モデル名 (例: User)",         files: ["domain/models/<name>.md"] },
  };

  // read raw file content from the embedded <script type="text/plain"> blocks
  window.getRaw = function (id) {
    var el = document.getElementById("spec:" + id);
    if (!el) return "";
    // textContent preserves the literal text; trim one leading newline
    return el.textContent.replace(/^\n/, "").replace(/\s+$/, "") + "\n";
  };

  // minimal YAML-frontmatter splitter (key: value, list items)
  window.parseFront = function (raw) {
    var m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!m) return { front: {}, body: raw };
    var body = raw.slice(m[0].length);
    var front = {};
    var lines = m[1].split("\n");
    var curKey = null;
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (/^\s*-\s+/.test(ln) && curKey) {
        if (!Array.isArray(front[curKey])) front[curKey] = [];
        front[curKey].push(ln.replace(/^\s*-\s+/, "").trim());
        continue;
      }
      var kv = ln.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
      if (kv) {
        curKey = kv[1];
        var val = kv[2].trim();
        front[curKey] = val === "" ? [] : val;
      }
    }
    return { front: front, body: body };
  };

  window.specById = function (id) {
    return window.SPECS.find(function (s) { return s.id === id; });
  };
})();
