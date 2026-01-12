import mongoose from 'mongoose';

const salespersonSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add salesperson name'],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    employeeId: {
      type: String,
      default: '',
    },
    department: {
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

// Index for faster queries
salespersonSchema.index({ name: 1 });
salespersonSchema.index({ user: 1 });
salespersonSchema.index({ email: 1 });

export default mongoose.model('Salesperson', salespersonSchema);
