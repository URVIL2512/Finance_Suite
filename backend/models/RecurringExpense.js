import mongoose from 'mongoose';

const recurringExpenseSchema = new mongoose.Schema(
  {
    baseExpense: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
      required: true,
    },
    repeatEvery: {
      type: String,
      enum: ['Week', 'Month', 'Quarter', 'Half Yearly', 'Six Month', 'Year'],
      required: true,
    },
    startOn: {
      type: Date,
      required: true,
    },
    endsOn: {
      type: Date,
      default: null,
    },
    neverExpires: {
      type: Boolean,
      default: false,
    },
    nextProcessDate: {
      type: Date,
      required: true,
    },
    lastProcessedDate: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    preventDuplicates: {
      type: Boolean,
      default: false,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
recurringExpenseSchema.index({ user: 1, isActive: 1 });
recurringExpenseSchema.index({ nextProcessDate: 1, isActive: 1 });
recurringExpenseSchema.index({ user: 1, baseExpense: 1 });

const RecurringExpense = mongoose.model('RecurringExpense', recurringExpenseSchema);

export default RecurringExpense;
