import { toWhatsAppAddress } from './client';

describe('toWhatsAppAddress', () => {
  it('adds the WhatsApp scheme when it is missing', () => {
    expect(toWhatsAppAddress('+14155238886')).toBe('whatsapp:+14155238886');
  });

  it('does not duplicate or preserve casing in the WhatsApp scheme', () => {
    expect(toWhatsAppAddress(' WHATSAPP:+14155238886 ')).toBe('whatsapp:+14155238886');
  });
});
