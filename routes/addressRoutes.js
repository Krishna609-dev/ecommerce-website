
const express = require('express');
const router = express.Router();

const addressController = require('../controllers/addressController');

const { isLoggedIn } = require('../middlewares/authMiddleware');

// Display addresses
router.get('/', isLoggedIn, addressController.getAddresses);

// Display add form
router.get('/new', isLoggedIn, addressController.getAddAddress);

// Save address
router.post('/', isLoggedIn, addressController.addAddress);

// Display edit form
router.get('/:id/edit', isLoggedIn, addressController.getEditAddress);

// Update address
router.put('/:id', isLoggedIn, addressController.updateAddress);

// Delete address
router.delete('/:id', isLoggedIn, addressController.deleteAddress);

module.exports = router;
