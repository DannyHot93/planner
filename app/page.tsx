import { readFileSync } from "fs";
import { join } from "path";
import { ScheduleRecord, DocumentType } from "@/lib/types";
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

/** 녹화일정: 직전 주 정리 후 GitHub 반영 (변경 시, GitHub 연동 시만) */
async function cleanupOldRecordings(records: ScheduleRecord[]): Promise<ScheduleRecord[]> {
  if (!hasGithubEnv()) return records;

  const filtered = filterRecordingsWeeklyCleanup(records);

  if (filtered.length < records.length) {
    try {
      await overwriteFileOnGitHub(
        "data/recordings.json",
        filtered,
        `[자동] 직전 주 녹화일정 정리 - ${getTodaySeoulYmd()}`
      );
    } catch (e) {
      console.error("이전 주 녹화일정 정리 실패:", e);
      return records;
    }
  }
  return filtered;
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "일정 플래너",
  description: "근무표, 휴가, 녹화일정을 한눈에 확인하세요.",
};

export default async function HomePage() {
  const [workSchedules, vacations, rawRecordings, castingSchedules] = await Promise.all([
    loadRecords("work-schedules.json"),
    loadRecords("vacations.json"),
    loadRecords("recordings.json"),
    loadRecords("casting-schedules.json"),
  ]);

  // 이전 주 녹화일정 자동 정리 (변경 시 GitHub 반영)
  const recordings = await cleanupOldRecordings(rawRecordings);

  const allRecords: ScheduleRecord[] = [
    ...workSchedules,
    ...vacations,
    ...recordings,
  ].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  const stats: Record<DocumentType | "total", number> = {
    total: allRecords.length + castingSchedules.length,
    "work-schedule": workSchedules.length,
    vacation: vacations.length,
    recording: recordings.length,
    "casting-schedule": castingSchedules.length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">일정 플래너</h1>
            <p className="text-gray-500 text-sm mt-1">
              근무표 · 휴가 · 녹화일정을 한눈에 확인하세요
            </p>
          </div>
          <a
            href="/submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            업로드
          </a>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "전체", count: stats.total, color: "bg-gray-800 text-white" },
            { label: "근무표", count: stats["work-schedule"] + stats["casting-schedule"], color: "bg-blue-600 text-white" },
            { label: "휴가", count: stats.vacation, color: "bg-green-600 text-white" },
            { label: "녹화일정", count: stats.recording, color: "bg-purple-600 text-white" },
          ].map((item) => (
            <div key={item.label} className={`${item.color} rounded-xl p-4 text-center`}>
              <div className="text-2xl font-bold">{item.count}</div>
              <div className="text-xs opacity-80 mt-0.5">{item.label}</div>
            </div>
          ))}
        </div>

        {/* 목록 (클라이언트 컴포넌트로 탭 처리) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <ScheduleListClient records={allRecords} castingRecords={castingSchedules} />
        </div>
      </div>
    </div>
  );
}
