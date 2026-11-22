
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    items: [
        {
            product: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product'
            },

            name: {
                type: String,
                required: true
            },

            image: String,

            price: {
                type: Number,
                required: true
            },

            quantity: {
                type: Number,
                required: true
            }
        }
    ],

    // Copied delivery address
    address: {
        fullName: String,
        phone: String,
        street: String,
        city: String,
        state: String,
        pincode: String
    },

    subtotal: {
        type: Number,
        required: true
    },

    discount: {
        type: Number,
        default: 0
    },

    totalAmount: {
        type: Number,
        required: true
    },

    couponCode: {
        type: String,
        default: null
    },

    paymentMethod: {
    type: String,
    enum: ['COD', 'ONLINE'],
    default: 'COD'
},
    paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed'],
    default: 'Pending'
},
    razorpayOrderId: {
        type: String,
        default: null
    },
    razorpayPaymentId: {
        type: String,
        default: null
    },
    razorpaySignature: {
    type: String,
    default: null
},

stockReserved: {
    type: Boolean,
    default: false
},

refundStatus: {
    type: String,
    enum: ['None', 'Refund Pending', 'Refunded'],
    default: 'None'
},

    status: {
        type: String,
        enum: [
            'Pending',
            'Processing',
            'Shipped',
            'Delivered',
            'Cancelled',
            'Payment Failed'
        ],
        default: 'Pending'
    }

}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
