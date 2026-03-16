import { fetchOrdersFromDb } from "../services/orderService.js";
import {
  setCachedOrders,
  getLastSnapshot,
  setLastSnapshot,
  buildOrdersSignature,
} from "../state/orderState.js";

export async function watchOrders() {
  try {
    const rows = await fetchOrdersFromDb();
    const signature = buildOrdersSignature(rows);

    if (signature !== getLastSnapshot()) {
      setCachedOrders(rows);
      setLastSnapshot(signature);
    }
  } catch (err) {
    console.log("Watcher error:", err.message);
  }
}

export function startOrderWatcher() {
  watchOrders();
  setInterval(() => watchOrders(), 5000);
}