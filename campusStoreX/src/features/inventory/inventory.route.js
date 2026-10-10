import express from 'express';
import { addStock, getInventory, getStockHistory, } from './inventory.controller.js';
import { authenticate } from '../auth/auth.middleware.js';

const inventoryRouter = express.Router();

//public route: Anyone can see available stock for a product
inventoryRouter.get('/:productId', getInventory)

// protected : Only seller 
inventoryRouter.post('/add', authenticate, addStock);
inventoryRouter.get('/:productId/history', authenticate, getStockHistory)

export default inventoryRouter;