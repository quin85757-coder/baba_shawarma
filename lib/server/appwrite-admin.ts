import { Client, Databases } from "node-appwrite";

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);

export const adminDb = new Databases(client);

export const DB = {
    database: "699faaaa00273107e6fa",
    users: "users",
    menu: "menu",
    orders: "orders",
    orderItems: "order_items",
};