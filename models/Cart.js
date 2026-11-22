
const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            default: 1,
            min: 1
        }
    }],
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

stockReserved: {
    type: Boolean,
    default: false
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
},
couponCode: {
    type: String,
    default: null,
    uppercase: true,
    trim: true
},
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);
