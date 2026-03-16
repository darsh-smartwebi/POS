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

    socket.on("joinOrg", (orgId) => {
      if (orgId == null) {
        socket.emit("socket:error", { error: "orgId is required" });
        return;
      }

      const roomName = `org_${orgId}`;
      socket.join(roomName);

      console.log(`Socket ${socket.id} joined ${roomName}`);

      const orgOrders = getCachedOrders().filter(
        (order) => String(order.org_id) === String(orgId),
      );

      socket.emit("orders:update", orgOrders);
    });

    socket.on("orders:filter", async ({ order_id, orgId }) => {
      try {
        if (!order_id) {
          socket.emit("orders:filterResult", { error: "order_id is required" });
          return;
        }

        if (orgId == null) {
          socket.emit("orders:filterResult", { error: "orgId is required" });
          return;
        }

        const [rows] = await db.execute(
          `
          SELECT * FROM orders
          WHERE order_id = ?
            AND org_id = ?
            AND isActive = 1
          LIMIT 1
          `,
          [order_id, orgId],
        );

        if (rows.length) {
          socket.emit("orders:filterResult", rows[0]);
        } else {
          socket.emit("orders:filterResult", { error: "Order not found" });
        }
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