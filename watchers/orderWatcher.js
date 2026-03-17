import db from "../db.js";
import { fetchOrdersFromDb } from "../services/orderService.js";
import {
  setCachedOrders,
  getLastSnapshot,
  setLastSnapshot,
  buildOrdersSignature,
} from "../state/orderState.js";

async function getActiveOrgIds() {
  const [rows] = await db.execute(
    "SELECT DISTINCT org_id FROM orders WHERE isActive = 1"
  );
  return rows.map((r) => r.org_id);
}

async function watchOrdersForOrg(io, orgId) {
  const rows = await fetchOrdersFromDb(orgId); // scoped fetch — see note below
  const signature = buildOrdersSignature(rows);
  const lastSnapshot = getLastSnapshot(orgId);

  if (!lastSnapshot) {
  setCachedOrders(orgId, rows);
  setLastSnapshot(orgId, signature);
  // Force push to any clients already in the room
  io.to(`org:${orgId}`).emit("orders:update", rows);
  return;
}

  if (signature !== lastSnapshot) {
    console.log(`Orders changed for org ${orgId} → pushing update`);
    setCachedOrders(orgId, rows);
    setLastSnapshot(orgId, signature);
    io.to(`org:${orgId}`).emit("orders:update", rows);
  }
}

export async function watchOrders(io) {
  try {
    const orgIds = await getActiveOrgIds();
    await Promise.all(orgIds.map((orgId) => watchOrdersForOrg(io, orgId)));
  } catch (err) {
    console.error("Watcher error:", err.message);
  }
}

export function startOrderWatcher(io) {
  watchOrders(io);
  setInterval(() => watchOrders(io), 5000);
}