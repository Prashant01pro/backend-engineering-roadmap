import { Router } from 'express';
import * as eventController from './event.controller.js';
import { authenticateUser, restrictTo } from '../auth/auth.middleware.js';

const router = Router();

// Public 
router.get('/', eventController.getEvents);
router.get('/:id', eventController.getEvent);
router.get('/:id/seats', eventController.getEventSeats);

// Protected Organizer / Admin endpoints
router.use(authenticateUser);
router.use(restrictTo('ORGANIZER', 'ADMIN'));

router.post('/venues', eventController.createVenue);
router.post('/venues/:venueId/seats', eventController.generateVenueSeats);
router.post('/', eventController.createEvent);
router.post('/:id/ticket-types', eventController.createTicketType);
router.post('/:id/publish', eventController.publishEvent);

export default router;