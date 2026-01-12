import cron from 'node-cron';
import { processRecurringExpensesDirect } from '../controllers/recurringExpenseController.js';

// Schedule to run daily at 9:00 AM
// You can change this to run at different times or more frequently
const RECURRING_EXPENSE_CRON = '0 9 * * *'; // Every day at 9:00 AM

// For testing, you can use: '*/5 * * * *' to run every 5 minutes

/**
 * Start the recurring expense scheduler
 */
export const startRecurringExpenseScheduler = () => {
  console.log('Starting recurring expense scheduler...');
  console.log(`Schedule: ${RECURRING_EXPENSE_CRON} (Daily at 9:00 AM)`);

  // Schedule the job
  cron.schedule(RECURRING_EXPENSE_CRON, async () => {
    console.log('Running recurring expense processor...');
    try {
      const result = await processRecurringExpensesDirect();
      console.log('Recurring expense processing completed successfully:', result);
    } catch (error) {
      console.error('Failed to process recurring expenses:', error);
    }
  });

  console.log('Recurring expense scheduler started');
};
