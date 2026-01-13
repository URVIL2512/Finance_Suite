import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';

const ExpenseForm = ({ expense, onSubmit, onCancel }) => {
  const [activeTab, setActiveTab] = useState('expense');
  const [newCategory, setNewCategory] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryDropdownRef = useRef(null);
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    category: '',
    paymentMode: '',
    department: '',
    bankAccount: '',
    vendor: '',
    description: '',
    amountExclTax: '',
    gstPercentage: '',
    gstAmount: '',
    tdsPercentage: '',
    tdsAmount: '',
    totalAmount: '',
    paidAmount: '',
    paidTransactionRef: '',
    month: format(new Date(), 'MMM'),
    year: new Date().getFullYear(),
    executive: '',
    userName: '',
    userEmail: '',
    userPhone: '',
  });


  useEffect(() => {
    if (expense) {
      const expenseDate = new Date(expense.date);
      setFormData({
        date: format(expenseDate, 'yyyy-MM-dd'),
        category: expense.category || '',
        paymentMode: expense.paymentMode || '',
        department: expense.department || '',
        bankAccount: expense.bankAccount || '',
        vendor: expense.vendor || '',
        description: expense.description || '',
        amountExclTax: expense.amountExclTax === 0 || expense.amountExclTax === null || expense.amountExclTax === undefined ? '' : String(expense.amountExclTax),
        gstPercentage: expense.gstPercentage === 0 || expense.gstPercentage === null || expense.gstPercentage === undefined ? '' : String(expense.gstPercentage),
        gstAmount: expense.gstAmount === 0 || expense.gstAmount === null || expense.gstAmount === undefined ? '' : String(expense.gstAmount),
        tdsPercentage: expense.tdsPercentage === 0 || expense.tdsPercentage === null || expense.tdsPercentage === undefined ? '' : String(expense.tdsPercentage),
        tdsAmount: expense.tdsAmount === 0 || expense.tdsAmount === null || expense.tdsAmount === undefined ? '' : String(expense.tdsAmount),
        totalAmount: expense.totalAmount === 0 || expense.totalAmount === null || expense.totalAmount === undefined ? '' : String(expense.totalAmount),
        paidAmount: expense.paidAmount === 0 || expense.paidAmount === null || expense.paidAmount === undefined ? '' : String(expense.paidAmount),
        paidTransactionRef: expense.paidTransactionRef || '',
        month: expense.month || format(new Date(), 'MMM'),
        year: expense.year || new Date().getFullYear(),
        executive: expense.executive || '',
        userName: expense.userName || '',
        userEmail: expense.userEmail || '',
        userPhone: expense.userPhone || '',
      });
    } else {
      // Reset form when no expense is being edited
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        category: '',
        paymentMode: '',
        department: '',
        bankAccount: '',
        vendor: '',
        description: '',
        amountExclTax: '',
        gstPercentage: '',
        gstAmount: '',
        tdsPercentage: '',
        tdsAmount: '',
        totalAmount: '',
        paidAmount: '',
        paidTransactionRef: '',
        month: format(new Date(), 'MMM'),
        year: new Date().getFullYear(),
        executive: '',
        userName: '',
        userEmail: '',
        userPhone: '',
      });
    }
  }, [expense]);

  useEffect(() => {
    const amountExclTax = parseFloat(formData.amountExclTax) || 0;
    const gstPercentage = parseFloat(formData.gstPercentage) || 0;
    const tdsPercentage = parseFloat(formData.tdsPercentage) || 0;

    const gstAmount = (amountExclTax * gstPercentage) / 100;
    const tdsAmount = ((amountExclTax + gstAmount) * tdsPercentage) / 100;
    const totalAmount = amountExclTax + gstAmount - tdsAmount;

    setFormData((prev) => ({
      ...prev,
      gstAmount: gstAmount > 0 ? Math.round(gstAmount * 100) / 100 : '',
      tdsAmount: tdsAmount > 0 ? Math.round(tdsAmount * 100) / 100 : '',
      totalAmount: totalAmount > 0 ? Math.round(totalAmount * 100) / 100 : '',
    }));
  }, [formData.amountExclTax, formData.gstPercentage, formData.tdsPercentage]);

  useEffect(() => {
    const date = new Date(formData.date);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    setFormData((prev) => ({
      ...prev,
      month: monthNames[date.getMonth()],
      year: date.getFullYear(),
    }));
  }, [formData.date]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setShowCategoryDropdown(false);
        setShowAddCategory(false);
      }
    };

    if (showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCategoryDropdown]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'amountExclTax' || name === 'gstPercentage' || name === 'tdsPercentage' || name === 'paidAmount'
        ? value === '' ? '' : parseFloat(value) || ''
        : value,
    });
  };

  const handleNext = () => {
    // Validate required fields on Expense Details tab
    if (activeTab === 'expense') {
      if (!formData.date) {
        alert('Date is required');
        return;
      }
      if (!formData.category) {
        alert('Category is required');
        return;
      }
      if (!formData.paymentMode) {
        alert('Payment Mode is required');
        return;
      }
      if (!formData.department) {
        alert('Department is required');
        return;
      }
      if (!formData.amountExclTax) {
        alert('Amount (Excl. Tax) is required');
        return;
      }
      if (!formData.totalAmount) {
        alert('Total Amount is required');
        return;
      }
      setActiveTab('user');
    }
  };

  const handleBack = () => {
    if (activeTab === 'user') {
      setActiveTab('expense');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const expenseDate = new Date(formData.date);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[expenseDate.getMonth()];
    const year = expenseDate.getFullYear();
    
    const submitData = {
      ...formData,
      date: expenseDate,
      month: month,
      year: year,
      amountExclTax: parseFloat(formData.amountExclTax) || 0,
      gstPercentage: parseFloat(formData.gstPercentage) || 0,
      gstAmount: parseFloat(formData.gstAmount) || 0,
      tdsPercentage: parseFloat(formData.tdsPercentage) || 0,
      tdsAmount: parseFloat(formData.tdsAmount) || 0,
      totalAmount: parseFloat(formData.totalAmount) || 0,
      paidAmount: parseFloat(formData.paidAmount) || 0,
    };
    
    onSubmit(submitData);
  };

  const [categories, setCategories] = useState([
    'Salaries',
    'Office Rent',
    'Internet',
    'Electricity',
    'Software Tools',
    'HR/Admin',
    'Travel',
    'Food',
    'Marketing',
    'Compliance',
    'Misc',
    'Chai n Snacks',
    'Loan Interest',
    'Purchase',
    'Remittance',
  ]);

  const handleAddCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories([...categories, newCategory.trim()]);
      setFormData({ ...formData, category: newCategory.trim() });
      setNewCategory('');
      setShowAddCategory(false);
    }
  };
  const paymentModes = [
    'Office Cash',
    'Bank Transfer',
    'Mihir Personal',
    'Komal Personal HDFC',
    'Komal Personal Cash',
    'HR Personal',
    'Other',
  ];
  const departments = [
    'OPERATION',
    'SOCIAL MEDIA',
    'WEBSITE',
    'BUSINESS DEVELOPMENT',
    'TELE CALLING',
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-2xl font-bold text-gray-900">
            {expense ? 'Edit Expense' : 'New Expense'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-red-600 transition-colors text-3xl font-light leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-white">
          <div className="flex px-8">
            <button
              type="button"
              onClick={() => setActiveTab('expense')}
              className={`px-6 py-4 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'expense'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Expense Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('user')}
              className={`px-6 py-4 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'user'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              User Information
            </button>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto bg-gray-50/30">
          <div className="p-8 space-y-8">
            {activeTab === 'expense' && (
              <>
            {/* Basic Information Section */}
            <div className="space-y-5">
              <h3 className="text-base font-bold text-gray-800 uppercase tracking-wider mb-4">Basic Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Date<span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleChange}
                      required
                      className="input-field w-full text-sm py-2.5 pl-4 pr-10"
                    />
                    <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Category<span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="relative" ref={categoryDropdownRef}>
                    <div
                      onClick={() => {
                        setShowCategoryDropdown(!showCategoryDropdown);
                        setShowAddCategory(false);
                      }}
                      className="select-field w-full text-sm py-2.5 cursor-pointer flex items-center justify-between"
                    >
                      <span className={formData.category ? 'text-gray-900' : 'text-gray-400'}>
                        {formData.category || 'Select'}
                      </span>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    {showCategoryDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                        <div className="py-1">
                          {categories.map((cat) => (
                            <div
                              key={cat}
                              onClick={() => {
                                setFormData({ ...formData, category: cat });
                                setShowCategoryDropdown(false);
                              }}
                              className={`px-4 py-2 cursor-pointer hover:bg-blue-50 ${
                                formData.category === cat ? 'bg-blue-100 text-blue-700' : 'text-gray-900'
                              }`}
                            >
                              {cat}
                            </div>
                          ))}
                          <div className="border-t border-gray-200 mt-1">
                            {!showAddCategory ? (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowAddCategory(true);
                                }}
                                className="px-4 py-2 cursor-pointer hover:bg-blue-50 text-blue-600 font-semibold flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add New Category
                              </div>
                            ) : (
                              <div className="p-2 border-t border-gray-200 bg-gray-50">
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={newCategory}
                                    onChange={(e) => setNewCategory(e.target.value)}
                                    placeholder="Enter new category"
                                    className="input-field flex-1 text-sm py-2"
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddCategory();
                                        setShowCategoryDropdown(false);
                                      }
                                    }}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddCategory();
                                      setShowCategoryDropdown(false);
                                    }}
                                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowAddCategory(false);
                                      setNewCategory('');
                                    }}
                                    className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-semibold"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    type="hidden"
                    name="category"
                    value={formData.category}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Vendor/Party</label>
                  <input
                    type="text"
                    name="vendor"
                    value={formData.vendor}
                    onChange={handleChange}
                    placeholder="Enter name"
                    className="input-field w-full text-sm py-2.5"
                  />
                </div>
              </div>
            </div>

            {/* Financial Details Section */}
            <div className="space-y-5">
              <h3 className="text-base font-bold text-gray-800 uppercase tracking-wider mb-4">Financial Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Amount (Excl. Tax)<span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="number"
                    name="amountExclTax"
                    value={formData.amountExclTax}
                    onChange={handleChange}
                    step="0.01"
                    placeholder="0.00"
                    required
                    className="input-field w-full text-sm py-2.5"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">GST %</label>
                  <input
                    type="number"
                    name="gstPercentage"
                    value={formData.gstPercentage}
                    onChange={handleChange}
                    step="0.01"
                    placeholder="0"
                    className="input-field w-full text-sm py-2.5"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">GST Amount</label>
                  <input
                    type="text"
                    name="gstAmount"
                    value={formData.gstAmount || ''}
                    readOnly
                    className="input-field w-full text-sm py-2.5 bg-gray-50 cursor-not-allowed text-gray-600"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">TDS %</label>
                  <input
                    type="number"
                    name="tdsPercentage"
                    value={formData.tdsPercentage}
                    onChange={handleChange}
                    step="0.01"
                    placeholder="0"
                    className="input-field w-full text-sm py-2.5"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">TDS Amount</label>
                  <input
                    type="text"
                    name="tdsAmount"
                    value={formData.tdsAmount || ''}
                    readOnly
                    className="input-field w-full text-sm py-2.5 bg-gray-50 cursor-not-allowed text-gray-600"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Total Amount<span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    name="totalAmount"
                    value={formData.totalAmount || ''}
                    readOnly
                    className="input-field w-full text-sm py-2.5 bg-gray-50 cursor-not-allowed font-semibold text-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Transaction Details Section */}
            <div className="space-y-5">
              <h3 className="text-base font-bold text-gray-800 uppercase tracking-wider mb-4">Transaction Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Payment Mode<span className="text-red-500 ml-1">*</span>
                  </label>
                  <select
                    name="paymentMode"
                    value={formData.paymentMode}
                    onChange={handleChange}
                    required
                    className="select-field w-full text-sm py-2.5"
                  >
                    <option value="">Select</option>
                    {paymentModes.map((mode) => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Department<span className="text-red-500 ml-1">*</span>
                  </label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    required
                    className="select-field w-full text-sm py-2.5"
                  >
                    <option value="">Select</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Bank Account</label>
                  <input
                    type="text"
                    name="bankAccount"
                    value={formData.bankAccount}
                    onChange={handleChange}
                    placeholder="Enter account"
                    className="input-field w-full text-sm py-2.5"
                  />
                </div>
              </div>
            </div>

            {/* Payment Information Section */}
            <div className="space-y-5">
              <h3 className="text-base font-bold text-gray-800 uppercase tracking-wider mb-4">Payment Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Paid Amount</label>
                  <input
                    type="number"
                    name="paidAmount"
                    value={formData.paidAmount}
                    onChange={handleChange}
                    step="0.01"
                    placeholder="0.00"
                    className="input-field w-full text-sm py-2.5"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Transaction Ref</label>
                  <input
                    type="text"
                    name="paidTransactionRef"
                    value={formData.paidTransactionRef}
                    onChange={handleChange}
                    placeholder="Enter reference"
                    className="input-field w-full text-sm py-2.5"
                  />
                </div>
              </div>
            </div>

            {/* Additional Information Section */}
            <div className="space-y-5">
              <h3 className="text-base font-bold text-gray-800 uppercase tracking-wider mb-4">Additional Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Description</label>
                  <input
                    type="text"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Enter description"
                    className="input-field w-full text-sm py-2.5"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Executive</label>
                  <input
                    type="text"
                    name="executive"
                    value={formData.executive}
                    onChange={handleChange}
                    placeholder="Enter executive name"
                    className="input-field w-full text-sm py-2.5"
                  />
                </div>
              </div>
            </div>
              </>
            )}

            {activeTab === 'user' && (
              <div className="space-y-5">
                <h3 className="text-base font-bold text-gray-800 uppercase tracking-wider mb-4">User Information</h3>
                <p className="text-sm text-gray-600 mb-4">Enter the details of the user who created/edited this expense entry.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      User Name<span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      name="userName"
                      value={formData.userName}
                      onChange={handleChange}
                      placeholder="Enter user name"
                      required
                      className="input-field w-full text-sm py-2.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      Email ID
                    </label>
                    <input
                      type="email"
                      name="userEmail"
                      value={formData.userEmail}
                      onChange={handleChange}
                      placeholder="Enter email address"
                      className="input-field w-full text-sm py-2.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="userPhone"
                      value={formData.userPhone}
                      onChange={handleChange}
                      placeholder="Enter phone number"
                      className="input-field w-full text-sm py-2.5"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-gray-200 px-8 py-5 bg-white flex justify-between gap-3">
            <div>
              {activeTab === 'user' && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  Back
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                Cancel
              </button>
              {activeTab === 'expense' ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-md"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-md"
                >
                  {expense ? 'Update Expense' : 'Create Expense'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExpenseForm;
