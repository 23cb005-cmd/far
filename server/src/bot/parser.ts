import { CROPS, type Language } from '@farmfair/shared';

export type BotCommand =
  | { type: 'help' }
  | { type: 'price'; cropKey: string }
  | { type: 'price_unknown_crop' }
  | { type: 'sell'; cropKey: string; quantityKg: number; pricePerKg?: number }
  | { type: 'sell_unknown_crop' }
  | { type: 'sell_invalid' }
  | { type: 'yes' }
  | { type: 'no' }
  | { type: 'listings' }
  | { type: 'offers' }
  | { type: 'accept'; code: string }
  | { type: 'reject'; code: string }
  | { type: 'orders' }
  | { type: 'confirm'; code: string }
  | { type: 'stop' }
  | { type: 'start' }
  | { type: 'lang'; language: Language }
  | { type: 'unknown' };

type CommandKind =
  | 'help'
  | 'price'
  | 'sell'
  | 'yes'
  | 'no'
  | 'listings'
  | 'offers'
  | 'accept'
  | 'reject'
  | 'orders'
  | 'confirm'
  | 'stop'
  | 'start'
  | 'lang';

/**
 * Every keyword that selects a command, English and Tamil together, so the
 * lookup below is one case-insensitive map rather than a chain of ifs.
 * Includes a few common spelling variants a farmer might actually type.
 */
const COMMAND_KEYWORDS: Record<string, CommandKind> = {
  help: 'help',
  menu: 'help',
  hi: 'help',
  hello: 'help',
  உதவி: 'help',
  பட்டி: 'help',

  price: 'price',
  prices: 'price',
  rate: 'price',
  விலை: 'price',

  sell: 'sell',
  list: 'sell',
  விற்க: 'sell',
  விறக: 'sell',

  yes: 'yes',
  y: 'yes',
  ok: 'yes',
  ஆம்: 'yes',
  ஆமா: 'yes',

  no: 'no',
  n: 'no',
  இல்லை: 'no',

  listings: 'listings',
  mylistings: 'listings',
  பட்டியல்: 'listings',

  offers: 'offers',
  offer: 'offers',
  சலுகைகள்: 'offers',
  சலுகை: 'offers',

  accept: 'accept',
  ஏற்க: 'accept',
  ஏற்று: 'accept',

  reject: 'reject',
  decline: 'reject',
  நிராகரி: 'reject',

  orders: 'orders',
  order: 'orders',
  ஆர்டர்: 'orders',
  ஆர்டர்கள்: 'orders',

  confirm: 'confirm',
  உறுதி: 'confirm',

  stop: 'stop',
  start: 'start',
  lang: 'lang',
};

function normaliseWhitespace(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

function cropKeyFromPhrase(phrase: string): string | undefined {
  const normalised = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalised) return undefined;
  const asKey = normalised.replace(/ /g, '_');

  for (const crop of CROPS) {
    if (crop.key === asKey || crop.en.toLowerCase() === normalised || crop.ta === phrase.trim()) {
      return crop.key;
    }
  }
  return undefined;
}

function parseNumber(token: string | undefined): number | undefined {
  if (!token) return undefined;
  const value = Number(token.replace(',', '.'));
  return Number.isFinite(value) ? value : undefined;
}

/** Everything up to (not including) the first purely numeric token. */
function splitCropFromNumbers(tokens: string[]): { cropTokens: string[]; numberTokens: string[] } {
  const firstNumberIndex = tokens.findIndex((t) => parseNumber(t) !== undefined);
  if (firstNumberIndex === -1) return { cropTokens: tokens, numberTokens: [] };
  return {
    cropTokens: tokens.slice(0, firstNumberIndex),
    numberTokens: tokens.slice(firstNumberIndex),
  };
}

function parseLanguage(token: string | undefined): Language | undefined {
  if (!token) return undefined;
  const normalised = token.trim().toLowerCase();
  if (['en', 'english', 'ஆங்கிலம்'].includes(normalised)) return 'en';
  if (['ta', 'tamil', 'தமிழ்'].includes(normalised)) return 'ta';
  return undefined;
}

/**
 * Parse one inbound WhatsApp message into a command.
 *
 * Pure and side-effect free: no database access, so every branch is cheap to
 * exercise in a unit test. Tolerant of case, extra spaces, and either
 * language's keywords and crop names in the same message.
 */
export function parseBotCommand(raw: string): BotCommand {
  const message = normaliseWhitespace(raw);
  if (!message) return { type: 'unknown' };

  const tokens = message.split(' ');
  const keyword = COMMAND_KEYWORDS[tokens[0]!.toLowerCase()];
  const rest = tokens.slice(1);

  switch (keyword) {
    case 'help':
      return { type: 'help' };

    case 'yes':
      return { type: 'yes' };

    case 'no':
      return { type: 'no' };

    case 'listings':
      return { type: 'listings' };

    case 'offers':
      return { type: 'offers' };

    case 'orders':
      return { type: 'orders' };

    case 'stop':
      return { type: 'stop' };

    case 'start':
      return { type: 'start' };

    case 'price': {
      const cropKey = cropKeyFromPhrase(rest.join(' '));
      return cropKey ? { type: 'price', cropKey } : { type: 'price_unknown_crop' };
    }

    case 'accept': {
      const code = rest[0];
      return code ? { type: 'accept', code: code.toUpperCase() } : { type: 'unknown' };
    }

    case 'reject': {
      const code = rest[0];
      return code ? { type: 'reject', code: code.toUpperCase() } : { type: 'unknown' };
    }

    case 'confirm': {
      const code = rest[0];
      return code ? { type: 'confirm', code: code.toUpperCase() } : { type: 'unknown' };
    }

    case 'lang': {
      const language = parseLanguage(rest[0]);
      return language ? { type: 'lang', language } : { type: 'unknown' };
    }

    case 'sell': {
      const { cropTokens, numberTokens } = splitCropFromNumbers(rest);
      if (cropTokens.length === 0) return { type: 'sell_invalid' };

      const cropKey = cropKeyFromPhrase(cropTokens.join(' '));
      if (!cropKey) return { type: 'sell_unknown_crop' };

      const quantityKg = parseNumber(numberTokens[0]);
      if (quantityKg === undefined || quantityKg <= 0) return { type: 'sell_invalid' };

      if (numberTokens.length > 2) return { type: 'sell_invalid' };
      const pricePerKg = parseNumber(numberTokens[1]);
      if (numberTokens[1] !== undefined && pricePerKg === undefined) {
        return { type: 'sell_invalid' };
      }
      return {
        type: 'sell',
        cropKey,
        quantityKg,
        ...(pricePerKg !== undefined ? { pricePerKg } : {}),
      };
    }

    default:
      return { type: 'unknown' };
  }
}
