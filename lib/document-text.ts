import mammoth from "mammoth";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const MAX_CHARS = 120_000;

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const uint8Array = new Uint8Array(buffer);
  const loadingTask = getDocument({ data: uint8Array });
  const pdf = await loadingTask.promise;
  let fullText = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const parts = content.items.map((item) =>
      item && typeof item === "object" && "str" in item
        ? String((item as { str: string }).str)
        : ""
    );
    fullText += parts.join(" ") + "\n";
  }
  const text = fullText.trim();
  if (!text) {
    throw new Error(
      "PDF에서 텍스트를 읽지 못했습니다. 스캔 PDF는 이미지로 저장한 뒤 올려 주세요."
    );
  }
  return text.slice(0, MAX_CHARS);
}

export async function extractTextFromDocxBuffer(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  const text = (result.value ?? "").trim();
  if (!text) {
    throw new Error("워드 문서에서 텍스트를 읽지 못했습니다.");
  }
  return text.slice(0, MAX_CHARS);
}
