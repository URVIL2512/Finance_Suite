import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Item name is required'],
    default: 'Default Item',
    validate: {
      validator: function(v) {
        return v && typeof v === 'string' && v.trim().length > 0;
      },
      message: 'Item name cannot be empty'
    }
  },
  description: {
    type: String,
    default: '',
  },
  hsnSac: {
    type: String,
    default: '',
  },
  quantity: {
    type: Number,
    default: 1,
  },
  rate: {
    type: Number,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
});

const clientDetailsSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    default: '',
  },
  country: {
    type: String,
    enum: ['India', 'USA', 'Canada', 'Australia'],
    required: true,
  },
  gstin: {
    type: String,
    default: '',
  },
  state: {
    type: String,
    default: '',
  },
  city: {
    type: String,
    default: '',
  },
  pincode: {
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
  pan: {
    type: String,
    default: '',
  },
});

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: [true, 'Please add invoice number'],
    },
    invoiceDate: {
      type: Date,
      required: [true, 'Please add invoice date'],
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: [true, 'Please add due date'],
    },
    clientDetails: {
      type: clientDetailsSchema,
      required: true,
    },
    items: {
      type: [invoiceItemSchema],
      required: true,
    },
    subTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    gstType: {
      type: String,
      enum: ['CGST_SGST', 'IGST'],
      required: true,
    },
    gstPercentage: {
      type: Number,
      default: 0,
    },
    cgst: {
      type: Number,
      default: 0,
    },
    sgst: {
      type: Number,
      default: 0,
    },
    igst: {
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
    tcsPercentage: {
      type: Number,
      default: 0,
    },
    tcsAmount: {
      type: Number,
      default: 0,
    },
    remittanceCharges: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      enum: ['INR', 'USD', 'CAD', 'AUD'],
      default: 'INR',
    },
    exchangeRate: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ['Paid', 'Unpaid', 'Partial', 'Cancel', 'Void'],
      default: 'Unpaid',
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    // ===== Reporting-standard fields (optional, kept in INR) =====
    // These fields help keep reporting consistent without needing deep nested parsing everywhere.
    // Existing invoices may not have them; reports also compute safely from legacy fields.
    totalAmount: {
      type: Number,
      default: 0,
    },
    gstAmount: {
      type: Number,
      default: 0,
    },
    dueAmount: {
      type: Number,
      default: 0,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    // True when this invoice has an active recurring schedule (RecurringInvoice).
    // Kept separate from `isRecurring` so reports can still use `isRecurring` as "recurring revenue"
    // while UI can show whether a schedule exists.
    hasRecurringSchedule: {
      type: Boolean,
      default: false,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    department: {
      type: String,
      default: 'Unassigned',
    },
    service: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    invoiceUrl: {
      type: String,
      default: '',
    },
    lutArn: {
      type: String,
      default: '',
    },
    revenueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Revenue',
      default: null,
    },
    serviceDetails: {
      description: {
        type: String,
        required: true,
      },
      serviceType: {
        type: String,
        required: true,
      },
      engagementType: {
        type: String,
        enum: ['One Time', 'Recurring'],
        required: true,
      },
      period: {
        month: {
          type: String,
          required: true,
        },
        year: {
          type: Number,
          required: true,
        },
      },
    },
    amountDetails: {
      baseAmount: {
        type: Number,
        required: true,
      },
      invoiceTotal: {
        type: Number,
        required: true,
      },
      receivableAmount: {
        type: Number,
        required: true,
      },
    },
    currencyDetails: {
      invoiceCurrency: {
        type: String,
        enum: ['INR', 'USD', 'CAD', 'AUD'],
        default: 'INR',
      },
      exchangeRate: {
        type: Number,
        default: 1,
      },
      inrEquivalent: {
        type: Number,
        default: 0,
      },
    },
    receivedAmount: {
      type: Number,
      default: 0,
    },
    clientEmail: {
      type: String,
      default: '',
    },
    clientMobile: {
      type: String,
      default: '',
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailSentAt: {
      type: Date,
      default: null,
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
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ invoiceDate: 1 });
// Note: user field already has an index due to required: true

// Pre-validate hook to filter out only truly empty items (runs before validation)
invoiceSchema.pre('validate', function(next) {
  if (this.items && Array.isArray(this.items)) {
    // FILTER OUT only truly empty items instead of items without names
    const originalCount = this.items.length;
    this.items = this.items.filter(item => {
      const hasValidName = item.name && item.name.trim() !== '';
      const hasDescription = item.description && item.description.trim() !== '';
      const hasAmount = item.amount && item.amount > 0;
      const hasRate = item.rate && item.rate > 0;
      
      // Keep item if it has any meaningful data
      return hasValidName || hasDescription || hasAmount || hasRate;
    });
    
    if (originalCount !== this.items.length) {
      console.log(`🔧 Invoice Model: Filtered items ${originalCount} → ${this.items.length}`);
    }
  }
  next();
});

// Pre-save hook to ensure only valid items are saved (backup)
invoiceSchema.pre('save', function(next) {
  if (this.items && Array.isArray(this.items)) {
    // FILTER OUT only truly empty items instead of items without names
    const originalCount = this.items.length;
    this.items = this.items.filter(item => {
      const hasValidName = item.name && item.name.trim() !== '';
      const hasDescription = item.description && item.description.trim() !== '';
      const hasAmount = item.amount && item.amount > 0;
      const hasRate = item.rate && item.rate > 0;
      
      // Keep item if it has any meaningful data
      return hasValidName || hasDescription || hasAmount || hasRate;
    });
    
    if (originalCount !== this.items.length) {
      console.log(`🔧 Invoice Model: Filtered items ${originalCount} → ${this.items.length}`);
    }
  }
  next();
});

const Invoice = mongoose.model('Invoice', invoiceSchema);

export default Invoice;

