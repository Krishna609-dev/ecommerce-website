
const User = require('../../models/User');
const bcrypt = require('bcryptjs');

// Display admin login page
const showAdminLogin = (req, res) => {
    // If already logged in as admin, go straight to dashboard
    if (req.session.adminId) {
        return res.redirect('/admin/dashboard');
    }

    // Pass the flash message from session so the EJS template can display it
    const flashMessage = req.session.flashMessage || null;
    delete req.session.flashMessage;

    res.render('admin/login', { flashMessage });
};

// Handle admin login
const adminLogin = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate fields
        if (!email || !password) {
            req.session.flashMessage = {
                type: 'danger',
                message: 'Please enter email and password.'
            };

            return res.redirect('/admin/login');
        }

        // Find account by email, then verify its role after the password.
        const admin = await User.findOne({
            email: email.trim().toLowerCase()
        });

        if (!admin) {
            req.session.flashMessage = {
                type: 'danger',
                message: 'Invalid admin email or password.'
            };

            return res.redirect('/admin/login');
        }

        // Compare password
        const isMatch = await bcrypt.compare(
            password,
            admin.password
        );

        if (!isMatch) {
            req.session.flashMessage = {
                type: 'danger',
                message: 'Invalid admin email or password.'
            };

            return res.redirect('/admin/login');
        }

        if (admin.role !== 'admin') {
            return res.status(403).render('error', {
                title: 'Access denied',
                status: 403,
                statusCode: 403,
                message: 'You do not have permission to access this page.'
            });
        }

        // Check blocked and verified status
        if (admin.isBlocked || !admin.isVerified) {
            req.session.flashMessage = {
                type: 'danger',
                message: 'Admin account is blocked or not verified.'
            };

            return res.redirect('/admin/login');
        }

        // Regenerate session after successful login
        req.session.regenerate(error => {
            if (error) {
                return next(error);
            }

            // Use adminId (not userId) so the admin session never
            // collides with the user session key
            req.session.adminId = admin._id;

            req.session.flashMessage = {
                type: 'success',
                message: 'Admin login successful.'
            };

            return req.session.save(error => {
                if (error) {
                    return next(error);
                }

                return res.redirect('/admin/dashboard');
            });
        });

    } catch (error) {
        next(error);
    }
};

// Admin logout
const adminLogout = (req, res, next) => {
    req.session.destroy(error => {
        if (error) {
            return next(error);
        }

        res.clearCookie('admin.sid', { path: '/admin' });
        return res.redirect('/admin/login');
    });
};

module.exports = {
    showAdminLogin,
    adminLogin,
    adminLogout
};
