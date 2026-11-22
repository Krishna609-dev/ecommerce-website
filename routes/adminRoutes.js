const express = require('express');
const router = express.Router();
// to import admin security check
const { isAdmin } = require('../middlewares/authMiddleware');
const categoryController = require('../controllers/admin/categoryController');
const productController = require('../controllers/admin/productController');
const upload = require('../middlewares/upload');
const userController = require('../controllers/admin/userController');
const orderController = require('../controllers/admin/orderController');
const dashboardController = require('../controllers/admin/dashboardController');
const couponController = require('../controllers/admin/couponController');
const reportController = require('../controllers/admin/reportController');
const adminAuthController = require('../controllers/admin/adminAuthController');

// const productController = require('../controllers/admin/productController');

// admin authentication routes
router.get('/', (req, res) => {
    if (req.session.adminId) {
        return res.redirect('/admin/dashboard');
    }

    return res.redirect('/admin/login');
});

router.get('/login', adminAuthController.showAdminLogin);

router.post('/login', adminAuthController.adminLogin);

// Protect admin management routes.
router.use(isAdmin);

// router.post('/logout', adminAuthController.adminLogout);


// Category management
router.get('/categories',categoryController.getCategories);
//form submit to add a new category
router.post('/categories',categoryController.addCategory);

router.put('/categories/:id',categoryController.updateCategory);
router.delete('/categories/:id',categoryController.deleteCategory);



//product management

// Product list
router.get('/products',productController.getProducts);

// Show add product form
router.get('/products/new',productController.showAddProduct);

// Save new product
router.post(
  '/products',
  upload.array('images', 3),
  productController.createProduct
);

// Update stock
router.post('/products/:id/stock', productController.updateStock);

// Show edit form
router.get('/products/:id/edit', productController.showEditProduct);

// Save edited product
router.put(
  '/products/:id',
  upload.array('images', 3),
  productController.updateProduct
);

// Delete product
router.delete('/products/:id',productController.deleteProduct);


// User management
router.get('/users', userController.list);

router.post('/users/:id/toggle-block', userController.toggleBlock);


// Admin order management
router.get('/orders', orderController.list);

router.get('/orders/:id', orderController.detail);

router.post('/orders/:id/status', orderController.updateStatus);

// Admin stock management
router.post('/products/:id/stock', productController.updateStock);

// Update manual refund status
router.post(
    '/orders/:id/refund',
    orderController.updateRefundStatus
);

// Admin Dashboard
router.get('/dashboard', dashboardController.getDashboard);


// Coupon management
router.get('/coupons', couponController.list);
router.get('/coupons/new', couponController.getAddForm);
router.post('/coupons', couponController.create);
router.get('/coupons/:id/edit', couponController.getEditForm);
router.put('/coupons/:id', couponController.update);
router.post('/coupons/:id/toggle', couponController.toggleActive);

// Sales report
router.get('/reports', reportController.salesReport);


router.post('/logout', adminAuthController.adminLogout);
module.exports = router;