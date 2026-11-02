// Read-only figures recomputed from the transaction log, used to check the stored counters.
// Nothing here writes data.

const round3 = (value) => Math.round(value * 1000) / 1000;
const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Differences smaller than this (kg) are rounding, not a mismatch.
export const LEDGER_TOLERANCE_KG = 0.002;

const isCountedRedemption = (tx) => tx.type === "redeem" && tx.status !== "declined";

export function ledgerTotals(transactions) {
  let bottles = 0;
  let weightKg = 0;
  transactions.forEach((tx) => {
    if (tx.type !== "bottle") return;
    bottles += Math.max(0, Math.floor(num(tx.bottleDelta ?? tx.amount)));
    weightKg += Math.max(0, num(tx.kgDelta));
  });
  return { bottles, weightKg: round3(weightKg) };
}

// Per resident: what the log says their balance, lifetime totals and last activity are.
export function ledgerByResident(transactions) {
  const map = new Map();
  const entry = (userId) => {
    if (!map.has(userId)) {
      map.set(userId, {
        earnedKg: 0,
        bottles: 0,
        redeemedKg: 0,
        balanceKg: 0,
        redemptions: 0,
        lastActivity: null,
      });
    }
    return map.get(userId);
  };

  transactions.forEach((tx) => {
    if (!tx.userId || (tx.type !== "bottle" && tx.type !== "redeem")) return;
    const item = entry(tx.userId);
    if (!item.lastActivity || String(tx.timestamp) > String(item.lastActivity)) {
      item.lastActivity = tx.timestamp;
    }
    if (tx.type === "bottle") {
      item.earnedKg = round3(item.earnedKg + Math.max(0, num(tx.kgDelta)));
      item.bottles += Math.max(0, Math.floor(num(tx.bottleDelta ?? tx.amount)));
      item.balanceKg = round3(item.balanceKg + num(tx.kgDelta));
    } else if (isCountedRedemption(tx)) {
      item.redeemedKg = round3(item.redeemedKg + Math.abs(num(tx.riceDeltaKg)));
      item.balanceKg = round3(item.balanceKg + num(tx.kgDelta));
      item.redemptions += 1;
    }
  });
  return map;
}

export function balanceDiffers(user, ledgerEntry) {
  const expected = ledgerEntry ? ledgerEntry.balanceKg : 0;
  return Math.abs(num(user.weightKg) - expected) > LEDGER_TOLERANCE_KG;
}

// Stored counters next to what the log says, for the dashboard data check.
export function counterCheck({ system, residents, transactions }) {
  const ledger = ledgerTotals(transactions);
  const residentBottles = residents.reduce((sum, u) => sum + Math.floor(num(u.recycledItemCount)), 0);
  const residentWeight = round3(residents.reduce((sum, u) => sum + num(u.totalRecycledWeightKg), 0));
  const systemBottles = Math.floor(num(system.totalItemsRecycled));
  const systemWeight = round3(num(system.totalWeightRecycledKg));

  return {
    bottles: { system: systemBottles, residents: residentBottles, ledger: ledger.bottles },
    weightKg: { system: systemWeight, residents: residentWeight, ledger: ledger.weightKg },
    matches:
      systemBottles === ledger.bottles &&
      residentBottles === ledger.bottles &&
      Math.abs(systemWeight - ledger.weightKg) <= LEDGER_TOLERANCE_KG &&
      Math.abs(residentWeight - ledger.weightKg) <= LEDGER_TOLERANCE_KG,
  };
}
