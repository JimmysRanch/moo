import { supabase } from "@/lib/supabase";
import { getActiveStoreId } from "@/lib/activeStore";

const API = import.meta.env.VITE_API_BASE_URL || "";

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const storeId = getActiveStoreId() || "";
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(storeId ? { "x-store-id": storeId } : {}),
  };
}

async function parseErrorResponse(res: Response, operation: string): Promise<string> {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (json.error && typeof json.error === "string") return json.error;
      if (json.error?.message) return json.error.message;
      if (json.message) return json.message;
    } catch {
      // Not JSON, use text directly
    }
    return text || `${operation} failed with status ${res.status}`;
  } catch {
    return `${operation} failed with status ${res.status}`;
  }
}

export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res, `POST ${path}`));
  return res.json();
}

export async function putJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res, `PUT ${path}`));
  return res.json();
}

export async function patchJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res, `PATCH ${path}`));
  return res.json();
}

export async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(await parseErrorResponse(res, `GET ${path}`));
  return res.json();
}
