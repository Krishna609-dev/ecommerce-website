const express = require('express');
const shopController = require('../controllers/shopController');
const { isLoggedIn } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', shopController.getHome);

router.get('/orders', isLoggedIn, shopController.getMyOrders);
router.get('/products/:id', shopController.getProductDetail);

module.exports = router;
