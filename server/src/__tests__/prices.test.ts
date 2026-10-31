import { FARMER, client, noJar, registerAndLogin } from './helpers';

describe('GET /prices/today', () => {
  it('requires authentication', async () => {
    await noJar('get', '/prices/today').expect(401);
  });

  it("defaults to the signed-in farmer's district and crops", async () => {
    const { c } = await registerAndLogin(FARMER);

    const res = await c.get('/prices/today').expect(200);

    expect(res.body.data.district).toBe(FARMER.district);
    expect(res.body.data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const cropKeys = res.body.data.crops.map((p: { cropKey: string }) => p.cropKey);
    expect(cropKeys.sort()).toEqual([...FARMER.crops].sort());

    for (const crop of res.body.data.crops) {
      expect(crop.source).toBe('generated');
      expect(crop.unit).toBe('kg');
      expect(crop.minPrice).toBeLessThanOrEqual(crop.modalPrice);
      expect(crop.modalPrice).toBeLessThanOrEqual(crop.maxPrice);
      expect(Array.isArray(crop.markets)).toBe(true);
    }
  });

  it('accepts a district override and returns every crop for a buyer', async () => {
    const { c } = await registerAndLogin({
      name: 'Priya R',
      phone: '9876501234',
      password: 'farmfair1',
      role: 'buyer',
      district: 'Coimbatore',
      business: { name: 'Priya Traders' },
    });

    const res = await c.get('/prices/today?district=Madurai').expect(200);

    expect(res.body.data.district).toBe('Madurai');
    expect(res.body.data.crops.length).toBeGreaterThan(1);
  });

  it('rejects an unknown district', async () => {
    const { c } = await registerAndLogin(FARMER);
    await c.get('/prices/today?district=Not-A-District').expect(400);
  });

  it('is stable across repeated requests on the same day', async () => {
    const { c } = await registerAndLogin(FARMER);

    const first = await c.get('/prices/today').expect(200);
    const second = await c.get('/prices/today').expect(200);

    expect(second.body.data.crops).toEqual(first.body.data.crops);
  });
});

describe('GET /prices/trend', () => {
  it('requires authentication', async () => {
    await noJar('get', '/prices/trend?district=Salem&crop=tomato').expect(401);
  });

  it('returns the default 30-day window, oldest first', async () => {
    const { c } = await registerAndLogin(FARMER);

    const res = await c.get('/prices/trend?district=Salem&crop=tomato').expect(200);

    expect(res.body.data.district).toBe('Salem');
    expect(res.body.data.cropKey).toBe('tomato');
    expect(res.body.data.source).toBe('generated');
    expect(res.body.data.points).toHaveLength(30);

    const dates = res.body.data.points.map((p: { date: string }) => p.date);
    expect(dates).toEqual([...dates].sort());
  });

  it('honours a custom day count', async () => {
    const { c } = await registerAndLogin(FARMER);

    const res = await c.get('/prices/trend?district=Salem&crop=tomato&days=5').expect(200);
    expect(res.body.data.points).toHaveLength(5);
  });

  it('rejects an unknown crop', async () => {
    const { c } = await registerAndLogin(FARMER);
    await c.get('/prices/trend?district=Salem&crop=mango').expect(400);
  });

  it('rejects a day count outside the allowed range', async () => {
    const { c } = await registerAndLogin(FARMER);
    await c.get('/prices/trend?district=Salem&crop=tomato&days=1').expect(400);
    await c.get('/prices/trend?district=Salem&crop=tomato&days=9999').expect(400);
  });
});

describe('POST /prices/fair-check', () => {
  it('requires authentication', async () => {
    await noJar('post', '/prices/fair-check', {}).expect(401);
  });

  it('requires a matching CSRF token', async () => {
    const c = await client();
    await c
      .post('/auth/register')
      .send({ ...FARMER, phone: '9876500001' })
      .expect(201);

    await c
      .postRaw('/prices/fair-check')
      .send({ district: 'Salem', crop: 'tomato', price: 20 })
      .expect(403);
  });

  it('calls a price at the modal rate "fair"', async () => {
    const { c } = await registerAndLogin(FARMER);

    const today = await c.get('/prices/today').expect(200);
    const tomato = today.body.data.crops.find((p: { cropKey: string }) => p.cropKey === 'tomato');

    const res = await c
      .post('/prices/fair-check')
      .send({ district: FARMER.district, crop: 'tomato', price: tomato.modalPrice })
      .expect(200);

    expect(res.body.data.verdict).toBe('fair');
    expect(res.body.data.diffPercent).toBe(0);
  });

  it('calls a very low price "below_market" and a very high one "above_market"', async () => {
    const { c } = await registerAndLogin(FARMER);

    const today = await c.get('/prices/today').expect(200);
    const tomato = today.body.data.crops.find((p: { cropKey: string }) => p.cropKey === 'tomato');

    const low = await c
      .post('/prices/fair-check')
      .send({ district: FARMER.district, crop: 'tomato', price: tomato.modalPrice * 0.5 })
      .expect(200);
    expect(low.body.data.verdict).toBe('below_market');

    const high = await c
      .post('/prices/fair-check')
      .send({ district: FARMER.district, crop: 'tomato', price: tomato.modalPrice * 1.5 })
      .expect(200);
    expect(high.body.data.verdict).toBe('above_market');
  });

  it('rejects a non-positive price', async () => {
    const { c } = await registerAndLogin(FARMER);
    await c
      .post('/prices/fair-check')
      .send({ district: FARMER.district, crop: 'tomato', price: 0 })
      .expect(400);
  });

  it('rejects an unknown crop', async () => {
    const { c } = await registerAndLogin(FARMER);
    await c
      .post('/prices/fair-check')
      .send({ district: FARMER.district, crop: 'mango', price: 20 })
      .expect(400);
  });
});
