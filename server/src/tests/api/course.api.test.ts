import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { Database } from 'sqlite';
import { createTestDb, seedDatabase, getCourseByName, createDefaultUsers } from './helpers/testDb';
import { validCourse } from './helpers/fixtures';
import { Application } from 'express';
import { createApp } from '../../createApp';
import { generateAdminToken, generateUserToken, createAuthHeader } from './helpers/authHelpers';

describe('Course API', () => {
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

  describe('POST /course (create course)', () => {
    it('should create a course with valid data', async () => {
      await seedDatabase(db);
      const course = validCourse();
      const response = await request(app)
        .post('/course')
        .send(course)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Course created successfully');
      expect(response.body.data).toBeDefined();

      const dbCourse = await getCourseByName(db, course.courseName);
      expect(dbCourse).toBeDefined();
      expect(dbCourse.courseName).toBe(course.courseName);
      expect(dbCourse.termId).toBe(1);
    });

    it('should reject missing courseName', async () => {
      await seedDatabase(db);
      const response = await request(app)
        .post('/course')
        .send({ termId: 1 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Course name is required');
    });

    it('should reject missing termId', async () => {
      const response = await request(app)
        .post('/course')
        .send({ courseName: 'Test Course' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Term ID is required');
    });

    it('should reject non-string courseName', async () => {
      await seedDatabase(db);
      const response = await request(app)
        .post('/course')
        .send({ courseName: 123, termId: 1 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject invalid termId', async () => {
      const response = await request(app)
        .post('/course')
        .send({ courseName: 'Test Course', termId: 'not-a-number' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Term ID must be a valid number');
    });

    it('should reject non-existent termId', async () => {
      const response = await request(app)
        .post('/course')
        .send({ courseName: 'Test Course', termId: 999 })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Term not found');
    });
  });

  describe('GET /course (get all courses)', () => {
    it('should return empty array when no courses exist', async () => {
      const response = await request(app)
        .get('/course')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should return all courses', async () => {
      await seedDatabase(db);

      const response = await request(app)
        .get('/course')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return courses with correct structure', async () => {
      await seedDatabase(db);

      const response = await request(app)
        .get('/course')
        .expect(200);

      const course = response.body.data[0];
      expect(course).toHaveProperty('id');
      expect(course).toHaveProperty('courseName');
      expect(course).toHaveProperty('termId');
    });

    it('should return multiple courses', async () => {
      await seedDatabase(db);

      await request(app)
        .post('/course')
        .send({ courseName: 'Course 2', termId: 1 })
        .expect(201);

      const response = await request(app)
        .get('/course')
        .expect(200);

      expect(response.body.data.length).toBe(2);
    });
  });

  describe('POST /courseProject (add project to course)', () => {
    beforeEach(async () => {
      await seedDatabase(db);
    });

    it('should add project with valid data', async () => {
      const response = await request(app)
        .post('/courseProject')
        .send({ courseId: 1, projectName: 'New Project' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Project added successfully');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.projectName).toBe('New Project');
      expect(response.body.data.courseId).toBe(1);
    });

    it('should reject missing courseId', async () => {
      const response = await request(app)
        .post('/courseProject')
        .send({ projectName: 'New Project' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject missing projectName', async () => {
      const response = await request(app)
        .post('/courseProject')
        .send({ courseId: 1 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject invalid courseId format', async () => {
      const response = await request(app)
        .post('/courseProject')
        .send({ courseId: 'not-a-number', projectName: 'New Project' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject non-existent courseId', async () => {
      const response = await request(app)
        .post('/courseProject')
        .send({ courseId: 999, projectName: 'New Project' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /course/courseProjects', () => {
    beforeEach(async () => {
      await seedDatabase(db);
    });

    it('should return projects for valid courseId', async () => {
      const response = await request(app)
        .get('/course/courseProjects')
        .query({ courseId: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should reject missing courseId', async () => {
      const response = await request(app)
        .get('/course/courseProjects')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Course ID is required');
    });

    it('should reject invalid courseId format', async () => {
      const response = await request(app)
        .get('/course/courseProjects')
        .query({ courseId: 'not-a-number' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid course ID');
    });

    it('should return 404 for non-existent course', async () => {
      const response = await request(app)
        .get('/course/courseProjects')
        .query({ courseId: 999 })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should split enrolled and available projects when userEmail provided', async () => {
      const response = await request(app)
        .get('/course/courseProjects')
        .query({ courseId: 1, userEmail: 'test@test.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.enrolledProjects).toBeDefined();
      expect(response.body.availableProjects).toBeDefined();
      expect(Array.isArray(response.body.enrolledProjects)).toBe(true);
      expect(Array.isArray(response.body.availableProjects)).toBe(true);
    });

    it('should return all projects when no userEmail provided', async () => {
      const response = await request(app)
        .get('/course/courseProjects')
        .query({ courseId: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.enrolledProjects).toBeUndefined();
      expect(response.body.availableProjects).toBeUndefined();
    });
  });

  describe('PUT /courseProject/:id', () => {
    beforeEach(async () => {
      await seedDatabase(db);
    });

    it('should update project with valid data', async () => {
      const response = await request(app)
        .put('/courseProject/1')
        .send({ projectName: 'Updated Project', courseId: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Project updated successfully');
      expect(response.body.data.projectName).toBe('Updated Project');
    });

    it('should reject invalid project ID', async () => {
      const response = await request(app)
        .put('/courseProject/not-a-number')
        .send({ projectName: 'Updated Project' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Project ID must be a valid number');
    });

    it('should reject missing projectName', async () => {
      const response = await request(app)
        .put('/courseProject/1')
        .send({ courseId: 1 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Project name is required and must be a string');
    });

    it('should reject non-string projectName', async () => {
      const response = await request(app)
        .put('/courseProject/1')
        .send({ projectName: 123, courseId: 1 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .put('/courseProject/999')
        .send({ projectName: 'Updated Project', courseId: 1 })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Project not found');
    });

    it('should allow updating courseId', async () => {
      // Create another course
      await request(app)
        .post('/course')
        .send({ courseName: 'Course 2', termId: 1 })
        .expect(201);

      const response = await request(app)
        .put('/courseProject/1')
        .send({ projectName: 'Updated Project', courseId: 2 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.courseId).toBe(2);
    });
  });

  describe('DELETE /courseProject/:id', () => {
    beforeEach(async () => {
      await seedDatabase(db);
    });

    it('should delete project with valid ID', async () => {
      const response = await request(app)
        .delete('/courseProject/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Project deleted successfully');

      const project = await db.get('SELECT * FROM projects WHERE id = ?', [1]);
      expect(project).toBeUndefined();
    });

    it('should reject invalid project ID', async () => {
      const response = await request(app)
        .delete('/courseProject/not-a-number')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Project ID must be a valid number');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .delete('/courseProject/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Project not found');
    });
  });

  describe('POST /course/:id/schedule', () => {
    beforeEach(async () => {
      await seedDatabase(db);
    });

    it('should create schedule with valid data', async () => {
      const response = await request(app)
        .post('/course/1/schedule')
        .send({
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          submissionDates: ['2024-03-15', '2024-06-15', '2024-09-15']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Schedule saved successfully');
      expect(response.body.data).toBeDefined();
    });

    it('should reject invalid course ID', async () => {
      const response = await request(app)
        .post('/course/not-a-number/schedule')
        .send({ startDate: '2024-01-01', endDate: '2024-12-31' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Course ID must be a valid number');
    });

    it('should reject missing startDate', async () => {
      const response = await request(app)
        .post('/course/1/schedule')
        .send({ endDate: '2024-12-31' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Start date and end date are required');
    });

    it('should reject missing endDate', async () => {
      const response = await request(app)
        .post('/course/1/schedule')
        .send({ startDate: '2024-01-01' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Start date and end date are required');
    });

    it('should work without submission dates', async () => {
      const response = await request(app)
        .post('/course/1/schedule')
        .send({ startDate: '2024-01-01', endDate: '2024-12-31' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.submissionDates).toEqual([]);
    });
  });

  describe('GET /course/:id/schedule', () => {
    beforeEach(async () => {
      await seedDatabase(db);
    });

    it('should return schedule for valid course', async () => {
      // First create a schedule
      await request(app)
        .post('/course/1/schedule')
        .send({
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          submissionDates: ['2024-06-15']
        })
        .expect(200);

      const response = await request(app)
        .get('/course/1/schedule')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.startDate).toBeDefined();
      expect(response.body.data.endDate).toBeDefined();
    });

    it('should reject invalid course ID', async () => {
      const response = await request(app)
        .get('/course/not-a-number/schedule')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Course ID must be a valid number');
    });

    it('should return 404 for non-existent schedule', async () => {
      // Create a new course without a schedule
      await request(app)
        .post('/course')
        .send({ courseName: 'Course Without Schedule', termId: 1 })
        .expect(201);

      const courseResult = await db.get('SELECT id FROM courses WHERE courseName = ?', ['Course Without Schedule']);

      const response = await request(app)
        .get(`/course/${courseResult.id}/schedule`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Schedule not found for this course');
    });
  });

  describe('DELETE /course/:id', () => {
    beforeEach(async () => {
      await seedDatabase(db);
    });

    it('should delete course without projects as admin', async () => {

      // Create a course without projects
      await request(app)
        .post('/course')
        .send({ courseName: 'Course To Delete', termId: 1 })
        .expect(201);

      const courseResult = await db.get('SELECT id FROM courses WHERE courseName = ?', ['Course To Delete']);

      const response = await request(app)
        .delete(`/course/${courseResult.id}`)
        .set('Authorization', createAuthHeader(adminToken))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Course deleted successfully');

      // Verify course is actually deleted
      const deletedCourse = await db.get('SELECT * FROM courses WHERE id = ?', [courseResult.id]);
      expect(deletedCourse).toBeUndefined();
    });

    it('should delete course and its schedule as admin', async () => {

      // Create a course with schedule but no projects
      await request(app)
        .post('/course')
        .send({ courseName: 'Course With Schedule', termId: 1 })
        .expect(201);

      const courseResult = await db.get('SELECT id FROM courses WHERE courseName = ?', ['Course With Schedule']);

      // Create schedule for this course
      await request(app)
        .post(`/course/${courseResult.id}/schedule`)
        .send({
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          submissionDates: ['2024-06-15']
        })
        .expect(200);

      // Delete the course
      const response = await request(app)
        .delete(`/course/${courseResult.id}`)
        .set('Authorization', createAuthHeader(adminToken))
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify schedule is also deleted
      const schedule = await db.get('SELECT * FROM schedules WHERE id = ?', [courseResult.id]);
      expect(schedule).toBeUndefined();

      // Verify submissions are also deleted (cascade)
      const submissions = await db.all('SELECT * FROM submissions WHERE scheduleId = ?', [courseResult.id]);
      expect(submissions).toHaveLength(0);
    });

    it('should reject deletion of course with projects as admin', async () => {

      // Course ID 1 from seedDatabase has a project
      const response = await request(app)
        .delete('/course/1')
        .set('Authorization', createAuthHeader(adminToken))
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Cannot delete course with existing projects');

      // Verify course still exists
      const course = await db.get('SELECT * FROM courses WHERE id = ?', [1]);
      expect(course).toBeDefined();
    });

    it('should reject invalid course ID as admin', async () => {

      const response = await request(app)
        .delete('/course/not-a-number')
        .set('Authorization', createAuthHeader(adminToken))
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Course ID must be a valid number');
    });

    it('should return 404 for non-existent course as admin', async () => {

      const response = await request(app)
        .delete('/course/999')
        .set('Authorization', createAuthHeader(adminToken))
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Course not found');
    });

    it('should reject deletion by non-admin user', async () => {

      // Create a course without projects
      await request(app)
        .post('/course')
        .send({ courseName: 'Course For Non-Admin Test', termId: 1 })
        .expect(201);

      const courseResult = await db.get('SELECT id FROM courses WHERE courseName = ?', ['Course For Non-Admin Test']);

      const response = await request(app)
        .delete(`/course/${courseResult.id}`)
        .set('Authorization', createAuthHeader(userToken))
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Forbidden: Admin access required');

      // Verify course still exists
      const course = await db.get('SELECT * FROM courses WHERE id = ?', [courseResult.id]);
      expect(course).toBeDefined();
    });

    it('should reject deletion without authentication', async () => {
      // Create a course without projects
      await request(app)
        .post('/course')
        .send({ courseName: 'Course For No Auth Test', termId: 1 })
        .expect(201);

      const courseResult = await db.get('SELECT id FROM courses WHERE courseName = ?', ['Course For No Auth Test']);

      const response = await request(app)
        .delete(`/course/${courseResult.id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication required');

      // Verify course still exists
      const course = await db.get('SELECT * FROM courses WHERE id = ?', [courseResult.id]);
      expect(course).toBeDefined();
    });

    it('should reject deletion with invalid token', async () => {
      // Create a course without projects
      await request(app)
        .post('/course')
        .send({ courseName: 'Course For Invalid Token Test', termId: 1 })
        .expect(201);

      const courseResult = await db.get('SELECT id FROM courses WHERE courseName = ?', ['Course For Invalid Token Test']);

      const response = await request(app)
        .delete(`/course/${courseResult.id}`)
        .set('Authorization', 'Bearer invalid-token-123')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid token');

      // Verify course still exists
      const course = await db.get('SELECT * FROM courses WHERE id = ?', [courseResult.id]);
      expect(course).toBeDefined();
    });
  });
});
