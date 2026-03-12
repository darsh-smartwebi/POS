import express from "express";
import db from "../db.js";
import {
  fetchOrdersFromDb,
  fetchOrdersByActive,
  fetchOrderByOrderId,
  upsertCustomerFromOrder,
} from "../services/orderService.js";
import {
  setCachedOrders,
  setLastSnapshot,
  buildOrdersSignature,
  getCachedOrders,
} from "../state/orderState.js";

export default function orderRoutes(io) {
  const router = express.Router();

  router.get("/orders", async (req, res) => {
    try {
      const { isActive, orgId } = req.query;
      const activeValue = isActive === "0" ? 0 : 1;

      const rows = await fetchOrdersByActive(activeValue, orgId);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  router.get("/filter", async (req, res) => {
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

  router.post("/orders", async (req, res) => {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const {
        customer_name,
        phone,
        table_number,
        items_ordered,
        special_instructions,
        org_id,
      } = req.body;

      if (org_id == null) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: "org_id is required" });
      }

      const [lastOrderRows] = await connection.execute(
        `
      SELECT order_id
      FROM orders
      WHERE org_id = ?
        AND order_id IS NOT NULL
      ORDER BY id DESC
      LIMIT 1
      FOR UPDATE
      `,
        [org_id],
      );

      let nextOrderNumber = 1;

      if (lastOrderRows.length > 0 && lastOrderRows[0].order_id) {
        const lastOrderId = lastOrderRows[0].order_id;
        const lastNumber = parseInt(lastOrderId.split("-")[1], 10);

        if (!isNaN(lastNumber)) {
          nextOrderNumber = lastNumber + 1;
        }
      }

      const generatedOrderId = `ORD-${String(nextOrderNumber).padStart(3, "0")}`;

      const [result] = await connection.execute(
        `
      INSERT INTO orders
      (
        customer_name,
        phone,
        table_number,
        items_ordered,
        special_instructions,
        isActive,
        org_id,
        order_id
      )
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `,
        [
          customer_name ?? null,
          phone ?? null,
          table_number ?? null,
          items_ordered ?? null,
          special_instructions ?? null,
          org_id,
          generatedOrderId,
        ],
      );

      const insertedId = result.insertId;

      const [rows] = await connection.execute(
        `SELECT * FROM orders WHERE id = ?`,
        [insertedId],
      );

      await connection.commit();
      connection.release();

      const newOrder = rows[0];

      const freshOrders = await fetchOrdersFromDb();
      setCachedOrders(freshOrders);
      setLastSnapshot(buildOrdersSignature(freshOrders));
      io.emit("orders:update", freshOrders);

      res.status(201).json(newOrder);
    } catch (err) {
      await connection.rollback();
      connection.release();
      console.error("Create order error:", err.message);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  router.put("/orders/:id/deactivate", async (req, res) => {
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

      const freshOrders = await fetchOrdersFromDb();
      setCachedOrders(freshOrders);
      setLastSnapshot(buildOrdersSignature(freshOrders));
      io.emit("orders:update", freshOrders);

      res.json({ message: "Order deactivated and customer updated" });
    } catch (err) {
      await conn.rollback();
      console.error(err);
      res.status(500).json({ error: "Failed to deactivate order" });
    } finally {
      conn.release();
    }
  });

  return router;
}
