import {
  normalisePhone,
  type DevBotSimulateInput,
  type DevBotSimulateResponse,
} from '@farmfair/shared';
import { handleInboundMessage } from '../services/bot';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/respond';

/**
 * POST /dev/bot - development only.
 *
 * Simulates an inbound WhatsApp message without a Twilio account, so the bot
 * can be exercised locally (and in Swagger) end to end.
 */
export const simulateBotMessageHandler = asyncHandler(async (req, res) => {
  const { from, body } = req.body as DevBotSimulateInput;
  const phone = normalisePhone(from);
  if (!phone) throw AppError.badRequest('Enter a valid Indian mobile number');

  const reply = await handleInboundMessage(phone, body);
  const result: DevBotSimulateResponse = { reply };
  sendSuccess(res, result);
});
