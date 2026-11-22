
const Coupon = require('../models/Coupon');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

const calculateCart = require('../utils/calculateCart');

// Get safe redirect URL
const getRedirectUrl = (req) => {
    const referer = req.get('Referer');

    if (referer) {
        try {
            const url = new URL(referer);

            if (url.host === req.get('host')) {
                return url.pathname + url.search;
            }
        } catch (error) {
            // Use default URL
        }
    }

    return '/';
};

// GET /cart
// Display cart for guest and logged-in user

const getCart = async (req, res, next) => {
    try {
        let cartItems = [];
        let couponCode = null;

        if (req.session.userId) {

            // Get logged-in user's cart
            const cart = await Cart.findOne({
                user: req.session.userId
            }).populate('items.product');

            if (cart) {
                cartItems = cart.items.filter(item => item.product);
                couponCode = cart.couponCode;
            }

        } else {

            // Get guest cart from session
            const guestCart = req.session.guestCart || [];

            const productIds = guestCart.map(item => item.product);

            const products = await Product.find({
                _id: { $in: productIds }
            });

            cartItems = guestCart
                .map(item => {
                    const product = products.find(
                        p => p._id.toString() === item.product.toString()
                    );

                    if (!product) return null;

                    return {
                        product,
                        quantity: item.quantity
                    };
                })
                .filter(Boolean);
        }

        // Calculate subtotal, discount and total
        const summary = await calculateCart(
            cartItems,
            couponCode
        );

        // Render cart page
        res.render('cart/cart', {
            title: 'Your cart',
            ...summary
        });

    } catch (error) {
        next(error);
    }
};




// POST /cart/add
// Add product to guest or logged-in cart
const addToCart = async (req, res, next) => {
    try {
        const { productId } = req.body;

        const redirectUrl = getRedirectUrl(req);

        if (!productId || !/^[a-f\d]{24}$/i.test(productId)) {
            req.flash('error', 'Invalid product');
            return res.redirect(redirectUrl);
        }

        const product = await Product.findById(productId);

        if (!product || !product.isActive || product.stock <= 0) {
            req.flash('error', 'Product is unavailable or out of stock');
            return res.redirect(redirectUrl);
        }

        // ==================================
        // LOGGED-IN USER CART
        // ==================================

        if (req.session.userId) {

            let cart = await Cart.findOne({
                user: req.session.userId
            });

            if (!cart) {
                cart = new Cart({
                    user: req.session.userId,
                    items: []
                });
            }

            const existingItem = cart.items.find(
                item => item.product.toString() === productId
            );

            if (existingItem) {

                if (existingItem.quantity + 1 > product.stock) {
                    req.flash('error', 'Maximum available stock reached');
                    return res.redirect(redirectUrl);
                }

                existingItem.quantity += 1;

            } else {

                cart.items.push({
                    product: productId,
                    quantity: 1
                });
            }

            await cart.save();

        } else {

            // ==================================
            // GUEST SESSION CART
            // ==================================

            if (!Array.isArray(req.session.guestCart)) {
                req.session.guestCart = [];
            }

            const guestCart = req.session.guestCart;

            const existingItem = guestCart.find(
                item => item.product.toString() === productId
            );

            if (existingItem) {

                if (existingItem.quantity + 1 > product.stock) {
                    req.flash('error', 'Maximum available stock reached');
                    return res.redirect(redirectUrl);
                }

                existingItem.quantity += 1;

            } else {

                guestCart.push({
                    product: productId,
                    quantity: 1
                });
            }
        }

        req.flash('success', 'Product added to cart successfully!');

        return res.redirect(redirectUrl);

    } catch (error) {
        next(error);
    }
};


// POST /cart/update/:productId
// Update guest or logged-in cart quantity
const updateQuantity = async (req, res, next) => {
    try {
        const productId = req.params.productId;
        const newQuantity = Number(req.body.quantity);

        if (!/^[a-f\d]{24}$/i.test(productId) ||
            !Number.isInteger(newQuantity) ||
            newQuantity < 1) {

            req.flash('error', 'Invalid product or quantity');
            return res.redirect('/cart');
        }

        const product = await Product.findById(productId);

        if (!product || !product.isActive || newQuantity > product.stock) {
            req.flash('error', 'Requested quantity exceeds available stock');
            return res.redirect('/cart');
        }

        if (req.session.userId) {

            // Logged-in cart
            const cart = await Cart.findOne({
                user: req.session.userId
            });

            if (!cart) return res.redirect('/cart');

            const item = cart.items.find(
                item => item.product.toString() === productId
            );

            if (!item) return res.redirect('/cart');

            item.quantity = newQuantity;

            await cart.save();

        } else {

            // Guest cart
            const guestCart = req.session.guestCart || [];

            const item = guestCart.find(
                item => item.product.toString() === productId
            );

            if (!item) return res.redirect('/cart');

            item.quantity = newQuantity;

            req.session.guestCart = guestCart;
        }

        req.flash('success', 'Cart quantity updated');

        return res.redirect('/cart');

    } catch (error) {
        next(error);
    }
};


// POST /cart/remove/:productId
// Remove product from guest or logged-in cart
const removeFromCart = async (req, res, next) => {
    try {
        const productId = req.params.productId;

        if (req.session.userId) {

            const cart = await Cart.findOne({
                user: req.session.userId
            });

            if (cart) {
                cart.items = cart.items.filter(
                    item => item.product.toString() !== productId
                );

                await cart.save();
            }

        } else {

            req.session.guestCart =
                (req.session.guestCart || []).filter(
                    item => item.product.toString() !== productId
                );
        }

        req.flash('success', 'Product removed from cart');

        return res.redirect('/cart');

    } catch (error) {
        next(error);
    }
};


// POST /cart/coupon/apply
// Apply coupon - logged-in users only

const applyCoupon = async (req, res, next) => {
    try {
        // Get coupon code
        const code = (req.body.couponCode || '').trim().toUpperCase();

        if (!code) {
            req.flash('error', 'Please enter a coupon code');
            return res.redirect('/cart');
        }

        // Find user's cart
        const cart = await Cart.findOne({
            user: req.session.userId
        }).populate('items.product');

        if (!cart || cart.items.length === 0) {
            req.flash('error', 'Your cart is empty');
            return res.redirect('/cart');
        }

        // Calculate cart and validate coupon
        const summary = await calculateCart(
            cart.items,
            code
        );

        // Check coupon errors (including minimum order amount)
        if (summary.couponError) {
            req.flash('error', summary.couponError);
            return res.redirect('/cart');
        }

        // Apply coupon
        cart.couponCode = summary.couponCode;

        await cart.save();

        req.flash('success', 'Coupon applied successfully');

        return res.redirect('/cart');

    } catch (error) {
        next(error);
    }
};


// POST /cart/coupon/remove
// Remove coupon
const removeCoupon = async (req, res, next) => {
    try {
        const cart = await Cart.findOne({
            user: req.session.userId
        });

        if (!cart || !cart.couponCode) {
            req.flash('error', 'No coupon applied');
            return res.redirect('/cart');
        }

        cart.couponCode = null;

        await cart.save();

        req.flash('success', 'Coupon removed successfully');

        return res.redirect('/cart');

    } catch (error) {
        next(error);
    }
};


module.exports = {
    getCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    applyCoupon,
    removeCoupon
};



       








// const mongoose = require('mongoose');
// const Cart = require('../models/Cart');
// const Product = require('../models/Product');

// const setFlash = (req, type, message) => {
//     req.session.flashMessage = { type, message };
// };

// const getOrCreateCart = async userId => {
//     let cart = await Cart.findOne({ user: userId });

//     if (!cart) {
//         try {
//             cart = await Cart.create({ user: userId, items: [] });
//         } catch (error) {
//             if (error.code !== 11000) {
//                 throw error;
//             }

//             cart = await Cart.findOne({ user: userId });
//             if (!cart) {
//                 throw error;
//             }
//         }
//     }

//     return cart;
// };

// const getCart = async (req, res, next) => {
//     try {
//         const cart = await Cart.findOne({ user: req.user._id })
//             .populate('items.product', 'name price stock images isActive');
//         const items = cart ? cart.items : [];
//         const cartCount = items.reduce((total, item) => total + item.quantity, 0);
//         const subtotal = items.reduce((total, item) => {
//             if (!item.product) {
//                 return total;
//             }

//             return total + item.product.price * item.quantity;
//         }, 0);

//         res.render('shop/cart', {
//             title: 'Your cart',
//             user: req.user,
//             items,
//             cartCount,
//             subtotal
//         });
//     } catch (error) {
//         next(error);
//     }
// };

// const addToCart = async (req, res, next) => {
//     try {
//         const { productId } = req.body;
//         const quantity = Number(req.body.quantity);

//         if (
//             !mongoose.isValidObjectId(productId) ||
//             !Number.isSafeInteger(quantity) ||
//             quantity < 1
//         ) {
//             setFlash(req, 'warning', 'Please choose a valid product quantity.');
//             return res.redirect('/cart');
//         }

//         const product = await Product.findOne({
//             _id: productId,
//             isActive: true
//         });

//         if (!product) {
//             setFlash(req, 'warning', 'That product is no longer available.');
//             return res.redirect('/cart');
//         }

//         const cart = await getOrCreateCart(req.user._id);
//         const existingItem = cart.items.find(
//             item => String(item.product) === String(product._id)
//         );
//         const nextQuantity = (existingItem ? existingItem.quantity : 0) + quantity;

//         if (nextQuantity > product.stock) {
//             setFlash(req, 'warning', `Only ${product.stock} item(s) are available.`);
//             return res.redirect('/cart');
//         }

//         if (existingItem) {
//             existingItem.quantity = nextQuantity;
//         } else {
//             cart.items.push({ product: product._id, quantity });
//         }

//         await cart.save();
//         setFlash(req, 'success', 'Product added to your cart.');
//         res.redirect('/cart');
//     } catch (error) {
//         next(error);
//     }
// };

// const updateCartItem = async (req, res, next) => {
//     try {
//         const { productId } = req.params;
//         const quantity = Number(req.body.quantity);

//         if (
//             !mongoose.isValidObjectId(productId) ||
//             !Number.isSafeInteger(quantity) ||
//             quantity < 1
//         ) {
//             setFlash(req, 'warning', 'Please enter a valid quantity.');
//             return res.redirect('/cart');
//         }

//         const cart = await Cart.findOne({ user: req.user._id });
//         const item = cart && cart.items.find(
//             cartItem => String(cartItem.product) === String(productId)
//         );

//         if (!item) {
//             setFlash(req, 'warning', 'That item is not in your cart.');
//             return res.redirect('/cart');
//         }

//         const product = await Product.findOne({
//             _id: productId,
//             isActive: true
//         });

//         if (!product) {
//             setFlash(req, 'warning', 'That product is no longer available.');
//             return res.redirect('/cart');
//         }

//         if (quantity > product.stock) {
//             setFlash(req, 'warning', `Only ${product.stock} item(s) are available.`);
//             return res.redirect('/cart');
//         }

//         item.quantity = quantity;
//         await cart.save();
//         setFlash(req, 'success', 'Cart quantity updated.');
//         res.redirect('/cart');
//     } catch (error) {
//         next(error);
//     }
// };

// const removeFromCart = async (req, res, next) => {
//     try {
//         const { itemId } = req.params;

//         if (!mongoose.isValidObjectId(itemId)) {
//             setFlash(req, 'warning', 'Invalid cart item.');
//             return res.redirect('/cart');
//         }

//         const cart = await Cart.findOne({ user: req.user._id });

//         if (!cart) {
//             setFlash(req, 'warning', 'Your cart is already empty.');
//             return res.redirect('/cart');
//         }

//         const originalLength = cart.items.length;
//         cart.items = cart.items.filter(
//             item => String(item._id) !== String(itemId)
//         );

//         if (cart.items.length === originalLength) {
//             setFlash(req, 'warning', 'That item is not in your cart.');
//             return res.redirect('/cart');
//         }

//         await cart.save();
//         setFlash(req, 'success', 'Item removed from your cart.');
//         res.redirect('/cart');
//     } catch (error) {
//         next(error);
//     }
// };

// const clearCart = async (req, res, next) => {
//     try {
//         const cart = await Cart.findOne({ user: req.user._id });

//         if (cart) {
//             cart.items = [];
//             await cart.save();
//         }

//         setFlash(req, 'success', 'Your cart has been cleared.');
//         res.redirect('/cart');
//     } catch (error) {
//         next(error);
//     }
// };

// module.exports = {
//     getCart,
//     addToCart,
//     updateCartItem,
//     removeFromCart,
//     clearCart
// };
