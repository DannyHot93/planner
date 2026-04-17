import sharp from "sharp";
import { Jimp, JimpMime } from "jimp";
import { ValidationError } from "./validate";

/** OpenAI Vision API가 받는 이미지 타입 (문서 기준) */
const OPENAI_VISION_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

async function toPngBufferWithJimp(buffer: Buffer): Promise<Buffer> {
  const image = await Jimp.read(buffer);
  return Buffer.from(await image.getBuffer(JimpMime.png));
}

/**
 * Vision API에 넘기기 전에 포맷을 맞춥니다.
 * BMP 등은 PNG로 변환합니다(원본 버퍼는 바꾸지 않음).
 * Sharp가 디코딩하지 못하는 BMP는 Jimp로 재시도합니다.
 */
export async function toOpenAiVisionInput(
  buffer: Buffer,
  mimeType: string
): Promise<{ base64: string; mimeType: string }> {
  const normalized = mimeType.toLowerCase().trim();
  if (OPENAI_VISION_MIMES.has(normalized)) {
    return { base64: buffer.toString("base64"), mimeType: normalized };
  }

  try {
    const png = await sharp(buffer).png().toBuffer();
    return { base64: png.toString("base64"), mimeType: "image/png" };
  } catch (sharpErr) {
    try {
      const png = await toPngBufferWithJimp(buffer);
      return { base64: png.toString("base64"), mimeType: "image/png" };
    } catch {
      const reason =
        sharpErr instanceof Error ? sharpErr.message : String(sharpErr);
      throw new ValidationError(
        `이미지를 분석용 형식으로 변환할 수 없습니다. 다른 형식(JPEG, PNG 등)으로 저장한 뒤 다시 올려 주세요. (${reason})`
      );
    }
  }
}
