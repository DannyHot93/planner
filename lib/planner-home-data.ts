import { readFileSync } from "fs";
import { join } from "path";
import type { ScheduleRecord } from "@/lib/types";
import { readRecordsFromGitHub } from "@/lib/github";
import {
  filterRecordingsWeeklyCleanup,
  getTodaySeoulYmd,
} from "@/lib/recording-cleanup";
import { filterPastVacations } from "@/lib/vacation-cleanup";

/**
 * 클라이언트 페이로드 축소를 위해 `details.imageDataUrl`(base64)을 제거하고
 * `hasImage`만 둔다. 이미지는 `imageUrl` 또는 `/api/records/{id}/image`로 로드.
 */
export function stripImageDataUrl(records: ScheduleRecord[]): ScheduleRecord[] {
  return records.map((record) => {
    const details = record.details as Record<string, unknown> | undefined;
    const hasImage =
      typeof details?.imageDataUrl === "string" &&
      (details.imageDataUrl as string).startsWith("data:");
    if (!hasImage) return record;
    const rest: Record<string, unknown> = { ...details };
    delete rest.imageDataUrl;
    rest.hasImage = true;
    return { ...record, details: rest as ScheduleRecord["details"] };
  });
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

  const allRecords: ScheduleRecord[] = stripImageDataUrl(
    [
      ...workSchedules,
      ...vacations,
      ...officeSchedules,
      ...productionSchedules,
      ...legacyRecordings,
    ].sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )
  );

  const castingRecords = stripImageDataUrl(castingSchedules);

  return { allRecords, castingRecords };
}
