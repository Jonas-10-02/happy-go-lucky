import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { Database } from 'sqlite';
import { createTestDb, seedDatabase, getTermByName, createDefaultUsers } from './helpers/testDb';
import { validTerm } from './helpers/fixtures';
import { Application } from 'express';
import { createApp } from '../../createApp';
import { generateAdminToken, generateUserToken, createAuthHeader } from './helpers/authHelpers';

describe('Term API', () => {
  let db: Database;
  let app: Application;

  let userToken: string;
  let adminToken: string;

  beforeEach(async () => {
    db = await createTestDb();
    await createDefaultUsers(db);
    userToken = await generateUserToken(db);
    adminToken = await generateAdminToken(db);
    app = createApp(db);
  });

  describe('POST /term (create term)', () => {
    it('should create a term with valid data as admin', async () => {
      await seedDatabase(db);
      const term = { termName: 'SS2025', displayName: 'Summer 2025' };

      const response = await request(app)
        .post('/term')
        .set('Authorization', createAuthHeader(adminToken))
        .send(term)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Term created successfully');
      expect(response.body.data).toBeDefined();

      const dbTerm = await getTermByName(db, term.termName);
      expect(dbTerm).toBeDefined();
      expect(dbTerm.termName).toBe(term.termName);
      expect(dbTerm.displayName).toBe(term.displayName);
    });

    it('should reject creation by non-admin user', async () => {
      await seedDatabase(db);
      const term = validTerm();

      const response = await request(app)
        .post('/term')
        .set('Authorization', createAuthHeader(userToken))
        .send(term)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Forbidden: Admin access required');
    });

    it('should reject creation without authentication', async () => {
      await seedDatabase(db);
      const term = validTerm();

      const response = await request(app)
        .post('/term')
        .send(term)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication required');
    });

    it('should reject missing termName', async () => {
      await seedDatabase(db);

      const response = await request(app)
        .post('/term')
        .set('Authorization', createAuthHeader(adminToken))
        .send({ displayName: 'Winter 2024/25' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Term name is required');
    });

    it('should reject non-string termName', async () => {
      await seedDatabase(db);

      const response = await request(app)
        .post('/term')
        .set('Authorization', createAuthHeader(adminToken))
        .send({ termName: 123 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should allow creating term without displayName', async () => {
      await seedDatabase(db);

      const response = await request(app)
        .post('/term')
        .set('Authorization', createAuthHeader(adminToken))
        .send({ termName: 'SS2025' })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle duplicate term names gracefully', async () => {
      await seedDatabase(db);
      const term = { termName: 'SS2025', displayName: 'Summer 2025' };

      await request(app)
        .post('/term')
        .set('Authorization', createAuthHeader(adminToken))
        .send(term)
        .expect(201);

      const response = await request(app)
        .post('/term')
        .set('Authorization', createAuthHeader(adminToken))
        .send(term)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /term (get all terms)', () => {
    it('should return empty array when no terms exist', async () => {
      const response = await request(app)
        .get('/term')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should return all terms', async () => {
      await seedDatabase(db);

      const response = await request(app)
        .get('/term')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return terms with correct structure', async () => {
      await seedDatabase(db);

      const response = await request(app)
        .get('/term')
        .expect(200);

      const term = response.body.data[0];
      expect(term).toHaveProperty('id');
      expect(term).toHaveProperty('termName');
      expect(term).toHaveProperty('displayName');
    });

    it('should return multiple terms', async () => {
      await seedDatabase(db);

      await request(app)
        .post('/term')
        .set('Authorization', createAuthHeader(adminToken))
        .send({ termName: 'SS2025', displayName: 'Summer 2025' })
        .expect(201);

      const response = await request(app)
        .get('/term')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should be accessible without authentication', async () => {
      const response = await request(app)
        .get('/term')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /termCourse (add course to term)', () => {
    beforeEach(async () => {
      await seedDatabase(db);
    });

    it('should add course with valid data as admin', async () => {

      const response = await request(app)
        .post('/termCourse')
        .set('Authorization', createAuthHeader(adminToken))
        .send({ termId: 1, courseName: 'New Course' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Course added successfully');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.courseName).toBe('New Course');
      expect(response.body.data.termId).toBe(1);
    });

    it('should reject creation by non-admin user', async () => {

      const response = await request(app)
        .post('/termCourse')
        .set('Authorization', createAuthHeader(userToken))
        .send({ termId: 1, courseName: 'New Course' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should reject missing termId', async () => {

      const response = await request(app)
        .post('/termCourse')
        .set('Authorization', createAuthHeader(adminToken))
        .send({ courseName: 'New Course' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject missing courseName', async () => {

      const response = await request(app)
        .post('/termCourse')
        .set('Authorization', createAuthHeader(adminToken))
        .send({ termId: 1 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject invalid termId format', async () => {

      const response = await request(app)
        .post('/termCourse')
        .set('Authorization', createAuthHeader(adminToken))
        .send({ termId: 'not-a-number', courseName: 'New Course' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject non-existent termId', async () => {

      const response = await request(app)
        .post('/termCourse')
        .set('Authorization', createAuthHeader(adminToken))
        .send({ termId: 999, courseName: 'New Course' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /term/courses', () => {
    beforeEach(async () => {
      await seedDatabase(db);
    });

    it('should return courses for valid termId', async () => {
      const response = await request(app)
        .get('/term/courses')
        .query({ termId: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should reject missing termId', async () => {
      const response = await request(app)
        .get('/term/courses')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Term ID is required');
    });

    it('should reject invalid termId format', async () => {
      const response = await request(app)
        .get('/term/courses')
        .query({ termId: 'not-a-number' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid term ID');
    });

    it('should return 404 for non-existent term', async () => {
      const response = await request(app)
        .get('/term/courses')
        .query({ termId: 999 })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should be accessible without authentication', async () => {
      const response = await request(app)
        .get('/term/courses')
        .query({ termId: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /term/:id', () => {
    beforeEach(async () => {
      await seedDatabase(db);
    });

    it('should delete term without courses as admin', async () => {

      await request(app)
        .post('/term')
        .set('Authorization', createAuthHeader(adminToken))
        .send({ termName: 'Term To Delete', displayName: 'Delete Me' })
        .expect(201);

      const termResult = await db.get('SELECT id FROM terms WHERE termName = ?', ['Term To Delete']);

      const response = await request(app)
        .delete(`/term/${termResult.id}`)
        .set('Authorization', createAuthHeader(adminToken))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Term deleted successfully');

      const deletedTerm = await db.get('SELECT * FROM terms WHERE id = ?', [termResult.id]);
      expect(deletedTerm).toBeUndefined();
    });

    it('should reject deletion of term with courses as admin', async () => {

      // Term ID 1 from seedDatabase has a course
      const response = await request(app)
        .delete('/term/1')
        .set('Authorization', createAuthHeader(adminToken))
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Cannot delete term with existing courses');

      const term = await db.get('SELECT * FROM terms WHERE id = ?', [1]);
      expect(term).toBeDefined();
    });

    it('should reject invalid term ID as admin', async () => {

      const response = await request(app)
        .delete('/term/not-a-number')
        .set('Authorization', createAuthHeader(adminToken))
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Term ID must be a valid number');
    });

    it('should return 404 for non-existent term as admin', async () => {

      const response = await request(app)
        .delete('/term/999')
        .set('Authorization', createAuthHeader(adminToken))
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Term not found');
    });

    it('should reject deletion by non-admin user', async () => {

      await request(app)
        .post('/term')
        .set('Authorization', createAuthHeader(adminToken))
        .send({ termName: 'Term For Non-Admin Test' })
        .expect(201);

      const termResult = await db.get('SELECT id FROM terms WHERE termName = ?', ['Term For Non-Admin Test']);

      const response = await request(app)
        .delete(`/term/${termResult.id}`)
        .set('Authorization', createAuthHeader(userToken))
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Forbidden: Admin access required');

      const term = await db.get('SELECT * FROM terms WHERE id = ?', [termResult.id]);
      expect(term).toBeDefined();
    });

    it('should reject deletion without authentication', async () => {

      await request(app)
        .post('/term')
        .set('Authorization', createAuthHeader(adminToken))
        .send({ termName: 'Term For No Auth Test' })
        .expect(201);

      const termResult = await db.get('SELECT id FROM terms WHERE termName = ?', ['Term For No Auth Test']);

      const response = await request(app)
        .delete(`/term/${termResult.id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication required');

      const term = await db.get('SELECT * FROM terms WHERE id = ?', [termResult.id]);
      expect(term).toBeDefined();
    });

    it('should reject deletion with invalid token', async () => {

      await request(app)
        .post('/term')
        .set('Authorization', createAuthHeader(adminToken))
        .send({ termName: 'Term For Invalid Token Test' })
        .expect(201);

      const termResult = await db.get('SELECT id FROM terms WHERE termName = ?', ['Term For Invalid Token Test']);

      const response = await request(app)
        .delete(`/term/${termResult.id}`)
        .set('Authorization', 'Bearer invalid-token-123')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid token');

      const term = await db.get('SELECT * FROM terms WHERE id = ?', [termResult.id]);
      expect(term).toBeDefined();
    });
  });
});
