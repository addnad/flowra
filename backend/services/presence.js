// ─── Presence Service ────────────────────────────────────────────────────────
const fs = require("fs");
const path = require("path");
const PRESENCE_DB = path.join(__dirname, "../presence.json");
function readPresence() { if (!fs.existsSync(PRESENCE_DB)) return {}; return JSON.parse(fs.readFileSync(PRESENCE_DB, "utf8")); }
function writePresence(data) { fs.writeFileSync(PRESENCE_DB, JSON.stringify(data, null, 2)); }
function recordCheckIn(streamId, receiverAddress) {
  const db = readPresence(); const key = `${streamId}:${receiverAddress.toLowerCase()}`;
  if (!db[key] || db[key].exited) { db[key] = { checkInTime: Date.now(), exited: false }; writePresence(db); }
  return db[key];
}
function recordExit(streamId, receiverAddress) {
  const db = readPresence(); const key = `${streamId}:${receiverAddress.toLowerCase()}`;
  db[key] = { checkInTime: null, exited: true }; writePresence(db);
}
function checkPresenceDuration(streamId, receiverAddress, requiredDurationMs) {
  const db = readPresence(); const key = `${streamId}:${receiverAddress.toLowerCase()}`; const record = db[key];
  if (!record || record.exited || !record.checkInTime) return { met: false, timeInZoneMs: 0, remainingMs: requiredDurationMs };
  const timeInZoneMs = Date.now() - record.checkInTime; const met = timeInZoneMs >= requiredDurationMs;
  return { met, timeInZoneMs, remainingMs: met ? 0 : requiredDurationMs - timeInZoneMs };
}
function getPresence(streamId, receiverAddress) { const db = readPresence(); return db[`${streamId}:${receiverAddress.toLowerCase()}`] || null; }
module.exports = { recordCheckIn, recordExit, checkPresenceDuration, getPresence };
