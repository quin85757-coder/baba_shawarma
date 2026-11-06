import { Client, Databases, Permission, Query, Role } from "node-appwrite";

const db = new Databases(
  new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY)
);

const DATABASE_ID = "699faaaa00273107e6fa";
const TABLE = "users";

let cursor = null;
let done = 0;

while (true) {
  const queries = [Query.limit(100)];
  if (cursor) queries.push(Query.cursorAfter(cursor));

  const page = await db.listDocuments({ databaseId: DATABASE_ID, collectionId: TABLE, queries });
  if (page.documents.length === 0) break;

  for (const doc of page.documents) {
    if (!doc.accountId) {
      console.warn(`skipped ${doc.$id}: no accountId`);
      continue;
    }
    // Owner keeps READ only. Their old update/delete rights are removed.
    await db.updateDocument({
      databaseId: DATABASE_ID,
      collectionId: TABLE,
      documentId: doc.$id,
      permissions: [Permission.read(Role.user(doc.accountId))],
    });
    done++;
    console.log(`locked ${doc.$id} (${doc.email})`);
  }

  cursor = page.documents[page.documents.length - 1].$id;
}

console.log(`Done. ${done} profile rows are now read-only for their owners.`);