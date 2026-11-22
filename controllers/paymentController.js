

const crypto = require('crypto');

const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const User = require('../models/User');

const getRazorpay = require('../utils/razorpay');
const sendOrderEmail = require('../utils/sendOrderEmail');


// Verify Razorpay payment
const verifyPayment = async (req, res) => {
    try {
        const {
            orderId,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        // Check required payment details
        if (
            !orderId ||
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !razorpay_signature
        ) {
            return res.status(400).json({
                success: false,
                message: 'Missing payment details'
            });
        }

        // Find the order belonging to the logged-in user
        const order = await Order.findOne({
            _id: orderId,
            user: req.session.userId,
            paymentMethod: 'ONLINE'
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Prevent duplicate payment verification
        if (order.paymentStatus === 'Paid') {
            if (order.razorpayPaymentId !== razorpay_payment_id) {
                return res.status(400).json({
                    success: false,
                    message: 'This order has already been paid'
                });
            }

            await Cart.deleteOne({
                user: req.session.userId
            });

            return res.json({
                success: true,
                orderId: order._id,
                message: 'Payment already verified'
            });
        }

        // Check order status
        if (
            order.paymentStatus !== 'Pending' ||
            order.status === 'Cancelled' ||
            order.stockReserved !== true
        ) {
            return res.status(400).json({
                success: false,
                message: 'Order is not eligible for payment'
            });
        }

        // Verify Razorpay order ID
        if (order.razorpayOrderId !== razorpay_order_id) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Razorpay order ID'
            });
        }

        // Check Razorpay secret
        if (!process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({
                success: false,
                message: 'Razorpay secret is not configured'
            });
        }

        // Generate expected signature
        const body = razorpay_order_id + '|' + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        // Compare signatures safely
        const signatureBuffer = Buffer.from(razorpay_signature, 'hex');
        const expectedBuffer = Buffer.from(expectedSignature, 'hex');

        if (
            signatureBuffer.length !== expectedBuffer.length ||
            !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }

        // Fetch payment details from Razorpay
        const razorpay = getRazorpay();

        const payment = await razorpay.payments.fetch(
            razorpay_payment_id
        );

        // Verify payment details
        if (
            payment.order_id !== razorpay_order_id ||
            payment.status !== 'captured' ||
            payment.amount !== Math.round(order.totalAmount * 100) ||
            payment.currency !== 'INR'
        ) {
            return res.status(400).json({
                success: false,
                message: 'Payment verification failed'
            });
        }

        // Update order only after successful verification
        const updatedOrder = await Order.findOneAndUpdate(
            {
                _id: order._id,
                user: req.session.userId,
                paymentStatus: 'Pending',
                status: 'Pending',
                stockReserved: true,
                razorpayOrderId: razorpay_order_id
            },
            {
                $set: {
                    razorpayPaymentId: razorpay_payment_id,
                    razorpaySignature: razorpay_signature,
                    paymentStatus: 'Paid',
                    status: 'Processing'
                }
            },
            { new: true }
        );

        // Handle case where order was updated by another request
        if (!updatedOrder) {
            const latestOrder = await Order.findOne({
                _id: order._id,
                user: req.session.userId
            });

            if (
                latestOrder &&
                latestOrder.paymentStatus === 'Paid' &&
                latestOrder.razorpayPaymentId === razorpay_payment_id
            ) {
                return res.json({
                    success: true,
                    orderId: latestOrder._id,
                    message: 'Payment already verified'
                });
            }

            return res.status(400).json({
                success: false,
                message: 'Order could not be updated'
            });
        }

        // Clear cart only after verified payment
        await Cart.deleteOne({
            user: req.session.userId
        });

        // Send order confirmation email
        try {
            const customer = await User.findById(req.session.userId);

            if (customer && customer.email) {
                await sendOrderEmail(customer.email, updatedOrder);

                console.log(
                    'Razorpay order confirmation email sent successfully'
                );
            } else {
                console.log('Customer email not found');
            }
        } catch (emailError) {
            // Email failure should not cancel a successful payment
            console.error(
                'Razorpay order email failed:',
                emailError
            );
        }

        req.flash(
            'success',
            'Your order has been placed successfully'
        );
        // return res.redirect('/');

        return res.json({
            success: true,
            orderId: updatedOrder._id,
            message: 'Payment verified successfully'
        });

    } catch (error) {
        console.error('Payment verification error:', error);

        return res.status(500).json({
            success: false,
            message: 'Payment verification failed'
        });
    }
};


// Handle payment failure
const paymentFailed = async (req, res) => {
    try {
        const { orderId } = req.body;

        const order = await Order.findOne({
            _id: orderId,
            user: req.session.userId
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        req.flash(
            'error',
            'Payment failed. Please try again.'
        );

        return res.json({
            success: false,
            message: 'Payment failed'
        });

    } catch (error) {
        console.error('Payment failure error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to process payment failure'
        });
    }
};


module.exports = {
    verifyPayment,
    paymentFailed
};










// const crypto = require('crypto');

// const Order = require('../models/Order');
// const Product = require('../models/Product');
// const Cart = require('../models/Cart');
// const getRazorpay = require('../utils/razorpay');


// // Verify Razorpay payment
// const verifyPayment = async (req, res) => {
//     try {
//         const {
//             orderId,
//             razorpay_order_id,
//             razorpay_payment_id,
//             razorpay_signature
//         } = req.body;

//         const order = await Order.findOne({
//             _id: orderId,
//             user: req.session.userId,
//             paymentMethod: 'ONLINE'
//         });

//         if (!order) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Order not found'
//             });
//         }

//         if (order.paymentStatus === 'Paid') {
//             req.flash('success', 'Your order has been placed successfully');
//             return res.json({
//                 success: true,
//                 orderId: order._id
//             });
//         }

//         if (
//             !order.razorpayOrderId ||
//             order.razorpayOrderId !== razorpay_order_id
//         ) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid Razorpay order'
//             });
//         }

//         // Verify signature
//         const generatedSignature = crypto
//             .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
//             .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//             .digest('hex');

//         const signatureBuffer = Buffer.from(generatedSignature);
//         const receivedBuffer = Buffer.from(razorpay_signature || '');

//         if (
//             signatureBuffer.length !== receivedBuffer.length ||
//             !crypto.timingSafeEqual(signatureBuffer, receivedBuffer)
//         ) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Payment signature verification failed'
//             });
//         }

//         // Verify payment directly with Razorpay
//         const razorpay = getRazorpay();

//         const payment = await razorpay.payments.fetch(
//             razorpay_payment_id
//         );

//         if (
//             payment.order_id !== razorpay_order_id ||
//             payment.status !== 'captured' ||
//             payment.amount !== Math.round(order.totalAmount * 100)
//         ) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Payment is not captured or amount is incorrect'
//             });
//         }

//         // Update order only if it is still pending
//         const updatedOrder = await Order.findOneAndUpdate(
//             {
//                 _id: order._id,
//                 paymentStatus: 'Pending',
//                 razorpayOrderId: razorpay_order_id
//             },
//             {
//                 $set: {
//                     razorpayPaymentId: razorpay_payment_id,
//                     paymentStatus: 'Paid',
//                     status: 'Processing'
//                 }
//             },
//             { new: true }
//         );

//         if (!updatedOrder) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Order payment status has already changed'
//             });
//         }

//         // Clear cart only after verified payment
//         // Clear cart only after verified payment
//        await Cart.deleteOne({ user: req.session.userId });

// req.flash('success', 'Your order has been placed successfully');

// return res.json({
//     success: true,
//     orderId: updatedOrder._id
// });

//     } catch (error) {
//         console.error('Payment verification error:', error);

//         return res.status(500).json({
//             success: false,
//             message: 'Payment verification failed'
//         });
//     }
// };


// // Handle failed or dismissed payment
// const paymentFailed = async (req, res) => {
//     try {
//         const { orderId } = req.body;

//         // Atomically mark failed and release stock only once
//         const order = await Order.findOneAndUpdate(
//             {
//                 _id: orderId,
//                 user: req.session.userId,
//                 paymentMethod: 'ONLINE',
//                 paymentStatus: 'Pending',
//                 stockReserved: true
//             },
//             {
//                 $set: {
//                     paymentStatus: 'Failed',
//                     status: 'Payment Failed',
//                     stockReserved: false
//                 }
//             },
//             { new: true }
//         );

//         if (order) {
//             for (const item of order.items) {
//                 await Product.updateOne(
//                     { _id: item.product },
//                     { $inc: { stock: item.quantity } }
//                 );
//             }
//         }

//         return res.json({
//             success: true,
//             message: 'Payment failure handled'
//         });

//     } catch (error) {
//         console.error('Payment failure error:', error);

//         return res.status(500).json({
//             success: false,
//             message: 'Could not update payment status'
//         });
//     }
// };

// module.exports = {
//     verifyPayment,
//     paymentFailed
// };