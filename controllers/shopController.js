const mongoose = require('mongoose');
const Category = require('../models/Category');
const Order = require('../models/Order');
const Product = require('../models/Product');

const getMyOrders = async (req, res, next) => {
    try {
        const limit = 10;
        const requestedPage = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const filter = { user: req.session.userId };
        const orderCount = await Order.countDocuments(filter);
        const totalPages = Math.ceil(orderCount / limit);
        const currentPage = totalPages
            ? Math.min(requestedPage, totalPages)
            : 1;
        const orders = await Order.find(filter)
            .sort({ createdAt: -1 })
            .skip((currentPage - 1) * limit)
            .limit(limit)
            .lean();

        res.render('orders/orders', {
            title: 'My orders',
            orders,
            currentPage,
            totalPages,
            baseQuery: ''
        });
    } catch (error) {
        next(error);
    }
};


const getHome = async (req, res, next) => {
    try {
        // Fetch active categories
        const categories = await Category.find({ isActive: true })
            .sort({ name: 1 });

        // Fetch active featured products for homepage carousel
        const featuredProducts = await Product.find({
            isActive: true,
            isFeatured: true
        })
            .populate('category', 'name')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        // Product limit: 12 products per page
        const limit = 12;

        // Get requested page number
        const requestedPage = Math.max(
            parseInt(req.query.page, 10) || 1,
            1
        );

        // Get search and category query parameters
        const query = {
            search: typeof req.query.search === 'string'
                ? req.query.search.trim()
                : '',
            category: typeof req.query.category === 'string'
                ? req.query.category
                : ''
        };

        // Retrieve active products
        const filter = { isActive: true };

        // Category filtering
        if (query.category) {
            if (
                !mongoose.isValidObjectId(query.category) ||
                !categories.some(
                    category => String(category._id) === query.category
                )
            ) {
                // Handle invalid category
                filter._id = { $exists: false };
            } else {
                filter.category = query.category;
            }
        } else {
            filter.category = {
                $in: categories.map(category => category._id)
            };
        }

        // Search filtering
        if (query.search) {
            // Escape special regex characters
            const escapedSearch = query.search.replace(
                /[.*+?^${}()|[\]\\]/g,
                '\\$&'
            );

            const searchRegex = {
                $regex: escapedSearch,
                $options: 'i'
            };

            filter.$or = [
                { name: searchRegex },
                { description: searchRegex }
            ];
        }

        // Count matching products
        const totalProducts = await Product.countDocuments(filter);

        const totalPages = Math.ceil(totalProducts / limit);

        const currentPage = totalPages
            ? Math.min(requestedPage, totalPages)
            : 1;

        // Fetch products from MongoDB
        const products = await Product.find(filter)
            .populate('category', 'name')
            .sort({ createdAt: -1 })
            .skip((currentPage - 1) * limit)
            .limit(limit)
            .lean();

        // Create pagination query
        const paginationQuery = new URLSearchParams();

        if (query.search) {
            paginationQuery.set('search', query.search);
        }

        if (query.category) {
            paginationQuery.set('category', query.category);
        }

        const baseQuery = paginationQuery.toString();

        // Render homepage
        res.render('shop/home', {
            title: 'Shop',
            products,
            featuredProducts, // Added for homepage carousel
            categories,
            query,
            wishlistIds: [],
            wishlistCount: res.locals.wishlistCount,
            currentPage,
            totalPages,
            baseQuery: baseQuery ? `${baseQuery}&` : ''
        });

    } catch (error) {
        next(error);
    }
};



const getProductDetail = async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).render('error', {
                title: 'Product not found',
                status: 404,
                statusCode: 404,
                message: 'The product you requested could not be found.'
            });
        }

        const product = await Product.findOne({
            _id: req.params.id,
            isActive: true
        }).populate('category', 'name');

        if (!product) {
            return res.status(404).render('error', {
                title: 'Product not found',
                status: 404,
                statusCode: 404,
                message: 'The product you requested could not be found.'
            });
        }

        const relatedProducts = await Product.find({
            _id: { $ne: product._id },
            category: product.category._id,
            isActive: true
        })
            .populate('category', 'name')
            .sort({ createdAt: -1 })
            .limit(4)
            .lean();

        res.render('shop/product-detail', {
            title: product.name,
            product,
            relatedProducts,
            inWishlist: false
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { getHome, getProductDetail, getMyOrders };
