const User = require('../../models/User');

// Display all users with pagination
const list = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 8;
        const skip = (page - 1) * limit;

        // Get all accounts (including admin for display)
        const users = await User.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('-password');

        // Count total users
        const totalUsers = await User.countDocuments();

        const totalPages = Math.ceil(totalUsers / limit);

        res.render('admin/users', {
            title: 'Users',
            activePage: 'users',
            users,
            currentPage: page,
            totalPages,
            baseQuery: '/admin/users?'
        });

    } catch (error) {
        next(error);
    }
};


// Block or unblock a user
const toggleBlock = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        // Check whether user exists
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Prevent blocking admin
        if (user.role === 'admin') {
            return res.status(403).send('Admin accounts cannot be blocked');
        }

        // Change account status
        user.isBlocked = !user.isBlocked;

        await user.save();

        // Return to users page
        res.redirect('/admin/users');

    } catch (error) {
        next(error);
    }
};


module.exports = {
    list,
    toggleBlock
};