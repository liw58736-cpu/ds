import { fetchWithTimeout } from "./requestTimeout";
import { refreshKromaSession } from "./accountApi";
import { getAccountAccessToken } from "../storage/accountStore";

export interface ImportedMaterialResult {
  sourceUrl: string;
  title: string;
  images: string[];
  limited: boolean;
  sourcePlatform: "xiaohongshu" | "public_web";
}

interface ImportedMaterialResponse {
  source_url: string;
  title: string;
  images: string[];
  limited?: boolean;
  source_platform?: "xiaohongshu" | "public_web";
}

export interface SavedMaterial {
  id: string;
  imageUrl: string;
  fileName: string;
  createdAt: string;
  contentType: string;
  size: number;
}

interface StoredMaterialResponse {
  id?: string;
  stored_url: string;
  file_name?: string;
  created_at?: string;
  content_type?: string;
  size?: number;
}

interface SavedMaterialListResponse {
  materials?: StoredMaterialResponse[];
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
    const response = await fetchWithTimeout(
      `${baseUrl}/materials/import`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, authorized }),
      },
      90000,
    );

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
      throw new Error(
        normalizeMaterialError(
          message,
          response.status,
          "图片提取失败，请稍后重试。",
        ),
      );
    }

    const payload = (await response.json()) as ImportedMaterialResponse;
    return {
      sourceUrl: payload.source_url,
      title: payload.title,
      images: Array.isArray(payload.images) ? payload.images : [],
      limited: Boolean(payload.limited),
      sourcePlatform: payload.source_platform ?? "public_web",
    };
  }

  throw new Error("登录状态已失效，请重新登录后导入素材。");
}

export async function storeImportedMaterial(
  url: string,
  authorized: boolean,
  title?: string,
): Promise<string> {
  const material = await saveImportedMaterial(url, authorized, title);
  return material.imageUrl;
}

export async function saveImportedMaterial(
  url: string,
  authorized: boolean,
  title?: string,
  sourceUrl?: string,
): Promise<SavedMaterial> {
  const baseUrl = getMaterialApiBaseUrl();
  let token = getAccountAccessToken();

  if (!baseUrl) throw new Error("素材保存需要连接网页账号后端。");
  if (!token) throw new Error("请先登录后再保存公开素材。");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchWithTimeout(
      `${baseUrl}/materials/store`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          authorized,
          ...(title ? { title } : {}),
          ...(sourceUrl ? { source_url: sourceUrl } : {}),
        }),
      },
      90000,
    );

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
      throw new Error(
        normalizeMaterialError(
          message,
          response.status,
          "图片保存失败，请稍后重试。",
        ),
      );
    }

    const payload = (await response.json()) as StoredMaterialResponse;
    if (!payload.stored_url) throw new Error("素材保存接口没有返回稳定地址。");
    return normalizeSavedMaterial(payload);
  }

  throw new Error("登录状态已失效，请重新登录后保存素材。");
}

export async function uploadLocalMaterial(file: File): Promise<SavedMaterial> {
  const baseUrl = getMaterialApiBaseUrl();
  let token = getAccountAccessToken();

  if (!baseUrl) throw new Error("本地图片上传需要连接网页账号后端。");
  if (!token) throw new Error("请先登录后再上传图片。");
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("只支持 PNG、JPG、JPEG 和 WebP 图片。");
  }
  if (file.size <= 0 || file.size > 20 * 1024 * 1024) {
    throw new Error(
      file.size <= 0 ? "图片文件不能为空。" : "单张图片不能超过 20MB。",
    );
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const form = new FormData();
    form.append("image", file, file.name);
    const response = await fetchWithTimeout(`${baseUrl}/materials/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
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
      throw new Error(message || `图片上传失败（HTTP ${response.status}）`);
    }

    const payload = (await response.json()) as StoredMaterialResponse;
    if (!payload.stored_url) throw new Error("图片上传接口没有返回稳定地址。");
    return normalizeSavedMaterial(payload);
  }

  throw new Error("登录状态已失效，请重新登录后上传图片。");
}

export async function listSavedMaterials(
  limit = 60,
  offset = 0,
): Promise<SavedMaterial[]> {
  const baseUrl = getMaterialApiBaseUrl();
  let token = getAccountAccessToken();
  if (!baseUrl || !token) return [];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchWithTimeout(
      `${baseUrl}/materials?limit=${Math.max(1, Math.min(100, limit))}${offset ? `&offset=${offset}` : ""}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (response.status === 401 && attempt === 0) {
      token = await refreshKromaSession();
      if (token) continue;
    }
    if (!response.ok)
      throw new Error(`图片库读取失败（HTTP ${response.status}）`);
    const payload = (await response.json()) as SavedMaterialListResponse;
    return (payload.materials ?? [])
      .filter((item) => item.stored_url)
      .map(normalizeSavedMaterial);
  }
  return [];
}

function normalizeSavedMaterial(
  payload: StoredMaterialResponse,
): SavedMaterial {
  const fallbackName = decodeURIComponent(
    payload.stored_url.split("/").pop() ?? "已保存素材",
  )
    .replace(/^\d{10,}-\d{6}-/, "")
    .replace(/\.(png|jpe?g|webp)$/i, "")
    .replace(/-/g, " ");
  return {
    id: payload.id ?? payload.stored_url,
    imageUrl: payload.stored_url,
    fileName: payload.file_name ?? fallbackName,
    createdAt: payload.created_at ?? new Date().toISOString(),
    contentType: payload.content_type ?? "image/jpeg",
    size: Number(payload.size ?? 0),
  };
}

function normalizeMaterialError(
  message: string,
  status: number,
  fallback: string,
): string {
  const value = String(message || "").trim();
  const lower = value.toLowerCase();
  if (lower.includes("could not be read") || lower.includes("failed to fetch"))
    return "图片来源暂时无法读取，请稍后重试。";
  if (lower.includes("no public images were found"))
    return "没有读取到公开图片，请确认链接可以直接访问。";
  if (lower.includes("only png") || lower.includes("not an image"))
    return "该图片格式暂不支持保存，请选择 JPG、PNG 或 WebP 图片。";
  if (lower.includes("exceeds 20 mb") || status === 413)
    return "图片超过 20MB，暂时无法保存。";
  if (lower.includes("empty")) return "图片内容为空，请重新提取。";
  if (lower.includes("timed out") || status === 504)
    return "图片来源响应较慢，本次请求已超时，请稍后重试。";
  return value || fallback;
}
