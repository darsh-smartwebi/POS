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
      console.log("Orders changed → pushing to clients");
      setCachedOrders(rows);
      setLastSnapshot(signature);
      io.emit("orders:update", rows);
    }
  } catch (err) {
    console.log("Watcher error:", err.message);
  }
}

export function startOrderWatcher(io) {
  watchOrders(io);
  setInterval(() => watchOrders(io), 5000);
}