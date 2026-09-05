import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  getCachedMaterialLibraryAssets,
  listMaterialLibraryAssets,
  type MaterialLibraryAsset,
  type MaterialLibraryProgress,
} from "../api/materialLibraryApi";
import { MaterialPickerDialog } from "./MaterialPickerDialog";
import { initializeSession } from "../storage/accountStore";
import { OPEN_LIBRARY_EVENT, RETURN_LIBRARY_EVENT } from "../domain/navigationEvents";

vi.mock("../api/materialLibraryApi", () => ({
  getCachedMaterialLibraryAssets: vi.fn(),
  listMaterialLibraryAssets: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getCachedMaterialLibraryAssets).mockReturnValue([]);
  vi.mocked(listMaterialLibraryAssets).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  localStorage.clear();
});

it("shows cached images immediately and refreshes only 40 items in the background", async () => {
  const cached = {
    id: "cached",
    imageUrl: "https://cdn.example.com/cached.webp",
    fileName: "最近图片",
    createdAt: "2026-09-05T00:00:00.000Z",
    source: "saved" as const,
    sourceLabel: "保存图片",
  };
  const refreshed = {
    ...cached,
    id: "refreshed",
    imageUrl: "https://cdn.example.com/refreshed.webp",
    fileName: "最新图片",
  };
  let finishRefresh!: (assets: typeof refreshed[]) => void;
  vi.mocked(getCachedMaterialLibraryAssets).mockReturnValue([cached]);
  vi.mocked(listMaterialLibraryAssets).mockReturnValue(
    new Promise((resolve) => {
      finishRefresh = resolve;
    }),
  );

  render(
    <MaterialPickerDialog
      open
      title="选择商品图"
      onPick={vi.fn()}
      onClose={vi.fn()}
    />,
  );

  const cachedImage = screen.getByAltText("最近图片");
  expect(cachedImage).toBeVisible();
  expect(cachedImage).toHaveAttribute("loading", "lazy");
  expect(cachedImage).toHaveAttribute("decoding", "async");
  expect(cachedImage).toHaveAttribute("fetchpriority", "low");
  expect(screen.getByText("已显示最近图片，正在后台同步最新内容…")).toBeVisible();
  expect(listMaterialLibraryAssets).toHaveBeenCalledWith(0, 40, expect.objectContaining({ onProgress: expect.any(Function) }));

  finishRefresh([refreshed]);
  await waitFor(() => expect(screen.getByAltText("最新图片")).toBeVisible());
  expect(screen.queryByAltText("最近图片")).not.toBeInTheDocument();
});

function asset(name: string): MaterialLibraryAsset {
  return { id: name, imageUrl: "https://fixture.invalid/" + name + ".png", fileName: name,
    createdAt: "2026-09-05", source: "saved", sourceLabel: "保存图片" };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function login(id: string) {
  initializeSession({ identifier: id + "@example.com", userId: id, authView: "login",
    mode: "password", storeName: "", inviteCode: "", createdAt: "2026-09-05" });
}
function picker(open = true, onPick = vi.fn(), onClose = vi.fn()) {
  return <MaterialPickerDialog open={open} title="选择商品图" onPick={onPick} onClose={onClose} />;
}
function page(assets: MaterialLibraryAsset[], hasMore = false): MaterialLibraryProgress {
  return { assets, hasMore, pending: false, failedSources: [] };
}

it("does not read task caches for a hidden picker", async () => {
  const view = render(picker(false));
  expect(getCachedMaterialLibraryAssets).not.toHaveBeenCalled();
  expect(listMaterialLibraryAssets).not.toHaveBeenCalled();
  view.rerender(picker());
  await waitFor(() => expect(listMaterialLibraryAssets).toHaveBeenCalledTimes(1));
});

it("renders fast progress while the second source is still pending", async () => {
  const slow = deferred<MaterialLibraryAsset[]>();
  vi.mocked(listMaterialLibraryAssets).mockImplementation((_offset, _limit, options) => {
    options?.onProgress?.({ ...page([asset("fast")]), pending: true });
    return slow.promise;
  });
  render(picker());
  expect(screen.getByAltText("fast")).toBeVisible();
  await act(async () => slow.resolve([asset("fast"), asset("slow")]));
  expect(screen.getByAltText("slow")).toBeVisible();
});

it("retains already displayed images when refresh fails even without disk cache", async () => {
  vi.mocked(listMaterialLibraryAssets).mockResolvedValueOnce([asset("visible")])
    .mockRejectedValueOnce(new Error("offline"));
  render(picker());
  await screen.findByAltText("visible");
  fireEvent.click(screen.getByRole("button", { name: "重新读取" }));
  await screen.findByText("最新内容暂未同步，当前显示最近图片。");
  expect(screen.getByAltText("visible")).toBeVisible();
});

it("does not let a slower refresh replace the latest refresh", async () => {
  const old = deferred<MaterialLibraryAsset[]>();
  vi.mocked(listMaterialLibraryAssets).mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce([asset("new")]);
  render(picker());
  fireEvent.click(screen.getByRole("button", { name: "重新读取" }));
  await screen.findByAltText("new");
  await act(async () => old.resolve([asset("old")]));
  expect(screen.queryByAltText("old")).not.toBeInTheDocument();
  expect(screen.getByAltText("new")).toBeVisible();
});

it("ignores progress and completion after closing and reopening", async () => {
  const old = deferred<MaterialLibraryAsset[]>();
  let report!: (value: MaterialLibraryProgress) => void;
  vi.mocked(listMaterialLibraryAssets).mockImplementationOnce((_offset, _limit, options) => {
    report = options!.onProgress!;
    return old.promise;
  }).mockResolvedValueOnce([asset("reopened")]);
  const view = render(picker());
  fireEvent.click(screen.getByRole("button", { name: "关闭图片选择器" }));
  expect(vi.mocked(listMaterialLibraryAssets).mock.calls[0][2]?.signal?.aborted).toBe(true);
  view.rerender(picker(false));
  await act(async () => {
    report({ ...page([asset("closed-progress")]), pending: true });
    old.resolve([asset("closed-result")]);
  });
  view.rerender(picker());
  await screen.findByAltText("reopened");
  expect(screen.queryByAltText("closed-progress")).not.toBeInTheDocument();
  expect(screen.queryByAltText("closed-result")).not.toBeInTheDocument();
});

it("clears account A immediately and ignores late A results after login as B", async () => {
  login("A");
  vi.mocked(getCachedMaterialLibraryAssets).mockImplementation((owner) => owner === "account:A" ? [asset("private-A")] : []);
  const old = deferred<MaterialLibraryAsset[]>();
  const next = deferred<MaterialLibraryAsset[]>();
  vi.mocked(listMaterialLibraryAssets).mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  const onPick = vi.fn();
  render(picker(true, onPick));
  expect(screen.getByAltText("private-A")).toBeVisible();
  act(() => login("B"));
  expect(screen.queryByAltText("private-A")).not.toBeInTheDocument();
  await act(async () => old.resolve([asset("late-A")]));
  expect(screen.queryByAltText("late-A")).not.toBeInTheDocument();
  await act(async () => next.resolve([asset("B")]));
  fireEvent.click(screen.getByAltText("B"));
  expect(onPick).toHaveBeenCalledWith(asset("B"));
});

it("clears private images on cross-tab logout while remaining mounted", async () => {
  login("A");
  vi.mocked(listMaterialLibraryAssets).mockResolvedValueOnce([asset("private")]).mockResolvedValueOnce([]);
  render(picker());
  await screen.findByAltText("private");
  act(() => {
    localStorage.clear();
    window.dispatchEvent(new StorageEvent("storage", { key: "commerce-studio-account-v1" }));
  });
  await waitFor(() => expect(screen.queryByAltText("private")).not.toBeInTheDocument());
});

it("rejects stale A responses after an A to B to A switch", async () => {
  login("A");
  const old = deferred<MaterialLibraryAsset[]>();
  vi.mocked(listMaterialLibraryAssets).mockReturnValueOnce(old.promise).mockResolvedValue([asset("fresh")]);
  render(picker());
  act(() => login("B"));
  act(() => login("A"));
  await screen.findByAltText("fresh");
  await act(async () => old.resolve([asset("stale")]));
  expect(screen.queryByAltText("stale")).not.toBeInTheDocument();
});

it("loads beyond 40 and deduplicates overlapping pages by image URL", async () => {
  const first = Array.from({ length: 40 }, (_, i) => asset("photo-" + i));
  vi.mocked(listMaterialLibraryAssets).mockImplementation(async (offset, _limit, options) => {
    const assets = offset === 0 ? first : [{ ...first[0], id: "duplicate" }, asset("older")];
    options?.onProgress?.(page(assets, offset === 0));
    return assets;
  });
  render(picker());
  await screen.findByAltText("photo-0");
  await waitFor(() => expect(screen.getByRole("button", { name: "读取更早图片" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "读取更早图片" }));
  await screen.findByAltText("older");
  expect(listMaterialLibraryAssets).toHaveBeenLastCalledWith(40, 40, expect.anything());
  expect(screen.getAllByAltText("photo-0")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "读取更早图片" })).not.toBeInTheDocument();
});

it("offers older cloud pages even when a full source page has no selectable images", async () => {
  vi.mocked(listMaterialLibraryAssets).mockImplementation(async (offset, _limit, options) => {
    const assets = offset === 0 ? [] : [asset("old-result")];
    options?.onProgress?.(page(assets, offset === 0));
    return assets;
  });
  render(picker());
  await screen.findByText("本页没有可选图片，可以继续读取更早图片。");
  fireEvent.click(screen.getByRole("button", { name: "读取更早图片" }));
  await screen.findByAltText("old-result");
  expect(listMaterialLibraryAssets).toHaveBeenLastCalledWith(40, 40, expect.anything());
});

it("retains a successful source and retries the same older offset after partial failure", async () => {
  vi.mocked(listMaterialLibraryAssets)
    .mockImplementationOnce(async (_offset, _limit, options) => {
      options?.onProgress?.(page([asset("first")], true));
      return [asset("first")];
    }).mockImplementationOnce(async (_offset, _limit, options) => {
      options?.onProgress?.({ ...page([asset("partial")], true), failedSources: ["generated"] });
      throw new Error("offline");
    }).mockImplementationOnce(async (_offset, _limit, options) => {
      options?.onProgress?.(page([asset("partial"), asset("retry")]));
      return [asset("partial"), asset("retry")];
    });
  render(picker());
  await screen.findByAltText("first");
  await waitFor(() => expect(screen.getByRole("button", { name: "读取更早图片" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "读取更早图片" }));
  await screen.findByText("较早图片暂未读取成功，已保留当前图片。请重试。");
  expect(screen.getByAltText("first")).toBeVisible();
  expect(screen.getByAltText("partial")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "读取更早图片" }));
  await screen.findByAltText("retry");
  expect(listMaterialLibraryAssets).toHaveBeenNthCalledWith(2, 40, 40, expect.anything());
  expect(listMaterialLibraryAssets).toHaveBeenNthCalledWith(3, 40, 40, expect.anything());
});

it("does not advance the first page when only one source synced", async () => {
  vi.mocked(listMaterialLibraryAssets).mockImplementationOnce(async (_offset, _limit, options) => {
    options?.onProgress?.({ ...page([asset("partial")], true), failedSources: ["generated"] });
    return [asset("partial")];
  }).mockImplementationOnce(async (_offset, _limit, options) => {
    options?.onProgress?.(page([asset("complete")]));
    return [asset("complete")];
  });
  render(picker());
  await screen.findByText("部分图片暂未同步，已保留当前图片。请重新读取。");
  fireEvent.click(screen.getByRole("button", { name: "读取更早图片" }));
  await screen.findByAltText("complete");
  expect(listMaterialLibraryAssets).toHaveBeenLastCalledWith(0, 40, expect.anything());
});

it("suspends old responses during upload navigation and reloads on return", async () => {
  const old = deferred<MaterialLibraryAsset[]>();
  vi.mocked(listMaterialLibraryAssets).mockReturnValueOnce(old.promise).mockResolvedValueOnce([asset("uploaded")]);
  let pickerId: string | undefined;
  const capture = (event: Event) => { pickerId = (event as CustomEvent).detail.pickerId; };
  window.addEventListener(OPEN_LIBRARY_EVENT, capture);
  const view = render(picker());
  fireEvent.click(screen.getByRole("button", { name: "去图片库上传" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await act(async () => old.resolve([asset("stale")]));
  view.rerender(picker(false));
  act(() => window.dispatchEvent(new CustomEvent(RETURN_LIBRARY_EVENT, { detail: { pickerId } })));
  await screen.findByAltText("uploaded");
  expect(screen.queryByAltText("stale")).not.toBeInTheDocument();
  window.removeEventListener(OPEN_LIBRARY_EVENT, capture);
});
