import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import db from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

/* ---------------- CONFIG ---------------- */

const PORT = Number(process.env.PORT) || 3000;

/* ---------------- CACHE ---------------- */

let cachedOrders = [];
let lastSnapshot = null;

/* ---------------- DB HELPERS ---------------- */

async function fetchOrdersFromDb() {
  const [rows] = await db.execute(
    "SELECT * FROM orders WHERE isActive = 1 ORDER BY timestamp DESC"
  );
  return rows;
}

async function fetchOrderByOrderId(id) {
  const [rows] = await db.execute(
    "SELECT * FROM orders WHERE iorder_id = ? AND isActive = 1 LIMIT 1",
    [id]
  );
  return rows[0] || null;
}

/* ---------------- WATCHER ---------------- */

async function watchOrders() {
  try {
    const rows = await fetchOrdersFromDb();

    // Make a stable signature so watcher triggers reliably
    const signature = rows.map((o) => `${o.order_id}|${o.timestamp}`).join("||");

    if (!lastSnapshot) {
      cachedOrders = rows;
      lastSnapshot = signature;
      return;
    }

    if (signature !== lastSnapshot) {
      console.log("Orders changed → pushing to clients");
      cachedOrders = rows;
      lastSnapshot = signature;
      io.emit("orders:update", cachedOrders);
    }
  } catch (err) {
    console.log("Watcher error:", err.message);
  }
}

// ✅ Run once immediately, then poll
watchOrders();
setInterval(watchOrders, 5000);

/* ---------------- SOCKET ---------------- */

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.emit("orders:update", cachedOrders);

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
      console.error("Socket filter error:", err); // 👈 IMPORTANT
      socket.emit("orders:filterResult", { error: "Server error" });
    }
  });

  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

/* ---------------- ROUTES ---------------- */

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/orders", async (req, res) => {
  try {
    const { isActive } = req.query;

    // default to active = 1
    const activeValue = isActive === "0" ? 0 : 1;

    const [rows] = await db.execute(
      "SELECT * FROM orders WHERE isActive = ? ORDER BY timestamp DESC",
      [activeValue]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.get("/api/filter", async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Order ID is required" });

    const record = await fetchOrderById(id);

    if (!record) return res.status(404).json({ error: "Order not found" });

    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const {
      customer_name,
      phone,
      table_number,
      items_ordered,
      special_instructions,
    } = req.body;

    const [result] = await db.execute(
      `INSERT INTO orders
      (customer_name, phone, table_number, items_ordered, special_instructions, isActive)
      VALUES (?, ?, ?, ?, ?, 1)`,
      [
        customer_name,
        phone,
        table_number,
        items_ordered,
        special_instructions,
      ]
    );

    const insertedId = result.insertId;

    const generatedOrderId = `ORD-${String(insertedId).padStart(4, "0")}`;

    await db.execute(
      `UPDATE orders SET order_id = ? WHERE id = ?`,
      [generatedOrderId, insertedId]
    );

    const [rows] = await db.execute(
      "SELECT * FROM orders WHERE id = ?",
      [insertedId]
    );

    const newOrder = rows[0];

    io.emit("orders:update", await fetchOrdersFromDb());

    res.status(201).json(newOrder);
  } catch (err) {
    console.error("Create order error:", err.message);
    res.status(500).json({ error: "Failed to create order" });
  }
});

app.put("/api/orders/:id/deactivate", async (req, res) => {
  try {
    const { id } = req.params;

    await db.execute("UPDATE orders SET isActive = 0 WHERE id = ?", [id]);

    cachedOrders = cachedOrders.filter((o) => String(o.id) !== String(id));
    io.emit("orders:update", cachedOrders);

    // update snapshot
    lastSnapshot = cachedOrders
      .map((o) => `${o.order_id}|${o.timestamp}`)
      .join("||");

    res.json({ message: "Order deactivated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to deactivate order" });
  }
});

/* ---------------- START ---------------- */

server.listen(PORT, () => console.log(`Server running on :${PORT}`));