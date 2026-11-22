
require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const methodOverride = require('method-override');

const flash = require('./middlewares/flash');

const connectDB = require('./config/db');

// Routes
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const cartRoutes = require('./routes/cartRoutes');
const shopRoutes = require('./routes/shopRoutes');
const addressRoutes = require('./routes/addressRoutes');
const checkoutRoutes = require('./routes/checkoutRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const orderRoutes = require('./routes/orderRoutes');
const profileRoutes = require('./routes/profileRoutes');

// Models
const User = require('./models/User');
const Cart = require('./models/Cart');
const Wishlist = require('./models/Wishlist');

const app = express();

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Read form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Support PUT and DELETE forms
app.use(methodOverride('_method'));

// Keep admin and customer sessions separate so logging into one does not
// replace the other in the same browser.
const sessionSecret = process.env.SESSION_SECRET || 'development-secret-change-this';
const sessionCookie = {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 4
};
const sessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false
};
const userSession = session({
    ...sessionOptions,
    name: 'connect.sid',
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'sessions',
        ttl: 60 * 60 * 4
    }),
    cookie: { ...sessionCookie }
});
const adminSession = session({
    ...sessionOptions,
    name: 'admin.sid',
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'admin_sessions',
        ttl: 60 * 60 * 4
    }),
    cookie: { ...sessionCookie, path: '/admin' }
});

app.use((req, res, next) => {
    const isAdminRequest =
        req.path === '/admin' || req.path.startsWith('/admin/');

    return (isAdminRequest ? adminSession : userSession)(req, res, next);
});

// Serve CSS, JavaScript and uploaded images
app.use(express.static(path.join(__dirname, 'public')));

// Flash middleware
app.use(flash());

// Make flash messages available in EJS
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');

    next();
});

// Global variables for EJS
app.use(async (req, res, next) => {

    // Default values
    res.locals.user = null;
    res.locals.cartCount = 0;
    res.locals.wishlistCount = 0;
    res.locals.wishlistIds = [];

    // Flash message handling
    const message = req.session.flashMessage;

    if (message && message.type === 'success') {
        res.locals.success.push(message.message);
    } else if (message && ['danger', 'error', 'warning'].includes(message.type)) {
        res.locals.error.push(message.message);
    }

    delete req.session.flashMessage;

    // Admin routes: set res.locals.user from adminId (admin session)
    // and skip cart/wishlist logic entirely.
    const isAdminRoute = req.path === '/admin' || req.path.startsWith('/admin/');

    try {

        if (isAdminRoute) {

            if (req.session.adminId) {
                const admin = await User.findById(req.session.adminId);
                if (admin && !admin.isBlocked && admin.isVerified && admin.role === 'admin') {
                    res.locals.user = admin;
                } else {
                    req.session.adminId = null;
                }
            }

        } else {

            // LOGGED-IN USER (user session)
            if (req.session.userId) {

                const user = await User.findById(req.session.userId);

                if (user && !user.isBlocked && user.isVerified && user.role !== 'admin') {

                    res.locals.user = user;

                    // Get logged-in user's MongoDB cart
                    const cart = await Cart.findOne({
                        user: user._id
                    })
                    .select('items.quantity')
                    .lean();

                    res.locals.cartCount = cart
                        ? cart.items.reduce(
                            (total, item) => total + item.quantity, 0
                        )
                        : 0;

                    // Get wishlist products
                    const wishlist = await Wishlist.findOne({
                        user: user._id
                    })
                    .select('products')
                    .lean();

                    // Product IDs used to display wishlist hearts
                    res.locals.wishlistIds = wishlist
                        ? wishlist.products.map(id => id.toString())
                        : [];

                    // Wishlist count
                    res.locals.wishlistCount = res.locals.wishlistIds.length;

                } else {

                    // Invalid, blocked, unverified or admin in user session
                    req.session.userId = null;
                }

            } else {

                // GUEST USER — get cart count from session
                const guestCart = req.session.guestCart || [];

                res.locals.cartCount = guestCart.reduce(
                    (total, item) => total + Number(item.quantity || 0),
                    0
                );

            }
        }

        next();

    } catch (error) {
        next(error);
    }
});

// Register routes
app.use('/', shopRoutes);
app.use('/', authRoutes);

app.use('/cart', cartRoutes);
app.use('/admin', adminRoutes);
app.use('/addresses', addressRoutes);
app.use('/checkout', checkoutRoutes);
app.use('/payment', paymentRoutes);
app.use('/wishlist', wishlistRoutes);
app.use('/orders', orderRoutes);
app.use('/profile', profileRoutes);

// Error handling middleware
app.use((error, req, res, next) => {

    console.error(error);

    if (res.headersSent) {
        return next(error);
    }

    const statusCode = error.status || 500;

    res.status(statusCode).render('error', {
        title: 'Error',
        status: statusCode,
        statusCode,
        message: statusCode === 500
            ? 'Something went wrong.'
            : error.message
    });
});

// Start server after database connection
async function startServer() {
    try {

        await connectDB();

        const port = process.env.PORT || 3014;

        app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}/`);
        });

    } catch (error) {
        console.error('Failed to start server:', error);
    }
}

startServer();
