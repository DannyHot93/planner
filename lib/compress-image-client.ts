/**
 * 업로드 전 이미지 압축 — Vercel Serverless 요청 본문 한도(~4.5MB, FUNCTION_PAYLOAD_TOO_LARGE) 회피.
 * Canvas + JPEG 재인코딩. GIF는 건드리지 않음.
 */

const MAX_EDGE_FIRST = 1920;
const MAX_EDGE_FALLBACK = 1280;
const TARGET_MAX_BYTES = 2.8 * 1024 * 1024;
const MIN_SIZE_TO_COMPRESS = 400 * 1024;

/** 미리보기/업로드와 동일: MIME이 빈 BMP 등도 이미지로 취급 */
export function looksLikeRasterImageFile(file: File): boolean {
  return file.type.startsWith("image/") || /\.bmp$/i.test(file.name);
}

/** Canvas JPEG 압축 대상 (GIF는 원본 유지) */
function isRasterImageForCompression(file: File): boolean {
  if (file.type === "image/gif") return false;
  if (file.type.startsWith("image/")) return true;
  if (/\.bmp$/i.test(file.name)) return true;
  return false;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    img.src = src;
  });
}

function canvasToJpegFile(
  canvas: HTMLCanvasElement,
  quality: number,
  baseName: string
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("압축 결과가 없습니다."));
          return;
        }
        const name = `${baseName.replace(/\.[^.]+$/, "") || "upload"}.jpg`;
        resolve(
          new File([blob], name, {
            type: "image/jpeg",
            lastModified: Date.now(),
          })
        );
      },
      "image/jpeg",
      quality
    );
  });
}

async function rasterToJpegFile(
  file: File,
  maxEdge: number,
  quality: number
): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (!w || !h) throw new Error("이미지 크기를 알 수 없습니다.");
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas를 사용할 수 없습니다.");
    ctx.drawImage(img, 0, 0, w, h);
    const base = file.name.replace(/\s+/g, "_").slice(0, 80) || "image";
    return await canvasToJpegFile(canvas, quality, base);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 이미지면 용량을 줄여 서버 한도 안으로 넣는다. 실패 시 원본 파일을 그대로 반환.
 */
export async function compressImageForUploadIfNeeded(file: File): Promise<File> {
  if (!isRasterImageForCompression(file)) return file;
  if (file.size <= MIN_SIZE_TO_COMPRESS) return file;

  try {
    let out = await rasterToJpegFile(file, MAX_EDGE_FIRST, 0.82);
    if (out.size > TARGET_MAX_BYTES) {
      out = await rasterToJpegFile(file, MAX_EDGE_FALLBACK, 0.72);
    }
    if (out.size > TARGET_MAX_BYTES) {
      out = await rasterToJpegFile(file, 1024, 0.65);
    }
    if (out.size >= file.size) return file;
    return out;
  } catch {
    return file;
  }
}
