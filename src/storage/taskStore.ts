import type { GenerationTask } from "../domain/types";

const TASKS_STORAGE_KEY = "commerce-studio-tasks-v1";

export function loadTasks(): GenerationTask[] {
  const storedTasks = localStorage.getItem(TASKS_STORAGE_KEY);

  if (storedTasks === null) {
    return [];
  }

  try {
    const parsedTasks = JSON.parse(storedTasks);
    return Array.isArray(parsedTasks) ? (parsedTasks as GenerationTask[]) : [];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: GenerationTask[]): void {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
}
