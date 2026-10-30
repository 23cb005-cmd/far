import { ERROR_CODES, OTP_MAX_ATTEMPTS } from '@farmfair/shared';
import { AuditLog } from '../models/AuditLog';
import { OtpCode } from '../models/OtpCode';
import { User } from '../models/User';
import { BUYER, FARMER, client, seedUser } from './helpers';

describe('PATCH /auth/me', () => {
  it('updates editable fields', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);

    const res = await c
      .patch('/auth/me')
      .send({ name: 'Murugan Selvam', village: 'Mettur', district: 'Namakkal', language: 'ta' })
      .expect(200);

    expect(res.body.data.user).toMatchObject({
      name: 'Murugan Selvam',
      village: 'Mettur',
      district: 'Namakkal',
      language: 'ta',
    });
  });

  it('updates the crop list', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);

    const res = await c
      .patch('/auth/me')
      .send({ crops: ['banana', 'turmeric'] })
      .expect(200);
    expect(res.body.data.user.crops).toEqual(['banana', 'turmeric']);
  });

  it('toggles WhatsApp alerts', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);

    const res = await c.patch('/auth/me').send({ notifyWhatsApp: false }).expect(200);
    expect(res.body.data.user.notifyWhatsApp).toBe(false);
  });

  it.each([
    ['role', { role: 'admin' }],
    ['verificationStatus', { verificationStatus: 'approved' }],
    ['isSuspended', { isSuspended: false }],
    ['ratingAvg', { ratingAvg: 5 }],
    ['phone', { phone: '9999999999' }],
    ['phoneVerified', { phoneVerified: true }],
  ])('rejects an attempt to change %s', async (_field, patch) => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);

    const res = await c.patch('/auth/me').send(patch).expect(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('cannot escalate a farmer to admin even in combination with valid fields', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);

    await c.patch('/auth/me').send({ name: 'New Name', role: 'admin' }).expect(400);

    const user = await User.findOne({ phone: '+919876543210' }).exec();
    expect(user?.role).toBe('farmer');
    expect(user?.name).toBe('Murugan S');
  });

  it('rejects an empty update', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);
    await c.patch('/auth/me').send({}).expect(400);
  });

  it('rejects an invalid district', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);
    await c.patch('/auth/me').send({ district: 'Mumbai' }).expect(400);
  });

  it('lets a buyer update business details', async () => {
    const c = await client();
    await c.post('/auth/register').send(BUYER).expect(201);

    const res = await c
      .patch('/auth/me')
      .send({ business: { name: 'Priya Agri Exports' } })
      .expect(200);

    expect(res.body.data.user.business.name).toBe('Priya Agri Exports');
    // The existing GSTIN is preserved when only the name is sent.
    expect(res.body.data.user.business.gstNumber).toBe('33ASDFG1234H1ZX');
  });

  it('refuses business details on a farmer account', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);
    await c
      .patch('/auth/me')
      .send({ business: { name: 'Not A Buyer' } })
      .expect(400);
  });

  it('requires authentication', async () => {
    const c = await client();
    await c.patch('/auth/me').send({ name: 'Nobody' }).expect(401);
  });

  it('audits which fields changed, without their values', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);
    await c.patch('/auth/me').send({ village: 'Mettur' }).expect(200);

    const entry = await AuditLog.findOne({ action: 'auth.profile.update' }).exec();
    expect(entry?.metadata?.fields).toEqual(['village']);
  });
});

describe('POST /auth/change-password', () => {
  it('changes the password and keeps the caller signed in', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);

    await c
      .post('/auth/change-password')
      .send({ currentPassword: 'farmfair1', newPassword: 'newpass123' })
      .expect(200);

    // Fresh cookies were issued, so this still works.
    await c.get('/auth/me').expect(200);

    // And the new password is the one that now works.
    const fresh = await client();
    await fresh
      .post('/auth/login')
      .send({ phone: '9876543210', password: 'newpass123' })
      .expect(200);
    await fresh
      .post('/auth/login')
      .send({ phone: '9876543210', password: 'farmfair1' })
      .expect(401);
  });

  it('rejects a wrong current password', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);

    const res = await c
      .post('/auth/change-password')
      .send({ currentPassword: 'notmypassword1', newPassword: 'newpass123' })
      .expect(400);

    expect(res.body.error.code).toBe(ERROR_CODES.INVALID_CREDENTIALS);
  });

  it('enforces the password policy on the new password', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);

    await c
      .post('/auth/change-password')
      .send({ currentPassword: 'farmfair1', newPassword: 'short' })
      .expect(400);
  });

  it('rejects reusing the same password', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);

    await c
      .post('/auth/change-password')
      .send({ currentPassword: 'farmfair1', newPassword: 'farmfair1' })
      .expect(400);
  });

  it('revokes other sessions by incrementing tokenVersion', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);

    // A second device, signed in with the old password.
    const other = await client();
    await other
      .post('/auth/login')
      .send({ phone: '9876543210', password: 'farmfair1' })
      .expect(200);
    await other.get('/auth/me').expect(200);

    await c
      .post('/auth/change-password')
      .send({ currentPassword: 'farmfair1', newPassword: 'newpass123' })
      .expect(200);

    // The other device's token is now stale.
    await other.get('/auth/me').expect(401);

    const user = await User.findOne({ phone: '+919876543210' }).exec();
    expect(user?.tokenVersion).toBeGreaterThan(0);
  });

  it('requires authentication', async () => {
    const c = await client();
    await c
      .post('/auth/change-password')
      .send({ currentPassword: 'farmfair1', newPassword: 'newpass123' })
      .expect(401);
  });

  it('audits the change without recording either password', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);
    await c
      .post('/auth/change-password')
      .send({ currentPassword: 'farmfair1', newPassword: 'newpass123' })
      .expect(200);

    const entries = await AuditLog.find({}).lean().exec();
    expect(entries.some((e) => e.action === 'auth.password.change')).toBe(true);
    expect(JSON.stringify(entries)).not.toContain('newpass123');
    expect(JSON.stringify(entries)).not.toContain('farmfair1');
  });
});

describe('OTP phone verification', () => {
  it('sends a code and verifies it', async () => {
    const c = await client();
    const registered = await c.post('/auth/register').send(FARMER).expect(201);
    expect(registered.body.data.user.phoneVerified).toBe(false);

    const sent = await c.post('/auth/otp/send').send({}).expect(200);
    expect(sent.body.data.sent).toBe(true);
    // The console provider hands the code back so development has no SMS cost.
    expect(sent.body.data.devCode).toMatch(/^\d{6}$/);

    const verified = await c
      .post('/auth/otp/verify')
      .send({ code: sent.body.data.devCode })
      .expect(200);

    expect(verified.body.data.user.phoneVerified).toBe(true);
  });

  it('stores only a hash of the code', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);
    const sent = await c.post('/auth/otp/send').send({}).expect(200);

    const record = await OtpCode.findOne({}).lean().exec();
    expect(record?.codeHash).toHaveLength(64);
    expect(record?.codeHash).not.toContain(sent.body.data.devCode);
  });

  it('rejects a wrong code and counts the attempt', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);
    const sent = await c.post('/auth/otp/send').send({}).expect(200);
    const wrong = sent.body.data.devCode === '000000' ? '111111' : '000000';

    const res = await c.post('/auth/otp/verify').send({ code: wrong }).expect(400);
    expect(res.body.error.code).toBe(ERROR_CODES.OTP_INVALID);

    const record = await OtpCode.findOne({}).exec();
    expect(record?.attempts).toBe(1);
  });

  it(`burns the code after ${OTP_MAX_ATTEMPTS} wrong attempts`, async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);
    const sent = await c.post('/auth/otp/send').send({}).expect(200);
    const correct = sent.body.data.devCode as string;
    const wrong = correct === '000000' ? '111111' : '000000';

    for (let i = 0; i < OTP_MAX_ATTEMPTS - 1; i += 1) {
      await c.post('/auth/otp/verify').send({ code: wrong }).expect(400);
    }

    const last = await c.post('/auth/otp/verify').send({ code: wrong }).expect(400);
    expect(last.body.error.code).toBe(ERROR_CODES.OTP_ATTEMPTS_EXCEEDED);

    // Even the correct code no longer works: the record was consumed.
    const after = await c.post('/auth/otp/verify').send({ code: correct }).expect(400);
    expect(after.body.error.code).toBe(ERROR_CODES.OTP_EXPIRED);

    const user = await User.findOne({ phone: '+919876543210' }).exec();
    expect(user?.phoneVerified).toBe(false);
  });

  it('rejects an expired code', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);
    const sent = await c.post('/auth/otp/send').send({}).expect(200);

    await OtpCode.updateOne({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await c.post('/auth/otp/verify').send({ code: sent.body.data.devCode }).expect(400);
    expect(res.body.error.code).toBe(ERROR_CODES.OTP_EXPIRED);
  });

  it('invalidates an earlier code when a new one is requested', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);

    const first = await c.post('/auth/otp/send').send({}).expect(200);
    const second = await c.post('/auth/otp/send').send({}).expect(200);
    expect(second.body.data.devCode).not.toBe(first.body.data.devCode);

    await c.post('/auth/otp/verify').send({ code: first.body.data.devCode }).expect(400);
    await c.post('/auth/otp/verify').send({ code: second.body.data.devCode }).expect(200);
  });

  it('rejects a malformed code before looking anything up', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);
    await c.post('/auth/otp/send').send({}).expect(200);

    await c.post('/auth/otp/verify').send({ code: '12345' }).expect(400);
    await c.post('/auth/otp/verify').send({ code: 'abcdef' }).expect(400);
  });

  it('refuses to send a code to a phone another account already uses', async () => {
    await seedUser({ phone: '+919812345678' });

    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);

    const res = await c.post('/auth/otp/send').send({ phone: '9812345678' }).expect(409);
    expect(res.body.error.code).toBe(ERROR_CODES.DUPLICATE_KEY);
  });

  it('requires authentication', async () => {
    const c = await client();
    await c.post('/auth/otp/send').send({}).expect(401);
    await c.post('/auth/otp/verify').send({ code: '123456' }).expect(401);
  });
});
