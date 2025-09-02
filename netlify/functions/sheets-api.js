// netlify/functions/sheets-api.js  (CommonJS / Netlify Functions v1)
const { google } = require("googleapis");

const SHEET_ID = process.env.SHEET_ID;
const TAB_PICKS = process.env.SHEET_TAB_PICKS || "Picks";
const TAB_GAMES = process.env.SHEET_TAB_GAMES || "Games";
const TAB_SETTINGS = process.env.SHEET_TAB_SETTINGS || "Settings";
const CORS_ALLOW_ORIGIN = process.env.CORS_ALLOW_ORIGIN || "*";

const SEASON_START = new Date("2025-09-04T00:00:00Z").getTime();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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
const weekFromDate = () =>
  Math.max(1, Math.min(18, Math.ceil((Date.now() - SEASON_START) / WEEK_MS)));

async function sheets() {
  if (!SHEET_ID) throw new Error("Missing SHEET_ID");
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !key) throw new Error("Missing Google SA creds");
  key = key.replace(/\\n/g, "\n"); // fix escaped newlines from Netlify UI
  const jwt = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth: jwt });
}
async function read(range) {
  const s = await sheets();
  const { data } = await s.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });
  return data.values || [];
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

async function getCurrentWeekFromSettings() {
  try {
    const rows = await read(`${TAB_SETTINGS}!A1:Z`);
    if (rows.length < 2) return null;
    const H = rows[0].map((h) => String(h).trim().toLowerCase());
    const idx =
      H.indexOf("currentweek") >= 0 ? H.indexOf("currentweek") : H.indexOf("week");
    if (idx === -1) return null;
    const val = rows[1][idx];
    const w = parseInt(val, 10);
    return Number.isFinite(w) ? Math.max(1, Math.min(18, w)) : null;
  } catch {
    return null;
  }
}
async function getGamesFromSheet(week) {
  try {
    const rows = await read(`${TAB_GAMES}!A1:Z`);
    if (rows.length < 2) return [];
    const H = rows[0].map((h) => String(h).trim().toLowerCase());
    const ix = (k) => H.indexOf(k);
    const W = ix("week"),
      ID = ix("id"),
      DAY = ix("day"),
      TIME = ix("time"),
      AW = ix("awayteam"),
      HO = ix("hometeam"),
      OU = ix("overunder"),
      MNF = ix("ismnf"),
      DONE = ix("completed");
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const w = parseInt(row[W] ?? "", 10);
      if (!Number.isFinite(w) || w !== week) continue;
      out.push({
        id: Number(row[ID] ?? r),
        day: row[DAY] ?? "",
        time: row[TIME] ?? "",
        awayTeam: row[AW] ?? "",
        homeTeam: row[HO] ?? "",
        overUnder: row[OU] ?? "",
        isMNF: String(row[MNF] ?? "").toLowerCase() === "true",
        completed: String(row[DONE] ?? "").toLowerCase() === "true",
      });
    }
    return out;
  } catch {
    return [];
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors(), body: "" };
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Invalid JSON" }); }

  const action = body.action;
  const data = body.data || {};

  try {
    if (action === "getCurrentWeek") {
      const w = (await getCurrentWeekFromSettings()) ?? weekFromDate();
      return json(200, { currentWeek: w });
    }

    if (action === "getGames") {
      const w = Number(data.week) || weekFromDate();
      const games = await getGamesFromSheet(w);
      return json(200, { games });
    }

    if (action === "savePick") {
      const { player, week, gameId, teamPick, tiebreaker } = data || {};
      if (!player || !week || !gameId || !teamPick) {
        return json(400, { ok: false, error: "Missing player, week, gameId, or teamPick" });
      }
      await append(`${TAB_PICKS}!A:F`, [[
        new Date().toISOString(),
        String(week),
        String(gameId),
        String(player),
        String(teamPick),
        tiebreaker ?? ""
      ]]);
      return json(200, { ok: true });
    }

    return json(400, { error: "Unknown action" });
  } catch (e) {
    // Bubble useful details
    const apiMsg = e?.response?.data?.error?.message;
    const apiReason = e?.response?.data?.error?.status || e?.errors?.[0]?.reason;
    console.error("Function error:", apiMsg || e.message || e);
    return json(500, { ok: false, error: apiMsg || e.message || "Internal error", reason: apiReason });
  }
};
