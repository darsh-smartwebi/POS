let cachedOrders = [];
let lastSnapshot = null;

export function getCachedOrders() {
  return cachedOrders;
}

export function setCachedOrders(orders) {
  cachedOrders = orders;
}

export function getLastSnapshot() {
  return lastSnapshot;
}

export function setLastSnapshot(snapshot) {
  lastSnapshot = snapshot;
}

export function buildOrdersSignature(rows) {
  return rows.map((o) => `${o.order_id}|${o.timestamp}`).join("||");
}