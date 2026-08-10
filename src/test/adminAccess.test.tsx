import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const authState = { user: null as { id: string } | null, isLoading: false };
const roleResult = { data: null as { role: string } | null };

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/integrations/supabase/client", () => {
  const builder = () => {
    const chain: Record<string, unknown> = {};
    const self = new Proxy(chain, {
      get: (_t, prop) => {
        if (prop === "maybeSingle") return async () => roleResult;
        if (prop === "then") return undefined;
        return () => self;
      },
    });
    return self;
  };
  return { supabase: { from: () => builder(), functions: { invoke: vi.fn() } } };
});

const renderAdmin = async () => {
  const { default: AdminLayout } = await import("@/components/AdminLayout");
  render(
    <MemoryRouter initialEntries={["/admin/roles"]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="roles" element={<div>SECRET ADMIN CONTENT</div>} />
        </Route>
        <Route path="/dashboard" element={<div>dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("/admin route protection", () => {
  beforeEach(() => {
    vi.resetModules();
    authState.user = null;
    authState.isLoading = false;
    roleResult.data = null;
  });

  it("blocks signed-out visitors", async () => {
    await renderAdmin();
    await waitFor(() => expect(screen.getByText(/don't have access/i)).toBeInTheDocument());
    expect(screen.queryByText("SECRET ADMIN CONTENT")).not.toBeInTheDocument();
  });

  it("blocks signed-in non-admin users", async () => {
    authState.user = { id: "user-1" };
    roleResult.data = null;
    await renderAdmin();
    await waitFor(() => expect(screen.getByText(/don't have access/i)).toBeInTheDocument());
    expect(screen.queryByText("SECRET ADMIN CONTENT")).not.toBeInTheDocument();
  });

  it("renders admin content for admins", async () => {
    authState.user = { id: "admin-1" };
    roleResult.data = { role: "admin" };
    await renderAdmin();
    await waitFor(() => expect(screen.getByText("SECRET ADMIN CONTENT")).toBeInTheDocument());
  });
});
