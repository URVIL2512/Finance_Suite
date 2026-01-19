import cron from 'node-cron';
import { processRecurringExpensesDirect } from '../controllers/recurringExpenseController.js';

// Schedule to run daily at 9:00 AM for regular recurring expenses
const RECURRING_EXPENSE_CRON_DAILY = '0 9 * * *'; // Every day at 9:00 AM

// Interval for 10-second recurring expenses (10 seconds = 10000 milliseconds)
const TEN_SECOND_INTERVAL = 10000;

/**
 * Start the recurring expense scheduler
 */
export const startRecurringExpenseScheduler = () => {
  console.log('Starting recurring expense scheduler...');
  console.log(`10-Second Interval: Every 10 seconds (using setInterval)`);
  console.log(`Daily Schedule: ${RECURRING_EXPENSE_CRON_DAILY} (Daily at 9:00 AM)`);

  // Use setInterval to check for ALL recurring expenses every 10 seconds
  // This processes "10 Seconds" intervals immediately, and checks others (Week, Month, Quarter, Half Yearly, Year)
  // Others will only be processed when their nextProcessDate is reached
  setInterval(async () => {
    try {
      const result = await processRecurringExpensesDirect();
      if (result.results && result.results.length > 0) {
        console.log(`Recurring expense processing completed (${result.results.length} processed):`, result);
      }
    } catch (error) {
      console.error('Failed to process recurring expenses:', error);
    }
  }, TEN_SECOND_INTERVAL);

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
