"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * - `/submit`: 뒤로/앞으로·bfcache 복원 시 전체 새로고침 — 업로드 폼 state가 예전 입력으로 남는 걸 방지
 * - 그 외(`/` 포함): RSC만 soft refresh — 탭·편집 모드·스크롤·UI state는 유지하고 데이터만 갱신
 * - popstate 직후 Next가 URL을 반영하도록 한 틱 늦춰 pathname 읽음
 */
export default function HistoryNavigationRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refreshSoft = (): void => {
      queueMicrotask(() => {
        router.refresh();
      });
    };

    function pathNeedsHardReload(pathname: string): boolean {
      const p = pathname.replace(/\/$/, "") || "/";
      return p === "/submit";
    }

    const applyHistoryRefresh = (): void => {
      const path = window.location.pathname;
      if (pathNeedsHardReload(path)) {
        window.location.reload();
        return;
      }
      refreshSoft();
    };

    const onPopState = (): void => {
      setTimeout(() => {
        applyHistoryRefresh();
      }, 0);
    };

    const onPageShow = (e: PageTransitionEvent): void => {
      if (!e.persisted) return;
      const path = window.location.pathname;
      if (pathNeedsHardReload(path)) {
        window.location.reload();
      } else {
        refreshSoft();
      }
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);

  return null;
}
