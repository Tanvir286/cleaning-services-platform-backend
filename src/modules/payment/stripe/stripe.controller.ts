import {
  Controller,
  Post,
  Req,
  Headers,
  BadRequestException,
  RawBodyRequest,
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Request } from 'express';
import { TransactionRepository } from '../../../common/repository/transaction/transaction.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { Stripe } from 'stripe';

@Controller('payment/stripe')
export class StripeController {
  constructor(
    private readonly stripeService: StripeService,
    private transactionRepository: TransactionRepository,
    private readonly prisma: PrismaService,
  ) {}

  private async finalizeDepositTransaction({
    transactionId,
    referenceNumber,
    paidAmount,
    rawStatus,
  }: {
    transactionId?: string;
    referenceNumber?: string;
    paidAmount?: number;
    rawStatus?: string;
  }) {
    if (!transactionId) {
      console.warn('[Stripe Webhook] finalizeDepositTransaction: No transactionId provided');
      return;
    }

    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      console.warn(`[Stripe Webhook] Transaction not found for ID: ${transactionId}`);
      return;
    }

    if (transaction.status !== 'pending') {
      console.log(
        `[Stripe Webhook] Transaction ${transactionId} already processed (status: ${transaction.status}). Skipping.`,
      );
      return;
    }

    const finalPaidAmount = paidAmount ?? Number(transaction.amount ?? 0);

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'succeeded',
          raw_status: rawStatus,
          paid_amount: finalPaidAmount,
          reference_number: referenceNumber ?? transaction.reference_number,
        },
      });

      if (transaction.user_id) {
        const user = await tx.user.findUnique({
          where: { id: transaction.user_id },
          select: { balance: true },
        });

        const currentBalance = Number(user?.balance ?? 0);

        await tx.user.update({
          where: { id: transaction.user_id },
          data: {
            balance: currentBalance + finalPaidAmount,
          },
        });
      }
    });

    console.log(
      `[Stripe Webhook] Successfully finalized deposit for transaction: ${transactionId}, amount: ${finalPaidAmount}`,
    );
  }

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    try {
      const payload = req.rawBody ?? (req as any).body;
      if (!payload) {
        throw new Error('Raw body payload is missing');
      }

      const event = await this.stripeService.handleWebhook(payload, signature);

      if (!event || !event.data || !event.data.object) {
        return { received: true };
      }

      console.log(`[Stripe Webhook] Received event: ${event.type}`);

      // Handle events
      switch (event.type) {
        case 'customer.created':
          break;
        case 'payment_intent.created':
          break;
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const meta = paymentIntent.metadata || {};

          if (meta.type === 'deposit') {
            await this.finalizeDepositTransaction({
              transactionId: meta.transaction_id,
              referenceNumber: paymentIntent.id,
              paidAmount: paymentIntent.amount_received
                ? paymentIntent.amount_received / 100
                : undefined,
              rawStatus: event.type,
            });
          }
          break;
        }
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const meta = session.metadata || {};

          if (meta.type === 'deposit') {
            await this.finalizeDepositTransaction({
              transactionId: meta.transaction_id,
              referenceNumber: session.id,
              paidAmount: session.amount_total
                ? session.amount_total / 100
                : undefined,
              rawStatus: event.type,
            });
          }
          break;
        }
        case 'payment_intent.canceled':
          break;
        case 'payment_intent.requires_action':
          break;
        case 'payout.paid':
          break;
        case 'payout.failed':
          break;
        default:
          break;
      }

      return { received: true };
    } catch (error: any) {
      console.error('[Stripe Webhook Error]', error?.message || error);
      throw new BadRequestException(`Webhook Error: ${error?.message || 'Unknown error'}`);
    }
  }
}
