import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Please add a date'],
    },
    category: {
      type: String,
      enum: [
        'Salaries',
        'Office Rent',
        'Internet',
        'Electricity',
        'Software Tools',
        'HR/Admin',
        'Travel',
        'Food',
        'Marketing',
        'Compliance',
        'Misc',
        'Chai n Snacks',
        'Loan Interest',
        'Purchase',
      ],
      required: [true, 'Please select a category'],
    },
    paymentMode: {
      type: String,
      enum: [
        'Office Cash',
        'Bank Transfer',
        'Mihir Personal',
        'Komal Personal HDFC',
        'Komal Personal Cash',
        'HR Personal',
        'Other',
      ],
      required: [true, 'Please select a payment mode'],
    },
    operationType: {
      type: String,
      enum: [
        'OPERATION',
        'SOCIAL MEDIA',
        'WEBSITE',
        'BUSINESS DEVELOPMENT',
        'TELE CALLING',
      ],
      required: [true, 'Please select an operation type'],
    },
    bankAccount: {
      type: String,
      default: '',
    },
    vendor: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    amountExclTax: {
      type: Number,
      required: [true, 'Please add an amount'],
      default: 0,
    },
    gstPercentage: {
      type: Number,
      default: 0,
    },
    gstAmount: {
      type: Number,
      default: 0,
    },
    tdsPercentage: {
      type: Number,
      default: 0,
    },
    tdsAmount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: [true, 'Please add total amount'],
      default: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    paidTransactionRef: {
      type: String,
      default: '',
    },
    month: {
      type: String,
      required: true,
      enum: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    },
    year: {
      type: Number,
      required: [true, 'Please add a year'],
    },
    notes: {
      type: String,
      default: '',
    },
    invoiceUrl: {
      type: String,
      default: '',
    },
    executive: {
      type: String,
      default: '',
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
expenseSchema.index({ year: 1, month: 1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ user: 1 });

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;

