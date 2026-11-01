export interface WhatsAppMessage {
  /** E.164 destination. */
  to: string;
  body: string;
}

export interface NotifySendResult {
  delivered: boolean;
  /** Provider message id, where one exists. */
  reference?: string;
}

/** Transport used to deliver an external copy of an in-app notification. */
export interface NotifyProvider {
  readonly name: string;
  sendWhatsApp(message: WhatsAppMessage): Promise<NotifySendResult>;
}
