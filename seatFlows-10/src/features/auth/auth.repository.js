import { query } from "../../config/db.js"

export const findUserByEmail = async (email) => {
    const sql = `
    SELECT id,email,password_hash, full_name, phone_number, role,created_at FROM users WHERE LOWER(email)=LOWER($1);
    `;

    const result = await query(sql, [email]);
    return result.rows[0] || null;
};

export const findUserById = async (id) => {
    const sql = `
    SELECT id, email, password_hash,full_name, phone_number, role, created_at FROM users WHERE id=$1;
    `;

    const result = await query(sql, [id])

    return result.rows[0] || null
}

export const createUser = async ({ email, passwordHash, fullName, phoneNumber, role }, client = null) => {
    const sql = `
    INSERT INTO users(email, password_hash, full_name, phone_number, role)
    VALUES($1,$2,$3,$4,$5)
    RETURNING id, email, full_name, phone_number, role, created_at;
    `;

    const params = [email, passwordHash, fullName, phoneNumber, role || 'CUSTOMER']

    // ALLOW RUNNING EITHER ON THE GENERAL POOL OR WITHIN A TRANSACTION CLIENT
    const runner = client || { query };
    const result = await runner.query(sql, params);
    return result.rows[0];
}

export const createOrganizer = async ({ userId, organizationName, bio, contactEmail }, client = null) => {
    const sql = `
    INSERT INTO organizers (user_id, organization_name, bio, contact_email)
    VALUES ($1, $2, $3, $4)
    RETURNING id, user_id, organization_name, contact_email, is_verified, created_at;
  `;
    const params = [userId, organizationName, bio || null, contactEmail];

    const runner = client || { query };
    const result = await runner.query(sql, params);
    return result.rows[0];
};