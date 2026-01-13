import { useState, useEffect } from 'react';
import { itemAPI } from '../services/api';
import { getSacCodeForService, SERVICE_SAC_CODES } from '../utils/serviceSacCodes';

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

  const [services, setServices] = useState([]);
  const [serviceSacMap, setServiceSacMap] = useState({}); // Map of service names to SAC codes from database
  const [newServiceName, setNewServiceName] = useState('');
  const [showAddService, setShowAddService] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const units = ['Nos', 'Pcs', 'Kg', 'Ltr', 'Mtr', 'Hrs', 'Days'];
  const salesAccounts = ['Sales', 'Service Revenue', 'Product Sales', 'Other Income'];
  const purchaseAccounts = ['Cost of Goods Sold', 'Purchase', 'Expenses', 'Other Expenses'];

  // Fetch services from database
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await itemAPI.getAll();
        const serviceItems = response.data.filter(item => item.type === 'Service');
        const dbServiceNames = serviceItems.map(item => item.name);
        
        // Create a map of service names to their SAC codes from database
        const sacMap = {};
        serviceItems.forEach(item => {
          if (item.hsnSac) {
            sacMap[item.name] = item.hsnSac;
          }
        });
        
        // Get default service names from SERVICE_SAC_CODES
        const defaultServiceNames = Object.keys(SERVICE_SAC_CODES);
        
        // Merge database services with default services (database takes precedence, no duplicates)
        const allServiceNames = [...new Set([...dbServiceNames, ...defaultServiceNames])];
        
        // Merge SAC code maps (database values take precedence over defaults)
        const defaultSacMap = { ...SERVICE_SAC_CODES };
        const mergedSacMap = { ...defaultSacMap, ...sacMap };
        
        setServices(allServiceNames);
        setServiceSacMap(mergedSacMap);
      } catch (error) {
        console.error('Error fetching services:', error);
        // Fallback to default services if API fails
        const defaultServiceNames = Object.keys(SERVICE_SAC_CODES);
        setServices(defaultServiceNames);
        setServiceSacMap({ ...SERVICE_SAC_CODES });
      }
    };

    fetchServices();
  }, []);

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
    
    if (name === 'type') {
      if (value === 'Service') {
        updatedFormData.unit = '';
        // Auto-populate SAC code if service name is already selected
        if (updatedFormData.name) {
          // First check database (serviceSacMap), then fallback to static mapping
          const sacCode = serviceSacMap[updatedFormData.name] || getSacCodeForService(updatedFormData.name);
          if (sacCode) {
            updatedFormData.hsnSac = sacCode;
          }
        }
      } else if (value === 'Goods') {
        // Keep hsnSac when switching to Goods (HSN Code is used for Goods)
      }
    }
    
    // Auto-populate SAC code when service name is selected
    if (name === 'name' && updatedFormData.type === 'Service' && value) {
      // First check database (serviceSacMap), then fallback to static mapping
      const sacCode = serviceSacMap[value] || getSacCodeForService(value);
      if (sacCode) {
        updatedFormData.hsnSac = sacCode;
      }
    }
    
    setFormData(updatedFormData);
  };

  const handleAddService = (e) => {
    e.preventDefault();
    if (newServiceName.trim() && !services.includes(newServiceName.trim())) {
      const trimmedName = newServiceName.trim();
      setServices([...services, trimmedName]);
      // Auto-populate SAC code if available from static mapping (database items already have SAC codes)
      const sacCode = getSacCodeForService(trimmedName);
      setFormData(prev => ({
        ...prev,
        name: trimmedName,
        hsnSac: sacCode || prev.hsnSac,
      }));
      setNewServiceName('');
      setShowAddService(false);
      setIsDropdownOpen(false);
    }
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
                  {formData.type === 'Service' ? (
                    <div className="relative">
                      <div
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="select-field w-full text-sm py-2 px-3 cursor-pointer flex items-center justify-between bg-white border border-gray-300 rounded-md"
                      >
                        <span className={formData.name ? 'text-gray-900' : 'text-gray-400'}>
                          {formData.name || 'Select a service'}
                        </span>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'transform rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      {isDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-[1]"
                            onClick={() => setIsDropdownOpen(false)}
                          ></div>
                          <div className="absolute z-[2] w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            <div
                              className="px-3 py-2 text-sm text-gray-400 cursor-default border-b border-gray-200"
                            >
                              Select a service
                            </div>
                            {services.map((service) => (
                              <div
                                key={service}
                                onClick={() => {
                                  handleChange({ target: { name: 'name', value: service } });
                                  setIsDropdownOpen(false);
                                }}
                                className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                                  formData.name === service ? 'bg-blue-50 text-blue-600' : 'text-gray-900'
                                }`}
                              >
                                {service}
                              </div>
                            ))}
                            <div className="border-t border-gray-200">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsDropdownOpen(false);
                                  setShowAddService(true);
                                }}
                                className="w-full px-3 py-2 text-sm text-blue-600 font-medium hover:bg-blue-50 text-left flex items-center gap-2"
                              >
                                <span className="text-lg">+</span>
                                <span>Add New Service</span>
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="input-field w-full text-sm py-2"
                      placeholder="Enter item name"
                    />
                  )}
                  {formData.type === 'Service' && showAddService && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={newServiceName}
                        onChange={(e) => setNewServiceName(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleAddService(e);
                          }
                        }}
                        className="input-field flex-1 text-sm py-2"
                        placeholder="Enter new service name"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddService}
                        className="px-3 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddService(false);
                          setNewServiceName('');
                        }}
                        className="px-3 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-400 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
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
                    <select
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
                    </select>
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
                      <select
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
                      </select>
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
                      <select
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
                      </select>
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
                      <select
                        name="preferredVendor"
                        value={formData.preferredVendor}
                        onChange={handleChange}
                        className="select-field w-full text-sm py-2"
                      >
                        <option value="">Select vendor</option>
                      </select>
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
