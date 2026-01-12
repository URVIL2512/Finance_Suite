import mongoose from 'mongoose';

const recurringInvoiceSchema = new mongoose.Schema(
  {
    baseInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    repeatEvery: {
      type: String,
      enum: ['Week', 'Month', 'Quarter', 'Half Yearly', 'Six Month', 'Year'],
      required: true,
    },
    startOn: {
      type: Date,
      required: true,
    },
    endsOn: {
      type: Date,
      default: null,
    },
    neverExpires: {
      type: Boolean,
      default: false,
    },
    nextSendDate: {
      type: Date,
      required: true,
    },
    lastSentDate: {
      type: Date,
      default: null,
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
recurringInvoiceSchema.index({ user: 1, isActive: 1 });
recurringInvoiceSchema.index({ nextSendDate: 1, isActive: 1 });

const RecurringInvoice = mongoose.model('RecurringInvoice', recurringInvoiceSchema);

export default RecurringInvoice;
