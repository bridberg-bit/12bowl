// netlify/functions/sheets-api.js
import { google } from "googleapis";

const SHEET_ID = process.env.SHEET_ID;
const TAB_PICKS = process.env.SHEET_TAB_PICKS || "Picks";
const TAB_GAMES = process.env.SHEET_TAB_GAMES || "Games";
const TAB_SETTINGS = process.env.SHEET_TAB_SETTINGS || "Settings";
const CORS_ALLOW_ORIGIN = process.env.CORS_ALLOW_ORIGIN || "*";

const NFL_SEASON = { year: 2025, startDate: new Date("2025-09-04T00:00:00Z"), weekMs: 7*24*60*60*1000 };

const cors = () => ({
  "Access-Control-Allow-Origin": CORS_ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
});
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors() } });

const weekFromDate = () => Math.max(1, Math.min(18, Math.ceil((Date.now() - NFL_SEASON.startDate.getTime())/NFL_SEASON.weekMs)));

async function sheets() {
  if (!SHEET_ID) throw new Error("Missing SHEET_ID");
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !key) throw new Error("Missing Google SA creds");
  key = key.replace(/\\n/g, "\n");
  const jwt = new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return google.sheets({ version: "v4", auth: jwt });
}

async function readRange(range) {
  const s = await sheets();
  const { data } = await s.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
  return data.values || [];
}

async function appendRange(range, values) {
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
    const rows = await readRange(`${TAB_SETTINGS}!A1:Z`);
    if (!rows.length) return null;
    const header = rows[0].map(h => String(h).trim().toLowerCase());
    const idx = header.indexOf("currentweek") >= 0 ? header.indexOf("currentweek")
              : header.indexOf("week");
    if (idx === -1) return null;
    const firstData = rows[1];
    const val = firstData && firstData[idx];
    const week = parseInt(val, 10);
    return Number.isFinite(week) ? Math.max(1, Math.min(18, week)) : null;
  } catch { return null; }
}

async function getGamesFromSheet(targetWeek) {
  try {
    const rows = await readRange(`${TAB_GAMES}!A1:Z`);
    if (rows.length < 2) return [];
    const H = rows[0].map(h => String(h).trim().toLowerCase());
    const ix = (name) => H.indexOf(name);
    const W = ix("week"), ID = ix("id"), DAY = ix("day"), TIME = ix("time"),
          AW = ix("awayteam"), HO = ix("hometeam"), OU = ix("overunder"),
          MNF = ix("ismnf"), DONE = ix("completed");
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const w = parseInt(row[W] ?? "", 10);
      if (!Number.isFinite(w) || w !== targetWeek) continue;
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
  } catch { return []; }
}

async function handleGetCurrentWeek() {
  const fromSheet = await getCurrentWeekFromSettings();
  return json(200, { currentWeek: fromSheet ?? weekFromDate() });
}

async function handleSavePick(data) {
  const { player, week, gameId, teamPick, tiebreaker } = data || {};
  if (!player || !week || !gameId || !teamPick)
    return json(400, { ok: false, error: "Missing player, week, gameId, teamPick" });
  try {
    await appendRange(`${TAB_PICKS}!A:F`, [[
      new Date().toISOString(),
      String(week),
      String(gameId),
      String(player),
      String(teamPick),
      tiebreaker ?? ""
    ]]);
    return json(200, { ok: true });
  } catch (e) {
    console.error("savePick:", e?.message || e);
    return json(500, { ok: false, error: "Failed to save pick" });
  }
}

async function handleGetGames(data) {
  const week = Number(data?.week) || weekFromDate();
  const games = await getGamesFromSheet(week);
  return json(200, { games });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors() });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  let body; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  const action = body?.action; const data = body?.data || {};
  if (action === "getCurrentWeek") return handleGetCurrentWeek();
  if (action === "savePick") return handleSavePick(data);
  if (action === "getGames") return handleGetGames(data);
  return json(400, { error: "Unknown action" });
}
