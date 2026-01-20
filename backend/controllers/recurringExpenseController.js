import RecurringExpense from '../models/RecurringExpense.js';
import Expense from '../models/Expense.js';

const ALLOWED_REPEAT_EVERY = new Set(['Week', 'Month', 'Quarter', 'Half Yearly', 'Six Month', 'Year']);

const normalizeKeyPart = (value) => String(value ?? '').trim().toLowerCase();

const computeExpenseTotalAmount = (expense) => {
  const explicitTotal = Number(expense?.totalAmount);
  if (Number.isFinite(explicitTotal) && explicitTotal > 0) return explicitTotal;

  const amountExclTax = Number(expense?.amountExclTax) || 0;
  const gstAmount = Number(expense?.gstAmount) || 0;
  const tdsAmount = Number(expense?.tdsAmount) || 0;
  const derived = amountExclTax + gstAmount - tdsAmount;
  return derived > 0 ? derived : 0;
};

// Dedupe rule (business):
// One recurring schedule per "logical expense" per repeat cycle.
// This prevents duplicates even if user selects a different expense row with same details.
const buildRecurringDedupeKey = (expense, repeatEvery) => {
  const total = computeExpenseTotalAmount(expense);
  return [
    normalizeKeyPart(expense?.vendor),
    normalizeKeyPart(expense?.category),
    normalizeKeyPart(expense?.department),
    total.toFixed(2),
    normalizeKeyPart(repeatEvery),
  ].join('|');
};

const normalizeToStartOfDay = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addRecurringInterval = (baseDate, repeatEvery) => {
  const next = new Date(baseDate);
  switch (repeatEvery) {
    case 'Week':
      next.setDate(next.getDate() + 7);
      break;
    case 'Month':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'Quarter':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'Half Yearly':
    case 'Six Month':
      next.setMonth(next.getMonth() + 6);
      break;
    case 'Year':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      break;
  }
  next.setHours(0, 0, 0, 0);
  return next;
};

// @desc    Create recurring expense
// @route   POST /api/recurring-expenses
// @access  Private
export const createRecurringExpense = async (req, res) => {
  try {
    const { expenseIds, repeatEvery, startOn, endsOn, neverExpires } = req.body;

    if (!expenseIds || !Array.isArray(expenseIds) || expenseIds.length === 0) {
      return res.status(400).json({ message: 'At least one expense ID is required' });
    }

    if (!repeatEvery || !startOn) {
      return res.status(400).json({ message: 'Repeat Every and Start On are required' });
    }

    if (!ALLOWED_REPEAT_EVERY.has(repeatEvery)) {
      return res.status(400).json({ message: 'Invalid repeat frequency' });
    }

    if (!neverExpires && !endsOn) {
      return res.status(400).json({ message: 'Ends On is required when Never Expires is not checked' });
    }

    const startDate = new Date(startOn);
    const endDate = endsOn ? new Date(endsOn) : null;

    if (endDate && endDate <= startDate) {
      return res.status(400).json({ message: 'Ends On date must be after Start On date' });
    }

    // Important:
    // The base expense already exists (template source), so the first *generated* expense should be after one interval.
    // Example: StartOn 20/01 + Month => NextProcess 20/02
    const nextProcessDate = addRecurringInterval(normalizeToStartOfDay(startDate), repeatEvery);

    // Verify all expenses exist and belong to user in one query (much faster)
    const expenses = await Expense.find({
      _id: { $in: expenseIds },
      user: req.user._id,
    });

    const validExpenseIds = expenses.map(exp => exp._id);

    // Prevent duplicates (two layers):
    // 1) Same baseExpense should not get another recurring schedule.
    // 2) Same logical expense (vendor+category+department+total) should not get another recurring schedule for the same repeatEvery,
    //    even if it comes from a different expense row.
    const existingRecurring = await RecurringExpense.find({ user: req.user._id })
      .populate({
        path: 'baseExpense',
        select: 'vendor category department totalAmount amountExclTax gstAmount tdsAmount',
      })
      .select('baseExpense repeatEvery createdAt')
      .lean();

    const existingBaseExpenseIds = new Set(
      (existingRecurring || [])
        .map((re) => (re?.baseExpense && typeof re.baseExpense === 'object' ? re.baseExpense._id : re.baseExpense))
        .filter(Boolean)
        .map((id) => id.toString())
    );

    const existingKeys = new Set(
      (existingRecurring || [])
        .map((re) => {
          const base = re?.baseExpense;
          if (!base) return null;
          return buildRecurringDedupeKey(base, re.repeatEvery);
        })
        .filter(Boolean)
    );

    const newExpenseIds = [];
    const requestKeys = new Set();
    for (const exp of expenses) {
      const expId = exp?._id?.toString();
      if (!expId) continue;
      if (existingBaseExpenseIds.has(expId)) continue;

      const key = buildRecurringDedupeKey(exp, repeatEvery);
      if (existingKeys.has(key)) continue;
      if (requestKeys.has(key)) continue; // prevent duplicates within same request

      requestKeys.add(key);
      newExpenseIds.push(exp._id);
    }

    const skippedCount = validExpenseIds.length - newExpenseIds.length;

    if (newExpenseIds.length === 0) {
      // Even if schedules already existed, ensure the selected base expenses are tagged as recurring.
      // This fixes old data where `isRecurring` was not present/false.
      try {
        await Expense.updateMany(
          { _id: { $in: validExpenseIds }, user: req.user._id },
          { $set: { isRecurring: true } }
        );
      } catch (e) {
        console.warn('Failed to backfill base expenses as recurring (skipped-only):', e?.message || e);
      }
      return res.status(200).json({
        message: 'All selected expenses already have recurring schedules. No new recurring expenses were created.',
        createdCount: 0,
        skippedCount,
        recurringExpenses: existingRecurring,
      });
    }

    // Prepare recurring expense documents for bulk insert (only for new ones)
    const recurringExpenseDocs = newExpenseIds.map(expenseId => ({
      baseExpense: expenseId,
      repeatEvery,
      startOn: startDate,
      endsOn: endDate,
      neverExpires,
      nextProcessDate,
      user: req.user._id,
    }));

    // Bulk insert all recurring expenses at once (much faster)
    const newRecurringExpenses = await RecurringExpense.insertMany(recurringExpenseDocs);
    const allRecurringExpenses = [...existingRecurring, ...newRecurringExpenses];

    // Mark base expenses as recurring so they remain visible with "Recurring = Yes" in the Expenses list.
    // This does NOT change the expense amounts; it only tags the record.
    try {
      await Expense.updateMany(
        { _id: { $in: validExpenseIds }, user: req.user._id },
        { $set: { isRecurring: true } }
      );
    } catch (e) {
      console.warn('Failed to mark base expenses as recurring:', e?.message || e);
    }

    res.status(201).json({
      message: `Recurring expense created for ${newRecurringExpenses.length} expense(s). ${skippedCount} already had recurring schedules and were skipped.`,
      createdCount: newRecurringExpenses.length,
      skippedCount,
      recurringExpenses: allRecurringExpenses,
    });
  } catch (error) {
    console.error('Error creating recurring expense:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all recurring expenses
// @route   GET /api/recurring-expenses
// @access  Private
export const getRecurringExpenses = async (req, res) => {
  try {
    // Remove any legacy seconds-based schedules (not supported)
    await RecurringExpense.deleteMany({ user: req.user._id, repeatEvery: '10 Seconds' });

    const recurringExpenses = await RecurringExpense.find({ user: req.user._id })
      .populate({
        path: 'baseExpense',
        // Ensure all fields are populated, not just the ID
        select: '-__v'
      })
      .sort({ createdAt: -1 })
      .lean();

    // If an expense (baseExpense) is deleted, the recurring schedule becomes orphaned.
    // To keep data consistent, we delete orphan recurring schedules automatically.
    const orphanIds = recurringExpenses
      .filter((rec) => !(rec.baseExpense && typeof rec.baseExpense === 'object' && rec.baseExpense._id))
      .map((rec) => rec._id);

    if (orphanIds.length > 0) {
      await RecurringExpense.deleteMany({ user: req.user._id, _id: { $in: orphanIds } });
    }

    // Keep only valid recurring expenses where base expense exists
    let validRecurringExpenses = recurringExpenses.filter((rec) => {
      return rec.baseExpense && typeof rec.baseExpense === 'object' && rec.baseExpense._id;
    });

    // Backfill: ensure all base expenses referenced by schedules are tagged as recurring.
    // This keeps Expenses list "Recurring" column accurate for old data.
    try {
      const baseIds = validRecurringExpenses
        .map((r) => r?.baseExpense?._id)
        .filter(Boolean);
      if (baseIds.length > 0) {
        await Expense.updateMany(
          { _id: { $in: baseIds }, user: req.user._id },
          { $set: { isRecurring: true } }
        );
      }
    } catch (e) {
      console.warn('Failed to backfill base expenses as recurring (getRecurringExpenses):', e?.message || e);
    }

    // Automatically remove duplicates (keep the oldest one based on createdAt)
    const seenRecurring = new Map();
    const duplicateIds = [];
    
    validRecurringExpenses.forEach(rec => {
      const baseExpense = rec.baseExpense;
      if (!baseExpense) return;
      
      // Duplicate definition (align with createRecurringExpense):
      // One recurring schedule per logical expense + repeatEvery.
      const key = buildRecurringDedupeKey(baseExpense, rec.repeatEvery);
      
      if (seenRecurring.has(key)) {
        // Duplicate found - compare createdAt to keep the oldest
        const existing = seenRecurring.get(key);
        const existingDate = new Date(existing.createdAt);
        const currentDate = new Date(rec.createdAt);
        
        if (currentDate < existingDate) {
          // Current is older, mark existing as duplicate
          duplicateIds.push(existing._id);
          seenRecurring.set(key, rec);
        } else {
          // Existing is older, mark current as duplicate
          duplicateIds.push(rec._id);
        }
      } else {
        // First occurrence
        seenRecurring.set(key, rec);
      }
    });
    
    // Delete duplicates in bulk
    if (duplicateIds.length > 0) {
      try {
        await RecurringExpense.deleteMany({ _id: { $in: duplicateIds }, user: req.user._id });
        console.log(`Automatically deleted ${duplicateIds.length} duplicate recurring expense(s) for user ${req.user._id}`);
      } catch (error) {
        console.error('Error deleting duplicate recurring expenses:', error);
        // Continue even if deletion fails
      }
    }
    
    // Filter out duplicates from the response
    validRecurringExpenses = validRecurringExpenses.filter(rec => !duplicateIds.includes(rec._id));

    // IMPORTANT:
    // Recurring expenses are templates. Payment status belongs to actual generated expenses,
    // not the template used to generate them. To avoid "paid" leaking into recurring views
    // (and to keep behavior consistent), we sanitize payment-related fields on the baseExpense
    // in the API response.
    const sanitized = validRecurringExpenses.map((rec) => {
      const base = rec.baseExpense;
      if (base && typeof base === 'object') {
        base.paidAmount = 0;
        base.status = 'Unpaid';
        base.paidTransactionRef = '';
        base.paymentHistory = [];
      }
      return rec;
    });

    res.json(sanitized);
  } catch (error) {
    console.error('Error fetching recurring expenses:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single recurring expense
// @route   GET /api/recurring-expenses/:id
// @access  Private
export const getRecurringExpense = async (req, res) => {
  try {
    const recurringExpense = await RecurringExpense.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
      .populate('baseExpense')
      .lean();

    if (!recurringExpense) {
      return res.status(404).json({ message: 'Recurring expense not found' });
    }

    if (recurringExpense.repeatEvery === '10 Seconds') {
      await RecurringExpense.deleteOne({ _id: req.params.id, user: req.user._id });
      return res.status(404).json({ message: 'Recurring expense not found' });
    }

    // Check if base expense is deleted
    if (!recurringExpense.baseExpense) {
      // Auto-clean orphan recurring schedule
      await RecurringExpense.deleteOne({ _id: req.params.id, user: req.user._id });
      return res.status(404).json({ message: 'Base expense for this recurring expense has been deleted' });
    }

    // Sanitize payment-related fields (recurring is a template)
    if (recurringExpense.baseExpense && typeof recurringExpense.baseExpense === 'object') {
      recurringExpense.baseExpense.paidAmount = 0;
      recurringExpense.baseExpense.status = 'Unpaid';
      recurringExpense.baseExpense.paidTransactionRef = '';
      recurringExpense.baseExpense.paymentHistory = [];
    }

    res.json(recurringExpense);
  } catch (error) {
    console.error('Error fetching recurring expense:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update recurring expense
// @route   PUT /api/recurring-expenses/:id
// @access  Private
export const updateRecurringExpense = async (req, res) => {
  try {
    const { repeatEvery, startOn, endsOn, neverExpires, isActive } = req.body;

    const recurringExpense = await RecurringExpense.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!recurringExpense) {
      return res.status(404).json({ message: 'Recurring expense not found' });
    }

    // If a legacy seconds-based schedule exists, remove it (seconds frequency is not supported)
    if (recurringExpense.repeatEvery === '10 Seconds') {
      await RecurringExpense.deleteOne({ _id: recurringExpense._id, user: req.user._id });
      return res.status(404).json({ message: 'Recurring expense not found' });
    }

    if (repeatEvery) {
      if (!ALLOWED_REPEAT_EVERY.has(repeatEvery)) {
        return res.status(400).json({ message: 'Invalid repeat frequency' });
      }
      recurringExpense.repeatEvery = repeatEvery;
    }
    if (startOn) {
      recurringExpense.startOn = new Date(startOn);
    }
    if (endsOn !== undefined) recurringExpense.endsOn = endsOn ? new Date(endsOn) : null;
    if (neverExpires !== undefined) recurringExpense.neverExpires = neverExpires;
    if (isActive !== undefined) recurringExpense.isActive = isActive;

    // Recompute nextProcessDate so UI always shows "next run" date (startOn/lastProcessed + interval)
    const baseForNext = recurringExpense.lastProcessedDate || recurringExpense.startOn;
    recurringExpense.nextProcessDate = addRecurringInterval(
      normalizeToStartOfDay(baseForNext),
      recurringExpense.repeatEvery
    );

    await recurringExpense.save();

    res.json(recurringExpense);
  } catch (error) {
    console.error('Error updating recurring expense:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete recurring expense
// @route   DELETE /api/recurring-expenses/:id
// @access  Private
export const deleteRecurringExpense = async (req, res) => {
  try {
    const recurringExpense = await RecurringExpense.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!recurringExpense) {
      return res.status(404).json({ message: 'Recurring expense not found' });
    }

    const baseExpenseId = recurringExpense.baseExpense;

    await recurringExpense.deleteOne();

    // Sync base expense flag:
    // If this was the last recurring schedule for that base expense, mark it as non-recurring.
    try {
      if (baseExpenseId) {
        const anyRemaining = await RecurringExpense.exists({
          user: req.user._id,
          baseExpense: baseExpenseId,
        });
        if (!anyRemaining) {
          await Expense.updateOne(
            { _id: baseExpenseId, user: req.user._id },
            { $set: { isRecurring: false } }
          );
        }
      }
    } catch (e) {
      console.warn('Failed to sync base expense recurring flag on delete:', e?.message || e);
    }

    res.json({ message: 'Recurring expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting recurring expense:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Process recurring expenses (to be called by cron job or directly)
// @route   POST /api/recurring-expenses/process
// @access  Private (should be called by cron job with special token)
export const processRecurringExpenses = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all active recurring expenses that need to be processed
    const recurringExpenses = await RecurringExpense.find({
      isActive: true,
      repeatEvery: { $ne: '10 Seconds' },
      nextProcessDate: { $lte: today },
    }).populate('baseExpense').populate('user');

    const results = [];

    for (const recurringExpense of recurringExpenses) {
      try {
        // Check if we should still process (not expired)
        if (!recurringExpense.neverExpires) {
          if (recurringExpense.endsOn && new Date(recurringExpense.endsOn) < today) {
            // Expired, deactivate
            recurringExpense.isActive = false;
            await recurringExpense.save();
            continue;
          }
        }

        const baseExpense = recurringExpense.baseExpense;
        if (!baseExpense) {
          // Base expense deleted -> delete the recurring schedule to keep data matching
          await recurringExpense.deleteOne();
          continue;
        }

        // Create a new expense based on the base expense with updated date
        const newExpenseData = {
          ...baseExpense.toObject(),
        };
        delete newExpenseData._id;
        delete newExpenseData.createdAt;
        delete newExpenseData.updatedAt;

        // Recurring generates a fresh occurrence. Never carry payment state from the template.
        newExpenseData.paidAmount = 0;
        newExpenseData.status = 'Unpaid';
        newExpenseData.paidTransactionRef = '';
        newExpenseData.paymentHistory = [];
        newExpenseData.isRecurring = true;
        newExpenseData.dueAmount = Math.max(0, (newExpenseData.totalAmount || 0) - (newExpenseData.paidAmount || 0));

        // Use the scheduled run date (nextProcessDate) for the generated expense date
        const scheduledDate = normalizeToStartOfDay(recurringExpense.nextProcessDate);
        newExpenseData.date = scheduledDate;
        
        // Set month and year based on expense date
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        newExpenseData.month = monthNames[scheduledDate.getMonth()];
        newExpenseData.year = scheduledDate.getFullYear();

        newExpenseData.user = recurringExpense.user._id;

        // Check for duplicate before creating (same vendor, category, date, totalAmount, department)
        const expenseDateForCheck = new Date(newExpenseData.date);
        const startOfDay = new Date(expenseDateForCheck);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(expenseDateForCheck);
        endOfDay.setHours(23, 59, 59, 999);
        
        const duplicateCheck = await Expense.findOne({
          user: recurringExpense.user._id,
          vendor: newExpenseData.vendor || '',
          category: newExpenseData.category || '',
          department: newExpenseData.department || '',
          totalAmount: newExpenseData.totalAmount || 0,
          date: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        });

        // Only create if no duplicate exists
        let newExpense;
        if (!duplicateCheck) {
          newExpense = await Expense.create(newExpenseData);
        } else {
          // Duplicate found - skip creation and use existing
          newExpense = duplicateCheck;
          console.log(`Duplicate expense detected for recurring expense ${recurringExpense._id}, skipping creation`);
        }

        // Calculate next process date
        const nextProcessDate = addRecurringInterval(scheduledDate, recurringExpense.repeatEvery);

        // Update recurring expense
        recurringExpense.lastProcessedDate = scheduledDate;
        recurringExpense.nextProcessDate = nextProcessDate;

        // Check if expired
        if (!recurringExpense.neverExpires && recurringExpense.endsOn) {
          if (nextProcessDate > new Date(recurringExpense.endsOn)) {
            recurringExpense.isActive = false;
          }
        }

        await recurringExpense.save();

        results.push({
          recurringExpenseId: recurringExpense._id,
          newExpenseId: newExpense._id,
          success: true,
        });
      } catch (error) {
        console.error(`Error processing recurring expense ${recurringExpense._id}:`, error);
        results.push({
          recurringExpenseId: recurringExpense._id,
          success: false,
          error: error.message,
        });
      }
    }

    const response = {
      message: `Processed ${recurringExpenses.length} recurring expense(s)`,
      results,
    };

    // If called from API, send response
    if (res) {
      res.json(response);
    }

    return response;
  } catch (error) {
    console.error('Error processing recurring expenses:', error);
    if (res) {
      res.status(500).json({ message: error.message });
    }
    throw error;
  }
};

// @desc    Process recurring expenses directly (for cron job)
// This function can be called directly without HTTP request/response
export const processRecurringExpensesDirect = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all active recurring expenses that need to be processed
    const recurringExpenses = await RecurringExpense.find({
      isActive: true,
      repeatEvery: { $ne: '10 Seconds' },
      nextProcessDate: { $lte: today },
    }).populate('baseExpense').populate('user');

    const results = [];

    for (const recurringExpense of recurringExpenses) {
      try {
        // Check if we should still process (not expired)
        if (!recurringExpense.neverExpires) {
          if (recurringExpense.endsOn && new Date(recurringExpense.endsOn) < today) {
            // Expired, deactivate
            recurringExpense.isActive = false;
            await recurringExpense.save();
            continue;
          }
        }

        const baseExpense = recurringExpense.baseExpense;
        if (!baseExpense) {
          // Base expense deleted -> delete the recurring schedule to keep data matching
          await recurringExpense.deleteOne();
          continue;
        }

        // Create a new expense based on the base expense with updated date
        const newExpenseData = {
          ...baseExpense.toObject(),
        };
        delete newExpenseData._id;
        delete newExpenseData.createdAt;
        delete newExpenseData.updatedAt;

        // Recurring generates a fresh occurrence. Never carry payment state from the template.
        newExpenseData.paidAmount = 0;
        newExpenseData.status = 'Unpaid';
        newExpenseData.paidTransactionRef = '';
        newExpenseData.paymentHistory = [];
        newExpenseData.isRecurring = true;
        newExpenseData.dueAmount = Math.max(0, (newExpenseData.totalAmount || 0) - (newExpenseData.paidAmount || 0));

        // Use the scheduled run date (nextProcessDate) for the generated expense date
        const scheduledDate = normalizeToStartOfDay(recurringExpense.nextProcessDate);
        newExpenseData.date = scheduledDate;
        
        // Set month and year based on expense date
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        newExpenseData.month = monthNames[scheduledDate.getMonth()];
        newExpenseData.year = scheduledDate.getFullYear();

        newExpenseData.user = recurringExpense.user._id;

        // Check for duplicate before creating (same vendor, category, date, totalAmount, department)
        const expenseDateForCheck = new Date(newExpenseData.date);
        const startOfDay = new Date(expenseDateForCheck);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(expenseDateForCheck);
        endOfDay.setHours(23, 59, 59, 999);
        
        const duplicateCheck = await Expense.findOne({
          user: recurringExpense.user._id,
          vendor: newExpenseData.vendor || '',
          category: newExpenseData.category || '',
          department: newExpenseData.department || '',
          totalAmount: newExpenseData.totalAmount || 0,
          date: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        });

        // Only create if no duplicate exists
        let newExpense;
        if (!duplicateCheck) {
          newExpense = await Expense.create(newExpenseData);
        } else {
          // Duplicate found - skip creation and use existing
          newExpense = duplicateCheck;
          console.log(`Duplicate expense detected for recurring expense ${recurringExpense._id}, skipping creation`);
        }

        // Calculate next process date
        const nextProcessDate = addRecurringInterval(scheduledDate, recurringExpense.repeatEvery);

        // Update recurring expense
        recurringExpense.lastProcessedDate = scheduledDate;
        recurringExpense.nextProcessDate = nextProcessDate;

        // Check if expired
        if (!recurringExpense.neverExpires && recurringExpense.endsOn) {
          if (nextProcessDate > new Date(recurringExpense.endsOn)) {
            recurringExpense.isActive = false;
          }
        }

        await recurringExpense.save();

        results.push({
          recurringExpenseId: recurringExpense._id,
          newExpenseId: newExpense._id,
          success: true,
        });
      } catch (error) {
        console.error(`Error processing recurring expense ${recurringExpense._id}:`, error);
        results.push({
          recurringExpenseId: recurringExpense._id,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      message: `Processed ${recurringExpenses.length} recurring expense(s)`,
      results,
    };
  } catch (error) {
    console.error('Error processing recurring expenses:', error);
    throw error;
  }
};
