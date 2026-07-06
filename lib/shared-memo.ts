import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { overwriteTextOnGitHub, readTextFromGitHub } from "@/lib/github";

const MEMO_FILE = "shared-memo.json";
const MEMO_PATH = `data/${MEMO_FILE}`;

export const SHARED_MEMO_MAX_LENGTH = 5000;

export interface SharedMemoPayload {
  memo: string;
  updatedAt: string | null;
}

function hasGithubEnv(): boolean {
  return Boolean(
    process.env.GITHUB_TOKEN &&
      process.env.GITHUB_OWNER &&
      process.env.GITHUB_REPO
  );
}

function emptyMemo(): SharedMemoPayload {
  return { memo: "", updatedAt: null };
}

function parseMemoPayload(raw: string): SharedMemoPayload {
  if (!raw.trim()) return emptyMemo();
  const parsed = JSON.parse(raw) as Partial<SharedMemoPayload>;
  return {
    memo: typeof parsed.memo === "string" ? parsed.memo : "",
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
  };
}

function readMemoFromDisk(): SharedMemoPayload {
  try {
    const raw = readFileSync(join(process.cwd(), "data", MEMO_FILE), "utf-8");
    return parseMemoPayload(raw);
  } catch {
    return emptyMemo();
  }
}

function writeMemoToDisk(payload: SharedMemoPayload): void {
  writeFileSync(
    join(process.cwd(), "data", MEMO_FILE),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf-8"
  );
}

export async function readSharedMemo(): Promise<SharedMemoPayload> {
  if (hasGithubEnv()) {
    try {
      return parseMemoPayload(await readTextFromGitHub(MEMO_PATH));
    } catch (e) {
      console.error("공용 메모 GitHub 로드 실패, 로컬 파일 사용:", e);
      return readMemoFromDisk();
    }
  }
  return readMemoFromDisk();
}

export async function writeSharedMemo(memo: string): Promise<SharedMemoPayload> {
  const payload: SharedMemoPayload = {
    memo,
    updatedAt: new Date().toISOString(),
  };

  if (hasGithubEnv()) {
    await overwriteTextOnGitHub(
      MEMO_PATH,
      `${JSON.stringify(payload, null, 2)}\n`,
      "Update shared planner memo"
    );
    return payload;
  }

  writeMemoToDisk(payload);
  return payload;
}
