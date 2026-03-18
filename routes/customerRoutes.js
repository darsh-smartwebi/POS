import express from "express";
import db from "../db.js";

const router = express.Router();

/**
 * @openapi
 * /api/customers:
 *   get:
 *     summary: Get all customers
 *     tags:
 *       - Customers
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or phone
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort by last_order (default desc)
 *     responses:
 *       200:
 *         description: List of customers
 *       500:
 *         description: Server error
 */
router.get("/customers", async (req, res) => {
  try {
    const { search, sort = "desc" } = req.query;

    let query = `
      SELECT id, full_name, phone, total_visits, last_order, last_order_id
      FROM customers
    `;

    const params = [];

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

/**
 * @openapi
 * /api/getCustomersByOrg:
 *   get:
 *     summary: Get customers by organization ID
 *     tags:
 *       - Customers
 *     parameters:
 *       - in: query
 *         name: orgId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or phone
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort by last_order (default desc)
 *     responses:
 *       200:
 *         description: List of customers filtered by orgId
 *       400:
 *         description: orgId is required
 *       500:
 *         description: Server error
 */
router.get("/getCustomersByOrg", async (req, res) => {
  try {
    const { search, sort = "desc", orgId } = req.query;

    if (!orgId) {
      return res.status(400).json({ error: "orgId is required" });
    }

    let query = `
      SELECT id, full_name, phone, org_id, total_visits, last_order, last_order_id
      FROM customers
      WHERE org_id = ?
    `;

    const params = [orgId];

    if (search) {
      query += `
        AND (full_name LIKE ?
        OR phone LIKE ?)
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

export default router;