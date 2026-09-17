import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLiveVideoPrompt,
  generateLiveVideo,
  getLiveVideoCreditCost,
  prepareLiveVideoFrame,
} from "./liveVideoApi";
import { initializeSession } from "../storage/accountStore";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("liveVideoApi", () => {
  it("uses an already-cropped 105 percent frame and locks the camera completely", () => {
    const prompt = buildLiveVideoPrompt("人物轻轻眨眼");

    expect(prompt).toContain("natural blink");
    expect(prompt).toContain("already been center-cropped to the final 105% composition");
    expect(prompt).toContain("The camera is completely locked");
    expect(prompt).toContain("No handheld drift, pan, tilt, roll, shake");
    expect(prompt).toContain("first 1.8 seconds");
    expect(prompt).toContain("Preserve the exact person identity");
    expect(prompt).toContain("torso orientation unchanged");
    expect(prompt).toContain("changed clothing color or pattern");
    expect(prompt).toContain("人物轻轻眨眼");
  });

  it("charges more credits for 1080p", () => {
    expect(getLiveVideoCreditCost("720p")).toBe(30);
    expect(getLiveVideoCreditCost("1080p")).toBe(40);
  });

  it("center-crops the source to an exact 105 percent frame before upload", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "https://web.example.com/api/v1/");
    initializeSession({
      identifier: "seller@example.com",
      authView: "login",
      mode: "password",
      storeName: "",
      inviteCode: "",
      createdAt: "2026-09-06T00:00:00.000Z",
      accessToken: "web-access-token",
    });
    const bitmap = {
      width: 1050,
      height: 840,
      close: vi.fn(),
    } as unknown as ImageBitmap;
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const drawImage = vi.fn();
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: (callback: BlobCallback) =>
        callback(new Blob(["cropped-frame"], { type: "image/webp" })),
    } as unknown as HTMLCanvasElement;
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(
      ((tagName: string, options?: ElementCreationOptions) =>
        tagName === "canvas"
          ? fakeCanvas
          : createElement(tagName, options)) as typeof document.createElement,
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(new Blob(["source"], { type: "image/jpeg" }), {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          frame_url: "https://cdn.example.com/video-frames/frame-105.webp",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      prepareLiveVideoFrame("https://cdn.example.com/source.jpg"),
    ).resolves.toBe("https://cdn.example.com/video-frames/frame-105.webp");
    expect(drawImage).toHaveBeenCalledWith(
      bitmap,
      25,
      20,
      1000,
      800,
      0,
      0,
      1050,
      840,
    );
    expect(bitmap.close).toHaveBeenCalled();
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://web.example.com/api/v1/video/frame",
    );
    expect(fetchMock.mock.calls[1][1].headers).toEqual({
      Authorization: "Bearer web-access-token",
    });
    const form = fetchMock.mock.calls[1][1].body as FormData;
    expect(form.get("image")).toBeInstanceOf(File);
    expect((form.get("image") as File).type).toBe("image/webp");
  });

  it("submits and polls a real video task without exposing the provider key", async () => {
    vi.stubEnv("VITE_KROMA_API_BASE_URL", "https://web.example.com/api/v1/");
    initializeSession({
      identifier: "seller@example.com",
      authView: "login",
      mode: "password",
      storeName: "",
      inviteCode: "",
      createdAt: "2026-09-06T00:00:00.000Z",
      accessToken: "web-access-token",
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            task_id: "web-video-1",
            status: "processing",
            progress: "正在生成 Live 图",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            task_id: "web-video-1",
            status: "done",
            video_url: "https://cdn.example.com/live.mp4",
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateLiveVideo(
        {
          firstFrameUrl: "https://cdn.example.com/frame.jpg",
          prompt: "自然眨眼",
          size: "720p",
        },
        {
          pollIntervalMs: 0,
          prepareFrame: async () => "https://cdn.example.com/frame-105.webp",
        },
      ),
    ).resolves.toEqual({
      taskId: "web-video-1",
      videoUrl: "https://cdn.example.com/live.mp4",
    });
    const submitted = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(submitted).toMatchObject({
      firstFrameUrl: "https://cdn.example.com/frame-105.webp",
      lastFrameUrl: "https://cdn.example.com/frame-105.webp",
      aspectRatio: "16:9",
      size: "720p",
    });
    expect(fetchMock.mock.calls[0][1].headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer web-access-token" }),
    );
    expect(JSON.stringify(submitted)).not.toContain("WUYINKEJI");
  });
});
