import {
  MAX_LISTING_QUANTITY_KG,
  MAX_PRICE_PER_KG,
  MIN_LISTING_QUANTITY_KG,
  MIN_PRICE_PER_KG,
  getCropName,
  type District,
  type Language,
} from '@farmfair/shared';
import { env } from '../config/env';
import { BotSession, type BotSessionDocument } from '../models/BotSession';
import { User, type UserDocument } from '../models/User';
import { parseBotCommand, type BotCommand } from '../bot/parser';
import { createListing, getMyListings } from './listings';
import { declineOffer, findOfferByCode, getPendingOffersForFarmer } from './offers';
import { acceptOffer, confirmPickup, findOrderByCode, getMyOrders } from './orders';
import { checkFairPrice, getTodayModalPrice, getTodayPrices, round2 } from './mandiPrices';
import { recordAudit } from './audit';
import { isAppError } from '../utils/AppError';

const SESSION_TTL_MS = 10 * 60 * 1000;

interface SellDraft {
  cropKey: string;
  quantityKg: number;
  pricePerKg: number;
}

async function stageSession(phone: string, pendingAction: string, payload: object): Promise<void> {
  await BotSession.findOneAndUpdate(
    { phone },
    { phone, pendingAction, payload, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    { upsert: true },
  );
}

// ---------------------------------------------------------------------------
// Static, bilingual copy
// ---------------------------------------------------------------------------

function helpReply(language: Language): string {
  return language === 'ta'
    ? [
        'கட்டளைகள்:',
        'விலை <பயிர்> - இன்றைய விலை',
        'விற்க <பயிர்> <கிலோ> [விலை] - பட்டியலிடு',
        'பட்டியல் - எனது பட்டியல்கள்',
        'சலுகைகள் - நிலுவையிலுள்ள சலுகைகள்',
        'ஏற்க/நிராகரி <code> - சலுகையை நிர்வகி',
        'ஆர்டர் - எனது ஆர்டர்கள்',
        'உறுதி <code> - எடுப்பை உறுதிப்படுத்து',
        'STOP/START - அறிவிப்புகளை நிறுத்து/தொடங்கு',
        'LANG EN/TA - மொழியை மாற்று',
      ].join('\n')
    : [
        'Commands:',
        "PRICE <crop> - today's price",
        'SELL <crop> <kg> [price] - list a crop',
        'LISTINGS - your listings',
        'OFFERS - pending offers',
        'ACCEPT/REJECT <code> - manage an offer',
        'ORDERS - your orders',
        'CONFIRM <code> - confirm pickup',
        'STOP/START - stop/start alerts',
        'LANG EN/TA - switch language',
      ].join('\n');
}

function unknownUserReply(): string {
  return (
    `We don't recognise this number. Register as a farmer at ${env.CLIENT_URL}/register, ` +
    'then message us again.\n' +
    `இந்த எண் பதிவு செய்யப்படவில்லை. ${env.CLIENT_URL}/register இல் விவசாயியாகப் பதிவு செய்யவும்.`
  );
}

function notFarmerReply(language: Language): string {
  return language === 'ta'
    ? `இந்த WhatsApp எண் விவசாயிகளுக்கு மட்டுமே. வாங்குபவர்கள்/நிர்வாகிகள் வெப் ஆப்பைப் பயன்படுத்தவும்: ${env.CLIENT_URL}`
    : `This WhatsApp number is for farmers only. Buyers and admins, please use the web app: ${env.CLIENT_URL}`;
}

function unknownCommandReply(language: Language): string {
  return (
    (language === 'ta' ? 'புரியவில்லை.\n\n' : "I didn't understand that.\n\n") + helpReply(language)
  );
}

function unknownCropReply(language: Language): string {
  return language === 'ta' ? 'அந்தப் பயிர் தெரியவில்லை.' : "I don't recognise that crop.";
}

function sellInvalidReply(language: Language): string {
  return language === 'ta'
    ? 'சரியான முறை: விற்க <பயிர்> <கிலோ> [விலை], எ.கா. விற்க தக்காளி 500 20'
    : 'Format: SELL <crop> <kg> [price], e.g. SELL tomato 500 20';
}

function noConfirmationPendingReply(language: Language): string {
  return language === 'ta' ? 'உறுதிப்படுத்த எதுவும் இல்லை.' : 'Nothing to confirm right now.';
}

function cancelledReply(language: Language): string {
  return language === 'ta' ? 'ரத்து செய்யப்பட்டது.' : 'Cancelled.';
}

function errorReply(language: Language, error: unknown): string {
  const message = isAppError(error)
    ? error.message
    : language === 'ta'
      ? 'ஏதோ தவறாகிவிட்டது.'
      : 'Something went wrong.';
  return `⚠️ ${message}`;
}

function offerOrOrderNotFoundReply(language: Language, kind: 'offer' | 'order'): string {
  if (kind === 'offer') {
    return language === 'ta'
      ? 'அந்தக் குறியீட்டில் நிலுவையிலுள்ள சலுகை இல்லை.'
      : "That code doesn't match a pending offer of yours.";
  }
  return language === 'ta'
    ? 'அந்தக் குறியீட்டில் ஆர்டர் இல்லை.'
    : "That code doesn't match one of your orders.";
}

// ---------------------------------------------------------------------------
// Read-only commands
// ---------------------------------------------------------------------------

async function handlePrice(user: UserDocument, cropKey: string): Promise<string> {
  const { crops } = await getTodayPrices(user.district as District, [cropKey]);
  const crop = crops[0];
  const cropName = getCropName(cropKey, user.language);

  if (!crop) {
    return user.language === 'ta'
      ? `இன்று ${cropName}க்கு விலை தரவு இல்லை.`
      : `No price data for ${cropName} today.`;
  }

  const change =
    crop.changePercent === undefined
      ? ''
      : ` ${crop.changePercent >= 0 ? '📈' : '📉'} ${crop.changePercent > 0 ? '+' : ''}${crop.changePercent}%`;

  return user.language === 'ta'
    ? `${cropName} (${user.district}): ₹${crop.modalPrice}/கிலோ${change}\nசந்தைகள்: ${crop.markets.join(', ')}`
    : `${cropName} (${user.district}): ₹${crop.modalPrice}/kg${change}\nMarkets: ${crop.markets.join(', ')}`;
}

async function handleListings(user: UserDocument): Promise<string> {
  const { items } = await getMyListings(user, 1, 5);
  if (items.length === 0) {
    return user.language === 'ta' ? 'உங்களிடம் பட்டியல்கள் இல்லை.' : "You don't have any listings.";
  }
  return items
    .map((l) => {
      const offers = l.offerCount ?? 0;
      return user.language === 'ta'
        ? `${getCropName(l.cropKey, 'ta')} - ${l.quantityKg}கிலோ - ${l.status} (${offers} சலுகைகள்)`
        : `${getCropName(l.cropKey, 'en')} - ${l.quantityKg}kg - ${l.status} (${offers} offers)`;
    })
    .join('\n');
}

async function handleOffers(user: UserDocument): Promise<string> {
  const offers = await getPendingOffersForFarmer(user, 5);
  if (offers.length === 0) {
    return user.language === 'ta' ? 'நிலுவையிலுள்ள சலுகைகள் இல்லை.' : 'No pending offers.';
  }
  const lines = offers.map(
    (o) =>
      `${o.code}: ${getCropName(o.listing.cropKey, user.language)} ₹${o.offeredPricePerKg}/kg x ${o.quantityKg}kg`,
  );
  const footer =
    user.language === 'ta' ? 'ஏற்க <code> / நிராகரி <code>' : 'ACCEPT <code> or REJECT <code>';
  return [...lines, '', footer].join('\n');
}

async function handleOrders(user: UserDocument): Promise<string> {
  const { items } = await getMyOrders(user, 1, 5);
  if (items.length === 0) {
    return user.language === 'ta' ? 'ஆர்டர்கள் இல்லை.' : "You don't have any orders.";
  }
  return items
    .map((o) => `${o.code}: ${getCropName(o.cropKey, user.language)} - ${o.status}`)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Commands that stage a confirmation
// ---------------------------------------------------------------------------

async function handleSellDraft(
  user: UserDocument,
  command: Extract<BotCommand, { type: 'sell' }>,
): Promise<string> {
  if (
    command.quantityKg < MIN_LISTING_QUANTITY_KG ||
    command.quantityKg > MAX_LISTING_QUANTITY_KG
  ) {
    return sellInvalidReply(user.language);
  }

  let pricePerKg = command.pricePerKg;
  if (pricePerKg === undefined) {
    const today = await getTodayModalPrice(user.district as District, command.cropKey);
    if (!today) {
      return user.language === 'ta'
        ? 'இன்றைய சந்தை விலை இல்லை. விலையைச் சேர்க்கவும்: விற்க <பயிர்> <கிலோ> <விலை>'
        : 'No market price today. Please include a price: SELL <crop> <kg> <price>';
    }
    pricePerKg = today.modalPrice;
  }
  if (pricePerKg < MIN_PRICE_PER_KG || pricePerKg > MAX_PRICE_PER_KG) {
    return sellInvalidReply(user.language);
  }

  let fairnessLine = '';
  try {
    const fair = await checkFairPrice(user.district as District, command.cropKey, pricePerKg);
    const verdictText =
      fair.verdict === 'fair'
        ? user.language === 'ta'
          ? 'நியாயமான விலை'
          : 'a fair price'
        : fair.verdict === 'below_market'
          ? user.language === 'ta'
            ? 'சந்தை விலையை விடக் குறைவு'
            : 'below market'
          : user.language === 'ta'
            ? 'சந்தை விலையை விட அதிகம்'
            : 'above market';
    fairnessLine =
      user.language === 'ta'
        ? `\nசந்தையுடன் ஒப்பிடின்: ${verdictText}`
        : `\nVs market: ${verdictText}`;
  } catch {
    // No market price to compare against today; the summary just omits it.
  }

  const draft: SellDraft = { cropKey: command.cropKey, quantityKg: command.quantityKg, pricePerKg };
  await stageSession(user.phone, 'sell_confirm', draft);

  const cropName = getCropName(command.cropKey, user.language);
  return user.language === 'ta'
    ? `${cropName}, ${command.quantityKg} கிலோ, கிலோ ஒன்றுக்கு ₹${pricePerKg}.${fairnessLine}\n\nவெளியிட ஆம், ரத்து செய்ய இல்லை என்று பதிலளிக்கவும்.`
    : `${cropName}, ${command.quantityKg} kg at ₹${pricePerKg}/kg.${fairnessLine}\n\nReply YES to publish this listing, or NO to cancel.`;
}

async function handleAcceptStart(user: UserDocument, code: string): Promise<string> {
  const offer = await findOfferByCode(code);
  if (!offer || String(offer.listing.farmer) !== String(user._id) || offer.status !== 'pending') {
    return offerOrOrderNotFoundReply(user.language, 'offer');
  }

  const total = round2(offer.quantityKg * offer.offeredPricePerKg);
  await stageSession(user.phone, 'accept_confirm', { offerId: String(offer._id) });

  return user.language === 'ta'
    ? `${offer.buyer.name}: ${offer.quantityKg}கிலோ, கிலோ ஒன்றுக்கு ₹${offer.offeredPricePerKg} = ₹${total} மொத்தம். ஏற்க ஆம், தவிர்க்க இல்லை.`
    : `From ${offer.buyer.name}: ${offer.quantityKg} kg at ₹${offer.offeredPricePerKg}/kg = ₹${total} total. Reply YES to accept, NO to skip.`;
}

async function handleConfirmStart(user: UserDocument, code: string): Promise<string> {
  const order = await findOrderByCode(code);
  if (!order || String(order.farmer._id) !== String(user._id)) {
    return offerOrOrderNotFoundReply(user.language, 'order');
  }
  if (order.status !== 'paid') {
    return user.language === 'ta'
      ? 'இந்த ஆர்டர் இன்னும் எடுப்புக்குத் தயாராக இல்லை.'
      : 'This order is not ready for pickup confirmation yet.';
  }

  await stageSession(user.phone, 'confirm_order_confirm', { orderId: String(order._id) });

  const cropName = getCropName(order.cropKey, user.language);
  return user.language === 'ta'
    ? `${cropName} ஆர்டரின் எடுப்பை உறுதிப்படுத்தவா? ஆம்/இல்லை.`
    : `Confirm pickup for your ${cropName} order? YES/NO.`;
}

// ---------------------------------------------------------------------------
// Immediate (non-confirming) actions
// ---------------------------------------------------------------------------

async function handleReject(user: UserDocument, code: string): Promise<string> {
  const offer = await findOfferByCode(code);
  if (!offer || String(offer.listing.farmer) !== String(user._id) || offer.status !== 'pending') {
    return offerOrOrderNotFoundReply(user.language, 'offer');
  }

  const updated = await declineOffer(user, String(offer._id), {});
  await recordAudit({
    actor: user._id,
    action: 'bot.command',
    entity: 'Offer',
    entityId: updated.id,
    metadata: { command: 'reject' },
    channel: 'whatsapp',
  });
  return user.language === 'ta' ? '❌ சலுகை நிராகரிக்கப்பட்டது.' : '❌ Offer rejected.';
}

async function handleStop(user: UserDocument): Promise<string> {
  user.notifyWhatsApp = false;
  await user.save();
  await recordAudit({
    actor: user._id,
    action: 'bot.command',
    metadata: { command: 'stop' },
    channel: 'whatsapp',
  });
  return user.language === 'ta'
    ? 'அறிவிப்புகள் நிறுத்தப்பட்டன. மீண்டும் தொடங்க START அனுப்பவும்.'
    : 'Alerts stopped. Send START to turn them back on.';
}

async function handleStart(user: UserDocument): Promise<string> {
  user.notifyWhatsApp = true;
  await user.save();
  await recordAudit({
    actor: user._id,
    action: 'bot.command',
    metadata: { command: 'start' },
    channel: 'whatsapp',
  });
  return user.language === 'ta' ? 'அறிவிப்புகள் இயக்கப்பட்டன.' : 'Alerts turned on.';
}

async function handleLang(user: UserDocument, language: Language): Promise<string> {
  user.language = language;
  await user.save();
  await recordAudit({
    actor: user._id,
    action: 'bot.command',
    metadata: { command: 'lang', language },
    channel: 'whatsapp',
  });
  return language === 'ta' ? 'மொழி தமிழாக மாற்றப்பட்டது.' : 'Language set to English.';
}

// ---------------------------------------------------------------------------
// YES/NO: resolve whatever is pending
// ---------------------------------------------------------------------------

async function handleConfirmation(
  user: UserDocument,
  session: BotSessionDocument | null,
  isYes: boolean,
): Promise<string> {
  if (!session) return noConfirmationPendingReply(user.language);
  await BotSession.deleteOne({ _id: session._id });

  if (!isYes) return cancelledReply(user.language);

  switch (session.pendingAction) {
    case 'sell_confirm': {
      const draft = session.payload as unknown as SellDraft;
      const readyDate = new Date();
      readyDate.setDate(readyDate.getDate() + 2);

      const listing = await createListing(user, {
        cropKey: draft.cropKey,
        grade: 'B',
        quantityKg: draft.quantityKg,
        pricePerKg: draft.pricePerKg,
        readyDate,
      });
      await recordAudit({
        actor: user._id,
        action: 'bot.command',
        entity: 'Listing',
        entityId: listing.id,
        metadata: { command: 'sell' },
        channel: 'whatsapp',
      });
      const cropName = getCropName(draft.cropKey, user.language);
      return user.language === 'ta'
        ? `✅ பட்டியலிடப்பட்டது! ${cropName}, ${draft.quantityKg} கிலோ.`
        : `✅ Listed! ${cropName}, ${draft.quantityKg} kg.`;
    }

    case 'accept_confirm': {
      const { offerId } = session.payload as unknown as { offerId: string };
      try {
        const order = await acceptOffer(user, offerId);
        await recordAudit({
          actor: user._id,
          action: 'bot.command',
          entity: 'Order',
          entityId: order.id,
          metadata: { command: 'accept' },
          channel: 'whatsapp',
        });
        return user.language === 'ta'
          ? `✅ ஏற்றுக்கொள்ளப்பட்டது. ஆர்டர் குறியீடு: ${order.code}`
          : `✅ Accepted. Order code: ${order.code}`;
      } catch (error) {
        return errorReply(user.language, error);
      }
    }

    case 'confirm_order_confirm': {
      const { orderId } = session.payload as unknown as { orderId: string };
      try {
        const order = await confirmPickup(user, orderId);
        await recordAudit({
          actor: user._id,
          action: 'bot.command',
          entity: 'Order',
          entityId: order.id,
          metadata: { command: 'confirm' },
          channel: 'whatsapp',
        });
        if (order.status === 'completed') {
          return user.language === 'ta'
            ? '✅ ஆர்டர் முடிந்தது, பணம் விடுவிக்கப்பட்டது.'
            : '✅ Order completed, payment released.';
        }
        return user.language === 'ta'
          ? '✅ உறுதிப்படுத்தப்பட்டது. மற்றொரு தரப்பு உறுதிப்படுத்த காத்திருக்கிறோம்.'
          : '✅ Confirmed. Waiting on the other party.';
      } catch (error) {
        return errorReply(user.language, error);
      }
    }

    default:
      return unknownCommandReply(user.language);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Handle one inbound WhatsApp message and return the reply text.
 *
 * Reuses the exact same listing/offer/order services the web app calls, so
 * ownership and permission checks apply identically through the bot - there
 * is no separate authorization path to keep in sync.
 */
export async function handleInboundMessage(phone: string, body: string): Promise<string> {
  const user = await User.findOne({ phone }).exec();
  if (!user) return unknownUserReply();
  if (user.role !== 'farmer') return notFarmerReply(user.language);

  const command = parseBotCommand(body);
  const stored = await BotSession.findOne({ phone }).exec();

  // Mongo's TTL monitor only sweeps expired documents about once a minute
  // (see the same caveat on `OtpCode`), so a session past its `expiresAt`
  // may still be sitting in the collection when this runs.
  const session = stored && stored.expiresAt.getTime() > Date.now() ? stored : null;
  if (stored && !session) {
    await BotSession.deleteOne({ _id: stored._id });
  }

  if (command.type === 'yes' || command.type === 'no') {
    return handleConfirmation(user, session, command.type === 'yes');
  }

  // Any other recognised command replaces whatever confirmation was pending;
  // switching topics should not leave a stale YES/NO able to fire later.
  if (session && command.type !== 'unknown') {
    await BotSession.deleteOne({ _id: session._id });
  }

  switch (command.type) {
    case 'help':
      return helpReply(user.language);
    case 'price':
      return handlePrice(user, command.cropKey);
    case 'price_unknown_crop':
      return unknownCropReply(user.language);
    case 'sell':
      return handleSellDraft(user, command);
    case 'sell_unknown_crop':
      return unknownCropReply(user.language);
    case 'sell_invalid':
      return sellInvalidReply(user.language);
    case 'listings':
      return handleListings(user);
    case 'offers':
      return handleOffers(user);
    case 'orders':
      return handleOrders(user);
    case 'accept':
      return handleAcceptStart(user, command.code);
    case 'reject':
      return handleReject(user, command.code);
    case 'confirm':
      return handleConfirmStart(user, command.code);
    case 'stop':
      return handleStop(user);
    case 'start':
      return handleStart(user);
    case 'lang':
      return handleLang(user, command.language);
    case 'unknown':
    default:
      return unknownCommandReply(user.language);
  }
}
