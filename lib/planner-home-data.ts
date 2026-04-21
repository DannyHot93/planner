import { readFileSync } from "fs";
import { join } from "path";
import type {
  CastingScheduleDetails,
  ScheduleRecord,
  WorkScheduleDetails,
} from "@/lib/types";
import { readRecordsFromGitHub } from "@/lib/github";
import {
  filterRecordingsWeeklyCleanup,
  getTodaySeoulYmd,
} from "@/lib/recording-cleanup";
import { filterPastVacations } from "@/lib/vacation-cleanup";

/**
 * 클라이언트 페이로드 축소: `details.imageDataUrl`(base64) 제거 후 `hasImage` 표시.
 * 접두어 없이 긴 문자열로만 온 경우도 제거해 `/api/planner-data` 응답이 4.5MB 제한을 넘지 않게 한다.
 */
export function stripImageDataUrl(records: ScheduleRecord[]): ScheduleRecord[] {
  return records.map((record) => {
    const details = record.details as Record<string, unknown> | undefined;
    if (!details || typeof details !== "object") return record;
    const raw = details.imageDataUrl;
    if (typeof raw !== "string" || raw.length === 0) return record;
    const looksLikeInlineImage =
      raw.startsWith("data:") || raw.length > 2000;
    if (!looksLikeInlineImage) return record;
    const rest: Record<string, unknown> = { ...details };
    delete rest.imageDataUrl;
    rest.hasImage = true;
    return { ...record, details: rest as ScheduleRecord["details"] };
  });
}

/**
 * 홈 UI에 필요한 필드만 남겨 JSON 크기를 확실히 줄인다 (근무표 `entries` 등 미사용 대용량 제거).
 */
function slimRecordForPlannerApi(record: ScheduleRecord): ScheduleRecord {
  if (record.type === "work-schedule") {
    const d = record.details as WorkScheduleDetails;
    return {
      ...record,
      details: {
        scheduleKind: d.scheduleKind,
        period: d.period,
        imageUrl: d.imageUrl,
        hasImage: d.hasImage,
        imagePreviewSource: d.imagePreviewSource,
      },
    };
  }
  if (record.type === "casting-schedule") {
    const d = record.details as CastingScheduleDetails;
    return {
      ...record,
      details: {
        period: d.period,
        imageUrl: d.imageUrl,
        hasImage: d.hasImage,
        entries: Array.isArray(d.entries) ? d.entries : [],
      },
    };
  }
  return record;
}

export function slimRecordsForPlannerApi(records: ScheduleRecord[]): ScheduleRecord[] {
  return records.map(slimRecordForPlannerApi);
}

function loadRecordsFromDisk(filename: string): ScheduleRecord[] {
  try {
    const filePath = join(process.cwd(), "data", filename);
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as ScheduleRecord[];
  } catch {
    return [];
  }
}

function hasGithubEnv(): boolean {
  return Boolean(
    process.env.GITHUB_TOKEN &&
      process.env.GITHUB_OWNER &&
      process.env.GITHUB_REPO
  );
}

async function loadRecords(filename: string): Promise<ScheduleRecord[]> {
  if (hasGithubEnv()) {
    try {
      return await readRecordsFromGitHub(`data/${filename}`);
    } catch (e) {
      console.error("GitHub 데이터 로드 실패, 로컬 파일 사용:", e);
      return loadRecordsFromDisk(filename);
    }
  }
  return loadRecordsFromDisk(filename);
}

export type PlannerHomePayload = {
  allRecords: ScheduleRecord[];
  castingRecords: ScheduleRecord[];
};

/** 홈·GET /api/planner-data 공통: GitHub 6파일 병합·필터·정렬. */
export async function getPlannerHomePayload(): Promise<PlannerHomePayload> {
  const [
    workSchedules,
    rawVacations,
    rawOfficeSchedules,
    rawProductionSchedules,
    rawLegacyRecordings,
    castingSchedules,
  ] = await Promise.all([
    loadRecords("work-schedules.json"),
    loadRecords("vacations.json"),
    loadRecords("office-schedules.json"),
    loadRecords("production-schedules.json"),
    loadRecords("recordings.json"),
    loadRecords("casting-schedules.json"),
  ]);

  const todayYmd = getTodaySeoulYmd();
  const vacations = filterPastVacations(rawVacations, todayYmd);
  const officeSchedules = filterRecordingsWeeklyCleanup(rawOfficeSchedules);
  const productionSchedules = filterRecordingsWeeklyCleanup(rawProductionSchedules);
  const legacyRecordings = filterRecordingsWeeklyCleanup(rawLegacyRecordings);

  const merged = [
    ...workSchedules,
    ...vacations,
    ...officeSchedules,
    ...productionSchedules,
    ...legacyRecordings,
  ].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  const allRecords: ScheduleRecord[] = slimRecordsForPlannerApi(
    stripImageDataUrl(merged)
  );

  const castingRecords = slimRecordsForPlannerApi(stripImageDataUrl(castingSchedules));

  return { allRecords, castingRecords };
}
