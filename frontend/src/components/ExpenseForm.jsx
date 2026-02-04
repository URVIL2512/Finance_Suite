import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { authAPI, paymentModeAPI, vendorAPI, bankAccountAPI, expenseCategoryAPI, departmentAPI } from '../services/api';
import MobileSelect from './MobileSelect';

const ExpenseForm = ({ expense, onSubmit, onCancel }) => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const DRAFT_KEY = 'kology:expenseFormDraft:v1';
  const didInitDraft = useRef(false);
  const [newCategory, setNewCategory] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const categoryDropdownRef = useRef(null);
  const [paymentModes, setPaymentModes] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const DEFAULT_DEPARTMENTS = ['OPERATION', 'SOCIAL MEDIA', 'WEBSITE', 'BUSINESS DEVELOPMENT', 'TELE CALLING'];
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS);
  const [showPaymentModeDropdown, setShowPaymentModeDropdown] = useState(false);
  const [paymentModeSearchTerm, setPaymentModeSearchTerm] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [vendorSearchTerm, setVendorSearchTerm] = useState('');
  const [showBankAccountDropdown, setShowBankAccountDropdown] = useState(false);
  const [bankAccountSearchTerm, setBankAccountSearchTerm] = useState('');
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState('');
  const paymentModeDropdownRef = useRef(null);
  const vendorDropdownRef = useRef(null);
  const bankAccountDropdownRef = useRef(null);
  const departmentDropdownRef = useRef(null);
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
    status: 'Unpaid',
    paidTransactionRef: '',
    month: format(new Date(), 'MMM'),
    year: new Date().getFullYear(),
    executive: '',
    userName: '',
    userEmail: '',
    userPhone: '',
  });

  const loadDraft = () => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const saveDraft = (next) => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  };

  const handleCancelInternal = () => {
    // Only clear drafts for new expense creation (not when editing an existing one)
    if (!expense) clearDraft();
    onCancel();
  };


  // Fetch Payment Modes, Vendors, Bank Accounts, Expense Categories, and Departments
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        // Fetch Payment Modes
        const paymentModesResponse = await paymentModeAPI.getAll({ isActive: true });
        const activePaymentModes = (paymentModesResponse.data || []).filter(mode => mode.isActive !== false);
        setPaymentModes(activePaymentModes.map(mode => mode.name));

        // Fetch Vendors
        const vendorsResponse = await vendorAPI.getAll({ isActive: true });
        const activeVendors = (vendorsResponse.data || []).filter(vendor => vendor.isActive !== false);
        setVendors(activeVendors.map(vendor => vendor.name));

        // Fetch Bank Accounts
        const bankAccountsResponse = await bankAccountAPI.getAll({ isActive: true });
        const activeBankAccounts = (bankAccountsResponse.data || []).filter(account => account.isActive !== false);
        setBankAccounts(activeBankAccounts.map(account => account.accountName));

        // Fetch Expense Categories
        const expenseCategoriesResponse = await expenseCategoryAPI.getAll({ isActive: true });
        const activeExpenseCategories = (expenseCategoriesResponse.data || []).filter((c) => c?.isActive !== false);
        const categoryNames = activeExpenseCategories.map((c) => c.name).filter(Boolean);
        setCategories(categoryNames);

        // Fetch Departments
        const departmentsResponse = await departmentAPI.getAll({ isActive: true });
        const activeDepartments = (departmentsResponse.data || []).filter((d) => d?.isActive !== false);
        const deptNames = activeDepartments.map((d) => d.name).filter(Boolean);
        const selected = (formData.department || '').trim();
        const merged = selected ? Array.from(new Set([...deptNames, selected])) : deptNames;
        setDepartments(merged.length ? merged : DEFAULT_DEPARTMENTS);
      } catch (error) {
        console.error('Error fetching master data:', error);
        // Set default values if API fails
        setPaymentModes(['Office Cash', 'Bank Transfer', 'Mihir Personal', 'Komal Personal HDFC', 'Komal Personal Cash', 'HR Personal', 'Other']);
        setBankAccounts(['Kology', 'Kology ICICI']);
        setDepartments(DEFAULT_DEPARTMENTS);
      }
    };

    fetchMasterData();
  }, []);

  useEffect(() => {
    const initializeForm = async () => {
      if (expense) {
        // Editing existing expense - populate from expense data
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
          status: expense.status || 'Unpaid',
          paidTransactionRef: expense.paidTransactionRef || '',
          month: expense.month || format(new Date(), 'MMM'),
          year: expense.year || new Date().getFullYear(),
          executive: expense.executive || '',
          userName: expense.userName || '',
          userEmail: expense.userEmail || '',
          userPhone: expense.userPhone || '',
        });
        didInitDraft.current = false; // don't persist drafts for edit flows by default
      } else {
        // New expense - initialize form and fetch user profile
        const initialFormData = {
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
          status: 'Unpaid',
          paidTransactionRef: '',
          month: format(new Date(), 'MMM'),
          year: new Date().getFullYear(),
          executive: '',
          userName: '',
          userEmail: '',
          userPhone: '',
        };

        // Restore draft if coming back from masters (vendor/payment-mode/bank-account)
        const draft = loadDraft();
        const merged = draft ? { ...initialFormData, ...draft } : initialFormData;

        // Fetch user profile and auto-populate user information (hidden from user)
        try {
          const response = await authAPI.getMe();
          const user = response.data;
          if (user) {
            if (!merged.userName) merged.userName = user.name || '';
            if (!merged.userEmail) merged.userEmail = user.email || '';
            if (!merged.userPhone) merged.userPhone = user.phone || '';
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }

        setFormData(merged);
        didInitDraft.current = true;
      }
    };

    initializeForm();
  }, [expense]);

  // Persist new-expense drafts so navigating to Masters doesn't wipe the form.
  useEffect(() => {
    if (expense) return;
    if (!didInitDraft.current) return;
    saveDraft(formData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, expense]);

  // Track which fields were manually changed to avoid circular updates
  const lastChangedField = useRef('');
  const isCalculating = useRef(false);

  useEffect(() => {
    if (isCalculating.current) return;
    
    const amountExclTax = parseFloat(formData.amountExclTax) || 0;
    const gstPercentage = parseFloat(formData.gstPercentage) || 0;
    const gstAmount = parseFloat(formData.gstAmount) || 0;
    const tdsPercentage = parseFloat(formData.tdsPercentage) || 0;
    const tdsAmount = parseFloat(formData.tdsAmount) || 0;

    if (amountExclTax <= 0) {
      // Reset all if amount is 0
      if (lastChangedField.current !== 'gstPercentage' && lastChangedField.current !== 'tdsPercentage') {
        isCalculating.current = true;
        setFormData((prev) => ({
          ...prev,
          gstAmount: '',
          tdsAmount: '',
          totalAmount: '',
        }));
        setTimeout(() => { isCalculating.current = false; }, 0);
      }
      return;
    }

    let finalGstAmount = gstAmount;
    let finalGstPercentage = gstPercentage;
    let finalTdsAmount = tdsAmount;
    let finalTdsPercentage = tdsPercentage;

    isCalculating.current = true;

    // GST Calculation: Bidirectional
    if (lastChangedField.current === 'gstAmount' && gstAmount > 0) {
      // User entered GST Amount -> Calculate GST%
      finalGstPercentage = (gstAmount / amountExclTax) * 100;
      finalGstAmount = gstAmount;
    } else if ((lastChangedField.current === 'gstPercentage' || lastChangedField.current === 'amountExclTax') && gstPercentage > 0) {
      // User entered GST% or Amount -> Calculate GST Amount
      finalGstAmount = (amountExclTax * gstPercentage) / 100;
      finalGstPercentage = gstPercentage;
    }

    // Calculate base amount with GST for TDS calculation
    const baseAmountWithGst = amountExclTax + finalGstAmount;

    // TDS Calculation: Bidirectional
    if (lastChangedField.current === 'tdsAmount' && tdsAmount > 0 && baseAmountWithGst > 0) {
      // User entered TDS Amount -> Calculate TDS%
      finalTdsPercentage = (tdsAmount / baseAmountWithGst) * 100;
      finalTdsAmount = tdsAmount;
    } else if ((lastChangedField.current === 'tdsPercentage' || lastChangedField.current === 'amountExclTax' || lastChangedField.current === 'gstPercentage' || lastChangedField.current === 'gstAmount') && tdsPercentage > 0 && baseAmountWithGst > 0) {
      // User entered TDS% or dependent fields changed -> Calculate TDS Amount
      finalTdsAmount = (baseAmountWithGst * tdsPercentage) / 100;
      finalTdsPercentage = tdsPercentage;
    }

    // Calculate total amount
    const totalAmount = amountExclTax + finalGstAmount - finalTdsAmount;

    setFormData((prev) => ({
      ...prev,
      gstAmount: finalGstAmount > 0 ? Math.round(finalGstAmount * 100) / 100 : '',
      gstPercentage: finalGstPercentage > 0 ? Math.round(finalGstPercentage * 100) / 100 : prev.gstPercentage,
      tdsAmount: finalTdsAmount > 0 ? Math.round(finalTdsAmount * 100) / 100 : '',
      tdsPercentage: finalTdsPercentage > 0 ? Math.round(finalTdsPercentage * 100) / 100 : prev.tdsPercentage,
      totalAmount: totalAmount > 0 ? Math.round(totalAmount * 100) / 100 : '',
    }));

    // Reset tracking after a short delay
    setTimeout(() => {
      isCalculating.current = false;
      if (lastChangedField.current !== 'amountExclTax') {
        lastChangedField.current = '';
      }
    }, 0);
  }, [formData.amountExclTax, formData.gstPercentage, formData.gstAmount, formData.tdsPercentage, formData.tdsAmount]);

  useEffect(() => {
    const date = new Date(formData.date);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    setFormData((prev) => ({
      ...prev,
      month: monthNames[date.getMonth()],
      year: date.getFullYear(),
    }));
  }, [formData.date]);

  // Auto-update status when paidAmount/total changes
  // Use computed total so status stays correct even when totalAmount is missing.
  // Don't auto-update if status is Cancel (user explicitly set it)
  useEffect(() => {
    if (formData.status === 'Cancel') {
      return; // Don't auto-update Cancel status
    }
    
    const totalAmount = computedTotalAmount;
    const paidAmount = parseFloat(formData.paidAmount) || 0;
    
    if (totalAmount > 0) {
      if (paidAmount >= totalAmount) {
        // Fully paid
        setFormData((prev) => ({
          ...prev,
          status: 'Paid',
        }));
      } else if (paidAmount > 0) {
        // Partially paid
        setFormData((prev) => ({
          ...prev,
          status: 'Partial',
        }));
      } else {
        // Not paid
        setFormData((prev) => ({
          ...prev,
          status: 'Unpaid',
        }));
      }
    }
  }, [formData.paidAmount, formData.totalAmount, formData.amountExclTax, formData.gstAmount, formData.tdsAmount, formData.status]);

  // Calculate balance (Due Amount)
  // Prefer stored totalAmount, but fall back to derived total (Amount + GST - TDS)
  // to avoid transient/blank totalAmount causing negative balances (e.g. -4).
  const computedTotalAmount = (() => {
    const explicitTotal = parseFloat(formData.totalAmount);
    if (!Number.isNaN(explicitTotal) && explicitTotal > 0) return explicitTotal;

    const amountExclTax = parseFloat(formData.amountExclTax) || 0;
    const gstAmount = parseFloat(formData.gstAmount) || 0;
    const tdsAmount = parseFloat(formData.tdsAmount) || 0;
    const derivedTotal = amountExclTax + gstAmount - tdsAmount;
    return derivedTotal > 0 ? derivedTotal : 0;
  })();

  const balance = Math.max(0, computedTotalAmount - (parseFloat(formData.paidAmount) || 0));

  // Ensure totalAmount is always populated for display/submission (backfills older records)
  // Guarded to avoid unnecessary re-renders/loops.
  const computedTotalAmountStr = computedTotalAmount > 0 ? String(Math.round(computedTotalAmount * 100) / 100) : '';
  useEffect(() => {
    setFormData((prev) => {
      if (computedTotalAmountStr === '') {
        return prev.totalAmount === '' ? prev : { ...prev, totalAmount: '' };
      }

      const prevNum = parseFloat(prev.totalAmount);
      const nextNum = parseFloat(computedTotalAmountStr);
      const isSame =
        !Number.isNaN(prevNum) &&
        !Number.isNaN(nextNum) &&
        Math.abs(prevNum - nextNum) < 0.005;

      if (isSame) return prev;
      return { ...prev, totalAmount: computedTotalAmountStr };
    });
  }, [computedTotalAmountStr]);
  
  // Check if amount fields should be locked (when status is Paid)
  const isLocked = formData.status === 'Paid';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setShowCategoryDropdown(false);
        setShowAddCategory(false);
      }
      if (paymentModeDropdownRef.current && !paymentModeDropdownRef.current.contains(event.target)) {
        setShowPaymentModeDropdown(false);
        setPaymentModeSearchTerm('');
      }
      if (vendorDropdownRef.current && !vendorDropdownRef.current.contains(event.target)) {
        setShowVendorDropdown(false);
        setVendorSearchTerm('');
      }
      if (bankAccountDropdownRef.current && !bankAccountDropdownRef.current.contains(event.target)) {
        setShowBankAccountDropdown(false);
        setBankAccountSearchTerm('');
      }
      if (departmentDropdownRef.current && !departmentDropdownRef.current.contains(event.target)) {
        setShowDepartmentDropdown(false);
        setDepartmentSearchTerm('');
      }
    };

    if (showCategoryDropdown || showPaymentModeDropdown || showVendorDropdown || showBankAccountDropdown || showDepartmentDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCategoryDropdown, showPaymentModeDropdown, showVendorDropdown, showBankAccountDropdown, showDepartmentDropdown]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Lock amount fields when status is Paid
    const lockedFields = ['amountExclTax', 'gstPercentage', 'gstAmount', 'tdsPercentage', 'tdsAmount', 'totalAmount'];
    if (isLocked && lockedFields.includes(name)) {
      return; // Prevent editing locked fields
    }
    
    // Track which field was changed for bidirectional calculation
    if (name === 'gstAmount' || name === 'tdsAmount' || name === 'gstPercentage' || name === 'tdsPercentage' || name === 'amountExclTax') {
      lastChangedField.current = name;
    }
    
    // Status is now auto-calculated, so we remove manual status change handlers
    
    setFormData({
      ...formData,
      [name]: name === 'amountExclTax' || name === 'gstPercentage' || name === 'gstAmount' || name === 'tdsPercentage' || name === 'tdsAmount'
        ? value === '' ? '' : parseFloat(value) || ''
        : name === 'paidAmount'
        ? value === '' ? '' : parseFloat(value) || ''
        : value,
    });
  };

  // Prevent arrow keys and scroll from changing number input values
  const handleNumberInputKeyDown = (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
    }
  };

  const handleNumberInputWheel = (e) => {
    if (e.target.type === 'number') {
      e.target.blur();
    }
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmitting) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
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
        // totalAmount can be missing in older records; always submit a computed total
        totalAmount: Math.round(computedTotalAmount * 100) / 100,
        paidAmount: parseFloat(formData.paidAmount) || 0,
        status: formData.status || 'Unpaid',
      };
      
      await onSubmit(submitData);
      // Clear draft only after a successful submit
      if (!expense) clearDraft();
    } finally {
      // Reset after a short delay to allow for any async operations
      setTimeout(() => {
        setIsSubmitting(false);
      }, 500);
    }
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

  const handleAddCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;

    const exists = categories.some((c) => String(c).toLowerCase() === name.toLowerCase());
    if (exists) {
      setFormData({ ...formData, category: name });
      setNewCategory('');
      setShowAddCategory(false);
      return;
    }

    try {
      setIsAddingCategory(true);
      await expenseCategoryAPI.create({ name, costType: 'Variable', isActive: true });

      const expenseCategoriesResponse = await expenseCategoryAPI.getAll({ isActive: true });
      const activeExpenseCategories = (expenseCategoriesResponse.data || []).filter((c) => c?.isActive !== false);
      const categoryNames = activeExpenseCategories.map((c) => c.name).filter(Boolean);
      setCategories(categoryNames);

      setFormData({ ...formData, category: name });
      setNewCategory('');
      setShowAddCategory(false);
      showToast('Category created successfully!', 'success');
    } catch (e) {
      console.error('Error creating expense category:', e);
      showToast(e?.response?.data?.message || 'Failed to create category', 'error');
    } finally {
      setIsAddingCategory(false);
    }
  };
  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleCancelInternal}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-2xl font-bold text-gray-900">
            {expense ? 'Edit Expense' : 'New Expense'}
          </h2>
          <button
            type="button"
            onClick={handleCancelInternal}
            className="text-gray-400 hover:text-red-600 active:text-red-700 active:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-150 text-3xl font-light leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 active:scale-95"
            aria-label="Close"
          >
            ×
          </button>
        </div>


        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto bg-gray-50/30">
          <div className="p-8 space-y-8">
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
                        if (!showCategoryDropdown) {
                          setCategorySearchTerm('');
                        }
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
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                        {/* Search Input */}
                        <div className="p-2 border-b border-gray-200">
                          <div className="relative">
                            <input
                              type="text"
                              value={categorySearchTerm}
                              onChange={(e) => setCategorySearchTerm(e.target.value)}
                              placeholder="Search categories..."
                              className="w-full px-3 py-2 pl-9 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                            <svg
                              className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            {categorySearchTerm && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCategorySearchTerm('');
                                }}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 active:text-gray-800 active:scale-90 focus:outline-none focus:ring-2 focus:ring-gray-400 rounded transition-all duration-150"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Categories List */}
                        <div className="overflow-y-auto max-h-48 py-1">
                          {categories
                            .filter((cat) =>
                              cat.toLowerCase().includes(categorySearchTerm.toLowerCase())
                            )
                            .map((cat) => (
                              <div
                                key={cat}
                                onClick={() => {
                                  setFormData({ ...formData, category: cat });
                                  setShowCategoryDropdown(false);
                                  setCategorySearchTerm('');
                                }}
                                className={`px-4 py-2 cursor-pointer hover:bg-blue-50 active:bg-blue-100 active:scale-[0.98] transition-all duration-150 ${
                                  formData.category === cat ? 'bg-blue-100 text-blue-700' : 'text-gray-900'
                                }`}
                              >
                                {cat}
                              </div>
                            ))}
                          {categories.filter((cat) =>
                            cat.toLowerCase().includes(categorySearchTerm.toLowerCase())
                          ).length === 0 && (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">
                              No categories found
                            </div>
                          )}
                          <div className="border-t border-gray-200 mt-1">
                            {!showAddCategory ? (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowAddCategory(true);
                                }}
                                className="px-4 py-2 cursor-pointer hover:bg-blue-50 active:bg-blue-100 active:scale-[0.98] transition-all duration-150 text-blue-600 font-semibold flex items-center gap-2"
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
                                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 active:scale-95 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-150 text-sm font-semibold shadow-sm hover:shadow-md active:shadow-sm"
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
                                    className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 active:bg-gray-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-150 text-sm font-semibold shadow-sm hover:shadow-md active:shadow-sm"
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
                  <div className="relative" ref={vendorDropdownRef}>
                    <div
                      onClick={() => {
                        setShowVendorDropdown(!showVendorDropdown);
                        if (!showVendorDropdown) {
                          setVendorSearchTerm('');
                        }
                      }}
                      className="select-field w-full text-sm py-2.5 cursor-pointer flex items-center justify-between"
                    >
                      <span className={formData.vendor ? 'text-gray-900' : 'text-gray-400'}>
                        {formData.vendor || 'Enter name'}
                      </span>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${showVendorDropdown ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    {showVendorDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                        {/* Search Input */}
                        <div className="p-2 border-b border-gray-200">
                          <div className="relative">
                            <input
                              type="text"
                              value={vendorSearchTerm}
                              onChange={(e) => setVendorSearchTerm(e.target.value)}
                              placeholder="Search vendors..."
                              className="w-full px-3 py-2 pl-9 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                            <svg
                              className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            {vendorSearchTerm && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVendorSearchTerm('');
                                }}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 active:text-gray-800 active:scale-90 focus:outline-none focus:ring-2 focus:ring-gray-400 rounded transition-all duration-150"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Vendors List */}
                        <div className="overflow-y-auto max-h-48 py-1">
                          {vendors
                            .filter((vendor) =>
                              vendor.toLowerCase().includes(vendorSearchTerm.toLowerCase())
                            )
                            .map((vendor) => (
                              <div
                                key={vendor}
                                onClick={() => {
                                  setFormData({ ...formData, vendor: vendor });
                                  setShowVendorDropdown(false);
                                  setVendorSearchTerm('');
                                }}
                                className={`px-4 py-2 cursor-pointer hover:bg-blue-50 active:bg-blue-100 active:scale-[0.98] transition-all duration-150 ${
                                  formData.vendor === vendor ? 'bg-blue-100 text-blue-700' : 'text-gray-900'
                                }`}
                              >
                                {vendor}
                              </div>
                            ))}
                          {vendors.filter((vendor) =>
                            vendor.toLowerCase().includes(vendorSearchTerm.toLowerCase())
                          ).length === 0 && (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">
                              {vendorSearchTerm ? 'No vendors found' : 'No vendors available'}
                            </div>
                          )}
                          {/* Allow manual entry and Add New */}
                          <div className="border-t border-gray-200 mt-1 space-y-1">
                            {vendorSearchTerm && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const manualVendor = vendorSearchTerm.trim();
                                  if (manualVendor) {
                                    setFormData({ ...formData, vendor: manualVendor });
                                    setShowVendorDropdown(false);
                                    setVendorSearchTerm('');
                                  }
                                }}
                                className="px-4 py-2 cursor-pointer hover:bg-blue-50 active:bg-blue-100 active:scale-[0.98] transition-all duration-150 text-blue-600 font-semibold flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Use "{vendorSearchTerm}"
                              </div>
                            )}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowVendorDropdown(false);
                                setVendorSearchTerm('');
                                // Navigate to masters page with vendor tab
                                navigate('/expenses/masters', {
                                  state: {
                                    activeTab: 'vendor',
                                    returnTo: location.pathname,
                                    returnState: { showExpenseForm: true, editingExpense: expense }
                                  }
                                });
                              }}
                              className="px-4 py-2 cursor-pointer hover:bg-blue-50 active:bg-blue-100 active:scale-[0.98] transition-all duration-150 text-blue-600 font-semibold flex items-center gap-2 border-t border-gray-200"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Add New Vendor
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
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
                    onKeyDown={handleNumberInputKeyDown}
                    onWheel={handleNumberInputWheel}
                    step="0.01"
                    placeholder="0.00"
                    required
                    disabled={isLocked}
                    className={`input-field w-full text-sm py-2.5 ${isLocked ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">GST %</label>
                  <input
                    type="number"
                    name="gstPercentage"
                    value={formData.gstPercentage}
                    onChange={handleChange}
                    onKeyDown={handleNumberInputKeyDown}
                    onWheel={handleNumberInputWheel}
                    step="0.01"
                    placeholder="0"
                    disabled={isLocked}
                    className={`input-field w-full text-sm py-2.5 ${isLocked ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">GST Amount</label>
                  <input
                    type="number"
                    name="gstAmount"
                    value={formData.gstAmount || ''}
                    onChange={handleChange}
                    onKeyDown={handleNumberInputKeyDown}
                    onWheel={handleNumberInputWheel}
                    step="0.01"
                    placeholder="0.00"
                    disabled={isLocked}
                    className={`input-field w-full text-sm py-2.5 ${isLocked ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}
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
                    onKeyDown={handleNumberInputKeyDown}
                    onWheel={handleNumberInputWheel}
                    step="0.01"
                    placeholder="0"
                    disabled={isLocked}
                    className={`input-field w-full text-sm py-2.5 ${isLocked ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">TDS Amount</label>
                  <input
                    type="number"
                    name="tdsAmount"
                    value={formData.tdsAmount || ''}
                    onChange={handleChange}
                    onKeyDown={handleNumberInputKeyDown}
                    onWheel={handleNumberInputWheel}
                    step="0.01"
                    placeholder="0.00"
                    disabled={isLocked}
                    className={`input-field w-full text-sm py-2.5 ${isLocked ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Total Amount<span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    name="totalAmount"
                    value={formData.totalAmount || computedTotalAmount.toFixed(2)}
                    readOnly
                    disabled={isLocked}
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
                  <div className="relative" ref={paymentModeDropdownRef}>
                    <div
                      onClick={() => {
                        setShowPaymentModeDropdown(!showPaymentModeDropdown);
                        if (!showPaymentModeDropdown) {
                          setPaymentModeSearchTerm('');
                        }
                      }}
                      className="select-field w-full text-sm py-2.5 cursor-pointer flex items-center justify-between"
                    >
                      <span className={formData.paymentMode ? 'text-gray-900' : 'text-gray-400'}>
                        {formData.paymentMode || 'Select'}
                      </span>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${showPaymentModeDropdown ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    {showPaymentModeDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                        {/* Search Input */}
                        <div className="p-2 border-b border-gray-200">
                          <div className="relative">
                            <input
                              type="text"
                              value={paymentModeSearchTerm}
                              onChange={(e) => setPaymentModeSearchTerm(e.target.value)}
                              placeholder="Search payment modes..."
                              className="w-full px-3 py-2 pl-9 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                            <svg
                              className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            {paymentModeSearchTerm && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPaymentModeSearchTerm('');
                                }}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 active:text-gray-800 active:scale-90 focus:outline-none focus:ring-2 focus:ring-gray-400 rounded transition-all duration-150"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Payment Modes List */}
                        <div className="overflow-y-auto max-h-48 py-1">
                          {paymentModes
                            .filter((mode) =>
                              mode.toLowerCase().includes(paymentModeSearchTerm.toLowerCase())
                            )
                            .map((mode) => (
                              <div
                                key={mode}
                                onClick={() => {
                                  setFormData({ ...formData, paymentMode: mode });
                                  setShowPaymentModeDropdown(false);
                                  setPaymentModeSearchTerm('');
                                }}
                                className={`px-4 py-2 cursor-pointer hover:bg-blue-50 active:bg-blue-100 active:scale-[0.98] transition-all duration-150 ${
                                  formData.paymentMode === mode ? 'bg-blue-100 text-blue-700' : 'text-gray-900'
                                }`}
                              >
                                {mode}
                              </div>
                            ))}
                          {paymentModes.filter((mode) =>
                            mode.toLowerCase().includes(paymentModeSearchTerm.toLowerCase())
                          ).length === 0 && (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">
                              No payment modes found
                            </div>
                          )}
                          <div className="border-t border-gray-200 mt-1">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowPaymentModeDropdown(false);
                                setPaymentModeSearchTerm('');
                                // Navigate to masters page with payment mode tab
                                navigate('/expenses/masters', {
                                  state: {
                                    activeTab: 'payment-mode',
                                    returnTo: location.pathname,
                                    returnState: { showExpenseForm: true, editingExpense: expense }
                                  }
                                });
                              }}
                              className="px-4 py-2 cursor-pointer hover:bg-blue-50 active:bg-blue-100 active:scale-[0.98] transition-all duration-150 text-blue-600 font-semibold flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Add New Payment Mode
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    type="hidden"
                    name="paymentMode"
                    value={formData.paymentMode}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Department<span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="relative" ref={departmentDropdownRef}>
                    <div
                      onClick={() => {
                        setShowDepartmentDropdown(!showDepartmentDropdown);
                        if (!showDepartmentDropdown) {
                          setDepartmentSearchTerm('');
                        }
                      }}
                      className="select-field w-full text-sm py-2.5 cursor-pointer flex items-center justify-between"
                    >
                      <span className={formData.department ? 'text-gray-900' : 'text-gray-400'}>
                        {formData.department || 'Select'}
                      </span>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${showDepartmentDropdown ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    {showDepartmentDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                        {/* Search Input */}
                        <div className="p-2 border-b border-gray-200">
                          <div className="relative">
                            <input
                              type="text"
                              value={departmentSearchTerm}
                              onChange={(e) => setDepartmentSearchTerm(e.target.value)}
                              placeholder="Search departments..."
                              className="w-full px-3 py-2 pl-9 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                            <svg
                              className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            {departmentSearchTerm && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDepartmentSearchTerm('');
                                }}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 active:text-gray-800 active:scale-90 focus:outline-none focus:ring-2 focus:ring-gray-400 rounded transition-all duration-150"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Departments List */}
                        <div className="overflow-y-auto max-h-48 py-1">
                          {departments
                            .filter((dept) =>
                              dept.toLowerCase().includes(departmentSearchTerm.toLowerCase())
                            )
                            .map((dept) => (
                              <div
                                key={dept}
                                onClick={() => {
                                  setFormData({ ...formData, department: dept });
                                  setShowDepartmentDropdown(false);
                                  setDepartmentSearchTerm('');
                                }}
                                className={`px-4 py-2 cursor-pointer hover:bg-blue-50 active:bg-blue-100 active:scale-[0.98] transition-all duration-150 ${
                                  formData.department === dept ? 'bg-blue-100 text-blue-700' : 'text-gray-900'
                                }`}
                              >
                                {dept}
                              </div>
                            ))}
                          {departments.filter((dept) =>
                            dept.toLowerCase().includes(departmentSearchTerm.toLowerCase())
                          ).length === 0 && (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">
                              {departmentSearchTerm ? 'No departments found' : 'No departments available'}
                            </div>
                          )}
                          {/* Allow manual entry and Add New */}
                          <div className="border-t border-gray-200 mt-1 space-y-1">
                            {departmentSearchTerm && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const manualDept = departmentSearchTerm.trim();
                                  if (manualDept) {
                                    setFormData({ ...formData, department: manualDept });
                                    setShowDepartmentDropdown(false);
                                    setDepartmentSearchTerm('');
                                  }
                                }}
                                className="px-4 py-2 cursor-pointer hover:bg-blue-50 active:bg-blue-100 active:scale-[0.98] transition-all duration-150 text-blue-600 font-semibold flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Use "{departmentSearchTerm}"
                              </div>
                            )}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDepartmentDropdown(false);
                                setDepartmentSearchTerm('');
                                // Navigate to masters page with department tab
                                navigate('/expenses/masters', {
                                  state: {
                                    activeTab: 'department',
                                    returnTo: location.pathname,
                                    returnState: { showExpenseForm: true, editingExpense: expense }
                                  }
                                });
                              }}
                              className="px-4 py-2 cursor-pointer hover:bg-blue-50 active:bg-blue-100 active:scale-[0.98] transition-all duration-150 text-blue-600 font-semibold flex items-center gap-2 border-t border-gray-200"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Add New Department
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    type="hidden"
                    name="department"
                    value={formData.department}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Bank Account</label>
                  <div className="relative" ref={bankAccountDropdownRef}>
                    <div
                      onClick={() => {
                        setShowBankAccountDropdown(!showBankAccountDropdown);
                        if (!showBankAccountDropdown) {
                          setBankAccountSearchTerm('');
                        }
                      }}
                      className="select-field w-full text-sm py-2.5 cursor-pointer flex items-center justify-between"
                    >
                      <span className={formData.bankAccount ? 'text-gray-900' : 'text-gray-400'}>
                        {formData.bankAccount || 'Select bank account'}
                      </span>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${showBankAccountDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    {showBankAccountDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                        {/* Search Input */}
                        <div className="p-2 border-b border-gray-200">
                          <div className="relative">
                            <input
                              type="text"
                              value={bankAccountSearchTerm}
                              onChange={(e) => setBankAccountSearchTerm(e.target.value)}
                              placeholder="Search bank accounts..."
                              className="w-full px-3 py-2 pl-9 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                            <svg
                              className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            {bankAccountSearchTerm && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBankAccountSearchTerm('');
                                }}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 active:text-gray-800 active:scale-90 focus:outline-none focus:ring-2 focus:ring-gray-400 rounded transition-all duration-150"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Bank Accounts List */}
                        <div className="overflow-y-auto max-h-48 py-1">
                          {bankAccounts
                            .filter((account) =>
                              account.toLowerCase().includes(bankAccountSearchTerm.toLowerCase())
                            )
                            .map((account) => (
                              <div
                                key={account}
                                onClick={() => {
                                  setFormData({ ...formData, bankAccount: account });
                                  setShowBankAccountDropdown(false);
                                  setBankAccountSearchTerm('');
                                }}
                                className={`px-4 py-2.5 cursor-pointer hover:bg-blue-50 active:bg-blue-100 active:scale-[0.98] transition-all duration-150 ${
                                  formData.bankAccount === account ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                                }`}
                              >
                                {account}
                              </div>
                            ))}
                          {bankAccounts.filter((account) =>
                            account.toLowerCase().includes(bankAccountSearchTerm.toLowerCase())
                          ).length === 0 && (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">
                              No bank accounts found
                            </div>
                          )}
                          <div className="border-t border-gray-200 mt-1">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowBankAccountDropdown(false);
                                setBankAccountSearchTerm('');
                                // Navigate to masters page with bank account tab
                                navigate('/expenses/masters', {
                                  state: {
                                    activeTab: 'bank-account',
                                    returnTo: location.pathname,
                                    returnState: { showExpenseForm: true, editingExpense: expense }
                                  }
                                });
                              }}
                              className="px-4 py-2 cursor-pointer hover:bg-blue-50 active:bg-blue-100 active:scale-[0.98] transition-all duration-150 text-blue-600 font-semibold flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Add New Bank Account
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Information Section */}
            <div className="space-y-5">
              <h3 className="text-base font-bold text-gray-800 uppercase tracking-wider mb-4">Payment Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Status<span className="text-red-500 ml-1">*</span>
                  </label>
                  <MobileSelect
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    required
                    disabled={!expense}
                    className={`select-field w-full text-sm py-2.5 ${!expense ? 'bg-gray-50 cursor-not-allowed opacity-70' : ''}`}
                    title={!expense ? 'Status is automatically set to "Unpaid" for new expenses' : ''}
                  >
                    <option value="Unpaid">Unpaid</option>
                    <option value="Partial">Partial</option>
                    <option value="Paid">Paid</option>
                    <option value="Cancel">Cancel</option>
                  </MobileSelect>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Paid Amount</label>
                  <input
                    type="number"
                    name="paidAmount"
                    value={formData.paidAmount}
                    onChange={handleChange}
                    onKeyDown={handleNumberInputKeyDown}
                    onWheel={handleNumberInputWheel}
                    step="0.01"
                    placeholder="0.00"
                    className="input-field w-full text-sm py-2.5"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Balance (Due Amount)</label>
                  <input
                    type="text"
                    value={balance.toFixed(2)}
                    readOnly
                    className="input-field w-full text-sm py-2.5 bg-gray-50 cursor-not-allowed font-semibold text-red-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
          </div>

          {/* Footer Actions */}
          <div className="border-t border-gray-200 px-8 py-5 bg-white flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCancelInternal}
              className="px-6 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 active:bg-gray-300 active:scale-95 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all duration-150 text-sm shadow-sm hover:shadow-md active:shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 active:bg-blue-800 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-150 text-sm shadow-md hover:shadow-lg active:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647A7.962 7.962 0 0112 20c0-4.418-3.582-8-8-8z"></path>
                  </svg>
                  {expense ? 'Updating...' : 'Creating...'}
                </span>
              ) : (
                expense ? 'Update Expense' : 'Create Expense'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExpenseForm;
