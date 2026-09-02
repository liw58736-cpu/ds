import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeSession } from "../storage/accountStore";
import { importPublicMaterial, storeImportedMaterial } from "./materialImportApi";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("materialImportApi", () => {
  it("imports authorized public material through the separate web backend", async () => {
    vi.stubEnv("VITE_WEB_API_BASE_URL", "https://web-api.example.com/api/v1/");
    initializeSession({
      identifier: "seller@example.com",
      authView: "login",
      mode: "password",
      storeName: "",
      inviteCode: "",
      createdAt: "2026-08-31T00:00:00.000Z",
      provider: "kroma",
      userId: "user-1",
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          source_url: "https://public.example.com/post/1",
          title: "Public inspiration",
          images: ["https://cdn.example.com/1.png"],
          limited: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      importPublicMaterial("https://public.example.com/post/1", true),
    ).resolves.toEqual({
      sourceUrl: "https://public.example.com/post/1",
      title: "Public inspiration",
      images: ["https://cdn.example.com/1.png"],
      limited: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://web-api.example.com/api/v1/materials/import",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          url: "https://public.example.com/post/1",
          authorized: true,
        }),
      }),
    );
  });

  it("stores a selected imported image before it is used by generation", async () => {
    vi.stubEnv("VITE_WEB_API_BASE_URL", "https://web-api.example.com/api/v1/");
    initializeSession({
      identifier: "seller@example.com",
      authView: "login",
      mode: "password",
      storeName: "",
      inviteCode: "",
      createdAt: "2026-08-31T00:00:00.000Z",
      provider: "kroma",
      userId: "user-1",
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          stored_url: "https://web-project.supabase.co/storage/v1/object/public/web-materials/user-1/material.webp",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      storeImportedMaterial("https://cdn.example.com/material.webp", true),
    ).resolves.toContain("/web-materials/user-1/material.webp");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://web-api.example.com/api/v1/materials/store",
      expect.objectContaining({
        body: JSON.stringify({
          url: "https://cdn.example.com/material.webp",
          authorized: true,
        }),
      }),
    );
  });
});
