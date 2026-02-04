import { useState, useEffect } from 'react';
import { itemAPI } from '../services/api';
import MobileSelect from './MobileSelect';

const ItemForm = ({ item, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    type: 'Service', // 'Goods' or 'Service'
    name: '',
    unit: '',
    hsnSac: '',
    sellable: true,
    sellingPrice: '',
    salesAccount: 'Sales',
    salesDescription: '',
    purchasable: true,
    costPrice: '',
    purchaseAccount: 'Cost of Goods Sold',
    purchaseDescription: '',
    preferredVendor: '',
  });

  const units = ['Nos', 'Pcs', 'Kg', 'Ltr', 'Mtr', 'Hrs', 'Days'];
  const salesAccounts = ['Sales', 'Service Revenue', 'Product Sales', 'Other Income'];
  const purchaseAccounts = ['Cost of Goods Sold', 'Purchase', 'Expenses', 'Other Expenses'];

  useEffect(() => {
    if (item) {
      setFormData({
        type: item.type || 'Service',
        name: item.name || '',
        unit: item.unit || '',
        hsnSac: item.hsnSac || '',
        sellable: item.sellable !== undefined ? item.sellable : true,
        sellingPrice: item.sellingPrice || '',
        salesAccount: item.salesAccount || 'Sales',
        salesDescription: item.salesDescription || '',
        purchasable: item.purchasable !== undefined ? item.purchasable : true,
        costPrice: item.costPrice || '',
        purchaseAccount: item.purchaseAccount || 'Cost of Goods Sold',
        purchaseDescription: item.purchaseDescription || '',
        preferredVendor: item.preferredVendor || '',
      });
    }
  }, [item]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    const updatedFormData = {
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    };
    
    if (name === 'type' && value === 'Service') {
      updatedFormData.unit = '';
    }
    
    setFormData(updatedFormData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <h2 className="text-xl font-bold text-gray-900">
            {item ? 'Edit Item' : 'New Item'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-500 hover:text-red-600 transition-colors text-2xl font-bold leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            {/* General Item Details Section */}
            <div className="space-y-4 border-b border-gray-200 pb-5">
              <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">General Item Details</h3>
              
              {/* Type */}
              <div>
                <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block flex items-center gap-2">
                  Type
                  <span className="text-gray-400 cursor-help" title="Select whether this is a Goods or Service">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.829V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </span>
                </label>
                <div className="flex gap-6 mt-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="Goods"
                      checked={formData.type === 'Goods'}
                      onChange={handleChange}
                      className="mr-2 w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-700">Goods</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="Service"
                      checked={formData.type === 'Service'}
                      onChange={handleChange}
                      className="mr-2 w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-700">Service</span>
                  </label>
                </div>
              </div>

              {/* Name, Unit, and HSN/SAC Code - Responsive grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Name Field */}
                <div className={formData.type === 'Service' ? 'md:col-span-2' : ''}>
                  <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">
                    Name<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="input-field w-full text-sm py-2"
                    placeholder={formData.type === 'Goods' ? 'Enter item name' : 'Enter service name'}
                  />
                </div>

                {/* Unit Field (Only for Goods) */}
                {formData.type === 'Goods' && (
                  <div>
                    <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block flex items-center gap-2">
                      Unit
                      <span className="text-gray-400 cursor-help" title="Select or enter a unit of measurement">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.829V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </span>
                    </label>
                    <MobileSelect
                      name="unit"
                      value={formData.unit}
                      onChange={handleChange}
                      className="select-field w-full text-sm py-2"
                    >
                      <option value="">Select or type to add</option>
                      {units.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </MobileSelect>
                  </div>
                )}

                {/* HSN/SAC Code Field */}
                <div>
                  <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">
                    {formData.type === 'Service' ? 'SAC Code' : 'HSN Code'}
                    {formData.type === 'Goods' && (
                      <span className="text-gray-500 font-normal ml-1">/ SAC Code</span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="hsnSac"
                    value={formData.hsnSac}
                    onChange={handleChange}
                    className="input-field w-full text-sm py-2"
                    placeholder={formData.type === 'Service' ? 'Enter SAC code' : 'Enter HSN/SAC code'}
                  />
                </div>
              </div>
            </div>

            {/* Sales and Purchase Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sales Information */}
              <div className="space-y-4 border-r border-gray-200 pr-6">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Sales Information</h3>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="sellable"
                    checked={formData.sellable}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm font-medium text-gray-700">Sellable</label>
                </div>

                {formData.sellable && (
                  <div className="space-y-4">
                    <div>
                      <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">
                        Selling Price<span className="text-red-500">*</span>
                      </label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-xs font-medium">
                          INR
                        </span>
                        <input
                          type="number"
                          name="sellingPrice"
                          value={formData.sellingPrice}
                          onChange={handleChange}
                          required={formData.sellable}
                          step="0.01"
                          min="0"
                          className="input-field rounded-l-none flex-1 text-sm py-2"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">
                        Account<span className="text-red-500">*</span>
                      </label>
                      <MobileSelect
                        name="salesAccount"
                        value={formData.salesAccount}
                        onChange={handleChange}
                        required={formData.sellable}
                        className="select-field w-full text-sm py-2"
                      >
                        {salesAccounts.map((account) => (
                          <option key={account} value={account}>
                            {account}
                          </option>
                        ))}
                      </MobileSelect>
                    </div>

                    <div>
                      <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">Description</label>
                      <textarea
                        name="salesDescription"
                        value={formData.salesDescription}
                        onChange={handleChange}
                        rows="3"
                        className="input-field w-full text-sm py-2 resize-none"
                        placeholder="Enter description"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Purchase Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Purchase Information</h3>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="purchasable"
                    checked={formData.purchasable}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm font-medium text-gray-700">Purchasable</label>
                </div>

                {formData.purchasable && (
                  <div className="space-y-4">
                    <div>
                      <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">
                        Cost Price<span className="text-red-500">*</span>
                      </label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-xs font-medium">
                          INR
                        </span>
                        <input
                          type="number"
                          name="costPrice"
                          value={formData.costPrice}
                          onChange={handleChange}
                          required={formData.purchasable}
                          step="0.01"
                          min="0"
                          className="input-field rounded-l-none flex-1 text-sm py-2"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">
                        Account<span className="text-red-500">*</span>
                      </label>
                      <MobileSelect
                        name="purchaseAccount"
                        value={formData.purchaseAccount}
                        onChange={handleChange}
                        required={formData.purchasable}
                        className="select-field w-full text-sm py-2"
                      >
                        {purchaseAccounts.map((account) => (
                          <option key={account} value={account}>
                            {account}
                          </option>
                        ))}
                      </MobileSelect>
                    </div>

                    <div>
                      <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">Description</label>
                      <textarea
                        name="purchaseDescription"
                        value={formData.purchaseDescription}
                        onChange={handleChange}
                        rows="3"
                        className="input-field w-full text-sm py-2 resize-none"
                        placeholder="Enter description"
                      />
                    </div>

                    <div>
                      <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">Preferred Vendor</label>
                      <MobileSelect
                        name="preferredVendor"
                        value={formData.preferredVendor}
                        onChange={handleChange}
                        className="select-field w-full text-sm py-2"
                      >
                        <option value="">Select vendor</option>
                      </MobileSelect>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary px-6 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary px-6 py-2"
            >
              {item ? 'Update' : 'Create'} Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ItemForm;
