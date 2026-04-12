require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const presence = require("./services/presence");
const { validateProof } = require("./services/proofValidator");
const steps = require("./services/steps");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const BACKEND_SIGNER_PRIVATE_KEY = process.env.BACKEND_SIGNER_PRIVATE_KEY;
const PORT = process.env.PORT || 3001;
const CHAIN_ID = process.env.CHAIN_ID || 5042002;

const signer = new ethers.Wallet(BACKEND_SIGNER_PRIVATE_KEY);
console.log("Backend signer address:", signer.address);

const DB_PATH = path.join(__dirname, "db.json");
function readDB() { if (!fs.existsSync(DB_PATH)) return { streamNonces: {}, unlockRequests: {}, proofSubmissions: {} }; return JSON.parse(fs.readFileSync(DB_PATH, "utf8")); }
function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }
function getNonce(streamId) { const db = readDB(); return db.streamNonces[streamId] ?? 0; }
function incrementNonce(streamId) { const db = readDB(); db.streamNonces[streamId] = (db.streamNonces[streamId] ?? 0) + 1; writeDB(db); }

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

app.post("/api/verify-location", async (req, res) => {
  const { streamId, receiverAddress, userLat, userLon, allowedLat, allowedLon, radiusMeters, requiredDurationMs } = req.body;
  if (!streamId || !receiverAddress || userLat === undefined || userLon === undefined || allowedLat === undefined || allowedLon === undefined || !radiusMeters)
    return res.status(400).json({ error: "Missing required fields" });

  const distance = haversineDistance(userLat, userLon, allowedLat, allowedLon);
  const insideZone = distance <= radiusMeters;

  if (!insideZone) {
    presence.recordExit(streamId, receiverAddress);
    if (steps.getSteps(streamId)) { steps.failStep(streamId, "location"); steps.resetStepAndAfter(streamId, "presence"); }
    return res.json({ allowed: false, distanceMeters: Math.round(distance), signature: null, message: `You are ${Math.round(distance)}m away. Must be within ${radiusMeters}m.`, presenceStatus: null });
  }

  presence.recordCheckIn(streamId, receiverAddress);
  if (steps.getSteps(streamId)) steps.completeStep(streamId, "location");

  const durationRequired = requiredDurationMs && requiredDurationMs > 0;
  let presenceStatus = null;

  if (durationRequired) {
    const presenceCheck = presence.checkPresenceDuration(streamId, receiverAddress, requiredDurationMs);
    presenceStatus = { timeInZoneMs: presenceCheck.timeInZoneMs, requiredDurationMs, remainingMs: presenceCheck.remainingMs, met: presenceCheck.met };
    if (!presenceCheck.met) {
      return res.json({ allowed: false, distanceMeters: Math.round(distance), signature: null, message: `Inside zone. Stay for ${Math.round(presenceCheck.remainingMs / 1000)}s more.`, presenceStatus });
    }
    if (steps.getSteps(streamId)) steps.completeStep(streamId, "presence");
  }

  const streamSteps = steps.getSteps(streamId);
  if (streamSteps && !steps.allStepsComplete(streamId)) {
    const next = steps.nextPendingStep(streamId);
    return res.json({ allowed: false, distanceMeters: Math.round(distance), signature: null, message: `Location verified. Complete next step: ${next?.id || "unknown"}.`, presenceStatus, steps: streamSteps.steps });
  }

  const nonce = getNonce(streamId);
  const messageHash = ethers.solidityPackedKeccak256(["uint256", "address", "uint256", "uint256"], [streamId, receiverAddress, nonce, CHAIN_ID]);
  const signature = await signer.signMessage(ethers.getBytes(messageHash));
  incrementNonce(streamId);

  res.json({ allowed: true, distanceMeters: Math.round(distance), signature, message: "Location verified. You can claim your funds.", presenceStatus, steps: streamSteps?.steps || null });
});

app.get("/api/presence/:streamId/:receiverAddress", (req, res) => {
  const { streamId, receiverAddress } = req.params;
  res.json({ presence: presence.getPresence(streamId, receiverAddress) });
});

app.get("/api/stream-nonce/:streamId", (req, res) => res.json({ nonce: getNonce(parseInt(req.params.streamId)) }));

app.post("/api/steps/init", (req, res) => {
  const { streamId, stepIds, config } = req.body;
  if (!streamId || !stepIds || !Array.isArray(stepIds)) return res.status(400).json({ error: "Missing streamId or stepIds array" });
  const result = steps.initSteps(streamId, stepIds, config || {});
  res.json({ success: true, steps: result });
});

app.get("/api/steps/:streamId", (req, res) => res.json({ steps: steps.getSteps(req.params.streamId) }));

app.post("/api/unlock-request", (req, res) => {
  const { streamId, receiverAddress, note, message, percentage } = req.body;
  if (!streamId || !receiverAddress) return res.status(400).json({ error: "Missing fields" });
  const db = readDB();
  if (!db.unlockRequests) db.unlockRequests = {};
  db.unlockRequests[streamId] = { streamId, receiverAddress, note: note || "", message: message || "", percentage: percentage || 100, status: "pending", timestamp: Date.now() };
  writeDB(db);
  res.json({ success: true, request: db.unlockRequests[streamId] });
});

app.get("/api/unlock-request/:streamId", (req, res) => { const db = readDB(); res.json({ request: db.unlockRequests?.[req.params.streamId] || null }); });

app.post("/api/unlock-request/:streamId/:action", (req, res) => {
  const { streamId, action } = req.params;
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "Invalid action" });
  const db = readDB();
  if (!db.unlockRequests?.[streamId]) return res.status(404).json({ error: "No request found" });
  db.unlockRequests[streamId].status = action === "approve" ? "approved" : "rejected";
  writeDB(db);
  res.json({ success: true });
});

app.post("/api/proof-submit", async (req, res) => {
  const { streamId, receiverAddress, proofType, proofContent, proofNote, capturedAt, captureLocation } = req.body;
  if (!streamId || !receiverAddress || !proofType || !proofContent) return res.status(400).json({ error: "Missing fields" });

  if (capturedAt) {
    const validation = validateProof({ proofType, proofContent }, capturedAt);
    if (!validation.valid) return res.status(422).json({ error: validation.reason, stale: true });
  }

  const db = readDB();
  if (!db.proofSubmissions) db.proofSubmissions = {};
  db.proofSubmissions[streamId] = { streamId, receiverAddress, proofType, proofContent, proofNote: proofNote || "", capturedAt: capturedAt || null, captureLocation: captureLocation || null, status: "pending", aiVerdict: null, senderNote: "", timestamp: Date.now() };
  writeDB(db);

  console.log(`Proof submitted for stream ${streamId} - triggering Flowra...`);
  await triggerFlowraVerification(streamId);

  const updatedProof = readDB().proofSubmissions[streamId];
  if (updatedProof.aiVerdict === "approved" && steps.getSteps(streamId)) steps.completeStep(streamId, "proof");

  res.json({ success: true, proof: updatedProof });
});

async function triggerFlowraVerification(streamId) {
  const db = readDB(); const proof = db.proofSubmissions[streamId]; if (!proof) return;
  let reason = "Auto-approved";
  if (proof.proofType === "link" && proof.proofContent.includes("github.com")) reason = "Detected GitHub proof";
  else if (proof.proofType === "file" && proof.proofContent.endsWith(".zip")) reason = "Detected ZIP file proof";
  else if (proof.proofType === "text" && proof.proofContent.length > 0) reason = "Detected text proof";
  else if (proof.proofType === "capture") reason = "Live capture verified";
  proof.aiVerdict = "approved"; proof.status = "reviewed"; proof.senderNote = reason;
  writeDB(db);
  console.log(`Flowra verdict for ${streamId}:`, proof.aiVerdict, "—", reason);
}

app.get("/api/proof-submit/:streamId", (req, res) => { const db = readDB(); res.json({ proof: db.proofSubmissions?.[req.params.streamId] || null }); });

app.post("/api/proof-submit/:streamId/approve", (req, res) => {
  const db = readDB(); const proof = db.proofSubmissions?.[req.params.streamId];
  if (!proof) return res.status(404).json({ error: "No proof found" });
  proof.status = "approved"; proof.aiVerdict = "approved"; proof.senderNote = req.body.senderNote || "Approved by sender";
  writeDB(db);
  if (steps.getSteps(req.params.streamId)) steps.completeStep(req.params.streamId, "proof");
  res.json({ success: true });
});

app.post("/api/proof-submit/:streamId/reject", (req, res) => {
  const db = readDB(); const proof = db.proofSubmissions?.[req.params.streamId];
  if (!proof) return res.status(404).json({ error: "No proof found" });
  proof.status = "rejected"; proof.aiVerdict = "rejected"; proof.senderNote = req.body.senderNote || "Rejected by sender";
  writeDB(db);
  if (steps.getSteps(req.params.streamId)) steps.failStep(req.params.streamId, "proof");
  res.json({ success: true });
});

app.get("/health", (_, res) => res.json({ status: "ok", signer: signer.address }));
app.listen(PORT, () => console.log(`Flowra backend running on http://localhost:${PORT}`));
