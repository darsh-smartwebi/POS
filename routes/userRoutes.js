import express from "express";
import {
  createUserAfterValidation,
  getAllUsers,
  getUserByEmail,
  getUserById,
  updateUser,
  deleteUser,
  getUsersByOrgId,
} from "../services/userService.js";

const router = express.Router();

router.post("/users", async (req, res) => {
  try {
    req.body.orgId = req.body.orgId ?? req.query.orgId;

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

router.get("/usersByOrgId", async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId) {
      return res.status(400).json({ error: "orgId is required" });
    }

    const users = await getUsersByOrgId(orgId);
    return res.json(users);

  } catch (error) {
    console.error("get users by orgId error:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.get("/users/by-email", async (req, res) => {
  try {
    const email = req.query.email?.trim();
    const orgId = req.query.orgId;

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    const user = await getUserByEmail(email, orgId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    console.error("get user by email error:", error);
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

export default router;