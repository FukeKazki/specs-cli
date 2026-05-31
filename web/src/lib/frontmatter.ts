// frontmatter (先頭の --- ... ---) を軽量にパースする。
// key: value と "- item" 形式のリストに対応する (data.js の parseFront 相当)。
export type Front = Record<string, string | string[]>;

export function parseFront(raw: string): { front: Front; body: string } {
  const normalized = raw.replace(/\r\n/g, "\n");
  const m = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { front: {}, body: normalized };
  const body = normalized.slice(m[0].length);
  const front: Front = {};
  const lines = m[1].split("\n");
  let curKey: string | null = null;
  for (const ln of lines) {
    if (/^\s*-\s+/.test(ln) && curKey) {
      const arr = Array.isArray(front[curKey]) ? (front[curKey] as string[]) : (front[curKey] = []);
      arr.push(ln.replace(/^\s*-\s+/, "").trim());
      continue;
    }
    const kv = ln.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (kv) {
      curKey = kv[1];
      const val = kv[2].trim();
      front[curKey] = val === "" ? [] : val;
    }
  }
  return { front, body };
}

// body 内の行番号を元ファイル (frontmatter 込み) の行番号に変換するオフセット。
export function lineOffset(src: string, body: string): number {
  const normalized = src.replace(/\r\n/g, "\n");
  return normalized.slice(0, normalized.length - body.length).split("\n").length - 1;
}

// dotted id (例 feature.x / domain.glossary.用語 / feature.x.screen.S-001) を
// specs/ 相対パス id へ変換する。解決できない場合は null。
export function dottedToPath(ref: string): string | null {
  const parts = ref.split(".");
  if (ref.startsWith("feature.")) {
    // feature.<name>.screen.<S-00n>
    const si = parts.indexOf("screen");
    if (si > 0 && parts[si + 1]) {
      const name = parts.slice(1, si).join(".");
      return `features/${name}/screens/${parts[si + 1]}.md`;
    }
    const name = parts.slice(1).join(".");
    return `features/${name}/spec.md`;
  }
  if (ref.startsWith("domain.glossary.")) return `domain/glossary/${parts.slice(2).join(".")}.md`;
  if (ref.startsWith("domain.models.")) return `domain/models/${parts.slice(2).join(".")}.md`;
  if (ref.startsWith("product.")) return `product/${parts.slice(1).join(".")}.md`;
  return null;
}
