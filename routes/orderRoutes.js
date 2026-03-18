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

  /**
   * @openapi
   * /api/orders:
   *   get:
   *     summary: Get orders by active status and optional organization
   *     tags:
   *       - Orders
   *     parameters:
   *       - in: query
   *         name: isActive
   *         schema:
   *           type: string
   *           enum: ["0", "1"]
   *         description: Filter active or inactive orders. Default is active.
   *       - in: query
   *         name: orgId
   *         schema:
   *           type: integer
   *         description: Filter orders by organization ID
   *     responses:
   *       200:
   *         description: List of orders
   *       500:
   *         description: Server error
   */
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

  /**
   * @openapi
   * /api/filter:
   *   get:
   *     summary: Get a single order by order ID
   *     tags:
   *       - Orders
   *     parameters:
   *       - in: query
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Order ID like ORD-1
   *       - in: query
   *         name: isActive
   *         schema:
   *           type: string
   *           enum: ["true", "false", "1", "0"]
   *         description: Optional active status filter
   *     responses:
   *       200:
   *         description: Order found successfully
   *       400:
   *         description: Invalid input
   *       404:
   *         description: Order not found
   *       500:
   *         description: Server error
   */
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

  /**
   * @openapi
   * /api/orders:
   *   post:
   *     summary: Create a new order
   *     tags:
   *       - Orders
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - org_id
   *             properties:
   *               customer_name:
   *                 type: string
   *                 example: Darsh
   *               phone:
   *                 type: string
   *                 example: "9876543210"
   *               table_number:
   *                 type: string
   *                 example: "5"
   *               items_ordered:
   *                 type: string
   *                 example: 1 Nachos, 2 Coke
   *               special_instructions:
   *                 type: string
   *                 example: No onion
   *               org_id:
   *                 type: integer
   *                 example: 1
   *     responses:
   *       201:
   *         description: Order created successfully
   *       400:
   *         description: org_id is required
   *       500:
   *         description: Server error
   */
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

      await connection.execute(
        `
      INSERT INTO org_order_counters (org_id, last_order_number)
      VALUES (?, 0)
      ON DUPLICATE KEY UPDATE org_id = org_id
      `,
        [org_id],
      );

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

      await connection.execute(
        `
      UPDATE org_order_counters
      SET last_order_number = ?
      WHERE org_id = ?
      `,
        [nextOrderNumber, org_id],
      );

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

      const freshOrders = await fetchOrdersFromDb(org_id);
      setCachedOrders(org_id, freshOrders);
      setLastSnapshot(org_id, buildOrdersSignature(freshOrders));
      io.to(`org:${org_id}`).emit("orders:update", freshOrders);

      return res.status(201).json(newOrder);
    } catch (err) {
      await connection.rollback();
      connection.release();
      console.error("Create order error:", err.message);
      return res.status(500).json({ error: "Failed to create order" });
    }
  });

  /**
   * @openapi
   * /api/orders/{id}/deactivate:
   *   put:
   *     summary: Deactivate an order and update customer data
   *     tags:
   *       - Orders
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Database ID of the order
   *     responses:
   *       200:
   *         description: Order deactivated successfully
   *       404:
   *         description: Order not found
   *       500:
   *         description: Server error
   */
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
      io.to(`org:${org_id}`).emit("orders:update", freshOrders);

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