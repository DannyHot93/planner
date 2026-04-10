import { v4 as uuidv4 } from "uuid";
import {
  AiAnalysisResult,
  DocumentType,
  ScheduleRecord,
  WorkScheduleKind,
} from "./types";

/** AI/메모 결과에 근무표 종류를 서버에서 확정합니다. */
export function ensureWorkScheduleKindInDetails(
  aiResult: AiAnalysisResult,
  kind: WorkScheduleKind
): void {
  const d = aiResult.details as Record<string, unknown>;
  d.scheduleKind = kind;
}

/** 이미지 없이 메모만 입력했을 때 저장용 구조 (AI 호출 없음) */
export function buildMemoOnlyAiResult(
  memo: string,
  documentType: DocumentType,
  workScheduleKind: WorkScheduleKind = "office"
): AiAnalysisResult {
  const m = memo.trim();
  const firstLine = m.split("\n")[0].slice(0, 120);
  const summary = firstLine || m.slice(0, 200);

  if (documentType === "recording") {
    return {
      summary,
      details: {
        title: firstLine || "메모 등록",
        entries: [{ note: m }],
      },
    };
  }
  if (documentType === "vacation") {
    return {
      summary,
      details: {
        entries: [{ note: m, reason: m }],
      },
    };
  }
  if (documentType === "work-schedule") {
    return {
      summary,
      details: {
        scheduleKind: workScheduleKind,
        entries: [{ note: m }],
      },
    };
  }
  return {
    summary,
    details: {
      entries: [{ note: m }],
    },
  };
}

const TYPE_PREFIX: Record<DocumentType, string> = {
  "work-schedule": "ws",
  vacation: "vac",
  recording: "rec",
};

export function normalizeRecord(
  aiResult: AiAnalysisResult,
  documentType: DocumentType,
  memo: string
): ScheduleRecord {
  const timestamp = Date.now();
  const prefix = TYPE_PREFIX[documentType];
  const id = `${prefix}_${timestamp}_${uuidv4().slice(0, 8)}`;

  return {
    id,
    type: documentType,
    uploadedAt: new Date().toISOString(),
    memo: memo.trim(),
    summary: aiResult.summary,
    details: aiResult.details,
  };
}

export const DATA_FILE_MAP: Record<DocumentType, string> = {
  "work-schedule": "data/work-schedules.json",
  vacation: "data/vacations.json",
  recording: "data/recordings.json",
};

/** record id 접두사(ws_/vac_/rec_)로 JSON 파일 경로 결정 */
export function getFilePathFromRecordId(id: string): string | null {
  if (id.startsWith("ws_")) return DATA_FILE_MAP["work-schedule"];
  if (id.startsWith("vac_")) return DATA_FILE_MAP["vacation"];
  if (id.startsWith("rec_")) return DATA_FILE_MAP["recording"];
  return null;
}

export function getCommitMessage(
  documentType: DocumentType,
  date: string
): string {
  const typeLabel: Record<DocumentType, string> = {
    "work-schedule": "근무표",
    vacation: "휴가",
    recording: "녹화일정",
  };
  return `[자동] ${typeLabel[documentType]} 업데이트 - ${date}`;
}
