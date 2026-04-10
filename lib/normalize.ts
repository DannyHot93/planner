import { v4 as uuidv4 } from "uuid";
import { AiAnalysisResult, DocumentType, ScheduleRecord } from "./types";

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
