import { Client, Databases, ID, Users } from "node-appwrite";

const [, , name, email, password, phone, vehicle = ""] = process.argv;

if (!name || !email || !password || !phone) {
  console.log('Usage: node --env-file=.env.local scripts/create-driver.mjs "Name" email password phone [vehicle]');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_ADMIN_KEY);

const users = new Users(client);
const db = new Databases(client);

const userId = ID.unique();
await users.create({ userId, email, password, name });
await users.updateLabels({ userId, labels: ["driver"] });

await db.createDocument({
  databaseId: "699faaaa00273107e6fa",
  collectionId: "drivers",
  documentId: userId, // the driver row ID is the account ID
  data: { name, phone, accountId: userId, vehicle, active: true, isOnline: false },
  permissions: [],
});

console.log(`Driver created: ${name} <${email}> (id ${userId})`);