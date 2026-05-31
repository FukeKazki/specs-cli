import { useMemo, useState } from "react";
import { parse } from "yaml";
import { Icon } from "./ui";

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function refName(ref?: string): string {
  return ref ? ref.split("/").pop() ?? "" : "";
}
function resolveRef(ref: string | undefined, root: Any): Any {
  if (!ref || !ref.startsWith("#/")) return null;
  return ref.slice(2).split("/").reduce((o: Any, k) => (o ? o[k] : null), root);
}

// short human label for a schema node
function schemaLabel(schema: Any): string {
  if (!schema) return "—";
  if (schema.$ref) return refName(schema.$ref);
  if (schema.type === "array") {
    const it = schema.items || {};
    return "array<" + (it.$ref ? refName(it.$ref) : it.type || "object") + ">";
  }
  if (schema.enum) return schema.type || "string";
  return schema.type || "object";
}

interface FieldRow {
  name: string;
  required: boolean;
  label: string;
  enum: Any[] | null;
}

// flatten an object schema into displayable field rows
function fieldRows(schema: Any, root: Any): FieldRow[] {
  let s = schema;
  if (s && s.$ref) s = resolveRef(s.$ref, root) || s;
  if (!s || !s.properties) return [];
  const req: string[] = s.required || [];
  return Object.keys(s.properties).map((name) => {
    const p = s.properties[name];
    return { name, required: req.includes(name), label: schemaLabel(p), enum: p && p.enum ? p.enum : null };
  });
}

/* ---------- one operation card ---------- */
function Operation({
  method,
  path,
  op,
  root,
  defaultOpen,
}: {
  method: string;
  path: string;
  op: Any;
  root: Any;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const params = (op.parameters || []).map((p: Any) => (p.$ref ? resolveRef(p.$ref, root) : p)).filter(Boolean);

  let reqBody: { required: boolean; schema: Any; rows: FieldRow[] } | null = null;
  if (op.requestBody) {
    const rb = op.requestBody.$ref ? resolveRef(op.requestBody.$ref, root) : op.requestBody;
    const schema = rb?.content?.["application/json"]?.schema;
    reqBody = { required: !!rb?.required, schema, rows: fieldRows(schema, root) };
  }

  const responses = Object.keys(op.responses || {}).map((code) => {
    let r = op.responses[code];
    if (r.$ref) r = resolveRef(r.$ref, root) || r;
    const schema = r?.content?.["application/json"]?.schema;
    return { code, desc: r?.description, schema };
  });

  const pathParts = path.split(/(\{[^}]+\})/g).filter(Boolean);

  return (
    <div className={"op" + (open ? " open" : "")}>
      <div className="op-head" onClick={() => setOpen(!open)}>
        <span className={"method " + method}>{method.toUpperCase()}</span>
        <span className="op-path">
          {pathParts.map((p, i) =>
            p.startsWith("{") ? (
              <span className="pvar" key={i}>
                {p}
              </span>
            ) : (
              <span key={i}>{p}</span>
            ),
          )}
        </span>
        <span className="op-summary">{op.summary || ""}</span>
        <Icon name="chevron" size={15} className="op-caret" />
      </div>
      {open && (
        <div className="op-body">
          {op.operationId && (
            <div className="op-meta">
              operationId: <span className="op-opid">{op.operationId}</span>
            </div>
          )}
          {op.description && <p className="op-desc">{op.description}</p>}

          {!!params.length && (
            <>
              <div className="subhead">Parameters</div>
              <table className="params-table">
                <thead>
                  <tr>
                    <th>name</th>
                    <th>in</th>
                    <th>type</th>
                    <th>required</th>
                    <th>description</th>
                  </tr>
                </thead>
                <tbody>
                  {params.map((p: Any, i: number) => (
                    <tr key={i}>
                      <td>
                        <span className="mono">{p.name}</span>
                      </td>
                      <td>
                        <span className="type-chip">{p.in}</span>
                      </td>
                      <td className="mono desc">{schemaLabel(p.schema)}</td>
                      <td>{p.required ? <span className="req">required</span> : <span className="dash">—</span>}</td>
                      <td className="desc">{p.description || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {reqBody && reqBody.schema && (
            <>
              <div className="subhead">
                Request body {reqBody.required && <span className="req">required</span>}
              </div>
              {reqBody.rows.length ? (
                <div className="schema-card" style={{ marginTop: 4 }}>
                  {reqBody.rows.map((f, i) => (
                    <div className="field-row" key={i}>
                      <span className="fname">
                        {f.name}
                        {f.required && <span className="req">*</span>}
                      </span>
                      <span className="ftype">{f.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="type-chip">{schemaLabel(reqBody.schema)}</span>
              )}
            </>
          )}

          {!!responses.length && (
            <>
              <div className="subhead">Responses</div>
              <div>
                {responses.map((r, i) => (
                  <div className="resp-row" key={i}>
                    <span className={"status-code s" + r.code[0]}>{r.code}</span>
                    <div>
                      <div className="resp-desc">{r.desc || ""}</div>
                      {r.schema && <div className="resp-schema">→ {schemaLabel(r.schema)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- schema card ---------- */
function SchemaCard({ name, schema, root }: { name: string; schema: Any; root: Any }) {
  const rows = fieldRows(schema, root);
  return (
    <div className="schema-card">
      <div className="sc-head">
        <span className="sc-name">{name}</span>
        <span className="sc-type">{schema.type || "object"}</span>
      </div>
      {rows.length ? (
        rows.map((f, i) => (
          <div className="field-row" key={i}>
            <span className="fname">
              {f.name}
              {f.required && <span className="req">*</span>}
              {f.enum && f.enum.map((e, j) => (
                <span className="enum-chip" key={j}>
                  {String(e)}
                </span>
              ))}
            </span>
            <span className="ftype">{f.label}</span>
          </div>
        ))
      ) : (
        <div className="field-row">
          <span className="dash">—</span>
        </div>
      )}
    </div>
  );
}

// OpenAPI(YAML) を軽量に整形表示する (paths / operations / schemas)。
export function OpenApiView({ content }: { content: string }) {
  const parsed = useMemo(() => {
    try {
      return { doc: parse(content) as Any, error: null as string | null };
    } catch (e) {
      return { doc: null, error: (e as Error).message };
    }
  }, [content]);

  if (parsed.error) {
    return (
      <div className="editor-err" style={{ maxWidth: 700 }}>
        YAML parse error:{"\n"}
        {parsed.error}
      </div>
    );
  }

  const doc = parsed.doc || {};
  const info = doc.info || {};
  const paths = doc.paths || {};
  const schemas = doc.components?.schemas || {};

  const ops: { path: string; method: string; op: Any }[] = [];
  Object.keys(paths).forEach((p) => {
    const item = paths[p];
    METHODS.forEach((m) => {
      if (item[m]) ops.push({ path: p, method: m, op: item[m] });
    });
  });

  const servers: Any[] = doc.servers || [];

  return (
    <div className="oai">
      <div className="oai-hero">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="title">{info.title || "API"}</span>
          {info.version && <span className="ver">v{info.version}</span>}
          <span
            className="ver"
            style={{ color: "var(--m-get)", borderColor: "color-mix(in oklch, var(--m-get) 30%, var(--border))" }}
          >
            OpenAPI {doc.openapi || "3.1.0"}
          </span>
        </div>
        {info.description && <div className="desc">{String(info.description).trim()}</div>}
        {!!servers.length && (
          <div className="servers">
            {servers.map((s, i) => (
              <span className="server" key={i}>
                <span className="k">base</span> {s.url}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="oai-section-label">Paths · {ops.length} operations</div>
      {ops.map((o, i) => (
        <Operation key={i} {...o} root={doc} defaultOpen={i === 0} />
      ))}

      {!!Object.keys(schemas).length && (
        <>
          <div className="oai-section-label" style={{ marginTop: 30 }}>
            Schemas · {Object.keys(schemas).length}
          </div>
          {Object.keys(schemas).map((name) => (
            <SchemaCard key={name} name={name} schema={schemas[name]} root={doc} />
          ))}
        </>
      )}
    </div>
  );
}
