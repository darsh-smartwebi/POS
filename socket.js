import { Server } from "socket.io";
import db from "./db.js";
import { getCachedOrders } from "./state/orderState.js";

export function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST", "PUT"] },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Client must join their org room immediately after connecting
    socket.on("org:join", (orgId) => {
      if (!orgId) return;

      // Leave any previously joined org rooms
      socket.rooms.forEach((room) => {
        if (room !== socket.id && room.startsWith("org:")) {
          socket.leave(room);
        }
      });

      const room = `org:${orgId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined room ${room}`);

      // Send current cached orders for this org immediately
      socket.emit("orders:update", getCachedOrders(orgId));
    });

    socket.on("orders:filter", async ({ order_id, org_id }) => {
      try {
        if (!order_id || !org_id) {
          socket.emit("orders:filterResult", {
            error: "order_id and org_id are required",
          });
          return;
        }

        const [rows] = await db.execute(
          "SELECT * FROM orders WHERE order_id = ? AND org_id = ? AND isActive = 1 LIMIT 1",
          [order_id, org_id]
        );

        socket.emit(
          "orders:filterResult",
          rows.length ? rows[0] : { error: "Order not found" }
        );
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