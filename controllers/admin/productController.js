
const Product = require('../../models/Product');
const Category = require('../../models/Category');
const fs = require('fs');
const path = require('path');

const uploadPath = path.join(__dirname, '../../public/uploads');

// Delete uploaded files from the uploads folder
function deleteImages(images) {
  images.forEach(function (image) {
    const imagePath = path.join(uploadPath, path.basename(image));

    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  });
}

// Display all products
const getProducts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 10;

    const totalProducts = await Product.countDocuments();

    const products = await Product.find()
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.render('admin/products', {
      title: 'Products',
      activePage: 'products',
      products,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      baseQuery: '/admin/products?'
    });
  } catch (error) {
    next(error);
  }
};

// Display add product form
const showAddProduct = async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 });

    res.render('admin/product-form', {
      title: 'Add product',
      activePage: 'products',
      product: null,
      categories,
      errors: []
    });
  } catch (error) {
    next(error);
  }
};

// Add product
const createProduct = async (req, res, next) => {
  try {
    const { name, description, price, stock, category } = req.body;

const isFeatured = req.body.isFeatured === 'on';
    const images = (req.files || []).map(file => file.filename);

    const errors = [];

    if (!name || !name.trim()) {
      errors.push({ msg: 'Product name is required.' });
    }

    if (!description || !description.trim()) {
      errors.push({ msg: 'Description is required.' });
    }

    if (!Number.isFinite(Number(price)) || Number(price) < 0.01) {
      errors.push({ msg: 'Price must be at least 0.01.' });
    }

    if (
      stock === undefined ||
      !/^\d+$/.test(String(stock)) ||
      !Number.isSafeInteger(Number(stock))
    ) {
      errors.push({ msg: 'Stock must be a non-negative whole number.' });
    }

    const validCategory = category &&
      await Category.findById(category);

    if (!validCategory) {
      errors.push({ msg: 'Please select a valid category.' });
    }

    if (errors.length) {
      deleteImages(images);

      return res.status(400).render('admin/product-form', {
        title: 'Add product',
        activePage: 'products',
        product: { name, description, price, stock, category, images: [] },
        categories: await Category.find().sort({ name: 1 }),
        errors
      });
    }

    await Product.create({
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      stock: Number(stock),
      category,
      images,
      isFeatured
    });

    res.redirect('/admin/products');
  } catch (error) {
    next(error);
  }
};

// Display edit form
const showEditProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).send('Product not found.');
    }

    const categories = await Category.find().sort({ name: 1 });

    res.render('admin/product-form', {
      title: 'Edit product',
      activePage: 'products',
      product,
      categories,
      errors: []
    });
  } catch (error) {
    next(error);
  }
};

// Update product
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      deleteImages((req.files || []).map(file => file.filename));
      return res.status(404).send('Product not found.');
    }

    const { name, description, price, stock, category } = req.body;
    const isFeatured = req.body.isFeatured === 'on';
    const errors = [];

    if (!name || !name.trim()) {
      errors.push({ msg: 'Product name is required.' });
    }

    if (!description || !description.trim()) {
      errors.push({ msg: 'Description is required.' });
    }

    if (!Number.isFinite(Number(price)) || Number(price) < 0.01) {
      errors.push({ msg: 'Price must be at least 0.01.' });
    }

    if (
      stock === undefined ||
      !/^\d+$/.test(String(stock)) ||
      !Number.isSafeInteger(Number(stock))
    ) {
      errors.push({ msg: 'Stock must be a non-negative whole number.' });
    }

    const validCategory = category &&
      await Category.findById(category);

    if (!validCategory) {
      errors.push({ msg: 'Please select a valid category.' });
    }

    const newImages = (req.files || []).map(file => file.filename);

    if (errors.length) {
      deleteImages(newImages);

      return res.status(400).render('admin/product-form', {
        title: 'Edit product',
        activePage: 'products',
        product: {
          ...product.toObject(),
          name,
          description,
          price,
          stock,
          category
        },
        categories: await Category.find().sort({ name: 1 }),
        errors
      });
    }

    const oldImages = product.images;

    product.name = name.trim();
    product.description = description.trim();
    product.price = Number(price);
    product.stock = Number(stock);
    product.category = category;

    // Replace images only when new images are uploaded.
    if (newImages.length > 0) {
      product.images = newImages;
    }
    product.isFeatured = isFeatured;

    await product.save();

    if (newImages.length > 0) {
      deleteImages(oldImages);
    }

    res.redirect('/admin/products');
  } catch (error) {
    deleteImages((req.files || []).map(file => file.filename));
    next(error);
  }
};

// Delete product
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).send('Product not found.');
    }

    const images = product.images;

    await Product.findByIdAndDelete(req.params.id);
    deleteImages(images);

    res.redirect('/admin/products');
  } catch (error) {
    next(error);
  }
};

// Update stock from the product list

// POST /admin/products/:id/stock
// A3: Update product stock
const updateStock = async (req, res, next) => {
    try {
        const { stock } = req.body;
        const newStock = Number(stock);

        // Stock must be a whole number >= 0
        if (
            stock === '' ||
            !Number.isInteger(newStock) ||
            newStock < 0
        ) {
            req.flash('error', 'Enter a valid stock quantity');
            return res.redirect('/admin/products');
        }

        const product = await Product.findById(req.params.id);

        if (!product) {
            req.flash('error', 'Product not found');
            return res.redirect('/admin/products');
        }

        product.stock = newStock;
        await product.save();

        req.flash('success', 'Product stock updated successfully');
        res.redirect('/admin/products');

    } catch (error) {
        next(error);
    }
};



// const updateStock = async (req, res, next) => {
//   try {
//     const { stock } = req.body;

//     if (
//       stock === undefined ||
//       !/^\d+$/.test(String(stock)) ||
//       !Number.isSafeInteger(Number(stock))
//     ) {
//       return res.status(400).send('Stock must be a non-negative whole number.');
//     }

//     const product = await Product.findByIdAndUpdate(
//       req.params.id,
//       { $set: { stock: Number(stock) } },
//       { runValidators: true, new: true }
//     );

//     if (!product) {
//       return res.status(404).send('Product not found.');
//     }

//     res.redirect('/admin/products');
//   } catch (error) {
//     next(error);
//   }
// };

module.exports = {
  getProducts,
  showAddProduct,
  createProduct,
  showEditProduct,
  updateProduct,
  deleteProduct,
  updateStock
};
