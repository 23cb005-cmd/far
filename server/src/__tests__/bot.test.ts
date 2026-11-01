import { BotSession } from '../models/BotSession';
import { Listing } from '../models/Listing';
import { Offer } from '../models/Offer';
import { Order } from '../models/Order';
import { handleInboundMessage } from '../services/bot';
import { seedUser } from './helpers';

async function pendingOfferSetup() {
  const farmer = await seedUser({ phone: '+919000000081', district: 'Salem', crops: ['tomato'] });
  const listing = await Listing.create({
    farmer: farmer._id,
    cropKey: 'tomato',
    grade: 'A',
    quantityKg: 100,
    pricePerKg: 20,
    readyDate: new Date(),
    district: 'Salem',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  const buyer = await seedUser({
    role: 'buyer',
    verificationStatus: 'approved',
    phone: '+919000000082',
  });
  const offer = await Offer.create({
    listing: listing._id,
    buyer: buyer._id,
    quantityKg: 50,
    offeredPricePerKg: 18,
    status: 'pending',
    code: 'TESTCD',
  });
  return { farmer, listing, buyer, offer };
}

describe('handleInboundMessage', () => {
  it('welcomes an unregistered number with a registration prompt', async () => {
    const reply = await handleInboundMessage('+919999999999', 'HELP');
    expect(reply).toMatch(/register/i);
  });

  it('redirects a non-farmer to the web app', async () => {
    const buyer = await seedUser({ role: 'buyer', phone: '+919000000083' });
    const reply = await handleInboundMessage(buyer.phone, 'HELP');
    expect(reply).toMatch(/for farmers only/i);
  });

  it('replies to HELP with the command list', async () => {
    const farmer = await seedUser({ phone: '+919000000084' });
    const reply = await handleInboundMessage(farmer.phone, 'HELP');
    expect(reply).toContain('SELL');
  });

  describe('SELL -> YES', () => {
    it('creates a listing after confirmation', async () => {
      const farmer = await seedUser({
        phone: '+919000000085',
        district: 'Salem',
        crops: ['tomato'],
      });

      const draft = await handleInboundMessage(farmer.phone, 'SELL tomato 500 20');
      expect(draft).toMatch(/YES/i);

      const confirmed = await handleInboundMessage(farmer.phone, 'YES');
      expect(confirmed).toMatch(/Listed/i);

      const listings = await Listing.find({ farmer: farmer._id }).exec();
      expect(listings).toHaveLength(1);
      expect(listings[0]?.quantityKg).toBe(500);
      expect(listings[0]?.pricePerKg).toBe(20);
    });

    it('cancels on NO without creating a listing', async () => {
      const farmer = await seedUser({ phone: '+919000000086' });

      await handleInboundMessage(farmer.phone, 'SELL tomato 500 20');
      const reply = await handleInboundMessage(farmer.phone, 'NO');

      expect(reply).toMatch(/cancelled/i);
      expect(await Listing.countDocuments({ farmer: farmer._id })).toBe(0);
    });

    it('rejects an unrecognised crop without staging a session', async () => {
      const farmer = await seedUser({ phone: '+919000000087' });

      const reply = await handleInboundMessage(farmer.phone, 'SELL dragonfruit 500 20');
      expect(reply).toMatch(/recognise/i);
      expect(await BotSession.exists({ phone: farmer.phone })).toBeFalsy();
    });
  });

  describe('ACCEPT -> YES', () => {
    it('accepts the offer and creates an order', async () => {
      const { farmer, offer } = await pendingOfferSetup();

      const draft = await handleInboundMessage(farmer.phone, `ACCEPT ${offer.code}`);
      expect(draft).toMatch(/YES/i);

      const confirmed = await handleInboundMessage(farmer.phone, 'YES');
      expect(confirmed).toMatch(/Accepted/i);

      expect(await Order.countDocuments({ offer: offer._id })).toBe(1);
    });

    it("fails safely when the code isn't one of this farmer's offers", async () => {
      const { offer } = await pendingOfferSetup();
      const otherFarmer = await seedUser({ phone: '+919000000088' });

      const reply = await handleInboundMessage(otherFarmer.phone, `ACCEPT ${offer.code}`);
      expect(reply).toMatch(/doesn't match/i);
      expect(await Order.countDocuments({ offer: offer._id })).toBe(0);
    });
  });

  describe('REJECT', () => {
    it('declines the offer immediately, without a confirmation step', async () => {
      const { farmer, offer } = await pendingOfferSetup();

      const reply = await handleInboundMessage(farmer.phone, `REJECT ${offer.code}`);
      expect(reply).toMatch(/rejected/i);

      const updated = await Offer.findById(offer._id).exec();
      expect(updated?.status).toBe('declined');
    });
  });

  describe('session expiry', () => {
    it('treats an expired confirmation as nothing pending', async () => {
      const farmer = await seedUser({ phone: '+919000000089' });

      await handleInboundMessage(farmer.phone, 'SELL tomato 500 20');
      await BotSession.updateOne(
        { phone: farmer.phone },
        { expiresAt: new Date(Date.now() - 1000) },
      );

      const reply = await handleInboundMessage(farmer.phone, 'YES');
      expect(reply).toMatch(/nothing to confirm/i);
      expect(await Listing.countDocuments({ farmer: farmer._id })).toBe(0);
    });
  });

  describe('STOP / START / LANG', () => {
    it('toggles WhatsApp alerts and switches language', async () => {
      const farmer = await seedUser({ phone: '+919000000090' });

      await handleInboundMessage(farmer.phone, 'STOP');
      let updated = await farmer.collection.findOne({ _id: farmer._id });
      expect(updated?.notifyWhatsApp).toBe(false);

      await handleInboundMessage(farmer.phone, 'START');
      updated = await farmer.collection.findOne({ _id: farmer._id });
      expect(updated?.notifyWhatsApp).toBe(true);

      const reply = await handleInboundMessage(farmer.phone, 'LANG TA');
      expect(reply.length).toBeGreaterThan(0);
      updated = await farmer.collection.findOne({ _id: farmer._id });
      expect(updated?.language).toBe('ta');
    });
  });
});
