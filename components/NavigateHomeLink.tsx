"use client";

import { useEffect, useState } from "react";

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
    const isDisplayMode =
      new URLSearchParams(window.location.search).get("display") === "1";
    setHref(isDisplayMode ? "/?display=1" : "/");
  }, []);

  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        const isDisplayMode =
          new URLSearchParams(window.location.search).get("display") === "1";
        window.location.replace(isDisplayMode ? "/?display=1" : "/");
      }}
    >
      {children}
    </a>
  );
}
