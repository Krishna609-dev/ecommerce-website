
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {//automatically add createdAt and updatedAt fields to the schema
    timestamps: true
});

module.exports = mongoose.model('Category', categorySchema);
