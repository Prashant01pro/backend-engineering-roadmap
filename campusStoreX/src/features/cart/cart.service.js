import Cart from './cart.model.js';
import Product from '../products/product.model.js';
import Inventory from '../inventory/inventory.model.js';
import AppError from '../../utils/appError.js';

// helper function:get or create cart
const getOrCreateCart = async (userId) => {
    let cart = await Cart.findOne({ user: userId })

    if (!cart) {
        cart = await Cart.create({ user: userId, items: [] })
    }
    return cart;
}

export const getCartService = async (userId) => {
    const cart = await getOrCreateCart(userId);

    await cart.populate({
        path: 'items.product',
        select: 'name price status category seller specifications',
        populate: { path: 'category', select: 'name' }
    })


    // Property / Option	    Target Layer	            Action Taken	                          Purpose
    // path: 'items.product'	Level 1 (Cart Items)	    Swaps product ID for Product document	  Pulls core item details into the cart
    // select (First instance)	Level 1 (Product fields)	Filters for name, price, status, etc.	  Saves bandwidth by ignoring unneeded fields
    // populate (Nested)	    Level 2 (Product details)	Swaps category ID for Category document	  Digs deeper to find details linked to the product
    // select (Second instance)	Level 2 (Category fields)	Filters for name only	                  Gets the category label without extra meta-data

    //calculate cart subtotal dynamically
    let subtotal = 0;
    cart.items.forEach((item) => {
        if (item.product && item.product.price) {
            subtotal += item.product.price * item.quantity;
        }
    });

    return {
        cart,
        subtotal
    }

}

// add item to cart
export const addToCartService = async (userId, { productId, quantity = 1 }) => {
    if (quantity < 1) {
        throw new AppError('Quantity must be at least 1', 400);
    }

    // check product exist and is active
    const product = await Product.findById(productId);
    if (!product || product.status !== 'ACTIVE') {
        throw new AppError('Product is not available for purchase', 400);
    }

    // seller can't buy their own product 
    if (product.seller.toString() === userId.toString()) {
        throw new AppError('You cannot buy your own product', 400);
    }

    // check inventory availability
    const inventory = await Inventory.findOne({ product: productId })
    const availableStock = inventory ? inventory.available : 0;

    // The short answer is that Product.findOne(productId) is actually a syntax error in standard Mongoose, whereas Inventory.findOne({ product: productId }) uses the correct object syntax to filter by a specific field.

    // Method	            Correct Argument Syntax	    What it Searches By  	                     When to Use It
    // Product.findById()	(productId)	                Automatically searches the _id field	     When you have a document's primary unique ID.
    // Product.findOne()	({ _id: productId })	    Searches whatever database key you provide	 When finding a single document by its standard _id.
    // Inventory.findOne()	({ product: productId })	Searches a custom field (product)	         When looking up a document by a relationship or foreign key.

    const cart = await getOrCreateCart(userId);

    //check if item already exists in cart 
    const itemIndex = cart.items.findIndex((item) => item.product.toString() == productId.toString())

    if (itemIndex > -1) {
        // Already in cart: update quantity
        const newQuantity = cart.items[itemIndex].quantity + quantity;

        if (newQuantity > availableStock) {
            throw new AppError(`Insufficient stock. Only ${availableStock} units available`, 400)
        }

        cart.items[itemIndex].quantity = newQuantity;
    } else {
        // new item:check cart size item max 20
        if (cart.items.length >= 20) {
            throw new AppError('Cart cannot hold more than 20 different items', 400);
        }

        if (quantity > availableStock) {
            throw new AppError(
                `Insufficient stock. Only ${availableStock} units available`,
                400
            );
        }

        cart.items.push({ product: productId, quantity });
    }

    await cart.save()
    return getCartService(userId)

}

// update item quantity in cart
export const updateCartItemService = async (userId, { productId, quantity }) => {

    const cart = await getOrCreateCart(userId);

    const itemIndex = cart.items.findIndex(
        (item) => item.product.toString() === productId.toString()
    );

    if (itemIndex === -1) {
        throw new AppError('Product not found in cart', 404);
    }

    // if quantity <=0 remove item from cart
    if (quantity <= 0) {
        cart.items.splice(itemIndex, 1);
    } else {
        // check available stock
        const inventory = await Inventory.findOne({ product: productId });

        const availableStock = inventory ? inventory.available : 0;
        if (quantity > availableStock) {
            throw new AppError(
                `Insufficient stock. Only ${availableStock} units available`,
                400
            );
        }
        cart.items[itemIndex].quantity = quantity;
    }

    await cart.save();
    return getCartService(userId)


}

//Remove Item from Cart
export const removeCartItemService = async (userId, productId) => {
    const cart = await getOrCreateCart(userId);

    cart.items = cart.items.filter(
        (item) => item.product.toString() !== productId.toString()
    );

    await cart.save();
    return getCartService(userId);
};


// Clear Cart (e.g. after successful order)
export const clearCartService = async (userId) => {
    const cart = await getOrCreateCart(userId);

    cart.items = [];

    await cart.save();
    return { message: 'Cart cleared successfully' };
};