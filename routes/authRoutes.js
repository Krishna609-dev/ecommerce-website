
const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');

const {
    isGuest,
    isLoggedIn
} = require('../middlewares/authMiddleware');

// Registration
router.get('/register', isGuest, authController.showRegister);
router.post('/register', isGuest, authController.register);

// OTP verification
router.get('/verify-otp', isGuest, authController.showVerifyOTP);
router.post('/verify-otp', isGuest, authController.verifyOTP);
router.post('/resend-otp', isGuest, authController.resendOTP);

// Login
router.get('/login', isGuest, authController.showLogin);
router.post('/login', isGuest, authController.login);

// Logout
router.post('/logout', isLoggedIn, authController.logout);


// Forgot password
router.get('/forgot-password', authController.showForgotPassword);
router.post('/forgot-password', authController.forgotPassword);

// Reset password
router.get('/reset-password', authController.showResetPassword);
router.post('/reset-password', authController.resetPassword);
module.exports = router;

// const express = require('express');
// const router = express.Router();
// const authController = require('../controllers/authController');

// router.get('/register', isGuest,authController.showRegister);
// router.post('/register',isGuest, authController.register);

// router.get('/verify-otp', isGuest,authController.showVerifyOTP);
// router.post('/verify-otp',isGuest,authController.verifyOTP);
// router.post('/resend-otp', IsGuest,authController.resendOTP);

// router.get('/login', isGuest,authController.showLogin);
// router.post('/login', isGuest,authController.login);
// router.get('/logout',isGuest, authController.logout);

// module.exports = router;
