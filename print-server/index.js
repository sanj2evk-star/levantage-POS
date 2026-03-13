require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const net = require('net');

// Configuration - read from environment or .env file
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ivhmvhnrxiodpneflszu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ESC/POS command constants
const ESC = '\x1B';
const GS = '\x1D';
const COMMANDS = {
  INIT: ESC + '@' + ESC + 't' + '\x10', // Init + set Code Page WPC1252 for accented chars
  BOLD_ON: ESC + 'E' + '\x01',
  BOLD_OFF: ESC + 'E' + '\x00',
  DOUBLE_HEIGHT: ESC + '!' + '\x10',
  DOUBLE_WIDTH: ESC + '!' + '\x20',
  DOUBLE_SIZE: ESC + '!' + '\x30',
  NORMAL_SIZE: ESC + '!' + '\x00',
  ALIGN_CENTER: ESC + 'a' + '\x01',
  ALIGN_LEFT: ESC + 'a' + '\x00',
  ALIGN_RIGHT: ESC + 'a' + '\x02',
  UNDERLINE_ON: ESC + '-' + '\x01',
  UNDERLINE_OFF: ESC + '-' + '\x00',
  LINE_FEED: '\n',
  CUT: GS + 'V' + '\x41' + '\x03', // Partial cut with 3-line feed
  SEPARATOR: '------------------------------------------------\n', // 48 chars for Epson TM-T82II (M335A)
  DOUBLE_SEPARATOR: '================================================\n',
  OPEN_DRAWER: ESC + 'p' + '\x00' + '\x19' + '\xFA',
};

// Paper width: 48 chars for 80mm Epson printers (Font A, 12×24 at 203 DPI)
// Billing: Epson M335A (TM-T82II), KOT: Epson M352A3 — all 80mm, 48 chars
const PAPER_WIDTH = 48;

// Format a line with left and right aligned text
function formatLine(left, right, width = PAPER_WIDTH) {
  left = String(left);
  right = String(right);
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

// Build KOT print data — Petpooja style
function buildKOTPrintData(data) {
  const { kotNumber, orderNumber, tableName, orderType, items, notes, stationName, waiterName } = data;

  let receipt = '';
  receipt += COMMANDS.INIT;

  // Header — station name + KOT (like Petpooja: "COFFEE COUNTER KOT")
  receipt += COMMANDS.ALIGN_CENTER;
  receipt += COMMANDS.BOLD_ON;
  receipt += COMMANDS.DOUBLE_SIZE;
  receipt += (stationName || 'KOT').toUpperCase() + ' KOT\n';
  receipt += COMMANDS.NORMAL_SIZE;
  receipt += COMMANDS.BOLD_OFF;

  // Date/Time
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
  receipt += dateStr + ' ' + timeStr + '\n';
  receipt += COMMANDS.SEPARATOR;

  // KOT number (stay center aligned)
  receipt += COMMANDS.BOLD_ON;
  receipt += 'KOT: ' + kotNumber + '\n';
  receipt += COMMANDS.BOLD_OFF;

  // Order type — Dine In / Takeaway
  if (orderType === 'takeaway') {
    receipt += COMMANDS.DOUBLE_HEIGHT;
    receipt += 'TAKEAWAY\n';
    receipt += COMMANDS.NORMAL_SIZE;
  } else {
    receipt += 'Dine In\n';
  }

  // Table name — like Petpooja: "Table No C2"
  if (tableName) {
    receipt += COMMANDS.DOUBLE_HEIGHT;
    receipt += 'Table No ' + tableName + '\n';
    receipt += COMMANDS.NORMAL_SIZE;
  }

  // Captain (waiter name) — like Petpooja: "Captain: GIRIDHAR"
  if (waiterName) {
    receipt += 'Captain: ' + waiterName.toUpperCase() + '\n';
  }

  receipt += COMMANDS.SEPARATOR;

  // Items header
  receipt += COMMANDS.BOLD_ON;
  receipt += formatLine('Item', 'Qty') + '\n';
  receipt += COMMANDS.BOLD_OFF;
  receipt += COMMANDS.SEPARATOR;

  // Items — large text
  for (const item of items) {
    receipt += COMMANDS.DOUBLE_HEIGHT;
    receipt += formatLine(
      padText(item.name, PAPER_WIDTH - 6),
      padText('x' + item.quantity, 4, 'right')
    ) + '\n';
    receipt += COMMANDS.NORMAL_SIZE;

    if (item.variant) {
      receipt += '  > ' + item.variant + '\n';
    }
    if (item.notes) {
      receipt += '  (Note) ' + item.notes + '\n';
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

// Build bill/receipt print data — Petpooja style
function buildBillPrintData(data) {
  const {
    cafeName, cafeAddress, gstNumber, fssaiNumber,
    billNumber, orderNumber, tableName, orderType,
    cashierName, waiterName,
    items, subtotal, gstPercent, gstAmount,
    serviceCharge, discountAmount, discountType,
    total, paymentMode, payments,
  } = data;

  let receipt = '';
  receipt += COMMANDS.INIT;

  // Duplicate label for reprints (at top, like Petpooja)
  if (data.isReprint) {
    receipt += COMMANDS.ALIGN_CENTER;
    receipt += COMMANDS.BOLD_ON;
    receipt += 'Duplicate\n';
    receipt += COMMANDS.BOLD_OFF;
  }

  // Header — Restaurant name (large)
  receipt += COMMANDS.ALIGN_CENTER;
  receipt += COMMANDS.DOUBLE_SIZE;
  receipt += (cafeName || 'L\xe9 Vantage Caf\xe9') + '\n';
  receipt += COMMANDS.NORMAL_SIZE;

  // Address
  if (cafeAddress) {
    receipt += cafeAddress + '\n';
  }

  // GSTIN
  if (gstNumber) {
    receipt += 'GSTIN: ' + gstNumber + '\n';
  }

  receipt += COMMANDS.SEPARATOR;

  // Date, time, table info — center aligned
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const isPreview = paymentMode === 'preview';

  if (isPreview) {
    receipt += formatLine('Order: ' + orderNumber, '** PREVIEW **') + '\n';
  } else {
    // Bill number — bold and prominent
    receipt += COMMANDS.BOLD_ON;
    receipt += COMMANDS.DOUBLE_HEIGHT;
    receipt += 'Bill No: ' + billNumber + '\n';
    receipt += COMMANDS.NORMAL_SIZE;
    receipt += COMMANDS.BOLD_OFF;

    receipt += formatLine('Date: ' + dateStr, timeStr) + '\n';

    // Dine In / Takeaway with table
    if (orderType === 'takeaway') {
      receipt += 'Type: TAKEAWAY\n';
    } else if (tableName) {
      receipt += 'Dine In: ' + tableName + '\n';
    }

    // Order number
    receipt += 'Order: ' + orderNumber + '\n';

    // Cashier
    if (cashierName) {
      receipt += 'Cashier: ' + cashierName.toUpperCase() + '\n';
    }

    // Waiter — like Petpooja: "Assign to MAHESH"
    if (waiterName) {
      receipt += 'Assign to ' + waiterName.toUpperCase() + '\n';
    }
  }

  receipt += COMMANDS.SEPARATOR;

  // Switch to left alignment for items and totals
  receipt += COMMANDS.ALIGN_LEFT;

  // Items header — 4 columns: Item | Qty | Price | Amount
  // Layout for 48 chars: Item(28) Qty(4) Price(8) Amount(8) = 48
  const ITEM_COL = PAPER_WIDTH - 20; // 28 chars for item name (48-20)
  receipt += COMMANDS.BOLD_ON;
  receipt += padText('Item', ITEM_COL) + padText('Qty', 4, 'right') + padText('Price', 8, 'right') + padText('Amt', 8, 'right') + '\n';
  receipt += COMMANDS.BOLD_OFF;
  receipt += COMMANDS.SEPARATOR;

  // Items — 4 columns, left aligned
  for (const item of items) {
    const amt = (item.unitPrice * item.quantity).toFixed(0);
    const price = item.unitPrice.toFixed(0);

    if (item.name.length > ITEM_COL) {
      // Long name: print name on first line, numbers on second
      receipt += item.name + '\n';
      receipt += padText('', ITEM_COL) + padText(item.quantity.toString(), 4, 'right') + padText(price, 8, 'right') + padText(amt, 8, 'right') + '\n';
    } else {
      receipt += padText(item.name, ITEM_COL) + padText(item.quantity.toString(), 4, 'right') + padText(price, 8, 'right') + padText(amt, 8, 'right') + '\n';
    }

    if (item.variant) {
      receipt += '  ' + item.variant + '\n';
    }
  }

  // Total quantity
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  receipt += COMMANDS.SEPARATOR;
  receipt += formatLine('Total Qty: ' + totalQty, 'Sub') + '\n';
  receipt += formatLine('', 'Total  ' + subtotal.toFixed(2)) + '\n';

  // Service Charge (SC)
  if (serviceCharge > 0) {
    receipt += formatLine('SC', serviceCharge.toFixed(2)) + '\n';
  }
  if (data.serviceChargeRemoved) {
    receipt += formatLine('SC', 'WAIVED') + '\n';
  }

  // Split GST — SGST 2.5% + CGST 2.5% like Petpooja (instead of combined 5%)
  if (gstAmount > 0) {
    const halfGst = gstPercent / 2;
    const halfAmount = (gstAmount / 2).toFixed(2);
    receipt += formatLine('SGST ' + halfGst.toFixed(1) + '%', halfAmount) + '\n';
    receipt += formatLine('CGST ' + halfGst.toFixed(1) + '%', halfAmount) + '\n';
  }

  // Discount
  if (discountAmount > 0) {
    const discLabel = discountType === 'percent' ? 'Discount (%)' : 'Discount';
    receipt += formatLine(discLabel, '-' + discountAmount.toFixed(2)) + '\n';
    if (data.discountReason) {
      receipt += '  Reason: ' + data.discountReason + '\n';
    }
  }

  // Round off — round total to nearest rupee
  const roundedTotal = Math.round(total);
  const roundOff = roundedTotal - total;
  if (Math.abs(roundOff) >= 0.01) {
    const roundOffStr = roundOff >= 0 ? '+' + roundOff.toFixed(2) : roundOff.toFixed(2);
    receipt += formatLine('Round off', roundOffStr) + '\n';
  }

  // Grand Total — large, bold
  // DOUBLE_SIZE = 2x width, so effective line is PAPER_WIDTH/2 chars
  receipt += COMMANDS.SEPARATOR;
  receipt += COMMANDS.BOLD_ON;
  receipt += COMMANDS.DOUBLE_SIZE;
  receipt += formatLine('Total', 'Rs.' + roundedTotal.toFixed(0), Math.floor(PAPER_WIDTH / 2)) + '\n';
  receipt += COMMANDS.NORMAL_SIZE;
  receipt += COMMANDS.BOLD_OFF;
  receipt += COMMANDS.SEPARATOR;

  // Payment info
  if (isPreview) {
    receipt += '\n';
    receipt += COMMANDS.ALIGN_CENTER;
    receipt += COMMANDS.BOLD_ON;
    receipt += '*** NOT SETTLED ***\n';
    receipt += COMMANDS.BOLD_OFF;
  } else {
    if (paymentMode && paymentMode !== 'split') {
      receipt += formatLine('Payment', paymentMode.toUpperCase()) + '\n';
    }
    if (payments && payments.length > 0) {
      for (const p of payments) {
        receipt += formatLine('  ' + p.mode.toUpperCase(), p.amount.toFixed(2)) + '\n';
      }
    }
  }

  // Footer
  receipt += '\n';
  receipt += COMMANDS.ALIGN_CENTER;

  // FSSAI License — like Petpooja
  if (fssaiNumber) {
    receipt += 'FSSAI Lic No. ' + fssaiNumber + '\n';
  }

  if (isPreview) {
    receipt += 'Please verify the bill.\n';
  } else {
    receipt += 'Thank You! Please Visit Again!\n';
  }

  receipt += '\n\n';
  receipt += COMMANDS.CUT;

  return receipt;
}

// Build test print data
function buildTestPrintData(printerIp) {
  let receipt = '';
  receipt += COMMANDS.INIT;
  receipt += COMMANDS.ALIGN_CENTER;
  receipt += COMMANDS.DOUBLE_SIZE;
  receipt += 'PRINTER TEST\n';
  receipt += COMMANDS.NORMAL_SIZE;
  receipt += COMMANDS.SEPARATOR;
  receipt += 'Levantage Cafe\n';
  receipt += 'Printer: ' + printerIp + '\n';
  receipt += 'Time: ' + new Date().toLocaleString('en-IN') + '\n';
  receipt += COMMANDS.SEPARATOR;
  receipt += 'Printer is working!\n';
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

// Process a single print job
async function processJob(job) {
  console.log(`[PRINT] Processing job ${job.id} - type: ${job.type}, printer: ${job.printer_ip}:${job.printer_port}`);

  // Mark as printing
  await supabase.from('print_jobs').update({ status: 'printing' }).eq('id', job.id);

  try {
    let printData;
    switch (job.type) {
      case 'kot':
        printData = buildKOTPrintData(job.payload);
        break;
      case 'bill':
        printData = buildBillPrintData(job.payload);
        break;
      case 'open_drawer':
        printData = COMMANDS.OPEN_DRAWER;
        break;
      case 'test':
        printData = buildTestPrintData(job.printer_ip);
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }

    await sendToPrinter(job.printer_ip, job.printer_port || 9100, printData);

    await supabase.from('print_jobs').update({
      status: 'printed',
      printed_at: new Date().toISOString()
    }).eq('id', job.id);

    console.log(`[PRINT] Job ${job.id} printed successfully`);
  } catch (err) {
    await supabase.from('print_jobs').update({
      status: 'failed',
      error: err.message
    }).eq('id', job.id);

    console.error(`[PRINT] Job ${job.id} failed:`, err.message);
  }
}

// Process any pending jobs (on startup or reconnect)
async function processPendingJobs() {
  const { data: jobs, error } = await supabase
    .from('print_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[STARTUP] Error fetching pending jobs:', error.message);
    return;
  }

  if (jobs && jobs.length > 0) {
    console.log(`[STARTUP] Found ${jobs.length} pending job(s)`);
    for (const job of jobs) {
      await processJob(job);
    }
  } else {
    console.log('[STARTUP] No pending jobs');
  }
}

// Subscribe to realtime INSERT events on print_jobs
function startListening() {
  console.log('[PROXY] Subscribing to print_jobs realtime...');

  supabase
    .channel('print-jobs')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'print_jobs',
      filter: 'status=eq.pending'
    }, (payload) => {
      processJob(payload.new);
    })
    .subscribe((status) => {
      console.log(`[PROXY] Realtime status: ${status}`);
      if (status === 'SUBSCRIBED') {
        console.log('[PROXY] Listening for print jobs...');
        // Process any pending jobs that arrived while we were connecting
        processPendingJobs();
      }
    });
}

// Cleanup old printed/failed jobs (older than 24 hours)
async function cleanupOldJobs() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('print_jobs')
    .delete()
    .in('status', ['printed', 'failed'])
    .lt('created_at', oneDayAgo);

  if (error) {
    console.error('[CLEANUP] Error cleaning old jobs:', error.message);
  }
}

// Startup
async function main() {
  console.log('========================================');
  console.log('  Le Vantage Cafe - Print Proxy v2.1');
  console.log('========================================');
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log('');

  if (!SUPABASE_KEY) {
    console.error('ERROR: SUPABASE_KEY environment variable is required!');
    console.error('Set it in .env file or as environment variable');
    process.exit(1);
  }

  // Process any pending jobs first
  await processPendingJobs();

  // Start realtime subscription
  startListening();

  // Periodic cleanup of old jobs (every hour)
  setInterval(cleanupOldJobs, 60 * 60 * 1000);
}

main().catch(console.error);
