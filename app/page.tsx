import { readFileSync } from "fs";
import { join } from "path";
import { ScheduleRecord, DocumentType } from "@/lib/types";
import ScheduleListClient from "@/components/ScheduleListClient";
import { readRecordsFromGitHub, overwriteFileOnGitHub } from "@/lib/github";

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

/** Asia/Seoul 기준 이번 주 월요일 시작 시각 */
function getThisWeekMondaySeoul(): Date {
  const todayStr = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
  }).format(new Date());
  const today = new Date(todayStr + "T00:00:00+09:00");
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7));
  return monday;
}

/** 녹화일정 중 이번 주 이전 항목 제거 후 GitHub 반영 (변경 있을 때만) */
async function cleanupOldRecordings(records: ScheduleRecord[]): Promise<ScheduleRecord[]> {
  if (!hasGithubEnv()) return records;
  const monday = getThisWeekMondaySeoul();

  const filtered = records.filter((record) => {
    const details = record.details as { entries?: { date?: string }[]; period?: string };
    if (Array.isArray(details.entries) && details.entries.length > 0) {
      return details.entries.some((e) => {
        if (!e.date) return false;
        return new Date(e.date.slice(0, 10) + "T00:00:00+09:00") >= monday;
      });
    }
    if (details.period) {
      const match = details.period.match(/\d{4}-\d{2}-\d{2}/);
      if (match) return new Date(match[0] + "T00:00:00+09:00") >= monday;
    }
    return new Date(record.uploadedAt) >= monday;
  });

  if (filtered.length < records.length) {
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
    try {
      await overwriteFileOnGitHub(
        "data/recordings.json",
        filtered,
        `[자동] 이전 주 녹화일정 정리 - ${today}`
      );
    } catch (e) {
      console.error("이전 주 정리 실패:", e);
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
  const [workSchedules, vacations, rawRecordings] = await Promise.all([
    loadRecords("work-schedules.json"),
    loadRecords("vacations.json"),
    loadRecords("recordings.json"),
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
    total: allRecords.length,
    "work-schedule": workSchedules.length,
    vacation: vacations.length,
    recording: recordings.length,
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
            { label: "근무표", count: stats["work-schedule"], color: "bg-blue-600 text-white" },
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
          <ScheduleListClient records={allRecords} />
        </div>
      </div>
    </div>
  );
}
