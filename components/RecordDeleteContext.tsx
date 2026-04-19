"use client";

import { createContext, useContext } from "react";

/** 삭제 성공 직후 목록에서 해당 id를 즉시 숨김 (서버 캐시보다 먼저 반영) */
export type MarkRecordRemoved = (recordId: string) => void;

const RecordRemoveContext = createContext<MarkRecordRemoved | null>(null);

export function RecordRemoveProvider({
  value,
  children,
}: {
  value: MarkRecordRemoved;
  children: React.ReactNode;
}) {
  return (
    <RecordRemoveContext.Provider value={value}>{children}</RecordRemoveContext.Provider>
  );
}

export function useMarkRecordRemoved(): MarkRecordRemoved | null {
  return useContext(RecordRemoveContext);
}
