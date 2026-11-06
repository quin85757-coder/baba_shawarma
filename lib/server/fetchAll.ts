import { Query } from "node-appwrite";
import { adminDb, DB } from "@/lib/server/appwrite-admin";

// Reads a table 100 rows at a time, up to `cap` rows
export async function fetchAll(collectionId: string, base: string[], cap = 1000): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | undefined;

  while (out.length < cap) {
    const queries = [...base, Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    const res = await adminDb.listDocuments({
      databaseId: DB.database,
      collectionId,
      queries,
    });
    out.push(...res.documents);
    if (res.documents.length < 100) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return out;
}