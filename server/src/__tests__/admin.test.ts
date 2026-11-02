import { AuditLog } from '../models/AuditLog';
import { seedAndLogin, seedUser } from './helpers';

async function adminClient() {
  return seedAndLogin({ role: 'admin', phone: '+919000000098' });
}

describe('admin users endpoints', () => {
  it('rejects a non-admin', async () => {
    const buyer = await seedAndLogin({ role: 'buyer', verificationStatus: 'approved' });
    await buyer.get('/admin/users').expect(403);
  });

  it('lists users and filters by role and verification status', async () => {
    await seedUser({ role: 'farmer', phone: '+919000000001' });
    await seedUser({ role: 'buyer', phone: '+919000000002', verificationStatus: 'pending' });
    await seedUser({ role: 'buyer', phone: '+919000000003', verificationStatus: 'approved' });
    const admin = await adminClient();

    const res = await admin.get('/admin/users?role=buyer&verificationStatus=pending').expect(200);

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].phone).toBe('+919000000002');
  });

  it('approves a pending buyer and records an audit entry', async () => {
    const buyer = await seedUser({
      role: 'buyer',
      phone: '+919000000004',
      verificationStatus: 'pending',
    });
    const admin = await adminClient();

    const res = await admin
      .patch(`/admin/users/${buyer._id}/verify`)
      .send({ status: 'approved' })
      .expect(200);

    expect(res.body.data.verificationStatus).toBe('approved');

    const audit = await AuditLog.findOne({
      action: 'admin.user.verify',
      entityId: String(buyer._id),
    });
    expect(audit).not.toBeNull();
  });

  it('rejects verifying a farmer (not a buyer)', async () => {
    const farmer = await seedUser({ role: 'farmer', phone: '+919000000005' });
    const admin = await adminClient();

    await admin.patch(`/admin/users/${farmer._id}/verify`).send({ status: 'approved' }).expect(400);
  });

  it('suspends a user with a reason and blocks their subsequent requests', async () => {
    const buyer = await seedAndLogin({
      role: 'buyer',
      phone: '+919000000006',
      verificationStatus: 'approved',
    });
    const buyerProfile = await buyer.get('/auth/me').expect(200);
    const buyerId = buyerProfile.body.data.user.id;
    const admin = await adminClient();

    const res = await admin
      .patch(`/admin/users/${buyerId}/suspend`)
      .send({ reason: 'Suspicious activity reported by multiple farmers.' })
      .expect(200);

    expect(res.body.data.isSuspended).toBe(true);

    await buyer.get('/auth/me').expect(401);
  });

  it('refuses to suspend an admin account', async () => {
    const otherAdmin = await seedUser({ role: 'admin', phone: '+919000000007' });
    const admin = await adminClient();

    await admin
      .patch(`/admin/users/${otherAdmin._id}/suspend`)
      .send({ reason: 'Testing admin protection.' })
      .expect(400);
  });

  it('unsuspends a user', async () => {
    const buyer = await seedUser({
      role: 'buyer',
      phone: '+919000000008',
      verificationStatus: 'approved',
      isSuspended: true,
    });
    const admin = await adminClient();

    const res = await admin.patch(`/admin/users/${buyer._id}/unsuspend`).expect(200);

    expect(res.body.data.isSuspended).toBe(false);
  });
});
