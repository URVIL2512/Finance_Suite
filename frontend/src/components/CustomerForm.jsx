import { useState, useEffect } from 'react';
import { customerAPI } from '../services/api';

const CustomerForm = ({ customer, onSubmit, onCancel }) => {
  const [activeTab, setActiveTab] = useState('details'); // 'details', 'address', 'otherInfo'
  const [isDisplayNameManuallyEdited, setIsDisplayNameManuallyEdited] = useState(false);
  const [formData, setFormData] = useState({
    // Primary Contact
    salutation: '',
    firstName: '',
    lastName: '',
    companyName: '',
    displayName: '',
    email: '',
    workPhone: { countryCode: '+91', number: '' },
    mobile: { countryCode: '+91', number: '' },
    customerLanguage: 'English',
    // Address
    billingAddress: {
      attention: '',
      country: '',
      street1: '',
      street2: '',
      city: '',
      state: '',
      pinCode: '',
      phone: { countryCode: '+91', number: '' },
      faxNumber: '',
    },
    // Other Details
    pan: '',
    placeOfSupply: '',
    gstNo: '',
    currency: 'INR',
    paymentTerms: 'Due on Receipt',
    documents: [],
  });


  const salutations = ['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.'];
  const languages = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Arabic', 'Chinese', 'Japanese'];
  const currencies = [
    { code: 'INR', name: 'Indian Rupee' },
    { code: 'USD', name: 'US Dollar' },
    { code: 'CAD', name: 'Canadian Dollar' },
    { code: 'AUD', name: 'Australian Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'Pound Sterling' },
    { code: 'CNY', name: 'Yuan Renminbi' },
    { code: 'BND', name: 'Brunei Dollar' },
  ];
  const paymentTermsOptions = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];
  const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
  ];
  const countryCodes = [
    { code: '+91', country: 'India' },
    { code: '+1', country: 'USA/Canada' },
    { code: '+61', country: 'Australia' },
    { code: '+44', country: 'UK' },
    { code: '+86', country: 'China' },
    { code: '+81', country: 'Japan' },
    { code: '+971', country: 'UAE' },
  ];

  useEffect(() => {
    if (customer) {
      setFormData({
        salutation: customer.salutation || '',
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        companyName: customer.companyName || '',
        displayName: customer.displayName || customer.clientName || '',
        email: customer.email || '',
        workPhone: customer.workPhone || { countryCode: '+91', number: '' },
        mobile: customer.mobile || { countryCode: '+91', number: customer.mobile || '' },
        customerLanguage: customer.customerLanguage || 'English',
        billingAddress: customer.billingAddress || {
          attention: '',
          country: customer.country || '',
          street1: '',
          street2: '',
          city: '',
          state: customer.state || '',
          pinCode: '',
          phone: { countryCode: '+91', number: '' },
          faxNumber: '',
        },
        pan: customer.pan || '',
        placeOfSupply: customer.placeOfSupply || '',
        gstNo: customer.gstNo || '',
        currency: customer.currency || 'INR',
        paymentTerms: customer.paymentTerms || 'Due on Receipt',
        documents: customer.documents || [],
      });
      // If customer has existing displayName, mark as manually edited
      if (customer.displayName || customer.clientName) {
        setIsDisplayNameManuallyEdited(true);
      }
    }
  }, [customer]);

  // Auto-generate display name from salutation, firstName, and lastName
  useEffect(() => {
    // Only auto-generate if displayName hasn't been manually edited
    if (!isDisplayNameManuallyEdited) {
      const parts = [];
      
      // Add salutation if present
      if (formData.salutation && formData.salutation !== '-') {
        parts.push(formData.salutation.trim());
      }
      
      // Add first name if present
      if (formData.firstName && formData.firstName.trim()) {
        parts.push(formData.firstName.trim());
      }
      
      // Add last name if present
      if (formData.lastName && formData.lastName.trim()) {
        parts.push(formData.lastName.trim());
      }
      
      // Generate display name by joining parts with spaces
      const generatedDisplayName = parts.join(' ').trim();
      
      // Only update if we have at least one part
      if (generatedDisplayName) {
        setFormData(prev => ({
          ...prev,
          displayName: generatedDisplayName
        }));
      } else if (!formData.displayName) {
        // Clear display name if all fields are empty
        setFormData(prev => ({
          ...prev,
          displayName: ''
        }));
      }
    }
  }, [formData.salutation, formData.firstName, formData.lastName, isDisplayNameManuallyEdited]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // If displayName is being edited manually, mark it as manually edited
    if (name === 'displayName') {
      setIsDisplayNameManuallyEdited(true);
    }
    
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleNestedChange = (section, field, value) => {
    setFormData({
      ...formData,
      [section]: {
        ...formData[section],
        [field]: value,
      },
    });
  };

  const handlePhoneChange = (section, type, value) => {
    if (section === 'workPhone' || section === 'mobile') {
      setFormData({
        ...formData,
        [section]: {
          ...formData[section],
          [type]: value,
        },
      });
    } else {
      // For nested phone in addresses
      setFormData({
        ...formData,
        [section]: {
          ...formData[section],
          phone: {
            ...formData[section].phone,
            [type]: value,
          },
        },
      });
    }
  };


  const handleNext = () => {
    // Validate required fields based on current tab
    if (activeTab === 'details') {
      if (!formData.displayName) {
        alert('Display Name is required');
        return;
      }
      if (!formData.email) {
        alert('Email Address is required');
        return;
      }
      setActiveTab('address');
    } else if (activeTab === 'address') {
      setActiveTab('otherInfo');
    }
  };

  const handleBack = () => {
    if (activeTab === 'address') {
      setActiveTab('details');
    } else if (activeTab === 'otherInfo') {
      setActiveTab('address');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Allow submission from Other Information tab (final tab)
    if (activeTab !== 'otherInfo') {
      return;
    }
    
    if (!formData.displayName) {
      alert('Display Name is required');
      return;
    }
    if (!formData.email) {
      alert('Email Address is required');
      return;
    }
    
    // Map to legacy fields for backward compatibility
    const submitData = {
      ...formData,
      clientName: formData.displayName, // For backward compatibility
      country: formData.billingAddress?.country || formData.country || 'India',
      state: formData.billingAddress?.state || formData.state || '',
      billingAddress: formData.billingAddress?.street1 || formData.billingAddress || '',
      mobile: typeof formData.mobile === 'object' 
        ? formData.mobile.number 
        : formData.mobile || '',
    };
    
    onSubmit(submitData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <h2 className="text-xl font-bold text-gray-900">
            {customer ? 'Edit Customer' : 'New Customer'}
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

        {/* Tabs */}
        <div className="border-b border-slate-200 bg-white px-6">
          <div className="flex space-x-1">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'details'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-gray-900 hover:border-slate-300'
              }`}
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('address')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'address'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-gray-900 hover:border-slate-300'
              }`}
            >
              Address
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('otherInfo')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'otherInfo'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-gray-900 hover:border-slate-300'
              }`}
            >
              Other Information
            </button>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            {/* Tab Content */}
            {activeTab === 'details' && (
              <div className="space-y-6">
                {/* Primary Contact Section */}
                <div className="space-y-4 border-b border-gray-200 pb-5">
                  <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Primary Contact Information</h3>
                  
                  {/* Name Fields - 3 columns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">Salutation</label>
                      <select
                        name="salutation"
                        value={formData.salutation}
                        onChange={handleChange}
                        className="select-field w-full text-sm py-2"
                      >
                        <option value="">-</option>
                        {salutations.map((sal) => (
                          <option key={sal} value={sal}>{sal}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">First Name</label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        className="input-field w-full text-sm py-2"
                        placeholder="First Name"
                      />
                    </div>
                    <div>
                      <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">Last Name</label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        className="input-field w-full text-sm py-2"
                        placeholder="Last Name"
                      />
                    </div>
                  </div>

                  {/* Company and Display Name - 2 columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">Company Name</label>
                      <input
                        type="text"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleChange}
                        className="input-field w-full text-sm py-2"
                        placeholder="Company Name"
                      />
                    </div>
                    <div>
                      <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block flex items-center gap-2">
                        Display Name<span className="text-red-500">*</span>
                        <span className="text-gray-400 cursor-help" title="Display name for this customer">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.829V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                        </span>
                      </label>
                      <input
                        type="text"
                        name="displayName"
                        value={formData.displayName}
                        onChange={handleChange}
                        required
                        className="input-field w-full text-sm py-2"
                        placeholder="Select or type to add"
                        title="Auto-generated from Salutation, First Name, and Last Name. You can edit it manually."
                      />
                    </div>
                  </div>

                  {/* Email and Language - 2 columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block flex items-center gap-2">
                        Email Address<span className="text-red-500">*</span>
                        <span className="text-gray-400 cursor-help" title="Email address">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.829V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          className="input-field w-full text-sm py-2 pl-10 text-gray-900"
                          placeholder="Email Address"
                          style={{ color: '#111827' }}
                        />
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-sm pointer-events-none">✉</span>
                      </div>
                    </div>
                    <div>
                      <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block flex items-center gap-2">
                        Customer Language
                        <span className="text-gray-400 cursor-help" title="Preferred language">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.829V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                        </span>
                      </label>
                      <select
                        name="customerLanguage"
                        value={formData.customerLanguage}
                        onChange={handleChange}
                        className="select-field w-full text-sm py-2"
                      >
                        {languages.map((lang) => (
                          <option key={lang} value={lang}>{lang}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Phone Numbers - 2 columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">Work Phone</label>
                      <div className="flex gap-2">
                        <select
                          value={formData.workPhone?.countryCode || '+91'}
                          onChange={(e) => handlePhoneChange('workPhone', 'countryCode', e.target.value)}
                          className="select-field w-20 text-sm py-2"
                        >
                          {countryCodes.map((cc) => (
                            <option key={cc.code} value={cc.code}>{cc.code}</option>
                          ))}
                        </select>
                        <input
                          type="tel"
                          value={formData.workPhone?.number || ''}
                          onChange={(e) => handlePhoneChange('workPhone', 'number', e.target.value)}
                          className="input-field flex-1 text-sm py-2.5 text-gray-900"
                          placeholder="Work Phone"
                          style={{ color: '#111827', fontSize: '14px' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">Mobile</label>
                      <div className="flex gap-2">
                        <select
                          value={formData.mobile?.countryCode || '+91'}
                          onChange={(e) => handlePhoneChange('mobile', 'countryCode', e.target.value)}
                          className="select-field w-20 text-sm py-2"
                        >
                          {countryCodes.map((cc) => (
                            <option key={cc.code} value={cc.code}>{cc.code}</option>
                          ))}
                        </select>
                        <input
                          type="tel"
                          value={formData.mobile?.number || ''}
                          onChange={(e) => handlePhoneChange('mobile', 'number', e.target.value)}
                          className="input-field flex-1 text-sm py-2.5 text-gray-900"
                          placeholder="Mobile"
                          style={{ color: '#111827', fontSize: '14px' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Business Information Section */}
                <div className="space-y-4 border-b border-gray-200 pb-5">
                  <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Business Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block flex items-center gap-2">
                        PAN
                        <span className="text-gray-400 cursor-help" title="PAN number">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.829V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                        </span>
                      </label>
                      <input
                        type="text"
                        name="pan"
                        value={formData.pan}
                        onChange={handleChange}
                        className="input-field w-full text-sm py-2"
                        placeholder="PAN"
                      />
                    </div>
                    <div>
                      <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">Currency</label>
                      <select
                        name="currency"
                        value={formData.currency}
                        onChange={handleChange}
                        className="select-field w-full text-sm py-2"
                      >
                        {currencies.map((curr) => (
                          <option key={curr.code} value={curr.code}>
                            {curr.code} - {curr.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">Payment Terms</label>
                      <select
                        name="paymentTerms"
                        value={formData.paymentTerms}
                        onChange={handleChange}
                        className="select-field w-full text-sm py-2"
                      >
                        {paymentTermsOptions.map((term) => (
                          <option key={term} value={term}>{term}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'address' && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Billing Address</h3>
                
                {/* Attention and Country - 2 columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">Attention</label>
                    <input
                      type="text"
                      value={formData.billingAddress.attention || ''}
                      onChange={(e) => handleNestedChange('billingAddress', 'attention', e.target.value)}
                      className="input-field w-full text-sm py-2"
                      placeholder="Attention"
                    />
                  </div>
                  <div>
                    <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">Country/Region</label>
                    <select
                      value={formData.billingAddress.country || ''}
                      onChange={(e) => handleNestedChange('billingAddress', 'country', e.target.value)}
                      className="select-field w-full text-sm py-2"
                    >
                      <option value="">Select</option>
                      <option value="India">India</option>
                      <option value="USA">USA</option>
                      <option value="Canada">Canada</option>
                      <option value="Australia">Australia</option>
                    </select>
                  </div>
                </div>

                {/* Street Address - Full width */}
                <div>
                  <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">Street Address</label>
                  <input
                    type="text"
                    value={formData.billingAddress.street1 || ''}
                    onChange={(e) => handleNestedChange('billingAddress', 'street1', e.target.value)}
                    className="input-field w-full text-sm py-2 mb-2"
                    placeholder="Street 1"
                  />
                  <input
                    type="text"
                    value={formData.billingAddress.street2 || ''}
                    onChange={(e) => handleNestedChange('billingAddress', 'street2', e.target.value)}
                    className="input-field w-full text-sm py-2"
                    placeholder="Street 2 (Optional)"
                  />
                </div>

                {/* City, State, Pin Code - 3 columns */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">City</label>
                    <input
                      type="text"
                      value={formData.billingAddress.city || ''}
                      onChange={(e) => handleNestedChange('billingAddress', 'city', e.target.value)}
                      className="input-field w-full text-sm py-2"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">State</label>
                    <select
                      value={formData.billingAddress.state || ''}
                      onChange={(e) => handleNestedChange('billingAddress', 'state', e.target.value)}
                      className="select-field w-full text-sm py-2"
                    >
                      <option value="">Select or type to add</option>
                      <option value="Maharashtra">Maharashtra</option>
                      <option value="Gujarat">Gujarat</option>
                      <option value="Karnataka">Karnataka</option>
                      <option value="Delhi">Delhi</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">Pin Code</label>
                    <input
                      type="text"
                      value={formData.billingAddress.pinCode || ''}
                      onChange={(e) => handleNestedChange('billingAddress', 'pinCode', e.target.value)}
                      className="input-field w-full text-sm py-2"
                      placeholder="Pin Code"
                    />
                  </div>
                </div>

                {/* Phone and Fax - 2 columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">Phone</label>
                    <div className="flex gap-2">
                      <select
                        value={formData.billingAddress.phone?.countryCode || '+91'}
                        onChange={(e) => handlePhoneChange('billingAddress', 'countryCode', e.target.value)}
                        className="select-field w-20 text-sm py-2"
                      >
                        {countryCodes.map((cc) => (
                          <option key={cc.code} value={cc.code}>{cc.code}</option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        value={formData.billingAddress.phone?.number || ''}
                        onChange={(e) => handlePhoneChange('billingAddress', 'number', e.target.value)}
                        className="input-field flex-1 text-sm py-2.5 text-gray-900"
                        placeholder="Phone"
                        style={{ color: '#111827', fontSize: '14px' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">Fax Number</label>
                    <input
                      type="text"
                      value={formData.billingAddress.faxNumber || ''}
                      onChange={(e) => handleNestedChange('billingAddress', 'faxNumber', e.target.value)}
                      className="input-field w-full text-sm py-2"
                      placeholder="Fax Number (Optional)"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'otherInfo' && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Other Information</h3>
                
                {/* Place of Supply and GST No - 2 columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">Place of Supply</label>
                    <select
                      name="placeOfSupply"
                      value={formData.placeOfSupply}
                      onChange={handleChange}
                      className="select-field w-full text-sm py-2"
                    >
                      <option value="">Select State</option>
                      {indianStates.map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label text-xs font-medium text-gray-700 mb-1.5 block">GST No</label>
                    <input
                      type="text"
                      name="gstNo"
                      value={formData.gstNo}
                      onChange={handleChange}
                      className="input-field w-full text-sm py-2"
                      placeholder="GST Number"
                    />
                  </div>
                </div>
              </div>
            )}

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
            {activeTab === 'otherInfo' ? (
              <>
                <button
                  type="button"
                  onClick={handleBack}
                  className="btn-secondary px-6 py-2"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn-primary px-6 py-2"
                >
                  {customer ? 'Update' : 'Create'} Customer
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="btn-primary px-6 py-2"
              >
                Next
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerForm;
