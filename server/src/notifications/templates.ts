import { getCropName, type Language, type NotificationType } from '@farmfair/shared';

/** The render inputs each notification type needs, keyed by type. */
export interface NotificationParamsByType {
  offer_created: {
    cropKey: string;
    quantityKg: number;
    offeredPricePerKg: number;
    buyerName: string;
  };
  offer_declined: { cropKey: string };
  offer_accepted: { cropKey: string; totalAmount: number };
  order_paid: { cropKey: string };
  order_completed: { cropKey: string };
  order_cancelled: { cropKey: string; reason?: string };
  rating_received: { raterName: string; score: number };
  listing_expired: { cropKey: string };
  price_alert: {
    cropKey: string;
    district: string;
    changePercent: number;
    direction: 'up' | 'down';
  };
}

export interface RenderedNotification {
  title: string;
  message: string;
}

type Renderer<T extends NotificationType> = (
  params: NotificationParamsByType[T],
  language: Language,
) => RenderedNotification;

const crop = (cropKey: string, language: Language) => getCropName(cropKey, language);

const templates: { [T in NotificationType]: Renderer<T> } = {
  offer_created: (params, language) =>
    language === 'ta'
      ? {
          title: 'புதிய சலுகை',
          message: `${params.buyerName} உங்கள் ${crop(params.cropKey, language)} (${params.quantityKg} கிலோ) க்கு கிலோ ஒன்றுக்கு ₹${params.offeredPricePerKg} சலுகை அளித்துள்ளார்.`,
        }
      : {
          title: 'New offer received',
          message: `${params.buyerName} offered ₹${params.offeredPricePerKg}/kg for ${params.quantityKg} kg of your ${crop(params.cropKey, language)}.`,
        },

  offer_declined: (params, language) =>
    language === 'ta'
      ? {
          title: 'சலுகை நிராகரிக்கப்பட்டது',
          message: `உங்கள் ${crop(params.cropKey, language)} சலுகையை விவசாயி நிராகரித்துவிட்டார்.`,
        }
      : {
          title: 'Offer declined',
          message: `The farmer declined your offer on ${crop(params.cropKey, language)}.`,
        },

  offer_accepted: (params, language) =>
    language === 'ta'
      ? {
          title: 'சலுகை ஏற்கப்பட்டது',
          message: `உங்கள் ${crop(params.cropKey, language)} சலுகை ஏற்கப்பட்டது. ₹${params.totalAmount} ஐ 48 மணி நேரத்திற்குள் எஸ்க்ரோவில் செலுத்தவும்.`,
        }
      : {
          title: 'Offer accepted',
          message: `Your offer on ${crop(params.cropKey, language)} was accepted. Pay ₹${params.totalAmount} into escrow within 48 hours.`,
        },

  order_paid: (params, language) =>
    language === 'ta'
      ? {
          title: 'பணம் செலுத்தப்பட்டது',
          message: `${crop(params.cropKey, language)} ஆர்டருக்கான பணம் எஸ்க்ரோவில் உள்ளது. எடுப்புக்கு பயிரை தயார் செய்யவும்.`,
        }
      : {
          title: 'Payment received',
          message: `The buyer paid for your ${crop(params.cropKey, language)} order. It is held in escrow - prepare the crop for pickup.`,
        },

  order_completed: (params, language) =>
    language === 'ta'
      ? {
          title: 'ஆர்டர் முடிந்தது',
          message: `உங்கள் ${crop(params.cropKey, language)} ஆர்டர் முடிந்தது, பணம் விடுவிக்கப்பட்டது.`,
        }
      : {
          title: 'Order completed',
          message: `Your ${crop(params.cropKey, language)} order is complete and the payment has been released.`,
        },

  order_cancelled: (params, language) =>
    language === 'ta'
      ? {
          title: 'ஆர்டர் ரத்து செய்யப்பட்டது',
          message: params.reason
            ? `உங்கள் ${crop(params.cropKey, language)} ஆர்டர் ரத்து செய்யப்பட்டது: "${params.reason}"`
            : `உங்கள் ${crop(params.cropKey, language)} ஆர்டர் ரத்து செய்யப்பட்டது.`,
        }
      : {
          title: 'Order cancelled',
          message: params.reason
            ? `Your ${crop(params.cropKey, language)} order was cancelled: "${params.reason}"`
            : `Your ${crop(params.cropKey, language)} order was cancelled.`,
        },

  rating_received: (params, language) =>
    language === 'ta'
      ? {
          title: 'புதிய மதிப்பீடு',
          message: `${params.raterName} உங்களுக்கு ${params.score}/5 மதிப்பெண் அளித்துள்ளார்.`,
        }
      : {
          title: 'New rating',
          message: `${params.raterName} rated you ${params.score}/5.`,
        },

  listing_expired: (params, language) =>
    language === 'ta'
      ? {
          title: 'பட்டியல் காலாவதியானது',
          message: `உங்கள் ${crop(params.cropKey, language)} பட்டியல் காலாவதியானது, மறு பட்டியலிடலாம்.`,
        }
      : {
          title: 'Listing expired',
          message: `Your ${crop(params.cropKey, language)} listing has expired. You can relist it.`,
        },

  price_alert: (params, language) => {
    const arrow = params.direction === 'up' ? '📈' : '📉';
    return language === 'ta'
      ? {
          title: `${arrow} விலை மாற்றம்`,
          message: `${params.district}-இல் ${crop(params.cropKey, language)} விலை இன்று ${params.changePercent}% ${
            params.direction === 'up' ? 'அதிகரித்தது' : 'குறைந்தது'
          }.`,
        }
      : {
          title: `${arrow} Price change`,
          message: `${crop(params.cropKey, language)} prices in ${params.district} ${
            params.direction === 'up' ? 'rose' : 'fell'
          } ${params.changePercent}% today.`,
        };
  },
};

export function renderNotification<T extends NotificationType>(
  type: T,
  params: NotificationParamsByType[T],
  language: Language,
): RenderedNotification {
  return templates[type](params, language);
}
