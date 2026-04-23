/**
 * 로컬에서 1회 실행: OAuth 리프레시 토큰 발급 (서비스 계정 키 불필요)
 *
 * 사전 준비:
 * 1) GCP → API 및 서비스 → 사용자 인증 정보 → OAuth 클라이언트 ID 만들기
 *    유형: "웹 애플리케이션"
 *    승인된 리디렉션 URI: http://127.0.0.1:8765/oauth2callback
 * 2) 동의 화면에서 범위: .../auth/calendar.readonly, 테스트 사용자에 본인 Gmail 추가
 *
 * 실행 (Node 20+):
 *   node --env-file=.env.local scripts/gcal-oauth-setup.mjs
 *
 * 또는:
 *   GOOGLE_CALENDAR_OAUTH_CLIENT_ID=... GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET=... node scripts/gcal-oauth-setup.mjs
 */
import http from "node:http";
import { URL } from "node:url";
import { OAuth2Client } from "google-auth-library";

const PORT = Number(process.env.GCAL_OAUTH_PORT || 8765);
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth2callback`;
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

const clientId = process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET?.trim();

if (!clientId || !clientSecret) {
  console.error(
    "GOOGLE_CALENDAR_OAUTH_CLIENT_ID 와 GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET 을 설정하세요."
  );
  process.exit(1);
}

const oauth2 = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: [SCOPE],
});

console.log("\n브라우저에서 아래 URL을 열고, 캘린더 계정(예: office.todo.osm@gmail.com)으로 로그인하세요.\n");
console.log(authUrl);
console.log(`\n리디렉션 수신: ${REDIRECT_URI}\n`);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404);
    res.end();
    return;
  }

  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");

  if (err) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<p>오류: ${err}</p>`);
    server.close();
    process.exit(1);
    return;
  }

  if (!code) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<p>code 없음</p>");
    server.close();
    process.exit(1);
    return;
  }

  try {
    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      "<p>완료되었습니다. 터미널에 출력된 GOOGLE_CALENDAR_OAUTH_REFRESH_TOKEN 을 복사해 Vercel에 넣으세요.</p>"
    );

    console.log("\n========== 아래를 .env.local / Vercel 환경 변수에 추가 ==========\n");
    if (tokens.refresh_token) {
      console.log(`GOOGLE_CALENDAR_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
    } else {
      console.log(
        "refresh_token 이 없습니다. Google 계정 → 보안 → 타사 앱 액세스에서 이 앱 연결을 제거한 뒤, 이 스크립트를 다시 실행하세요."
      );
    }
    console.log("\n캘린더 ID(기본 캘린더면 Gmail 주소):");
    console.log("GOOGLE_CALENDAR_ID=office.todo.osm@gmail.com");
    console.log("\n================================================================\n");

    server.close();
    process.exit(0);
  } catch (e) {
    console.error(e);
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<p>토큰 교환 실패 (터미널 로그 확인)</p>");
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Listening on http://127.0.0.1:${PORT}`);
});
