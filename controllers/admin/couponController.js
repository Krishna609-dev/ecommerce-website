
const Coupon = require('../../models/Coupon');

// Display all coupons
const list = async (req, res, next) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });

        res.render('admin/coupons', {
            title: 'Coupons',
            activePage: 'coupons',
            coupons,
            errors: []
        });

    } catch (error) {
        next(error);
    }
};


// Display add coupon form
const getAddForm = (req, res) => {
    res.render('admin/coupon-form', {
        title: 'Add coupon',
        activePage: 'coupons',
        coupon: null,
        errors: []
    });
};


// Create a new coupon
const create = async (req, res, next) => {
    try {
        const code = (req.body.code || '').trim().toUpperCase();
        const discountType = req.body.discountType;
        const discountValue = Number(req.body.discountValue);

        const maxDiscount = req.body.maxDiscount === ''
            ? null
            : Number(req.body.maxDiscount);

        const minOrderAmount = Number(req.body.minOrderAmount);
        const expiryDateInput = req.body.expiryDate;

        const errors = [];

        // Validate coupon code
        if (!code) {
            errors.push({ msg: 'Coupon code is required.' });
        }

        // Validate discount type
        if (!['percentage', 'fixed'].includes(discountType)) {
            errors.push({ msg: 'Invalid discount type.' });
        }

        // Validate discount value
        if (!Number.isFinite(discountValue) || discountValue <= 0) {
            errors.push({ msg: 'Discount value must be greater than zero.' });
        }

        if (discountType === 'percentage' && discountValue > 100) {
            errors.push({ msg: 'Percentage discount cannot exceed 100%.' });
        }

        // Validate maximum discount
        if (
            maxDiscount !== null &&
            (!Number.isFinite(maxDiscount) || maxDiscount < 0)
        ) {
            errors.push({ msg: 'Maximum discount must be zero or greater.' });
        }

        // Validate minimum order amount
        if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
            errors.push({ msg: 'Minimum order amount must be zero or greater.' });
        }

        // Validate expiry date
        let expiryDate = null;

        if (!expiryDateInput) {
            errors.push({ msg: 'Expiry date is required.' });
        } else {
            expiryDate = new Date(`${expiryDateInput}T23:59:59.999Z`);

            if (
                Number.isNaN(expiryDate.getTime()) ||
                expiryDate.toISOString().slice(0, 10) !== expiryDateInput
            ) {
                errors.push({ msg: 'Please enter a valid expiry date.' });
            } else if (expiryDate < new Date()) {
                errors.push({ msg: 'Expiry date cannot be in the past.' });
            }
        }

        // Check duplicate coupon code
        const existingCoupon = code
            ? await Coupon.findOne({ code })
            : null;

        if (existingCoupon) {
            errors.push({ msg: 'This coupon code already exists.' });
        }

        // If validation fails, show form again
        if (errors.length > 0) {
            return res.status(400).render('admin/coupon-form', {
                title: 'Add coupon',
                activePage: 'coupons',
                coupon: req.body,
                errors
            });
        }

        // Save coupon in database
        await Coupon.create({
            code,
            discountType,
            discountValue,
            maxDiscount,
            minOrderAmount,
            expiryDate,
            isActive: req.body.isActive === 'true'
        });

        res.redirect('/admin/coupons');

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).render('admin/coupon-form', {
                title: 'Add coupon',
                activePage: 'coupons',
                coupon: req.body,
                errors: [{ msg: 'This coupon code already exists.' }]
            });
        }

        next(error);
    }
};


// Display edit coupon form
const getEditForm = async (req, res, next) => {
    try {
        const coupon = await Coupon.findById(req.params.id);

        if (!coupon) {
            return res.status(404).send('Coupon not found.');
        }

        res.render('admin/coupon-form', {
            title: 'Edit coupon',
            activePage: 'coupons',
            coupon,
            errors: []
        });

    } catch (error) {
        next(error);
    }
};


// Update existing coupon
const update = async (req, res, next) => {
    try {
        const coupon = await Coupon.findById(req.params.id);

        if (!coupon) {
            return res.status(404).send('Coupon not found.');
        }

        const code = (req.body.code || '').trim().toUpperCase();
        const discountType = req.body.discountType;
        const discountValue = Number(req.body.discountValue);

        const maxDiscount = req.body.maxDiscount === ''
            ? null
            : Number(req.body.maxDiscount);

        const minOrderAmount = Number(req.body.minOrderAmount);
        const expiryDateInput = req.body.expiryDate;

        const errors = [];

        if (!code) {
            errors.push({ msg: 'Coupon code is required.' });
        }

        if (!['percentage', 'fixed'].includes(discountType)) {
            errors.push({ msg: 'Invalid discount type.' });
        }

        if (!Number.isFinite(discountValue) || discountValue <= 0) {
            errors.push({ msg: 'Discount value must be greater than zero.' });
        }

        if (discountType === 'percentage' && discountValue > 100) {
            errors.push({ msg: 'Percentage discount cannot exceed 100%.' });
        }

        if (
            maxDiscount !== null &&
            (!Number.isFinite(maxDiscount) || maxDiscount < 0)
        ) {
            errors.push({ msg: 'Maximum discount must be zero or greater.' });
        }

        if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
            errors.push({ msg: 'Minimum order amount must be zero or greater.' });
        }

        let expiryDate = null;

        if (!expiryDateInput) {
            errors.push({ msg: 'Expiry date is required.' });
        } else {
            expiryDate = new Date(`${expiryDateInput}T23:59:59.999Z`);

            if (
                Number.isNaN(expiryDate.getTime()) ||
                expiryDate.toISOString().slice(0, 10) !== expiryDateInput
            ) {
                errors.push({ msg: 'Please enter a valid expiry date.' });
            } else if (expiryDate < new Date()) {
                errors.push({ msg: 'Expiry date cannot be in the past.' });
            }
        }

        // Check duplicate code, excluding current coupon
        const duplicate = code
            ? await Coupon.findOne({
                _id: { $ne: coupon._id },
                code
            })
            : null;

        if (duplicate) {
            errors.push({ msg: 'This coupon code already exists.' });
        }

        if (errors.length > 0) {
            return res.status(400).render('admin/coupon-form', {
                title: 'Edit coupon',
                activePage: 'coupons',
                coupon: {
                    ...req.body,
                    _id: coupon._id
                },
                errors
            });
        }

        // Update coupon details
        coupon.code = code;
        coupon.discountType = discountType;
        coupon.discountValue = discountValue;
        coupon.maxDiscount = maxDiscount;
        coupon.minOrderAmount = minOrderAmount;
        coupon.expiryDate = expiryDate;

        // Save checkbox status
        coupon.isActive = req.body.isActive === 'true';

        await coupon.save();

        res.redirect('/admin/coupons');

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).send('This coupon code already exists.');
        }

        next(error);
    }
};


// Activate or deactivate coupon
const toggleActive = async (req, res, next) => {
    try {
        const coupon = await Coupon.findById(req.params.id);

        if (!coupon) {
            return res.status(404).send('Coupon not found.');
        }

        // Prevent activating expired coupons
        if (!coupon.isActive && coupon.expiryDate < new Date()) {
            return res.status(400).send(
                'This coupon has expired. Update its expiry date first.'
            );
        }

        coupon.isActive = !coupon.isActive;

        await coupon.save();

        res.redirect('/admin/coupons');

    } catch (error) {
        next(error);
    }
};


module.exports = {
    list,
    getAddForm,
    create,
    getEditForm,
    update,
    toggleActive
};
