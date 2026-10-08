import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import express from 'express';
import { AuthRoutes } from '../auth.route';
import globalErrorHandler from '../../../../app/middlewares/globalErrorHandler';
import { User } from '../../user/user.model';
import config from '../../../../config';

const app = express();
app.use(express.json());
app.use('/api/v1/auth', AuthRoutes);
app.use(globalErrorHandler);

describe('Auth Database Redesign E2E', () => {
  let request: supertest.SuperTest<supertest.Test>;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.database_url as string);
    }
    request = supertest(app);

    await User.deleteMany({
      email: { $in: ['promoter@redesign.com', 'bizowner@redesign.com', 'legacy@redesign.com'] },
    });
  });

  afterAll(async () => {
    await User.deleteMany({
      email: { $in: ['promoter@redesign.com', 'bizowner@redesign.com', 'legacy@redesign.com'] },
    });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  it('AC-1, AC-3: Promoter registers successfully with email, password, phone', async () => {
    const res = await request.post('/api/v1/auth/register').send({
      name: 'Promoter Redesign',
      email: 'promoter@redesign.com',
      password: 'Password123!',
      phone: '0000000001',
      role: 'PROMOTER',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('userId');

    // Verify DB state
    const dbUser = await User.findOne({ email: 'promoter@redesign.com' });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.role).toBe('PROMOTER');
    expect(dbUser?.businessName).toBeUndefined(); // Or null, but not set
  });

  it('AC-2: Business Owner fails to register without businessName', async () => {
    const res = await request.post('/api/v1/auth/register').send({
      name: 'Biz Owner Fail',
      email: 'bizowner@redesign.com',
      password: 'Password123!',
      phone: '0000000002',
      role: 'BUSINESS_OWNER',
    });

    console.log(res.status, res.text);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/validation/i);
    // Should contain specific zod error for businessName
  });

  it('AC-1, AC-2: Business Owner registers successfully with businessName', async () => {
    const res = await request.post('/api/v1/auth/register').send({
      name: 'Biz Owner Pass',
      email: 'bizowner@redesign.com',
      password: 'Password123!',
      phone: '0000000002',
      role: 'BUSINESS_OWNER',
      businessName: 'My Awesome Biz',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('userId');

    // Verify DB state
    const dbUser = await User.findOne({ email: 'bizowner@redesign.com' });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.role).toBe('BUSINESS_OWNER');
    expect(dbUser?.businessName).toBe('My Awesome Biz');
  });

  it('AC-4: Registration with legacy fields ignores the legacy fields', async () => {
    const res = await request.post('/api/v1/auth/register').send({
      name: 'Legacy Field Test',
      email: 'legacy@redesign.com',
      password: 'Password123!',
      phone: '0000000003',
      role: 'PROMOTER',
      company: 'Old Company Inc.',
      vehicles: ['Car 1', 'Car 2'],
      serviceArea: 'Downtown',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const dbUser = await User.findOne({ email: 'legacy@redesign.com' }).lean();
    expect(dbUser).not.toBeNull();
    // Verify that the fields were stripped and not saved to DB
    expect(dbUser).not.toHaveProperty('company');
    expect(dbUser).not.toHaveProperty('vehicles');
    expect(dbUser).not.toHaveProperty('serviceArea');
  });
});
