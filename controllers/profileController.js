
const User = require('../models/User');

// 1. Display profile page
const getProfile = async (req, res, next) => {
    try {
        const profileUser = await User.findById(req.session.userId)
            .select('-password')
            .lean();

        if (!profileUser) {
            req.flash('error', 'User not found.');
            return res.redirect('/login');
        }

        res.render('profile/profile', {
            title: 'My profile',
            profileUser
        });

    } catch (error) {
        next(error);
    }
};


// 2. Display edit profile page
const getEditProfile = async (req, res, next) => {
    try {
        const profileUser = await User.findById(req.session.userId)
            .select('-password')
            .lean();

        if (!profileUser) {
            req.flash('error', 'User not found.');
            return res.redirect('/login');
        }

        res.render('profile/edit-profile', {
            title: 'Edit profile',
            profileUser,
            errors: []
        });

    } catch (error) {
        next(error);
    }
};


// 3. Update profile
const updateProfile = async (req, res, next) => {
    try {
        const name = (req.body.name || '').trim();
        const phone = (req.body.phone || '').trim();

        const errors = [];

        // Validate name
        if (!name || name.length < 2 || name.length > 50) {
            errors.push({
                msg: 'Name must contain between 2 and 50 characters.'
            });
        }

        // Phone is optional, but if entered, validate it
        if (phone && !/^[6-9]\d{9}$/.test(phone)) {
            errors.push({
                msg: 'Enter a valid 10-digit Indian mobile number.'
            });
        }

        if (errors.length > 0) {
            const profileUser = await User.findById(req.session.userId)
                .select('-password')
                .lean();

            return res.status(400).render('profile/edit-profile', {
                title: 'Edit profile',
                profileUser: {
                    ...profileUser,
                    name,
                    phone
                },
                errors
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.session.userId,
            {
                $set: {
                    name,
                    phone
                }
            },
            {
                new: true,
                runValidators: true
            }
        ).select('-password');

        if (!updatedUser) {
            req.flash('error', 'User not found.');
            return res.redirect('/login');
        }

        req.flash('success', 'Profile updated successfully.');
        return res.redirect('/profile');

    } catch (error) {
        next(error);
    }
};


module.exports = {
    getProfile,
    getEditProfile,
    updateProfile
};
