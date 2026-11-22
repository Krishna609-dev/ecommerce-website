


const express = require('express');
const router = express.Router();

const cartController = require('../controllers/cartController');

const { isLoggedIn } = require('../middlewares/authMiddleware');

// Cart routes - guest and logged-in users
router.get('/', cartController.getCart);

router.post('/add', cartController.addToCart);

router.post('/update/:productId', cartController.updateQuantity);

router.post('/remove/:productId', cartController.removeFromCart);

// Coupon routes - login required
router.post('/coupon/apply', isLoggedIn, cartController.applyCoupon);

router.post('/coupon/remove', isLoggedIn, cartController.removeCoupon);

module.exports = router;











// const express = require('express');
// const { isLoggedIn } = require('../middlewares/authMiddleware');
// const cartController = require('../controllers/cartController');

// const router = express.Router();

// router.use(isLoggedIn);

// router.get('/', cartController.getCart);
// router.post('/add', cartController.addToCart);
// router.post('/items/:productId', cartController.updateCartItem);
// router.post('/remove/:itemId', cartController.removeFromCart);
// router.post('/clear', cartController.clearCart);

// module.exports = router;
