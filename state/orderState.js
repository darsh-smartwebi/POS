let cachedOrders = [];
let lastSnapshot = null;

export function getCachedOrders() {
  return cachedOrders;
}

export function setCachedOrders(orders) {
  cachedOrders = Array.isArray(orders) ? orders : [];
}

export function getLastSnapshot() {
  return lastSnapshot;
}

export function setLastSnapshot(snapshot) {
  lastSnapshot = snapshot;
}

export function buildOrdersSignature(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(
      (o) =>
        [
          o.id,
          o.org_id,
          o.order_id,
          o.isActive,
          o.customer_name,
          o.phone,
          o.table_number,
          o.items_ordered,
          o.special_instructions,
          o.created_at,
          o.updated_at,
          o.timestamp,
        ].join("|"),
    )
    .join("||");
}