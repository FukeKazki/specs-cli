// Go の store.Spec に対応する。
export interface Spec {
  id: string;
  feature: string;
  file: string;
  type: string; // "feature" | "api" | "screen"
  title: string;
  status: string;
  order: number;
}

export interface SpecDetail {
  spec: Spec;
  content: string;
}
