const express = require('express');
const router = express.Router();

const orderController = require('../controllers/orderController');
const { isLoggedIn } = require('../middlewares/authMiddleware');


// Display all orders
router.get('/', isLoggedIn, orderController.getOrders);

// Display single order details
router.get('/:id', isLoggedIn, orderController.getOrderDetails);

// Cancel order
router.post('/:id/cancel', isLoggedIn, orderController.cancelOrder);

// Download invoice
router.get('/:id/invoice', isLoggedIn, orderController.downloadInvoice);

module.exports = router;