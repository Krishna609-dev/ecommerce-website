
const Category = require('../../models/Category');
const Product = require('../../models/Product');

// Display all categories
const getCategories = async (req, res, next) => {
    try {
        // Fetch all categories from the database, sorted by creation date in descending order
        const categories = await Category.find().sort({ createdAt: -1 });

        // open admin categories page and pass the categories data to the view
        res.render('admin/categories', {
            title: 'Categories',
            activePage: 'categories',
            categories,
            errors: []
        });
    } catch (error) {
        next(error);
    }
};

// Add a new category
const addCategory = async (req, res, next) => {
    try {
        //read form input from request body
        const name = (req.body.name || '').trim();

        if (!name) {
            const categories = await Category.find().sort({ createdAt: -1 });

            return res.status(400).render('admin/categories', {
                title: 'Categories',
                activePage: 'categories',
                categories,
                errors: [{ msg: 'Category name is required.' }]
            });
        }

        // Check for duplicate category names
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(
                '^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$',
                'i'
            )}
        });

        if (existingCategory) {
            const categories = await Category.find().sort({ createdAt: -1 });

            return res.status(400).render('admin/categories', {
                title: 'Categories',
                activePage: 'categories',
                categories,
                errors: [{ msg: 'This category already exists.' }]
            });
        }
       // saves new category into Mongodb
        await Category.create({ name, isActive: true });
      // after adding relod categories page
        res.redirect('/admin/categories');
    } catch (error) {
        next(error);
    }
};

// Edit category name and active status
const updateCategory = async (req, res, next) => {
    try {
        const name = (req.body.name || '').trim();

        if (!name) {
            return res.status(400).send('Category name is required.');
        }

        const category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(404).send('Category not found.');
        }

        const duplicate = await Category.findOne({
            _id: { $ne: category._id },
            name: { $regex: new RegExp(
                '^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$',
                'i'
            )}
        });

        if (duplicate) {
            return res.status(400).send('That category name already exists.');
        }

        category.name = name;
        category.isActive = req.body.isActive === 'true';

        await category.save();

        res.redirect('/admin/categories');
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).send('That category name already exists.');
        }
        next(error);
    }
};

// Delete category
const deleteCategory = async (req, res, next) => {
    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(404).send('Category not found.');
        }

        // Prevent deletion if products use this category
        const hasProducts = await Product.exists({
            category: category._id
        });

        if (hasProducts) {
            return res.status(400).send(
                'This category contains products. Remove or reassign those products first.'
            );
        }

        await Category.findByIdAndDelete(category._id);

        res.redirect('/admin/categories');
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getCategories,
    addCategory,
    updateCategory,
    deleteCategory
};
