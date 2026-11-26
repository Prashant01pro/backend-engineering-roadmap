import { Router } from 'express';
import * as bookingController from './bookings.controller.js';
import { authenticateUser } from '../auth/auth.middleware.js';

const router = Router();

//all must be protected/ private
router.use(authenticateUser);

router.post('/', bookingController.createBooking);
router.get('/my-bookings', bookingController.getMyBookings);
router.get('/:id', bookingController.getBooking);

export default router;