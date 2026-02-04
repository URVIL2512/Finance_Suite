import mongoose from 'mongoose';

const contactPersonSchema = new mongoose.Schema({
  salutation: {
    type: String,
    enum: ['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.'],
    default: '',
  },
  firstName: {
    type: String,
    default: '',
  },
  lastName: {
    type: String,
    default: '',
  },
  email: {
    type: String,
    default: '',
  },
  workPhone: {
    countryCode: { type: String, default: '+91' },
    number: { type: String, default: '' },
  },
  mobile: {
    countryCode: { type: String, default: '+91' },
    number: { type: String, default: '' },
  },
});

const addressSchema = new mongoose.Schema({
  attention: { type: String, default: '' },
  country: { type: String, default: '' },
  street1: { type: String, default: '' },
  street2: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  pinCode: { type: String, default: '' },
  phone: {
    countryCode: { type: String, default: '+91' },
    number: { type: String, default: '' },
  },
  faxNumber: { type: String, default: '' },
});

const customerSchema = new mongoose.Schema(
  {
    // Primary Contact
    salutation: {
      type: String,
      enum: ['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.', ''],
      default: '',
    },
    firstName: {
      type: String,
      default: '',
    },
    lastName: {
      type: String,
      default: '',
    },
    companyName: {
      type: String,
      default: '',
    },
    displayName: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
    },
    workPhone: {
      countryCode: { type: String, default: '+91' },
      number: { type: String, default: '' },
    },
    mobile: {
      countryCode: { type: String, default: '+91' },
      number: { type: String, default: '' },
    },
    customerLanguage: {
      type: String,
      default: 'English',
    },
    // Address
    billingAddress: {
      type: addressSchema,
      default: {},
    },
    shippingAddress: {
      type: addressSchema,
      default: {},
    },
    // Contact Persons
    contactPersons: {
      type: [contactPersonSchema],
      default: [],
    },
    // Other Details
    pan: {
      type: String,
      default: '',
    },
    placeOfSupply: {
      type: String,
      default: '',
    },
    gstNo: {
      type: String,
      default: '',
    },
    currency: {
      type: String,
      enum: ['INR', 'USD', 'CAD', 'AUD', 'EUR', 'GBP', 'CNY', 'BND'],
      default: 'INR',
    },
    accountsReceivable: {
      type: String,
      default: '',
    },
    openingBalance: {
      type: Number,
      default: 0,
    },
    paymentTerms: {
      type: String,
      default: 'Due on Receipt',
    },
    documents: {
      type: [String], // Array of file paths or URLs
      default: [],
    },
    // Legacy fields (for backward compatibility)
    clientName: {
      type: String,
      trim: true,
    },
    gstin: {
      type: String,
      default: '',
    },
    state: {
      type: String,
      default: '',
    },
    country: {
      type: String,
      enum: ['India', 'USA', 'Canada', 'Australia', ''],
      default: 'India',
    },
    hsnOrSac: {
      type: String,
      default: '',
    },
    gstPercentage: {
      type: Number,
      default: 0,
    },
    tdsPercentage: {
      type: Number,
      default: 0,
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
customerSchema.index({ email: 1 });
// Note: user field already has an index due to required: true
customerSchema.index({ clientName: 1 });
customerSchema.index({ isActive: 1 });

const Customer = mongoose.model('Customer', customerSchema);

export default Customer;

