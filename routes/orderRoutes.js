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
    try {
      const {
        customer_name,
        phone,
        table_number,
        items_ordered,
        special_instructions,
        org_id,
      } = req.body;

      const [result] = await db.execute(
        `
        INSERT INTO orders
        (customer_name, phone, table_number, items_ordered, special_instructions, isActive,org_id)
        VALUES (?, ?, ?, ?, ?, 1,?)
        `,
        [
          customer_name ?? null,
          phone ?? null,
          table_number ?? null,
          items_ordered ?? null,
          special_instructions ?? null,
          org_id ?? null,
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

      const freshOrders = await fetchOrdersFromDb();
      setCachedOrders(freshOrders);
      setLastSnapshot(buildOrdersSignature(freshOrders));
      io.emit("orders:update", freshOrders);

      res.status(201).json(newOrder);
    } catch (err) {
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
