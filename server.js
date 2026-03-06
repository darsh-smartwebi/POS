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
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT"],
  },
});

/* ---------------- CONFIG ---------------- */

const PORT = Number(process.env.PORT) || 3000;

/* ---------------- CACHE ---------------- */

let cachedOrders = [];
let lastSnapshot = null;

/* ---------------- DB HELPERS ---------------- */

async function fetchOrdersFromDb() {
  const [rows] = await db.execute(
    "SELECT * FROM orders WHERE isActive = 1 ORDER BY timestamp DESC",
  );
  return rows;
}

async function fetchOrderByOrderId(id, isActive) {
  let query = "SELECT * FROM orders WHERE order_id = ?";
  const params = [id];

  if (isActive !== undefined) {
    query += " AND isActive = ?";
    params.push(isActive);
  }

  query += " LIMIT 1";

  const [rows] = await db.execute(query, params);
  return rows[0] || null;
}

async function upsertCustomerFromOrder(conn, order) {
  const phone = order?.phone;
  if (!phone) return;

  const name = order?.customer_name ?? null;
  const lastOrderTime = order?.timestamp ?? new Date();
  const lastOrderId = order?.order_id ?? null;

  await conn.execute(
    `
    INSERT INTO customers (full_name, phone, total_visits, last_order, last_order_id)
    VALUES (?, ?, 1, ?, ?)
    ON DUPLICATE KEY UPDATE
      total_visits = total_visits + 1,
      last_order = VALUES(last_order),
      last_order_id = VALUES(last_order_id),
      full_name = COALESCE(VALUES(full_name), full_name)
    `,
    [name, phone, lastOrderTime, lastOrderId],
  );
}

/* ---------------- WATCHER ---------------- */

async function watchOrders() {
  try {
    const rows = await fetchOrdersFromDb();

    const signature = rows
      .map((o) => `${o.order_id}|${o.timestamp}`)
      .join("||");

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
        [order_id],
      );

      if (rows.length) socket.emit("orders:filterResult", rows[0]);
      else socket.emit("orders:filterResult", { error: "Order not found" });
    } catch (err) {
      console.error("Socket filter error:", err);
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
      [activeValue],
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.get("/api/filter", async (req, res) => {
  try {
    const { id, isActive } = req.query;

    if (!id) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    let activeValue;

    if (isActive !== undefined) {
      if (isActive === "true" || isActive === "1") {
        activeValue = 1;
      } else if (isActive === "false" || isActive === "0") {
        activeValue = 0;
      } else {
        return res.status(400).json({ error: "Invalid isActive value" });
      }
    }

    const record = await fetchOrderByOrderId(id, activeValue);

    if (!record) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(record);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    console.log(req.body);
    
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
        customer_name ?? null,
        phone ?? null,
        table_number ?? null,
        items_ordered ?? null,
        special_instructions ?? null,
      ],
    );

    const insertedId = result.insertId;

    const generatedOrderId = `ORD-${String(insertedId).padStart(4, "0")}`;

    await db.execute(`UPDATE orders SET order_id = ? WHERE id = ?`, [
      generatedOrderId,
      insertedId,
    ]);

    const [rows] = await db.execute("SELECT * FROM orders WHERE id = ?", [
      insertedId,
    ]);

    const newOrder = rows[0];

    io.emit("orders:update", await fetchOrdersFromDb());

    res.status(201).json(newOrder);
  } catch (err) {
    console.error("Create order error:", err.message);
    res.status(500).json({ error: "Failed to create order" });
  }
});

app.put("/api/orders/:id/deactivate", async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { id } = req.params;

    await conn.beginTransaction();

    const [rows] = await conn.execute(
      "SELECT * FROM orders WHERE id = ? LIMIT 1",
      [id],
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    const order = rows[0];

    await conn.execute("UPDATE orders SET isActive = 0 WHERE id = ?", [id]);

    await upsertCustomerFromOrder(conn, order);

    await conn.commit();

    cachedOrders = cachedOrders.filter((o) => String(o.id) !== String(id));
    io.emit("orders:update", cachedOrders);

    lastSnapshot = cachedOrders
      .map((o) => `${o.order_id}|${o.timestamp}`)
      .join("||");

    res.json({ message: "Order deactivated and customer updated" });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Failed to deactivate order" });
  } finally {
    conn.release();
  }
});

app.get("/api/customers", async (req, res) => {
  try {
    const { search, sort = "desc" } = req.query;

    let query = `
      SELECT id, full_name, phone, total_visits, last_order, last_order_id
      FROM customers
    `;

    const params = [];

    // Optional search by name or phone
    if (search) {
      query += `
        WHERE full_name LIKE ?
        OR phone LIKE ?
      `;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY last_order ${sort === "asc" ? "ASC" : "DESC"}`;

    const [rows] = await db.execute(query, params);

    res.json(rows);

  } catch (err) {
    console.error("Fetch customers error:", err);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

/* ---------------- START ---------------- */

server.listen(PORT, () => console.log(`Server running on :${PORT}`));
