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
  console.log('  Le Vantage Cafe - Print Proxy v2.0');
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
