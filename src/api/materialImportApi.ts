import { refreshKromaSession } from "./accountApi";
import { getAccountAccessToken } from "../storage/accountStore";

export interface ImportedMaterialResult {
  sourceUrl: string;
  title: string;
  images: string[];
  limited: boolean;
}

interface ImportedMaterialResponse {
  source_url: string;
  title: string;
  images: string[];
  limited?: boolean;
}

interface StoredMaterialResponse {
  stored_url: string;
}

function getMaterialApiBaseUrl(): string | null {
  const value = import.meta.env.VITE_WEB_API_BASE_URL?.trim();
  return value ? value.replace(/\/+$/, "") : null;
}

export async function importPublicMaterial(
  url: string,
  authorized: boolean,
): Promise<ImportedMaterialResult> {
  const baseUrl = getMaterialApiBaseUrl();
  let token = getAccountAccessToken();

  if (!baseUrl) {
    throw new Error("素材链接导入需要连接网页账号后端。");
  }
  if (!token) {
    throw new Error("请先登录后再导入公开素材链接。");
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${baseUrl}/materials/import`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, authorized }),
    });

    if (response.status === 401 && attempt === 0) {
      token = await refreshKromaSession();
      if (token) continue;
    }

    if (!response.ok) {
      const text = await response.text();
      let message = text;
      try {
        const payload = JSON.parse(text) as { detail?: string };
        message = payload.detail ?? text;
      } catch {
        // Keep the response text as the user-facing error.
      }
      throw new Error(message || `素材导入失败（HTTP ${response.status}）`);
    }

    const payload = (await response.json()) as ImportedMaterialResponse;
    return {
      sourceUrl: payload.source_url,
      title: payload.title,
      images: Array.isArray(payload.images) ? payload.images : [],
      limited: Boolean(payload.limited),
    };
  }

  throw new Error("登录状态已失效，请重新登录后导入素材。");
}

export async function storeImportedMaterial(
  url: string,
  authorized: boolean,
): Promise<string> {
  const baseUrl = getMaterialApiBaseUrl();
  let token = getAccountAccessToken();

  if (!baseUrl) throw new Error("素材保存需要连接网页账号后端。");
  if (!token) throw new Error("请先登录后再保存公开素材。");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${baseUrl}/materials/store`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, authorized }),
    });

    if (response.status === 401 && attempt === 0) {
      token = await refreshKromaSession();
      if (token) continue;
    }

    if (!response.ok) {
      const text = await response.text();
      let message = text;
      try {
        const payload = JSON.parse(text) as { detail?: string };
        message = payload.detail ?? text;
      } catch {
        // Keep response text when the backend did not return JSON.
      }
      throw new Error(message || `素材保存失败（HTTP ${response.status}）`);
    }

    const payload = (await response.json()) as StoredMaterialResponse;
    if (!payload.stored_url) throw new Error("素材保存接口没有返回稳定地址。");
    return payload.stored_url;
  }

  throw new Error("登录状态已失效，请重新登录后保存素材。");
}
