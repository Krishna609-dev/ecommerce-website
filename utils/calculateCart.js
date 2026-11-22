

const Coupon = require('../models/Coupon');

const calculateCart = async (items, couponCode = null) => {

    let subtotal = 0;

    // Calculate subtotal and individual product totals
    const updatedItems = items.map(item => {

        const price = Number(item.product.price);
        const quantity = Number(item.quantity);

        const lineTotal = price * quantity;

        subtotal += lineTotal;

        return {
            ...(item.toObject ? item.toObject() : item),
            lineTotal
        };
    });

    subtotal = Number(subtotal.toFixed(2));

    let discount = 0;
    let appliedCoupon = null;
    let couponError = null;

    // Validate coupon
    if (couponCode) {

        const code = couponCode.trim().toUpperCase();

        const coupon = await Coupon.findOne({
            code
        });

        if (!coupon) {

            couponError = 'Invalid coupon code';

        } else if (!coupon.isActive) {

            couponError = 'This coupon is inactive';

        } else if (
            coupon.expiryDate &&
            new Date(coupon.expiryDate) < new Date()
        ) {

            couponError = 'This coupon has expired';

        } else if (subtotal < coupon.minOrderAmount) {

            couponError = `Minimum order amount is ₹${coupon.minOrderAmount}. Add ₹${(coupon.minOrderAmount - subtotal).toFixed(2)} more to apply this coupon.`;

        } else {

            // Calculate percentage discount
            if (coupon.discountType === 'percentage') {

                discount = (subtotal * coupon.discountValue) / 100;

                // Check maximum discount
                if (
                    coupon.maxDiscount !== null &&
                    coupon.maxDiscount !== undefined
                ) {
                    discount = Math.min(
                        discount,
                        coupon.maxDiscount
                    );
                }

            } else {

                // Fixed discount
                discount = coupon.discountValue;
            }

            // Discount cannot exceed subtotal
            discount = Math.min(discount, subtotal);

            discount = Number(discount.toFixed(2));

            appliedCoupon = coupon.code;
        }
    }

    // Calculate final amount
    const total = Number((subtotal - discount).toFixed(2));

    return {
        items: updatedItems,
        subtotal,
        discount,
        total,
        totalAmount: total,
        couponCode: appliedCoupon,
        couponError
    };
};

module.exports = calculateCart;








// const calculateCart = (items) => {

//     let subtotal = 0;

//     const updatedItems = items.map(item => {

//         const price = Number(item.product.price);
//         const quantity = Number(item.quantity);

//         const lineTotal = price * quantity;

//         subtotal += lineTotal;

//         return {
//             ...item.toObject(),
//             lineTotal
//         };
//     });

//     // Coupon functionality can be connected later
//     const discount = 0;

//     const total = subtotal - discount;

//     return {
//         items: updatedItems,
//         subtotal,
//         discount,
//         total,
//         couponCode: null
//     };
// };

// module.exports = calculateCart;
