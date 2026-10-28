// Browser-side: turns a picked photo into the three JPEG sizes the library uses (480, 1,400 and 3,000
// px on the long edge, like export-web), each kept under what the upload route accepts.

const SIZES = [
  { key: "thumb", edge: 480, maxBytes: 280_000 },
  { key: "large", edge: 1400, maxBytes: 1_400_000 },
  { key: "full", edge: 3000, maxBytes: 2_900_000 },
] as const;

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality),
  );
}

export type Resized = { thumb: Blob; large: Blob; full: Blob; w: number; h: number; largeW: number; largeH: number };

/** Throws when the browser can't read the file (for example a HEIC in Chrome). */
export async function resizePhoto(file: File): Promise<Resized> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const out: Partial<Record<(typeof SIZES)[number]["key"], Blob>> = {};
  const dims: Record<string, [number, number]> = {};
  for (const { key, edge, maxBytes } of SIZES) {
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    let quality = 0.88;
    let blob = await toJpeg(canvas, quality);
    while (blob.size > maxBytes && quality > 0.4) {
      quality -= 0.08;
      blob = await toJpeg(canvas, quality);
    }
    if (blob.size > maxBytes) throw new Error("too large");
    out[key] = blob;
    dims[key] = [w, h];
  }
  bitmap.close();
  return {
    thumb: out.thumb!, large: out.large!, full: out.full!,
    w: dims.full[0], h: dims.full[1], largeW: dims.large[0], largeH: dims.large[1],
  };
}
