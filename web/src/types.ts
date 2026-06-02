// Go の store.Spec に対応する。
export interface Spec {
  id: string;
  feature: string;
  file: string;
  type: string; // "product" | "feature" | "screen" | "requirement" | "term" | "model"
  title: string;
  status: string;
  order: number;
  priority?: string; // MoSCoW 優先度 (requirement)

  // 進捗管理 (project-management) の任意メタ。frontmatter が唯一の正。
  assignee?: string;
  start?: string; // YYYY-MM-DD
  due?: string; // YYYY-MM-DD
  dependsOn?: string[]; // specs/ 相対パス id の配列
}

// PATCH /api/specs/{id}/meta のリクエスト。省略フィールドは変更しない。
export interface SpecMeta {
  status?: string;
  assignee?: string;
  start?: string;
  due?: string;
  dependsOn?: string[];
}

export interface SpecDetail {
  spec: Spec;
  content: string;
}
