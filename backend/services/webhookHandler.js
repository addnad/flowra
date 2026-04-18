const { v4: uuidv4 } = require("uuid");
const ledger = require("./ledgerService");

const processedEvents = new Set();

async function handleCircleWebhook(body, redisGet, redisSet) {
  const { clientId, notificationType, transfer } = body;

  if (!notificationType || !transfer) return { ignored: true };

  // idempotency — skip already processed events
  const eventKey = `webhook:${transfer.id}`;
  if (processedEvents.has(eventKey)) return { duplicate: true };
  const alreadyProcessed = await redisGet(eventKey);
  if (alreadyProcessed) return { duplicate: true };

  processedEvents.add(eventKey);
  await redisSet(eventKey, { processedAt: Date.now() });

  if (notificationType === "transfers.complete") {
    const { destination, amount } = transfer;

    if (!destination?.address || !amount?.amount) return { error: "Missing transfer fields" };

    // look up which userId owns this deposit address
    const userId = await redisGet(`depositAddress:${destination.address.toLowerCase()}`);
    if (!userId) {
      console.log("Webhook: unknown deposit address", destination.address);
      return { ignored: true };
    }

    await ledger.credit(userId, amount.amount, redisGet, redisSet);
    console.log(`Webhook: credited ${amount.amount} USDC to ${userId}`);
    return { credited: true, userId, amount: amount.amount };
  }

  if (notificationType === "transfers.failed") {
    console.log("Webhook: transfer failed", transfer.id);
    return { failed: true };
  }

  return { ignored: true };
}

module.exports = { handleCircleWebhook };
