import mongoose from 'mongoose';

const expenseCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    costType: {
      type: String,
      enum: ['Fixed', 'Variable'],
      default: 'Variable',
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
  { timestamps: true }
);

expenseCategorySchema.index({ user: 1, name: 1 }, { unique: true });
expenseCategorySchema.index({ user: 1, isActive: 1 });

const ExpenseCategory = mongoose.model('ExpenseCategory', expenseCategorySchema);

export default ExpenseCategory;

