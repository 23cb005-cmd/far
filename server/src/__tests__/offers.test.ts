import { FARMER, noJar, registerAndLogin, seedAndLogin } from './helpers';

const LISTING_FIELDS = {
  cropKey: 'tomato',
  grade: 'A',
  quantityKg: '200',
  pricePerKg: '22',
  readyDate: '2026-02-01',
};

async function farmerWithListing() {
  const { c: farmer } = await registerAndLogin(FARMER);
  const res = await farmer.post('/listings').field(LISTING_FIELDS).expect(201);
  return { farmer, listingId: res.body.data.id as string };
}

describe('POST /listings/:id/offers', () => {
  it('requires authentication', async () => {
    await noJar('post', '/listings/507f1f77bcf86cd799439011/offers', {}).expect(401);
  });

  it('lets an approved buyer make an offer, labelled against the market rate', async () => {
    const { listingId } = await farmerWithListing();
    const buyer = await seedAndLogin({ role: 'buyer', verificationStatus: 'approved' });

    const res = await buyer
      .post(`/listings/${listingId}/offers`)
      .send({ quantityKg: 50, offeredPricePerKg: 20, message: 'Can collect Saturday' })
      .expect(201);

    expect(res.body.data).toMatchObject({
      quantityKg: 50,
      offeredPricePerKg: 20,
      message: 'Can collect Saturday',
      status: 'pending',
    });
    expect(res.body.data.listing.id).toBe(listingId);
    expect(typeof res.body.data.marketPriceAtOffer).toBe('number');
    expect(typeof res.body.data.diffPercent).toBe('number');
  });

  it('rejects a pending (unverified) buyer', async () => {
    const { listingId } = await farmerWithListing();
    const buyer = await seedAndLogin({ role: 'buyer' });

    const res = await buyer
      .post(`/listings/${listingId}/offers`)
      .send({ quantityKg: 50, offeredPricePerKg: 20 })
      .expect(403);
    expect(res.body.error.code).toBe('BUYER_NOT_VERIFIED');
  });

  it('rejects a farmer', async () => {
    const { listingId, farmer } = await farmerWithListing();
    await farmer
      .post(`/listings/${listingId}/offers`)
      .send({ quantityKg: 50, offeredPricePerKg: 20 })
      .expect(403);
  });

  it('rejects a quantity larger than the listing', async () => {
    const { listingId } = await farmerWithListing();
    const buyer = await seedAndLogin({ role: 'buyer', verificationStatus: 'approved' });

    await buyer
      .post(`/listings/${listingId}/offers`)
      .send({ quantityKg: 9999, offeredPricePerKg: 20 })
      .expect(400);
  });

  it('rejects an offer on a withdrawn listing', async () => {
    const { listingId, farmer } = await farmerWithListing();
    await farmer.patch(`/listings/${listingId}/withdraw`).expect(200);

    const buyer = await seedAndLogin({ role: 'buyer', verificationStatus: 'approved' });
    await buyer
      .post(`/listings/${listingId}/offers`)
      .send({ quantityKg: 50, offeredPricePerKg: 20 })
      .expect(400);
  });
});

describe('GET /listings/:id/offers', () => {
  it('lets the owning farmer see offers on their listing', async () => {
    const { listingId, farmer } = await farmerWithListing();
    const buyer = await seedAndLogin({ role: 'buyer', verificationStatus: 'approved' });
    await buyer
      .post(`/listings/${listingId}/offers`)
      .send({ quantityKg: 50, offeredPricePerKg: 20 })
      .expect(201);

    const res = await farmer.get(`/listings/${listingId}/offers`).expect(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].buyer).toBeDefined();
  });

  it('rejects a farmer who does not own the listing', async () => {
    const { listingId } = await farmerWithListing();
    const { c: otherFarmer } = await registerAndLogin({
      name: 'Other Farmer',
      phone: '9876500003',
      password: 'farmfair1',
      role: 'farmer',
      district: 'Madurai',
      crops: ['onion'],
    });
    await otherFarmer.get(`/listings/${listingId}/offers`).expect(403);
  });
});

describe('GET /offers/mine', () => {
  it("returns the buyer's own offers", async () => {
    const { listingId } = await farmerWithListing();
    const buyer = await seedAndLogin({ role: 'buyer', verificationStatus: 'approved' });
    await buyer
      .post(`/listings/${listingId}/offers`)
      .send({ quantityKg: 50, offeredPricePerKg: 20 })
      .expect(201);

    const res = await buyer.get('/offers/mine').expect(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].listing.id).toBe(listingId);
  });

  it('rejects a farmer', async () => {
    const { farmer } = await farmerWithListing();
    await farmer.get('/offers/mine').expect(403);
  });
});

describe('PATCH /offers/:id/withdraw', () => {
  it('lets the offering buyer withdraw', async () => {
    const { listingId } = await farmerWithListing();
    const buyer = await seedAndLogin({ role: 'buyer', verificationStatus: 'approved' });
    const offer = await buyer
      .post(`/listings/${listingId}/offers`)
      .send({ quantityKg: 50, offeredPricePerKg: 20 })
      .expect(201);

    const res = await buyer.patch(`/offers/${offer.body.data.id}/withdraw`).expect(200);
    expect(res.body.data.status).toBe('withdrawn');
  });

  it('rejects a different buyer', async () => {
    const { listingId } = await farmerWithListing();
    const buyer = await seedAndLogin({
      role: 'buyer',
      verificationStatus: 'approved',
      phone: '+919000000021',
    });
    const offer = await buyer
      .post(`/listings/${listingId}/offers`)
      .send({ quantityKg: 50, offeredPricePerKg: 20 })
      .expect(201);

    const otherBuyer = await seedAndLogin({
      role: 'buyer',
      verificationStatus: 'approved',
      phone: '+919000000022',
    });
    await otherBuyer.patch(`/offers/${offer.body.data.id}/withdraw`).expect(403);
  });

  it('rejects withdrawing an already-withdrawn offer', async () => {
    const { listingId } = await farmerWithListing();
    const buyer = await seedAndLogin({ role: 'buyer', verificationStatus: 'approved' });
    const offer = await buyer
      .post(`/listings/${listingId}/offers`)
      .send({ quantityKg: 50, offeredPricePerKg: 20 })
      .expect(201);

    await buyer.patch(`/offers/${offer.body.data.id}/withdraw`).expect(200);
    await buyer.patch(`/offers/${offer.body.data.id}/withdraw`).expect(409);
  });
});

describe('PATCH /offers/:id/decline', () => {
  it('lets the listing owner decline with a reason', async () => {
    const { listingId, farmer } = await farmerWithListing();
    const buyer = await seedAndLogin({ role: 'buyer', verificationStatus: 'approved' });
    const offer = await buyer
      .post(`/listings/${listingId}/offers`)
      .send({ quantityKg: 50, offeredPricePerKg: 20 })
      .expect(201);

    const res = await farmer
      .patch(`/offers/${offer.body.data.id}/decline`)
      .send({ reason: 'Already sold out' })
      .expect(200);
    expect(res.body.data.status).toBe('declined');
    expect(res.body.data.declineReason).toBe('Already sold out');
  });

  it('rejects a farmer who does not own the listing', async () => {
    const { listingId } = await farmerWithListing();
    const buyer = await seedAndLogin({ role: 'buyer', verificationStatus: 'approved' });
    const offer = await buyer
      .post(`/listings/${listingId}/offers`)
      .send({ quantityKg: 50, offeredPricePerKg: 20 })
      .expect(201);

    const { c: otherFarmer } = await registerAndLogin({
      name: 'Other Farmer',
      phone: '9876500004',
      password: 'farmfair1',
      role: 'farmer',
      district: 'Madurai',
      crops: ['onion'],
    });
    await otherFarmer.patch(`/offers/${offer.body.data.id}/decline`).expect(403);
  });
});
