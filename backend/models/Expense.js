import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Please add a date'],
    },
    category: {
      type: String,
      required: [true, 'Please select a category'],
    },
    paymentMode: {
      type: String,
      required: [true, 'Please select a payment mode'],
    },
    department: {
      type: String,
      required: [true, 'Please select a department'],
    },
    bankAccount: {
      type: String,
      default: '',
    },
    vendor: {
      type: String,
      default: '',
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null,
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
    dueAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Unpaid', 'Paid', 'Partial', 'Cancel'],
      default: 'Unpaid',
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ['Fixed', 'Variable'],
      default: 'Variable',
    },
    paidTransactionRef: {
      type: String,
      default: '',
    },
    paymentHistory: [
      {
        paymentDate: {
          type: Date,
          default: Date.now,
        },
        amountPaid: {
          type: Number,
          required: true,
        },
        cumulativePaid: {
          type: Number,
          required: true,
        },
        status: {
          type: String,
          enum: ['Unpaid', 'Paid', 'Partial'],
          required: true,
        },
        transactionRef: {
          type: String,
          default: '',
        },
        notes: {
          type: String,
          default: '',
        },
        updatedBy: {
          type: String,
          default: '',
        },
      },
    ],
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
    expensePdfUrl: {
      type: String,
      default: '',
    },
    executive: {
      type: String,
      default: '',
    },
    userName: {
      type: String,
      default: '',
    },
    userEmail: {
      type: String,
      default: '',
    },
    userPhone: {
      type: String,
      default: '',
    },
    createdBy: {
      type: String,
      default: '',
    },
    editedBy: {
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

