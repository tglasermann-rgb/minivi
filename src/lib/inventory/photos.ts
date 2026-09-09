import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";
import { downloadFile, findPhotosForSku } from "@/lib/drive";
import { uploadToBucket } from "@/lib/storage";

export const PRODUCT_IMAGES_BUCKET = "product-images";

/**
 * Busca las fotos de un producto en Drive, las copia al bucket público
 * `product-images` (así Shopify puede descargarlas) y las guarda en product_images.
 * Devuelve cuántas fotos quedaron.
 */
export async function syncPhotosFromDrive(productId: string): Promise<{ found: number; added: number }> {
  const settings = await getSettings();
  const rootId = settings.drive_root_folder_id;
  if (!rootId) throw new Error("Falta el ID de la carpeta raíz de Drive en Configuración.");
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId }, include: { images: true } });
  const user = await getCurrentUser();

  const files = await findPhotosForSku(rootId, product.sku);
  let added = 0;
  let position = 1;
  for (const f of files) {
    const existing = product.images.find((i) => i.driveFileId === f.id || i.fileName === f.name);
    if (existing) {
      if (existing.position !== position) await prisma.productImage.update({ where: { id: existing.id }, data: { position } });
      position++;
      continue;
    }
    const { bytes, contentType } = await downloadFile(f.id);
    const ext = (f.name.split(".").pop() ?? "jpg").toLowerCase();
    const path = `${product.sku}/${f.name.replace(/[^A-Za-z0-9._-]/g, "_")}`;
    const publicUrl = await uploadToBucket(PRODUCT_IMAGES_BUCKET, path, bytes, contentType || `image/${ext}`, true);
    await prisma.productImage.create({
      data: { productId, driveFileId: f.id, fileName: f.name, publicUrl, position, createdBy: user?.id ?? null },
    });
    added++;
    position++;
  }
  return { found: files.length, added };
}
