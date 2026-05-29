import type { Spec, SpecDetail } from "./types";

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opt: RequestInit = { method, headers: {} };
  if (body !== undefined) {
    opt.headers = { "Content-Type": "application/json" };
    opt.body = JSON.stringify(body);
  }
  const res = await fetch(path, opt);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}

export const api = {
  list: () => req<{ specs: Spec[] }>("GET", "/api/specs").then((d) => d.specs ?? []),
  get: (id: string) => req<SpecDetail>("GET", `/api/specs/${id}`),
  update: (id: string, content: string) => req<{ ok: boolean }>("PUT", `/api/specs/${id}`, { content }),
  remove: (id: string) => req<{ ok: boolean }>("DELETE", `/api/specs/${id}`),
  createFeature: (name: string) => req<{ created: string[] }>("POST", "/api/features", { name }),
  createScreen: (feature: string, name: string) =>
    req<{ created: string }>("POST", `/api/features/${encodeURIComponent(feature)}/screens`, { name }),
  reorderScreens: (feature: string, order: string[]) =>
    req<{ ok: boolean }>("PUT", `/api/features/${encodeURIComponent(feature)}/screens/order`, { order }),
  createTerm: (name: string) => req<{ created: string }>("POST", "/api/domain/terms", { name }),
  createModel: (name: string) => req<{ created: string }>("POST", "/api/domain/models", { name }),
};
