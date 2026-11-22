const express = require('express');
const router = express.Router();

const paymentController = require('../controllers/paymentController');
const { isLoggedIn } = require('../middlewares/authMiddleware');

router.post('/verify', isLoggedIn, paymentController.verifyPayment);
router.post('/failed', isLoggedIn, paymentController.paymentFailed);

module.exports = router;