import { ScheduleRecord } from "./types";

const GITHUB_API_BASE = "https://api.github.com";

interface GitHubContentFile {
  type: string;
  sha: string;
  content?: string;
  encoding?: string;
  /** 대용량 파일 시 raw.githubusercontent.com URL */
  download_url?: string | null;
}

/** 디렉터리 조회 시 항목 배열이 반환됨 */
type GitHubContentsResponse = GitHubContentFile | GitHubContentFile[];

function parseRecordsJson(decoded: string, filePath: string): ScheduleRecord[] {
  const trimmed = decoded.trim();
  if (!trimmed) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `GitHub 파일 JSON이 올바르지 않습니다 (${filePath}). 수동 편집·충돌 마커·깨진 인코딩을 확인하세요. ${msg}`
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error(
      `GitHub 파일이 JSON 배열이 아닙니다 (${filePath}). 루트는 [...] 형태여야 합니다.`
    );
  }
  return parsed as ScheduleRecord[];
}

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

function getConfig(): GitHubConfig {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";

  if (!token || !owner || !repo) {
    throw new Error(
      "GitHub 환경 변수가 설정되지 않았습니다. GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO를 확인하세요."
    );
  }

  return { token, owner, repo, branch };
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/**
 * Contents API는 약 1MB 초과 시 content를 생략함.
 * Git Blob API는 최대 ~100MB까지 base64 본문을 반환.
 */
async function fetchUtf8TextFromGitBlob(
  config: GitHubConfig,
  blobSha: string,
  filePath: string
): Promise<string> {
  const url = `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/git/blobs/${blobSha}`;
  const response = await fetch(url, {
    headers: authHeaders(config.token),
    cache: "no-store",
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Git Blob 조회 실패 (${filePath}): ${response.status} ${response.statusText} ${errText.slice(0, 200)}`
    );
  }

  const blob = (await response.json()) as {
    content?: string;
    encoding?: string;
  };

  if (blob.encoding !== "base64" || !blob.content) {
    throw new Error(`Git Blob 본문이 없거나 base64가 아닙니다: ${filePath}`);
  }

  return Buffer.from(blob.content, "base64").toString("utf-8");
}

/** Contents에 content가 없을 때 raw URL로 시도 (비공개 저장소는 토큰 필요) */
async function fetchUtf8FromDownloadUrl(
  config: GitHubConfig,
  downloadUrl: string,
  filePath: string
): Promise<string> {
  const response = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github.raw",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `download_url 조회 실패 (${filePath}): ${response.status} ${response.statusText}`
    );
  }
  return response.text();
}

async function getFileContent(
  config: GitHubConfig,
  filePath: string
): Promise<{ sha: string; data: ScheduleRecord[] }> {
  const url = `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/contents/${filePath}?ref=${config.branch}`;

  const response = await fetch(url, {
    headers: authHeaders(config.token),
    cache: "no-store",
  });

  if (response.status === 404) {
    return { sha: "", data: [] };
  }

  if (!response.ok) {
    throw new Error(
      `GitHub API 오류: ${response.status} ${response.statusText}`
    );
  }

  const body = (await response.json()) as GitHubContentsResponse;

  if (Array.isArray(body)) {
    throw new Error(
      `GitHub 경로가 파일이 아니라 폴더입니다. data/*.json 파일 경로를 확인하세요: ${filePath}`
    );
  }

  if (body.type !== "file") {
    throw new Error(
      `GitHub 콘텐츠 타입을 읽을 수 없습니다 (type=${body.type}): ${filePath}`
    );
  }

  let decoded: string;
  if (body.content && body.encoding === "base64") {
    decoded = Buffer.from(body.content, "base64").toString("utf-8");
  } else if (body.sha) {
    decoded = await fetchUtf8TextFromGitBlob(config, body.sha, filePath);
  } else if (body.download_url) {
    decoded = await fetchUtf8FromDownloadUrl(config, body.download_url, filePath);
  } else {
    throw new Error(
      `GitHub가 파일 본문을 주지 않았습니다(용량·형식). ${filePath} — blob SHA·download_url도 없습니다.`
    );
  }

  const data = parseRecordsJson(decoded, filePath);

  return { sha: body.sha, data };
}

async function putFileContent(
  config: GitHubConfig,
  filePath: string,
  sha: string,
  content: string,
  commitMessage: string
): Promise<void> {
  const url = `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/contents/${filePath}`;

  const body: Record<string, unknown> = {
    message: commitMessage,
    content: Buffer.from(content, "utf-8").toString("base64"),
    branch: config.branch,
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `GitHub 파일 업데이트 실패: ${response.status} ${response.statusText} - ${errorBody}`
    );
  }
}

export async function appendRecordToGitHub(
  filePath: string,
  newRecord: ScheduleRecord,
  commitMessage: string
): Promise<void> {
  const config = getConfig();

  const { sha, data } = await getFileContent(config, filePath);

  data.unshift(newRecord);

  const updatedContent = JSON.stringify(data, null, 2);

  await putFileContent(config, filePath, sha, updatedContent, commitMessage);
}

/** 홈 화면 등에서 최신 목록을 보기 위해 GitHub에 저장된 JSON을 읽습니다. */
export async function readRecordsFromGitHub(
  filePath: string
): Promise<ScheduleRecord[]> {
  const config = getConfig();
  const { data } = await getFileContent(config, filePath);
  return Array.isArray(data) ? data : [];
}

/** 파일 전체를 새 배열로 덮어씁니다 (이전 주 정리 등에 사용). */
export async function overwriteFileOnGitHub(
  filePath: string,
  records: ScheduleRecord[],
  commitMessage: string
): Promise<void> {
  const config = getConfig();
  const { sha } = await getFileContent(config, filePath);
  const content = JSON.stringify(records, null, 2);
  await putFileContent(config, filePath, sha, content, commitMessage);
}

/** id에 해당하는 레코드 1건을 제거하고 GitHub에 반영합니다. */
export async function deleteRecordByIdFromGitHub(
  filePath: string,
  recordId: string,
  commitMessage: string
): Promise<boolean> {
  const config = getConfig();
  const { sha, data } = await getFileContent(config, filePath);
  const filtered = data.filter((r) => r.id !== recordId);
  if (filtered.length === data.length) return false;
  const content = JSON.stringify(filtered, null, 2);
  await putFileContent(config, filePath, sha, content, commitMessage);
  return true;
}
