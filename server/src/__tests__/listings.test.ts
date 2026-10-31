import { MAX_PHOTO_SIZE_MB } from '@farmfair/shared';
import { FARMER, noJar, registerAndLogin, seedAndLogin } from './helpers';

const LISTING_FIELDS = {
  cropKey: 'tomato',
  grade: 'A',
  quantityKg: '200',
  pricePerKg: '22',
  readyDate: '2026-02-01',
};

describe('POST /listings', () => {
  it('requires authentication', async () => {
    await noJar('post', '/listings', {}).expect(401);
  });

  it('lets a farmer create a listing without a photo', async () => {
    const { c } = await registerAndLogin(FARMER);

    const res = await c.post('/listings').field(LISTING_FIELDS).expect(201);

    expect(res.body.data).toMatchObject({
      cropKey: 'tomato',
      grade: 'A',
      quantityKg: 200,
      pricePerKg: 22,
      district: FARMER.district,
      status: 'active',
    });
    expect(res.body.data.farmer.name).toBe(FARMER.name);
    expect(res.body.data.photoUrl).toBeUndefined();

    const expiresAt = new Date(res.body.data.expiresAt).getTime();
    const createdAt = new Date(res.body.data.createdAt).getTime();
    expect(expiresAt - createdAt).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
  });

  it('accepts a photo and returns its URL', async () => {
    const { c } = await registerAndLogin(FARMER);

    const res = await c
      .post('/listings')
      .field(LISTING_FIELDS)
      .attach('photo', Buffer.from('fake-image-bytes'), {
        filename: 'tomato.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);

    expect(res.body.data.photoUrl).toMatch(/^\/api\/v1\/uploads\/listings\/.+\.jpg$/);
  });

  it('rejects a non-image file', async () => {
    const { c } = await registerAndLogin(FARMER);

    await c
      .post('/listings')
      .field(LISTING_FIELDS)
      .attach('photo', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });

  it('rejects a photo over the size limit', async () => {
    const { c } = await registerAndLogin(FARMER);

    await c
      .post('/listings')
      .field(LISTING_FIELDS)
      .attach('photo', Buffer.alloc(MAX_PHOTO_SIZE_MB * 1024 * 1024 + 1), {
        filename: 'huge.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
  });

  it('rejects a buyer', async () => {
    const buyer = await seedAndLogin({ role: 'buyer', verificationStatus: 'approved' });
    await buyer.post('/listings').field(LISTING_FIELDS).expect(403);
  });

  it('rejects an unknown crop', async () => {
    const { c } = await registerAndLogin(FARMER);
    await c
      .post('/listings')
      .field({ ...LISTING_FIELDS, cropKey: 'mango' })
      .expect(400);
  });

  it('rejects a non-positive quantity', async () => {
    const { c } = await registerAndLogin(FARMER);
    await c
      .post('/listings')
      .field({ ...LISTING_FIELDS, quantityKg: '0' })
      .expect(400);
  });
});

describe('GET /listings (browse)', () => {
  it('requires authentication', async () => {
    await noJar('get', '/listings').expect(401);
  });

  it('lists active listings and respects filters', async () => {
    const { c: farmer } = await registerAndLogin(FARMER);
    await farmer.post('/listings').field(LISTING_FIELDS).expect(201);
    await farmer
      .post('/listings')
      .field({ ...LISTING_FIELDS, cropKey: 'onion' })
      .expect(201);

    const buyer = await seedAndLogin({ role: 'buyer', verificationStatus: 'approved' });

    const all = await buyer.get('/listings').expect(200);
    expect(all.body.data.items).toHaveLength(2);

    const onlyOnion = await buyer.get('/listings?crop=onion').expect(200);
    expect(onlyOnion.body.data.items).toHaveLength(1);
    expect(onlyOnion.body.data.items[0].cropKey).toBe('onion');

    const wrongDistrict = await buyer.get('/listings?district=Madurai').expect(200);
    expect(wrongDistrict.body.data.items).toHaveLength(0);
  });

  it('does not show a withdrawn listing', async () => {
    const { c: farmer } = await registerAndLogin(FARMER);
    const created = await farmer.post('/listings').field(LISTING_FIELDS).expect(201);

    await farmer.patch(`/listings/${created.body.data.id}/withdraw`).expect(200);

    const buyer = await seedAndLogin({ role: 'buyer', verificationStatus: 'approved' });
    const res = await buyer.get('/listings').expect(200);
    expect(res.body.data.items).toHaveLength(0);
  });
});

describe('GET /listings/mine', () => {
  it('rejects a buyer', async () => {
    const buyer = await seedAndLogin({ role: 'buyer', verificationStatus: 'approved' });
    await buyer.get('/listings/mine').expect(403);
  });

  it("returns the farmer's own listings with a pending-offer count", async () => {
    const { c: farmer } = await registerAndLogin(FARMER);
    const created = await farmer.post('/listings').field(LISTING_FIELDS).expect(201);

    const buyer = await seedAndLogin({ role: 'buyer', verificationStatus: 'approved' });
    await buyer
      .post(`/listings/${created.body.data.id}/offers`)
      .send({ quantityKg: 50, offeredPricePerKg: 20 })
      .expect(201);

    const res = await farmer.get('/listings/mine').expect(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].offerCount).toBe(1);
  });
});

describe('GET /listings/:id', () => {
  it('returns the listing detail', async () => {
    const { c: farmer } = await registerAndLogin(FARMER);
    const created = await farmer.post('/listings').field(LISTING_FIELDS).expect(201);

    const buyer = await seedAndLogin({ role: 'buyer', verificationStatus: 'approved' });
    const res = await buyer.get(`/listings/${created.body.data.id}`).expect(200);
    expect(res.body.data.id).toBe(created.body.data.id);
  });

  it('404s for an unknown listing', async () => {
    const { c } = await registerAndLogin(FARMER);
    await c.get('/listings/507f1f77bcf86cd799439011').expect(404);
  });
});

describe('PATCH /listings/:id/withdraw', () => {
  it('lets the owning farmer withdraw their listing', async () => {
    const { c: farmer } = await registerAndLogin(FARMER);
    const created = await farmer.post('/listings').field(LISTING_FIELDS).expect(201);

    const res = await farmer.patch(`/listings/${created.body.data.id}/withdraw`).expect(200);
    expect(res.body.data.status).toBe('withdrawn');
  });

  it('rejects a farmer who does not own the listing', async () => {
    const { c: owner } = await registerAndLogin(FARMER);
    const created = await owner.post('/listings').field(LISTING_FIELDS).expect(201);

    const { c: otherFarmer } = await registerAndLogin({
      name: 'Other Farmer',
      phone: '9876500002',
      password: 'farmfair1',
      role: 'farmer',
      district: 'Madurai',
      crops: ['onion'],
    });
    await otherFarmer.patch(`/listings/${created.body.data.id}/withdraw`).expect(403);
  });

  it('rejects withdrawing an already-withdrawn listing', async () => {
    const { c: farmer } = await registerAndLogin(FARMER);
    const created = await farmer.post('/listings').field(LISTING_FIELDS).expect(201);

    await farmer.patch(`/listings/${created.body.data.id}/withdraw`).expect(200);
    await farmer.patch(`/listings/${created.body.data.id}/withdraw`).expect(409);
  });
});
