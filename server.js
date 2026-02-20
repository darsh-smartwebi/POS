import express from "express";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import cors from "cors";

const app = express();
app.use(cors());
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "1mb" }));

// ✅ Put your script URL in env for production
const SCRIPT_URL =
  process.env.SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbz5lXkrFJ7HDsz8LV_JIs-YwoXY0p0BuAhXZWBFxSf2XGfSu2vPbbUT5SA5y88duOakpw/exec";

const PORT = Number(process.env.PORT) || 3000;
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS) || 20000;

// Optional API key protection (recommended if this will be public)
const API_KEY = process.env.API_KEY || ""; // set in hosting env

function requireApiKey(req, res, next) {
  if (!API_KEY) return next();
  const key = req.header("x-api-key") || req.query.key;
  if (key !== API_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// Rate limit to protect your script from getting hammered
app.use(
  "/api/",
  rateLimit({
    windowMs: 60_000,
    max: Number(process.env.RATE_LIMIT_MAX) || 60,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Simple cache to reduce requests to Apps Script
const CACHE_MS = Number(process.env.CACHE_MS) || 10_000; // 10s
let cache = { at: 0, body: null };

app.get("/health", (req, res) => res.json({ ok: true }));

// Proxy endpoint
app.get("/api/orders", requireApiKey, async (req, res) => {
  try {
    // Serve cache if fresh
    if (cache.body && Date.now() - cache.at < CACHE_MS) {
      res.set("Cache-Control", "no-store");
      return res.status(200).json(cache.body);
    }

    // Forward query params to Apps Script (optional)
    const url = new URL(SCRIPT_URL);
    for (const [k, v] of Object.entries(req.query)) {
      if (k === "key") continue; // don't forward API key
      if (v == null) continue;
      url.searchParams.set(k, String(v));
    }

    // Timeout handling
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let upstream;
    try {
      upstream = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const text = await upstream.text();

    // Ensure valid JSON
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return res.status(502).json({
        error: "Apps Script returned non-JSON",
        status: upstream.status,
        raw: text,
      });
    }

    // Cache successful responses
    if (upstream.ok) cache = { at: Date.now(), body: data };

    res.set("Cache-Control", "no-store");
    return res.status(upstream.status).json(data);
  } catch (e) {
    const isAbort = e?.name === "AbortError";
    return res.status(isAbort ? 504 : 500).json({
      error: isAbort ? "Upstream timeout" : "Server error",
      message: e?.message || String(e),
    });
  }
});

// Final error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(PORT, () => console.log(`Server running on :${PORT}`));