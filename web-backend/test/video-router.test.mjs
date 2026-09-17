import assert from "node:assert/strict";
import test from "node:test";
import { buildVideoPayload, createVideoRouter } from "../src/video-router.mjs";

test("video payload accepts only a public HTTPS first frame and supported options", () => {
  assert.deepEqual(
    buildVideoPayload({
      prompt: "natural blink",
      firstFrameUrl: "https://cdn.example.com/frame.jpg",
      aspectRatio: "9:16",
      size: "1080p",
    }),
    {
      prompt: "natural blink",
      firstFrameUrl: "https://cdn.example.com/frame.jpg",
      lastFrameUrl: "https://cdn.example.com/frame.jpg",
      aspectRatio: "16:9",
      size: "1080p",
    },
  );
  assert.throws(
    () =>
      buildVideoPayload({
        prompt: "natural blink",
        firstFrameUrl: "data:image/png;base64,abc",
      }),
    /首帧图片/,
  );
});

test("video router keeps the provider key server-side and maps async success", async () => {
  const calls = [];
  const router = createVideoRouter({
    env: {
      WUYINKEJI_VIDEO_KEY: "server-secret",
      WUYINKEJI_VIDEO_URL:
        "https://api.wuyinkeji.com/api/async/video_veo3.1_fast",
    },
    fetch: async (url, init = {}) => {
      calls.push({ url, init });
      if (url.endsWith("video_veo3.1_fast")) {
        return Response.json({
          code: 200,
          data: { id: "video-provider-1" },
        });
      }
      if (url.endsWith("/api/async/detail?id=video-provider-1")) {
        return Response.json({
          code: 200,
          data: {
            status: 2,
            result: ["https://cdn.example.com/result.mp4"],
          },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback) => {
    queueMicrotask(callback);
    return 0;
  };
  try {
    const task = await router.submit(
      {
        prompt: "natural blink",
        firstFrameUrl: "https://cdn.example.com/frame.jpg",
        size: "720p",
      },
      { id: "user-1" },
    );
    await new Promise((resolve) => setImmediate(resolve));
    const result = router.response(router.get(task.task_id));

    assert.equal(result.status, "done");
    assert.equal(result.video_url, "https://cdn.example.com/result.mp4");
    assert.equal(calls[0].init.headers.Authorization, "server-secret");
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      prompt: "natural blink",
      firstFrameUrl: "https://cdn.example.com/frame.jpg",
      lastFrameUrl: "https://cdn.example.com/frame.jpg",
      aspectRatio: "16:9",
      size: "720p",
    });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});
