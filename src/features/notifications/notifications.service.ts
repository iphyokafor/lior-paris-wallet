import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';
import { DomainEventName } from '../../shared/events/domain-event-name';
import { formatCurrency } from '../../shared/utils/format-currency';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly fromEmail: string;
  private readonly isConfigured: boolean;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('SENDGRID_API_KEY');
    this.fromEmail =
      this.config.get<string>('SENDGRID_FROM_EMAIL') || 'noreply@yourapp.com';

    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.isConfigured = true;
      this.logger.log('SendGrid configured');
    } else {
      this.isConfigured = false;
      this.logger.warn('SENDGRID_API_KEY not set — emails will be logged only');
    }
  }

  async send(
    eventName: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const message = this.buildMessage(eventName, payload);
    const subject = this.buildSubject(eventName);
    const recipientEmail = this.getRecipientEmail(eventName, payload);

    if (this.isConfigured && recipientEmail) {
      await sgMail.send({
        to: recipientEmail,
        from: this.fromEmail,
        subject,
        text: message,
      });
      this.logger.log(`Email sent to ${recipientEmail}: ${subject}`);
    } else {
      this.logger.log(`[SIMULATED] ${message}`);
    }
  }

  private getRecipientEmail(
    eventName: string,
    payload: Record<string, unknown>,
  ): string | undefined {
    switch (eventName) {
      case DomainEventName.TransferSent:
        return payload.fromUserEmail as string | undefined;
      case DomainEventName.TransferReceived:
        return payload.toUserEmail as string | undefined;
      default:
        return payload.userEmail as string | undefined;
    }
  }

  private buildSubject(eventName: string): string {
    switch (eventName) {
      case DomainEventName.DepositSucceeded:
        return 'Deposit Received';
      case DomainEventName.TransferSent:
        return 'Transfer Sent';
      case DomainEventName.TransferReceived:
        return 'Transfer Received';
      default:
        return `Notification: ${eventName}`;
    }
  }

  private buildMessage(
    eventName: string,
    payload: Record<string, unknown>,
  ): string {
    const { amount, currency, fromUserName, toUserName } = payload as Record<
      string,
      string
    >;
    const formattedAmount = formatCurrency(amount, currency);

    switch (eventName) {
      case DomainEventName.DepositSucceeded:
        return `Your deposit of ${formattedAmount} has been received.`;

      case DomainEventName.TransferSent:
        return `Your transfer of ${formattedAmount} to ${toUserName} is complete.`;

      case DomainEventName.TransferReceived:
        return `You received ${formattedAmount} from ${fromUserName}.`;

      default:
        return `Notification for ${eventName}: ${JSON.stringify(payload)}`;
    }
  }
}
