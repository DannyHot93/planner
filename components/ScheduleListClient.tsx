"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ScheduleRecord } from "@/lib/types";
import { RecordRemoveProvider } from "./RecordDeleteContext";
import HomeDashboardView from "./HomeDashboardView";
import RecordingWeekView from "./RecordingWeekView";
import WorkScheduleWeekView from "./WorkScheduleWeekView";
import VacationWeekView from "./VacationWeekView";

const REMOVED_IDS_STORAGE = "planner_removed_ids_v1";
/** GitHub/Next 캐시가 따라잡지 못한 짧은 창 동안 삭제 묘비 유지 */
const REMOVED_TOMBSTONE_TTL_MS = 10 * 60 * 1000;

/** 백그라운드에서 주기적 갱신(새로고침 대신) */
const POLL_INTERVAL_MS = 90_000;

/** Google 캘린더 기본 진입(계정·뷰는 로그인 세션에 맡김) */
const GOOGLE_CALENDAR_WEB_URL = "https://calendar.google.com/calendar";

const UI_STATE_STORAGE = "planner_home_ui_v1";

interface PersistedUiState {
  activeTab: TabValue;
  editMode: boolean;
}

function isTabValue(v: unknown): v is TabValue {
  return (
    v === "schedule" ||
    v === "work-schedule" ||
    v === "vacation" ||
    v === "office-schedule" ||
    v === "production-schedule"
  );
}

function readUiState(): PersistedUiState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(UI_STATE_STORAGE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedUiState>;
    if (!parsed || typeof parsed !== "object") return null;
    const tab = isTabValue(parsed.activeTab) ? parsed.activeTab : "schedule";
    return {
      activeTab: tab,
      editMode: Boolean(parsed.editMode),
    };
  } catch {
    return null;
  }
}

function writeUiState(state: PersistedUiState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(UI_STATE_STORAGE, JSON.stringify(state));
  } catch {
    /* private 모드 등 */
  }
}

type TombstoneMap = Record<string, number>;

function readTombstones(): TombstoneMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(REMOVED_IDS_STORAGE);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: TombstoneMap = {};
    const now = Date.now();
    for (const [id, expireAt] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof expireAt === "number" && expireAt > now) {
        out[id] = expireAt;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeTombstones(map: TombstoneMap): void {
  if (typeof window === "undefined") return;
  try {
    if (Object.keys(map).length === 0) {
      sessionStorage.removeItem(REMOVED_IDS_STORAGE);
    } else {
      sessionStorage.setItem(REMOVED_IDS_STORAGE, JSON.stringify(map));
    }
  } catch {
    /* private 모드 등 */
  }
}

type TabValue =
  | "schedule"
  | "work-schedule"
  | "vacation"
  | "office-schedule"
  | "production-schedule";

const TABS: { value: TabValue; label: string }[] = [
  { value: "schedule", label: "일정" },
  { value: "work-schedule", label: "근무표" },
  { value: "vacation", label: "휴가" },
  { value: "office-schedule", label: "사무실일정" },
  { value: "production-schedule", label: "제작일정" },
];

const uploadButtonClass =
  "inline-flex shrink-0 items-center gap-1 px-2.5 py-1 sm:px-3 bg-[#4361DE] text-white rounded-md text-xs sm:text-sm font-semibold hover:bg-[#3551c0] transition-colors shadow shadow-[#4361DE]/30 ring-1 ring-white/10";

const editButtonClass = (on: boolean) =>
  `inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 sm:px-2.5 text-xs sm:text-sm font-semibold transition-colors ${
    on
      ? "border-[#CD366D]/60 bg-[#CD366D]/15 text-[#f7c5d6] hover:bg-[#CD366D]/25"
      : "border-white/10 bg-white/5 text-gray-100 hover:bg-white/10"
  }`;

type LoadStatus = "loading" | "ok" | "error";

async function fetchPlannerData(): Promise<{
  allRecords: ScheduleRecord[];
  castingRecords: ScheduleRecord[];
}> {
  const res = await fetch("/api/planner-data", {
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof (err as { error?: string }).error === "string"
        ? (err as { error: string }).error
        : "일정을 불러오지 못했습니다."
    );
  }
  return res.json() as Promise<{
    allRecords: ScheduleRecord[];
    castingRecords: ScheduleRecord[];
  }>;
}

export default function ScheduleListClient() {
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [records, setRecords] = useState<ScheduleRecord[]>([]);
  const [castingRecords, setCastingRecords] = useState<ScheduleRecord[]>([]);

  const [activeTab, setActiveTab] = useState<TabValue>("schedule");
  const [editMode, setEditMode] = useState(false);
  /**
   * 삭제 직후 서버 캐시(GitHub/Next ISR)가 따라잡지 못해도 목록에서 계속 숨김.
   * sessionStorage에 저장해 업로드 탭 등으로 전체 이동 후 돌아와도 유지됨.
   */
  const [tombstones, setTombstones] = useState<TombstoneMap>({});
  /** 세션 UI 상태가 복원될 때까지 저장 훅을 건너뛴다 */
  const [uiHydrated, setUiHydrated] = useState(false);

  useEffect(() => {
    setTombstones(readTombstones());
    const ui = readUiState();
    if (ui) {
      setActiveTab(ui.activeTab);
      setEditMode(ui.editMode);
    }
    setUiHydrated(true);
  }, []);

  const applyPayload = useCallback((payload: { allRecords: ScheduleRecord[]; castingRecords: ScheduleRecord[] }) => {
    setRecords(payload.allRecords);
    setCastingRecords(payload.castingRecords);
    setLoadStatus("ok");
    setLoadError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPlannerData();
        if (!cancelled) applyPayload(data);
      } catch (e) {
        if (!cancelled) {
          setLoadStatus("error");
          setLoadError(e instanceof Error ? e.message : "일정을 불러오지 못했습니다.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyPayload]);

  /** 탭 복귀·주기 폴링으로 다른 기기의 업로드 반영(F5 의존 완화) */
  useEffect(() => {
    if (loadStatus !== "ok") return;

    const run = () => {
      fetchPlannerData()
        .then(applyPayload)
        .catch(() => {
          /* 조용히 무시, 다음 폴링에서 재시도 */
        });
    };

    const id = window.setInterval(run, POLL_INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadStatus, applyPayload]);

  useEffect(() => {
    if (!uiHydrated) return;
    writeUiState({ activeTab, editMode });
  }, [uiHydrated, activeTab, editMode]);

  const markRecordRemoved = useCallback((id: string) => {
    setTombstones((prev) => {
      const next: TombstoneMap = { ...prev, [id]: Date.now() + REMOVED_TOMBSTONE_TTL_MS };
      writeTombstones(next);
      return next;
    });
  }, []);

  /** 서버에서 이미 사라진 id, 혹은 TTL 만료된 id는 묘비에서 제거 (최초 로드 전에는 records=[]이므로 스킵) */
  useEffect(() => {
    if (loadStatus !== "ok") return;
    setTombstones((prev) => {
      const now = Date.now();
      const present = new Set(records.map((r) => r.id));
      let changed = false;
      const next: TombstoneMap = {};
      for (const [id, expireAt] of Object.entries(prev)) {
        if (expireAt <= now) {
          changed = true;
          continue;
        }
        if (!present.has(id)) {
          changed = true;
          continue;
        }
        next[id] = expireAt;
      }
      if (!changed) return prev;
      writeTombstones(next);
      return next;
    });
  }, [records, loadStatus]);

  useEffect(() => {
    if (activeTab !== "schedule") setEditMode(false);
  }, [activeTab]);

  const visibleRecords = useMemo(
    () => records.filter((r) => !(r.id in tombstones)),
    [records, tombstones]
  );

  const officeRecords = visibleRecords.filter((r) => r.type === "office-schedule");
  const productionRecords = visibleRecords.filter(
    (r) => r.type === "production-schedule" || (r.type as string) === "recording"
  );
  const workScheduleRecords = visibleRecords.filter((r) => r.type === "work-schedule");
  const vacationRecords = visibleRecords.filter((r) => r.type === "vacation");

  if (loadStatus === "loading") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-gray-400">
        <p className="text-sm">일정 불러오는 중…</p>
      </div>
    );
  }

  if (loadStatus === "error") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-red-300">{loadError ?? "오류가 발생했습니다."}</p>
        <button
          type="button"
          onClick={() => {
            setLoadStatus("loading");
            setLoadError(null);
            fetchPlannerData()
              .then(applyPayload)
              .catch((e) => {
                setLoadStatus("error");
                setLoadError(e instanceof Error ? e.message : "다시 시도해 주세요.");
              });
          }}
          className="rounded-md bg-[#4361DE] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3551c0]"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <RecordRemoveProvider value={markRecordRemoved}>
      <header
        className="sticky top-0 z-40 mb-2 -mx-2 sm:-mx-3 lg:-mx-4 xl:-mx-5 2xl:-mx-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#5A2FB7]/40 bg-gradient-to-r from-[#5A2FB7] via-[#5A2FB7]/90 to-[#4361DE]/60 px-3 py-2 shadow-md shadow-[#5A2FB7]/25 backdrop-blur"
      >
        <h1 className="text-base font-bold text-white sm:text-lg lg:shrink-0 drop-shadow">
          일정 플래너
        </h1>

        <nav className="flex min-w-0 flex-1 justify-center" aria-label="일정 구역">
          <div
            role="tablist"
            className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-black/30 p-0.5 shadow-inner ring-1 ring-white/10 [scrollbar-width:thin]"
          >
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-all sm:px-3 sm:text-sm ${
                  activeTab === tab.value
                    ? "bg-white/95 text-[#2a1466] shadow-sm ring-1 ring-white/80"
                    : "text-white/75 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          {activeTab === "schedule" && (
            <>
              <a
                href={GOOGLE_CALENDAR_WEB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 sm:px-2.5 text-xs sm:text-sm font-semibold text-gray-100 hover:bg-white/10 transition-colors"
                aria-label="Google 캘린더 (새 탭)"
              >
                <svg
                  className="h-3.5 w-3.5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                캘린더
              </a>
              <button
                type="button"
                onClick={() => setEditMode((v) => !v)}
                className={editButtonClass(editMode)}
                aria-pressed={editMode}
              >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              {editMode ? "완료" : "편집"}
              </button>
            </>
          )}
          <a href="/submit" className={uploadButtonClass}>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            업로드
          </a>
        </div>
      </header>

      <div className="text-gray-100">
        {activeTab === "schedule" ? (
          <section className="space-y-2" aria-label="사무실·제작 일정과 휴가 요약">
            <HomeDashboardView
              officeRecords={officeRecords}
              productionRecords={productionRecords}
              vacationRecords={vacationRecords}
              editMode={editMode}
            />
          </section>
        ) : activeTab === "office-schedule" ? (
          <RecordingWeekView records={officeRecords} />
        ) : activeTab === "production-schedule" ? (
          <RecordingWeekView records={productionRecords} />
        ) : activeTab === "work-schedule" ? (
          <WorkScheduleWeekView records={workScheduleRecords} castingRecords={castingRecords} />
        ) : (
          <VacationWeekView vacationRecords={vacationRecords} />
        )}
      </div>
    </RecordRemoveProvider>
  );
}
