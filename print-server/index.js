const express = require('express');
const cors = require('cors');
const net = require('net');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 9100;

// ESC/POS command constants
const ESC = '\x1B';
const GS = '\x1D';
const COMMANDS = {
  INIT: ESC + '@',
  BOLD_ON: ESC + 'E' + '\x01',
  BOLD_OFF: ESC + 'E' + '\x00',
  DOUBLE_HEIGHT: ESC + '!' + '\x10',
  DOUBLE_WIDTH: ESC + '!' + '\x20',
  DOUBLE_SIZE: ESC + '!' + '\x30',
  NORMAL_SIZE: ESC + '!' + '\x00',
  ALIGN_CENTER: ESC + 'a' + '\x01',
  ALIGN_LEFT: ESC + 'a' + '\x00',
  ALIGN_RIGHT: ESC + 'a' + '\x02',
  LINE_FEED: '\n',
  CUT: GS + 'V' + '\x41' + '\x03', // Partial cut with 3-line feed
  SEPARATOR: '--------------------------------\n',
  OPEN_DRAWER: ESC + 'p' + '\x00' + '\x19' + '\xFA',
};

// Format a line with left and right aligned text (for 32-char width)
function formatLine(left, right, width = 32) {
  const space = width - left.length - right.length;
  if (space <= 0) return left.substring(0, width - right.length) + right;
  return left + ' '.repeat(space) + right;
}

// Pad/truncate text to fit column width
function padText(text, width, align = 'left') {
  const str = String(text).substring(0, width);
  if (align === 'right') return str.padStart(width);
  return str.padEnd(width);
}

// Build KOT print data (for cafe counter, mocktail counter, juice bar printers)
function buildKOTPrintData(data) {
  const { kotNumber, orderNumber, tableName, orderType, items, notes, stationName } = data;

  let receipt = '';
  receipt += COMMANDS.INIT;

  // Header - station name
  receipt += COMMANDS.ALIGN_CENTER;
  receipt += COMMANDS.DOUBLE_SIZE;
  receipt += (stationName || 'KOT').toUpperCase() + '\n';
  receipt += COMMANDS.NORMAL_SIZE;
  receipt += COMMANDS.SEPARATOR;

  // KOT number and order info
  receipt += COMMANDS.ALIGN_LEFT;
  receipt += COMMANDS.BOLD_ON;
  receipt += formatLine('KOT: ' + kotNumber, orderNumber) + '\n';
  receipt += COMMANDS.BOLD_OFF;

  // Table or takeaway
  if (orderType === 'takeaway') {
    receipt += COMMANDS.DOUBLE_HEIGHT;
    receipt += 'TAKEAWAY\n';
    receipt += COMMANDS.NORMAL_SIZE;
  } else if (tableName) {
    receipt += COMMANDS.DOUBLE_HEIGHT;
    receipt += 'Table: ' + tableName + '\n';
    receipt += COMMANDS.NORMAL_SIZE;
  }

  // Date/Time
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
  receipt += formatLine(dateStr, timeStr) + '\n';
  receipt += COMMANDS.SEPARATOR;

  // Items
  receipt += COMMANDS.BOLD_ON;
  receipt += formatLine('Item', 'Qty') + '\n';
  receipt += COMMANDS.BOLD_OFF;
  receipt += COMMANDS.SEPARATOR;

  for (const item of items) {
    receipt += COMMANDS.DOUBLE_HEIGHT;
    receipt += formatLine(
      padText(item.name, 28),
      padText('x' + item.quantity, 4, 'right')
    ) + '\n';
    receipt += COMMANDS.NORMAL_SIZE;

    if (item.variant) {
      receipt += '  > ' + item.variant + '\n';
    }
    if (item.notes) {
      receipt += '  ** ' + item.notes + ' **\n';
    }
  }

  receipt += COMMANDS.SEPARATOR;

  // Order notes
  if (notes) {
    receipt += COMMANDS.BOLD_ON;
    receipt += 'NOTE: ' + notes + '\n';
    receipt += COMMANDS.BOLD_OFF;
    receipt += COMMANDS.SEPARATOR;
  }

  receipt += '\n\n';
  receipt += COMMANDS.CUT;

  return receipt;
}

// Build bill/receipt print data (for cashier printer)
function buildBillPrintData(data) {
  const {
    cafeName, cafeAddress, gstNumber,
    billNumber, orderNumber, tableName, orderType,
    items, subtotal, gstPercent, gstAmount,
    serviceCharge, discountAmount, discountType,
    total, paymentMode, payments,
  } = data;

  let receipt = '';
  receipt += COMMANDS.INIT;

  // Header
  receipt += COMMANDS.ALIGN_CENTER;
  receipt += COMMANDS.DOUBLE_SIZE;
  receipt += (cafeName || 'Levantage Cafe') + '\n';
  receipt += COMMANDS.NORMAL_SIZE;
  if (cafeAddress) receipt += cafeAddress + '\n';
  if (gstNumber) receipt += 'GSTIN: ' + gstNumber + '\n';
  receipt += COMMANDS.SEPARATOR;

  // Bill info
  receipt += COMMANDS.ALIGN_LEFT;
  receipt += formatLine('Bill: ' + billNumber, orderNumber) + '\n';

  if (orderType === 'takeaway') {
    receipt += 'Type: TAKEAWAY\n';
  } else if (tableName) {
    receipt += 'Table: ' + tableName + '\n';
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  receipt += formatLine(dateStr, timeStr) + '\n';
  receipt += COMMANDS.SEPARATOR;

  // Items header
  receipt += COMMANDS.BOLD_ON;
  receipt += formatLine(padText('Item', 16), padText('Qty', 4) + padText('Amt', 8, 'right')) + '\n';
  receipt += COMMANDS.BOLD_OFF;
  receipt += COMMANDS.SEPARATOR;

  // Items
  for (const item of items) {
    const amt = (item.unitPrice * item.quantity).toFixed(0);
    receipt += formatLine(
      padText(item.name, 20),
      padText(item.quantity.toString(), 4) + padText(amt, 8, 'right')
    ) + '\n';
    if (item.variant) {
      receipt += '  ' + item.variant + '\n';
    }
  }

  receipt += COMMANDS.SEPARATOR;

  // Totals
  receipt += formatLine('Subtotal', subtotal.toFixed(2)) + '\n';

  if (gstAmount > 0) {
    receipt += formatLine('GST (' + gstPercent + '%)', gstAmount.toFixed(2)) + '\n';
  }

  if (serviceCharge > 0) {
    receipt += formatLine('Service Charge', serviceCharge.toFixed(2)) + '\n';
  }

  if (data.serviceChargeRemoved) {
    receipt += formatLine('Service Charge', 'WAIVED') + '\n';
  }

  if (discountAmount > 0) {
    const discLabel = discountType === 'percent' ? 'Discount (%)' : 'Discount';
    receipt += formatLine(discLabel, '-' + discountAmount.toFixed(2)) + '\n';
    if (data.discountReason) {
      receipt += '  Reason: ' + data.discountReason + '\n';
    }
  }

  receipt += COMMANDS.SEPARATOR;
  receipt += COMMANDS.BOLD_ON;
  receipt += COMMANDS.DOUBLE_HEIGHT;
  receipt += formatLine('TOTAL', 'Rs. ' + total.toFixed(2)) + '\n';
  receipt += COMMANDS.NORMAL_SIZE;
  receipt += COMMANDS.BOLD_OFF;
  receipt += COMMANDS.SEPARATOR;

  // Payment info
  if (paymentMode) {
    receipt += formatLine('Payment', paymentMode.toUpperCase()) + '\n';
  }
  if (payments && payments.length > 0) {
    for (const p of payments) {
      receipt += formatLine('  ' + p.mode.toUpperCase(), p.amount.toFixed(2)) + '\n';
    }
  }

  if (data.isReprint) {
    receipt += '\n';
    receipt += COMMANDS.ALIGN_CENTER;
    receipt += COMMANDS.BOLD_ON;
    receipt += '*** DUPLICATE ***\n';
    receipt += COMMANDS.BOLD_OFF;
    receipt += COMMANDS.ALIGN_LEFT;
  }

  receipt += '\n';
  receipt += COMMANDS.ALIGN_CENTER;
  receipt += 'Thank you! Visit again.\n';
  receipt += '\n\n';
  receipt += COMMANDS.CUT;

  return receipt;
}

// Send data to printer via TCP
function sendToPrinter(printerIp, printerPort, data) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error(`Connection to ${printerIp}:${printerPort} timed out`));
    }, 5000);

    client.connect(printerPort, printerIp, () => {
      clearTimeout(timeout);
      client.write(Buffer.from(data, 'binary'), (err) => {
        if (err) {
          client.destroy();
          reject(err);
        } else {
          client.end();
          resolve(true);
        }
      });
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Print KOT
app.post('/print/kot', async (req, res) => {
  try {
    const { printerIp, printerPort = 9100, ...kotData } = req.body;

    if (!printerIp) {
      return res.status(400).json({ error: 'printerIp is required' });
    }

    const printData = buildKOTPrintData(kotData);
    await sendToPrinter(printerIp, printerPort, printData);

    res.json({ success: true, message: `KOT sent to ${printerIp}:${printerPort}` });
  } catch (err) {
    console.error('KOT print error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Print Bill/Receipt
app.post('/print/bill', async (req, res) => {
  try {
    const { printerIp, printerPort = 9100, ...billData } = req.body;

    if (!printerIp) {
      return res.status(400).json({ error: 'printerIp is required' });
    }

    const printData = buildBillPrintData(billData);
    await sendToPrinter(printerIp, printerPort, printData);

    res.json({ success: true, message: `Bill sent to ${printerIp}:${printerPort}` });
  } catch (err) {
    console.error('Bill print error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Open cash drawer (connected to cashier printer)
app.post('/print/open-drawer', async (req, res) => {
  try {
    const { printerIp, printerPort = 9100 } = req.body;

    if (!printerIp) {
      return res.status(400).json({ error: 'printerIp is required' });
    }

    await sendToPrinter(printerIp, printerPort, COMMANDS.OPEN_DRAWER);

    res.json({ success: true, message: 'Cash drawer opened' });
  } catch (err) {
    console.error('Cash drawer error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Test printer connection
app.post('/print/test', async (req, res) => {
  try {
    const { printerIp, printerPort = 9100 } = req.body;

    if (!printerIp) {
      return res.status(400).json({ error: 'printerIp is required' });
    }

    const testData = COMMANDS.INIT +
      COMMANDS.ALIGN_CENTER +
      COMMANDS.DOUBLE_SIZE +
      'PRINTER TEST\n' +
      COMMANDS.NORMAL_SIZE +
      COMMANDS.SEPARATOR +
      'Levantage Cafe\n' +
      'Printer: ' + printerIp + '\n' +
      'Time: ' + new Date().toLocaleString('en-IN') + '\n' +
      COMMANDS.SEPARATOR +
      'Printer is working!\n' +
      '\n\n' +
      COMMANDS.CUT;

    await sendToPrinter(printerIp, printerPort, testData);

    res.json({ success: true, message: `Test page sent to ${printerIp}:${printerPort}` });
  } catch (err) {
    console.error('Test print error:', err.message);
    res.status(500).json({ error: err.message, connected: false });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Levantage Print Server running on http://0.0.0.0:${PORT}`);
  console.log('Endpoints:');
  console.log('  GET  /health          - Health check');
  console.log('  POST /print/kot       - Print KOT to station printer');
  console.log('  POST /print/bill      - Print bill/receipt');
  console.log('  POST /print/open-drawer - Open cash drawer');
  console.log('  POST /print/test      - Test printer connection');
});
