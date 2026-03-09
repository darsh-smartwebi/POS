import axios from "axios";
import db from "../db.js";

const EXTERNAL_API_URL = "https://region02devapi.azurewebsites.net/api/user?idx=spzqywwhyavuopt";

async function createUser(user) {
  const query = `
    INSERT INTO pos_users (first_name, last_name, role, email, phone_no, password, org_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    user.firstName,
    user.lastName,
    user.role,
    user.email,
    user.phoneNo,
    user.password || null,
    user.orgId || null,
  ];

  const [result] = await db.execute(query, values);

  return {
    id: result.insertId,
    ...user,
  };
}

export async function getAllUsers(search) {
  if (search && search !== "null" && search.trim() !== "") {
    const like = `%${search}%`;

    const [rows] = await db.execute(
      `
      SELECT * FROM pos_users
      WHERE first_name LIKE ?
         OR last_name LIKE ?
         OR email LIKE ?
         OR role LIKE ?
         OR phone_no LIKE ?
      ORDER BY id DESC
      `,
      [like, like, like, like, like]
    );

    return rows;
  }

  const [rows] = await db.execute(`SELECT * FROM pos_users ORDER BY id DESC`);
  return rows;
}

export async function getUserById(id) {
  const [rows] = await db.execute(
    `SELECT * FROM pos_users WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function updateUser(id, userDetails) {
  const existingUser = await getUserById(id);

  if (!existingUser) {
    throw new Error(`User not found with id: ${id}`);
  }

  const updatedUser = {
    firstName: userDetails.firstName ?? existingUser.first_name,
    lastName: userDetails.lastName ?? existingUser.last_name,
    role: userDetails.role ?? existingUser.role,
    email: userDetails.email ?? existingUser.email,
    phoneNo: userDetails.phoneNo ?? existingUser.phone_no,
    password: userDetails.password ?? existingUser.password,
    orgId: userDetails.orgId ?? existingUser.org_id,
  };

  await db.execute(
    `
    UPDATE pos_users
    SET first_name = ?, last_name = ?, role = ?, email = ?, phone_no = ?, password = ?, org_id = ?
    WHERE id = ?
    `,
    [
      updatedUser.firstName,
      updatedUser.lastName,
      updatedUser.role,
      updatedUser.email,
      updatedUser.phoneNo,
      updatedUser.password,
      updatedUser.orgId,
      id,
    ]
  );

  return { id: Number(id), ...updatedUser };
}

export async function deleteUser(id) {
  const [result] = await db.execute(`DELETE FROM pos_users WHERE id = ?`, [id]);
  return result;
}

export async function createUserAfterValidation(user) {
  const requestBody = {
    First_name: user.firstName,
    Last_name: user.lastName,
    Role: user.role,
    Email: user.email,
    PhoneNumber: user.phoneNo,
  };

  try {
    const response = await axios.post(EXTERNAL_API_URL, requestBody, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("Azure response:", response.data);

    const responseBody = response.data;

    if (responseBody && responseBody.statusCode != null) {
      const apiStatusCode = Number(responseBody.statusCode);

      if (apiStatusCode >= 200 && apiStatusCode < 300) {
        const savedUser = await createUser(user);
        return {
          ok: true,
          status: 200,
          data: savedUser,
        };
      }

      return {
        ok: false,
        status: 400,
        data: responseBody.message || "External API returned failure",
      };
    }

    return {
      ok: false,
      status: 400,
      data: "External API failed",
    };
  } catch (error) {
    if (error.response?.status === 403) {
      return {
        ok: false,
        status: 403,
        data: "Azure Function authorization failed",
      };
    }

    return {
      ok: false,
      status: 500,
      data: error.message || "Internal server error",
    };
  }
}