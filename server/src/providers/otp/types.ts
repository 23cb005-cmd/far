import type { Language } from '@farmfair/shared';

export interface OtpMessage {
  /** E.164 destination. */
  to: string;
  code: string;
  /** Minutes until the code expires, for the message copy. */
  expiresInMinutes: number;
  language: Language;
}

export interface OtpSendResult {
  delivered: boolean;
  /** Provider message id, where one exists. */
  reference?: string;
  /**
   * Returned only by development providers so the UI can show the code
   * without an SMS gateway. Never set in production.
   */
  devCode?: string;
}

/**
 * Transport used to deliver one-time codes. Swapping SMS gateways should mean
 * adding one file here and changing `OTP_PROVIDER`, nothing else.
 */
export interface OtpProvider {
  readonly name: string;
  /** True when the provider may expose the code back to the caller. */
  readonly exposesCode: boolean;
  send(message: OtpMessage): Promise<OtpSendResult>;
}
