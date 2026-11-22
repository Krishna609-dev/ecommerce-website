
const User = require('../models/User');

// Check whether the user is logged in (user session only)
async function isLoggedIn(req, res, next) {
    try {
        if (!req.session.userId) {

            // Save checkout URL before redirecting to login
            if (req.method === 'GET' &&
                /^\/checkout(?:[/?#]|$)/.test(req.originalUrl)) {
                req.session.returnTo = req.originalUrl;
            }

            req.session.flashMessage = {
                type: 'warning',
                message: 'Please log in first.'
            };

            return res.redirect('/login');
        }

        // Re-check the user from MongoDB
        const user = await User.findById(req.session.userId);

        if (!user || user.isBlocked || !user.isVerified || user.role === 'admin') {
            return req.session.destroy(error => {
                if (error) {
                    return next(error);
                }

                res.clearCookie('connect.sid');
                return res.redirect('/login');
            });
        }

        req.user = user;
        res.locals.user = user;

        next();

    } catch (error) {
        next(error);
    }
}

// Redirect logged-in users away from guest-only pages (login/register)
async function isGuest(req, res, next) {
    try {
        if (!req.session.userId) {
            return next();
        }

        const user = await User.findById(req.session.userId);

        if (!user || user.isBlocked || !user.isVerified || user.role === 'admin') {
            return req.session.destroy(error => {
                if (error) {
                    return next(error);
                }

                res.clearCookie('connect.sid');
                return next();
            });
        }

        return res.redirect('/');
    } catch (error) {
        next(error);
    }
}

// Allow only admins — uses adminId stored in the admin session
async function isAdmin(req, res, next) {
    try {
        if (!req.session.adminId) {
            req.session.flashMessage = {
                type: 'warning',
                message: 'Please log in as admin first.'
            };

            return res.redirect('/admin/login');
        }

        const user = await User.findById(req.session.adminId);

        if (!user || user.isBlocked || !user.isVerified) {
            return req.session.destroy(error => {
                if (error) {
                    return next(error);
                }

                res.clearCookie('admin.sid', { path: '/admin' });
                return res.redirect('/admin/login');
            });
        }

        if (user.role !== 'admin') {
            return req.session.destroy(error => {
                if (error) {
                    return next(error);
                }

                res.clearCookie('admin.sid', { path: '/admin' });
                return res.redirect('/admin/login');
            });
        }

        req.user = user;
        res.locals.user = user;

        return next();

    } catch (error) {
        next(error);
    }
}








// const User = require('../models/User');

// // Check whether the user is logged in
// async function isLoggedIn(req, res, next) {
//     try {
//         if (!req.session.userId) {
//             req.session.flashMessage = {
//                 type: 'warning',
//                 message: 'Please log in first.'
//             };

//             return res.redirect('/login');
//         }

//         // Re-check the user from MongoDB
//         const user = await User.findById(req.session.userId);

//         if (!user || user.isBlocked || !user.isVerified) {
//             return req.session.destroy(error => {
//                 if (error) {
//                     return next(error);
//                 }

//                 res.clearCookie('connect.sid');
//                 return res.redirect('/login');
//             });
//         }

//         req.user = user;
//         res.locals.user = user;

//         next();
//     } catch (error) {
//         next(error);
//     }
// }

// // Redirect logged-in users away from login/register
// async function isGuest(req, res, next) {
//     try {
//         if (!req.session.userId) {
//             return next();
//         }

//         const user = await User.findById(req.session.userId);

//         if (!user || user.isBlocked || !user.isVerified) {
//             return req.session.destroy(error => {
//                 if (error) {
//                     return next(error);
//                 }

//                 res.clearCookie('connect.sid');
//                 return next();
//             });
//         }

//         if (user.role === 'admin') {
//             return res.redirect('/admin/categories');
//         }

//         return res.redirect('/');
//     } catch (error) {
//         next(error);
//     }
// }

// // Allow only admins
// async function isAdmin(req, res, next) {
//     try {
//         if (!req.session.userId) {
//             req.session.flashMessage = {
//                 type: 'warning',
//                 message: 'Please log in first.'
//             };

//             return res.redirect('/login');
//         }

//         const user = await User.findById(req.session.userId);

//         if (!user || user.isBlocked || !user.isVerified) {
//             return req.session.destroy(error => {
//                 if (error) {
//                     return next(error);
//                 }

//                 res.clearCookie('connect.sid');
//                 return res.redirect('/login');
//             });
//         }

//         if (user.role !== 'admin') {
//             return res.status(403).render('error', {
//                 title: 'Access denied',
//                 status: 403,
//                 statusCode: 403,
//                 message: 'You do not have permission to access this page.'
//             });
//         }

//         req.user = user;
//         res.locals.user = user;

//         next();
//     } catch (error) {
//         next(error);
//     }
// }

// module.exports = {
//     isLoggedIn,
//     isGuest,
//     isAdmin
// };

module.exports = {
    isLoggedIn,
    isGuest,
    isAdmin
};



