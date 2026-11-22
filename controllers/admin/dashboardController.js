
const User = require('../../models/User');
const Product = require('../../models/Product');
const Order = require('../../models/Order');

// A1: Admin Dashboard
const getDashboard = async (req, res, next) => {
    try {

        const [
            totalUsers,
            totalProducts,
            totalOrders,
            salesResult,
            statusResult,
            recentOrders,
            lowStockProducts
        ] = await Promise.all([

            // 1. Total users (exclude admin accounts)
            User.countDocuments({ role: 'user' }),

            // 2. Total products
            Product.countDocuments(),

            // 3. Total orders
            Order.countDocuments(),

            // 4. Total sales
            Order.aggregate([
                {
                    $match: {
                        status: {
                            $nin: ['Cancelled', 'Payment Failed']
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalSales: {
                            $sum: '$totalAmount'
                        }
                    }
                }
            ]),

            // 5. Orders grouped by status
            Order.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]),

            // 6. Five most recent orders
            Order.find()
                .populate('user', 'name email')
                .sort({ createdAt: -1 })
                .limit(5)
                .lean(),

            // 7. Products with stock 5 or less
            Product.find({
                stock: { $lte: 5 }
            })
                .sort({ stock: 1 })
                .limit(10)
                .lean()
        ]);

        // Calculate total sales
        const totalSales = salesResult.length > 0
            ? salesResult[0].totalSales
            : 0;

        // Convert order status results into an object
        const ordersByStatus = {
            Pending: 0,
            Processing: 0,
            Shipped: 0,
            Delivered: 0,
            Cancelled: 0,
            'Payment Failed': 0
        };

        statusResult.forEach(item => {
            ordersByStatus[item._id] = item.count;
        });

        // Statistics expected by dashboard.ejs
        const stats = {
            totalUsers,
            totalProducts,
            totalOrders,
            totalSales
        };

        // Render dashboard
        res.render('admin/dashboard', {
            title: 'Dashboard',
            activePage: 'dashboard',
            stats,
            ordersByStatus,
            recentOrders,
            lowStockProducts
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    getDashboard
};
