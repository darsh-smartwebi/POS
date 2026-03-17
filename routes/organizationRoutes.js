import express from "express";
import db from "../db.js";

const router = express.Router();

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
