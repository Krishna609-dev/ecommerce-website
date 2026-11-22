const express = require('express');
const router = express.Router();

const wishlistController = require('../controllers/wishlistController');
const { isLoggedIn } = require('../middlewares/authMiddleware');

// Display wishlist
router.get('/', isLoggedIn, wishlistController.getWishlist);

// Add product
router.post('/add/:productId', isLoggedIn, wishlistController.add);

// Remove product
router.delete('/remove/:productId', isLoggedIn, wishlistController.remove);

module.exports = router;

// const express = require('express');
// const router = express.Router();

// const wishlistController = require('../controllers/wishlistController');
// const { isLoggedIn } = require('../middlewares/authMiddleware');

// // Display wishlist
// router.get('/', isLoggedIn, wishlistController.getWishlist);

// // Add product
// router.post('/add/:productId', isLoggedIn, wishlistController.add);

// // Remove product
// router.delete('/remove/:productId', isLoggedIn, wishlistController.remove);

// module.exports = router;
