import catchAsync from '../../utils/catchAsync.js';
import { addStockService, getInventoryByProductService, getProductStockHistoryService, } from './inventory.service.js';

export const addStock = catchAsync(async (req, res) => {
    const { productId, quantity, reason } = req.body;

    const inventory = await addStockService({
        productId,
        sellerId: req.user._id,
        quantity,
        reason
    })

    res.status(200).json({
        status: 'success',
        data: { inventory }
    })
})

export const getInventory = catchAsync(async (req, res) => {
    const inventory = await getInventoryByProductService(req.params.productId);

    res.status(200).json({
        status: 'success',
        data: { inventory }
    })
})

export const getStockHistory = catchAsync(async (req, res) => {
    const history = await getProductStockHistoryService(req.params.productId, req.user._id);
    res.status(200).json({
        status: 'success',
        results: history.length,
        data: { history }
    })
})

