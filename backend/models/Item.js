import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Goods', 'Service'],
      required: [true, 'Please select item type'],
    },
    name: {
      type: String,
      required: [true, 'Please add item name'],
    },
    unit: {
      type: String,
      default: '',
    },
    sellable: {
      type: Boolean,
      default: true,
    },
    sellingPrice: {
      type: Number,
      default: 0,
    },
    salesAccount: {
      type: String,
      default: 'Sales',
    },
    salesDescription: {
      type: String,
      default: '',
    },
    purchasable: {
      type: Boolean,
      default: true,
    },
    costPrice: {
      type: Number,
      default: 0,
    },
    purchaseAccount: {
      type: String,
      default: 'Cost of Goods Sold',
    },
    purchaseDescription: {
      type: String,
      default: '',
    },
    preferredVendor: {
      type: String,
      default: '',
    },
    hsnSac: {
      type: String,
      default: '',
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

export default mongoose.model('Item', itemSchema);
