import * as XLSX from "xlsx";

const MAX_CHARS = 120_000;

/**
 * pdfjs-dist는 모듈 평가 시점에 DOMMatrix/Path2D/ImageData를 참조한다.
 * Vercel Node 런타임에는 이 전역들이 없어 `ReferenceError: DOMMatrix is not defined`가 난다.
 * 텍스트 추출에는 실제 기하 연산이 쓰이지 않으므로 stub만 주입해도 안전하다.
 * (getScreenshot 등 실제 canvas 렌더링은 Node 환경에서 try/catch로 감싸 실패 시 null 반환)
 */
function installPdfJsPolyfills(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.DOMMatrix === "undefined") {
    class DOMMatrixStub {
      constructor(..._args: unknown[]) {}
    }
    g.DOMMatrix = DOMMatrixStub;
  }
  if (typeof g.Path2D === "undefined") {
    class Path2DStub {
      constructor(..._args: unknown[]) {}
    }
    g.Path2D = Path2DStub;
  }
  if (typeof g.ImageData === "undefined") {
    class ImageDataStub {
      constructor(..._args: unknown[]) {}
    }
    g.ImageData = ImageDataStub;
  }
}

async function loadPdfParseClass(): Promise<typeof import("pdf-parse").PDFParse> {
  installPdfJsPolyfills();
  const mod = await import("pdf-parse");
  return mod.PDFParse;
}

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const PDFParse = await loadPdfParseClass();
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

/** PDF 첫 페이지를 PNG data URL로 렌더 (근무표 미리보기용) — Node 환경에서 실패하면 null */
export async function renderPdfFirstPageDataUrl(buffer: Buffer): Promise<string | null> {
  try {
    const PDFParse = await loadPdfParseClass();
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const shot = await parser.getScreenshot({
        partial: [1],
        imageDataUrl: true,
        imageBuffer: false,
        desiredWidth: 1400,
      });
      return shot.pages[0]?.dataUrl ?? null;
    } finally {
      await parser.destroy();
    }
  } catch (e) {
    console.error("PDF 미리보기 렌더 실패:", e);
    return null;
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
