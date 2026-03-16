import { fetchOrdersFromDb } from "../services/orderService.js";
import {
  setCachedOrders,
  getLastSnapshot,
  setLastSnapshot,
  buildOrdersSignature,
} from "../state/orderState.js";

const activeOrgIds = new Set();

export async function watchOrders(io) {
  try {
    const rows = await fetchOrdersFromDb();
    const signature = buildOrdersSignature(rows);

    // First run — seed cache & snapshot, no emit needed yet.
    if (!getLastSnapshot()) {
      setCachedOrders(rows);
      setLastSnapshot(signature);

      // Seed the active org set so the first real change is diffed correctly.
      rows.forEach((o) => { if (o.org_id != null) activeOrgIds.add(String(o.org_id)); });
      return;
    }

    if (signature === getLastSnapshot()) return; // nothing changed

    console.log("Orders changed → pushing org-wise updates");

    setCachedOrders(rows);
    setLastSnapshot(signature);

    // Group new rows by org.
    const ordersByOrg = rows.reduce((acc, order) => {
      const orgId = String(order.org_id);
      if (order.org_id == null) return acc;
      if (!acc[orgId]) acc[orgId] = [];
      acc[orgId].push(order);
      return acc;
    }, {});

    // Notify every org that has orders now.
    const newOrgIds = new Set(Object.keys(ordersByOrg));
    newOrgIds.forEach((orgId) => {
      io.to(`org_${orgId}`).emit("orders:update", ordersByOrg[orgId]);
      activeOrgIds.add(orgId);
    });

    // Notify orgs that HAD orders before but have NONE now (all completed/deactivated).
    // Without this, those clients never receive a signal to clear their list.
    activeOrgIds.forEach((orgId) => {
      if (!newOrgIds.has(orgId)) {
        io.to(`org_${orgId}`).emit("orders:update", []);
        activeOrgIds.delete(orgId);
      }
    });

  } catch (err) {
    console.error("Watcher error:", err.message);
  }
}

export function startOrderWatcher(io) {
  watchOrders(io);
  setInterval(() => watchOrders(io), 5000);
}