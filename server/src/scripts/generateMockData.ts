import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { hashPassword } from '../Utils/hash';
import { roleRegistry } from '../Utils/RoleRegistry';
import { UserRole } from '../ValueTypes/UserRole';

/**
 * Generates mock data for development.
 *
 * Creates a semester with students, courses, projects,
 * and happiness ratings for past sprints.
 */
async function generateMockData(dbPath: string = './server/myDatabase.db', deleteOnly: boolean = false) {
  console.log(`Connecting to database at: ${dbPath}`);

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await roleRegistry.init(db);

  const role_user: UserRole = new UserRole("USER");


  try {
    console.log('Starting mock data generation...\n');

    console.log('Cleaning up any existing mock data...');
    await db.run(`DELETE FROM happiness WHERE projectId IN (
      SELECT id FROM projects WHERE projectName IN ('AMOS Project 1', 'ADAP Project 1')
    )`);
    await db.run(`DELETE FROM user_projects WHERE projectId IN (
      SELECT id FROM projects WHERE projectName IN ('AMOS Project 1', 'ADAP Project 1')
    )`);
    await db.run(`DELETE FROM submissions WHERE scheduleId IN (
      SELECT id FROM courses WHERE courseName IN ('AMOS Course Mock', 'ADAP Course Mock')
    )`);
    await db.run(`DELETE FROM schedules WHERE id IN (
      SELECT id FROM courses WHERE courseName IN ('AMOS Course Mock', 'ADAP Course Mock')
    )`);
    await db.run(`DELETE FROM projects WHERE projectName IN ('AMOS Project 1', 'ADAP Project 1')`);
    await db.run(`DELETE FROM users WHERE email IN (
      'amos-student-1@fau.de', 'amos-student-2@fau.de', 'adap-student-1@fau.de'
    )`);
    await db.run(`DELETE FROM courses WHERE courseName IN ('AMOS Course Mock', 'ADAP Course Mock')`);
    await db.run(`DELETE FROM terms WHERE termName = 'WS26'`);
    console.log('  ✓ Cleanup complete\n');

    if (deleteOnly) {
      console.log('Delete-only mode: Skipping data generation.');
      return;
    }

    const now = Date.now();
    const threeWeeksAgo = now - (3 * 7 * 24 * 60 * 60 * 1000);
    const fifteenWeeksFromStart = threeWeeksAgo + (15 * 7 * 24 * 60 * 60 * 1000);

    const startDate = Math.floor(threeWeeksAgo / 1000);
    const endDate = Math.floor(fifteenWeeksFromStart / 1000);
    const currentTime = Math.floor(now / 1000);

    console.log('Creating term: WS26');
    const termResult = await db.run(
      `INSERT INTO terms (termName, displayName) VALUES (?, ?)`,
      ['WS26', 'Winter Semester 2026']
    );
    const termId = termResult.lastID;
    console.log(`  ✓ Term created with ID: ${termId}\n`);

    console.log('Creating courses...');
    const amosResult = await db.run(
      `INSERT INTO courses (courseName, termId) VALUES (?, ?)`,
      ['AMOS Course Mock', termId]
    );
    const amosCourseId = amosResult.lastID;
    console.log(`  ✓ AMOS Course Mock created with ID: ${amosCourseId}`);

    const adapResult = await db.run(
      `INSERT INTO courses (courseName, termId) VALUES (?, ?)`,
      ['ADAP Course Mock', termId]
    );
    const adapCourseId = adapResult.lastID;
    console.log(`  ✓ ADAP Course Mock created with ID: ${adapCourseId}\n`);

    console.log('Creating projects...');
    const amosProjectResult = await db.run(
      `INSERT INTO projects (projectName, courseId) VALUES (?, ?)`,
      ['AMOS Project 1', amosCourseId]
    );
    const amosProjectId = amosProjectResult.lastID;
    console.log(`  ✓ AMOS Project 1 created with ID: ${amosProjectId}`);

    const adapProjectResult = await db.run(
      `INSERT INTO projects (projectName, courseId) VALUES (?, ?)`,
      ['ADAP Project 1', adapCourseId]
    );
    const adapProjectId = adapProjectResult.lastID;
    console.log(`  ✓ ADAP Project 1 created with ID: ${adapProjectId}\n`);

    console.log('Creating users...');
    const amosStudent1Password = await hashPassword('amos-student-1-password');
    const amosStudent1Result = await db.run(
      `INSERT INTO users (name, email, password, status, roleId) VALUES (?, ?, ?, ?, ?)`,
      ['AMOS Student 1', 'amos-student-1@fau.de', amosStudent1Password, 'confirmed', role_user.getRoleId()]
    );
    const amosStudent1Id = amosStudent1Result.lastID;
    console.log(`  ✓ AMOS Student 1 (amos-student-1@fau.de) created with ID: ${amosStudent1Id}`);

    const amosStudent2Password = await hashPassword('amos-student-2-password');
    const amosStudent2Result = await db.run(
      `INSERT INTO users (name, email, password, status, roleId) VALUES (?, ?, ?, ?, ?)`,
      ['AMOS Student 2', 'amos-student-2@fau.de', amosStudent2Password, 'confirmed', role_user.getRoleId()]
    );
    const amosStudent2Id = amosStudent2Result.lastID;
    console.log(`  ✓ AMOS Student 2 (amos-student-2@fau.de) created with ID: ${amosStudent2Id}`);

    const adapStudent1Password = await hashPassword('adap-student-1-password');
    const adapStudent1Result = await db.run(
      `INSERT INTO users (name, email, password, status, roleId) VALUES (?, ?, ?, ?, ?)`,
      ['ADAP Student 1', 'adap-student-1@fau.de', adapStudent1Password, 'confirmed', role_user.getRoleId()]
    );
    const adapStudent1Id = adapStudent1Result.lastID;
    console.log(`  ✓ ADAP Student 1 (adap-student-1@fau.de) created with ID: ${adapStudent1Id}\n`);

    console.log('Creating project memberships...');
    await db.run(
      `INSERT INTO user_projects (userId, projectId, role) VALUES (?, ?, ?)`,
      [amosStudent1Id, amosProjectId, 'Owner']
    );
    console.log(`  ✓ AMOS Student 1 → AMOS Project 1 (Owner)`);

    await db.run(
      `INSERT INTO user_projects (userId, projectId, role) VALUES (?, ?, ?)`,
      [amosStudent2Id, amosProjectId, 'Developer']
    );
    console.log(`  ✓ AMOS Student 2 → AMOS Project 1 (Developer)`);

    await db.run(
      `INSERT INTO user_projects (userId, projectId, role) VALUES (?, ?, ?)`,
      [adapStudent1Id, adapProjectId, 'Owner']
    );
    console.log(`  ✓ ADAP Student 1 → ADAP Project 1 (Owner)\n`);

    console.log('Creating course schedules (15 weeks, started 3 weeks ago)...');
    await db.run(
      `INSERT INTO schedules (id, startDate, endDate) VALUES (?, ?, ?)`,
      [amosCourseId, startDate, endDate]
    );
    console.log(`  ✓ AMOS schedule created (ID: ${amosCourseId})`);

    await db.run(
      `INSERT INTO schedules (id, startDate, endDate) VALUES (?, ?, ?)`,
      [adapCourseId, startDate, endDate]
    );
    console.log(`  ✓ ADAP schedule created (ID: ${adapCourseId})\n`);

    console.log('Creating submission dates (15 weeks, every 7 days)...');
    const amosSubmissionIds: number[] = [];
    const adapSubmissionIds: number[] = [];

    for (let week = 1; week <= 15; week++) {
      const submissionTime = threeWeeksAgo + (week * 7 * 24 * 60 * 60 * 1000);
      const submissionDate = Math.floor(submissionTime / 1000);

      const amosSubResult = await db.run(
        `INSERT INTO submissions (scheduleId, submissionDate) VALUES (?, ?)`,
        [amosCourseId, submissionDate]
      );
      amosSubmissionIds.push(amosSubResult.lastID!);

      const adapSubResult = await db.run(
        `INSERT INTO submissions (scheduleId, submissionDate) VALUES (?, ?)`,
        [adapCourseId, submissionDate]
      );
      adapSubmissionIds.push(adapSubResult.lastID!);
    }
    console.log(`  ✓ Created 15 submission dates for AMOS course`);
    console.log(`  ✓ Created 15 submission dates for ADAP course\n`);

    console.log('Creating happiness ratings for past/current sprints...');

    let amosStudent1Ratings = 0;
    let amosStudent2Ratings = 0;
    let adapStudent1Ratings = 0;

    for (let i = 0; i < 15; i++) {
      const submissionTime = threeWeeksAgo + ((i + 1) * 7 * 24 * 60 * 60 * 1000);
      const submissionTimestamp = Math.floor(submissionTime / 1000);

      if (submissionTimestamp <= currentTime) {
        const happiness1 = Math.floor(Math.random() * 7) - 3;
        await db.run(
          `INSERT INTO happiness (projectId, userId, happiness, submissionDateId, timestamp) VALUES (?, ?, ?, ?, ?)`,
          [amosProjectId, amosStudent1Id, happiness1, amosSubmissionIds[i], submissionTimestamp]
        );
        amosStudent1Ratings++;

        const happiness2 = Math.floor(Math.random() * 7) - 3;
        await db.run(
          `INSERT INTO happiness (projectId, userId, happiness, submissionDateId, timestamp) VALUES (?, ?, ?, ?, ?)`,
          [amosProjectId, amosStudent2Id, happiness2, amosSubmissionIds[i], submissionTimestamp]
        );
        amosStudent2Ratings++;

        const happiness3 = Math.floor(Math.random() * 7) - 3;
        await db.run(
          `INSERT INTO happiness (projectId, userId, happiness, submissionDateId, timestamp) VALUES (?, ?, ?, ?, ?)`,
          [adapProjectId, adapStudent1Id, happiness3, adapSubmissionIds[i], submissionTimestamp]
        );
        adapStudent1Ratings++;
      }
    }

    console.log(`  ✓ Created ${amosStudent1Ratings} happiness ratings for AMOS Student 1`);
    console.log(`  ✓ Created ${amosStudent2Ratings} happiness ratings for AMOS Student 2`);
    console.log(`  ✓ Created ${adapStudent1Ratings} happiness ratings for ADAP Student 1\n`);

    console.log('='.repeat(60));
    console.log('Mock data generation completed successfully!');
    console.log('='.repeat(60));
    console.log('\nSummary:');
    console.log(`  Terms: 1`);
    console.log(`  Courses: 2 (AMOS Course Mock, ADAP Course Mock)`);
    console.log(`  Projects: 2 (AMOS Project 1, ADAP Project 1)`);
    console.log(`  Students: 3`);
    console.log(`  Project memberships: 3`);
    console.log(`  Schedules: 2 (15 weeks each, started 3 weeks ago)`);
    console.log(`  Submission dates: 30 (15 per course)`);
    console.log(`  Happiness ratings: ${amosStudent1Ratings + amosStudent2Ratings + adapStudent1Ratings}`);
    console.log('\nStudent Accounts:');
    console.log('  Email: amos-student-1@fau.de | Password: amos-student-1-password | Project: AMOS (Owner)');
    console.log('  Email: amos-student-2@fau.de | Password: amos-student-2-password | Project: AMOS (Developer)');
    console.log('  Email: adap-student-1@fau.de | Password: adap-student-1-password | Project: ADAP (Owner)');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error generating mock data:');
    console.error(error);
    throw error;
  } finally {
    await db.close();
    console.log('\nDatabase connection closed.');
  }
}

const args = process.argv.slice(2);
const deleteOnly = args.includes('--delete-only');
const dbPath = args.find(arg => !arg.startsWith('--')) || './server/myDatabase.db';

generateMockData(dbPath, deleteOnly)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
