import mongoose from 'mongoose';

const revenueSchema = new mongoose.Schema(
  {
    clientName: {
      type: String,
      required: [true, 'Please add a client name'],
    },
    country: {
      type: String,
      enum: ['India', 'USA', 'Canada', 'Australia'],
      required: [true, 'Please select a country'],
    },
    service: {
      type: String,
      enum: [
        'Website Design',
        'B2B Sales Consulting',
        'Outbound Lead Generation',
        'Social Media Marketing',
        'SEO',
        'TeleCalling',
        'Other Services',
      ],
      required: [true, 'Please select a service'],
    },
    engagementType: {
      type: String,
      enum: ['One Time', 'Recurring'],
      required: [true, 'Please select engagement type'],
    },
    invoiceNumber: {
      type: String,
      default: '',
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
    },
    invoiceAmount: {
      type: Number,
      required: [true, 'Please add invoice amount'],
      default: 0,
    },
    gstPercentage: {
      type: Number,
      default: 0,
    },
    gstAmount: {
      type: Number,
      default: 0,
    },
    tdsPercentage: {
      type: Number,
      default: 0,
    },
    tdsAmount: {
      type: Number,
      default: 0,
    },
    remittanceCharges: {
      type: Number,
      default: 0,
    },
    receivedAmount: {
      type: Number,
      default: 0,
    },
    dueAmount: {
      type: Number,
      default: 0,
    },
    month: {
      type: String,
      required: true,
      enum: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    },
    year: {
      type: Number,
      required: [true, 'Please add a year'],
    },
    invoiceUrl: {
      type: String,
      default: '',
    },
    bankAccount: {
      type: String,
      default: '',
    },
    invoiceGenerated: {
      type: Boolean,
      default: false,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    // Department-wise revenue tracking fields
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    departmentName: {
      type: String,
      default: '',
    },
    isDepartmentSplit: {
      type: Boolean,
      default: false,
    },
    splitRatio: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
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
revenueSchema.index({ year: 1, month: 1 });
revenueSchema.index({ country: 1 });
revenueSchema.index({ service: 1 });
revenueSchema.index({ user: 1 });
revenueSchema.index({ departmentId: 1 });
revenueSchema.index({ isDepartmentSplit: 1 });
revenueSchema.index({ user: 1, departmentId: 1, year: 1, month: 1 }); // Compound index for department-wise reporting

// Calculate due amount before saving
// Total = base amount + GST - TDS - Remittance
// Due Amount = Total - Received Amount
revenueSchema.pre('save', function (next) {
  const baseAmount = this.invoiceAmount || 0;
  const gstAmount = this.gstAmount || 0;
  const tdsAmount = this.tdsAmount || 0;
  const remittanceCharges = this.remittanceCharges || 0;
  const total = baseAmount + gstAmount - tdsAmount - remittanceCharges;
  this.dueAmount = total - (this.receivedAmount || 0);
  next();
});

const Revenue = mongoose.model('Revenue', revenueSchema);

export default Revenue;

