import { create } from "zustand";
import { account, AppUser, getCurrentUser, signOut } from "@/lib/appwrite";

interface AuthState {
  user: AppUser | null;
  isStaff: boolean;
  isAdmin: boolean;
  isDriver: boolean;
  loading: boolean;
  fetchUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isStaff: false,
  isAdmin: false,
  isDriver: false,
  loading: true,

  fetchUser: async () => {
    const user = await getCurrentUser();
    let labels: string[] = [];
    if (user) {
      try {
        labels = (await account.get()).labels ?? [];
      } catch {}
    }
    set({
      user,
      isAdmin: labels.includes("admin"),
      isStaff: labels.includes("staff") || labels.includes("admin"),
      isDriver: labels.includes("driver"),
      loading: false,
    });
  },

  logout: async () => {
    await signOut();
    set({ user: null, isStaff: false, isAdmin: false, isDriver: false });
  },
}));