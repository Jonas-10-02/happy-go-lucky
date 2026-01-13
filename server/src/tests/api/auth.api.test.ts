import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { Database } from 'sqlite';
import { createTestDb, seedDatabase, getUserByEmail } from './helpers/testDb';
import { validUser, invalidEmails } from './helpers/fixtures';
import { Application } from 'express';
import { createApp } from '../../createApp';
import { generateAdminToken, generateUserToken } from './helpers/authHelpers';

describe('Authentication API', () => {
  let db: Database;
  let app: Application;

  beforeEach(async () => {
    db = await createTestDb();
    app = createApp(db);
  });

  describe('POST /user (register)', () => {
    it('should register a user with valid credentials', async () => {
      const user = validUser();
      const response = await request(app)
        .post('/user')
        .send(user)
        .expect(201);

      expect(response.body.message).toBe('User registered successfully');

      const dbUser = await getUserByEmail(db, user.email);
      expect(dbUser).toBeDefined();
      expect(dbUser.name).toBe(user.name);
      expect(dbUser.status).toBe('unconfirmed');
    });

    it('should reject registration with missing name', async () => {
      const response = await request(app)
        .post('/user')
        .send({ email: 'test@test.com', password: 'Test123!' })
        .expect(400);

      expect(response.body.message).toBe('Please fill in username, email and password!');
    });

    it('should reject registration with missing email', async () => {
      const response = await request(app)
        .post('/user')
        .send({ name: 'Test User', password: 'Test123!' })
        .expect(400);

      expect(response.body.message).toBe('Please fill in username, email and password!');
    });

    it('should reject registration with missing password', async () => {
      const response = await request(app)
        .post('/user')
        .send({ name: 'Test User', email: 'test@test.com' })
        .expect(400);

      // Empty password triggers password strength check instead of missing field check
      expect(response.body.message).toContain('Password must be at least 8 characters');
    });

    it('should reject weak password (too short)', async () => {
      const response = await request(app)
        .post('/user')
        .send({ name: 'Test User', email: 'test@test.com', password: 'short' })
        .expect(400);

      expect(response.body.message).toContain('Password must be at least 8 characters');
    });

    it('should reject weak password (no uppercase/numbers)', async () => {
      const response = await request(app)
        .post('/user')
        .send({ name: 'Test User', email: 'test@test.com', password: 'alllowercase' })
        .expect(400);

      expect(response.body.message).toContain('Password must be at least 8 characters');
    });

    invalidEmails.forEach((email) => {
      it(`should reject invalid email: "${email}"`, async () => {
        const response = await request(app)
          .post('/user')
          .send({ name: 'Test User', email, password: 'Test123!' })
          .expect(400);

        expect(response.body.message).toMatch(/email|Invalid/i);
      });
    });

    it('should reject name shorter than 3 characters', async () => {
      const response = await request(app)
        .post('/user')
        .send({ name: 'ab', email: 'test@test.com', password: 'Test123!' })
        .expect(400);

      expect(response.body.message).toBe('Name must be at least 3 characters long');
    });

    it('should set user status to unconfirmed', async () => {
      const user = validUser();
      await request(app)
        .post('/user')
        .send(user)
        .expect(201);

      const dbUser = await getUserByEmail(db, user.email);
      expect(dbUser.status).toBe('unconfirmed');
    });

    it('should hash the password', async () => {
      const user = validUser();
      await request(app)
        .post('/user')
        .send(user)
        .expect(201);

      const dbUser = await getUserByEmail(db, user.email);
      expect(dbUser.password).not.toBe(user.password);
      expect(dbUser.password).toBeTruthy();
    });
  });

  describe('POST /session (login)', () => {
    beforeEach(async () => {
      await seedDatabase(db);
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/session')
        .send({ email: 'test@test.com', password: 'Test123!' })
        .expect(200);

      expect(response.body.token).toBeDefined();
      expect(response.body.email).toBe('test@test.com');
      expect(response.body.name).toBe('testuser');
    });

    it('should reject login with missing email', async () => {
      const response = await request(app)
        .post('/session')
        .send({ password: 'Test123!' })
        .expect(400);

      expect(response.body.message).toBe('Email and password are required');
    });

    it('should reject login with missing password', async () => {
      const response = await request(app)
        .post('/session')
        .send({ email: 'test@test.com' })
        .expect(400);

      // User exists, so gets past email check but fails password validation
      expect(response.body.message).toBe('Invalid password');
    });

    it('should reject login with invalid email format', async () => {
      const response = await request(app)
        .post('/session')
        .send({ email: 'notanemail', password: 'Test123!' })
        .expect(400);

      expect(response.body.message).toBe('Invalid email address');
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/session')
        .send({ email: 'test@test.com', password: 'WrongPassword!' })
        .expect(400);

      expect(response.body.message).toBe('Invalid password');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/session')
        .send({ email: 'nonexistent@test.com', password: 'Test123!' })
        .expect(400);

      expect(response.body.message).toBe('Invalid email');
    });

    it('should reject login for unconfirmed user', async () => {
      const response = await request(app)
        .post('/session')
        .send({ email: 'unconfirmed@test.com', password: 'Test123!' })
        .expect(400);

      expect(response.body.message).toBe('Email not confirmed. Please contact system admin.');
    });

    it('should reject login for suspended user', async () => {
      const response = await request(app)
        .post('/session')
        .send({ email: 'suspended@test.com', password: 'Test123!' })
        .expect(400);

      expect(response.body.message).toBe('User account is suspended. Please contact system admin.');
    });

    it('should reject login for removed user', async () => {
      const response = await request(app)
        .post('/session')
        .send({ email: 'removed@test.com', password: 'Test123!' })
        .expect(400);

      expect(response.body.message).toBe('User account is removed. Please contact system admin.');
    });

    it('should return JWT token on successful login', async () => {
      const response = await request(app)
        .post('/session')
        .send({ email: 'test@test.com', password: 'Test123!' })
        .expect(200);

      expect(response.body.token).toBeDefined();
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(0);
    });

    it('should return user info on successful login', async () => {
      const response = await request(app)
        .post('/session')
        .send({ email: 'test@test.com', password: 'Test123!' })
        .expect(200);

      expect(response.body.name).toBe('testuser');
      expect(response.body.email).toBe('test@test.com');
      expect(response.body.githubUsername).toBeDefined();
    });
  });

  describe('POST /user/password/forgotMail', () => {
    beforeEach(async () => {
      await seedDatabase(db);
    });

    it('should send reset email for valid email', async () => {
      const response = await request(app)
        .post('/user/password/forgotMail')
        .send({ email: 'test@test.com' })
        .expect(200);

      expect(response.body.message).toBe('Password reset email sent');

      const user = await getUserByEmail(db, 'test@test.com');
      expect(user.resetPasswordToken).toBeDefined();
      expect(user.resetPasswordExpire).toBeDefined();
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/user/password/forgotMail')
        .send({})
        .expect(400);

      expect(response.body.message).toBe('User email is required');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/user/password/forgotMail')
        .send({ email: 'notanemail' })
        .expect(400);

      expect(response.body.message).toBe('Invalid email address');
    });

    it('should reject non-existent email', async () => {
      const response = await request(app)
        .post('/user/password/forgotMail')
        .send({ email: 'nonexistent@test.com' })
        .expect(404);

      expect(response.body.message).toBe('Email not found');
    });

    it('should set resetPasswordToken and expire', async () => {
      await request(app)
        .post('/user/password/forgotMail')
        .send({ email: 'test@test.com' })
        .expect(200);

      const user = await getUserByEmail(db, 'test@test.com');
      expect(user.resetPasswordToken).toBeTruthy();
      expect(user.resetPasswordExpire).toBeGreaterThan(Date.now());
    });
  });

  describe('POST /user/password/reset', () => {
    let resetToken: string;

    beforeEach(async () => {
      await seedDatabase(db);
      // Generate a reset token
      resetToken = 'test-reset-token';
      const expire = Date.now() + 3600000;
      await db.run(
        'UPDATE users SET resetPasswordToken = ?, resetPasswordExpire = ? WHERE email = ?',
        [resetToken, expire, 'test@test.com']
      );
    });

    it('should reset password with valid token', async () => {
      const response = await request(app)
        .post('/user/password/reset')
        .send({ token: resetToken, newPassword: 'NewPass123!' })
        .expect(200);

      expect(response.body.message).toBe('Password has been reset');

      const user = await getUserByEmail(db, 'test@test.com');
      expect(user.resetPasswordToken).toBeNull();
      expect(user.resetPasswordExpire).toBeNull();
    });

    it('should reject missing token', async () => {
      const response = await request(app)
        .post('/user/password/reset')
        .send({ newPassword: 'NewPass123!' })
        .expect(400);

      expect(response.body.message).toBe('Token and new password are required');
    });

    it('should reject missing password', async () => {
      const response = await request(app)
        .post('/user/password/reset')
        .send({ token: resetToken })
        .expect(400);

      expect(response.body.message).toBe('Token and new password are required');
    });

    it('should reject weak password', async () => {
      const response = await request(app)
        .post('/user/password/reset')
        .send({ token: resetToken, newPassword: 'weak' })
        .expect(400);

      expect(response.body.message).toContain('Password must be at least 8 characters');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/user/password/reset')
        .send({ token: 'invalid-token', newPassword: 'NewPass123!' })
        .expect(401);

      expect(response.body.message).toBe('Invalid or expired reset token');
    });

    it('should clear reset token after successful reset', async () => {
      await request(app)
        .post('/user/password/reset')
        .send({ token: resetToken, newPassword: 'NewPass123!' })
        .expect(200);

      const user = await getUserByEmail(db, 'test@test.com');
      expect(user.resetPasswordToken).toBeNull();
      expect(user.resetPasswordExpire).toBeNull();
    });
  });

  describe('POST /user/confirmation/email', () => {
    let confirmToken: string;

    beforeEach(async () => {
      await seedDatabase(db);
      confirmToken = 'test-confirm-token';
      const expire = Date.now() + 3600000;
      await db.run(
        'UPDATE users SET confirmEmailToken = ?, confirmEmailExpire = ? WHERE email = ?',
        [confirmToken, expire, 'unconfirmed@test.com']
      );
    });

    it('should confirm email with valid token', async () => {
      const response = await request(app)
        .post('/user/confirmation/email')
        .send({ token: confirmToken })
        .expect(200);

      expect(response.body.message).toBe('Email has been confirmed');

      const user = await getUserByEmail(db, 'unconfirmed@test.com');
      expect(user.status).toBe('confirmed');
      expect(user.confirmEmailToken).toBeNull();
      expect(user.confirmEmailExpire).toBeNull();
    });

    it('should reject missing token', async () => {
      const response = await request(app)
        .post('/user/confirmation/email')
        .send({})
        .expect(400);

      expect(response.body.message).toBe('Token is required');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/user/confirmation/email')
        .send({ token: 'invalid-token' })
        .expect(401);

      expect(response.body.message).toBe('Invalid or expired confirmation token');
    });

    it('should reject expired token', async () => {
      const expiredToken = 'expired-token';
      const pastExpire = Date.now() - 1000;
      await db.run(
        'UPDATE users SET confirmEmailToken = ?, confirmEmailExpire = ? WHERE email = ?',
        [expiredToken, pastExpire, 'unconfirmed@test.com']
      );

      const response = await request(app)
        .post('/user/confirmation/email')
        .send({ token: expiredToken })
        .expect(400);

      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('should update status to confirmed', async () => {
      await request(app)
        .post('/user/confirmation/email')
        .send({ token: confirmToken })
        .expect(200);

      const user = await getUserByEmail(db, 'unconfirmed@test.com');
      expect(user.status).toBe('confirmed');
    });

    it('should clear confirmation token after success', async () => {
      await request(app)
        .post('/user/confirmation/email')
        .send({ token: confirmToken })
        .expect(200);

      const user = await getUserByEmail(db, 'unconfirmed@test.com');
      expect(user.confirmEmailToken).toBeNull();
      expect(user.confirmEmailExpire).toBeNull();
    });
  });

  describe('POST /user/confirmation/trigger', () => {
    beforeEach(async () => {
      await seedDatabase(db);
    });

    it('should send confirmation email for unconfirmed user', async () => {
      const response = await request(app)
        .post('/user/confirmation/trigger')
        .send({ email: 'unconfirmed@test.com' })
        .expect(200);

      expect(response.body.message).toBe('Confirmation email sent');

      const user = await getUserByEmail(db, 'unconfirmed@test.com');
      expect(user.confirmEmailToken).toBeDefined();
      expect(user.confirmEmailExpire).toBeDefined();
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/user/confirmation/trigger')
        .send({})
        .expect(400);

      expect(response.body.message).toBe('User email is required');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/user/confirmation/trigger')
        .send({ email: 'notanemail' })
        .expect(400);

      expect(response.body.message).toBe('Invalid email address');
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/user/confirmation/trigger')
        .send({ email: 'nonexistent@test.com' })
        .expect(400);

      expect(response.body.message).toBe('User not found');
    });

    it('should reject already confirmed user', async () => {
      const response = await request(app)
        .post('/user/confirmation/trigger')
        .send({ email: 'test@test.com' })
        .expect(400);

      expect(response.body.message).toBe('User not found or not unconfirmed');
    });
  });
});
