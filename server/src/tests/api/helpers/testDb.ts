import { Database } from 'sqlite';
import { initializeDB } from '../../../databaseInitializer';
import { hashPassword } from '../../../Utils/hash';
import { UserRole } from '../../../ValueTypes/UserRole';

/**
 * Creates an in-memory SQLite database for testing
 */
export async function createTestDb(): Promise<Database> {
  return await initializeDB(':memory:', false);
}

export async function createDefaultUsers(db: Database): Promise<void> {
  return new Promise<void>(async (resolve) => {
    await db.run(
      `INSERT INTO users (name, email, password, status, roleId) VALUES (?, ?, ?, ?, ?)`,
      ['root', 'root@test.com', await hashPassword('Test123!'), 'confirmed', (new UserRole("ADMIN")).getRoleId()]
    );
    await db.run(
      `INSERT INTO users (name, email, password, status, roleId) VALUES (?, ?, ?, ?, ?)`,
      ['default_user', 'default@test.com', await hashPassword('Test123!'), 'confirmed', (new UserRole("USER")).getRoleId()]
    );
    resolve();
  });
}

/**
 * Seeds the database with test data
 */
export async function seedDatabase(db: Database): Promise<any> {

  const role_user: UserRole = new UserRole("USER");
  const role_admin: UserRole = new UserRole("ADMIN");

  // Create admin user
  await db.run(
    `INSERT INTO users (name, email, password, status, roleId) VALUES (?, ?, ?, ?, ?)`,
    ['admin', 'admin@test.com', await hashPassword('Admin123!'), 'confirmed', role_admin.getRoleId()]
  );

  // Create regular confirmed user
  await db.run(
    `INSERT INTO users (name, email, password, status, roleId) VALUES (?, ?, ?, ?, ?)`,
    ['testuser', 'test@test.com', await hashPassword('Test123!'), 'confirmed', role_user.getRoleId()]
  );

  // Create unconfirmed user
  await db.run(
    `INSERT INTO users (name, email, password, status, roleId) VALUES (?, ?, ?, ?, ?)`,
    ['unconfirmed', 'unconfirmed@test.com', await hashPassword('Test123!'), 'unconfirmed', role_user.getRoleId()]
  );

  // Create suspended user
  await db.run(
    `INSERT INTO users (name, email, password, status, roleId) VALUES (?, ?, ?, ?, ?)`,
    ['suspended', 'suspended@test.com', await hashPassword('Test123!'), 'suspended', role_user.getRoleId()]
  );

  // Create removed user
  await db.run(
    `INSERT INTO users (name, email, password, status, roleId) VALUES (?, ?, ?, ?, ?)`,
    ['removed', 'removed@test.com', await hashPassword('Test123!'), 'removed', role_user.getRoleId()]
  );

  // Create test term
  await db.run(
    `INSERT INTO terms (termName, displayName) VALUES (?, ?)`,
    ['WS2024', 'Winter 2024/25']
  );

  // Create test course
  await db.run(
    `INSERT INTO courses (courseName, termId) VALUES (?, ?)`,
    ['Test Course', 1]
  );

  // Create test project
  await db.run(
    `INSERT INTO projects (projectName, courseId) VALUES (?, ?)`,
    ['Test Project', 1]
  );

  // Associate user with project
  await db.run(
    `INSERT INTO user_projects (userId, projectId, role) VALUES (?, ?, ?)`,
    [2, 1, 'Developer']
  );

  // Create schedule for course
  const now = Date.now();
  await db.run(
    `INSERT INTO schedules (id, startDate, endDate) VALUES (?, ?, ?)`,
    [1, Math.floor(now / 1000), Math.floor((now + 30 * 24 * 60 * 60 * 1000) / 1000)]
  );

  // Create submission date
  await db.run(
    `INSERT INTO submissions (id, scheduleId, submissionDate) VALUES (?, ?, ?)`,
    [1, 1, Math.floor((now + 7 * 24 * 60 * 60 * 1000) / 1000)]
  );

  return db;
}

/**
 * Creates a minimal database with just the admin user
 */
export async function createMinimalDb(): Promise<Database> {
  const db = await createTestDb();
  const role_admin: UserRole = new UserRole("ADMIN");

  await db.run(
    `INSERT INTO users (name, email, password, status, roleId) VALUES (?, ?, ?, ?, ?)`,
    ['admin', 'admin@test.com', await hashPassword('Admin123!'), 'confirmed', role_admin.getRoleId()]
  );
  return db;
}

/**
 * Gets a user by email
 */
export async function getUserByEmail(db: Database, email: string) {
  return await db.get('SELECT * FROM users WHERE email = ?', [email]);
}

/**
 * Gets a course by name
 */
export async function getCourseByName(db: Database, courseName: string) {
  return await db.get('SELECT * FROM courses WHERE courseName = ?', [courseName]);
}

/**
 * Gets a project by name
 */
export async function getProjectByName(db: Database, projectName: string) {
  return await db.get('SELECT * FROM projects WHERE projectName = ?', [projectName]);
}

/**
 * Gets a term by name
 */
export async function getTermByName(db: Database, termName: string) {
  return await db.get('SELECT * FROM terms WHERE termName = ?', [termName]);
}

export async function getRoleById(db: Database, id:number) {
  return await db.get('SELECT * FROM roles WHERE id = ?', [id]);
}
