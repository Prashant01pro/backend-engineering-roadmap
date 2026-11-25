import * as eventService from './event.service.js';
import { catchAsync } from '../../utils/catchAsync.js';

export const createVenue = catchAsync(async (req, res) => {
    const venue = await eventService.createVenue(req.body);

    res.status(201).json({ success: true, data: venue });
});

export const generateVenueSeats = catchAsync(async (req, res) => {
    const result = await eventService.generateVenueSeats(req.params.venueId, req.body);

    res.status(201).json({ success: true, data: result });
});

export const createEvent = catchAsync(async (req, res) => {
    const event = await eventService.createEvent(req.user.id, req.body);

    res.status(201).json({ success: true, data: event });
});

export const createTicketType = catchAsync(async (req, res) => {
    const ticketType = await eventService.createTicketType(req.user.id, req.params.id, req.body);

    res.status(201).json({ success: true, data: ticketType });
});

export const publishEvent = catchAsync(async (req, res) => {
    const result = await eventService.publishEvent(req.user.id, req.params.id);

    res.status(200).json({ success: true, data: result });
});

export const getEvents = catchAsync(async (req, res) => {
    const events = await eventService.getEvents(req.query);

    res.status(200).json({ success: true, data: events });
});

export const getEvent = catchAsync(async (req, res) => {
    const event = await eventService.getEvent(req.params.id);

    res.status(200).json({ success: true, data: event });
});

export const getEventSeats = catchAsync(async (req, res) => {
    const seats = await eventService.getEventSeats(req.params.id);

    res.status(200).json({ success: true, data: seats });
});