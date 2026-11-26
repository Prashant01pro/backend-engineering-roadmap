import crypto from 'crypto';
import * as paymentRepo from './payments.repository.js';
import AppError from '../../utils/appError.js';
import { withTransaction } from '../../config/db.js';

export const processPayment = async (userId, paymentData) => {
    const { bookingId, paymentMethod = 'CARD', idempotencyKey, simulateFailure = false } = paymentData;

    if (!bookingId || !idempotencyKey) {
        throw new AppError('Please provide bookingId and idempotencyKey', 400);
    }
    // check payment request already handled

    const existingPayment = await paymentRepo.findPaymentByIdempotencyKey(idempotencyKey)
    if (existingPayment) {
        return {
            message: 'Idempotent request: returning previous transaction outcome',
            payment: existingPayment,
        }

    }

    // execute payment inside atomic transaction
    return await withTransaction(async (client) => {
        const booking = await paymentRepo.lockBookingForPayment(bookingId, client);
        if (!booking) {
            throw new AppError('Booking not found', 404);
        }

        if (booking.user_id !== userId) {
            throw new AppError('You do not have permission to pay for this booking', 403);
        }

        // verify booking status
        if (booking.status === 'CONFIRMED') {
            throw new AppError('This booking has already been paid for and confirmed', 400);
        }

        if (booking.status !== 'PENDING') {
            throw new AppError(`Cannot pay for a booking with status: ${booking.status}`, 400);
        }

        if (new Date(booking.expires_at) <= new Date()) {
            throw new AppError('Your reservation hold has expired. Please select your seats again.', 410); // 410 Gone
        }

        // Mock Gateway Simulation
        // If simulateFailure is true, recording a FAILED attempt , booking stays PENDING so user can retry

        if (simulateFailure) {
            const failedPayment = await paymentRepo.createPaymentRecord(
                {
                    bookingId: booking.id,
                    amount: booking.total_amount,
                    currency: 'INR',
                    paymentMethod,
                    idempotencyKey,
                    transactionReference: null,
                    status: 'FAILED',
                },
                client
            );

            return {
                success: false,
                message: 'Payment declined by bank. Your seat hold is still active — please try again with another card.',
                payment: failedPayment,
            };
        }


        // Successful Payment Flow
        // Generating a simulated transaction reference like "txn_stripe_abc123")
        const transactionReference = `txn_mock_${crypto.randomBytes(8).toString('hex')}`;

        // Record the successful payment
        const payment = await paymentRepo.createPaymentRecord(
            {
                bookingId: booking.id,
                amount: booking.total_amount,
                currency: 'INR',
                paymentMethod,
                idempotencyKey,
                transactionReference,
                status: 'SUCCESS',
            },
            client
        );

        // Confirm and mark event_seats as permanently 'BOOKED'
        const bookedSeats = await paymentRepo.confirmBookingAndSeats(booking.id, client);
        return {
            success: true,
            message: 'Payment successful! Your tickets are confirmed.',
            payment,
            confirmedSeatsCount: bookedSeats.length,
        };
    })
}