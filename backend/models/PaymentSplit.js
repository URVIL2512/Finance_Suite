import mongoose from 'mongoose';

const paymentSplitSchema = new mongoose.Schema(
  {
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    departmentName: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Split amount must be greater than 0'],
    },
    paymentDate: {
      type: Date,
      required: true,
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

// Indexes for efficient queries
paymentSplitSchema.index({ payment: 1 });
paymentSplitSchema.index({ invoice: 1 });
paymentSplitSchema.index({ departmentName: 1 });
paymentSplitSchema.index({ user: 1 });
paymentSplitSchema.index({ paymentDate: -1 });

// Compound index for department-wise revenue reporting
paymentSplitSchema.index({ user: 1, departmentName: 1, paymentDate: -1 });

const PaymentSplit = mongoose.model('PaymentSplit', paymentSplitSchema);

export default PaymentSplit;