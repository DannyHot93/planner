import { GoogleAuth, OAuth2Client } from "google-auth-library";
import type { ScheduleRecord } from "@/lib/types";
import {
  addDaysYmd,
  mondayOfWeekContaining,
  sevenDaysFromMonday,
  toSeoulDateYmd,
} from "@/lib/seoul-week";
import { getTodaySeoulYmd } from "@/lib/recording-cleanup";

const CAL_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

type GCalDateTime = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

type GCalEventItem = {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GCalDateTime;
  end?: GCalDateTime;
};

function isOAuthCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CALENDAR_ID?.trim() &&
      process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_CALENDAR_OAUTH_REFRESH_TOKEN?.trim()
  );
}

function isServiceAccountCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CALENDAR_ID?.trim() &&
      process.env.GOOGLE_CALENDAR_CLIENT_EMAIL?.trim() &&
      process.env.GOOGLE_CALENDAR_PRIVATE_KEY?.trim()
  );
}

function isGoogleCalendarConfigured(): boolean {
  if (process.env.GOOGLE_CALENDAR_SYNC_ENABLED === "false") return false;
  return isOAuthCalendarConfigured() || isServiceAccountCalendarConfigured();
}

async function getCalendarAccessToken(): Promise<string | null> {
  if (isOAuthCalendarConfigured()) {
    const clientId = process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_ID!.trim();
    const clientSecret =
      process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET!.trim();
    const refreshToken =
      process.env.GOOGLE_CALENDAR_OAUTH_REFRESH_TOKEN!.trim();
    const oauth2 = new OAuth2Client(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    const tok = await oauth2.getAccessToken();
    return tok?.token ?? null;
  }

  if (isServiceAccountCalendarConfigured()) {
    const clientEmail = process.env.GOOGLE_CALENDAR_CLIENT_EMAIL!.trim();
    const privateKey = normalizePrivateKey(
      process.env.GOOGLE_CALENDAR_PRIVATE_KEY!.trim()
    );
    const auth = new GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: [CAL_SCOPE],
    });
    const client = await auth.getClient();
    const tok = await client.getAccessToken();
    return tok?.token ?? null;
  }

  return null;
}

function normalizePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, "\n");
}

function safeGcalRecordId(parts: string): string {
  const b = Buffer.from(parts, "utf8").toString("base64url");
  return `gcal_${b}`;
}

/** 이번 주·다음 주(월~일 각각) 서울 달력 YYYY-MM-DD 집합 */
function thisAndNextWeekSeoulDays(): Set<string> {
  const todayYmd = getTodaySeoulYmd();
  const thisMon = mondayOfWeekContaining(todayYmd);
  const nextMon = addDaysYmd(thisMon, 7);
  const days = [
    ...sevenDaysFromMonday(thisMon),
    ...sevenDaysFromMonday(nextMon),
  ];
  return new Set(days);
}

function formatSeoulTimeRange(startIso: string, endIso: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  const a = new Date(startIso);
  const b = new Date(endIso);
  const s = new Intl.DateTimeFormat("sv-SE", opts).format(a);
  const e = new Intl.DateTimeFormat("sv-SE", opts).format(b);
  if (s === e) return s;
  return `${s}–${e}`;
}

/** 올데이: start/end date (end 배타적). 서울 달력 날짜로 취급 */
function expandAllDayYmds(startYmd: string, endExclusiveYmd: string): string[] {
  const out: string[] = [];
  let cur = startYmd;
  while (cur < endExclusiveYmd) {
    out.push(cur);
    cur = addDaysYmd(cur, 1);
  }
  return out;
}

function eventToRecordSlices(
  ev: GCalEventItem,
  allowed: Set<string>
): ScheduleRecord[] {
  const eid = ev.id?.trim();
  if (!eid) return [];

  const summary = (ev.summary?.trim() || "(제목 없음)") as string;
  const location = ev.location?.trim();
  const desc = ev.description?.trim();

  const start = ev.start;
  const end = ev.end;
  if (!start) return [];

  const records: ScheduleRecord[] = [];

  if (start.date) {
    const endEx = end?.date
      ? end.date
      : addDaysYmd(start.date, 1);
    const ymds = expandAllDayYmds(start.date, endEx).filter((d) =>
      allowed.has(d)
    );
    for (const ymd of ymds) {
      records.push({
        id: safeGcalRecordId(`${eid}:${ymd}:allday`),
        type: "office-schedule",
        uploadedAt: `${ymd}T12:00:00+09:00`,
        memo: "Google Calendar",
        summary,
        details: {
          title: summary,
          program: summary,
          period: `${ymd} · Google Calendar`,
          entries: [
            {
              date: ymd,
              place: location,
              note: desc || undefined,
            },
          ],
        },
      });
    }
    return records;
  }

  if (start.dateTime && end?.dateTime) {
    const ymd = toSeoulDateYmd(start.dateTime);
    if (!ymd || !allowed.has(ymd)) return [];
    const timeLabel = formatSeoulTimeRange(start.dateTime, end.dateTime);
    records.push({
      id: safeGcalRecordId(`${eid}:${ymd}:timed`),
      type: "office-schedule",
      uploadedAt: start.dateTime,
      memo: "Google Calendar",
      summary,
      details: {
        title: summary,
        program: summary,
        period: `${ymd} · Google Calendar`,
        entries: [
          {
            date: ymd,
            time: timeLabel,
            place: location,
            note: desc || undefined,
          },
        ],
      },
    });
    return records;
  }

  return records;
}

async function fetchCalendarEventPages(
  calendarId: string,
  timeMin: string,
  timeMax: string,
  accessToken: string
): Promise<GCalEventItem[]> {
  const items: GCalEventItem[] = [];
  let pageToken: string | undefined;

  do {
    const u = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
      )}/events`
    );
    u.searchParams.set("singleEvents", "true");
    u.searchParams.set("orderBy", "startTime");
    u.searchParams.set("timeMin", timeMin);
    u.searchParams.set("timeMax", timeMax);
    u.searchParams.set("maxResults", "250");
    if (pageToken) u.searchParams.set("pageToken", pageToken);

    const res = await fetch(u.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Google Calendar API ${res.status}: ${text.slice(0, 200)}`
      );
    }

    const data = (await res.json()) as {
      items?: GCalEventItem[];
      nextPageToken?: string;
    };
    if (Array.isArray(data.items)) items.push(...data.items);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return items;
}

/**
 * 서버에서만 호출. 환경 변수가 없거나 실패하면 빈 배열.
 *
 * **권장(조직에서 서비스 계정 키 차단 시):** OAuth 리프레시 토큰
 * `GOOGLE_CALENDAR_ID`, `GOOGLE_CALENDAR_OAUTH_CLIENT_ID`,
 * `GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET`, `GOOGLE_CALENDAR_OAUTH_REFRESH_TOKEN`
 *
 * **대안:** 서비스 계정 + `GOOGLE_CALENDAR_CLIENT_EMAIL`, `GOOGLE_CALENDAR_PRIVATE_KEY`
 * (캘린더를 서비스 계정에 공유)
 */
export async function fetchGoogleCalendarOfficeRecords(): Promise<
  ScheduleRecord[]
> {
  if (!isGoogleCalendarConfigured()) return [];

  const calendarId = process.env.GOOGLE_CALENDAR_ID!.trim();

  const allowed = thisAndNextWeekSeoulDays();
  const todayYmd = getTodaySeoulYmd();
  const thisMon = mondayOfWeekContaining(todayYmd);
  const nextSun = addDaysYmd(thisMon, 13);
  const rangeEndExclusive = addDaysYmd(nextSun, 1);

  const timeMin = `${thisMon}T00:00:00+09:00`;
  const timeMax = `${rangeEndExclusive}T00:00:00+09:00`;

  try {
    const accessToken = await getCalendarAccessToken();
    if (!accessToken) {
      console.warn("Google Calendar: 액세스 토큰을 받지 못했습니다.");
      return [];
    }

    const raw = await fetchCalendarEventPages(
      calendarId,
      timeMin,
      timeMax,
      accessToken
    );

    const out: ScheduleRecord[] = [];
    for (const ev of raw) {
      out.push(...eventToRecordSlices(ev, allowed));
    }
    return out;
  } catch (e) {
    console.error("Google Calendar 동기화 실패:", e);
    return [];
  }
}
