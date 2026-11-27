import * as bookingService from './bookings.service.js';
import { catchAsync } from '../../utils/catchAsync.js';

export const createBooking = catchAsync(async (req, res) => {

    const result = await bookingService.createBookingReservation(req.user.id, req.body);
    res.status(201).json({ success: true, data: result });
});

export const getBooking = catchAsync(async (req, res) => {

    const booking = await bookingService.getBooking(req.user.id, req.params.id);
    res.status(200).json({ success: true, data: booking });
});

export const getMyBookings = catchAsync(async (req, res) => {

    const result = await bookingService.getMyBookings(req.user.id, req.query);
    res.status(200).json({ success: true, data: result });
});