import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

const app = express();
app.use(cors());

/* ---------------- SOCKET SERVER ---------------- */

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }, // change later
});

/* client connect */
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

/* ---------------- CONFIG ---------------- */

const PORT = Number(process.env.PORT) || 3000;
const SCRIPT_URL =
  process.env.SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbw-ZCdZgsuYb4HFNibKdZIVawNbhN6ZrNRmpRY_vUf8y8F0GMQC5USJiltywcBxvrG7AQ/exec";

/* ---------------- HEALTH ---------------- */

app.get("/health", (req, res) => res.json({ ok: true }));

/* ---------------- FETCH FUNCTION ---------------- */

async function fetchOrders() {
  const r = await fetch(SCRIPT_URL, {
    headers: { Accept: "application/json" },
  });

  return await r.json();
}

/* ---------------- REALTIME WATCHER ---------------- */

/*
We compare last data snapshot.
If different → emit socket event
*/
let lastSnapshot = null;

function isChanged(newData) {
  const newHash = JSON.stringify(newData);
  const changed = newHash !== lastSnapshot;
  lastSnapshot = newHash;
  return changed;
}

async function watchOrders() {
  try {
    const data = await fetchOrders();

    if (!lastSnapshot) {
      lastSnapshot = JSON.stringify(data);
      return;
    }

    if (isChanged(data)) {
      console.log("Orders changed → pushing to clients");

      io.emit("orders:update", data);
    }
  } catch (err) {
    console.log("Watcher error:", err.message);
  }
}

/* check every 5 seconds */
setInterval(watchOrders, 5000);

/* ---------------- ROUTES ---------------- */

app.get("/api/orders", async (req, res) => {
  try {
    const data = await fetchOrders();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/filter", async (req, res) => {
  try {
    const { order_id } = req.query;

    if (!order_id)
      return res.status(400).json({ error: "order_id is required" });

    const data = await fetchOrders();

    const record = data.find(
      (order) => String(order.order_id) === String(order_id),
    );

    if (!record) return res.status(404).json({ error: "Order not found" });

    res.json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------------- START ---------------- */

server.listen(PORT, () => console.log(`Server running on :${PORT}`));
