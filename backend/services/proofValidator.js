// ─── Proof Validation Service ─────────────────────────────────────────────────
const DEFAULT_FRESHNESS_WINDOW_MS = 5 * 60 * 1000;
function validateFreshness(capturedAt, windowMs = DEFAULT_FRESHNESS_WINDOW_MS) {
  if (!capturedAt || typeof capturedAt !== "number") return { valid: false, reason: "Missing or invalid capture timestamp." };
  const ageMs = Date.now() - capturedAt;
  if (ageMs < 0) return { valid: false, reason: "Proof timestamp is in the future." };
  if (ageMs > windowMs) return { valid: false, reason: `Proof is ${Math.round(ageMs/1000)}s old. Must be within ${Math.round(windowMs/1000)}s of capture.` };
  return { valid: true, reason: "Proof is fresh." };
}
function validateProofMeta(proof) {
  if (!proof) return { valid: false, reason: "No proof data." };
  if (!proof.proofType) return { valid: false, reason: "Missing proofType." };
  if (!proof.proofContent || proof.proofContent.trim().length === 0) return { valid: false, reason: "Proof content is empty." };
  if (proof.proofType === "link") { try { new URL(proof.proofContent); } catch { return { valid: false, reason: "Link proof is not a valid URL." }; } }
  return { valid: true, reason: "Metadata valid." };
}
function validateProof(proof, capturedAt, freshnessWindowMs) {
  const metaCheck = validateProofMeta(proof); if (!metaCheck.valid) return metaCheck;
  const freshnessCheck = validateFreshness(capturedAt, freshnessWindowMs); if (!freshnessCheck.valid) return freshnessCheck;
  return { valid: true, reason: "Proof passed all checks." };
}
module.exports = { validateProof, validateFreshness, validateProofMeta, DEFAULT_FRESHNESS_WINDOW_MS };
