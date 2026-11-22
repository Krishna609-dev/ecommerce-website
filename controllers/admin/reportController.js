
const Order = require('../../models/Order');

// Display sales report
const salesReport = async (req, res, next) => {
    try {
        const { from = '', to = '' } = req.query;

        // Initially show the page without a report
        if (!from && !to) {
            return res.render('admin/reports', {
                title: 'Sales Report',
                activePage: 'reports',
                report: null,
                from: '',
                to: '',
                reportError: null
            });
        }

        // Validate date inputs
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;

        if (!datePattern.test(from) || !datePattern.test(to)) {
            return res.render('admin/reports', {
                title: 'Sales Report',
                activePage: 'reports',
                report: null,
                from,
                to,
                reportError: 'Please select both From and To dates.'
            });
        }

        // Convert selected dates into India time boundaries
        const startDate = new Date(`${from}T00:00:00.000+05:30`);
        const endDate = new Date(`${to}T23:59:59.999+05:30`);

        if (
            Number.isNaN(startDate.getTime()) ||
            Number.isNaN(endDate.getTime()) ||
            from > to
        ) {
            return res.render('admin/reports', {
                title: 'Sales Report',
                activePage: 'reports',
                report: null,
                from,
                to,
                reportError: 'Please select a valid date range.'
            });
        }

        // Find orders created within the selected date range
        const matchStage = {
            createdAt: {
                $gte: startDate,
                $lte: endDate
            }
        };

        // Orders that should be included in sales calculations
        const validSaleCondition = {
            $and: [
                { $not: [{ $in: ['$status', ['Cancelled', 'Payment Failed']] }] },
                { $ne: ['$paymentStatus', 'Failed'] }
            ]
        };

        // Get total order count and total sales
        const summaryResult = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,

                    totalOrders: { $sum: 1 },

                    totalSales: {
                        $sum: {
                            $cond: [
                                validSaleCondition,
                                '$totalAmount',
                                0
                            ]
                        }
                    },

                    successfulOrders: {
                        $sum: {
                            $cond: [
                                validSaleCondition,
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const summary = summaryResult[0] || {
            totalOrders: 0,
            totalSales: 0,
            successfulOrders: 0
        };

        // Get daily sales and order counts
        const daily = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt',
                            timezone: 'Asia/Kolkata'
                        }
                    },

                    orders: { $sum: 1 },

                    sales: {
                        $sum: {
                            $cond: [
                                validSaleCondition,
                                '$totalAmount',
                                0
                            ]
                        }
                    }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    _id: 0,
                    date: '$_id',
                    orders: 1,
                    sales: 1
                }
            }
        ]);

        // Count orders by status
        const statusResult = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Initialize all statuses with zero
        const statusCounts = {
            Pending: 0,
            Processing: 0,
            Shipped: 0,
            Delivered: 0,
            Cancelled: 0,
            'Payment Failed': 0
        };

        statusResult.forEach(item => {
            statusCounts[item._id] = item.count;
        });

        // Calculate average order value using eligible sales orders
        const averageOrderValue = summary.successfulOrders > 0
            ? summary.totalSales / summary.successfulOrders
            : 0;

        // Final report object expected by reports.ejs
        const report = {
            totalOrders: summary.totalOrders,
            totalSales: Number(summary.totalSales.toFixed(2)),
            averageOrderValue: Number(averageOrderValue.toFixed(2)),
            statusCounts,
            daily
        };

        res.render('admin/reports', {
            title: 'Sales Report',
            activePage: 'reports',
            report,
            from,
            to,
            reportError: null
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    salesReport
};
