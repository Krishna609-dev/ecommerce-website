const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Address = require('../models/Address');
const Order = require('../models/Order');
const calculateCart = require('../utils/calculateCart');
const User = require('../models/User');
const sendOrderEmail = require('../utils/sendOrderEmail');

const createRazorpayOrder = async (amount, receipt) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
        throw new Error('Razorpay credentials are missing in .env');
    }

    const authorization = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    let response;

    try {
        response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                Authorization: `Basic ${authorization}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount,
                currency: 'INR',
                receipt
            })
        });
    } catch (error) {
        throw new Error(
            'Unable to connect to Razorpay. Check the server internet connection and try again.',
            { cause: error }
        );
    }

    let result;

    try {
        result = await response.json();
    } catch (error) {
        throw new Error('Razorpay returned an invalid response.', { cause: error });
    }

    if (!response.ok) {
        throw new Error(
            result.error?.description ||
            `Razorpay order creation failed with HTTP ${response.status}.`
        );
    }

    if (!result.id || !Number.isInteger(result.amount)) {
        throw new Error('Razorpay returned incomplete order details.');
    }

    return result;
};

// Display checkout page
const getCheckout = async (req, res, next) => {
    try {
        const userId = req.session.userId;

        const cart = await Cart.findOne({ user: userId })
            .populate('items.product');

        if (!cart || cart.items.length === 0) {
            req.flash('error', 'Your cart is empty');
            return res.redirect('/cart');
        }

        const availableItems = cart.items.filter(
            item => item.product && item.product.isActive
        );

        if (availableItems.length !== cart.items.length) {
            cart.items = availableItems;
            await cart.save();
            req.flash('error', 'Unavailable products were removed from your cart');

            if (cart.items.length === 0) {
                return res.redirect('/cart');
            }
        }

        let subtotal = 0;
        const items = [];

        for (const item of cart.items) {
            const product = item.product;

            if (product.stock < item.quantity) {
                req.flash('error', `${product.name} has insufficient stock`);
                return res.redirect('/cart');
            }

            const lineTotal = product.price * item.quantity;
            subtotal += lineTotal;

            items.push({
                product,
                quantity: item.quantity,
                lineTotal
            });
        }

        const addresses = await Address.find({ user: userId });

// Calculate coupon discount
let summary = await calculateCart(
    cart.items,
    cart.couponCode
);

// If coupon is invalid, remove it
if (summary.couponError) {

    cart.couponCode = null;
    await cart.save();

    req.flash('error', summary.couponError);

    summary = await calculateCart(cart.items);
}

const { discount, total } = summary;

subtotal = summary.subtotal;
        res.render('checkout/checkout', {
    title: 'Checkout',
    addresses,
    items,
    subtotal,
    discount,
    total,
    couponCode: summary.couponCode,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || ''
});

    } catch (error) {
        next(error);
    }
};


// Place order
const placeOrder = async (req, res, next) => {
    const userId = req.session.userId;
    const isAjax = req.get('accept')?.includes('application/json');

    let reservedProducts = [];
    let createdOrder = null;

    try {
        const { addressId, paymentMethod } = req.body;

        if (!['COD', 'ONLINE'].includes(paymentMethod)) {
            throw new Error('Invalid payment method');
        }

        const cart = await Cart.findOne({ user: userId })
            .populate('items.product');

        if (!cart || cart.items.length === 0) {
            throw new Error('Your cart is empty');
        }

        // Validate products and quantities
        const orderItems = [];
        let subtotal = 0;

        for (const item of cart.items) {
            const product = await Product.findById(item.product?._id);

            if (!product || !product.isActive) {
                throw new Error('A product is unavailable');
            }

            if (
                !Number.isInteger(item.quantity) ||
                item.quantity < 1 ||
                product.stock < item.quantity
            ) {
                throw new Error(`Insufficient stock for ${product.name}`);
            }

            const lineTotal = product.price * item.quantity;
            subtotal += lineTotal;

            orderItems.push({
                product: product._id,
                name: product.name,
                image: product.images?.[0] || '',
                price: product.price,
                quantity: item.quantity
            });
        }

        // Get selected address
        let deliveryAddress;

        if (addressId === 'new') {
            const newAddress = req.body.newAddress;

            if (
                !newAddress ||
                !newAddress.fullName ||
                !newAddress.phone ||
                !newAddress.street ||
                !newAddress.city ||
                !newAddress.state ||
                !newAddress.pincode
            ) {
                throw new Error('Please enter all delivery address details');
            }

            deliveryAddress = {
                fullName: newAddress.fullName.trim(),
                phone: newAddress.phone.trim(),
                street: newAddress.street.trim(),
                city: newAddress.city.trim(),
                state: newAddress.state.trim(),
                pincode: newAddress.pincode.trim()
            };

            const savedAddress = new Address({
                user: userId,
                ...deliveryAddress
            });

            await savedAddress.save();

        } else {
            const address = await Address.findOne({
                _id: addressId,
                user: userId
            });

            if (!address) {
                throw new Error('Please select a valid address');
            }

            deliveryAddress = {
                fullName: address.fullName,
                phone: address.phone,
                street: address.street,
                city: address.city,
                state: address.state,
                pincode: address.pincode
            };
        }

        // Coupon integration can be added here.
        // Revalidate coupon during checkout
const summary = await calculateCart(
    cart.items,
    cart.couponCode
);

// Reject invalid or expired coupon
if (summary.couponError) {

    cart.couponCode = null;
    await cart.save();

    throw new Error(summary.couponError);
}

const discount = summary.discount;
const totalAmount = summary.total;
subtotal = summary.subtotal;

const couponCode = summary.couponCode;

        if (totalAmount <= 0) {
            throw new Error('Invalid order amount');
        }

        // Reserve stock
        for (const item of orderItems) {
            const result = await Product.updateOne(
                {
                    _id: item.product,
                    stock: { $gte: item.quantity },
                    isActive: true
                },
                {
                    $inc: { stock: -item.quantity }
                }
            );

            if (result.modifiedCount !== 1) {
                throw new Error(`Stock unavailable for ${item.name}`);
            }

            reservedProducts.push(item);
        }

        // Create order
        createdOrder = await Order.create({
    user: userId,
    items: orderItems,
    address: deliveryAddress,
    subtotal,
    discount,
    totalAmount,
    couponCode,
    paymentMethod,
    paymentStatus: 'Pending',
    stockReserved: true,
    status: 'Pending'
});

    
//     // COD order
if (paymentMethod === 'COD') {

    // Clear cart after placing order
    await Cart.deleteOne({ user: userId });

    // Find customer details
    const customer = await User.findById(userId);

    // Send order confirmation email
    if (customer && customer.email) {
        try {
            await sendOrderEmail(customer.email, createdOrder);
            console.log('COD order confirmation email sent successfully');
        } catch (emailError) {
            console.error('COD order email failed:', emailError);
        }
    }

    req.flash('success', 'Your order has been placed successfully');

    return res.redirect('/');
}

        // Razorpay order
        const razorpayOrder = await createRazorpayOrder(
            Math.round(totalAmount * 100),
            `receipt_${createdOrder._id}`
        );

        createdOrder.razorpayOrderId = razorpayOrder.id;
        await createdOrder.save();

        return res.json({
            orderId: createdOrder._id,
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            keyId: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error('Checkout order creation failed:', error);

        // Restore stock if the order could not be completed
        for (const item of reservedProducts) {
            await Product.updateOne(
                { _id: item.product },
                { $inc: { stock: item.quantity } }
            );
        }

        if (createdOrder) {
            await Order.deleteOne({ _id: createdOrder._id });
        }

        if (isAjax) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Unable to create the order.'
            });
        }

        req.flash('error', error.message);
        return res.redirect('/orders');
    }
};

module.exports = {
    getCheckout,
    placeOrder,
    createRazorpayOrder

};