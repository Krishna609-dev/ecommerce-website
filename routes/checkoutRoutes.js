const express = require('express');
const router = express.Router();

const checkoutController = require('../controllers/checkoutController');
const { isLoggedIn } = require('../middlewares/authMiddleware');

// Display checkout page
router.get('/', isLoggedIn, checkoutController.getCheckout);

// Place COD order
router.post('/', isLoggedIn, checkoutController.placeOrder);

module.exports = router;