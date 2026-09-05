import { beforeEach, expect, it } from "vitest";
import { initializeSession, clearAccountSession } from "./accountStore";
import { saveTasks, loadTasks } from "./taskStore";
import { createTask } from "../domain/taskState";
import { defaultConfig } from "../domain/defaults";
beforeEach(() => localStorage.clear());
it("never carries one account task cache into another account or guest session", () => {
  const login = (id: string) =>
    initializeSession({
      identifier: `${id}@example.com`,
      userId: id,
      authView: "login",
      mode: "password",
      storeName: "",
      inviteCode: "",
      createdAt: "2026-09-04",
    });
  login("A");
  const task = createTask({
    product: {
      id: "p",
      imageUrl: "https://example.com/p.png",
      fileName: "p.png",
      createdAt: "2026-09-04",
      source: "upload",
    },
    config: defaultConfig,
    now: "2026-09-04",
  });
  saveTasks([
    {
      ...task,
      status: "completed",
      resultUrls: ["https://example.com/result.png"],
    },
  ]);
  login("B");
  expect(loadTasks()).toEqual([]);
  clearAccountSession();
  expect(loadTasks()).toEqual([]);
  login("A");
  expect(loadTasks()[0]?.id).toBe(task.id);
});
