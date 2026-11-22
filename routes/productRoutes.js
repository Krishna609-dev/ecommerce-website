
// const express = require('express');
// const router = express.Router();

// const productController = require('../controllers/admin/productController');
// const upload = require('../middlewares/upload');
// const { requireAdmin } = require('../middlewares/authMiddleware');

// router.use(requireAdmin);


// // Product list
// router.get('/', productController.getProducts);

// // Show add product form
// router.get('/new', productController.showAddProduct);

// // Save new product
// router.post(
//   '/',
//   upload.array('images', 3),
//   productController.createProduct
// );

// // Update stock
// router.post('/:id/stock', productController.updateStock);

// // Show edit form
// router.get('/:id/edit', productController.showEditProduct);

// // Save edited product
// router.put(
//   '/:id',
//   upload.array('images', 3),
//   productController.updateProduct
// );

// // Delete product
// router.delete('/:id', productController.deleteProduct);

// module.exports = router;
