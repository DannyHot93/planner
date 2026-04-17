import { readFileSync } from "fs";
import { join } from "path";
import { ScheduleRecord } from "@/lib/types";
import ScheduleListClient from "@/components/ScheduleListClient";
import { readRecordsFromGitHub, overwriteFileOnGitHub } from "@/lib/github";
import {
  filterRecordingsWeeklyCleanup,
  getTodaySeoulYmd,
} from "@/lib/recording-cleanup";

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

/** 사무실/제작/레거시 녹화 JSON: 직전 주 정리 후 GitHub 반영 (변경 시, GitHub 연동 시만) */
async function cleanupOldRecordingsFile(
  records: ScheduleRecord[],
  githubPath: string,
  label: string
): Promise<ScheduleRecord[]> {
  if (!hasGithubEnv()) return records;

  const filtered = filterRecordingsWeeklyCleanup(records);

  if (filtered.length < records.length) {
    try {
      await overwriteFileOnGitHub(
        githubPath,
        filtered,
        `[자동] 직전 주 ${label} 정리 - ${getTodaySeoulYmd()}`
      );
    } catch (e) {
      console.error(`이전 주 ${label} 정리 실패:`, e);
      return records;
    }
  }
  return filtered;
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "일정 플래너",
  description: "근무표, 휴가, 사무실·제작 일정을 한눈에 확인하세요.",
};

export default async function HomePage() {
  const [
    workSchedules,
    vacations,
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

  const [officeSchedules, productionSchedules, legacyRecordings] = await Promise.all([
    cleanupOldRecordingsFile(rawOfficeSchedules, "data/office-schedules.json", "사무실일정"),
    cleanupOldRecordingsFile(
      rawProductionSchedules,
      "data/production-schedules.json",
      "제작일정"
    ),
    cleanupOldRecordingsFile(rawLegacyRecordings, "data/recordings.json", "녹화일정(레거시)"),
  ]);

  const allRecords: ScheduleRecord[] = [
    ...workSchedules,
    ...vacations,
    ...officeSchedules,
    ...productionSchedules,
    ...legacyRecordings,
  ].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="w-full max-w-none mx-auto px-3 sm:px-5 lg:px-6 xl:px-8 2xl:px-10 py-10 sm:py-12">
        <ScheduleListClient records={allRecords} castingRecords={castingSchedules} />
      </div>
    </div>
  );
}
