"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { AI_BASE } from "@/lib/booknestAi";

export type AuthUser = {
  id: number;
  email: string;
  name: string;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name?: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  hydrate: () => void;
};

const LOCAL_USERS_KEY = "booknest-local-users-v1";

type LocalUser = AuthUser & { password: string };

function readLocalUsers(): LocalUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalUsers(list: LocalUser[]) {
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(list));
  } catch {
    /* quota */
  }
}

function makeLocalToken(user: AuthUser) {
  return `local_${user.id}_${Date.now()}`;
}

async function tryBackend(
  path: string,
  body: Record<string, unknown>
): Promise<{ token: string; user: AuthUser } | null> {
  try {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const base = AI_BASE.replace(/\/$/, "");
    const url =
      normalizedPath.startsWith("/auth/") || normalizedPath.startsWith("/api/")
        ? `${base}${normalizedPath.startsWith("/api/") ? normalizedPath : `/api/v1${normalizedPath}`}`
        : `${base}${normalizedPath}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        (data as { detail?: string; message?: string }).detail ||
        (data as { message?: string }).message ||
        res.statusText;
      throw new Error(String(msg));
    }
    const payload = (data as { data?: Record<string, unknown> }).data || data;
    const token = String(
      (payload as { access_token?: string }).access_token ||
        (payload as { token?: string }).token ||
        ""
    );
    const id = Number((payload as { customer_id?: number }).customer_id || (payload as { id?: number }).id || 0);
    const email = String((payload as { email?: string }).email || body.email || "");
    const name = String((payload as { name?: string }).name || email.split("@")[0] || "Bạn đọc");
    if (!token || !id) throw new Error("Phản hồi đăng nhập không hợp lệ.");
    return { token, user: { id, email, name } };
  } catch (e) {
    // Network failure -> caller may fallback to local
    if ((e as Error).message && /Failed to fetch|NetworkError|Load failed/i.test((e as Error).message)) {
      return null;
    }
    throw e;
  }
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      loading: false,
      error: "",
      clearError: () => set({ error: "" }),
      hydrate: () => {
        const { token, user } = get();
        set({ isAuthenticated: !!token && !!user });
      },
      logout: () => set({ token: null, user: null, isAuthenticated: false, error: "" }),
      login: async (email, password) => {
        const e = email.trim().toLowerCase();
        const p = password.trim();
        if (!e || !p) {
          set({ error: "Vui lòng nhập email và mật khẩu." });
          return false;
        }
        set({ loading: true, error: "" });
        // 1) Try backend
        try {
          const backend = await tryBackend("/auth/login", { email: e, password: p });
          if (backend) {
            set({ token: backend.token, user: backend.user, isAuthenticated: true, loading: false });
            return true;
          }
        } catch (err) {
          const msg = (err as Error).message;
          // Auth error from backend (401) — surface directly, don't fallback
          if (/không đúng|Email.*đã|Unauthorized|401/i.test(msg)) {
            set({ loading: false, error: msg });
            return false;
          }
          // Other backend error -> fallback to local below
        }

        // 2) Local fallback (offline demo / backend not running)
        const users = readLocalUsers();
        const found = users.find((u) => u.email.toLowerCase() === e && u.password === p);
        if (!found) {
          set({
            loading: false,
            error: "Email hoặc mật khẩu không đúng. Nếu chưa có tài khoản, hãy đăng ký.",
          });
          return false;
        }
        set({
          token: makeLocalToken(found),
          user: { id: found.id, email: found.email, name: found.name },
          isAuthenticated: true,
          loading: false,
        });
        return true;
      },
      register: async (email, password, name) => {
        const e = email.trim().toLowerCase();
        const p = password.trim();
        const n = (name || "").trim() || e.split("@")[0];
        if (!e || !p) {
          set({ error: "Vui lòng nhập email và mật khẩu." });
          return false;
        }
        if (p.length < 6) {
          set({ error: "Mật khẩu tối thiểu 6 ký tự." });
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
          set({ error: "Email không hợp lệ." });
          return false;
        }
        set({ loading: true, error: "" });

        // 1) Try backend
        try {
          const backend = await tryBackend("/auth/register", { email: e, password: p, name: n, language: "vi" });
          if (backend) {
            set({ token: backend.token, user: backend.user, isAuthenticated: true, loading: false });
            return true;
          }
        } catch (err) {
          const msg = (err as Error).message;
          if (/đã được đăng ký|Email.*đã/i.test(msg)) {
            set({ loading: false, error: msg });
            return false;
          }
          if (/Failed to fetch|NetworkError/i.test(msg)) {
            // fall through to local
          } else if (msg && !/Failed to fetch/i.test(msg)) {
            // Unknown backend error — still try local but surface if local also fails
          }
        }

        // 2) Local fallback
        const users = readLocalUsers();
        if (users.some((u) => u.email.toLowerCase() === e)) {
          set({ loading: false, error: "Email đã được đăng ký (bản offline)." });
          return false;
        }
        const id = users.reduce((m, u) => Math.max(m, u.id), 1000) + 1;
        const nu: LocalUser = { id, email: e, name: n, password: p };
        writeLocalUsers([...users, nu]);
        set({
          token: makeLocalToken(nu),
          user: { id, email: e, name: n },
          isAuthenticated: true,
          loading: false,
        });
        return true;
      },
    }),
    {
      name: "booknest-auth-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ token: s.token, user: s.user, isAuthenticated: s.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrate();
      },
    }
  )
);
