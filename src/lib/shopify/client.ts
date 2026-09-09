import "server-only";

/**
 * Cliente mínimo de Shopify Admin GraphQL API. Ver docs/SETUP-SHOPIFY.md.
 * Variables: SHOPIFY_STORE_DOMAIN (xxx.myshopify.com), SHOPIFY_ADMIN_TOKEN (shpat_…), SHOPIFY_API_VERSION.
 */
export const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-01";

export function shopifyConfigured(): boolean {
  return Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_ADMIN_TOKEN);
}

export class ShopifyError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = "ShopifyError";
  }
}

export async function shopifyGraphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!domain || !token) throw new ShopifyError("Shopify no está configurado (SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_TOKEN). Ver docs/SETUP-SHOPIFY.md");
  const res = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-shopify-access-token": token },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) throw new ShopifyError(`Shopify respondió ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new ShopifyError(json.errors.map((e) => e.message).join("; "), json.errors);
  if (!json.data) throw new ShopifyError("Shopify no devolvió datos");
  return json.data;
}

/** Ubicaciones de la tienda (para elegir shopify_location_id en Configuración). */
export async function listLocations(): Promise<{ id: string; name: string; isActive: boolean }[]> {
  const data = await shopifyGraphql<{ locations: { nodes: { id: string; name: string; isActive: boolean }[] } }>(
    `query { locations(first: 20) { nodes { id name isActive } } }`,
  );
  return data.locations.nodes;
}
