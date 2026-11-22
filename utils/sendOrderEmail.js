
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendOrderEmail = async (email, order) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error('Email credentials are missing in .env');
    }

    const itemsList = order.items.map(item => `
        <tr>
            <td style="padding:10px; border:1px solid #ddd;">
                ${item.name}
            </td>
            <td style="padding:10px; border:1px solid #ddd;">
                ${item.quantity}
            </td>
            <td style="padding:10px; border:1px solid #ddd;">
                ₹${Number(item.price).toFixed(2)}
            </td>
        </tr>
    `).join('');

    const mailOptions = {
        from: `"Your Store" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Order Confirmation - Your Order Has Been Placed!',
        html: `
            <div style="font-family:Arial,sans-serif; max-width:600px; margin:auto; padding:20px;">

                <h2 style="color:#198754;">Thank you for your order!</h2>

                <p>Hello ${order.address.fullName},</p>

                <p>Your order has been placed successfully. Here are your order details:</p>

                <h3>Order Details</h3>

                <p><strong>Order ID:</strong> ${order._id}</p>
                <p><strong>Order Status:</strong> ${order.status}</p>
                <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
                <p><strong>Payment Status:</strong> ${order.paymentStatus}</p>

                <h3>Ordered Products</h3>

                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th style="padding:10px; border:1px solid #ddd;">Product</th>
                            <th style="padding:10px; border:1px solid #ddd;">Quantity</th>
                            <th style="padding:10px; border:1px solid #ddd;">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsList}
                    </tbody>
                </table>

                <h3>Total Amount: ₹${Number(order.totalAmount).toFixed(2)}</h3>

                <h3>Delivery Address</h3>

                <p>
                    ${order.address.fullName}<br>
                    ${order.address.street}<br>
                    ${order.address.city}, ${order.address.state}<br>
                    PIN: ${order.address.pincode}
                </p>

                <p>We will keep you updated about your order.</p>

                <p>Thank you for shopping with us!</p>

                <hr>

                <p style="color:#777; font-size:12px;">
                    This is an automated email. Please do not reply.
                </p>

            </div>
        `
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('Order confirmation email accepted by email server:', info.messageId);

    return info;
};

module.exports = sendOrderEmail;
