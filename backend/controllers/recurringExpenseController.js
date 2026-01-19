import RecurringExpense from '../models/RecurringExpense.js';
import Expense from '../models/Expense.js';

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

    if (!neverExpires && !endsOn) {
      return res.status(400).json({ message: 'Ends On is required when Never Expires is not checked' });
    }

    const startDate = new Date(startOn);
    const endDate = endsOn ? new Date(endsOn) : null;

    if (endDate && endDate <= startDate) {
      return res.status(400).json({ message: 'Ends On date must be after Start On date' });
    }

    // Calculate next process date
    // For "10 Seconds", use current time if startOn is today or in the past, otherwise use startOn
    // For others, use startOn
    const now = new Date();
    let nextProcessDate = new Date(startDate);
    if (repeatEvery === '10 Seconds') {
      const startDateOnly = new Date(startDate);
      startDateOnly.setHours(0, 0, 0, 0);
      const todayOnly = new Date(now);
      todayOnly.setHours(0, 0, 0, 0);
      
      // If startOn is today or in the past, start processing immediately
      if (startDateOnly <= todayOnly) {
        nextProcessDate = now;
      } else {
        // Future date - use the startOn date/time
        nextProcessDate = new Date(startDate);
      }
    }

    // Verify all expenses exist and belong to user in one query (much faster)
    const expenses = await Expense.find({
      _id: { $in: expenseIds },
      user: req.user._id,
    });

    const validExpenseIds = expenses.map(exp => exp._id);

    // Prepare recurring expense documents for bulk insert (much faster than individual creates)
    const recurringExpenseDocs = validExpenseIds.map(expenseId => ({
      baseExpense: expenseId,
      repeatEvery,
      startOn: startDate,
      endsOn: endDate,
      neverExpires,
      nextProcessDate,
      user: req.user._id,
    }));

    // Bulk insert all recurring expenses at once (much faster)
    const recurringExpenses = await RecurringExpense.insertMany(recurringExpenseDocs);

    res.status(201).json({
      message: `Recurring expense created for ${recurringExpenses.length} expense(s)`,
      recurringExpenses,
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
    const recurringExpenses = await RecurringExpense.find({ user: req.user._id })
      .populate({
        path: 'baseExpense',
        // Ensure all fields are populated, not just the ID
        select: '-__v'
      })
      .sort({ createdAt: -1 })
      .lean();

    // Filter out recurring expenses where base expense is deleted
    const validRecurringExpenses = recurringExpenses.filter(rec => {
      // If baseExpense is null or just an ID (not populated), it means the expense was deleted
      return rec.baseExpense !== null && 
             rec.baseExpense !== undefined && 
             typeof rec.baseExpense === 'object' && 
             rec.baseExpense._id; // Ensure it's a full object with _id, not just an ID string
    });

    res.json(validRecurringExpenses);
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

    // Check if base expense is deleted
    if (!recurringExpense.baseExpense) {
      return res.status(404).json({ message: 'Base expense for this recurring expense has been deleted' });
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

    if (repeatEvery) recurringExpense.repeatEvery = repeatEvery;
    if (startOn) {
      recurringExpense.startOn = new Date(startOn);
      // Update next process date if start date is in the future
      if (new Date(startOn) > new Date()) {
        recurringExpense.nextProcessDate = new Date(startOn);
      }
    }
    if (endsOn !== undefined) recurringExpense.endsOn = endsOn ? new Date(endsOn) : null;
    if (neverExpires !== undefined) recurringExpense.neverExpires = neverExpires;
    if (isActive !== undefined) recurringExpense.isActive = isActive;

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

    await recurringExpense.deleteOne();

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
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all active recurring expenses that need to be processed
    // For 10-second intervals, use current time; for others, use today's midnight
    const recurringExpenses = await RecurringExpense.find({
      isActive: true,
      $or: [
        { repeatEvery: '10 Seconds', nextProcessDate: { $lte: now } },
        { repeatEvery: { $ne: '10 Seconds' }, nextProcessDate: { $lte: today } }
      ]
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
          console.error(`Base expense not found for recurring expense ${recurringExpense._id}`);
          continue;
        }

        // Create a new expense based on the base expense with updated date
        const newExpenseData = {
          ...baseExpense.toObject(),
        };
        delete newExpenseData._id;
        delete newExpenseData.createdAt;
        delete newExpenseData.updatedAt;

        // Update expense date to now (for 10 seconds) or today (for others)
        const expenseDate = recurringExpense.repeatEvery === '10 Seconds' ? now : today;
        newExpenseData.date = expenseDate;
        
        // Set month and year based on expense date
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        newExpenseData.month = monthNames[expenseDate.getMonth()];
        newExpenseData.year = expenseDate.getFullYear();

        newExpenseData.user = recurringExpense.user._id;

        // Create new expense
        const newExpense = await Expense.create(newExpenseData);

        // Calculate next process date
        const nextProcessDate = new Date(recurringExpense.nextProcessDate);
        switch (recurringExpense.repeatEvery) {
          case '10 Seconds':
            nextProcessDate.setSeconds(nextProcessDate.getSeconds() + 10);
            break;
          case 'Week':
            nextProcessDate.setDate(nextProcessDate.getDate() + 7);
            break;
          case 'Month':
            nextProcessDate.setMonth(nextProcessDate.getMonth() + 1);
            break;
          case 'Quarter':
            nextProcessDate.setMonth(nextProcessDate.getMonth() + 3);
            break;
          case 'Half Yearly':
          case 'Six Month':
            nextProcessDate.setMonth(nextProcessDate.getMonth() + 6);
            break;
          case 'Year':
            nextProcessDate.setFullYear(nextProcessDate.getFullYear() + 1);
            break;
        }

        // Update recurring expense
        const processedDate = recurringExpense.repeatEvery === '10 Seconds' ? now : today;
        recurringExpense.lastProcessedDate = processedDate;
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
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all active recurring expenses that need to be processed
    // For 10-second intervals, use current time; for others, use today's midnight
    const recurringExpenses = await RecurringExpense.find({
      isActive: true,
      $or: [
        { repeatEvery: '10 Seconds', nextProcessDate: { $lte: now } },
        { repeatEvery: { $ne: '10 Seconds' }, nextProcessDate: { $lte: today } }
      ]
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
          console.error(`Base expense not found for recurring expense ${recurringExpense._id}`);
          continue;
        }

        // Create a new expense based on the base expense with updated date
        const newExpenseData = {
          ...baseExpense.toObject(),
        };
        delete newExpenseData._id;
        delete newExpenseData.createdAt;
        delete newExpenseData.updatedAt;

        // Update expense date to now (for 10 seconds) or today (for others)
        const expenseDate = recurringExpense.repeatEvery === '10 Seconds' ? now : today;
        newExpenseData.date = expenseDate;
        
        // Set month and year based on expense date
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        newExpenseData.month = monthNames[expenseDate.getMonth()];
        newExpenseData.year = expenseDate.getFullYear();

        newExpenseData.user = recurringExpense.user._id;

        // Create new expense
        const newExpense = await Expense.create(newExpenseData);

        // Calculate next process date
        const nextProcessDate = new Date(recurringExpense.nextProcessDate);
        switch (recurringExpense.repeatEvery) {
          case '10 Seconds':
            nextProcessDate.setSeconds(nextProcessDate.getSeconds() + 10);
            break;
          case 'Week':
            nextProcessDate.setDate(nextProcessDate.getDate() + 7);
            break;
          case 'Month':
            nextProcessDate.setMonth(nextProcessDate.getMonth() + 1);
            break;
          case 'Quarter':
            nextProcessDate.setMonth(nextProcessDate.getMonth() + 3);
            break;
          case 'Half Yearly':
          case 'Six Month':
            nextProcessDate.setMonth(nextProcessDate.getMonth() + 6);
            break;
          case 'Year':
            nextProcessDate.setFullYear(nextProcessDate.getFullYear() + 1);
            break;
        }

        // Update recurring expense
        const processedDate = recurringExpense.repeatEvery === '10 Seconds' ? now : today;
        recurringExpense.lastProcessedDate = processedDate;
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
