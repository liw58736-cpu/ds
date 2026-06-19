import type { ApiReadRequest, ApiRequest } from "./apiContracts";
import { getAccountAccessToken } from "../storage/accountStore";

type RemoteRequest = ApiReadRequest | ApiRequest<unknown>;

export function getConfiguredApiBaseUrl(): string | null {
  const value = import.meta.env.VITE_API_BASE_URL?.trim();

  if (!value) {
    return null;
  }

  return value.replace(/\/+$/, "");
}

export function shouldUseRemoteBackend(): boolean {
  return getConfiguredApiBaseUrl() !== null;
}

export async function requestRemoteJson<Response>(
  request: RemoteRequest,
): Promise<Response> {
  const baseUrl = getConfiguredApiBaseUrl();

  if (!baseUrl) {
    throw new Error("Remote API base URL is not configured.");
  }

  const response = await fetch(`${baseUrl}${request.endpoint}`, {
    method: request.method,
    headers: buildRemoteHeaders(),
    ...("body" in request
      ? {
          body: JSON.stringify(request.body),
        }
      : {}),
  });

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Remote API ${request.method} ${request.endpoint} failed: ${response.status} ${text}`,
    );
  }

  return response.json() as Promise<Response>;
}

function buildRemoteHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const accessToken = getAccountAccessToken();

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}
