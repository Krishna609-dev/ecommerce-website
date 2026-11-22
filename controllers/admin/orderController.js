
const mongoose = require('mongoose');
const Order = require('../../models/Order');

// Allowed forward status transitions
const statusFlow = {
    Pending: ['Processing'],
    Processing: ['Shipped'],
    Shipped: ['Delivered'],
    Delivered: [],
    Cancelled: [],
    'Payment Failed': []
};

// A6: Display all orders with filtering and pagination
const list = async (req, res, next) => {
    try {
        const limit = 10;

        const currentPage = Math.max(
            1,
            parseInt(req.query.page, 10) || 1
        );

        const allowedStatuses = [
            'Pending',
            'Processing',
            'Shipped',
            'Delivered',
            'Cancelled',
            'Payment Failed'
        ];

        const selectedStatus = allowedStatuses.includes(req.query.status)
            ? req.query.status
            : '';

        const filter = selectedStatus
            ? { status: selectedStatus }
            : {};

        const totalOrders = await Order.countDocuments(filter);

        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find(filter)
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 })
            .skip((currentPage - 1) * limit)
            .limit(limit)
            .lean();

        const baseQuery = selectedStatus
            ? `/admin/orders?status=${encodeURIComponent(selectedStatus)}&`
            : '/admin/orders?';

        res.render('admin/orders', {
            title: 'Orders',
            activePage: 'orders',
            orders,
            selectedStatus,
            currentPage,
            totalPages,
            baseQuery
        });

    } catch (error) {
        next(error);
    }
};


// A7: Display one order's details
const detail = async (req, res, next) => {
    try {
        const orderId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(404).send('Order not found');
        }

        const order = await Order.findById(orderId)
            .populate('user', 'name email phone')
            .lean();

        if (!order) {
            return res.status(404).send('Order not found');
        }

        const nextStatuses = statusFlow[order.status] || [];

        res.render('admin/order-detail', {
            title: 'Order Details',
            activePage: 'orders',
            order,
            nextStatuses
        });

    } catch (error) {
        next(error);
    }
};


// A7: Update order status
const updateStatus = async (req, res, next) => {
    try {
        const orderId = req.params.id;
        const { status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            req.flash('error', 'Invalid order.');
            return res.redirect('/admin/orders');
        }

        const order = await Order.findById(orderId);

        if (!order) {
            req.flash('error', 'Order not found.');
            return res.redirect('/admin/orders');
        }

        // Do not allow changes to cancelled or final orders
        const allowedNextStatuses = statusFlow[order.status] || [];

        if (!allowedNextStatuses.includes(status)) {
            req.flash('error', 'Invalid order status change.');
            return res.redirect(`/admin/orders/${order._id}`);
        }

        // Update order status
        order.status = status;

        // COD payment is collected when delivered
        if (
            status === 'Delivered' &&
            order.paymentMethod === 'COD'
        ) {
            order.paymentStatus = 'Paid';
        }

        await order.save();

        req.flash('success', 'Order status updated successfully.');

        return res.redirect(`/admin/orders/${order._id}`);

    } catch (error) {
        next(error);
    }
};


// A8: Mark manual refund as completed
const updateRefundStatus = async (req, res, next) => {
    try {
        const orderId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            req.flash('error', 'Invalid order.');
            return res.redirect('/admin/orders');
        }

        const order = await Order.findById(orderId);

        if (!order) {
            req.flash('error', 'Order not found.');
            return res.redirect('/admin/orders');
        }

        // Only paid, cancelled orders with pending refund
        // can be marked as refunded
        if (
            order.status !== 'Cancelled' ||
            order.paymentStatus !== 'Paid' ||
            order.refundStatus !== 'Refund Pending'
        ) {
            req.flash('error', 'This order is not eligible for refund completion.');
            return res.redirect(`/admin/orders/${order._id}`);
        }

        // Admin has manually processed the refund
        order.refundStatus = 'Refunded';

        await order.save();

        req.flash('success', 'Refund status updated to Refunded.');

        return res.redirect(`/admin/orders/${order._id}`);

    } catch (error) {
        next(error);
    }
};


module.exports = {
    list,
    detail,
    updateStatus,
    updateRefundStatus
};











// const Order = require('../../models/Order');

// // GET /admin/orders
// // List orders with pagination and status filter
// list = async (req, res, next) => {
//     try {

//         const limit = 10;

//         const currentPage = Math.max(
//             1,
//             parseInt(req.query.page, 10) || 1
//         );

//         const selectedStatus = req.query.status || '';

//         const filter = {};

//         if (selectedStatus) {
//             const allowedStatuses = [
//                 'Pending',
//                 'Processing',
//                 'Shipped',
//                 'Delivered',
//                 'Cancelled'
//             ];

//             if (!allowedStatuses.includes(selectedStatus)) {
//                 return res.redirect('/admin/orders');
//             }

//             filter.status = selectedStatus;
//         }

//         const totalOrders = await Order.countDocuments(filter);

//         const totalPages = Math.ceil(totalOrders / limit);

//         const orders = await Order.find(filter)
//             .populate('user', 'name email phone')
//             .sort({ createdAt: -1 })
//             .skip((currentPage - 1) * limit)
//             .limit(limit);

//         res.render('admin/orders', {
//             title: 'Orders',
//             activePage: 'orders',
//             orders,
//             selectedStatus,
//             currentPage,
//             totalPages
//         });

//     } catch (error) {
//         next(error);
//     }
// };


// // GET /admin/orders/:id
// // Display order details
// detail = async (req, res, next) => {
//     try {

//         const order = await Order.findById(req.params.id)
//             .populate('user', 'name email phone');

//         if (!order) {
//             req.flash('error', 'Order not found');
//             return res.redirect('/admin/orders');
//         }

//         const statusFlow = {
//             Pending: ['Processing'],
//             Processing: ['Shipped'],
//             Shipped: ['Delivered'],
//             Delivered: [],
//             Cancelled: []
//         };

//         const nextStatuses = statusFlow[order.status] || [];

//         res.render('admin/order-detail', {
//             title: 'Order details',
//             activePage: 'orders',
//             order,
//             nextStatuses
//         });

//     } catch (error) {
//         next(error);
//     }
// };


// // POST /admin/orders/:id/status
// // Update order status
// updateStatus = async (req, res, next) => {
//     try {

//         const { status } = req.body;

//         const order = await Order.findById(req.params.id);

//         if (!order) {
//             req.flash('error', 'Order not found');
//             return res.redirect('/admin/orders');
//         }

//         const statusFlow = {
//             Pending: 'Processing',
//             Processing: 'Shipped',
//             Shipped: 'Delivered'
//         };

//         const nextStatus = statusFlow[order.status];

//         if (!nextStatus || status !== nextStatus) {
//             req.flash('error', 'Invalid order status change');
//             return res.redirect(`/admin/orders/${order._id}`);
//         }

//         order.status = status;

//         // COD payment is considered paid on delivery
//         if (
//             order.paymentMethod === 'COD' &&
//             status === 'Delivered'
//         ) {
//             order.paymentStatus = 'Paid';
//         }

//         await order.save();

//         req.flash('success', 'Order status updated successfully');

//         res.redirect(`/admin/orders/${order._id}`);

//     } catch (error) {
//         next(error);
//     }
// };


// module.exports={
//     list,
//     detail,
//     updateStatus

// }