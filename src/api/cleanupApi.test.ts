import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeSession } from "../storage/accountStore";
import { runImageCleanup } from "./cleanupApi";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("cleanupApi", () => {
  it("sends the painted mask to the existing image cleanup route", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "https://web-api.example.com/api/v1");
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
          task_id: "cleanup-1",
          status: "done",
          image_url: "https://cdn.example.com/cleaned.png",
          channel_used: "packyapi",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onTaskStarted = vi.fn();

    const result = await runImageCleanup({
      imageBase64: "data:image/png;base64,source",
      maskBase64: "data:image/png;base64,mask",
      mode: "watermark_remove",
      onTaskStarted,
    });

    expect(result).toEqual({
      imageUrl: "https://cdn.example.com/cleaned.png",
      channelUsed: "packyapi",
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      task_type: "watermark_remove",
      image_base64: "data:image/png;base64,source",
      mask_base64: "data:image/png;base64,mask",
    });
    expect(onTaskStarted).toHaveBeenCalledWith("cleanup-1");
  });
});
