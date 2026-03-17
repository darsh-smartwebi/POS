// Per-org cache: { [orgId]: { orders: [], snapshot: "" } }
const orgState = new Map();

export function getCachedOrders(orgId) {
  return orgState.get(orgId)?.orders ?? [];
}

export function setCachedOrders(orgId, orders) {
  if (!orgState.has(orgId)) orgState.set(orgId, { orders: [], snapshot: null });
  orgState.get(orgId).orders = orders;
}

export function getLastSnapshot(orgId) {
  return orgState.get(orgId)?.snapshot ?? null;
}

export function setLastSnapshot(orgId, snapshot) {
  if (!orgState.has(orgId)) orgState.set(orgId, { orders: [], snapshot: null });
  orgState.get(orgId).snapshot = snapshot;
}

export function buildOrdersSignature(rows) {
  return rows.map((o) => `${o.order_id}|${o.timestamp}`).join("||");
}

export function getAllOrgIds() {
  return [...orgState.keys()];
}