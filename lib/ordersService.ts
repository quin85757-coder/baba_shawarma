import { appwriteConfig, databases, ID, Query } from "@/lib/appwrite";

const db = appwriteConfig.databaseId;

// ─── Menu ─────────────────────────────────────────────────────────────────────

export const getCategories = async () => {
  const res = await databases.listDocuments({
    databaseId: db,
    collectionId: appwriteConfig.categoriesCollectionId,
  });
  return res.documents;
};

export const getMenu = async (opts: { category?: string; search?: string; limit?: number } = {}) => {
  const queries: string[] = [Query.limit(opts.limit ?? 100)];
  if (opts.category) queries.push(Query.equal("category_name", opts.category));
  if (opts.search?.trim()) queries.push(Query.search("name", opts.search.trim()));

  const res = await databases.listDocuments({
    databaseId: db,
    collectionId: appwriteConfig.menuCollectionId,
    queries,
  });
  return res.documents;
};

export interface MenuSize {
  $id: string;
  label: string;
  price: number;
}

export const getSizes = async (menuId: string): Promise<MenuSize[]> => {
  const res = await databases.listDocuments({
    databaseId: db,
    collectionId: "size",
    queries: [Query.equal("menu", menuId), Query.limit(50)],
  });
  return (res.documents as any[])
      .map((s) => ({ $id: s.$id, label: String(s.label), price: Number(s.price) }))
      .sort((a, b) => a.price - b.price);
};

// ─── Orders ───────────────────────────────────────────────────────────────────

export const getUserOrders = async (userId: string) => {
  const res = await databases.listDocuments({
    databaseId: db,
    collectionId: appwriteConfig.ordersCollectionId,
    queries: [
      Query.equal("userId", userId),
      Query.notEqual("status", "awaiting_payment"),
      Query.orderDesc("$createdAt"),
      Query.limit(50),
    ],
  });
  return res.documents;
};

// ─── Favourites ───────────────────────────────────────────────────────────────

export interface Favorite {
  $id: string;
  menuId: string;
  menuName: string;
  categoryName: string;
  price: number;
  image_url: string;
  rating?: number;
}

export const getUserFavorites = async (userId: string): Promise<Favorite[]> => {
  const res = await databases.listDocuments({
    databaseId: db,
    collectionId: appwriteConfig.favoritesCollectionId,
    queries: [Query.equal("userId", userId), Query.orderDesc("$createdAt"), Query.limit(100)],
  });
  return res.documents as unknown as Favorite[];
};

export const addFavorite = async (
    userId: string,
    m: { menuId: string; menuName: string; categoryName: string; price: number; image_url: string; rating?: number }
) => {
  return databases.createDocument({
    databaseId: db,
    collectionId: appwriteConfig.favoritesCollectionId,
    documentId: ID.unique(),
    data: {
      userId,
      menuId: m.menuId,
      menuName: m.menuName,
      categoryName: m.categoryName,
      price: m.price,
      image_url: m.image_url,
      ...(m.rating ? { rating: m.rating } : {}),
    },
  });
};

export const removeFavorite = async (favoriteId: string) => {
  await databases.deleteDocument({
    databaseId: db,
    collectionId: appwriteConfig.favoritesCollectionId,
    documentId: favoriteId,
  });
};

export const clearFavorites = async (userId: string) => {
  const favs = await getUserFavorites(userId);
  await Promise.all(favs.map((f) => removeFavorite(f.$id)));
};