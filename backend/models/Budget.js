import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema(
  {
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    // Optional slicing dimensions (keep flexible; works even if you only use department)
    department: {
      type: String,
      default: 'Unassigned',
    },
    category: {
      type: String,
      default: 'All',
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    reason: {
      type: String,
      default: '',
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

budgetSchema.index({ user: 1, periodStart: 1, periodEnd: 1 });
budgetSchema.index({ user: 1, department: 1 });
budgetSchema.index({ user: 1, category: 1 });

export default mongoose.model('Budget', budgetSchema);

