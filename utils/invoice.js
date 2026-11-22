
const PDFDocument = require('pdfkit');

const generateInvoice = (order, res) => {
    const doc = new PDFDocument({
        size: 'A4',
        margin: 50
    });

    const invoiceNumber = String(order._id);
    const invoiceDate = order.createdAt
        ? new Date(order.createdAt).toLocaleDateString('en-IN')
        : new Date().toLocaleDateString('en-IN');

    // Set PDF response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
        'Content-Disposition',
        `attachment; filename="invoice-${invoiceNumber}.pdf"`
    );

    // Send PDF directly to the browser
    doc.pipe(res);

    // Store heading
    doc.fontSize(22)
        .font('Helvetica-Bold')
        .text('DailyShop', { align: 'center' });

    doc.moveDown();

    doc.fontSize(11)
        .font('Helvetica-Bold')
        .text('E-Commerce Store');

    doc.font('Helvetica')
        .text('Order Invoice')
        .moveDown();

    // Invoice information
    doc.font('Helvetica-Bold')
        .text('Invoice Number: ', { continued: true });

    doc.font('Helvetica')
        .text(invoiceNumber);

    doc.font('Helvetica-Bold')
        .text('Order Date: ', { continued: true });

    doc.font('Helvetica')
        .text(invoiceDate);

    doc.moveDown();

    // Customer details
    doc.font('Helvetica-Bold')
        .fontSize(13)
        .text('Customer Details');

    doc.moveDown(0.5);

    doc.font('Helvetica')
        .fontSize(10)
        .text(`Name: ${order.address.fullName}`)
        .text(`Phone: ${order.address.phone}`)
        .text(`Address: ${order.address.street}`)
        .text(
            `${order.address.city}, ${order.address.state} - ${order.address.pincode}`
        );

    doc.moveDown();

    // Product table heading
    doc.font('Helvetica-Bold')
        .fontSize(13)
        .text('Order Items');

    doc.moveDown(0.5);

    const tableTop = doc.y;
    const itemX = 50;
    const quantityX = 300;
    const priceX = 370;
    const totalX = 465;

    // Table column headings
    doc.fontSize(10)
        .text('Product', itemX, tableTop)
        .text('Qty', quantityX, tableTop)
        .text('Price', priceX, tableTop)
        .text('Total', totalX, tableTop);

    doc.moveTo(50, tableTop + 18)
        .lineTo(545, tableTop + 18)
        .stroke();

    let currentY = tableTop + 28;

    // Product rows
    order.items.forEach(item => {
        // Start a new page if there is not enough space
        if (currentY > 700) {
            doc.addPage();
            currentY = 50;
        }

        const itemTotal = Number(item.price) * Number(item.quantity);

        doc.font('Helvetica')
            .fontSize(9)
            .text(String(item.name || 'Product'), itemX, currentY, {
                width: 230
            })
            .text(String(item.quantity), quantityX, currentY)
            .text(`INR ${Number(item.price).toFixed(2)}`, priceX, currentY)
            .text(`INR ${itemTotal.toFixed(2)}`, totalX, currentY);

        currentY += 25;
    });

    // Move below the item rows
    doc.y = currentY + 10;

    doc.moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();

    doc.moveDown();

    // Amount summary
    const amountX = 350;
    const valueX = 465;

    const addAmountRow = (label, value) => {
        doc.fontSize(10)
            .font('Helvetica')
            .text(label, amountX, doc.y, { width: 110 })
            .text(`INR ${Number(value || 0).toFixed(2)}`, valueX, doc.y);

        doc.moveDown(0.8);
    };

    addAmountRow('Subtotal:', order.subtotal);
    addAmountRow('Discount:', order.discount);

    if (order.couponCode) {
        doc.fontSize(9)
            .text(`Coupon applied: ${order.couponCode}`);
        doc.moveDown(0.5);
    }

    doc.font('Helvetica-Bold')
        .fontSize(12)
        .text('Grand Total:', amountX, doc.y, { width: 110 })
        .text(
            `INR ${Number(order.totalAmount).toFixed(2)}`,
            valueX,
            doc.y
        );

    doc.moveDown(2);

    // Payment details
    doc.font('Helvetica-Bold')
        .fontSize(11)
        .text('Payment Details');

    doc.moveDown(0.5);

    doc.font('Helvetica')
        .fontSize(10)
        .text(`Payment Method: ${order.paymentMethod || 'N/A'}`)
        .text(`Payment Status: ${order.paymentStatus || 'N/A'}`)
        .text(`Order Status: ${order.status || 'N/A'}`);

    doc.moveDown(2);

    doc.fontSize(10)
        .text('Thank you for shopping with us!', {
            align: 'center'
        });

    // Finish PDF generation
    doc.end();
};

module.exports = generateInvoice;
