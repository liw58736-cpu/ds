import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getConfiguredApiBaseUrl,
  requestRemoteJson,
  shouldUseRemoteBackend,
} from "./remoteBackendClient";
import { initializeSession } from "../storage/accountStore";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("remoteBackendClient", () => {
  it("keeps mock mode when VITE_API_BASE_URL is not configured", () => {
    vi.stubEnv("VITE_API_BASE_URL", "");

    expect(getConfiguredApiBaseUrl()).toBeNull();
    expect(shouldUseRemoteBackend()).toBe(false);
  });

  it("posts JSON requests to the configured backend base URL", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com/v1/");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestRemoteJson<{ ok: boolean }>({
      endpoint: "/api/generation/tasks",
      method: "POST",
      body: { routeMode: "standard" },
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/api/generation/tasks",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ routeMode: "standard" }),
      },
    );
  });

  it("sends GET requests without a request body", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await requestRemoteJson({
      endpoint: "/api/generation/tasks?accountId=guest",
      method: "GET",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/generation/tasks?accountId=guest",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  });

  it("sends the saved access token to remote JSON endpoints", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    initializeSession({
      identifier: "seller@example.com",
      authView: "login",
      mode: "password",
      storeName: "",
      inviteCode: "",
      createdAt: "2026-06-17T00:00:00.000Z",
      accessToken: "access-token-1",
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await requestRemoteJson({
      endpoint: "/api/account/current?accountId=guest",
      method: "GET",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/account/current?accountId=guest",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-token-1",
        }),
      }),
    );
  });

  it("throws a useful error when the remote backend returns a non-2xx response", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: () => Promise.resolve("bad gateway"),
      }),
    );

    await expect(
      requestRemoteJson({
        endpoint: "/api/generation/tasks",
        method: "POST",
        body: {},
      }),
    ).rejects.toThrow("Remote API POST /api/generation/tasks failed: 502 bad gateway");
  });
});
