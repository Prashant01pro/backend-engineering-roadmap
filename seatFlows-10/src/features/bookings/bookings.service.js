import * as bookingRepo from './bookings.repository.js';
import AppError from '../../utils/appError.js';
import { withTransaction } from '../../config/db.js';

export const createBookingReservation = async (userId, { eventSeatIds, holdMinutes = 10 }) => {

    if (!eventSeatIds || !Array.isArray(eventSeatIds) || eventSeatIds.length === 0) {
        throw new AppError('Please select at least one seat to book', 400)
    }

    // anti-hoarding rule: limit to maximum 6 seats per transaction
    if (eventSeatIds.length > 6) {
        throw new AppError('You can reserve a maximum of 6 seats at a time', 400)
    }

    // deadlock prevention - deduplicate and numerically sort seat IDS
    const sortedSeatIds = [...new Set(eventSeatIds.map(Number))].sort((a, b) => a - b);

    // execution atomic reservation inside a transaction
    return await withTransaction(async (client) => {
        const lockedSeats = await bookingRepo.lockAndGetSeats(sortedSeatIds, client);

        if (lockedSeats.length !== sortedSeatIds.length) {
            throw new AppError('One or more selected seats do not exist', 404);
        }

        // verify all seats belong to exact same event
        const eventId = lockedSeats[0].event_id;
        const isSingleEvent = lockedSeats.every((s) => s.event_id === eventId);

        if (!isSingleEvent) {
            throw new AppError('All seats in a booking must belong to the same event', 400);
        }

        // concurrency check , every seat is available
        const unavailableSeats = lockedSeats.filter((s) => s.status !== 'AVAILABLE');
        if (unavailableSeats.length > 0) {
            const seatIds = unavailableSeats.map((s) => s.id).join(',');

            throw new AppError(`Seat(s) [${seatIds}] are no longer available. Please select another seat.`, 409);
        }

        const totalAmount = lockedSeats.reduce((sum, seat) => sum + parseFloat(seat.price), 0);

        // booking header creation , status=pending , expires in 10 mins
        const booking = await bookingRepo.createBooking({ userId, eventId, totalAmount, holdMinutes }, client);

        await bookingRepo.createBookingItems(booking.id, lockedSeats, client);

        await bookingRepo.updateEventSeatsStatus(sortedSeatIds, 'RESERVED', client)

        return {
            bookingId: booking.id,
            eventId: booking.event_id,
            totalAmount: booking.total_amount,
            status: booking.status,
            expiresAt: booking.expires_at,
            seats: lockedSeats.map((s) => ({ id: s.id, tier: s.ticket_tier, price: s.price })),
        }
    })
}


export const getBooking = async (userId, bookingId) => {
    const booking = await bookingRepo.getBookingWithItems(bookingId);
    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    // Authorization- Customers can only view their own bookings
    if (booking.user_id !== userId) {
        throw new AppError('You do not have permission to view this booking', 403);
    }
    
    return booking;
};


export const getMyBookings = async (userId) => {
    return await bookingRepo.getUserBookings(userId);
};