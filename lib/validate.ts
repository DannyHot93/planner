import {
  AiAnalysisResult,
  DocumentType,
  WorkScheduleKind,
  VacationKind,
} from "./types";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateAiResult(
  result: unknown,
  documentType: DocumentType
): AiAnalysisResult {
  if (!result || typeof result !== "object") {
    throw new ValidationError("AI 응답이 올바른 객체 형식이 아닙니다.");
  }

  const obj = result as Record<string, unknown>;

  if (typeof obj.summary !== "string" || obj.summary.trim() === "") {
    throw new ValidationError("AI 응답에 summary 필드가 없거나 비어있습니다.");
  }

  if (!obj.details || typeof obj.details !== "object") {
    throw new ValidationError("AI 응답에 details 필드가 없습니다.");
  }

  const details = obj.details as Record<string, unknown>;

  if (
    documentType === "work-schedule" ||
    documentType === "vacation" ||
    documentType === "office-schedule" ||
    documentType === "production-schedule" ||
    documentType === "casting-schedule"
  ) {
    if (!Array.isArray(details.entries)) {
      details.entries = [];
    }
  }

  return {
    summary: obj.summary.trim(),
    details: details,
  };
}

const IMAGE_MIME_ALLOWLIST = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/x-ms-bmp",
] as const;

export function validateImageFile(file: File): void {
  const byMime = IMAGE_MIME_ALLOWLIST.includes(
    file.type as (typeof IMAGE_MIME_ALLOWLIST)[number]
  );
  const bmpByExt =
    /\.bmp$/i.test(file.name) &&
    (!file.type || file.type === "application/octet-stream");
  if (!byMime && !bmpByExt) {
    throw new ValidationError(
      "지원하지 않는 파일 형식입니다. JPEG, PNG, WEBP, GIF, BMP만 허용됩니다."
    );
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new ValidationError("파일 크기가 10MB를 초과합니다.");
  }
}

/** data URL / AI API용. MIME이 비었거나 octet-stream일 때 확장자로 보정 */
export function inferImageMimeType(file: File): string {
  const t = file.type;
  if (t === "image/x-ms-bmp") return "image/bmp";
  if (t && t !== "application/octet-stream" && t.startsWith("image/")) return t;
  const n = file.name.toLowerCase();
  if (n.endsWith(".bmp")) return "image/bmp";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".webp")) return "image/webp";
  if (/\.(jpe?g)$/i.test(n)) return "image/jpeg";
  if (t && t.startsWith("image/")) return t;
  return t || "image/jpeg";
}

const WORK_SCHEDULE_TYPES = [
  ...IMAGE_MIME_ALLOWLIST,
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/** 근무표: 이미지·PDF·docx */
/** macOS/Windows 등에서 xls MIME이 octet-stream·레거시 타입으로 오는 경우가 많음 */
const VACATION_SPREADSHEET_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/excel",
  "application/x-excel",
  "application/x-msexcel",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
]);

/**
 * 파일명·MIME이 빈약할 때(xls가 octet-stream 등) 엑셀 경로로 보내기 위한 시그니처.
 * - xlsx: ZIP(50 4B 03 04)
 * - 구 xls: OLE 복합문서(D0 CF 11 E0 …) — 워드 등도 OLE라 오탐 가능, 휴가 엑셀 분기에서만 사용.
 */
export function bufferLooksLikeSpreadsheetBuffer(buf: Buffer): boolean {
  if (buf.length < 8) return false;
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return true;
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) return true;
  return false;
}

function isVacationSpreadsheetFile(file: File): boolean {
  const n = file.name.toLowerCase();
  if (n.endsWith(".xlsx") || n.endsWith(".xls")) return true;
  const t = file.type;
  return Boolean(t && VACATION_SPREADSHEET_MIMES.has(t));
}

/** 휴가: 이미지 또는 엑셀(.xlsx/.xls) — bufferHint는 시그니처로만 사용 */
export function validateVacationUploadFile(file: File, bufferHint?: Buffer): void {
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new ValidationError("파일 크기가 10MB를 초과합니다.");
  }
  if (isVacationSpreadsheetFile(file)) {
    return;
  }
  if (bufferHint && bufferLooksLikeSpreadsheetBuffer(bufferHint)) {
    return;
  }
  validateImageFile(file);
}

export type VacationUploadCategory = "image" | "spreadsheet";

export function getVacationFileCategory(
  file: File,
  bufferHint?: Buffer
): VacationUploadCategory {
  if (isVacationSpreadsheetFile(file)) return "spreadsheet";
  if (bufferHint && bufferLooksLikeSpreadsheetBuffer(bufferHint)) return "spreadsheet";
  return "image";
}

export function validateWorkScheduleUploadFile(file: File): void {
  const name = file.name.toLowerCase();
  const okMime = WORK_SCHEDULE_TYPES.includes(file.type);
  const okExt =
    name.endsWith(".pdf") ||
    name.endsWith(".docx") ||
    /\.(jpe?g|png|webp|gif|bmp)$/i.test(name);
  if (!okMime && !okExt) {
    throw new ValidationError(
      "근무표는 이미지(JPEG, PNG, WEBP, GIF, BMP), PDF, Word(.docx)만 업로드할 수 있습니다."
    );
  }
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new ValidationError("파일 크기가 10MB를 초과합니다.");
  }
}

export function getWorkScheduleFileCategory(
  file: File
): "image" | "pdf" | "docx" {
  const t = file.type;
  const n = file.name.toLowerCase();
  if (t.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp)$/i.test(n)) {
    return "image";
  }
  if (t === "application/pdf" || n.endsWith(".pdf")) {
    return "pdf";
  }
  if (
    t === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    n.endsWith(".docx")
  ) {
    return "docx";
  }
  throw new ValidationError(
    "근무표 파일 형식을 확인할 수 없습니다. 이미지, PDF, docx만 지원합니다."
  );
}

export function parseWorkScheduleKind(raw: string | null): WorkScheduleKind {
  if (raw === "production") return "production";
  return "office";
}

export function parseScheduleType(raw: string | null): "office" | "production" {
  if (raw === "production") return "production";
  return "office";
}

export function parseVacationKind(raw: string | null): VacationKind {
  if (raw === "production") return "production";
  if (raw === "casting") return "casting";
  return "office";
}

export function validateDocumentType(type: string): DocumentType {
  const validTypes: DocumentType[] = ["work-schedule", "vacation", "office-schedule", "production-schedule", "casting-schedule"];
  if (!validTypes.includes(type as DocumentType)) {
    throw new ValidationError(
      `올바르지 않은 문서 종류입니다. (work-schedule, vacation, office-schedule, production-schedule, casting-schedule 중 하나)`
    );
  }
  return type as DocumentType;
}
