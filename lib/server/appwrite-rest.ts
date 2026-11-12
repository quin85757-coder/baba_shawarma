// A small replacement for the parts of node-appwrite this project uses.
// node-appwrite's network layer fails on Cloudflare Workers ("fetch failed"); plain fetch works.
// tsconfig.json points the name "node-appwrite" at this file, so server code needs no changes.

export class AppwriteException extends Error {
    code: number;
    type: string;
    constructor(message: string, code = 0, type = "") {
        super(message);
        this.name = "AppwriteException";
        this.code = code;
        this.type = type;
    }
}

function config() {
    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
    const key = process.env.APPWRITE_API_KEY;
    if (!endpoint || !project || !key) {
        throw new AppwriteException(
            "The server is missing its Appwrite settings (endpoint, project ID or API key).",
            500,
            "missing_config"
        );
    }
    return { endpoint: endpoint.replace(/\/+$/, ""), project, key };
}

async function call(method: string, path: string, opts: { body?: unknown; queries?: string[] } = {}): Promise<any> {
    const { endpoint, project, key } = config();

    let url = `${endpoint}${path}`;
    if (opts.queries?.length) {
        url += "?" + opts.queries.map((q) => `queries[]=${encodeURIComponent(q)}`).join("&");
    }

    let res: Response;
    try {
        res = await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json",
                "X-Appwrite-Project": project,
                "X-Appwrite-Key": key,
            },
            body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
            signal: AbortSignal.timeout(15000),
        });
    } catch (e: any) {
        throw new AppwriteException(`Could not reach Appwrite: ${e?.message ?? e}`, 0, "network");
    }

    if (res.status === 204) return null;

    const text = await res.text();
    let data: any = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {}

    if (!res.ok) {
        throw new AppwriteException(data?.message ?? `Appwrite error ${res.status}`, res.status, data?.type ?? "");
    }
    return data;
}

// ─── Queries, ids and permissions (same output as the official library) ───────
const q = (method: string, attribute?: string, values?: unknown) =>
    JSON.stringify({
        method,
        ...(attribute !== undefined ? { attribute } : {}),
        ...(values !== undefined ? { values: Array.isArray(values) ? values : [values] } : {}),
    });

export const Query = {
    equal: (a: string, v: unknown) => q("equal", a, v),
    notEqual: (a: string, v: unknown) => q("notEqual", a, v),
    lessThan: (a: string, v: unknown) => q("lessThan", a, v),
    lessThanEqual: (a: string, v: unknown) => q("lessThanEqual", a, v),
    greaterThan: (a: string, v: unknown) => q("greaterThan", a, v),
    greaterThanEqual: (a: string, v: unknown) => q("greaterThanEqual", a, v),
    search: (a: string, v: string) => q("search", a, v),
    isNull: (a: string) => q("isNull", a),
    isNotNull: (a: string) => q("isNotNull", a),
    orderAsc: (a: string) => q("orderAsc", a),
    orderDesc: (a: string) => q("orderDesc", a),
    limit: (n: number) => q("limit", undefined, n),
    offset: (n: number) => q("offset", undefined, n),
    cursorAfter: (id: string) => q("cursorAfter", undefined, id),
    cursorBefore: (id: string) => q("cursorBefore", undefined, id),
};

export const ID = {
    unique: () => "unique()",
    custom: (id: string) => id,
};

export const Role = {
    any: () => "any",
    guests: () => "guests",
    users: (status = "") => (status ? `users/${status}` : "users"),
    user: (id: string, status = "") => (status ? `user:${id}/${status}` : `user:${id}`),
    label: (label: string) => `label:${label}`,
    team: (id: string, role = "") => (role ? `team:${id}/${role}` : `team:${id}`),
};

export const Permission = {
    read: (role: string) => `read("${role}")`,
    write: (role: string) => `write("${role}")`,
    create: (role: string) => `create("${role}")`,
    update: (role: string) => `update("${role}")`,
    delete: (role: string) => `delete("${role}")`,
};

// ─── Database calls, with the same shape the server code already uses ─────────
type Params = Record<string, any>;

const docs = (p: Params) =>
    `/databases/${encodeURIComponent(p.databaseId)}/collections/${encodeURIComponent(p.collectionId)}/documents`;
const one = (p: Params) => `${docs(p)}/${encodeURIComponent(p.documentId)}`;

export const adminDb = {
    listDocuments: (p: Params): Promise<{ total: number; documents: any[] }> =>
        call("GET", docs(p), { queries: p.queries }),

    getDocument: (p: Params): Promise<any> => call("GET", one(p)),

    createDocument: (p: Params): Promise<any> =>
        call("POST", docs(p), {
            body: {
                documentId: p.documentId ?? "unique()",
                data: p.data ?? {},
                ...(p.permissions ? { permissions: p.permissions } : {}),
            },
        }),

    updateDocument: (p: Params): Promise<any> =>
        call("PATCH", one(p), {
            body: {
                data: p.data ?? {},
                ...(p.permissions ? { permissions: p.permissions } : {}),
            },
        }),

    deleteDocument: async (p: Params): Promise<void> => {
        await call("DELETE", one(p));
    },
};