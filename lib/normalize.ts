import { v4 as uuidv4 } from "uuid";
import {
  AiAnalysisResult,
  DocumentType,
  ScheduleEntry,
  ScheduleRecord,
  VacationKind,
  WorkScheduleKind,
} from "./types";
import { addDaysYmd, toSeoulDateYmd } from "./seoul-week";

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
  workScheduleKind: WorkScheduleKind = "office",
  vacationKind: VacationKind = "office"
): AiAnalysisResult {
  const m = memo.trim();
  const firstLine = m.split("\n")[0].slice(0, 120);
  const summary = firstLine || m.slice(0, 200);

  if (documentType === "office-schedule" || documentType === "production-schedule") {
    return {
      summary,
      details: {
        title: firstLine || "메모 등록",
        entries: [{ note: m }] as ScheduleEntry[],
      },
    };
  }
  if (documentType === "vacation") {
    return {
      summary,
      details: {
        vacationKind,
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

/** 녹화일정 폼(이미지 없음) → 저장용 구조 */
export function buildRecordingFormAiResult(
  program: string,
  dateYmd: string,
  time: string,
  place: string,
  note: string,
  scheduleType: "office" | "production" = "production"
): AiAnalysisResult {
  const p = program.trim();
  const d = dateYmd.trim();
  const summary = `${p} · ${d}${time.trim() ? ` ${time.trim()}` : ""}`;
  return {
    summary,
    details: {
      title: p,
      program: p,
      scheduleType,
      entries: [
        {
          date: d,
          time: time.trim() || undefined,
          place: place.trim() || undefined,
          note: note.trim() || undefined,
        },
      ],
    },
  };
}

/** 이미지+AI 분석 후 폼에 입력된 값을 반영 (날짜·프로그램 우선) */
export function mergeRecordingFormOverlay(
  aiResult: AiAnalysisResult,
  form: {
    program: string;
    dateYmd: string;
    time: string;
    place: string;
    note: string;
  }
): AiAnalysisResult {
  const p = form.program.trim();
  const d = form.dateYmd.trim();
  const hasForm = Boolean(
    p || d || form.time.trim() || form.place.trim() || form.note.trim()
  );
  if (!hasForm) return aiResult;

  const details = { ...(aiResult.details as Record<string, unknown>) };
  if (p) {
    details.title = p;
    details.program = p;
  }
  const entries = Array.isArray(details.entries) ? [...details.entries] : [];
  if (d) {
    const ymd = toSeoulDateYmd(d) || d.slice(0, 10);
    const formEntry: ScheduleEntry = {
      date: ymd,
      time: form.time.trim() || undefined,
      place: form.place.trim() || undefined,
      note: form.note.trim() || undefined,
    };
    details.entries = [formEntry, ...entries];
  } else {
    details.entries = entries;
  }
  return {
    summary: aiResult.summary,
    details,
  };
}

function eachDayInclusive(startYmd: string, endYmd: string): string[] {
  if (startYmd > endYmd) return [];
  const out: string[] = [];
  let cur = startYmd;
  for (let i = 0; i < 400; i++) {
    out.push(cur);
    if (cur === endYmd) break;
    cur = addDaysYmd(cur, 1);
  }
  return out;
}

/** 휴가 폼(이미지 없음 또는 병합용) — 단일일·연일(시작~종료) */
export function buildVacationFormAiResult(
  person: string,
  vacationKind: VacationKind,
  startYmd: string,
  endYmd: string,
  note: string
): AiAnalysisResult {
  const p = person.trim();
  const n = note.trim();
  const days = eachDayInclusive(startYmd, endYmd);
  const summary = `${p} · ${startYmd}${endYmd !== startYmd ? ` ~ ${endYmd}` : ""}`;
  const entries: ScheduleEntry[] = days.map((date) => ({
    date,
    person: p,
    reason: n || undefined,
    note: n || undefined,
  }));
  return {
    summary,
    details: {
      vacationKind,
      period: `${startYmd} ~ ${endYmd}`,
      entries,
    },
  };
}

/** 이미지+AI 휴가 분석 후 폼(휴가자·기간) 반영 */
export function mergeVacationFormOverlay(
  aiResult: AiAnalysisResult,
  form: {
    person: string;
    startYmd: string;
    endYmd: string;
    note: string;
  },
  vacationKind: VacationKind
): AiAnalysisResult {
  const p = form.person.trim();
  const hasForm = Boolean(
    p || form.startYmd.trim() || form.endYmd.trim() || form.note.trim()
  );
  if (!hasForm) return aiResult;

  const details = { ...(aiResult.details as Record<string, unknown>) };
  details.vacationKind = vacationKind;

  if (form.startYmd.trim()) {
    const start = toSeoulDateYmd(form.startYmd) || form.startYmd.slice(0, 10);
    const endRaw = form.endYmd.trim() ? form.endYmd : form.startYmd;
    const end = toSeoulDateYmd(endRaw) || endRaw.slice(0, 10);
    if (start <= end) {
      const days = eachDayInclusive(start, end);
      const formEntries: ScheduleEntry[] = days.map((date) => ({
        date,
        person: p || undefined,
        reason: form.note.trim() || undefined,
        note: form.note.trim() || undefined,
      }));
      const existing = Array.isArray(details.entries) ? details.entries : [];
      details.entries = [...formEntries, ...existing];
    }
  }

  return {
    summary: aiResult.summary,
    details,
  };
}

  const TYPE_PREFIX: Record<DocumentType, string> = {
  "work-schedule": "ws",
  vacation: "vac",
  "office-schedule": "os",
  "production-schedule": "ps",
  "casting-schedule": "cast",
};

export function normalizeRecord(
  aiResult: AiAnalysisResult,
  documentType: DocumentType,
  memo: string
): ScheduleRecord {
  const timestamp = Date.now();
  const prefix = TYPE_PREFIX[documentType];
  const id = `${prefix}_${timestamp}_${uuidv4().slice(0, 8)}`;

  const seoulTodayYmd = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
  }).format(new Date());

  let details: AiAnalysisResult["details"] = aiResult.details;
  if (documentType === "office-schedule" || documentType === "production-schedule") {
    const d = aiResult.details as Record<string, unknown>;
    if (Array.isArray(d.entries)) {
      details = {
        ...d,
        entries: d.entries.map((e) => {
          if (!e || typeof e !== "object") return e;
          const raw = (e as { date?: string | null }).date;
          const s = raw == null ? "" : String(raw).trim();
          if (s === "" || s === "null") {
            return { ...(e as object), date: seoulTodayYmd };
          }
          const ymd = toSeoulDateYmd(s) || s.slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
            return { ...(e as object), date: ymd };
          }
          return { ...(e as object), date: seoulTodayYmd };
        }),
      } as AiAnalysisResult["details"];
    }
  } else if (documentType === "vacation") {
    const d = aiResult.details as Record<string, unknown>;
    if (Array.isArray(d.entries)) {
      details = {
        ...d,
        entries: d.entries.map((e) => {
          if (!e || typeof e !== "object") return e;
          const raw = (e as { date?: string | null }).date;
          if (raw == null) return e;
          const s = String(raw).trim();
          if (s === "" || s === "null") return e;
          const ymd = toSeoulDateYmd(s);
          return ymd ? { ...(e as object), date: ymd } : e;
        }),
      } as AiAnalysisResult["details"];
    }
  }

  return {
    id,
    type: documentType,
    uploadedAt: new Date().toISOString(),
    memo: memo.trim(),
    summary: aiResult.summary,
    details,
  };
}

export const DATA_FILE_MAP: Record<DocumentType, string> = {
  "work-schedule": "data/work-schedules.json",
  vacation: "data/vacations.json",
  "office-schedule": "data/office-schedules.json",
  "production-schedule": "data/production-schedules.json",
  "casting-schedule": "data/casting-schedules.json",
};

/** record id 접두사(ws_/vac_/os_/ps_/cast_/rec_)로 JSON 파일 경로 결정 */
export function getFilePathFromRecordId(id: string): string | null {
  if (id.startsWith("ws_")) return DATA_FILE_MAP["work-schedule"];
  if (id.startsWith("vac_")) return DATA_FILE_MAP["vacation"];
  if (id.startsWith("os_")) return DATA_FILE_MAP["office-schedule"];
  if (id.startsWith("ps_")) return DATA_FILE_MAP["production-schedule"];
  if (id.startsWith("cast_")) return DATA_FILE_MAP["casting-schedule"];
  /** 구 녹화일정 id 접두사 */
  if (id.startsWith("rec_")) return "data/recordings.json";
  return null;
}

export function getCommitMessage(
  documentType: DocumentType,
  date: string
): string {
  const typeLabel: Record<DocumentType, string> = {
    "work-schedule": "근무표",
    vacation: "휴가",
    "office-schedule": "사무실일정",
    "production-schedule": "제작일정",
    "casting-schedule": "주조근무표",
  };
  return `[자동] ${typeLabel[documentType]} 업데이트 - ${date}`;
}
