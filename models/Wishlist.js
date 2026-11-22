
const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({

    // Which user owns this wishlist
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },

    // Products saved by the user
    products: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        }
    ]

}, {
    timestamps: true
});

module.exports = mongoose.model('Wishlist', wishlistSchema);
