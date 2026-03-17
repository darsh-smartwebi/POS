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

      // Make sure counter row exists for this org
      await connection.execute(
        `
      INSERT INTO org_order_counters (org_id, last_order_number)
      VALUES (?, 0)
      ON DUPLICATE KEY UPDATE org_id = org_id
      `,
        [org_id],
      );

      // Lock this org's counter row
      const [counterRows] = await connection.execute(
        `
      SELECT last_order_number
      FROM org_order_counters
      WHERE org_id = ?
      FOR UPDATE
      `,
        [org_id],
      );

      let nextOrderNumber = 1;

      if (counterRows.length > 0) {
        nextOrderNumber = Number(counterRows[0].last_order_number || 0) + 1;
      }

      const generatedOrderId = `ORD-${nextOrderNumber}`;

      // Update counter
      await connection.execute(
        `
      UPDATE org_order_counters
      SET last_order_number = ?
      WHERE org_id = ?
      `,
        [nextOrderNumber, org_id],
      );

      // Insert order
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

      const freshOrders = await fetchOrdersFromDb(org_id);   // scoped
      setCachedOrders(org_id, freshOrders);
      setLastSnapshot(org_id, buildOrdersSignature(freshOrders));
      io.to(`org:${org_id}`).emit("orders:update", freshOrders); // ← scoped room

      return res.status(201).json(newOrder);
    } catch (err) {
      await connection.rollback();
      connection.release();
      console.error("Create order error:", err.message);
      return res.status(500).json({ error: "Failed to create order" });
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

      const { org_id } = order;
      const freshOrders = await fetchOrdersFromDb(org_id);
      setCachedOrders(org_id, freshOrders);
      setLastSnapshot(org_id, buildOrdersSignature(freshOrders));
      io.to(`org:${org_id}`).emit("orders:update", freshOrders); // ← scoped room

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
