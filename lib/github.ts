import { ScheduleRecord } from "./types";

const GITHUB_API_BASE = "https://api.github.com";

interface GitHubFileResponse {
  sha: string;
  content: string;
  encoding: string;
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

async function getFileContent(
  config: GitHubConfig,
  filePath: string
): Promise<{ sha: string; data: ScheduleRecord[] }> {
  const url = `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/contents/${filePath}?ref=${config.branch}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github.v3+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (response.status === 404) {
    return { sha: "", data: [] };
  }

  if (!response.ok) {
    throw new Error(
      `GitHub API 오류: ${response.status} ${response.statusText}`
    );
  }

  const fileInfo = (await response.json()) as GitHubFileResponse;
  const decoded = Buffer.from(fileInfo.content, "base64").toString("utf-8");
  const data = JSON.parse(decoded) as ScheduleRecord[];

  return { sha: fileInfo.sha, data };
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
