
const User = require('../models/User');
const Otp = require('../models/Otp');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const generateOtp = require('../utils/generateOtp');
const sendEmail = require('../utils/sendEmail');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

const mergeGuestCart = async (userId, guestCart) => {
    if (!Array.isArray(guestCart) || guestCart.length === 0) {
        return;
    }

    const validGuestItems = guestCart.filter(item =>
        item &&
        mongoose.isValidObjectId(item.product) &&
        Number.isSafeInteger(item.quantity) &&
        item.quantity > 0
    );

    if (validGuestItems.length === 0) {
        return;
    }

    const productIds = [...new Set(validGuestItems.map(item => String(item.product)))];
    const products = await Product.find({
        _id: { $in: productIds },
        isActive: true
    });
    const productsById = new Map(
        products.map(product => [String(product._id), product])
    );

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
        cart = new Cart({ user: userId, items: [] });
    }

    for (const guestItem of validGuestItems) {
        const product = productsById.get(String(guestItem.product));

        if (!product || product.stock < 1) {
            continue;
        }

        const existingItem = cart.items.find(
            item => String(item.product) === String(product._id)
        );
        const currentQuantity = existingItem ? existingItem.quantity : 0;
        const quantity = Math.min(
            currentQuantity + guestItem.quantity,
            product.stock
        );

        if (existingItem) {
            existingItem.quantity = quantity;
        } else {
            cart.items.push({ product: product._id, quantity });
        }
    }

    await cart.save();
};

// ==========================================
// REGISTRATION
// ==========================================

// Display registration page
const showRegister = async (req, res, next) => {
    try {
        res.render('auth/register', {
            title: 'Create your account',
            old: { name: '', email: '' },
            errors: []
        });
    } catch (error) {
        next(error);
    }
};

// Register user and send OTP
const register = async (req, res, next) => {
    try {
        const name = String(req.body.name || '');
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');
        const confirmPassword = String(req.body.confirmPassword || '');
        // console.log(name);
        const errors = [];

        // Validate name
        const namePattern = /^[A-Za-z]+(?: [A-Za-z]+)*$/;

        if (!name) {
            errors.push({ msg: 'Name is required.' });
        } else if (!namePattern.test(name)) {
            errors.push({
                msg: 'Name must contain only letters with single spaces between words. No numbers, symbols, or spaces at the beginning or end.'
            });
        }

        // Validate email
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email) {
            errors.push({ msg: 'Email is required.' });
        } else if (!emailPattern.test(email)) {
            errors.push({
                msg: 'Please enter a valid email address.'
            });
        }

        // Validate password
        if (password.length < 6) {
            errors.push({
                msg: 'Password must contain at least 6 characters.'
            });
        }

        // Validate confirm password
        if (password !== confirmPassword) {
            errors.push({
                msg: 'Passwords do not match.'
            });
        }

        // Display validation errors
        if (errors.length > 0) {
            return res.status(400).render('auth/register', {
                title: 'Create your account',
                old,
                errors
            });
        }

        // Check whether the email already exists
        const existingUser = await User.findOne({ email });

        if (existingUser && existingUser.isVerified) {
            return res.status(400).render('auth/register', {
                title: 'Create your account',
                old,
                errors: [
                    { msg: 'This email is already registered.' }
                ]
            });
        }

        // Generate OTP
        const otp = generateOtp();
        const hashedPassword = await bcrypt.hash(password, 10);

        if (existingUser) {
            // Update an existing unverified registration
            existingUser.name = name;
            existingUser.password = hashedPassword;
            existingUser.otp = otp;
            existingUser.otpExpiry = new Date(
                Date.now() + 10 * 60 * 1000
            );

            await existingUser.save();
        } else {
            // Create a new unverified user
            await User.create({
                name,
                email,
                password: hashedPassword,
                otp,
                otpExpiry: new Date(
                    Date.now() + 10 * 60 * 1000
                )
            });
        }

        // Send registration OTP
        await sendEmail(email, otp);

        req.session.flashMessage = {
            type: 'success',
            message: 'Verification code sent. Check your email or terminal.'
        };

        return res.redirect(
            `/verify-otp?email=${encodeURIComponent(email)}`
        );

    } catch (error) {
        next(error);
    }
};


// ==========================================
// EMAIL OTP VERIFICATION
// ==========================================

// Display OTP verification page
const showVerifyOTP = async (req, res, next) => {
    try {
        res.render('auth/verify-otp', {
            email: String(req.query.email || '').trim().toLowerCase(),
            errors: []
        });
    } catch (error) {
        next(error);
    }
};

// Verify registration OTP
const verifyOTP = async (req, res, next) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const otp = String(req.body.otp || '').trim();

        const user = await User.findOne({
            email,
            isVerified: false
        });

        if (
            !user ||
            !user.otp ||
            !user.otpExpiry ||
            user.otpExpiry.getTime() < Date.now() ||
            user.otp !== otp
        ) {
            return res.status(400).render('auth/verify-otp', {
                email,
                errors: [
                    {
                        msg: 'Invalid or expired OTP. Please try again.'
                    }
                ]
            });
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpiry = undefined;

        await user.save();

        req.session.flashMessage = {
            type: 'success',
            message: 'Email verified. You can now log in.'
        };

        return res.redirect('/login');

    } catch (error) {
        next(error);
    }
};


// Resend registration OTP
const resendOTP = async (req, res, next) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();

        const user = await User.findOne({
            email,
            isVerified: false
        });

        if (!user) {
            req.session.flashMessage = {
                type: 'danger',
                message: 'Pending registration not found. Please register again.'
            };

            return res.redirect('/register');
        }

        // Generate new OTP
        const otp = generateOtp();

        user.otp = otp;
        user.otpExpiry = new Date(
            Date.now() + 10 * 60 * 1000
        );

        await user.save();

        // Send new registration OTP
        await sendEmail(email, otp);

        req.session.flashMessage = {
            type: 'success',
            message: 'A new OTP has been sent.'
        };

        return res.redirect(
            `/verify-otp?email=${encodeURIComponent(email)}`
        );

    } catch (error) {
        next(error);
    }
};


// ==========================================
// LOGIN
// ==========================================

// Display login page
const showLogin = async (req, res, next) => {
    try {
        res.render('auth/login', {
            title: 'Welcome back',
            old: { email: '' },
            errors: []
        });
    } catch (error) {
        next(error);
    }
};


// Login user


const login = async (req, res, next) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');

        const user = await User.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).render('auth/login', {
                title: 'Welcome back',
                old: { email },
                errors: [
                    { msg: 'Invalid email or password.' }
                ]
            });
        }

        if (!user.isVerified) {
            return res.redirect(
                `/verify-otp?email=${encodeURIComponent(email)}`
            );
        }

        if (user.isBlocked) {
            return res.status(403).render('auth/login', {
                title: 'Welcome back',
                old: { email },
                errors: [
                    { msg: 'Your account has been blocked.' }
                ]
            });
        }

        if (user.role === 'admin') {
            return res.status(403).render('auth/login', {
                title: 'Welcome back',
                old: { email },
                errors: [
                    { msg: 'Please sign in through the admin login page.' }
                ]
            });
        }

        // Save guest cart and requested URL before session regeneration
        const guestCart = req.session.guestCart || [];
        const returnTo = req.session.returnTo;

        // Regenerate session
        req.session.regenerate(async error => {
            if (error) {
                return next(error);
            }

            try {
                req.session.userId = user._id.toString();

                // Merge guest cart into MongoDB cart
                await mergeGuestCart(user._id, guestCart);

                // Choose redirect destination
                const redirectTo =
                    typeof returnTo === 'string' &&
                    /^\/checkout(?:[/?#]|$)/.test(returnTo)
                        ? returnTo
                        : '/';

                // Save new session
                req.session.save(saveError => {
                    if (saveError) return next(saveError);

                    return res.redirect(redirectTo);
                });

            } catch (error) {
                next(error);
            }
        });

    } catch (error) {
        next(error);
    }
};



// ==========================================
// LOGOUT
// ==========================================

const logout = (req, res, next) => {
    try {
        req.session.destroy(error => {
            if (error) {
                return next(error);
            }

            res.clearCookie('connect.sid');
            return res.redirect('/login');
        });
    } catch (error) {
        next(error);
    }
};


// ==========================================
// FORGOT PASSWORD
// ==========================================

// Display forgot password page
const showForgotPassword = (req, res) => {
    res.render('auth/forgot-password', {
        title: 'Forgot password',
        errors: []
    });
};


// Send password reset OTP
const forgotPassword = async (req, res, next) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email)) {
            return res.status(400).render('auth/forgot-password', {
                title: 'Forgot password',
                errors: [
                    { msg: 'Please enter a valid email address.' }
                ]
            });
        }

        const user = await User.findOne({
            email,
            isVerified: true
        });

        // Do not reveal whether an email is registered
        if (user) {
            const otp = String(generateOtp());
            const hashedOtp = await bcrypt.hash(otp, 10);

            // Delete previous password reset OTP
            await Otp.deleteMany({ email });

            // Save new hashed OTP
            await Otp.create({
                email,
                otp: hashedOtp,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000)
            });

            // Send password reset email
            await sendEmail(email, otp, 'password-reset');
        }

        req.session.flashMessage = {
            type: 'success',
            message: 'If an account exists with that email, a password reset OTP has been sent.'
        };

        return res.redirect(
            `/reset-password?email=${encodeURIComponent(email)}`
        );

    } catch (error) {
        next(error);
    }
};


// ==========================================
// RESET PASSWORD
// ==========================================

// Display reset password page
const showResetPassword = (req, res) => {
    const email = String(req.query.email || '').trim().toLowerCase();

    if (!email) {
        req.session.flashMessage = {
            type: 'danger',
            message: 'Please enter your email first.'
        };

        return res.redirect('/forgot-password');
    }

    return res.render('auth/reset-password', {
        title: 'Reset password',
        email,
        errors: []
    });
};


// Verify reset OTP and update password
const resetPassword = async (req, res, next) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const otp = String(req.body.otp || '').trim();
        const password = String(req.body.password || '');
        const confirmPassword = String(req.body.confirmPassword || '');

        const errors = [];

        // Validate email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push({ msg: 'Invalid email address.' });
        }

        // Validate OTP
        if (!/^\d{6}$/.test(otp)) {
            errors.push({ msg: 'Enter a valid 6-digit OTP.' });
        }

        // Validate new password
        if (password.length < 6) {
            errors.push({
                msg: 'Password must contain at least 6 characters.'
            });
        }

        // Confirm password
        if (password !== confirmPassword) {
            errors.push({ msg: 'Passwords do not match.' });
        }

        if (errors.length > 0) {
            return res.status(400).render('auth/reset-password', {
                title: 'Reset password',
                email,
                errors
            });
        }

        // Find valid and unexpired reset OTP
        const otpRecord = await Otp.findOne({
            email,
            expiresAt: { $gt: new Date() },
            attempts: { $lt: 5 }
        });

        if (!otpRecord) {
            return res.status(400).render('auth/reset-password', {
                title: 'Reset password',
                email,
                errors: [{
                    msg: 'OTP is invalid or expired. Please request a new OTP.'
                }]
            });
        }

        // Compare entered OTP with stored hash
        const isOtpValid = await bcrypt.compare(otp, otpRecord.otp);

        if (!isOtpValid) {
            otpRecord.attempts += 1;
            await otpRecord.save();

            if (otpRecord.attempts >= 5) {
                await Otp.deleteOne({ _id: otpRecord._id });
            }

            return res.status(400).render('auth/reset-password', {
                title: 'Reset password',
                email,
                errors: [{
                    msg: otpRecord.attempts >= 5
                        ? 'Too many incorrect attempts. Please request a new OTP.'
                        : 'Incorrect OTP. Please try again.'
                }]
            });
        }

        // Find verified user
        const user = await User.findOne({
            email,
            isVerified: true
        });

        if (!user) {
            return res.status(400).render('auth/reset-password', {
                title: 'Reset password',
                email,
                errors: [{
                    msg: 'Unable to reset password. Please request a new OTP.'
                }]
            });
        }

        // Prevent blocked users from resetting passwords
        if (user.isBlocked) {
            return res.status(403).render('auth/reset-password', {
                title: 'Reset password',
                email,
                errors: [{
                    msg: 'Your account is blocked. Please contact support.'
                }]
            });
        }

        // Hash and update new password
        user.password = await bcrypt.hash(password, 10);
        await user.save();

        // Delete used reset OTP
        await Otp.deleteMany({ email });

        req.session.flashMessage = {
            type: 'success',
            message: 'Password reset successfully. Please log in.'
        };

        return res.redirect('/login');

    } catch (error) {
        next(error);
    }
};


// ==========================================
// EXPORT ALL CONTROLLER FUNCTIONS
// ==========================================

module.exports = {
    showRegister,
    register,
    showVerifyOTP,
    verifyOTP,
    resendOTP,
    showLogin,
    login,
    mergeGuestCart,    
    logout,
    showForgotPassword,
    forgotPassword,
    showResetPassword,
    resetPassword
};









// const User = require('../models/User');
// const bcrypt = require('bcryptjs');

// const generateOtp = require('../utils/generateOtp');
// const sendEmail = require('../utils/sendEmail');
// const Otp = require('../models/Otp');

// // Display registration page
// const showRegister = async (req, res, next) => {
//     try {
//         res.render('auth/register', {
//             title: 'Create your account',
//             old: { name: '', email: '' },
//             errors: []
//         });
//     } catch (error) {
//         next(error);
//     }
// };

// // Register user and send OTP
// const register = async (req, res, next) => {
//     try {
//         const name = String(req.body.name || '');
//         const email = String(req.body.email || '').trim().toLowerCase();
//         const password = String(req.body.password || '');
//         const confirmPassword = String(req.body.confirmPassword || '');

//         const old = { name, email };
//         const errors = [];

//         // Validate name
//         const namePattern = /^[A-Za-z]+(?: [A-Za-z]+)*$/;

//         if (!name) {
//             errors.push({ msg: 'Name is required.' });
//         } else if (!namePattern.test(name)) {
//             errors.push({
//                 msg: 'Name must contain only letters with single spaces between words. No numbers, symbols, or spaces at the beginning or end.'
//             });
//         }

//         // Validate email
//         const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

//         if (!email) {
//             errors.push({ msg: 'Email is required.' });
//         } else if (!emailPattern.test(email)) {
//             errors.push({
//                 msg: 'Please enter a valid email address.'
//             });
//         }

//         // Validate password
//         if (password.length < 6) {
//             errors.push({
//                 msg: 'Password must contain at least 6 characters.'
//             });
//         }

//         // Validate confirm password
//         if (password !== confirmPassword) {
//             errors.push({
//                 msg: 'Passwords do not match.'
//             });
//         }

//         // Display validation errors
//         if (errors.length > 0) {
//             return res.status(400).render('auth/register', {
//                 title: 'Create your account',
//                 old,
//                 errors
//             });
//         }

//         // Check whether the email already exists
//         const existingUser = await User.findOne({ email });

//         if (existingUser && existingUser.isVerified) {
//             return res.status(400).render('auth/register', {
//                 title: 'Create your account',
//                 old,
//                 errors: [
//                     { msg: 'This email is already registered.' }
//                 ]
//             });
//         }

//         // Generate OTP using utils
//         const otp = generateOtp();
//         const hashedPassword = await bcrypt.hash(password, 10);

//         if (existingUser) {
//             // Update an existing unverified registration
//             existingUser.name = name;
//             existingUser.password = hashedPassword;
//             existingUser.otp = otp;
//             existingUser.otpExpiry = new Date(
//                 Date.now() + 10 * 60 * 1000
//             );

//             await existingUser.save();
//         } else {
//             // Create a new unverified user
//             await User.create({
//                 name,
//                 email,
//                 password: hashedPassword,
//                 otp,
//                 otpExpiry: new Date(
//                     Date.now() + 10 * 60 * 1000
//                 )
//             });
//         }

//         // Send OTP using utils
//         await sendEmail(email, otp);

//         req.session.flashMessage = {
//             type: 'success',
//             message: 'Verification code sent. Check your email or terminal.'
//         };

//         return res.redirect(
//             `/verify-otp?email=${encodeURIComponent(email)}`
//         );
//     } catch (error) {
//         next(error);
//     }
// };

// // Display OTP verification page
// const showVerifyOTP = async (req, res, next) => {
//     try {
//         res.render('auth/verify-otp', {
//             email: String(req.query.email || '').trim().toLowerCase(),
//             errors: []
//         });
//     } catch (error) {
//         next(error);
//     }
// };

// // Verify OTP
// const verifyOTP = async (req, res, next) => {
//     try {
//         const email = String(req.body.email || '').trim().toLowerCase();
//         const otp = String(req.body.otp || '').trim();

//         const user = await User.findOne({
//             email,
//             isVerified: false
//         });

//         if (
//             !user ||
//             !user.otp ||
//             !user.otpExpiry ||
//             user.otpExpiry.getTime() < Date.now() ||
//             user.otp !== otp
//         ) {
//             return res.status(400).render('auth/verify-otp', {
//                 email,
//                 errors: [
//                     {
//                         msg: 'Invalid or expired OTP. Please try again.'
//                     }
//                 ]
//             });
//         }

//         user.isVerified = true;
//         user.otp = undefined;
//         user.otpExpiry = undefined;

//         await user.save();

//         req.session.flashMessage = {
//             type: 'success',
//             message: 'Email verified. You can now log in.'
//         };

//         return res.redirect('/login');
//     } catch (error) {
//         next(error);
//     }
// };

// // Resend OTP
// const resendOTP = async (req, res, next) => {
//     try {
//         const email = String(req.body.email || '').trim().toLowerCase();

//         const user = await User.findOne({
//             email,
//             isVerified: false
//         });

//         if (!user) {
//             req.session.flashMessage = {
//                 type: 'danger',
//                 message: 'Pending registration not found. Please register again.'
//             };

//             return res.redirect('/register');
//         }

//         // Generate a new OTP using utils
//         const otp = generateOtp();

//         user.otp = otp;
//         user.otpExpiry = new Date(
//             Date.now() + 10 * 60 * 1000
//         );

//         await user.save();

//         // Send the new OTP using utils
//         await sendEmail(email, otp);

//         req.session.flashMessage = {
//             type: 'success',
//             message: 'A new OTP has been sent.'
//         };

//         return res.redirect(
//             `/verify-otp?email=${encodeURIComponent(email)}`
//         );
//     } catch (error) {
//         next(error);
//     }
// };

// // Display login page
// const showLogin = async (req, res, next) => {
//     try {
//         res.render('auth/login', {
//             title: 'Welcome back',
//             old: { email: '' },
//             errors: []
//         });
//     } catch (error) {
//         next(error);
//     }
// };

// // Login user
// const login = async (req, res, next) => {
//     try {
//         const email = String(req.body.email || '').trim().toLowerCase();
//         const password = String(req.body.password || '');

//         const user = await User.findOne({ email });

//         if (!user || !(await bcrypt.compare(password, user.password))) {
//             return res.status(400).render('auth/login', {
//                 title: 'Welcome back',
//                 old: { email },
//                 errors: [
//                     { msg: 'Invalid email or password.' }
//                 ]
//             });
//         }

//         if (!user.isVerified) {
//             return res.redirect(
//                 `/verify-otp?email=${encodeURIComponent(email)}`
//             );
//         }

//         if (user.isBlocked) {
//             return res.status(403).render('auth/login', {
//                 title: 'Welcome back',
//                 old: { email },
//                 errors: [
//                     { msg: 'Your account has been blocked.' }
//                 ]
//             });
//         }

//         // Regenerate the session after successful login
//         req.session.regenerate(error => {
//             if (error) {
//                 return next(error);
//             }

//             req.session.userId = user._id.toString();

//             req.session.save(saveError => {
//                 if (saveError) {
//                     return next(saveError);
//                 }

//                 if (user.role === 'admin') {
//                     return res.redirect('/admin/categories');
//                 }

//                 return res.redirect('/');
//             });
//         });
//     } catch (error) {
//         next(error);
//     }
// };

// // Logout user
// const logout = (req, res, next) => {
//     try {
//         req.session.destroy(error => {
//             if (error) {
//                 return next(error);
//             }

//             res.clearCookie('connect.sid');
//             return res.redirect('/login');
//         });
//     } catch (error) {
//         next(error);
//     }
// };



// // Display forgot password page
// const showForgotPassword = (req, res) => {
//     res.render('auth/forgot-password', {
//         title: 'Forgot password',
//         errors: []
//     });
// };


// // Send password reset OTP
// const forgotPassword = async (req, res, next) => {
//     try {
//         const email = String(req.body.email || '').trim().toLowerCase();

//         const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

//         if (!emailPattern.test(email)) {
//             return res.status(400).render('auth/forgot-password', {
//                 title: 'Forgot password',
//                 errors: [{ msg: 'Please enter a valid email address.' }]
//             });
//         }

//         const user = await User.findOne({
//             email,
//             isVerified: true
//         });

//         // Do not reveal whether an email is registered
//         if (user) {
//             const otp = String(generateOtp());
//             const hashedOtp = await bcrypt.hash(otp, 10);

//             // Delete any previous reset OTP for this email
//             await Otp.deleteMany({ email });

//             // Save new reset OTP
//             await Otp.create({
//                 email,
//                 otp: hashedOtp,
//                 expiresAt: new Date(Date.now() + 10 * 60 * 1000)
//             });

//             // Use your existing email utility
//             await sendEmail(email, otp);
//         }

//         req.session.flashMessage = {
//             type: 'success',
//             message: 'If an account exists with that email, a password reset OTP has been sent.'
//         };

//         return res.redirect(
//             `/reset-password?email=${encodeURIComponent(email)}`
//         );

//     } catch (error) {
//         next(error);
//     }
// };


// // Display reset password page
// const showResetPassword = (req, res) => {
//     const email = String(req.query.email || '').trim().toLowerCase();

//     if (!email) {
//         req.session.flashMessage = {
//             type: 'danger',
//             message: 'Please enter your email first.'
//         };

//         return res.redirect('/forgot-password');
//     }

//     res.render('auth/reset-password', {
//         title: 'Reset password',
//         email,
//         errors: []
//     });
// };


// // Verify OTP and update password
// const resetPassword = async (req, res, next) => {
//     try {
//         const email = String(req.body.email || '').trim().toLowerCase();
//         const otp = String(req.body.otp || '').trim();
//         const password = String(req.body.password || '');
//         const confirmPassword = String(req.body.confirmPassword || '');

//         const errors = [];

//         if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
//             errors.push({ msg: 'Invalid email address.' });
//         }

//         if (!/^\d{6}$/.test(otp)) {
//             errors.push({ msg: 'Enter a valid 6-digit OTP.' });
//         }

//         if (password.length < 6) {
//             errors.push({ msg: 'Password must contain at least 6 characters.' });
//         }

//         if (password !== confirmPassword) {
//             errors.push({ msg: 'Passwords do not match.' });
//         }

//         if (errors.length > 0) {
//             return res.status(400).render('auth/reset-password', {
//                 title: 'Reset password',
//                 email,
//                 errors
//             });
//         }

//         // Find a valid, unexpired reset OTP
//         const otpRecord = await Otp.findOne({
//             email,
//             expiresAt: { $gt: new Date() },
//             attempts: { $lt: 5 }
//         });

//         if (!otpRecord) {
//             return res.status(400).render('auth/reset-password', {
//                 title: 'Reset password',
//                 email,
//                 errors: [{
//                     msg: 'OTP is invalid or expired. Please request a new OTP.'
//                 }]
//             });
//         }

//         // Compare entered OTP with its stored hash
//         const isOtpValid = await bcrypt.compare(otp, otpRecord.otp);

//         if (!isOtpValid) {
//             otpRecord.attempts += 1;
//             await otpRecord.save();

//             if (otpRecord.attempts >= 5) {
//                 await Otp.deleteOne({ _id: otpRecord._id });
//             }

//             return res.status(400).render('auth/reset-password', {
//                 title: 'Reset password',
//                 email,
//                 errors: [{
//                     msg: otpRecord.attempts >= 5
//                         ? 'Too many incorrect attempts. Please request a new OTP.'
//                         : 'Incorrect OTP. Please try again.'
//                 }]
//             });
//         }

//         // Find the verified account
//         const user = await User.findOne({
//             email,
//             isVerified: true
//         });

//         if (!user) {
//             return res.status(400).render('auth/reset-password', {
//                 title: 'Reset password',
//                 email,
//                 errors: [{
//                     msg: 'Unable to reset password. Please request a new OTP.'
//                 }]
//             });
//         }

//         // Hash and save the new password
//         user.password = await bcrypt.hash(password, 10);
//         await user.save();

//         // Delete the used reset OTP
//         await Otp.deleteMany({ email });

//         req.session.flashMessage = {
//             type: 'success',
//             message: 'Password reset successfully. Please log in.'
//         };

//         return res.redirect('/login');

//     } catch (error) {
//         next(error);
//     }
// };


// module.exports = {
//     showRegister,
//     register,
//     showVerifyOTP,
//     verifyOTP,
//     resendOTP,
//     showLogin,
//     login,
//     logout,
//     showForgotPassword,
//     forgotPassword,
//     showResetPassword,
//     resetPassword
// };















// // const User = require('../models/User');
// // const bcrypt = require('bcryptjs');
// // const nodemailer = require('nodemailer');
// // const crypto = require('crypto');

// // let transporter = null;

// // if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
// //     transporter = nodemailer.createTransport({
// //         service: 'gmail',
// //         auth: {
// //             user: process.env.EMAIL_USER,
// //             pass: process.env.EMAIL_PASS
// //         }
// //     });
// // }

// // // Send OTP email
// // async function sendOTP(email, otp) {
// //     try {
// //         if (transporter) {
// //             await transporter.sendMail({
// //                 from: process.env.EMAIL_USER,
// //                 to: email,
// //                 subject: 'E-commerce email verification',
// //                 text: `Your verification code is ${otp}. It expires in 10 minutes.`
// //             });
// //         } else {
// //             console.log(`OTP for ${email}: ${otp}`);
// //         }
// //     } catch (error) {
// //         throw error;
// //     }
// // }

// // // Display registration page
// // const showRegister = async (req, res, next) => {
// //     try {
// //         res.render('auth/register', {
// //             old: { name: '', email: '' },
// //             errors: []
// //         });
// //     } catch (error) {
// //         next(error);
// //     }
// // };

// // // Register user and send OTP

// // const register = async (req, res, next) => {
// //     try {
// //         const name = String(req.body.name || '');
// //         const email = String(req.body.email || '').trim().toLowerCase();
// //         const password = String(req.body.password || '');
// //         const confirmPassword = String(req.body.confirmPassword || '');

// //         const old = { name, email };
// //         const errors = [];

// //         // Validate name
// //         const namePattern = /^[A-Za-z]+(?: [A-Za-z]+)*$/;

// //         if (!name) {
// //             errors.push({ msg: 'Name is required.' });
// //         } else if (!namePattern.test(name)) {
// //             errors.push({
// //                 msg: 'Name must contain only letters with single spaces between words. No numbers, symbols, or spaces at the beginning or end.'
// //             });
// //         }

// //         // Validate email
// //         const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// //         if (!email) {
// //             errors.push({ msg: 'Email is required.' });
// //         } else if (!emailPattern.test(email)) {
// //             errors.push({
// //                 msg: 'Please enter a valid email address.'
// //             });
// //         }

// //         // Validate password
// //         if (password.length < 6) {
// //             errors.push({
// //                 msg: 'Password must contain at least 6 characters.'
// //             });
// //         }

// //         // Validate confirm password
// //         if (password !== confirmPassword) {
// //             errors.push({
// //                 msg: 'Passwords do not match.'
// //             });
// //         }

// //         // Display validation errors
// //         if (errors.length > 0) {
// //             return res.status(400).render('auth/register', {
// //                 title: 'Create your account',
// //                 old,
// //                 errors
// //             });
// //         }

// //         const existingUser = await User.findOne({ email });

// //         if (existingUser && existingUser.isVerified) {
// //             return res.status(400).render('auth/register', {
// //                 old,
// //                 errors: [{ msg: 'This email is already registered.' }]
// //             });
// //         }

// //         const otp = crypto.randomInt(100000, 1000000).toString();
// //         const hashedPassword = await bcrypt.hash(password, 10);

// //         if (existingUser) {
// //             existingUser.name = name;
// //             existingUser.password = hashedPassword;
// //             existingUser.otp = otp;
// //             existingUser.otpExpiry = new Date(
// //                 Date.now() + 10 * 60 * 1000
// //             );

// //             await existingUser.save();
// //         } else {
// //             await User.create({
// //                 name,
// //                 email,
// //                 password: hashedPassword,
// //                 otp,
// //                 otpExpiry: new Date(Date.now() + 10 * 60 * 1000)
// //             });
// //         }

// //         await sendOTP(email, otp);

// //         req.session.flashMessage = {
// //             type: 'success',
// //             message: 'Verification code sent. Check your email or terminal.'
// //         };

// //         res.redirect(`/verify-otp?email=${encodeURIComponent(email)}`);
// //     } catch (error) {
// //         next(error);
// //     }
// // };

// // // Display OTP verification page
// // const showVerifyOTP = async (req, res, next) => {
// //     try {
// //         res.render('auth/verify-otp', {
// //             email: String(req.query.email || '').trim().toLowerCase(),
// //             errors: []
// //         });
// //     } catch (error) {
// //         next(error);
// //     }
// // };

// // // Verify OTP
// // const verifyOTP = async (req, res, next) => {
// //     try {
// //         const email = String(req.body.email || '').trim().toLowerCase();
// //         const otp = String(req.body.otp || '').trim();

// //         const user = await User.findOne({
// //             email,
// //             isVerified: false
// //         });

// //         if (
// //             !user ||
// //             !user.otp ||
// //             !user.otpExpiry ||
// //             user.otpExpiry.getTime() < Date.now() ||
// //             user.otp !== otp
// //         ) {
// //             return res.status(400).render('auth/verify-otp', {
// //                 email,
// //                 errors: [{
// //                     msg: 'Invalid or expired OTP. Please try again.'
// //                 }]
// //             });
// //         }

// //         user.isVerified = true;
// //         user.otp = undefined;
// //         user.otpExpiry = undefined;

// //         await user.save();

// //         req.session.flashMessage = {
// //             type: 'success',
// //             message: 'Email verified. You can now log in.'
// //         };

// //         res.redirect('/login');
// //     } catch (error) {
// //         next(error);
// //     }
// // };

// // // Resend OTP
// // const resendOTP = async (req, res, next) => {
// //     try {
// //         const email = String(req.body.email || '').trim().toLowerCase();

// //         const user = await User.findOne({
// //             email,
// //             isVerified: false
// //         });

// //         if (!user) {
// //             req.session.flashMessage = {
// //                 type: 'danger',
// //                 message: 'Pending registration not found. Please register again.'
// //             };

// //             return res.redirect('/register');
// //         }

// //         const otp = crypto.randomInt(100000, 1000000).toString();

// //         user.otp = otp;
// //         user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

// //         await user.save();

// //         await sendOTP(email, otp);

// //         req.session.flashMessage = {
// //             type: 'success',
// //             message: 'A new OTP has been sent.'
// //         };

// //         res.redirect(`/verify-otp?email=${encodeURIComponent(email)}`);
// //     } catch (error) {
// //         next(error);
// //     }
// // };

// // // Display login page
// // const showLogin = async (req, res, next) => {
// //     try {
// //         res.render('auth/login', {
// //             old: { email: '' },
// //             errors: []
// //         });
// //     } catch (error) {
// //         next(error);
// //     }
// // };

// // // Login user
// // const login = async (req, res, next) => {
// //     try {
// //         const email = String(req.body.email || '').trim().toLowerCase();
// //         const password = String(req.body.password || '');

// //         const user = await User.findOne({ email });

// //         if (!user || !(await bcrypt.compare(password, user.password))) {
// //             return res.status(400).render('auth/login', {
// //                 old: { email },
// //                 errors: [{
// //                     msg: 'Invalid email or password.'
// //                 }]
// //             });
// //         }

// //         if (!user.isVerified) {
// //             return res.redirect(
// //                 `/verify-otp?email=${encodeURIComponent(email)}`
// //             );
// //         }

// //         if (user.isBlocked) {
// //             return res.status(403).render('auth/login', {
// //                 old: { email },
// //                 errors: [{
// //                     msg: 'Your account has been blocked.'
// //                 }]
// //             });
// //         }

// //         req.session.regenerate(error => {
// //             if (error) {
// //                 return next(error);
// //             }

// //             req.session.userId = user._id.toString();

// //             req.session.save(saveError => {
// //                 if (saveError) {
// //                     return next(saveError);
// //                 }

// //                 if (user.role === 'admin') {
// //                  return res.redirect('/admin/categories');
// // }

// // return res.redirect('/');

// //                 // if (user.role === 'admin') {
// //                 //     return res.redirect('/admin/products');
// //                 // }

// //                 // res.redirect('/shop');
// //             });
// //         });
// //     } catch (error) {
// //         next(error);
// //     }
// // };

// // // Logout user
// // const logout = (req, res, next) => {
// //     try {
// //         req.session.destroy(error => {
// //             if (error) {
// //                 return next(error);
// //             }

// //             res.clearCookie('connect.sid');
// //             res.redirect('/login');
// //         });
// //     } catch (error) {
// //         next(error);
// //     }
// // };


// // module.exports = {
// //     showRegister,
// //     register,
// //     showVerifyOTP,
// //     verifyOTP,
// //     resendOTP,
// //     showLogin,
// //     login,
// //     logout
// // };