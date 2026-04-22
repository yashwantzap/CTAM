import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import type { AuthUser } from "@/lib/auth";

export function useCurrentUser() {
  const { data, isLoading, error } = useQuery<AuthUser | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn<AuthUser | null>({ on401: "returnNull" }),
  });

  return {
    user: data ?? null,
    isLoading,
    error,
  };
}

export function useAuthActions() {
  const queryClient = useQueryClient();

  const login = useMutation({
    mutationFn: async (payload: { username: string; password: string }) => {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Login failed" }));
        const err = new Error(error.message || "Login failed") as any;
        err.status = res.status;
        throw err;
      }

      return res.json() as Promise<AuthUser>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Logout failed" }));
        throw new Error(error.message || "Logout failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      queryClient.removeQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.removeQueries({ queryKey: ["/api/vulnerabilities"] });
      queryClient.removeQueries({ queryKey: ["/api/alerts"] });
    },
  });

  return { login, logout };
}

