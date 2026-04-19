import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";

const MAX_CHARS = 120_000;

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const text = (result.text ?? "").trim();
    if (!text) {
      throw new Error(
        "PDF에서 텍스트를 읽지 못했습니다. 스캔 PDF는 이미지로 저장한 뒤 올려 주세요."
      );
    }
    return text.slice(0, MAX_CHARS);
  } finally {
    await parser.destroy();
  }
}

/** PDF 첫 페이지를 PNG data URL로 렌더 (근무표 미리보기용) */
export async function renderPdfFirstPageDataUrl(buffer: Buffer): Promise<string | null> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const shot = await parser.getScreenshot({
      partial: [1],
      imageDataUrl: true,
      imageBuffer: false,
      desiredWidth: 1400,
    });
    return shot.pages[0]?.dataUrl ?? null;
  } catch (e) {
    console.error("PDF 미리보기 렌더 실패:", e);
    return null;
  } finally {
    await parser.destroy();
  }
}

export async function extractTextFromDocxBuffer(buffer: Buffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ buffer });
  const text = (result.value ?? "").trim();
  if (!text) {
    throw new Error("워드 문서에서 텍스트를 읽지 못했습니다.");
  }
  return text.slice(0, MAX_CHARS);
}

/** 엑셀(.xlsx/.xls) 시트를 CSV 형태 텍스트로 변환 — 휴가 표 AI 분석용 */
export function extractTextFromXlsxBuffer(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet);
    parts.push(`## ${sheetName}\n${csv}`);
  }
  const text = parts.join("\n\n").trim();
  if (!text) {
    throw new Error(
      "엑셀에서 텍스트를 읽지 못했습니다. 데이터가 있는 시트가 있는지 확인해 주세요."
    );
  }
  return text.slice(0, MAX_CHARS);
}
