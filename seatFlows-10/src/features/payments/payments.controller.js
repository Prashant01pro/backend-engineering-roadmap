import * as paymentService from './payments.service.js';
import { catchAsync } from '../../utils/catchAsync.js';

export const processPayment = catchAsync(async (req, res) => {
  const result = await paymentService.processPayment(req.user.id, req.body);
  res.status(200).json({ success: true, data: result });
});