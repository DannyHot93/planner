"use client";

import { useEffect, useState } from "react";

const DISPLAY_MODE_STORAGE = "planner_display_mode";

function isDisplayModeReturn(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("display") === "1") {
    try {
      sessionStorage.setItem(DISPLAY_MODE_STORAGE, "1");
    } catch {
      /* private 모드 등 */
    }
    return true;
  }
  try {
    return sessionStorage.getItem(DISPLAY_MODE_STORAGE) === "1";
  } catch {
    return false;
  }
}

/**
 * 홈(/)으로 갈 때 Next 소프트 네비게이션 대신 전체 로드를 사용해
 * 일정·캐시가 예전 상태로 남는 현상을 줄입니다.
 * (브라우저 뒤로가기로 / 복귀 시에는 HistoryNavigationRefresh가 reload 처리)
 */
export default function NavigateHomeLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [href, setHref] = useState("/");

  useEffect(() => {
    setHref(isDisplayModeReturn() ? "/?display=1" : "/");
  }, []);

  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        window.location.replace(isDisplayModeReturn() ? "/?display=1" : "/");
      }}
    >
      {children}
    </a>
  );
}
