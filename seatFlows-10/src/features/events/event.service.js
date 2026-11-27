import * as eventRepo from './event.repository.js';
import AppError from '../../utils/appError.js';
import { withTransaction } from '../../config/db.js';
import { decodeCursor, formatPaginationResponse } from '../../utils/pagination.js';
import { getCache, setCache, deleteCache } from '../../config/redis.js';

export const createVenue = async (venueData) => {
    const { name, address, city, postalCode, capacity } = venueData;

    if (!name || !address || !city || !postalCode || !capacity) {
        throw new AppError('Please provide name, address, city, postal code, and capacity', 400);
    }

    if (capacity <= 0) {
        throw new AppError('Venue capacity must be greater than 0', 400);
    }

    return await eventRepo.createVenue(venueData);
};

export const generateVenueSeats = async (venueId, seatGridData) => {
    const { section, totalRows, seatsPerRow } = seatGridData;

    if (!section || !totalRows || !seatsPerRow) {
        throw new AppError('Please provide section, totalRows, and seatsPerRow', 400);
    }

    const venue = await eventRepo.getVenueById(venueId);
    if (!venue) {
        throw new AppError('Venue not found', 404);
    }

    const count = await eventRepo.createVenueSeatGrid({
        venueId,
        section,
        totalRows,
        seatsPerRow,
    });

    return { message: `Successfully generated ${count} physical seats in Section ${section}` };
};


export const createEvent = async (userId, eventData) => {
    const { venueId, title, category, startTime, endTime, description } = eventData;

    if (!venueId || !title || !category || !startTime || !endTime) {
        throw new AppError('Please provide venueId, title, category, startTime, and endTime', 400);
    }


    const organizer = await eventRepo.findOrganizerByUserId(userId);

    if (!organizer) {
        throw new AppError('Organizer profile not found for this user', 403);
    }

    // Validate dates
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start <= new Date()) {
        throw new AppError('Event start time must be in the future', 400);
    }
    if (end <= start) {
        throw new AppError('Event end time must be after start time', 400);
    }

    // Verify venue exists
    const venue = await eventRepo.getVenueById(venueId);
    if (!venue) {
        throw new AppError('Venue not found', 404);
    }

    return await eventRepo.createEvent({
        organizerId: organizer.id,
        venueId,
        title,
        description,
        category,
        startTime,
        endTime,
    });
};

export const createTicketType = async (userId, eventId, ticketData) => {
    const { name, price, description } = ticketData;
    if (!name || price === undefined) {
        throw new AppError('Please provide ticket tier name and price', 400);
    }

    const event = await eventRepo.getEventById(eventId);
    if (!event) throw new AppError('Event not found', 404);

    const organizer = await eventRepo.findOrganizerByUserId(userId);
    if (event.organizer_id !== organizer?.id) {
        throw new AppError('You are not authorized to modify this event', 403);
    }

    if (event.status !== 'DRAFT') {
        throw new AppError('Cannot add ticket tiers to an already published or cancelled event', 400);
    }

    const ticketType = await eventRepo.createTicketType({ eventId, name, price, description });

    await deleteCache(`event:${eventId}`);

    return ticketType;

};

//PUBLISHING TRANSACTION 

export const publishEvent = async (userId, eventId) => {
    const event = await eventRepo.getEventById(eventId);
    if (!event) throw new AppError('Event not found', 404);

    const organizer = await eventRepo.findOrganizerByUserId(userId);
    if (event.organizer_id !== organizer?.id) {
        throw new AppError('You are not authorized to publish this event', 403);
    }

    if (event.status === 'PUBLISHED') {
        throw new AppError('Event is already published', 400);
    }

    // Check ticket types exist
    const ticketTypes = await eventRepo.getTicketTypesByEventId(eventId);
    if (!ticketTypes || ticketTypes.length === 0) {
        throw new AppError('Please create at least one ticket tier before publishing', 400);
    }


    const defaultTicketTypeId = ticketTypes[0].id;

    // Run publishing inside an atomic transaction
    const atomicResult = await withTransaction(async (client) => {

        //Copy physical venue_seats - event_seats
        const seatsCreated = await eventRepo.instantiateEventSeats(
            eventId,
            event.venue_id,
            defaultTicketTypeId,
            client
        );

        if (seatsCreated === 0) {
            throw new AppError('No physical seats found for this venue. Generate venue seats first.', 400);
        }

        // Change event status to PUBLISHED
        const updatedEvent = await eventRepo.updateEventStatus(eventId, 'PUBLISHED', client);
        return {
            event: updatedEvent,
            seatsInstantiated: seatsCreated,
        };

    });

    await deleteCache(`event:${eventId}`);
    return atomicResult;
};

//  PUBLIC DISCOVERY 

export const getEvents = async (queryParams) => {
    const { city, category } = queryParams;
    const parsedLimit = parseInt(queryParams.limit, 10) || 10;
    const limit = Math.min(Math.max(parsedLimit, 1), 50);
    const cursor = decodeCursor(queryParams.cursor);

    const rows = await eventRepo.getPublishedEventsPaginated({
        city,
        category,
        limit,
        cursor,
    });

    return formatPaginationResponse(rows, limit, (item) => ({
        startTime: item.start_time,
        id: item.id,
    }));
};

export const getEvent = async (id) => {

    const cacheKey = `event:${id}`

    const cachedEvent = await getCache(cacheKey);
    if (cachedEvent) {
        return cachedEvent; //cache HIT
    }


    const event = await eventRepo.getEventById(id);
    if (!event) throw new AppError('Event not found', 404);

    const ticketTypes = await eventRepo.getTicketTypesByEventId(id);
    const result = { ...event, ticketTypes };

    await setCache(cacheKey, result, 600) // store in Redis for 10 min (600 sec)
    return result;
};

export const getEventSeats = async (eventId) => {
    const event = await eventRepo.getEventById(eventId);
    if (!event) throw new AppError('Event not found', 404);

    return await eventRepo.getEventSeatsMap(eventId);
};