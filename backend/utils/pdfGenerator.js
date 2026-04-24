const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { formatCurrencyAmount } = require('./currency');

exports.generateInvoicePDF = async (invoice, user) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const fileName = `invoice-${invoice.invoiceNumber}.pdf`;
    const filePath = path.join(__dirname, '../invoices', fileName);
    
    // Ensure invoices directory exists
    if (!fs.existsSync(path.join(__dirname, '../invoices'))) {
      fs.mkdirSync(path.join(__dirname, '../invoices'));
    }
    
    doc.pipe(fs.createWriteStream(filePath));
    
    // Header
    doc.fontSize(24).text('ByteSky Cloud', { align: 'center' });
    doc.fontSize(12).text('Enterprise Cloud Solutions', { align: 'center' });
    doc.moveDown(2);
    
    // Invoice Details
    doc.fontSize(16).text('INVOICE', { align: 'right' });
    doc.fontSize(10).text(`Invoice Number: ${invoice.invoiceNumber}`, { align: 'right' });
    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, { align: 'right' });
    doc.text(`Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}`, { align: 'right' });
    doc.moveDown(2);
    
    // Bill To
    doc.fontSize(12).text('Bill To:');
    doc.fontSize(10).text(user.name);
    doc.text(user.email);
    doc.moveDown(2);
    
    // Items Table
    doc.fontSize(12).text('Items:', { underline: true });
    doc.moveDown(1);

    const currencyRegion = invoice.currency || invoice.region || 'us-east-1';
    
    let y = doc.y;
    doc.fontSize(10).text('Description', 50, y);
    doc.text('Quantity', 300, y);
    doc.text('Unit Price', 400, y);
    doc.text('Total', 500, y);
    doc.moveDown(1);
    
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    
    invoice.items.forEach((item, index) => {
      y = doc.y;
      doc.text(item.description, 50, y);
      doc.text(item.quantity.toString(), 300, y);
      doc.text(formatCurrencyAmount(item.unitPrice, currencyRegion), 400, y);
      doc.text(formatCurrencyAmount(item.total, currencyRegion), 500, y);
      doc.moveDown(1);
    });
    
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);
    
    // Total
    doc.fontSize(12).text(`Total Amount: ${formatCurrencyAmount(invoice.amount, currencyRegion)}`, { align: 'right' });
    doc.text(`Status: ${invoice.status}`, { align: 'right' });
    
    // Footer
    doc.moveDown(3);
    doc.fontSize(8).text('Thank you for choosing ByteSky Cloud!', { align: 'center' });
    doc.text('Support: support@bytesky.com | https://bytesky.cloud', { align: 'center' });
    
    doc.end();
    
    doc.on('finish', () => {
      resolve(filePath);
    });
    
    doc.on('error', reject);
  });
};
