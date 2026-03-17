import db from "../db.js";

export async function fetchOrdersFromDb(orgId = null) {
  if (orgId) {
    const [rows] = await db.execute(
      "SELECT * FROM orders WHERE org_id = ? AND isActive = 1 ORDER BY id DESC",
      [orgId]
    );
    return rows;
  }
  // fallback: fetch all (used only internally if needed)
  const [rows] = await db.execute(
    "SELECT * FROM orders WHERE isActive = 1 ORDER BY id DESC"
  );
  return rows;
}

export async function fetchOrdersByActive(isActive, orgId) {
  let query = "SELECT * FROM orders WHERE isActive = ?";
  const params = [isActive];

  if (orgId !== undefined && orgId !== null && orgId !== "") {
    query += " AND org_id = ?";
    params.push(orgId);
  }

  query += " ORDER BY timestamp DESC";

  const [rows] = await db.execute(query, params);
  return rows;
}

export async function fetchOrderByOrderId(id, isActive) {
  let query = "SELECT * FROM orders WHERE order_id = ?";
  const params = [id];

  if (isActive !== undefined) {
    query += " AND isActive = ?";
    params.push(isActive);
  }

  query += " LIMIT 1";

  const [rows] = await db.execute(query, params);
  return rows[0] || null;
}

export async function upsertCustomerFromOrder(conn, order) {
  const phone  = order?.phone;
  const org_id = order?.org_id;

  if (!phone || !org_id) return;

  const name          = order?.customer_name ?? null;
  const lastOrderTime = order?.timestamp ?? new Date();
  const lastOrderId   = order?.order_id ?? null;

  await conn.execute(
    `
    INSERT INTO customers (full_name, phone, org_id, total_visits, last_order, last_order_id)
    VALUES (?, ?, ?, 1, ?, ?)
    ON DUPLICATE KEY UPDATE
      total_visits  = total_visits + 1,
      last_order    = VALUES(last_order),
      last_order_id = VALUES(last_order_id),
      full_name     = COALESCE(VALUES(full_name), full_name)
    `,
    [name, phone, org_id, lastOrderTime, lastOrderId],
  );
}
