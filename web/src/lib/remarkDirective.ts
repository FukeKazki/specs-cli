import { visit } from "unist-util-visit";

// remark-directive が生成する directive ノード (:::name / ::name / :name) を、
// react-markdown が描画できる hast 要素へ変換する。タグ名は `directive-<name>` に
// なり、属性 {id=… type=…} はそのまま props として渡る。
// 実体の描画は Markdown.tsx の components["directive-<name>"] が担う。
//
//   :::requirement{id=R-001 priority=must}  本文  :::   → コンテナ (囲み)
//   ::screen-ref{to=screens/S-001-login.md}            → リーフ (1行)
//   :badge[重要]{type=warn}                             → テキスト (インライン)
//
// 未対応の name でも一律 `directive-<name>` になるため、components 側に
// 用意が無ければ素の要素として描画される (壊れない)。
export function directiveToComponents() {
  return (tree: unknown) => {
    visit(tree as never, (node: never) => {
      const n = node as {
        type?: string;
        name?: string;
        attributes?: Record<string, string>;
        data?: { hName?: string; hProperties?: Record<string, unknown> };
      };
      if (
        n.type === "containerDirective" ||
        n.type === "leafDirective" ||
        n.type === "textDirective"
      ) {
        const data = n.data || (n.data = {});
        data.hName = `directive-${n.name}`;
        data.hProperties = { ...(n.attributes ?? {}) };
      }
    });
  };
}
