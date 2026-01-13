import jwt from 'jsonwebtoken';
import { Database } from 'sqlite';

const secret = process.env.JWT_SECRET || 'your_jwt_secret';

/**
 * Generates a JWT token for a given user ID
 */
export async function generateToken(db: Database, role: string): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    const result = await db.get("SELECT u.id FROM users AS u JOIN roles AS r ON u.roleId=r.id WHERE r.userRole=? LIMIT 1", role);
    if (result === undefined) {
      return reject(`Couldn't create Token for Role: ${role}`);
    }
    const token = jwt.sign({ id: result.id }, secret, { expiresIn: '1h' });
    resolve(token);
  });
}

/**
 * Creates an Authorization header with Bearer token
 */
export function createAuthHeader(token: string): string {
  return `Bearer ${token}`;
}

/**
 * Generates a token for the test admin user (ID: 1)
 */
export async function generateAdminToken(db: Database): Promise<string> {
  return new Promise<string>(async (resolve) => {
    const token = await generateToken(db, "ADMIN");
    resolve(token);
  });
}

/**
 * Generates a token for the test regular user (ID: 2)
 */
export async function generateUserToken(db: Database): Promise<string> {
  return new Promise<string>(async (resolve) => {
    const token = await generateToken(db, "USER");
    resolve(token);
  });
}
