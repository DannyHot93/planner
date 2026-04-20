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

export default function ScheduleListClient({
  records,
  castingRecords,
}: {
  records: ScheduleRecord[];
  castingRecords: ScheduleRecord[];
}) {
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

  /** 서버에서 이미 사라진 id, 혹은 TTL 만료된 id는 묘비에서 제거 */
  useEffect(() => {
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
  }, [records]);

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
