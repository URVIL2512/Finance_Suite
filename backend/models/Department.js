import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Department name is required'],
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
  { timestamps: true }
);

// Unique per user
departmentSchema.index({ user: 1, name: 1 }, { unique: true });
departmentSchema.index({ user: 1, isActive: 1 });

const Department = mongoose.model('Department', departmentSchema);

export default Department;

