import cron from 'node-cron';
import { processRecurringExpensesDirect } from '../controllers/recurringExpenseController.js';
import RecurringExpense from '../models/RecurringExpense.js';

// Schedule to run daily at 9:00 AM for regular recurring expenses
const RECURRING_EXPENSE_CRON_DAILY = '0 9 * * *'; // Every day at 9:00 AM

/**
 * Start the recurring expense scheduler
 */
export const startRecurringExpenseScheduler = () => {
  console.log('Starting recurring expense scheduler...');
  console.log(`Daily Schedule: ${RECURRING_EXPENSE_CRON_DAILY} (Daily at 9:00 AM)`);

  // Hard cleanup: remove any legacy "10 Seconds" recurring templates.
  // This frequency is intentionally not supported (it can rapidly inflate the Expenses table).
  (async () => {
    try {
      const result = await RecurringExpense.deleteMany({ repeatEvery: '10 Seconds' });
      if (result?.deletedCount) {
        console.log(`Deleted ${result.deletedCount} legacy recurring expense(s) with "10 Seconds" frequency`);
      }
    } catch (error) {
      console.error('Failed to cleanup legacy "10 Seconds" recurring expenses:', error);
    }
  })();

  // Schedule daily at 9 AM as a backup to ensure all recurring expenses (Week, Month, Quarter, Half Yearly, Year) are processed
  // This ensures even if the server restarts, recurring expenses are still processed daily
  cron.schedule(RECURRING_EXPENSE_CRON_DAILY, async () => {
    console.log('Running daily recurring expense processor (backup check for Week/Month/Quarter/Half Yearly/Year)...');
    try {
      const result = await processRecurringExpensesDirect();
      if (result.results && result.results.length > 0) {
        console.log(`Daily recurring expense processing completed (${result.results.length} processed):`, result);
      }
    } catch (error) {
      console.error('Failed to process recurring expenses:', error);
    }
  });

  console.log('Recurring expense scheduler started');
};
