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
  const { farmer, buyer, offerId } = await setupPendingOffer();
  const accept = await farmer.patch(`/offers/${offerId}/accept`).expect(201);
  return { farmer, buyer, orderId: accept.body.data.id as string };
}

async function setupPaidOrder() {
  const { farmer, buyer, orderId } = await setupPendingOrder();
  await buyer.patch(`/orders/${orderId}/pay`).expect(200);
  return { farmer, buyer, orderId };
}

async function setupCompletedOrder() {
  const { farmer, buyer, orderId } = await setupPaidOrder();
  await farmer.patch(`/orders/${orderId}/confirm`).expect(200);
  await buyer.patch(`/orders/${orderId}/confirm`).expect(200);
  return { farmer, buyer, orderId };
}

interface NotificationItem {
  id: string;
  type: string;
  read: boolean;
}

describe('notification triggers', () => {
  it('notifies the farmer when a buyer makes an offer', async () => {
    const { farmer } = await setupPendingOffer();

    const res = await farmer.get('/notifications').expect(200);
    const types = res.body.data.items.map((n: NotificationItem) => n.type);
    expect(types).toContain('offer_created');
    expect(res.body.data.items.every((n: NotificationItem) => !n.read)).toBe(true);
  });

  it('notifies the buyer when the farmer declines their offer', async () => {
    const { farmer, buyer, offerId } = await setupPendingOffer();
    await farmer.patch(`/offers/${offerId}/decline`).send({ reason: 'Sold out' }).expect(200);

    const res = await buyer.get('/notifications').expect(200);
    const types = res.body.data.items.map((n: NotificationItem) => n.type);
    expect(types).toContain('offer_declined');
  });

  it('notifies the buyer when the farmer accepts their offer', async () => {
    const { buyer } = await setupPendingOrder();

    const res = await buyer.get('/notifications').expect(200);
    const types = res.body.data.items.map((n: NotificationItem) => n.type);
    expect(types).toContain('offer_accepted');
  });

  it('notifies the farmer when the buyer pays', async () => {
    const { farmer } = await setupPaidOrder();

    const res = await farmer.get('/notifications').expect(200);
    const types = res.body.data.items.map((n: NotificationItem) => n.type);
    expect(types).toContain('order_paid');
  });

  it('notifies both parties when the order completes', async () => {
    const { farmer, buyer } = await setupCompletedOrder();

    const farmerNotifications = await farmer.get('/notifications').expect(200);
    const buyerNotifications = await buyer.get('/notifications').expect(200);
    expect(farmerNotifications.body.data.items.map((n: NotificationItem) => n.type)).toContain(
      'order_completed',
    );
    expect(buyerNotifications.body.data.items.map((n: NotificationItem) => n.type)).toContain(
      'order_completed',
    );
  });

  it('notifies the farmer when the buyer cancels an unpaid order', async () => {
    const { farmer, buyer, orderId } = await setupPendingOrder();
    await buyer.patch(`/orders/${orderId}/cancel`).send({ reason: 'Changed my mind' }).expect(200);

    const res = await farmer.get('/notifications').expect(200);
    const types = res.body.data.items.map((n: NotificationItem) => n.type);
    expect(types).toContain('order_cancelled');
  });

  it('notifies the ratee when a rating is submitted', async () => {
    const { farmer, buyer, orderId } = await setupCompletedOrder();
    await farmer.post(`/orders/${orderId}/rating`).send({ score: 5 }).expect(201);

    const res = await buyer.get('/notifications').expect(200);
    const types = res.body.data.items.map((n: NotificationItem) => n.type);
    expect(types).toContain('rating_received');
  });
});

describe('GET /notifications', () => {
  it('requires authentication', async () => {
    await noJar('get', '/notifications', {}).expect(401);
  });

  it('filters to unread only', async () => {
    const { farmer } = await setupPendingOffer();

    const all = await farmer.get('/notifications').expect(200);
    const id = all.body.data.items[0].id as string;
    await farmer.patch(`/notifications/${id}/read`).expect(200);

    const unread = await farmer.get('/notifications').query({ unreadOnly: true }).expect(200);
    expect(unread.body.data.items.map((n: NotificationItem) => n.id)).not.toContain(id);
  });
});

describe('GET /notifications/unread-count', () => {
  it('counts only unread notifications', async () => {
    const { farmer } = await setupPendingOffer();

    const before = await farmer.get('/notifications/unread-count').expect(200);
    expect(before.body.data.count).toBe(1);

    const list = await farmer.get('/notifications').expect(200);
    await farmer.patch(`/notifications/${list.body.data.items[0].id}/read`).expect(200);

    const after = await farmer.get('/notifications/unread-count').expect(200);
    expect(after.body.data.count).toBe(0);
  });
});

describe('PATCH /notifications/:id/read', () => {
  it("rejects marking a different user's notification", async () => {
    const { farmer, buyer } = await setupPendingOffer();
    const list = await farmer.get('/notifications').expect(200);
    const notificationId = list.body.data.items[0].id as string;

    await buyer.patch(`/notifications/${notificationId}/read`).expect(404);
  });
});

describe('PATCH /notifications/read-all', () => {
  it('marks every notification read', async () => {
    const { farmer } = await setupPendingOffer();

    await farmer.patch('/notifications/read-all').expect(200);

    const count = await farmer.get('/notifications/unread-count').expect(200);
    expect(count.body.data.count).toBe(0);
  });
});
