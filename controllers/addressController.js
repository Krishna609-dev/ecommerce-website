
const Address = require('../models/Address');

// GET /addresses
// Display all saved addresses
const getAddresses = async (req, res, next) => {
    try {

        const addresses = await Address.find({
            user: req.session.userId
        }).sort({ createdAt: -1 });

        res.render('address/addresses', {
            title: 'My addresses',
            addresses
        });

    } catch (error) {
        next(error);
    }
};


// GET /addresses/new
// Display add address form
const getAddAddress = (req, res) => {

    res.render('address/address-form', {
        title: 'Add address',
        address: null,
        errors: []
    });
};


// POST /addresses
// Save new address
const addAddress = async (req, res, next) => {
    try {

        const {
            fullName,
            phone,
            street,
            city,
            state,
            pincode
        } = req.body;

        const errors = [];

        if (!fullName || !fullName.trim()) {
            errors.push({ msg: 'Full name is required' });
        }

        if (!/^[0-9]{10}$/.test(phone || '')) {
            errors.push({ msg: 'Enter a valid 10-digit phone number' });
        }

        if (!street || !street.trim()) {
            errors.push({ msg: 'Street address is required' });
        }

        if (!city || !city.trim()) {
            errors.push({ msg: 'City is required' });
        }

        if (!state || !state.trim()) {
            errors.push({ msg: 'State is required' });
        }

        if (!/^[0-9]{6}$/.test(pincode || '')) {
            errors.push({ msg: 'Enter a valid 6-digit pincode' });
        }

        if (errors.length) {
            return res.status(400).render('address/address-form', {
                title: 'Add address',
                address: req.body,
                errors
            });
        }

        await Address.create({
            user: req.session.userId,
            fullName: fullName.trim(),
            phone,
            street: street.trim(),
            city: city.trim(),
            state: state.trim(),
            pincode
        });

        req.flash('success', 'Address added successfully');

        res.redirect('/addresses');

    } catch (error) {
        next(error);
    }
};


// GET /addresses/:id/edit
// Display edit form
const getEditAddress = async (req, res, next) => {
    try {

        const address = await Address.findOne({
            _id: req.params.id,
            user: req.session.userId
        });

        if (!address) {
            req.flash('error', 'Address not found');
            return res.redirect('/addresses');
        }

        res.render('address/address-form', {
            title: 'Edit address',
            address,
            errors: []
        });

    } catch (error) {
        next(error);
    }
};


// PUT /addresses/:id
// Update address
const updateAddress = async (req, res, next) => {
    try {

        const {
            fullName,
            phone,
            street,
            city,
            state,
            pincode
        } = req.body;

        const errors = [];

        if (!fullName || !fullName.trim()) {
            errors.push({ msg: 'Full name is required' });
        }

        if (!/^[0-9]{10}$/.test(phone || '')) {
            errors.push({ msg: 'Enter a valid 10-digit phone number' });
        }

        if (!street || !street.trim()) {
            errors.push({ msg: 'Street address is required' });
        }

        if (!city || !city.trim()) {
            errors.push({ msg: 'City is required' });
        }

        if (!state || !state.trim()) {
            errors.push({ msg: 'State is required' });
        }

        if (!/^[0-9]{6}$/.test(pincode || '')) {
            errors.push({ msg: 'Enter a valid 6-digit pincode' });
        }

        const address = await Address.findOne({
            _id: req.params.id,
            user: req.session.userId
        });

        if (!address) {
            req.flash('error', 'Address not found');
            return res.redirect('/addresses');
        }

        if (errors.length) {
            return res.status(400).render('address/address-form', {
                title: 'Edit address',
                address: { ...req.body, _id: address._id },
                errors
            });
        }

        Object.assign(address, {
            fullName: fullName.trim(),
            phone,
            street: street.trim(),
            city: city.trim(),
            state: state.trim(),
            pincode
        });

        await address.save();

        req.flash('success', 'Address updated successfully');

        res.redirect('/addresses');

    } catch (error) {
        next(error);
    }
};


// DELETE /addresses/:id
// Delete address
const deleteAddress = async (req, res, next) => {
    try {

        const address = await Address.findOneAndDelete({
            _id: req.params.id,
            user: req.session.userId
        });

        if (!address) {
            req.flash('error', 'Address not found');
            return res.redirect('/addresses');
        }

        req.flash('success', 'Address deleted successfully');

        res.redirect('/addresses');

    } catch (error) {
        next(error);
    }
};


module.exports={
    getAddresses,
    getAddAddress,
    addAddress,
    getEditAddress,
    updateAddress,
    deleteAddress
}