"use client";

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
  return (
    <a
      href="/"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        window.location.replace("/");
      }}
    >
      {children}
    </a>
  );
}
