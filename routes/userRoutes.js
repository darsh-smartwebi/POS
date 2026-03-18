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

/**
 * @openapi
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         name: orgId
 *         schema:
 *           type: integer
 *         description: Optional orgId from query if not sent in body
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: Darsh
 *               lastName:
 *                 type: string
 *                 example: Torani
 *               role:
 *                 type: string
 *                 example: Admin
 *               email:
 *                 type: string
 *                 example: darsh@gmail.com
 *               phoneNo:
 *                 type: string
 *                 example: "9876543210"
 *               password:
 *                 type: string
 *                 example: "123456"
 *               orgId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: User created successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
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

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search users
 *     responses:
 *       200:
 *         description: List of users
 *       500:
 *         description: Server error
 */
router.get("/users", async (req, res) => {
  try {
    const users = await getAllUsers(req.query.search);
    return res.json(users);
  } catch (error) {
    console.error("get all users error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/usersByOrgId:
 *   get:
 *     summary: Get users by organization ID
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         name: orgId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: List of users for the organization
 *       400:
 *         description: orgId is required
 *       500:
 *         description: Server error
 */
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

/**
 * @openapi
 * /api/users/by-email:
 *   get:
 *     summary: Get user by email
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: User email
 *       - in: query
 *         name: orgId
 *         schema:
 *           type: integer
 *         description: Optional organization ID
 *     responses:
 *       200:
 *         description: User found successfully
 *       400:
 *         description: email is required
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get("/users/by-email", async (req, res) => {
  try {
    const email = req.query.email?.replace(/ /g, "+");
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

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User found successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
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

/**
 * @openapi
 * /api/users/{id}:
 *   put:
 *     summary: Update user by ID
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               role:
 *                 type: string
 *               email:
 *                 type: string
 *               phoneNo:
 *                 type: string
 *               password:
 *                 type: string
 *               orgId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
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

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     summary: Delete user by ID
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
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