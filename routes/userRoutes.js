import express from "express";
import {
  createUserAfterValidation,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../services/userService.js";

const router = express.Router();

router.post("/users", async (req, res) => {
  try {
    const result = await createUserAfterValidation(req.body);
    return res.status(result.status).json(result.data);
  } catch (error) {
    console.error("create user error:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await getAllUsers(req.query.search);
    return res.json(users);
  } catch (error) {
    console.error("get all users error:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const user = await getUserById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    console.error("get user by id error:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.put("/users/:id", async (req, res) => {
  try {
    const updatedUser = await updateUser(req.params.id, req.body);
    return res.json(updatedUser);
  } catch (error) {
    console.error("update user error:", error);

    if (error.message.includes("User not found")) {
      return res.status(404).json({ error: error.message });
    }

    return res.status(500).json({ error: error.message });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const result = await deleteUser(req.params.id);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("delete user error:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.get("/users/by-email", async (req, res) => {
  try {
    const email = req.query.email?.trim();
    const orgId = req.query.orgId;

    console.log("req.query:", req.query);
    console.log("email:", `[${email}]`);
    console.log("orgId:", orgId);

    if (!email) {
      return res.status(400).json({
        error: "email is required",
      });
    }

    let query = `
      SELECT *
      FROM pos_users
      WHERE TRIM(LOWER(email)) = TRIM(LOWER(?))
    `;
    const params = [email];

    if (orgId !== undefined && orgId !== null && orgId !== "") {
      query += " AND orgId = ?";
      params.push(orgId);
    }

    query += " LIMIT 1";

    console.log("query:", query);
    console.log("params:", params);

    const [rows] = await db.execute(query, params);

    console.log("rows found:", rows.length);

    if (!rows.length) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to fetch user",
    });
  }
});

export default router;