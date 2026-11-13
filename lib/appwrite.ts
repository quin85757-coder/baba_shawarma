import { Account, Client, Databases, ID, Query } from "appwrite";

export const appwriteConfig = {
  databaseId: "699faaaa00273107e6fa",
  userCollectionId: "users",
  categoriesCollectionId: "categories",
  menuCollectionId: "menu",
  ordersCollectionId: "orders",
  orderItemsCollectionId: "order_items",
  favoritesCollectionId: "favorites",
};

export const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

export const account = new Account(client);
export const databases = new Databases(client);
export { ID, Query };

export interface AppUser {
  $id: string;
  name: string;
  email: string;
  avatar?: string;
  avatar_public_id?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  role?: string;
  accountId: string;
  onboarded?: boolean;
}

// Calls our own server with the signed-in user's JWT attached
// Appwrite limits how often a JWT can be created, so reuse one for 10 minutes (they last 15)
let jwtCache: { jwt: string; at: number } | null = null;

async function getJwt(force = false) {
  if (!force && jwtCache && Date.now() - jwtCache.at < 10 * 60 * 1000) return jwtCache.jwt;
  const { jwt } = await account.createJWT();
  jwtCache = { jwt, at: Date.now() };
  return jwt;
}

export async function apiPost<T = any>(path: string, body: Record<string, any> = {}): Promise<T> {
  const send = (jwt: string) =>
    fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt, ...body }),
    });

  let res = await send(await getJwt());
  if (res.status === 401) res = await send(await getJwt(true)); // token expired or session changed

  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) throw new Error(data?.error ?? "Request failed");
  return data as T;
}

export const signIn = async (email: string, password: string) => {
  let jwtCache: { jwt: string; at: number } | null = null;

  async function getJwt(force = false) {
    if (!force && jwtCache && Date.now() - jwtCache.at < 10 * 60 * 1000) return jwtCache.jwt;
    const { jwt } = await account.createJWT();
    jwtCache = { jwt, at: Date.now() };
    return jwt;
  }

  await account.createEmailPasswordSession({ email, password });
};

export const signUp = async (name: string, email: string, password: string) => {
  await account.create({ userId: ID.unique(), email, password, name });
  await signIn(email, password);
  const res = await apiPost<{ user: AppUser }>("/api/profile/create", { name });
  return res.user;
};

export const signOut = async () => {
  let jwtCache: { jwt: string; at: number } | null = null;

  async function getJwt(force = false) {
    if (!force && jwtCache && Date.now() - jwtCache.at < 10 * 60 * 1000) return jwtCache.jwt;
    const { jwt } = await account.createJWT();
    jwtCache = { jwt, at: Date.now() };
    return jwt;
  }

  try {
    await account.deleteSession({ sessionId: "current" });
  } catch {}
};

export const getCurrentUser = async (): Promise<AppUser | null> => {
  try {
    const acc = await account.get();

    const find = async () => {
      const res = await databases.listDocuments({
        databaseId: appwriteConfig.databaseId,
        collectionId: appwriteConfig.userCollectionId,
        queries: [Query.equal("accountId", acc.$id)],
      });
      return res.documents[0] as unknown as AppUser | undefined;
    };

    let user = await find();
    if (!user) {
      // Signed up, but the profile row is missing (e.g. the server was down). Create it now.
      await apiPost("/api/profile/create", {});
      user = await find();
    }
    return user ?? null;
  } catch {
    return null;
  }
};

// docId is kept so existing callers still compile. The server edits the caller's own row.
export const updateUserProfile = async (_docId: string, data: Record<string, string>) => {
  const res = await apiPost<{ user: AppUser }>("/api/profile/update", data);
  return res.user;
};