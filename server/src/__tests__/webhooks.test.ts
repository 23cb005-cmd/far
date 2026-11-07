import request from 'supertest';
import Twilio from 'twilio';
import { env } from '../config/env';
import { InboundMessage } from '../models/InboundMessage';
import { api, app, seedAndLogin, seedUser } from './helpers';

function signedRequest(params: Record<string, string>) {
  const url = `${env.PUBLIC_BASE_URL}${api('/webhooks/twilio/whatsapp')}`;
  const signature = Twilio.getExpectedTwilioSignature(env.TWILIO_AUTH_TOKEN!, url, params);
  return request(app())
    .post(api('/webhooks/twilio/whatsapp'))
    .type('form')
    .set('X-Twilio-Signature', signature)
    .send(params);
}

describe('POST /webhooks/twilio/whatsapp', () => {
  it('rejects an invalid signature', async () => {
    const res = await request(app())
      .post(api('/webhooks/twilio/whatsapp'))
      .type('form')
      .set('X-Twilio-Signature', 'not-a-real-signature')
      .send({ From: 'whatsapp:+919876543210', Body: 'HELP', MessageSid: 'SM-bad-sig' });
    expect(res.status).toBe(403);
  });

  it('replies with a registration prompt for an unknown number', async () => {
    const res = await signedRequest({
      From: 'whatsapp:+919000099999',
      Body: 'HELP',
      MessageSid: 'SM-unknown-1',
    });
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/register/i);
  });

  it('processes a known farmer and logs the inbound message', async () => {
    const farmer = await seedUser({ phone: '+919000000071' });
    const res = await signedRequest({
      From: `whatsapp:${farmer.phone}`,
      Body: 'HELP',
      MessageSid: 'SM-help-1',
    });
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/SELL/);

    const logged = await InboundMessage.findOne({ messageSid: 'SM-help-1' }).exec();
    expect(logged?.outcome).toBe('ok');
  });

  it('ignores a duplicate MessageSid rather than processing it twice', async () => {
    const farmer = await seedUser({ phone: '+919000000072' });
    const params = { From: `whatsapp:${farmer.phone}`, Body: 'HELP', MessageSid: 'SM-dup-1' };

    await signedRequest(params).expect(200);
    const countAfterFirst = await InboundMessage.countDocuments();

    await signedRequest(params).expect(200);
    const countAfterSecond = await InboundMessage.countDocuments();

    expect(countAfterSecond).toBe(countAfterFirst);
  });

  it('claims a MessageSid before concurrent retries can process it twice', async () => {
    const farmer = await seedUser({ phone: '+919000000075' });
    const params = { From: `whatsapp:${farmer.phone}`, Body: 'HELP', MessageSid: 'SM-dup-race-1' };

    const responses = await Promise.all([signedRequest(params), signedRequest(params)]);

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(await InboundMessage.countDocuments({ messageSid: params.MessageSid })).toBe(1);
  });
});

describe('GET /admin/bot-messages', () => {
  it('rejects a non-admin', async () => {
    const buyer = await seedAndLogin({ role: 'buyer' });
    await buyer.get('/admin/bot-messages').expect(403);
  });

  it('lets an admin list recent inbound messages', async () => {
    const farmer = await seedUser({ phone: '+919000000073' });
    await signedRequest({
      From: `whatsapp:${farmer.phone}`,
      Body: 'HELP',
      MessageSid: 'SM-admin-list-1',
    }).expect(200);

    const admin = await seedAndLogin({ role: 'admin', phone: '+919000000074' });
    const res = await admin.get('/admin/bot-messages').expect(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });
});
