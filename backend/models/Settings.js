import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    declaration: {
      type: String,
      default: '',
    },
    termsAndConditions: {
      type: [String],
      default: [
        'Raise disputes within 7 days of the invoice date. Late disputes will not be considered.',
        'Payments are non-refundable unless stated in the agreement.',
        'Invoice covers agreed services only. Additional services will be invoiced separately.',
        'This invoice is governed by the laws of Ahmedabad juridistrict.',
        'For queries, contact mihir@kology.in'
      ],
    },
    bankDetails: {
      companyName: {
        type: String,
        default: 'Kology Ventures Private Limited',
      },
      bankName: {
        type: String,
        default: '',
      },
      accountNumber: {
        type: String,
        default: '',
      },
      ifscCode: {
        type: String,
        default: '',
      },
      swiftCode: {
        type: String,
        default: '',
      },
      branch: {
        type: String,
        default: '',
      },
    },
    gstRates: {
      type: [
        {
          label: {
            type: String,
            required: true,
          },
          value: {
            type: Number,
            required: true,
          },
        },
      ],
      default: [
        { label: '18%', value: 18 },
        { label: '12%', value: 12 },
        { label: '5%', value: 5 },
        { label: '0%', value: 0 },
      ],
    },
    tdsRates: {
      type: [
        {
          label: {
            type: String,
            required: true,
          },
          value: {
            type: Number,
            required: true,
          },
        },
      ],
      default: [
        { label: '10%', value: 10 },
        { label: '5%', value: 5 },
        { label: '2%', value: 2 },
        { label: '1%', value: 1 },
        { label: '0%', value: 0 },
      ],
    },
    tcsRates: {
      type: [
        {
          label: {
            type: String,
            required: true,
          },
          value: {
            type: Number,
            required: true,
          },
        },
      ],
      default: [
        { label: '1%', value: 1 },
        { label: '0.5%', value: 0.5 },
        { label: '0.1%', value: 0.1 },
        { label: '0%', value: 0 },
      ],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
settingsSchema.index({ user: 1 });

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;
