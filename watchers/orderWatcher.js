import { fetchOrdersFromDb } from "../services/orderService.js";
import {
  setCachedOrders,
  getLastSnapshot,
  setLastSnapshot,
  buildOrdersSignature,
} from "../state/orderState.js";

export async function watchOrders(io) {
  try {
    const rows = await fetchOrdersFromDb();
    const signature = buildOrdersSignature(rows);

    if (!getLastSnapshot()) {
      setCachedOrders(rows);
      setLastSnapshot(signature);
      return;
    }

    if (signature !== getLastSnapshot()) {
      console.log("Orders changed → pushing org-wise updates");

      setCachedOrders(rows);
      setLastSnapshot(signature);

      const ordersByOrg = rows.reduce((acc, order) => {
        const orgId = order.org_id;
        if (orgId == null) return acc;

        if (!acc[orgId]) {
          acc[orgId] = [];
        }

        acc[orgId].push(order);
        return acc;
      }, {});

      Object.entries(ordersByOrg).forEach(([orgId, orgOrders]) => {
        io.to(`org_${orgId}`).emit("orders:update", orgOrders);
      });
    }
  } catch (err) {
    console.log("Watcher error:", err.message);
  }
}

export function startOrderWatcher(io) {
  watchOrders(io);
  setInterval(() => watchOrders(io), 5000);
}