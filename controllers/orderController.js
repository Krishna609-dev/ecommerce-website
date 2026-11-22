const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const generateInvoice = require('../utils/invoice');

// 1. Display all orders of the logged-in user
const getOrders = async (req, res, next) => {
    try {
        const userId = req.session.userId;

        const currentPage = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 5;
        const skip = (currentPage - 1) * limit;

        const totalOrders = await Order.countDocuments({ user: userId });

        const orders = await Order.find({ user: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const totalPages = Math.ceil(totalOrders / limit);

        res.render('orders/orders', {
            title: 'My orders',
            orders,
            currentPage,
            totalPages,
            baseQuery: '/orders?'
        });

    } catch (error) {
        next(error);
    }
};


// 2. Display one order's details
const getOrderDetails = async (req, res, next) => {
    try {
        const userId = req.session.userId;
        const orderId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(404).render('404');
        }

        // Only allow the owner of the order to view it
        const order = await Order.findOne({
            _id: orderId,
            user: userId
        }).lean();

        if (!order) {
            return res.status(404).render('404');
        }

        res.render('orders/order-detail', {
            title: 'Order details',
            order
        });

    } catch (error) {
        next(error);
    }
};


// 3. Cancel an order
const cancelOrder = async (req, res, next) => {
    try {
        const userId = req.session.userId;
        const orderId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            req.flash('error', 'Invalid order.');
            return res.redirect('/orders');
        }

        // Cancel only Pending or Processing orders.
        // stockReserved:true prevents repeated stock restoration.
        const order = await Order.findOneAndUpdate(
            {
                _id: orderId,
                user: userId,
                status: { $in: ['Pending', 'Processing'] },
                stockReserved: true
            },
            {
                $set: {
                    status: 'Cancelled',
                    stockReserved: false
                }
            },
            { new: true }
        );

        if (!order) {
            req.flash(
                'error',
                'This order cannot be cancelled. It may already be cancelled or shipped.'
            );
            return res.redirect('/orders');
        }

        // Restore product stock
        for (const item of order.items) {
            if (item.product) {
                await Product.updateOne(
                    { _id: item.product },
                    { $inc: { stock: item.quantity } }
                );
            }
        }

        // A paid online order needs a refund.
        if (
            order.paymentMethod === 'ONLINE' &&
            order.paymentStatus === 'Paid'
        ) {
            order.refundStatus = 'Refund Pending';
            await order.save();
        }

        req.flash('success', 'Your order has been cancelled.');
        return res.redirect(`/orders/${order._id}`);

    } catch (error) {
        next(error);
    }
};


// Invoice function will be connected to utils/invoice.js

// Download order invoice
const downloadInvoice = async (req, res, next) => {
    try {
        // Find the order
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).send('Order not found');
        }

        // Find currently logged-in user
        const currentUser = await User.findById(req.session.userId)
            .select('role');

        if (!currentUser) {
            return res.redirect('/login');
        }

        // Check whether the logged-in user owns this order
        const isOwner =
            String(order.user) === String(currentUser._id);

        // Check whether the logged-in user is an admin
        const isAdmin = currentUser.role === 'admin';

        // Allow only the order owner or admin
        if (!isOwner && !isAdmin) {
            return res.status(403).send(
                'You are not authorized to download this invoice.'
            );
        }

        // Generate and download PDF
        generateInvoice(order, res);

    } catch (error) {
        next(error);
    }
};



module.exports = {
    getOrders,
    getOrderDetails,
    cancelOrder,
    downloadInvoice
};