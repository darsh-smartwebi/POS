import { Server } from "socket.io";
import db from "./db.js";
import { getCachedOrders } from "./state/orderState.js";

export function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.emit("orders:update", {
  org_id: null,
  orders: getCachedOrders(),
});

    socket.on("orders:filter", async (order_id) => {
      try {
        if (!order_id) {
          socket.emit("orders:filterResult", { error: "order_id is required" });
          return;
        }

        const [rows] = await db.execute(
          "SELECT * FROM orders WHERE order_id = ? AND isActive = 1 LIMIT 1",
          [order_id]
        );

        if (rows.length) socket.emit("orders:filterResult", rows[0]);
        else socket.emit("orders:filterResult", { error: "Order not found" });
      } catch (err) {
        console.error("Socket filter error:", err);
        socket.emit("orders:filterResult", { error: "Server error" });
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
}