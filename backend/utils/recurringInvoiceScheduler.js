import cron from 'node-cron';
import { processRecurringInvoicesDirect } from '../controllers/recurringInvoiceController.js';

// Schedule to run daily at 9:00 AM
// You can change this to run at different times or more frequently
const RECURRING_INVOICE_CRON = '0 9 * * *'; // Every day at 9:00 AM

// For testing, you can use: '*/5 * * * *' to run every 5 minutes

/**
 * Start the recurring invoice scheduler
 */
export const startRecurringInvoiceScheduler = () => {
  console.log('Starting recurring invoice scheduler...');
  console.log(`Schedule: ${RECURRING_INVOICE_CRON} (Daily at 9:00 AM)`);

  // Schedule the job
  cron.schedule(RECURRING_INVOICE_CRON, async () => {
    console.log('Running recurring invoice processor...');
    try {
      const result = await processRecurringInvoicesDirect();
      console.log('Recurring invoice processing completed successfully:', result);
    } catch (error) {
      console.error('Failed to process recurring invoices:', error);
    }
  });

  console.log('Recurring invoice scheduler started');
};

// For manual testing (uncomment to test immediately)
// processRecurringInvoicesDirect().then((result) => {
//   console.log('Manual processing completed:', result);
//   process.exit(0);
// }).catch((error) => {
//   console.error('Manual processing failed:', error);
//   process.exit(1);
// });
