// ─── Steps Service ────────────────────────────────────────────────────────────
const fs = require("fs");
const path = require("path");
const STEPS_DB = path.join(__dirname, "../steps.json");
function readSteps() { if (!fs.existsSync(STEPS_DB)) return {}; return JSON.parse(fs.readFileSync(STEPS_DB, "utf8")); }
function writeSteps(data) { fs.writeFileSync(STEPS_DB, JSON.stringify(data, null, 2)); }
function initSteps(streamId, stepIds, config = {}) {
  const db = readSteps(); if (db[streamId]) return db[streamId];
  db[streamId] = { steps: stepIds.map(id => ({ id, status: "pending", completedAt: null, config: config[id] || {} })) };
  writeSteps(db); return db[streamId];
}
function getSteps(streamId) { const db = readSteps(); return db[streamId] || null; }
function completeStep(streamId, stepId) {
  const db = readSteps(); const stream = db[streamId];
  if (!stream) return { success: false, reason: "Stream steps not initialized." };
  const idx = stream.steps.findIndex(s => s.id === stepId);
  if (idx === -1) return { success: false, reason: `Step "${stepId}" not found.` };
  for (let i = 0; i < idx; i++) { if (stream.steps[i].status !== "completed") return { success: false, reason: `Step "${stream.steps[i].id}" must be completed first.` }; }
  stream.steps[idx].status = "completed"; stream.steps[idx].completedAt = Date.now();
  writeSteps(db); return { success: true, reason: `Step "${stepId}" completed.` };
}
function failStep(streamId, stepId) {
  const db = readSteps(); const stream = db[streamId]; if (!stream) return;
  const step = stream.steps.find(s => s.id === stepId);
  if (step) { step.status = "failed"; step.completedAt = null; } writeSteps(db);
}
function resetStepAndAfter(streamId, stepId) {
  const db = readSteps(); const stream = db[streamId]; if (!stream) return;
  const idx = stream.steps.findIndex(s => s.id === stepId); if (idx === -1) return;
  for (let i = idx; i < stream.steps.length; i++) { stream.steps[i].status = "pending"; stream.steps[i].completedAt = null; }
  writeSteps(db);
}
function allStepsComplete(streamId) { const db = readSteps(); const stream = db[streamId]; if (!stream) return false; return stream.steps.every(s => s.status === "completed"); }
function nextPendingStep(streamId) { const db = readSteps(); const stream = db[streamId]; if (!stream) return null; return stream.steps.find(s => s.status !== "completed") || null; }
module.exports = { initSteps, getSteps, completeStep, failStep, resetStepAndAfter, allStepsComplete, nextPendingStep };
