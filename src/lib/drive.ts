import "server-only";
import { createSign } from "node:crypto";

/**
 * Google Drive con cuenta de servicio, sin SDK: JWT firmado con la clave privada
 * y llamadas REST a la API v3. Ver docs/SETUP-DRIVE.md.
 */

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_JSON (ver docs/SETUP-DRIVE.md)");
  const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const sa = JSON.parse(json) as ServiceAccount;
  if (!sa.client_email || !sa.private_key) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no tiene client_email/private_key");
  return sa;
}

let cachedToken: { value: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.value;
  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: sa.token_uri ?? "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const res = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  if (!res.ok) throw new Error(`Google OAuth falló: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export type DriveFile = { id: string; name: string; mimeType: string; size?: string };

async function driveGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = await accessToken();
  const url = new URL(`https://www.googleapis.com/drive/v3/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive API ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

const FILE_FIELDS = "files(id,name,mimeType,size)";
const q = (s: string) => s.replace(/'/g, "\\'");

/**
 * Busca fotos de un SKU dentro de la carpeta raíz:
 *  - archivos cuyo nombre empiece con el SKU (SKU.jpg, SKU-2.jpg), o
 *  - una subcarpeta llamada como el SKU, con sus imágenes adentro.
 */
export async function findPhotosForSku(rootFolderId: string, sku: string): Promise<DriveFile[]> {
  const files = await driveGet<{ files: DriveFile[] }>("files", {
    q: `'${q(rootFolderId)}' in parents and trashed = false and name contains '${q(sku)}'`,
    fields: FILE_FIELDS,
    pageSize: "100",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const out: DriveFile[] = [];
  for (const f of files.files) {
    if (f.mimeType === "application/vnd.google-apps.folder") {
      if (f.name.toUpperCase() !== sku.toUpperCase()) continue;
      const inner = await driveGet<{ files: DriveFile[] }>("files", {
        q: `'${q(f.id)}' in parents and trashed = false and mimeType contains 'image/'`,
        fields: FILE_FIELDS,
        pageSize: "100",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });
      out.push(...inner.files);
    } else if (f.mimeType.startsWith("image/") && f.name.toUpperCase().startsWith(sku.toUpperCase())) {
      out.push(f);
    }
  }
  // Orden estable: SKU.jpg primero, después SKU-2, SKU-3…
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export async function downloadFile(fileId: string): Promise<{ bytes: Buffer; contentType: string }> {
  const token = await accessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive descarga ${fileId}: ${res.status}`);
  return { bytes: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "image/jpeg" };
}

export function driveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
}
