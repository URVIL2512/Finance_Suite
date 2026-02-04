import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      required: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    paymentReceivedOn: {
      type: Date,
    },
    paymentMode: {
      type: String,
      enum: ['Cash', 'Bank Transfer', 'Bank Remittance', 'Cheque', 'Credit Card', 'UPI', 'Zoho Payments'],
      default: 'Cash',
    },
    depositTo: {
      type: String,
      enum: ['Petty Cash', 'Bank Account', 'Cash Account', 'Other'],
      default: 'Petty Cash',
    },
    referenceNumber: {
      type: String,
      default: '',
    },
    amountReceived: {
      type: Number,
      required: true,
    },
    bankCharges: {
      type: Number,
      default: 0,
    },
    taxDeducted: {
      type: Boolean,
      default: false,
    },
    tdsType: {
      type: String,
      default: '',
    },
    amountWithheld: {
      type: Number,
      default: 0,
    },
    tdsTaxAccount: {
      type: String,
      enum: ['Advance Tax', 'TDS Payable', 'TDS Receivable'],
      default: 'Advance Tax',
    },
    notes: {
      type: String,
      default: '',
    },
    // Department-wise payment split feature
    hasDepartmentSplit: {
      type: Boolean,
      default: false,
    },
    departmentSplits: [{
      departmentName: {
        type: String,
        required: true,
        trim: true,
      },
      amount: {
        type: Number,
        required: true,
        min: [0.01, 'Split amount must be greater than 0'],
      }
    }],
    status: {
      type: String,
      enum: ['Draft', 'Paid'],
      default: 'Paid',
    },
    sendThankYouNote: {
      type: Boolean,
      default: false,
    },
    emailRecipients: {
      type: [String],
      default: [],
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

// Indexes
// Compound unique index: paymentNumber + user (payment numbers are unique per user)
paymentSchema.index({ paymentNumber: 1, user: 1 }, { unique: true });
paymentSchema.index({ invoice: 1 });
paymentSchema.index({ customer: 1 });
paymentSchema.index({ user: 1 });
paymentSchema.index({ paymentDate: -1 });

// Generate payment number before saving (only if not provided)
// Note: Payment numbers should be generated in the controller using the utility function
// This pre-save hook is kept as a fallback but should rarely be used
paymentSchema.pre('save', async function (next) {
  if (!this.paymentNumber) {
    try {
      const { generatePaymentNumber } = await import('../utils/paymentNumberGenerator.js');
      this.paymentNumber = await generatePaymentNumber(this.user);
    } catch (error) {
      // Fallback to simple generation if utility fails
      console.warn('Payment number generator utility failed, using fallback:', error);
      const year = new Date().getFullYear();
      const count = await mongoose.model('Payment').countDocuments({
        paymentNumber: new RegExp(`^PAY${year}`),
        user: this.user,
      });
      this.paymentNumber = `PAY${year}${String(count + 1).padStart(4, '0')}`;
    }
  }
  next();
});

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
