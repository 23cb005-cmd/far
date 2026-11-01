import { FARMER, noJar, registerAndLogin, seedAndLogin } from './helpers';

const LISTING_FIELDS = {
  cropKey: 'tomato',
  grade: 'A',
  quantityKg: '200',
  pricePerKg: '22',
  readyDate: '2026-02-01',
};

async function setupPendingOffer() {
  const { c: farmer } = await registerAndLogin(FARMER);
  const listing = await farmer.post('/listings').field(LISTING_FIELDS).expect(201);
  const listingId = listing.body.data.id as string;

  const buyer = await seedAndLogin({ role: 'buyer', verificationStatus: 'approved' });
  const offer = await buyer
    .post(`/listings/${listingId}/offers`)
    .send({ quantityKg: 50, offeredPricePerKg: 20 })
    .expect(201);

  return { farmer, buyer, listingId, offerId: offer.body.data.id as string };
}

async function setupPendingOrder() {
  const { farmer, buyer, listingId, offerId } = await setupPendingOffer();
  const accept = await farmer.patch(`/offers/${offerId}/accept`).expect(201);
  return { farmer, buyer, listingId, offerId, orderId: accept.body.data.id as string };
}

async function setupPaidOrder() {
  const { farmer, buyer, listingId, orderId } = await setupPendingOrder();
  await buyer.patch(`/orders/${orderId}/pay`).expect(200);
  return { farmer, buyer, listingId, orderId };
}

async function setupCompletedOrder() {
  const { farmer, buyer, orderId } = await setupPaidOrder();
  await farmer.patch(`/orders/${orderId}/confirm`).expect(200);
  await buyer.patch(`/orders/${orderId}/confirm`).expect(200);
  return { farmer, buyer, orderId };
}

describe('PATCH /offers/:id/accept', () => {
  it('requires authentication', async () => {
    await noJar('patch', '/offers/507f1f77bcf86cd799439011/accept', {}).expect(401);
  });

  it('creates an order snapshotting the offer terms and the commission', async () => {
    const { farmer, offerId } = await setupPendingOffer();

    const res = await farmer.patch(`/offers/${offerId}/accept`).expect(201);

    expect(res.body.data).toMatchObject({
      quantityKg: 50,
      pricePerKg: 20,
      totalAmount: 1000,
      commissionPercent: 1,
      commissionAmount: 10,
      payoutAmount: 990,
      status: 'pending_payment',
      myRatingSubmitted: false,
    });
    expect(res.body.data.farmer.name).toBe(FARMER.name);
    expect(res.body.data.buyer.id).toBeDefined();
  });

  it('marks the listing sold and auto-declines rival offers', async () => {
    const { farmer, listingId, offerId } = await setupPendingOffer();

    const rivalBuyer = await seedAndLogin({
      role: 'buyer',
      verificationStatus: 'approved',
      phone: '+919000000031',
    });
    const rival = await rivalBuyer
      .post(`/listings/${listingId}/offers`)
      .send({ quantityKg: 20, offeredPricePerKg: 19 })
      .expect(201);

    await farmer.patch(`/offers/${offerId}/accept`).expect(201);

    const listing = await farmer.get(`/listings/${listingId}`).expect(200);
    expect(listing.body.data.status).toBe('sold');

    const rivalOffers = await rivalBuyer.get('/offers/mine').expect(200);
    const declined = rivalOffers.body.data.items.find(
      (o: { id: string }) => o.id === rival.body.data.id,
    );
    expect(declined.status).toBe('declined');
  });

  it('rejects a farmer who does not own the listing', async () => {
    const { offerId } = await setupPendingOffer();
    const { c: otherFarmer } = await registerAndLogin({
      name: 'Other Farmer',
      phone: '9876500010',
      password: 'farmfair1',
      role: 'farmer',
      district: 'Madurai',
      crops: ['onion'],
    });
    await otherFarmer.patch(`/offers/${offerId}/accept`).expect(403);
  });

  it('rejects accepting an already-accepted offer', async () => {
    const { farmer, offerId } = await setupPendingOffer();
    await farmer.patch(`/offers/${offerId}/accept`).expect(201);
    await farmer.patch(`/offers/${offerId}/accept`).expect(409);
  });

  it('rejects a buyer', async () => {
    const { buyer, offerId } = await setupPendingOffer();
    await buyer.patch(`/offers/${offerId}/accept`).expect(403);
  });
});

describe('PATCH /orders/:id/pay', () => {
  it('requires authentication', async () => {
    await noJar('patch', '/orders/507f1f77bcf86cd799439011/pay', {}).expect(401);
  });

  it('lets the buyer pay, moving the order to paid', async () => {
    const { buyer, orderId } = await setupPendingOrder();

    const res = await buyer.patch(`/orders/${orderId}/pay`).expect(200);

    expect(res.body.data.status).toBe('paid');
    expect(res.body.data.paymentProvider).toBe('simulated');
    expect(res.body.data.paidAt).toBeTruthy();
  });

  it('rejects the farmer paying', async () => {
    const { farmer, orderId } = await setupPendingOrder();
    await farmer.patch(`/orders/${orderId}/pay`).expect(403);
  });

  it('rejects paying twice', async () => {
    const { buyer, orderId } = await setupPendingOrder();
    await buyer.patch(`/orders/${orderId}/pay`).expect(200);
    await buyer.patch(`/orders/${orderId}/pay`).expect(409);
  });
});

describe('PATCH /orders/:id/confirm', () => {
  it('requires authentication', async () => {
    await noJar('patch', '/orders/507f1f77bcf86cd799439011/confirm', {}).expect(401);
  });

  it('completes the order once both sides confirm, and not before', async () => {
    const { farmer, buyer, orderId } = await setupPaidOrder();

    const afterFarmer = await farmer.patch(`/orders/${orderId}/confirm`).expect(200);
    expect(afterFarmer.body.data.status).toBe('paid');
    expect(afterFarmer.body.data.farmerConfirmedAt).toBeTruthy();
    expect(afterFarmer.body.data.buyerConfirmedAt).toBeUndefined();

    const afterBuyer = await buyer.patch(`/orders/${orderId}/confirm`).expect(200);
    expect(afterBuyer.body.data.status).toBe('completed');
    expect(afterBuyer.body.data.completedAt).toBeTruthy();
  });

  it('rejects confirming before payment', async () => {
    const { farmer, orderId } = await setupPendingOrder();
    await farmer.patch(`/orders/${orderId}/confirm`).expect(409);
  });

  it('rejects the same party confirming twice', async () => {
    const { farmer, orderId } = await setupPaidOrder();
    await farmer.patch(`/orders/${orderId}/confirm`).expect(200);
    await farmer.patch(`/orders/${orderId}/confirm`).expect(409);
  });

  it('rejects a non-party', async () => {
    const { orderId } = await setupPaidOrder();
    const outsider = await seedAndLogin({
      role: 'buyer',
      verificationStatus: 'approved',
      phone: '+919000000032',
    });
    await outsider.patch(`/orders/${orderId}/confirm`).expect(403);
  });
});

describe('PATCH /orders/:id/cancel', () => {
  it('lets either party cancel before payment, reactivating the listing', async () => {
    const { buyer, listingId, orderId } = await setupPendingOrder();

    const res = await buyer
      .patch(`/orders/${orderId}/cancel`)
      .send({ reason: 'Changed my mind' })
      .expect(200);
    expect(res.body.data.status).toBe('cancelled');
    expect(res.body.data.cancelReason).toBe('Changed my mind');

    const listing = await buyer.get(`/listings/${listingId}`).expect(200);
    expect(listing.body.data.status).toBe('active');
  });

  it('rejects cancelling once the order has been paid', async () => {
    const { buyer, orderId } = await setupPaidOrder();
    await buyer.patch(`/orders/${orderId}/cancel`).expect(409);
  });

  it('rejects a non-party', async () => {
    const { orderId } = await setupPendingOrder();
    const outsider = await seedAndLogin({
      role: 'buyer',
      verificationStatus: 'approved',
      phone: '+919000000033',
    });
    await outsider.patch(`/orders/${orderId}/cancel`).expect(403);
  });
});

describe('GET /orders/mine', () => {
  it('shows the order to both the farmer and the buyer', async () => {
    const { farmer, buyer, orderId } = await setupPendingOrder();

    const farmerView = await farmer.get('/orders/mine').expect(200);
    expect(farmerView.body.data.items.map((o: { id: string }) => o.id)).toContain(orderId);

    const buyerView = await buyer.get('/orders/mine').expect(200);
    expect(buyerView.body.data.items.map((o: { id: string }) => o.id)).toContain(orderId);
  });
});

describe('POST /orders/:id/rating', () => {
  it('requires authentication', async () => {
    await noJar('post', '/orders/507f1f77bcf86cd799439011/rating', {}).expect(401);
  });

  it('lets either party rate the other once the order is completed', async () => {
    const { farmer, buyer, orderId } = await setupCompletedOrder();

    const fromFarmer = await farmer
      .post(`/orders/${orderId}/rating`)
      .send({ score: 5, comment: 'Reliable buyer' })
      .expect(201);
    expect(fromFarmer.body.data).toMatchObject({ score: 5, comment: 'Reliable buyer' });

    const fromBuyer = await buyer.post(`/orders/${orderId}/rating`).send({ score: 4 }).expect(201);
    expect(fromBuyer.body.data.score).toBe(4);
  });

  it("updates the ratee's aggregate rating", async () => {
    const { farmer, buyer, orderId } = await setupCompletedOrder();

    await farmer.post(`/orders/${orderId}/rating`).send({ score: 5 }).expect(201);

    const buyerProfile = await buyer.get('/auth/me').expect(200);
    expect(buyerProfile.body.data.user.ratingAvg).toBe(5);
    expect(buyerProfile.body.data.user.ratingCount).toBe(1);
  });

  it('rejects rating before the order is completed', async () => {
    const { farmer, orderId } = await setupPaidOrder();
    await farmer.post(`/orders/${orderId}/rating`).send({ score: 5 }).expect(409);
  });

  it('rejects a second rating from the same party', async () => {
    const { farmer, orderId } = await setupCompletedOrder();
    await farmer.post(`/orders/${orderId}/rating`).send({ score: 5 }).expect(201);
    await farmer.post(`/orders/${orderId}/rating`).send({ score: 3 }).expect(409);
  });

  it('rejects a non-party', async () => {
    const { orderId } = await setupCompletedOrder();
    const outsider = await seedAndLogin({
      role: 'buyer',
      verificationStatus: 'approved',
      phone: '+919000000034',
    });
    await outsider.post(`/orders/${orderId}/rating`).send({ score: 5 }).expect(403);
  });

  it('rejects a score outside 1-5', async () => {
    const { farmer, orderId } = await setupCompletedOrder();
    await farmer.post(`/orders/${orderId}/rating`).send({ score: 6 }).expect(400);
    await farmer.post(`/orders/${orderId}/rating`).send({ score: 0 }).expect(400);
  });
});
