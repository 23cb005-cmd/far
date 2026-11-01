import type { InboundMessageDto, Paginated } from '@farmfair/shared';
import { InboundMessage, type InboundMessageDocument } from '../models/InboundMessage';
import { paginated } from '../utils/respond';

function toDto(message: InboundMessageDocument): InboundMessageDto {
  return {
    id: String(message._id),
    phone: message.phone,
    body: message.body,
    outcome: message.outcome,
    createdAt: message.createdAt.toISOString(),
  };
}

/** Recent inbound WhatsApp messages and their outcomes, for admin debugging. */
export async function getRecentBotMessages(
  page: number,
  limit: number,
): Promise<Paginated<InboundMessageDto>> {
  const [total, messages] = await Promise.all([
    InboundMessage.countDocuments(),
    InboundMessage.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
  ]);

  return paginated(messages.map(toDto), page, limit, total);
}
