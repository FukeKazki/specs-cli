import { parse } from "yaml";

const METHODS = ["get", "post", "put", "patch", "delete", "head", "options", "trace"] as const;

interface Operation {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: { name?: string; in?: string; required?: boolean }[];
  responses?: Record<string, { description?: string }>;
}

interface OpenApiDoc {
  openapi?: string;
  info?: { title?: string; version?: string; description?: string };
  servers?: { url?: string; description?: string }[];
  paths?: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, unknown> };
}

// OpenAPI(YAML) を軽量に整形表示する (paths / operations / schemas の概要)。
export function OpenApiView({ content }: { content: string }) {
  let doc: OpenApiDoc;
  try {
    doc = parse(content) as OpenApiDoc;
    if (!doc || typeof doc !== "object") throw new Error("空のドキュメントです");
  } catch (e) {
    return (
      <div className="mermaid-error">
        <strong>YAML を解析できません</strong>
        <pre>{(e as Error).message}</pre>
      </div>
    );
  }

  const info = doc.info ?? {};
  const paths = doc.paths ?? {};
  const schemas = doc.components?.schemas ?? {};

  return (
    <div className="openapi">
      <div className="oas-head">
        <h1>{info.title ?? "API"}</h1>
        <span className="badge">OpenAPI {doc.openapi ?? "?"}</span>
        {info.version && <span className="badge">v{info.version}</span>}
      </div>
      {info.description && <p className="oas-desc">{info.description}</p>}

      {doc.servers && doc.servers.length > 0 && (
        <p className="oas-servers">
          Servers: {doc.servers.map((s) => s.url).filter(Boolean).join(", ")}
        </p>
      )}

      <h2>Paths</h2>
      {Object.keys(paths).length === 0 && <p className="empty">paths がありません</p>}
      {Object.entries(paths).map(([path, ops]) => (
        <div className="oas-path" key={path}>
          <code className="oas-pathname">{path}</code>
          {METHODS.filter((m) => ops[m]).map((m) => {
            const op = ops[m];
            return (
              <div className="oas-op" key={m}>
                <span className={`oas-method method-${m}`}>{m.toUpperCase()}</span>
                <div className="oas-op-body">
                  <div className="oas-summary">{op.summary || op.operationId || ""}</div>
                  {op.parameters && op.parameters.length > 0 && (
                    <div className="oas-params">
                      params:{" "}
                      {op.parameters
                        .map((p) => `${p.name}${p.required ? "*" : ""} (${p.in})`)
                        .join(", ")}
                    </div>
                  )}
                  {op.responses && (
                    <div className="oas-responses">
                      {Object.entries(op.responses).map(([code, r]) => (
                        <span className="oas-resp" key={code}>
                          {code} {r?.description ?? ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {Object.keys(schemas).length > 0 && (
        <>
          <h2>Schemas</h2>
          <ul className="oas-schemas">
            {Object.keys(schemas).map((name) => (
              <li key={name}>
                <code>{name}</code>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
