import express from "express";
import db from "../db.js";

const router = express.Router();

router.post("/organization", async (req, res) => {
  try {
    const { org_title, org_type, org_address, org_logo } = req.body;

    if (!org_title || !org_title.trim()) {
      return res.status(400).json({ error: "org_title is required" });
    }

    const [result] = await db.execute(
      `
      INSERT INTO pos_organization
      (org_title, org_type, org_address, org_logo)
      VALUES (?, ?, ?, ?)
      `,
      [org_title.trim(), org_type, org_address ?? null, org_logo ?? null]
    );

    const [rows] = await db.execute(
      `SELECT * FROM pos_organization WHERE id = ?`,
      [result.insertId]
    );

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create organization" });
  }
});

router.get("/getAllOrganization", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM pos_organization ORDER BY id DESC`
    );
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

router.get("/activeOrganization", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `
      SELECT * FROM pos_organization
      WHERE isActive = 1
      ORDER BY id DESC
      `
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

router.put("/organization", async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: "Organization id is required" });
    }

    const { org_title, org_type, org_address, org_logo } = req.body;

    const [rows] = await db.execute(
      `SELECT * FROM pos_organization WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const existing = rows[0];

    await db.execute(
      `
      UPDATE pos_organization
      SET org_title = ?, org_type = ?, org_address = ?, org_logo = ?
      WHERE id = ?
      `,
      [
        org_title ?? existing.org_title,
        org_type ?? existing.org_type,
        org_address ?? existing.org_address,
        org_logo ?? existing.org_logo,
        id,
      ]
    );

    const [updated] = await db.execute(
      `SELECT * FROM pos_organization WHERE id = ?`,
      [id]
    );

    res.status(200).json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update organization" });
  }
});

router.put("/organization/deactivate", async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: "Organization id is required" });
    }

    await db.execute(`UPDATE pos_organization SET isActive = 0 WHERE id = ?`, [
      id,
    ]);

    res.status(200).json({ message: "Organization deactivated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to deactivate organization" });
  }
});

export default router;