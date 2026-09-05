export const OPEN_LIBRARY_EVENT = "kroma-open-library";
export const RETURN_LIBRARY_EVENT = "kroma-return-library";
export const OPEN_LOGIN_EVENT = "kroma-open-login";
export const REUSE_TASK_EVENT = "kroma-reuse-task";
export function openLibrary(pickerId?: string) {
  window.dispatchEvent(
    new CustomEvent(OPEN_LIBRARY_EVENT, { detail: { pickerId } }),
  );
}
