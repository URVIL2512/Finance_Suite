import mongoose from 'mongoose';

const bankAccountSchema = new mongoose.Schema(
  {
    accountName: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true,
    },
    bankName: {
      type: String,
      required: [true, 'Bank name is required'],
      trim: true,
    },
    ifsc: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
    },
    accountNumber: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
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

// Compound unique index: accountName + user (account names are unique per user)
bankAccountSchema.index({ accountName: 1, user: 1 }, { unique: true });

export default mongoose.model('BankAccount', bankAccountSchema);
