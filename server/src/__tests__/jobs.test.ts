import { cleanup } from '../jobs/cleanup';
import { expireListings } from '../jobs/expireListings';
import { priceAlerts } from '../jobs/priceAlerts';
import { runJobByName } from '../jobs';
import { JobRun } from '../models/JobRun';
import { Listing } from '../models/Listing';
import { MandiPrice } from '../models/MandiPrice';
import { Notification } from '../models/Notification';
import { Offer } from '../models/Offer';
import { seedAndLogin, seedUser } from './helpers';

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoDateString(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

describe('jobs/expireListings', () => {
  it('expires an overdue listing, declines its pending offers and notifies the farmer', async () => {
    const farmer = await seedUser({ district: 'Salem', crops: ['tomato', 'onion'] });
    const listing = await Listing.create({
      farmer: farmer._id,
      cropKey: 'tomato',
      grade: 'A',
      quantityKg: 100,
      pricePerKg: 20,
      readyDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      district: farmer.district,
      status: 'active',
      expiresAt: new Date(Date.now() - 1000),
    });

    const buyer = await seedUser({
      role: 'buyer',
      verificationStatus: 'approved',
      phone: '+919000000041',
    });
    const offer = await Offer.create({
      listing: listing._id,
      buyer: buyer._id,
      quantityKg: 10,
      offeredPricePerKg: 18,
      status: 'pending',
      code: 'TEST01',
    });

    const result = await expireListings();
    expect(result.summary).toContain('1');

    const updatedListing = await Listing.findById(listing._id).exec();
    expect(updatedListing?.status).toBe('expired');

    const updatedOffer = await Offer.findById(offer._id).exec();
    expect(updatedOffer?.status).toBe('declined');

    const notifications = await Notification.find({ user: farmer._id }).exec();
    expect(notifications.some((n) => n.type === 'listing_expired')).toBe(true);
  });

  it('leaves an unexpired listing untouched', async () => {
    const farmer = await seedUser({ district: 'Salem', crops: ['tomato', 'onion'] });
    const listing = await Listing.create({
      farmer: farmer._id,
      cropKey: 'tomato',
      grade: 'A',
      quantityKg: 100,
      pricePerKg: 20,
      readyDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      district: farmer.district,
      status: 'active',
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });

    await expireListings();

    const unchanged = await Listing.findById(listing._id).exec();
    expect(unchanged?.status).toBe('active');
  });
});

describe('jobs/priceAlerts', () => {
  it('notifies farmers growing the crop when the price moves past the threshold', async () => {
    const farmer = await seedUser({ role: 'farmer', district: 'Salem', crops: ['tomato'] });

    await MandiPrice.create({
      date: daysAgoDateString(1),
      district: 'Salem',
      cropKey: 'tomato',
      market: 'Salem Market',
      minPrice: 1800,
      maxPrice: 2200,
      modalPrice: 2000,
      source: 'generated',
    });
    await MandiPrice.create({
      date: todayDateString(),
      district: 'Salem',
      cropKey: 'tomato',
      market: 'Salem Market',
      minPrice: 2100,
      maxPrice: 2500,
      modalPrice: 2300,
      source: 'generated',
    });

    const result = await priceAlerts();
    expect(result.summary).toContain('1');

    const notifications = await Notification.find({ user: farmer._id }).exec();
    expect(notifications.some((n) => n.type === 'price_alert')).toBe(true);
  });

  it('does not notify when the move is below the threshold', async () => {
    const farmer = await seedUser({ role: 'farmer', district: 'Salem', crops: ['tomato'] });

    await MandiPrice.create({
      date: daysAgoDateString(1),
      district: 'Salem',
      cropKey: 'tomato',
      market: 'Salem Market',
      minPrice: 1900,
      maxPrice: 2100,
      modalPrice: 2000,
      source: 'generated',
    });
    await MandiPrice.create({
      date: todayDateString(),
      district: 'Salem',
      cropKey: 'tomato',
      market: 'Salem Market',
      minPrice: 1950,
      maxPrice: 2150,
      modalPrice: 2040,
      source: 'generated',
    });

    await priceAlerts();

    const notifications = await Notification.find({ user: farmer._id }).exec();
    expect(notifications.some((n) => n.type === 'price_alert')).toBe(false);
  });
});

describe('jobs/cleanup', () => {
  it('removes old read notifications and old job runs, keeping recent ones', async () => {
    const farmer = await seedUser({ district: 'Salem', crops: ['tomato', 'onion'] });
    const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);

    const oldRead = await Notification.create({
      user: farmer._id,
      type: 'offer_created',
      title: 'Old',
      message: 'Old notification',
      read: true,
      readAt: ninetyOneDaysAgo,
    });
    const recentRead = await Notification.create({
      user: farmer._id,
      type: 'offer_created',
      title: 'Recent',
      message: 'Recent notification',
      read: true,
      readAt: new Date(),
    });
    const unread = await Notification.create({
      user: farmer._id,
      type: 'offer_created',
      title: 'Unread',
      message: 'Unread notification',
      read: false,
    });

    const oldJobRun = await JobRun.create({
      name: 'cleanup',
      status: 'success',
      startedAt: ninetyOneDaysAgo,
      finishedAt: ninetyOneDaysAgo,
    });

    await cleanup();

    expect(await Notification.findById(oldRead._id).exec()).toBeNull();
    expect(await Notification.findById(recentRead._id).exec()).not.toBeNull();
    expect(await Notification.findById(unread._id).exec()).not.toBeNull();
    expect(await JobRun.findById(oldJobRun._id).exec()).toBeNull();
  });
});

describe('runJobByName', () => {
  it('records a JobRun for the run', async () => {
    await runJobByName('cleanup');

    const run = await JobRun.findOne({ name: 'cleanup' }).sort({ startedAt: -1 }).exec();
    expect(run?.status).toBe('success');
  });
});

describe('admin jobs endpoints', () => {
  async function adminClient() {
    return seedAndLogin({ role: 'admin', phone: '+919000000099' });
  }

  it('rejects a non-admin', async () => {
    const buyer = await seedAndLogin({ role: 'buyer', verificationStatus: 'approved' });
    await buyer.get('/admin/jobs').expect(403);
  });

  it('lets an admin list recent job runs', async () => {
    await runJobByName('cleanup');
    const admin = await adminClient();

    const res = await admin.get('/admin/jobs').expect(200);
    expect(res.body.data.items.some((r: { name: string }) => r.name === 'cleanup')).toBe(true);
  });

  it('lets an admin trigger a job manually', async () => {
    const admin = await adminClient();

    const res = await admin.post('/admin/jobs/cleanup/run').expect(200);
    expect(res.body.data.status).toBe('success');
  });

  it('rejects an unknown job name', async () => {
    const admin = await adminClient();
    await admin.post('/admin/jobs/notAJob/run').expect(400);
  });
});
