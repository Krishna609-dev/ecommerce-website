const express = require('express');
const router = express.Router();

const profileController = require('../controllers/profileController');
const { isLoggedIn } = require('../middlewares/authMiddleware');

// Display profile
router.get('/', isLoggedIn, profileController.getProfile);

// Display edit profile page
router.get('/edit', isLoggedIn, profileController.getEditProfile);

// Update profile
router.put('/', isLoggedIn, profileController.updateProfile);

module.exports = router;