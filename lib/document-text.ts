import * as XLSX from "xlsx";

const MAX_CHARS = 120_000;

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
