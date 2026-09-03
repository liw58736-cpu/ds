import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeSession } from "../storage/accountStore";
import { importPublicMaterial, listSavedMaterials, storeImportedMaterial, uploadLocalMaterial } from "./materialImportApi";

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
          source_platform: "xiaohongshu",
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
      sourcePlatform: "xiaohongshu",
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

  it("lists previously saved account materials", async () => {
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
          materials: [{
            id: "user-1/materials/photo.webp",
            stored_url: "https://web-project.supabase.co/storage/photo.webp",
            file_name: "以前保存的照片",
            created_at: "2026-09-01T00:00:00.000Z",
            content_type: "image/webp",
            size: 128,
          }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listSavedMaterials()).resolves.toEqual([
      {
        id: "user-1/materials/photo.webp",
        imageUrl: "https://web-project.supabase.co/storage/photo.webp",
        fileName: "以前保存的照片",
        createdAt: "2026-09-01T00:00:00.000Z",
        contentType: "image/webp",
        size: 128,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://web-api.example.com/api/v1/materials?limit=60",
      expect.objectContaining({ headers: { Authorization: "Bearer access-token" } }),
    );
  });

  it("uploads a local image through the material library backend", async () => {
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
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "user-1/materials/local-photo.png",
      stored_url: "https://web-project.supabase.co/storage/local-photo.png",
      file_name: "local-photo",
      created_at: "2026-09-03T00:00:00.000Z",
      content_type: "image/png",
      size: 5,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadLocalMaterial(new File(["image"], "local-photo.png", { type: "image/png" }))).resolves.toMatchObject({
      imageUrl: "https://web-project.supabase.co/storage/local-photo.png",
      fileName: "local-photo",
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://web-api.example.com/api/v1/materials/upload");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("image")).toBeInstanceOf(File);
  });
});
