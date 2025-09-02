// netlify/functions/sheets-api.js
const ORIGIN = process.env.CORS_ALLOW_ORIGIN || "*";

const cors = () => ({
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
});

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json", ...cors() },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  if (body.action === "getCurrentWeek") {
    const start = new Date("2025-09-04T00:00:00Z").getTime();
    const week = Math.max(1, Math.min(18, Math.ceil((Date.now() - start) / (7*24*60*60*1000))));
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", ...cors() },
      body: JSON.stringify({ currentWeek: week }),
    };
  }

  // stub for other actions during testing
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", ...cors() },
    body: JSON.stringify({ ok: false, note: "stub" }),
  };
};
