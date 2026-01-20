import mongoose from 'mongoose';

const paymentModeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Payment mode name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
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

// Compound unique index: name + user (names are unique per user)
paymentModeSchema.index({ name: 1, user: 1 }, { unique: true });

export default mongoose.model('PaymentMode', paymentModeSchema);
