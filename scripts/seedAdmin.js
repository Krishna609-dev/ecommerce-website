
require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

async function seedAdmin() {
    try {
        await connectDB();

        const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        const password = process.env.ADMIN_PASSWORD;

        if (!email || !password) {
            throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required in .env');
        }

        if (password.length < 6) {
            throw new Error('Admin password must contain at least 6 characters');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        let admin = await User.findOne({ email });

        if (admin) {
            // Only use this for an account you own and intend to make admin.
            admin.role = 'admin';
            admin.password = hashedPassword;
            admin.isVerified = true;
            admin.isBlocked = false;
            admin.otp = undefined;
            admin.otpExpiry = undefined;

            await admin.save();
        } else {
            await User.create({
                name: 'Admin',
                email,
                password: hashedPassword,
                role: 'admin',
                isVerified: true,
                isBlocked: false
            });
        }

        console.log('Admin account is ready. You can log in without OTP.');
    } catch (error) {
        console.error('Seed admin failed:', error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

seedAdmin();
