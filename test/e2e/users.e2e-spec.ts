import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon from 'argon2';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Users } from '../../src/features/users/entities/user.entity';
import { UserRole } from '../../src/shared/constants';
import { mysqlDataSource } from '../integration/db/mysql/int-container';

describe('Users API (e2e)', () => {
  let app: INestApplication;
  let httpServer: any;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

    // DatabaseModule now reads MYSQL_* via ConfigService at compile time.
    // These values are not used in this test because we override the DataSource
    // with a Testcontainers-backed instance, but they must exist to satisfy
    // config validation.
    process.env.MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
    process.env.MYSQL_PORT = process.env.MYSQL_PORT || '3306';
    process.env.MYSQL_USER = process.env.MYSQL_USER || 'test';
    process.env.MYSQL_PASS = process.env.MYSQL_PASS || 'test';
    process.env.MYSQL_DB = process.env.MYSQL_DB || 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DataSource)
      .useValue(mysqlDataSource)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    httpServer = app.getHttpServer();
  });

  afterAll(async () => {
    await app?.close();
  });

  const jsonApi = (attributes: Record<string, unknown>, type = 'users') => ({
    data: {
      type,
      attributes,
    },
  });

  it('rejects registering ADMIN role via public register', async () => {
    await request(httpServer)
      .post('/api/v1/auth/register')
      .set('Content-Type', 'application/vnd.api+json')
      .send(
        jsonApi({
          name: 'E2E Admin Attempt',
          email: 'admin-attempt@example.com',
          password: 'password1',
          role: 'ADMIN',
        }),
      )
      .expect(400)
      .expect('Content-Type', /application\/vnd\.api\+json/)
      .expect((res) => {
        expect(res.body).toHaveProperty('errors');
        expect(Array.isArray(res.body.errors)).toBe(true);
      });
  });

  it('USER can view and update own details; cannot list users', async () => {
    const registerRes = await request(httpServer)
      .post('/api/v1/auth/register')
      .set('Content-Type', 'application/vnd.api+json')
      .send(
        jsonApi({
          name: 'E2E User',
          email: 'e2e-user@example.com',
          password: 'password1',
        }),
      )
      .expect(201);

    const token = registerRes.body?.data?.attributes?.access_token;
    expect(typeof token).toBe('string');

    await request(httpServer)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect('Content-Type', /application\/vnd\.api\+json/)
      .expect((res) => {
        expect(res.body.data.type).toBe('users');
        expect(res.body.data.attributes.email).toBe('e2e-user@example.com');
      });

    // USER cannot list users
    await request(httpServer)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect('Content-Type', /application\/vnd\.api\+json/);

    // USER can update own details
    const myId = registerRes.body.data.id;
    await request(httpServer)
      .patch(`/api/v1/users/${myId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/vnd.api+json')
      .send(jsonApi({ name: 'E2E User Updated' }))
      .expect(200)
      .expect('Content-Type', /application\/vnd\.api\+json/)
      .expect((res) => {
        expect(res.body.data.id).toBe(myId);
        expect(res.body.data.attributes.name).toBe('E2E User Updated');
      });

    // USER cannot update own role
    await request(httpServer)
      .patch(`/api/v1/users/${myId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/vnd.api+json')
      .send(jsonApi({ role: 'ADMIN' }))
      .expect(403)
      .expect('Content-Type', /application\/vnd\.api\+json/)
      .expect((res) => {
        expect(res.body).toHaveProperty('errors');
      });
  });

  it('ADMIN can list/update/delete users but cannot delete self; non-existent targets return 404', async () => {
    // Seed an admin directly in DB (public register cannot create ADMIN)
    const adminEmail = 'seeded-admin@example.com';
    const adminPassword = 'password1';
    const usersRepo = mysqlDataSource.getRepository(Users);
    const admin = await usersRepo.save({
      name: 'Seeded Admin',
      email: adminEmail,
      password: await argon.hash(adminPassword),
      role: UserRole.Admin,
    });

    const loginRes = await request(httpServer)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/vnd.api+json')
      .send(jsonApi({ email: adminEmail, password: adminPassword }, 'auth'))
      .expect(201);

    const adminToken = loginRes.body?.data?.attributes?.access_token;
    expect(typeof adminToken).toBe('string');

    // Create a normal user to act on
    const testUserRes = await request(httpServer)
      .post('/api/v1/auth/register')
      .set('Content-Type', 'application/vnd.api+json')
      .send(
        jsonApi({
          name: 'Test User',
          email: 'testuser@example.com',
          password: 'password1',
        }),
      )
      .expect(201);
    const testUserId = testUserRes.body.data.id;

    // ADMIN can list users
    await request(httpServer)
      .get('/api/v1/users?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body.data)).toBe(true);
      });

    // ADMIN can update other user's role
    await request(httpServer)
      .patch(`/api/v1/users/${testUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/vnd.api+json')
      .send(jsonApi({ role: 'ADMIN', name: 'Test User Promoted' }))
      .expect(200)
      .expect((res) => {
        expect(res.body.data.attributes.role).toBe('ADMIN');
        expect(res.body.data.attributes.name).toBe('Test User Promoted');
      });

    // ADMIN cannot delete self
    await request(httpServer)
      .delete(`/api/v1/users/${admin.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403)
      .expect('Content-Type', /application\/vnd\.api\+json/);

    // ADMIN deleting a non-existent user => 404
    await request(httpServer)
      .delete('/api/v1/users/non-existent-id')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404)
      .expect('Content-Type', /application\/vnd\.api\+json/);

    // ADMIN can delete another user
    await request(httpServer)
      .delete(`/api/v1/users/${testUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });
});
