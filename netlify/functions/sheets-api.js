// netlify/functions/sheets-api.js  (CommonJS / Netlify Functions v1)
const { google } = require("googleapis");

// ====== ENV ======
const SHEET_ID = process.env.SHEET_ID;
const TAB_PICKS = process.env.SHEET_TAB_PICKS || "Picks";
const CORS_ALLOW_ORIGIN = process.env.CORS_ALLOW_ORIGIN || "*";

// ====== NFL Week / ESPN helpers ======
const SEASON_START_ISO = "2025-09-04T00:00:00Z"; // adjust if your Week 1 differs
const SEASON_START = new Date(SEASON_START_ISO).getTime();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const weekFromDate = () =>
  Math.max(1, Math.min(18, Math.ceil((Date.now() - SEASON_START) / WEEK_MS)));

const yyyymmdd = (d) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
};

function weekDateStrings(week) {
  const w = week - 1;
  const thu = new Date(SEASON_START + w * WEEK_MS);
  const fri = new Date(thu.getTime() + 1 * 86400000);
  const sat = new Date(thu.getTime() + 2 * 86400000);
  const sun = new Date(thu.getTime() + 3 * 86400000);
  const mon = new Date(thu.getTime() + 4 * 86400000);
  return [thu, fri, sat, sun, mon].map(yyyymmdd);
}

function mapEspnEvent(ev) {
  const comp = ev.competitions?.[0];
  const competitors = comp?.competitors || [];
  const away = competitors.find((c) => c.homeAway === "away");
  const home = competitors.find((c) => c.homeAway === "home");
  return {
    id: Number(ev.id),
    day: new Date(ev.date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    }),
    time: new Date(ev.date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }),
    awayTeam: away?.team?.displayName || away?.team?.name || "Away",
    homeTeam: home?.team?.displayName || home?.team?.name || "Home",
    overUnder: comp?.odds?.[0]?.overUnder ?? null,
    completed: comp?.status?.type?.completed === true,
    isMNF: /monday/i.test(comp?.broadcasts?.map((b) => b.names).join(" ") || ""),
  };
}

// ====== Sheets helpers ======
const cors = () => ({
  "Access-Control-Allow-Origin": CORS_ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
});
const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", ...cors() },
  body: JSON.stringify(body),
});

async function sheets() {
  if (!SHEET_ID) throw new Error("Missing SHEET_ID");
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !key) throw new Error("Missing Google SA credentials");
  key = key.replace(/\\n/g, "\n");
  const jwt = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth: jwt });
}

async function append(range, values) {
  const s = await sheets();
  await s.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
}

// ====== Handler ======
exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors(), body: "" };
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const action = body.action;
  const data = body.data || {};

  try {
    // --- Health / default week for the badge ---
    if (action === "getCurrentWeek") {
      return json(200, { currentWeek: weekFromDate() });
    }

    // --- Auto games from ESPN (no manual updates) ---
    if (action === "getGames") {
      const w = Number(data.week) || weekFromDate();
      const dates = weekDateStrings(w);

      const eventsMap = new Map();
      for (const d of dates) {
        const url = `https://site.api.espn.com/apis/v2/sports/football/nfl/scoreboard?dates=${d}`;
        try {
          const res = await fetch(url, { headers: { "User-Agent": "12-bowl" } });
          if (!res.ok) continue;
          const j = await res.json();
          (j?.events || []).forEach((ev) => eventsMap.set(ev.id, ev));
        } catch {}
      }
      const games = Array.from(eventsMap.values()).map(mapEspnEvent).filter(Boolean);
      return json(200, { games });
    }

    // --- Save pick to Google Sheets ---
    if (action === "savePick") {
      const { player, week, gameId, teamPick, tiebreaker } = data || {};
      if (!player || !week || !gameId || !teamPick) {
        return json(400, { success: false, error: "Missing player, week, gameId, or teamPick" });
      }

      await append(`${TAB_PICKS}!A:F`, [[
        new Date().toISOString(),
        String(week),
        String(gameId),
        String(player),
        String(teamPick),
        tiebreaker ?? ""
      ]]);

      return json(200, { success: true });
    }

    return json(400, { error: "Unknown action" });
  } catch (e) {
    const apiMsg = e?.response?.data?.error?.message;
    const apiReason = e?.response?.data?.error?.status || e?.errors?.[0]?.reason;
    console.error("sheets-api error:", apiMsg || e.message || e);
    return json(500, { success: false, error: apiMsg || e.message || "Internal error", reason: apiReason });
  }
};
