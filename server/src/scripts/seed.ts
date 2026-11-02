/**
 * Wipe and reseed the database with realistic demo data.
 *
 *   npm run seed            (refuses to run against NODE_ENV=production)
 *   npm run seed -- --force (overrides the refusal)
 *
 * `npm run demo:reset` is the same script - it always wipes first, so a
 * second run already resets the demo.
 */
import { GRADES, type District, type Grade } from '@farmfair/shared';
import { env } from '../config/env';
import { connectDb, disconnectDb } from '../config/db';
import { JobRun } from '../models/JobRun';
import { Listing, type ListingDocument } from '../models/Listing';
import { MandiPrice } from '../models/MandiPrice';
import { Notification } from '../models/Notification';
import { Offer, type OfferDocument } from '../models/Offer';
import { Order, type OrderDocument } from '../models/Order';
import { Rating } from '../models/Rating';
import { User, type UserDocument } from '../models/User';
import { GeneratedMandiProvider } from '../providers/mandi/GeneratedMandiProvider';
import { generateUniqueCode } from '../utils/shortCode';
import { hashPassword } from '../services/password';
import { round2 } from '../services/mandiPrices';

const PASSWORD = 'farmfair1';
const MANDI_DAYS = 30;
const mandiProvider = new GeneratedMandiProvider();

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function wipe(): Promise<void> {
  await Promise.all([
    User.deleteMany({}),
    Listing.deleteMany({}),
    Offer.deleteMany({}),
    Order.deleteMany({}),
    MandiPrice.deleteMany({}),
    Notification.deleteMany({}),
    Rating.deleteMany({}),
    JobRun.deleteMany({}),
  ]);
}

interface SeededAccount {
  role: string;
  name: string;
  phone: string;
}

async function seedUsers(): Promise<{
  admin: UserDocument;
  farmers: UserDocument[];
  buyers: UserDocument[];
  accounts: SeededAccount[];
}> {
  const passwordHash = await hashPassword(PASSWORD);
  const accounts: SeededAccount[] = [];

  const admin = await User.create({
    name: 'Admin User',
    phone: '+919000000001',
    passwordHash,
    role: 'admin',
    district: 'Chennai',
    verificationStatus: 'not_required',
    phoneVerified: true,
  });
  accounts.push({ role: 'admin', name: admin.name, phone: admin.phone });

  const farmerSeeds = [
    { name: 'Murugan S', district: 'Salem', crops: ['tomato', 'onion', 'brinjal'] },
    { name: 'Lakshmi R', district: 'Salem', crops: ['banana', 'coconut'] },
    { name: 'Karthik V', district: 'Namakkal', crops: ['turmeric', 'tapioca'] },
    { name: 'Meena P', district: 'Namakkal', crops: ['groundnut', 'paddy'] },
    { name: 'Selvam K', district: 'Erode', crops: ['chilli', 'onion', 'tomato'] },
  ];
  const farmers: UserDocument[] = [];
  for (const [i, seed] of farmerSeeds.entries()) {
    const phone = `+91900000${String(1010 + i)}`;
    const farmer = await User.create({
      name: seed.name,
      phone,
      passwordHash,
      role: 'farmer',
      district: seed.district,
      village: `${seed.district} village`,
      crops: seed.crops,
      phoneVerified: true,
    });
    farmers.push(farmer);
    accounts.push({ role: 'farmer', name: farmer.name, phone: farmer.phone });
  }

  const buyerSeeds = [
    { name: 'Priya Traders', district: 'Coimbatore', verificationStatus: 'approved' as const },
    { name: 'Senthil Agro Exports', district: 'Madurai', verificationStatus: 'approved' as const },
    { name: 'New Horizon Foods', district: 'Chennai', verificationStatus: 'pending' as const },
  ];
  const buyers: UserDocument[] = [];
  for (const [i, seed] of buyerSeeds.entries()) {
    const phone = `+91900000${String(1020 + i)}`;
    const buyer = await User.create({
      name: seed.name,
      phone,
      passwordHash,
      role: 'buyer',
      district: seed.district,
      business: { name: seed.name },
      verificationStatus: seed.verificationStatus,
      phoneVerified: true,
    });
    buyers.push(buyer);
    accounts.push({ role: 'buyer', name: buyer.name, phone: buyer.phone });
  }

  return { admin, farmers, buyers, accounts };
}

/** 30 days of generated prices for every district a seeded farmer is in, so every listing has a market price to compare against. */
async function seedMandiPrices(districts: string[]): Promise<void> {
  for (const district of new Set(districts)) {
    for (let d = MANDI_DAYS - 1; d >= 0; d -= 1) {
      const date = dateString(daysAgo(d));
      const records = await mandiProvider.fetchDay(district as District, date);
      await MandiPrice.insertMany(
        records.map((r) => ({
          date,
          district,
          cropKey: r.cropKey,
          market: r.market,
          minPrice: r.minPrice,
          maxPrice: r.maxPrice,
          modalPrice: r.modalPrice,
          unit: 'kg',
          source: mandiProvider.name,
        })),
      );
    }
  }
}

async function todayModalPrice(district: string, cropKey: string): Promise<number> {
  const today = dateString(new Date());
  const doc = await MandiPrice.findOne({ district, cropKey, date: today }).exec();
  if (!doc) throw new Error(`No seeded price for ${cropKey} in ${district}`);
  return doc.modalPrice;
}

async function seedListings(farmers: UserDocument[]): Promise<ListingDocument[]> {
  const grades: Grade[] = [...GRADES];
  // Fixed, not cycled: guarantees exactly 4 `sold` listings so seedOrders can
  // form one order per ORDER_STATUSES value.
  const statuses = [
    'active',
    'active',
    'active',
    'active',
    'active',
    'withdrawn',
    'expired',
    'sold',
    'sold',
    'sold',
    'sold',
    'active',
  ] as const;
  const listings: ListingDocument[] = [];

  let i = 0;
  for (const farmer of farmers) {
    for (const cropKey of farmer.crops) {
      const status = statuses[i % statuses.length];
      const modal = await todayModalPrice(farmer.district, cropKey);
      const createdDaysAgo = status === 'expired' ? env.LISTING_EXPIRY_DAYS + 2 : i % 5;
      const createdAt = daysAgo(createdDaysAgo);
      const expiresAt =
        status === 'expired'
          ? daysAgo(1)
          : new Date(createdAt.getTime() + env.LISTING_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      const listing = await Listing.create({
        farmer: farmer._id,
        cropKey,
        grade: grades[i % grades.length],
        quantityKg: 100 + (i % 5) * 50,
        pricePerKg: round2(modal * (0.95 + (i % 3) * 0.05)),
        readyDate: daysAgo(-2),
        district: farmer.district,
        status,
        expiresAt,
        createdAt,
      });
      listings.push(listing);
      i += 1;
    }
  }
  return listings;
}

/** Offers spread across every fairness bucket (below/fair/above market) and every OFFER_STATUSES value. */
async function seedOffers(
  listings: ListingDocument[],
  buyers: UserDocument[],
): Promise<OfferDocument[]> {
  const statuses = ['pending', 'pending', 'withdrawn', 'declined'] as const;
  const priceFactors = [0.85, 1.0, 1.12]; // below_market, fair, above_market
  const offers: OfferDocument[] = [];

  let i = 0;
  const activeOrSold = listings.filter((l) => l.status === 'active' || l.status === 'sold');
  for (const listing of activeOrSold) {
    const buyer = buyers[i % buyers.length]!;
    const modal = await todayModalPrice(listing.district, listing.cropKey);
    const status = listing.status === 'sold' ? 'accepted' : statuses[i % statuses.length];

    const offer = await Offer.create({
      listing: listing._id,
      buyer: buyer._id,
      quantityKg: Math.min(listing.quantityKg, 50 + (i % 3) * 20),
      offeredPricePerKg: round2(modal * priceFactors[i % priceFactors.length]!),
      marketPriceAtOffer: modal,
      status,
      ...(status === 'declined' ? { declineReason: 'Price too low for this grade.' } : {}),
      code: await generateUniqueCode(Offer),
    });
    offers.push(offer);
    i += 1;
  }
  return offers;
}

/** Orders covering every ORDER_STATUSES value, formed from the listings already marked `sold`. */
async function seedOrders(
  offers: OfferDocument[],
  listings: ListingDocument[],
): Promise<{ orders: OrderDocument[]; completed: OrderDocument[] }> {
  const soldListingIds = new Set(
    listings.filter((l) => l.status === 'sold').map((l) => String(l._id)),
  );
  const candidates = offers.filter((o) => soldListingIds.has(String(o.listing)));

  const statuses = ['pending_payment', 'paid', 'completed', 'cancelled'] as const;
  const orders: OrderDocument[] = [];
  const completed: OrderDocument[] = [];

  for (const [i, offer] of candidates.entries()) {
    const listing = listings.find((l) => String(l._id) === String(offer.listing))!;
    const status = statuses[i % statuses.length];
    const totalAmount = round2(offer.quantityKg * offer.offeredPricePerKg);
    const commissionAmount = round2(totalAmount * (env.COMMISSION_PERCENT / 100));
    const payoutAmount = round2(totalAmount - commissionAmount);
    const now = new Date();

    const order = await Order.create({
      listing: listing._id,
      offer: offer._id,
      farmer: listing.farmer,
      buyer: offer.buyer,
      cropKey: listing.cropKey,
      quantityKg: offer.quantityKg,
      pricePerKg: offer.offeredPricePerKg,
      totalAmount,
      commissionPercent: env.COMMISSION_PERCENT,
      commissionAmount,
      payoutAmount,
      status,
      ...(status !== 'pending_payment'
        ? { paymentProvider: 'simulated' as const, paymentReference: `SIM-${i}`, paidAt: now }
        : {}),
      ...(status === 'completed'
        ? { farmerConfirmedAt: now, buyerConfirmedAt: now, completedAt: now }
        : {}),
      ...(status === 'cancelled' ? { cancelledAt: now, cancelReason: 'Buyer changed plans.' } : {}),
      code: await generateUniqueCode(Order),
    });
    orders.push(order);
    if (status === 'completed') completed.push(order);
  }

  return { orders, completed };
}

async function seedRatings(completedOrders: OrderDocument[]): Promise<void> {
  for (const order of completedOrders) {
    await Rating.create({
      order: order._id,
      rater: order.farmer,
      ratee: order.buyer,
      score: 5,
      comment: 'Smooth pickup, paid on time.',
    });
    await Rating.create({
      order: order._id,
      rater: order.buyer,
      ratee: order.farmer,
      score: 4,
      comment: 'Good quality crop, as described.',
    });
  }
}

async function seedNotifications(farmers: UserDocument[], buyers: UserDocument[]): Promise<void> {
  const farmer = farmers[0]!;
  const buyer = buyers[0]!;
  await Notification.create([
    {
      user: farmer._id,
      type: 'offer_created',
      title: 'New offer',
      message: `${buyer.name} made an offer on your listing.`,
    },
    {
      user: buyer._id,
      type: 'offer_accepted',
      title: 'Offer accepted',
      message: 'Your offer was accepted. Pay to confirm the order.',
    },
    {
      user: farmer._id,
      type: 'price_alert',
      title: 'Price moved',
      message: 'Tomato prices moved more than 10% in your district today.',
      read: true,
      readAt: new Date(),
    },
  ]);
}

function printCredentials(accounts: SeededAccount[]): void {
  console.log('\nSeeded accounts (all use the same password):\n');
  console.log(`  password: ${PASSWORD}\n`);
  const nameWidth = Math.max(...accounts.map((a) => a.name.length), 4);
  console.log(`  role     ${'name'.padEnd(nameWidth)}  phone`);
  console.log(`  -------  ${'-'.repeat(nameWidth)}  --------------`);
  for (const a of accounts) {
    console.log(`  ${a.role.padEnd(7)}  ${a.name.padEnd(nameWidth)}  ${a.phone}`);
  }
  console.log('');
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  if (env.NODE_ENV === 'production' && !force) {
    console.error('Refusing to seed a production database. Pass --force to override.');
    process.exit(1);
  }

  await connectDb();

  console.log('Wiping existing data...');
  await wipe();

  console.log('Seeding users...');
  const { farmers, buyers, accounts } = await seedUsers();

  console.log(`Seeding ${MANDI_DAYS} days of mandi prices...`);
  await seedMandiPrices(farmers.map((f) => f.district));

  console.log('Seeding listings...');
  const listings = await seedListings(farmers);

  console.log('Seeding offers...');
  const offers = await seedOffers(listings, buyers);

  console.log('Seeding orders...');
  const { orders, completed } = await seedOrders(offers, listings);

  console.log('Seeding ratings...');
  await seedRatings(completed);

  console.log('Seeding notifications...');
  await seedNotifications(farmers, buyers);

  console.log('\nDone:');
  console.log(`  users:         ${accounts.length}`);
  console.log(`  mandi prices:  ${await MandiPrice.countDocuments()}`);
  console.log(`  listings:      ${listings.length}`);
  console.log(`  offers:        ${offers.length}`);
  console.log(`  orders:        ${orders.length}`);
  console.log(`  ratings:       ${await Rating.countDocuments()}`);
  console.log(`  notifications: ${await Notification.countDocuments()}`);

  printCredentials(accounts);
}

main()
  .then(async () => {
    await disconnectDb();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(`\nFailed: ${error instanceof Error ? error.message : String(error)}\n`);
    await disconnectDb().catch(() => undefined);
    process.exit(1);
  });
