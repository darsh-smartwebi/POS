import express from "express";
import cors from "cors";
import http from "http";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger.js";
import { initSocket } from "./socket.js";
import { startOrderWatcher } from "./watchers/orderWatcher.js";

import orderRoutes from "./routes/orderRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import userRoutes from "./routes/userRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = initSocket(server);

const PORT = Number(process.env.PORT) || 3000;

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api", orderRoutes(io));
app.use("/api", customerRoutes);
app.use("/api", organizationRoutes);
app.use("/api", userRoutes);

startOrderWatcher(io);

server.listen(PORT, () => {
  console.log(`Server running on :${PORT}`);
});