import { readFileSync } from "fs";
import { join } from "path";
import { ScheduleRecord } from "@/lib/types";
import ScheduleListClient from "@/components/ScheduleListClient";
import { readRecordsFromGitHub } from "@/lib/github";
import {
  filterRecordingsWeeklyCleanup,
  getTodaySeoulYmd,
} from "@/lib/recording-cleanup";
import { filterPastVacations } from "@/lib/vacation-cleanup";

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

/**
 * ISR: 300초 캐시. 등록·삭제·수정 시 revalidatePlannerHome()로 태그+경로 무효화.
 */
export const revalidate = 300;

export const metadata = {
  title: "일정 플래너",
  description: "근무표, 휴가, 사무실·제작 일정을 한눈에 확인하세요.",
};

export default async function HomePage() {
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
    <div className="min-h-screen bg-black">
      <div className="w-full max-w-none mx-auto px-2 sm:px-3 lg:px-4 xl:px-5 2xl:px-6">
        <ScheduleListClient records={allRecords} castingRecords={castingSchedules} />
      </div>
    </div>
  );
}
