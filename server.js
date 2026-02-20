import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = Number(process.env.PORT) || 3000;

const SCRIPT_URL =
  process.env.SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbz5lXkrFJ7HDsz8LV_JIs-YwoXY0p0BuAhXZWBFxSf2XGfSu2vPbbUT5SA5y88duOakpw/exec";

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/orders", async (req, res) => {
  try {
    const url = new URL(SCRIPT_URL);

    const r = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    const text = await r.text();

    // return JSON if possible, else return raw text
    try {
      return res.status(r.status).json(JSON.parse(text));
    } catch {
      return res.status(r.status).send(text);
    }
  } catch (e) {
    return res
      .status(500)
      .json({ error: "Server error", message: e?.message || String(e) });
  }
});

app.get("/api/filter", async (req, res) => {
  try {
    const { order_id } = req.query;

    if (!order_id) {
      return res.status(400).json({ error: "order_id is required" });
    }

    const r = await fetch(SCRIPT_URL, {
      headers: { Accept: "application/json" },
    });

    const data = await r.json();

    const record = data.find(
      (order) => String(order.order_id) === String(order_id)
    );

    if (!record) {
      return res.status(404).json({ error: "Order not found" });
    }

    return res.json(record); // 👈 return single object
  } catch (e) {
    return res.status(500).json({
      error: "Server error",
      message: e?.message || String(e),
    });
  }
});

app.listen(PORT, () => console.log(`Server running on :${PORT}`));
