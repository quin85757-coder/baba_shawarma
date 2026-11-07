import { Client, Databases } from "node-appwrite";

let cached: Databases | null = null;

// Created on first use, not at import time, so building the site never needs the secret key
function getDb(): Databases {
  if (!cached) {
    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
    const key = process.env.APPWRITE_API_KEY;
    if (!endpoint || !project || !key) {
      throw new Error("The server is missing its Appwrite settings (endpoint, project ID or API key).");
    }
    cached = new Databases(new Client().setEndpoint(endpoint).setProject(project).setKey(key));
  }
  return cached;
}

// Behaves like a Databases object, but only connects when first used
export const adminDb = new Proxy({} as Databases, {
  get(_target, prop) {
    const db: any = getDb();
    const value = db[prop];
    return typeof value === "function" ? value.bind(db) : value;
  },
});

export const DB = {
  database: "699faaaa00273107e6fa",
  users: "users",
  menu: "menu",
  orders: "orders",
  orderItems: "order_items",
};