import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

/* ---------------- CONFIG ---------------- */

const PORT = Number(process.env.PORT) || 3000;
const SCRIPT_URL_1 = process.env.SCRIPT_URL_1;
const SCRIPT_URL_2 = process.env.SCRIPT_URL_2;

/* ---------------- CACHE ---------------- */

let cachedOrders = [];
let lastSnapshot = null;

/* ---------------- FETCH ---------------- */

async function fetchFromUrl(url) {
  const r = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  return await r.json();
}

async function fetchAllOrders() {
  const [data1, data2] = await Promise.all([
    fetchFromUrl(SCRIPT_URL_1),
    fetchFromUrl(SCRIPT_URL_2),
  ]);

  return [...data1, ...data2];
}

/* ---------------- WATCHER ---------------- */

async function watchOrders() {
  try {
    const data = await fetchAllOrders();
    const newHash = JSON.stringify(data);

    if (!lastSnapshot) {
      cachedOrders = data;
      lastSnapshot = newHash;
      return;
    }

    if (newHash !== lastSnapshot) {
      console.log("Orders changed → pushing to clients");

      cachedOrders = data;
      lastSnapshot = newHash;

      io.emit("orders:update", cachedOrders);
    }
  } catch (err) {
    console.log("Watcher error:", err.message);
  }
}

setInterval(watchOrders, 5000);

/* ---------------- SOCKET ---------------- */

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send current cache immediately
  socket.emit("orders:update", cachedOrders);

  // Filter via socket
  socket.on("orders:filter", (order_id) => {
    const record = cachedOrders.find(
      (order) => String(order.order_id) === String(order_id),
    );

    if (record) {
      socket.emit("orders:filterResult", record);
    } else {
      socket.emit("orders:filterResult", { error: "Order not found" });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

/* ---------------- ROUTES ---------------- */

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/orders", (req, res) => {
  res.json(cachedOrders);
});

app.get("/api/filter", (req, res) => {
  const { order_id } = req.query;

  if (!order_id) return res.status(400).json({ error: "order_id is required" });

  const record = cachedOrders.find(
    (order) => String(order.order_id) === String(order_id),
  );

  if (!record) return res.status(404).json({ error: "Order not found" });

  res.json(record);
});

/* ---------------- START ---------------- */

server.listen(PORT, () => console.log(`Server running on :${PORT}`));
