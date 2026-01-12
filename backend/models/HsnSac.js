import mongoose from 'mongoose';

const hsnSacSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Please add HSN/SAC code'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please add description'],
      trim: true,
    },
    gstRate: {
      type: Number,
      required: [true, 'Please add GST rate'],
      min: 0,
      max: 100,
    },
    type: {
      type: String,
      enum: ['HSN', 'SAC'],
      required: [true, 'Please specify type (HSN or SAC)'],
    },
    isCommon: {
      type: Boolean,
      default: false, // Common codes are preloaded, custom ones are user-added
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null for common codes, user._id for custom codes
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster searches
hsnSacSchema.index({ code: 1 });
hsnSacSchema.index({ description: 'text' });
hsnSacSchema.index({ user: 1 });

const HsnSac = mongoose.model('HsnSac', hsnSacSchema);

export default HsnSac;
