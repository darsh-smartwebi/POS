import express from "express";
import db from "../db.js";

const router = express.Router();

/**
 * @openapi
 * /api/organization:
 *   post:
 *     summary: Create a new organization
 *     tags:
 *       - Organizations
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - org_title
 *             properties:
 *               org_title:
 *                 type: string
 *                 example: My Restaurant
 *               org_type:
 *                 type: string
 *                 example: Cafe
 *               org_address:
 *                 type: string
 *                 example: Surat, Gujarat
 *               org_logo:
 *                 type: string
 *                 example: https://example.com/logo.png
 *               org_preview_link:
 *                 type: string
 *                 example: https://example.com/preview
 *               org_embedcode:
 *                 type: string
 *                 example: <iframe></iframe>
 *               org_qrcode:
 *                 type: string
 *                 example: https://example.com/qr.png
 *     responses:
 *       200:
 *         description: Organization created successfully
 *       400:
 *         description: org_title is required
 *       500:
 *         description: Server error
 */
router.post("/organization", async (req, res) => {
  try {
    const {
      org_title,
      org_type,
      org_address,
      org_logo,
      org_preview_link,
      org_embedcode,
      org_qrcode,
    } = req.body;

    if (!org_title || !org_title.trim()) {
      return res.status(400).json({ error: "org_title is required" });
    }

    const [result] = await db.execute(
      `
      INSERT INTO pos_organization
      (
        org_title,
        org_type,
        org_address,
        org_logo,
        org_preview_link,
        org_embedcode,
        org_qrcode
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        org_title.trim(),
        org_type ?? null,
        org_address ?? null,
        org_logo ?? null,
        org_preview_link ?? null,
        org_embedcode ?? null,
        org_qrcode ?? null,
      ],
    );

    const [rows] = await db.execute(
      `SELECT * FROM pos_organization WHERE id = ?`,
      [result.insertId],
    );

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error("Create organization error:", err);
    res.status(500).json({ error: "Failed to create organization" });
  }
});

/**
 * @openapi
 * /api/getAllOrganization:
 *   get:
 *     summary: Get all organizations
 *     tags:
 *       - Organizations
 *     responses:
 *       200:
 *         description: List of all organizations
 *       500:
 *         description: Server error
 */
router.get("/getAllOrganization", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM pos_organization ORDER BY id DESC`,
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Get all organizations error:", err);
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

/**
 * @openapi
 * /api/getOrganizationById:
 *   get:
 *     summary: Get organization by ID
 *     tags:
 *       - Organizations
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization found
 *       400:
 *         description: Organization id is required
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Server error
 */
router.get("/getOrganizationById", async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: "Organization id is required" });
    }

    const [rows] = await db.execute(
      `SELECT * FROM pos_organization WHERE id = ?`,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Organization not found" });
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error("Get organization by id error:", err);
    res.status(500).json({ error: "Failed to fetch organization" });
  }
});

/**
 * @openapi
 * /api/activeOrganization:
 *   get:
 *     summary: Get active organizations
 *     tags:
 *       - Organizations
 *     responses:
 *       200:
 *         description: List of active organizations
 *       500:
 *         description: Server error
 */
router.get("/activeOrganization", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `
      SELECT * FROM pos_organization
      WHERE isActive = 1
      ORDER BY id DESC
      `,
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Get active organizations error:", err);
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

/**
 * @openapi
 * /api/organization:
 *   put:
 *     summary: Update organization by ID
 *     tags:
 *       - Organizations
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               org_title:
 *                 type: string
 *               org_type:
 *                 type: string
 *               org_address:
 *                 type: string
 *               org_logo:
 *                 type: string
 *               org_preview_link:
 *                 type: string
 *               org_embedcode:
 *                 type: string
 *               org_qrcode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Organization updated successfully
 *       400:
 *         description: Organization id is required
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Server error
 */
router.put("/organization", async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: "Organization id is required" });
    }

    const {
      org_title,
      org_type,
      org_address,
      org_logo,
      org_preview_link,
      org_embedcode,
      org_qrcode,
    } = req.body;

    const [rows] = await db.execute(
      `SELECT * FROM pos_organization WHERE id = ?`,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const existing = rows[0];

    await db.execute(
      `
      UPDATE pos_organization
      SET
        org_title = ?,
        org_type = ?,
        org_address = ?,
        org_logo = ?,
        org_preview_link = ?,
        org_embedcode = ?,
        org_qrcode = ?
      WHERE id = ?
      `,
      [
        org_title ?? existing.org_title,
        org_type ?? existing.org_type,
        org_address ?? existing.org_address,
        org_logo ?? existing.org_logo,
        org_preview_link ?? existing.org_preview_link,
        org_embedcode ?? existing.org_embedcode,
        org_qrcode ?? existing.org_qrcode,
        id,
      ],
    );

    const [updated] = await db.execute(
      `SELECT * FROM pos_organization WHERE id = ?`,
      [id],
    );

    res.status(200).json(updated[0]);
  } catch (err) {
    console.error("Update organization error:", err);
    res.status(500).json({ error: "Failed to update organization" });
  }
});

/**
 * @openapi
 * /api/organization/deactivate:
 *   put:
 *     summary: Deactivate organization by ID
 *     tags:
 *       - Organizations
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization deactivated
 *       400:
 *         description: Organization id is required
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Server error
 */
router.put("/organization/deactivate", async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: "Organization id is required" });
    }

    const [result] = await db.execute(
      `UPDATE pos_organization SET isActive = 0 WHERE id = ?`,
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Organization not found" });
    }

    res.status(200).json({ message: "Organization deactivated" });
  } catch (err) {
    console.error("Deactivate organization error:", err);
    res.status(500).json({ error: "Failed to deactivate organization" });
  }
});

/**
 * @openapi
 * /api/organizationByUserEmail:
 *   get:
 *     summary: Get organization by user email
 *     tags:
 *       - Organizations
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: User email
 *     responses:
 *       200:
 *         description: Organization found for user
 *       400:
 *         description: email is required
 *       404:
 *         description: Organization not found for this user
 *       500:
 *         description: Server error
 */
router.get("/organizationByUserEmail", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    const [rows] = await db.execute(
      `
      SELECT o.*
      FROM pos_users u
      JOIN pos_organization o ON u.org_id = o.id
      WHERE u.email = ?
      LIMIT 1
      `,
      [email],
    );

    if (!rows.length) {
      return res
        .status(404)
        .json({ error: "Organization not found for this user" });
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error("Find organization by email error:", err);
    res.status(500).json({ error: "Failed to fetch organization" });
  }
});

export default router;