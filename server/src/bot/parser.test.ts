import { parseBotCommand } from './parser';

describe('parseBotCommand', () => {
  it('parses HELP and MENU, including Tamil, case-insensitively', () => {
    expect(parseBotCommand('help')).toEqual({ type: 'help' });
    expect(parseBotCommand('MENU')).toEqual({ type: 'help' });
    expect(parseBotCommand('உதவி')).toEqual({ type: 'help' });
  });

  it('parses PRICE with an English or Tamil crop name', () => {
    expect(parseBotCommand('PRICE tomato')).toEqual({ type: 'price', cropKey: 'tomato' });
    expect(parseBotCommand('price Tomato')).toEqual({ type: 'price', cropKey: 'tomato' });
    expect(parseBotCommand('விலை தக்காளி')).toEqual({ type: 'price', cropKey: 'tomato' });
  });

  it('matches a multi-word crop name', () => {
    expect(parseBotCommand('PRICE Ladies Finger')).toEqual({
      type: 'price',
      cropKey: 'ladies_finger',
    });
    expect(parseBotCommand('PRICE ladies_finger')).toEqual({
      type: 'price',
      cropKey: 'ladies_finger',
    });
  });

  it('reports an unrecognised crop on PRICE', () => {
    expect(parseBotCommand('PRICE dragonfruit')).toEqual({ type: 'price_unknown_crop' });
  });

  it('tolerates extra spaces', () => {
    expect(parseBotCommand('  PRICE   tomato  ')).toEqual({ type: 'price', cropKey: 'tomato' });
  });

  it('parses SELL with quantity only', () => {
    expect(parseBotCommand('SELL tomato 500')).toEqual({
      type: 'sell',
      cropKey: 'tomato',
      quantityKg: 500,
    });
  });

  it('parses SELL with quantity and price', () => {
    expect(parseBotCommand('SELL tomato 500 20')).toEqual({
      type: 'sell',
      cropKey: 'tomato',
      quantityKg: 500,
      pricePerKg: 20,
    });
  });

  it('parses the Tamil SELL example from the spec', () => {
    expect(parseBotCommand('விற்க தக்காளி 500 20')).toEqual({
      type: 'sell',
      cropKey: 'tomato',
      quantityKg: 500,
      pricePerKg: 20,
    });
  });

  it('parses SELL with a multi-word crop name', () => {
    expect(parseBotCommand('SELL Ladies Finger 100')).toEqual({
      type: 'sell',
      cropKey: 'ladies_finger',
      quantityKg: 100,
    });
  });

  it('rejects SELL with no quantity', () => {
    expect(parseBotCommand('SELL tomato')).toEqual({ type: 'sell_invalid' });
  });

  it('rejects SELL with a zero or negative quantity', () => {
    expect(parseBotCommand('SELL tomato 0')).toEqual({ type: 'sell_invalid' });
    expect(parseBotCommand('SELL tomato -5')).toEqual({ type: 'sell_invalid' });
  });

  it('rejects SELL with an invalid or extra price', () => {
    expect(parseBotCommand('SELL tomato 500 nope')).toEqual({ type: 'sell_invalid' });
    expect(parseBotCommand('SELL tomato 500 20 30')).toEqual({ type: 'sell_invalid' });
  });

  it('rejects SELL with an unrecognised crop', () => {
    expect(parseBotCommand('SELL dragonfruit 500')).toEqual({ type: 'sell_unknown_crop' });
  });

  it('rejects SELL with no crop at all', () => {
    expect(parseBotCommand('SELL 500')).toEqual({ type: 'sell_invalid' });
  });

  it('parses YES and NO in English and Tamil', () => {
    expect(parseBotCommand('YES')).toEqual({ type: 'yes' });
    expect(parseBotCommand('y')).toEqual({ type: 'yes' });
    expect(parseBotCommand('ஆம்')).toEqual({ type: 'yes' });
    expect(parseBotCommand('NO')).toEqual({ type: 'no' });
    expect(parseBotCommand('இல்லை')).toEqual({ type: 'no' });
  });

  it('parses LISTINGS, OFFERS and ORDERS in both languages', () => {
    expect(parseBotCommand('LISTINGS')).toEqual({ type: 'listings' });
    expect(parseBotCommand('பட்டியல்')).toEqual({ type: 'listings' });
    expect(parseBotCommand('OFFERS')).toEqual({ type: 'offers' });
    expect(parseBotCommand('சலுகைகள்')).toEqual({ type: 'offers' });
    expect(parseBotCommand('ORDERS')).toEqual({ type: 'orders' });
    expect(parseBotCommand('ஆர்டர்')).toEqual({ type: 'orders' });
  });

  it('parses ACCEPT and REJECT with a code, uppercased', () => {
    expect(parseBotCommand('ACCEPT tk4p9q')).toEqual({ type: 'accept', code: 'TK4P9Q' });
    expect(parseBotCommand('ஏற்க TK4P9Q')).toEqual({ type: 'accept', code: 'TK4P9Q' });
    expect(parseBotCommand('REJECT tk4p9q')).toEqual({ type: 'reject', code: 'TK4P9Q' });
    expect(parseBotCommand('நிராகரி TK4P9Q')).toEqual({ type: 'reject', code: 'TK4P9Q' });
  });

  it('treats ACCEPT/REJECT with no code as unknown', () => {
    expect(parseBotCommand('ACCEPT')).toEqual({ type: 'unknown' });
    expect(parseBotCommand('REJECT')).toEqual({ type: 'unknown' });
  });

  it('parses CONFIRM with a code', () => {
    expect(parseBotCommand('CONFIRM tk4p9q')).toEqual({ type: 'confirm', code: 'TK4P9Q' });
  });

  it('parses STOP and START', () => {
    expect(parseBotCommand('STOP')).toEqual({ type: 'stop' });
    expect(parseBotCommand('START')).toEqual({ type: 'start' });
  });

  it('parses LANG EN and LANG TA', () => {
    expect(parseBotCommand('LANG EN')).toEqual({ type: 'lang', language: 'en' });
    expect(parseBotCommand('LANG TA')).toEqual({ type: 'lang', language: 'ta' });
    expect(parseBotCommand('lang tamil')).toEqual({ type: 'lang', language: 'ta' });
  });

  it('treats an unrecognised LANG argument as unknown', () => {
    expect(parseBotCommand('LANG FR')).toEqual({ type: 'unknown' });
  });

  it('returns unknown for an empty or unrecognised message', () => {
    expect(parseBotCommand('')).toEqual({ type: 'unknown' });
    expect(parseBotCommand('   ')).toEqual({ type: 'unknown' });
    expect(parseBotCommand('banana dance')).toEqual({ type: 'unknown' });
  });
});
