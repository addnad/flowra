async function getBalance(userId, redisGet) {
  const key = `ledger:${userId.toLowerCase()}`;
  const record = await redisGet(key);
  return record || { available: "0", locked: "0" };
}

async function credit(userId, amount, redisGet, redisSet) {
  const key = `ledger:${userId.toLowerCase()}`;
  const record = await getBalance(userId, redisGet);
  const newAvailable = (parseFloat(record.available) + parseFloat(amount)).toFixed(6);
  await redisSet(key, { available: newAvailable, locked: record.locked });
  return { available: newAvailable, locked: record.locked };
}

async function debit(userId, amount, redisGet, redisSet) {
  const key = `ledger:${userId.toLowerCase()}`;
  const record = await getBalance(userId, redisGet);
  const current = parseFloat(record.available);
  const debitAmount = parseFloat(amount);
  if (current < debitAmount) throw new Error("Insufficient balance");
  const newAvailable = (current - debitAmount).toFixed(6);
  await redisSet(key, { available: newAvailable, locked: record.locked });
  return { available: newAvailable, locked: record.locked };
}

async function lock(userId, amount, redisGet, redisSet) {
  const key = `ledger:${userId.toLowerCase()}`;
  const record = await getBalance(userId, redisGet);
  const current = parseFloat(record.available);
  const lockAmount = parseFloat(amount);
  if (current < lockAmount) throw new Error("Insufficient balance to lock");
  const newAvailable = (current - lockAmount).toFixed(6);
  const newLocked = (parseFloat(record.locked) + lockAmount).toFixed(6);
  await redisSet(key, { available: newAvailable, locked: newLocked });
  return { available: newAvailable, locked: newLocked };
}

async function unlock(userId, amount, redisGet, redisSet) {
  const key = `ledger:${userId.toLowerCase()}`;
  const record = await getBalance(userId, redisGet);
  const currentLocked = parseFloat(record.locked);
  const unlockAmount = parseFloat(amount);
  if (currentLocked < unlockAmount) throw new Error("Insufficient locked balance");
  const newLocked = (currentLocked - unlockAmount).toFixed(6);
  const newAvailable = (parseFloat(record.available) + unlockAmount).toFixed(6);
  await redisSet(key, { available: newAvailable, locked: newLocked });
  return { available: newAvailable, locked: newLocked };
}

module.exports = { getBalance, credit, debit, lock, unlock };
