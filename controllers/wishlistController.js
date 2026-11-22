const mongoose = require('mongoose');

const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');

// Check whether request comes from Fetch API
const isAjaxRequest = (req) => {
    return req.get('X-Requested-With') === 'XMLHttpRequest';
};

// 1. Display wishlist page
const getWishlist = async (req, res, next) => {
    try {
        const userId = req.session.userId;

        const wishlist = await Wishlist.findOne({
            user: userId
        }).populate({
            path: 'products',
            populate: {
                path: 'category',
                select: 'name'
            }
        });

        const products = wishlist
            ? wishlist.products.filter(product => product !== null)
            : [];

        res.render('wishlist/wishlist', {
            title: 'My Wishlist',
            products
        });

    } catch (error) {
        next(error);
    }
};


// 2. Add product to wishlist
const add = async (req, res, next) => {
    try {
        const userId = req.session.userId;
        const productId = req.params.productId;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            if (isAjaxRequest(req)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid product.'
                });
            }

            req.flash('error', 'Invalid product.');
            return res.redirect('/');
        }

        const product = await Product.findById(productId);

        if (!product || product.isActive === false) {
            if (isAjaxRequest(req)) {
                return res.status(404).json({
                    success: false,
                    message: 'Product is not available.'
                });
            }

            req.flash('error', 'Product is not available.');
            return res.redirect('/');
        }

        let wishlist = await Wishlist.findOne({
            user: userId
        });

        if (!wishlist) {
            wishlist = await Wishlist.create({
                user: userId,
                products: [productId]
            });
        } else {
            const alreadyExists = wishlist.products.some(
                id => id.toString() === productId
            );

            if (alreadyExists) {
                if (isAjaxRequest(req)) {
                    return res.json({
                        success: true,
                        added: false,
                        alreadyExists: true,
                        count: wishlist.products.length,
                        message: 'Product is already in your wishlist.'
                    });
                }

                req.flash('error', 'Product is already in your wishlist.');
                return res.redirect('/wishlist');
            }

            wishlist.products.push(productId);
            await wishlist.save();
        }

        if (isAjaxRequest(req)) {
            return res.json({
                success: true,
                added: true,
                count: wishlist.products.length,
                message: 'Product added to wishlist.'
            });
        }

        req.flash('success', 'Product added to wishlist.');
        return res.redirect('/wishlist');

    } catch (error) {
        next(error);
    }
};


// 3. Remove product from wishlist
const remove = async (req, res, next) => {
    try {
        const userId = req.session.userId;
        const productId = req.params.productId;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            if (isAjaxRequest(req)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid product.'
                });
            }

            req.flash('error', 'Invalid product.');
            return res.redirect('/wishlist');
        }

        const wishlist = await Wishlist.findOneAndUpdate(
            {
                user: userId
            },
            {
                $pull: {
                    products: productId
                }
            },
            {
                new: true
            }
        );

        if (!wishlist) {
            if (isAjaxRequest(req)) {
                return res.status(404).json({
                    success: false,
                    message: 'Wishlist not found.'
                });
            }

            req.flash('error', 'Wishlist not found.');
            return res.redirect('/wishlist');
        }

        if (isAjaxRequest(req)) {
            return res.json({
                success: true,
                removed: true,
                count: wishlist.products.length,
                message: 'Product removed from wishlist.'
            });
        }

        req.flash('success', 'Product removed from wishlist.');
        return res.redirect('/wishlist');

    } catch (error) {
        next(error);
    }
};


module.exports = {
    getWishlist,
    add,
    remove
};





// const mongoose = require('mongoose');

// const Wishlist = require('../models/Wishlist');
// const Product = require('../models/Product');

// // Check whether request comes from Fetch API
// const isAjaxRequest = (req) => {
//     return req.get('X-Requested-With') === 'XMLHttpRequest';
// };

// // 1. Display wishlist page
// const getWishlist = async (req, res, next) => {
//     try {
//         const userId = req.session.userId;

//         const wishlist = await Wishlist.findOne({
//             user: userId
//         }).populate({
//             path: 'products',
//             populate: {
//                 path: 'category',
//                 select: 'name'
//             }
//         });

//         const products = wishlist
//             ? wishlist.products.filter(product => product !== null)
//             : [];

//         res.render('wishlist/wishlist', {
//             title: 'My Wishlist',
//             products
//         });

//     } catch (error) {
//         next(error);
//     }
// };


// // 2. Add product to wishlist
// const add = async (req, res, next) => {
//     try {
//         const userId = req.session.userId;
//         const productId = req.params.productId;

//         if (!mongoose.Types.ObjectId.isValid(productId)) {
//             if (isAjaxRequest(req)) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Invalid product.'
//                 });
//             }

//             req.flash('error', 'Invalid product.');
//             return res.redirect('/');
//         }

//         const product = await Product.findById(productId);

//         if (!product || product.isActive === false) {
//             if (isAjaxRequest(req)) {
//                 return res.status(404).json({
//                     success: false,
//                     message: 'Product is not available.'
//                 });
//             }

//             req.flash('error', 'Product is not available.');
//             return res.redirect('/');
//         }

//         let wishlist = await Wishlist.findOne({
//             user: userId
//         });

//         if (!wishlist) {
//             wishlist = await Wishlist.create({
//                 user: userId,
//                 products: [productId]
//             });
//         } else {
//             const alreadyExists = wishlist.products.some(
//                 id => id.toString() === productId
//             );

//             if (alreadyExists) {
//                 if (isAjaxRequest(req)) {
//                     return res.json({
//                         success: true,
//                         added: false,
//                         alreadyExists: true,
//                         count: wishlist.products.length,
//                         message: 'Product is already in your wishlist.'
//                     });
//                 }

//                 req.flash('error', 'Product is already in your wishlist.');
//                 return res.redirect('/wishlist');
//             }

//             wishlist.products.push(productId);
//             await wishlist.save();
//         }

//         if (isAjaxRequest(req)) {
//             return res.json({
//                 success: true,
//                 added: true,
//                 count: wishlist.products.length,
//                 message: 'Product added to wishlist.'
//             });
//         }

//         req.flash('success', 'Product added to wishlist.');
//         return res.redirect('/wishlist');

//     } catch (error) {
//         next(error);
//     }
// };


// // 3. Remove product from wishlist
// const remove = async (req, res, next) => {
//     try {
//         const userId = req.session.userId;
//         const productId = req.params.productId;

//         if (!mongoose.Types.ObjectId.isValid(productId)) {
//             if (isAjaxRequest(req)) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Invalid product.'
//                 });
//             }

//             req.flash('error', 'Invalid product.');
//             return res.redirect('/wishlist');
//         }

//         const wishlist = await Wishlist.findOneAndUpdate(
//             {
//                 user: userId
//             },
//             {
//                 $pull: {
//                     products: productId
//                 }
//             },
//             {
//                 new: true
//             }
//         );

//         if (!wishlist) {
//             if (isAjaxRequest(req)) {
//                 return res.status(404).json({
//                     success: false,
//                     message: 'Wishlist not found.'
//                 });
//             }

//             req.flash('error', 'Wishlist not found.');
//             return res.redirect('/wishlist');
//         }

//         if (isAjaxRequest(req)) {
//             return res.json({
//                 success: true,
//                 removed: true,
//                 count: wishlist.products.length,
//                 message: 'Product removed from wishlist.'
//             });
//         }

//         req.flash('success', 'Product removed from wishlist.');
//         return res.redirect('/wishlist');

//     } catch (error) {
//         next(error);
//     }
// };


// module.exports = {
//     getWishlist,
//     add,
//     remove
// };














