import { useState, useEffect } from 'react';
import { paymentAPI, customerAPI, invoiceAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useCurrency } from '../contexts/CurrencyContext';
import MobileSelect from './MobileSelect';
import DepartmentSplitModal from './DepartmentSplitModal';
import { calculatePaymentAmounts, formatCurrency, convertToINR, getCurrencySymbol } from '../utils/currencyConverter';

const PaymentModal = ({ isOpen, onClose, invoice, payment, mode = 'edit', onPaymentRecorded }) => {
  const { showToast } = useToast();
  const { exchangeRates, isReady: currencyReady } = useCurrency();
  const [activeTab, setActiveTab] = useState('basic'); // 'basic', 'tax', 'email'
  const [formData, setFormData] = useState({
    customer: '',
    userEmail: '',
    paymentDate: '',
    paymentReceivedOn: '',
    paymentMode: 'Cash',
    depositTo: 'Petty Cash',
    referenceNumber: '',
    amountReceived: '',
    bankCharges: '',
    taxDeducted: false,
    tdsType: '',
    amountWithheld: '',
    tdsTaxAccount: 'Advance Tax',
    notes: '',
    status: 'Paid',
    sendThankYouNote: false,
    emailRecipients: [],
  });
  const [editingPayment, setEditingPayment] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(invoice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableEmails, setAvailableEmails] = useState([]);
  const [customEmails, setCustomEmails] = useState([]);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [paymentAmounts, setPaymentAmounts] = useState(null);
  const [calculatingAmounts, setCalculatingAmounts] = useState(false);
  
  // Department split state
  const [showDepartmentSplitModal, setShowDepartmentSplitModal] = useState(false);
  const [departmentSplits, setDepartmentSplits] = useState([]);
  const [hasDepartmentSplit, setHasDepartmentSplit] = useState(false);

  // Helper function to calculate payment amounts with live rates
  const calculatePaymentAmountsWithLiveRates = async (invoiceData) => {
    if (!invoiceData || !currencyReady) return null;
    
    try {
      setCalculatingAmounts(true);
      const amounts = await calculatePaymentAmounts(invoiceData, exchangeRates);
      return amounts;
    } catch (error) {
      console.error('Error calculating payment amounts:', error);
      // Fallback to synchronous calculation
      return calculatePaymentAmounts(invoiceData);
    } finally {
      setCalculatingAmounts(false);
    }
  };

  const paymentModes = ['Cash', 'Bank Transfer', 'Bank Remittance', 'Cheque', 'Credit Card', 'UPI', 'Zoho Payments'];
  const depositAccounts = ['Petty Cash', 'Bank Account', 'Cash Account', 'Other'];
  const tdsTaxAccounts = ['Advance Tax', 'TDS Payable', 'TDS Receivable'];

  useEffect(() => {
    if (isOpen) {
      // Check if invoice is voided
      if (invoice && invoice.status === 'Void') {
        showToast('Cannot record payment for a voided invoice', 'error');
        onClose();
        return;
      }
      fetchCustomers();
      fetchInvoices();
      
        if (payment) {
        setEditingPayment(payment);
        const paymentDate = payment.paymentDate ? new Date(payment.paymentDate).toISOString().split('T')[0] : '';
        const paymentReceivedOn = payment.paymentReceivedOn ? new Date(payment.paymentReceivedOn).toISOString().split('T')[0] : '';
        
        setFormData({
          customer: payment.customer?._id || payment.customer || '',
          userEmail: payment.userEmail || '',
          paymentDate: paymentDate || new Date().toISOString().split('T')[0],
          paymentReceivedOn: paymentReceivedOn || '',
          paymentMode: payment.paymentMode || 'Cash',
          depositTo: payment.depositTo || 'Petty Cash',
          referenceNumber: payment.referenceNumber || '',
          amountReceived: payment.amountReceived || '',
          bankCharges: payment.bankCharges || '',
          taxDeducted: payment.taxDeducted || false,
          tdsType: payment.tdsType || '',
          amountWithheld: payment.amountWithheld || '',
          tdsTaxAccount: payment.tdsTaxAccount || 'Advance Tax',
          notes: payment.notes || '',
          status: payment.status || 'Paid',
          sendThankYouNote: payment.sendThankYouNote || false,
          emailRecipients: payment.emailRecipients || [],
        });
        
        // Load department splits if they exist
        if (payment.hasDepartmentSplit && payment.departmentSplits) {
          setDepartmentSplits(payment.departmentSplits);
          setHasDepartmentSplit(true);
        } else {
          setDepartmentSplits([]);
          setHasDepartmentSplit(false);
        }
        
        setSelectedInvoice(payment.invoice);
      } else {
        setCustomEmails([]);
        setEditingPayment(null);
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        setFormData({
          customer: '',
          paymentDate: formattedDate,
          paymentReceivedOn: '',
          paymentMode: 'Cash',
          depositTo: 'Petty Cash',
          referenceNumber: '',
          amountReceived: '',
          bankCharges: '',
          taxDeducted: false,
          tdsType: '',
          amountWithheld: '',
          tdsTaxAccount: 'Advance Tax',
          notes: '',
          status: 'Draft',
          sendThankYouNote: false,
          emailRecipients: [],
        });

        if (invoice) {
          setSelectedInvoice(invoice);
          
          // Calculate amounts with live rates
          calculatePaymentAmountsWithLiveRates(invoice).then(amounts => {
            setPaymentAmounts(amounts);
            
            console.log('💰 Payment amounts calculated:', amounts);
            
            if (amounts && amounts.inrAmount > 0) {
              setFormData(prev => ({
                ...prev,
                amountReceived: amounts.inrAmount.toFixed(2),
              }));
            }
          });
        }
      }
    }
  }, [isOpen, invoice, payment]);

  useEffect(() => {
    if (customers.length > 0 && isOpen) {
      if (editingPayment && editingPayment.customer) {
        const customerId = editingPayment.customer?._id || editingPayment.customer;
        handleCustomerSelect(customerId);
      } else if (!editingPayment && invoice) {
        const clientName = invoice.clientDetails?.name;
        if (clientName) {
          const matchingCustomer = customers.find(c => 
            (c.displayName || c.companyName || c.clientName) === clientName
          );
          if (matchingCustomer) {
            setFormData(prev => ({
              ...prev,
              customer: matchingCustomer._id,
            }));
            handleCustomerSelect(matchingCustomer._id);
          }
        }
      }
    }
  }, [customers, isOpen, editingPayment, invoice]);

  const fetchCustomers = async () => {
    try {
      const response = await customerAPI.getAll();
      setCustomers(response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchInvoices = async () => {
    try {
      const response = await invoiceAPI.getAll();
      setInvoices(response.data);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  // Filter invoices with remaining amounts (using live rates)
  useEffect(() => {
    if (!currencyReady || invoices.length === 0) return;

    const filterInvoicesWithAmounts = async () => {
      const filtered = [];
      
      for (const inv of invoices) {
        try {
          const amounts = await calculatePaymentAmountsWithLiveRates(inv);
          if (amounts && amounts.inrAmount > 0) {
            filtered.push({ ...inv, calculatedAmounts: amounts });
          }
        } catch (error) {
          console.warn('Error calculating amounts for invoice:', inv.invoiceNumber, error);
        }
      }
      
      setFilteredInvoices(filtered);
    };

    filterInvoicesWithAmounts();
  }, [invoices, currencyReady, exchangeRates]);

  const handleCustomerSelect = (customerId) => {
    const customer = customers.find(c => c._id === customerId);
    if (customer) {
      setSelectedCustomer(customer);
      setFormData(prev => ({
        ...prev,
        customer: customerId,
        userEmail: customer.email || prev.userEmail,
      }));

      const emails = [];
        if (customer.email) emails.push(customer.email);
      if (customer.contactPersons && customer.contactPersons.length > 0) {
        customer.contactPersons.forEach(person => {
          if (person.email) emails.push(person.email);
        });
      }
      setAvailableEmails(emails);
      
      // Load custom emails from payment if editing
      if (editingPayment && editingPayment.emailRecipients) {
        const custom = editingPayment.emailRecipients.filter(e => !emails.includes(e));
        setCustomEmails(custom);
      }
    }
  };

  const handleInvoiceSelect = async (invoiceId) => {
    const inv = invoices.find(i => i._id === invoiceId);
    if (inv) {
      setSelectedInvoice(inv);
      
      // Calculate amounts with live rates
      const amounts = await calculatePaymentAmountsWithLiveRates(inv);
      setPaymentAmounts(amounts);
      
      if (inv.customer) {
        const customerId = inv.customer._id || inv.customer;
        const customer = customers.find(c => c._id === customerId);
        if (customer) {
          handleCustomerSelect(customerId);
        }
      } else if (inv.clientDetails?.name) {
        const matchingCustomer = customers.find(c => {
          const customerName = c.displayName || c.companyName || c.clientName;
          return customerName === inv.clientDetails.name;
        });
        if (matchingCustomer) {
          handleCustomerSelect(matchingCustomer._id);
        }
      }

      if (amounts && amounts.inrAmount > 0) {
        setFormData(prev => ({
          ...prev,
          amountReceived: amounts.inrAmount.toFixed(2),
        }));
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (name === 'taxDeducted' && !checked) {
      setFormData(prev => ({
        ...prev,
        tdsType: '',
        amountWithheld: '',
        tdsTaxAccount: 'Advance Tax',
      }));
    }
  };

  const handleEmailRecipientToggle = (email) => {
    setFormData(prev => ({
      ...prev,
      emailRecipients: prev.emailRecipients.includes(email)
        ? prev.emailRecipients.filter(e => e !== email)
        : [...prev.emailRecipients, email],
    }));
  };

  const handleAddCustomEmail = () => {
    const email = newEmailInput.trim();
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (customEmails.includes(email) || availableEmails.includes(email)) {
      setError('This email is already added');
      return;
    }

    setCustomEmails([...customEmails, email]);
    setNewEmailInput('');
    setError('');
  };

  const handleRemoveCustomEmail = (email) => {
    setCustomEmails(customEmails.filter(e => e !== email));
    setFormData(prev => ({
      ...prev,
      emailRecipients: prev.emailRecipients.filter(e => e !== email),
    }));
  };

  const allAvailableEmails = [...availableEmails, ...customEmails];

  // Department split handlers
  const handleDepartmentSplitSave = (splits) => {
    setDepartmentSplits(splits);
    setHasDepartmentSplit(true);
    
    // Calculate total amount from splits and round to 2 decimal places
    const totalAmount = splits.reduce((sum, split) => sum + parseFloat(split.amount || 0), 0);
    const roundedTotal = Math.round(totalAmount * 100) / 100;
    
    setFormData(prev => ({
      ...prev,
      amountReceived: roundedTotal.toFixed(2)
    }));
  };

  const handleRemoveDepartmentSplit = () => {
    setDepartmentSplits([]);
    setHasDepartmentSplit(false);
    
    // Reset amount to original if available
    if (paymentAmounts && paymentAmounts.inrAmount > 0) {
      setFormData(prev => ({
        ...prev,
        amountReceived: paymentAmounts.inrAmount.toFixed(2)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        amountReceived: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.customer) {
        setError('Please select a customer');
        setLoading(false);
        return;
      }

      if (!formData.userEmail || !formData.userEmail.trim()) {
        setError('Please enter user email address');
        setLoading(false);
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.userEmail)) {
        setError('Please enter a valid email address');
        setLoading(false);
        return;
      }

      if (!selectedInvoice) {
        setError('Please select an invoice');
        setLoading(false);
        return;
      }

      const amountReceived = parseFloat(formData.amountReceived);
      if (isNaN(amountReceived) || amountReceived <= 0) {
        setError('Please enter a valid amount received');
        setLoading(false);
        return;
      }

      // Use converted amounts for validation
      const amounts = paymentAmounts || await calculatePaymentAmountsWithLiveRates(selectedInvoice);
      const maxAllowedAmount = amounts ? amounts.inrAmount : 0;

      if (amountReceived > maxAllowedAmount) {
        const maxFormatted = formatCurrency(maxAllowedAmount, 'INR');
        setError(`Amount cannot exceed remaining amount of ${maxFormatted}`);
        setLoading(false);
        return;
      }

      if (formData.taxDeducted && (!formData.amountWithheld || parseFloat(formData.amountWithheld) <= 0)) {
        setError('Please enter amount withheld when tax is deducted');
        setLoading(false);
        return;
      }

      // Department split validation
      if (hasDepartmentSplit) {
        if (!departmentSplits || departmentSplits.length === 0) {
          setError('Please add at least one department split');
          setLoading(false);
          return;
        }

        const totalSplitAmount = departmentSplits.reduce((sum, split) => sum + parseFloat(split.amount || 0), 0);
        const roundedSplitTotal = Math.round(totalSplitAmount * 100) / 100;
        
        // Determine the maximum allowed amount based on currency type
        const isNonINR = paymentAmounts && paymentAmounts.isConversionNeeded;
        const maxAllowedForSplits = isNonINR 
          ? Math.round((paymentAmounts?.inrAmount || 0) * 100) / 100  // Use converted amount for non-INR
          : Math.round((selectedInvoice?.amountDetails?.receivableAmount || selectedInvoice?.grandTotal || 0) * 100) / 100; // Use invoice amount for INR

        // Check if department split total exceeds the allowed amount
        if (roundedSplitTotal > maxAllowedForSplits) {
          const currencyLabel = isNonINR ? 'Converted Amount' : 'Invoice Amount';
          setError(`Department split total (₹${roundedSplitTotal.toFixed(2)}) exceeds ${currencyLabel} (₹${maxAllowedForSplits.toFixed(2)}). Please adjust your department splits.`);
          setLoading(false);
          return;
        }

        if (roundedSplitTotal === 0) {
          setError('Department split total cannot be zero');
          setLoading(false);
          return;
        }

        // Validate all department names are provided
        const invalidSplits = departmentSplits.filter(split => 
          !split.departmentName || !split.departmentName.trim() || parseFloat(split.amount || 0) <= 0
        );
        if (invalidSplits.length > 0) {
          setError('All department splits must have a valid department name and amount greater than 0');
          setLoading(false);
          return;
        }
      }

      const paymentData = {
        invoice: selectedInvoice._id,
        customer: formData.customer,
        userEmail: formData.userEmail.trim(),
        paymentDate: formData.paymentDate,
        paymentReceivedOn: formData.paymentReceivedOn || formData.paymentDate,
        paymentMode: formData.paymentMode,
        depositTo: formData.depositTo,
        referenceNumber: formData.referenceNumber,
        amountReceived: amountReceived,
        bankCharges: parseFloat(formData.bankCharges) || 0,
        taxDeducted: formData.taxDeducted,
        tdsType: formData.taxDeducted ? (formData.tdsType || 'TDS (Income Tax)') : '',
        amountWithheld: parseFloat(formData.amountWithheld) || 0,
        tdsTaxAccount: formData.tdsTaxAccount,
        notes: formData.notes,
        status: 'Paid',
        sendThankYouNote: formData.sendThankYouNote,
        emailRecipients: formData.emailRecipients,
        // Department split data
        hasDepartmentSplit: hasDepartmentSplit,
        departmentSplits: hasDepartmentSplit ? departmentSplits : [],
      };

      let response;
      if (editingPayment) {
        response = await paymentAPI.update(editingPayment._id, paymentData);
      } else {
        response = await paymentAPI.create(paymentData);
      }

      if (response.data) {
        showToast(`Payment ${editingPayment ? 'updated' : 'recorded'} successfully!`, 'success');
        if (onPaymentRecorded) {
          onPaymentRecorded(response.data);
        }
        handleClose();
      }
    } catch (error) {
      console.error('Error saving payment:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save payment';
      setError(errorMessage);
      showToast(`Payment Error: ${errorMessage}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      customer: '',
      userEmail: '',
      paymentDate: '',
      paymentReceivedOn: '',
      paymentMode: 'Cash',
      depositTo: 'Petty Cash',
      referenceNumber: '',
      amountReceived: '',
      bankCharges: '',
      taxDeducted: false,
      tdsType: '',
      amountWithheld: '',
      tdsTaxAccount: 'Advance Tax',
      notes: '',
      status: 'Paid',
      sendThankYouNote: false,
      emailRecipients: [],
    });
    setSelectedCustomer(null);
    setSelectedInvoice(invoice);
    setEditingPayment(null);
    setError('');
    setCustomEmails([]);
    setNewEmailInput('');
    setPaymentAmounts(null);
    setDepartmentSplits([]);
    setHasDepartmentSplit(false);
    onClose();
  };

  if (!isOpen) return null;

  // Calculate amounts using currency conversion
  const amounts = paymentAmounts || (selectedInvoice ? null : null); // Will be calculated async
  const remainingAmount = amounts ? amounts.inrAmount : 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto p-4" onClick={mode === 'view' ? handleClose : undefined}>
      <div className={`bg-white rounded-2xl shadow-2xl ${mode === 'view' ? 'max-w-4xl' : 'max-w-5xl'} w-full mx-auto my-auto max-h-[90vh] overflow-hidden flex flex-col`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`${mode === 'view' ? 'bg-gradient-to-r from-emerald-600 to-emerald-700' : 'bg-gradient-to-r from-blue-600 to-blue-700'} text-white px-6 py-4 flex-shrink-0 rounded-t-2xl`}>
          <div className="flex justify-between items-center">
            {mode === 'view' ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Payment #{editingPayment?.paymentNumber}</h2>
                  <p className="text-sm text-white/90 mt-0.5">
                    {formData.paymentDate ? new Date(formData.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {editingPayment 
                      ? `Edit Payment - ${editingPayment.paymentNumber}`
                      : selectedInvoice 
                        ? `Payment for ${selectedInvoice.invoiceNumber}` 
                        : 'Record Payment'}
                  </h2>
                  {selectedInvoice && (
                    <p className="text-sm text-white/90 mt-0.5">
                      Balance Due: {paymentAmounts ? formatCurrency(paymentAmounts.inrAmount, 'INR') : '₹0.00'}
                      {paymentAmounts && paymentAmounts.isConversionNeeded && (
                        <span className="text-xs block">
                          ({formatCurrency(paymentAmounts.originalAmount, paymentAmounts.invoiceCurrency)} @ ₹{paymentAmounts.exchangeRate})
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg text-white hover:bg-white/20 flex items-center justify-center transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className={`flex-1 overflow-y-auto ${mode === 'view' ? 'p-6 bg-gradient-to-br from-slate-50 to-white' : 'p-6 bg-gradient-to-br from-slate-50 to-white'}`}>
          {mode === 'view' ? (
            <div className="space-y-4">
              {/* Quick Info Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</div>
                  <div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-700">
                      {formData.status || 'Paid'}
                    </span>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Amount</div>
                  <div className="text-sm font-bold text-slate-900">
                    ₹{(parseFloat(formData.amountReceived) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Payment Mode</div>
                  <div className="text-sm font-semibold text-slate-900">{formData.paymentMode || '-'}</div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Deposit To</div>
                  <div className="text-sm font-semibold text-slate-900">{formData.depositTo || '-'}</div>
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Customer & Invoice Info - Left Column */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <h3 className="text-sm font-bold text-slate-900">Customer</h3>
                    </div>
                    <div className="space-y-2.5">
                      <div>
                        <div className="text-xs font-semibold text-slate-500 mb-0.5">Name</div>
                        <div className="text-sm font-semibold text-slate-900">
                          {selectedCustomer ? (selectedCustomer.displayName || selectedCustomer.companyName || selectedCustomer.clientName) : '-'}
                        </div>
                      </div>
                      {selectedCustomer?.pan && (
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-0.5">PAN</div>
                          <div className="text-xs text-slate-700">{selectedCustomer.pan}</div>
                        </div>
                      )}
                      {formData.userEmail && (
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-0.5">Email</div>
                          <div className="text-xs text-slate-700 break-all">{formData.userEmail}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedInvoice && (
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="text-sm font-bold text-slate-900">Invoice</h3>
                      </div>
                      <div className="space-y-2.5">
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-0.5">Invoice Number</div>
                          <div className="text-sm font-semibold text-slate-900">{selectedInvoice.invoiceNumber || '-'}</div>
                        </div>
                        {selectedInvoice.invoiceDate && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">Invoice Date</div>
                            <div className="text-xs text-slate-700">
                              {new Date(selectedInvoice.invoiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Details - Right Column */}
                <div className="lg:col-span-2 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-sm font-bold text-slate-900">Payment Details</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">Payment Date</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {formData.paymentDate ? new Date(formData.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                      </div>
                    </div>
                    {formData.paymentReceivedOn && (
                      <div>
                        <div className="text-xs font-semibold text-slate-500 mb-1">Received On</div>
                        <div className="text-sm font-semibold text-slate-900">
                          {new Date(formData.paymentReceivedOn).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    )}
                    {formData.referenceNumber && (
                      <div>
                        <div className="text-xs font-semibold text-slate-500 mb-1">Reference #</div>
                        <div className="text-sm font-semibold text-slate-900">{formData.referenceNumber}</div>
                      </div>
                    )}
                    {(parseFloat(formData.bankCharges) || 0) > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-500 mb-1">Bank Charges</div>
                        <div className="text-sm font-semibold text-slate-900">
                          ₹{(parseFloat(formData.bankCharges) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    )}
                    {formData.taxDeducted && (
                      <>
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-1">TDS Type</div>
                          <div className="text-sm font-semibold text-slate-900">{formData.tdsType || '-'}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-1">Amount Withheld</div>
                          <div className="text-sm font-semibold text-slate-900">
                            ₹{(parseFloat(formData.amountWithheld) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-1">TDS Tax Account</div>
                          <div className="text-sm font-semibold text-slate-900">{formData.tdsTaxAccount || '-'}</div>
                        </div>
                      </>
                    )}
                    {formData.notes && (
                      <div className="col-span-2 md:col-span-3 pt-2 mt-2 border-t border-slate-200">
                        <div className="text-xs font-semibold text-slate-500 mb-1">Notes</div>
                        <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded">{formData.notes}</div>
                      </div>
                    )}
                    {formData.sendThankYouNote && formData.emailRecipients && formData.emailRecipients.length > 0 && (
                      <div className="col-span-2 md:col-span-3 pt-2 mt-2 border-t border-slate-200">
                        <div className="text-xs font-semibold text-slate-500 mb-1">Email Recipients</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {formData.emailRecipients.map((email, idx) => (
                            <span key={idx} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-md">
                              {email}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end pt-4 mt-4 border-t border-slate-200">
                <button
                  onClick={handleClose}
                  className="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-semibold text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tabs Navigation */}
              <div className="border-b border-slate-200 bg-white">
                <div className="flex space-x-1 px-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('basic')}
                    className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                      activeTab === 'basic'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Basic Details
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('tax')}
                    className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                      activeTab === 'tax'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Tax & Charges
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('email')}
                    className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                      activeTab === 'email'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Email Notification
                    </div>
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              <div className="min-h-[350px]">
                {/* Basic Details Tab */}
                {activeTab === 'basic' && (
                  <div className="space-y-3">
                    {/* Customer & Invoice - Compact Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Customer Name <span className="text-red-500">*</span>
                        </label>
                        <MobileSelect
                          name="customer"
                          value={formData.customer || ''}
                          onChange={(e) => handleCustomerSelect(e.target.value)}
                          className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium bg-white text-slate-900 transition-all hover:border-slate-400"
                          required
                        >
                          <option value="">Select Customer</option>
                          {customers.map(customer => (
                            <option key={customer._id} value={customer._id}>
                              {customer.displayName || customer.companyName || customer.clientName}
                            </option>
                          ))}
                        </MobileSelect>
                        {selectedCustomer && selectedCustomer.pan && (
                          <p className="mt-1.5 text-xs text-slate-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 inline-block">
                            PAN: <span className="font-semibold text-blue-700">{selectedCustomer.pan}</span>
                          </p>
                        )}
                      </div>

                      {!invoice && (
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Invoice <span className="text-red-500">*</span>
                          </label>
                          <MobileSelect
                            value={selectedInvoice?._id || ''}
                            onChange={(e) => handleInvoiceSelect(e.target.value)}
                            className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium bg-white text-slate-900 transition-all hover:border-slate-400"
                            required
                          >
                            <option value="">Select Invoice</option>
                            {filteredInvoices.map(inv => {
                              const amounts = inv.calculatedAmounts;
                              return (
                                <option key={inv._id} value={inv._id}>
                                  {inv.invoiceNumber} - {formatCurrency(amounts.inrAmount, 'INR')}
                                  {amounts.isConversionNeeded && ` (${formatCurrency(amounts.originalAmount, amounts.invoiceCurrency)})`}
                                </option>
                              );
                            })}
                          </MobileSelect>
                        </div>
                      )}

                      {editingPayment && (
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                            </svg>
                            Payment #
                          </label>
                          <input
                            type="text"
                            value={editingPayment.paymentNumber || 'N/A'}
                            className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-semibold cursor-not-allowed"
                            disabled
                          />
                        </div>
                      )}
                    </div>

                    {/* Payment Amount - Compact Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Amount Received (INR) <span className="text-red-500">*</span>
                        </label>
                        
                        {/* Show original currency info if conversion is needed */}
                        {paymentAmounts && paymentAmounts.isConversionNeeded && (
                          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-600">Invoice Amount:</span>
                              <span className="font-semibold text-slate-900">
                                {formatCurrency(paymentAmounts.originalAmount, paymentAmounts.invoiceCurrency)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm mt-1">
                              <span className="text-slate-600">Exchange Rate:</span>
                              <span className="font-semibold text-slate-900">
                                1 {paymentAmounts.invoiceCurrency} = ₹{paymentAmounts.exchangeRate}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm mt-1 pt-2 border-t border-blue-300">
                              <span className="text-slate-600">Converted Amount:</span>
                              <span className="font-bold text-blue-700">
                                {formatCurrency(paymentAmounts.inrAmount, 'INR')}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {/* Department Split Display */}
                        {hasDepartmentSplit && departmentSplits.length > 0 && (
                          <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                                <span className="text-sm font-semibold text-purple-700">Department Split Active</span>
                              </div>
                              <button
                                type="button"
                                onClick={handleRemoveDepartmentSplit}
                                className="text-xs text-red-600 hover:text-red-700 font-medium"
                              >
                                Remove Split
                              </button>
                            </div>
                            <div className="space-y-1">
                              {departmentSplits.map((split, index) => (
                                <div key={index} className="flex justify-between text-xs">
                                  <span className="text-slate-600">{split.departmentName || `Department ${index + 1}`}:</span>
                                  <span className="font-semibold text-slate-900">₹{parseFloat(split.amount || 0).toFixed(2)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between text-sm font-bold text-purple-700 pt-1 border-t border-purple-300">
                                <span>Total:</span>
                                <span>₹{departmentSplits.reduce((sum, split) => sum + parseFloat(split.amount || 0), 0).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="relative flex">
                          <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-semibold z-10">₹</span>
                          <input
                            type="number"
                            name="amountReceived"
                            value={formData.amountReceived || ''}
                            onChange={hasDepartmentSplit ? undefined : handleInputChange}
                            step="0.01"
                            min="0.01"
                            max={paymentAmounts ? paymentAmounts.inrAmount : remainingAmount}
                            className={`flex-1 pl-8 pr-4 py-2.5 border-2 rounded-l-lg focus:ring-2 font-semibold text-lg transition-all ${
                              hasDepartmentSplit 
                                ? 'bg-slate-100 border-slate-300 text-slate-600 cursor-not-allowed' 
                                : 'bg-white border-slate-300 text-slate-900 hover:border-slate-400 focus:ring-blue-500 focus:border-blue-500'
                            }`}
                            required
                            placeholder="0.00"
                            readOnly={hasDepartmentSplit}
                            title={hasDepartmentSplit ? 'Amount is auto-calculated from department splits' : 'Enter payment amount'}
                          />
                          <button
                            type="button"
                            onClick={() => setShowDepartmentSplitModal(true)}
                            className="px-3 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-r-lg border-2 border-purple-600 hover:border-purple-700 transition-all shadow-sm flex items-center justify-center"
                            title="Split by Department"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                        
                        {paymentAmounts && paymentAmounts.inrAmount > 0 && (
                          <p className="mt-1.5 text-xs text-slate-600">
                            {hasDepartmentSplit ? (
                              // Show remaining based on department splits
                              (() => {
                                const departmentTotal = departmentSplits.reduce((sum, split) => sum + parseFloat(split.amount || 0), 0);
                                const isNonINR = paymentAmounts.isConversionNeeded;
                                const maxAmount = isNonINR ? paymentAmounts.inrAmount : (selectedInvoice?.amountDetails?.receivableAmount || selectedInvoice?.grandTotal || 0);
                                const remaining = maxAmount - departmentTotal;
                                
                                return (
                                  <>
                                    Remaining: <span className={`font-semibold ${remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                      {formatCurrency(remaining, 'INR')}
                                    </span>
                                    {isNonINR && (
                                      <span className="text-slate-500">
                                        {' '}(from {formatCurrency(paymentAmounts.inrAmount, 'INR')} converted)
                                      </span>
                                    )}
                                  </>
                                );
                              })()
                            ) : (
                              // Show normal remaining amount
                              <>
                                Remaining: <span className="font-semibold text-emerald-600">{formatCurrency(paymentAmounts.inrAmount, 'INR')}</span>
                                {paymentAmounts.isConversionNeeded && (
                                  <span className="text-slate-500">
                                    {' '}({formatCurrency(paymentAmounts.originalAmount, paymentAmounts.invoiceCurrency)})
                                  </span>
                                )}
                              </>
                            )}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          User Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          name="userEmail"
                          value={formData.userEmail || ''}
                          onChange={handleInputChange}
                          placeholder="Enter email to send payment slip"
                          className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900 transition-all hover:border-slate-400"
                          required
                        />
                      </div>
                    </div>

                    {/* Payment Details - Compact Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Payment Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          name="paymentDate"
                          value={formData.paymentDate || ''}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900 transition-all hover:border-slate-400"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                          Payment Mode
                        </label>
                        <MobileSelect
                          name="paymentMode"
                          value={formData.paymentMode || 'Cash'}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium bg-white text-slate-900 transition-all hover:border-slate-400"
                        >
                          {paymentModes.map(mode => (
                            <option key={mode} value={mode}>{mode}</option>
                          ))}
                        </MobileSelect>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          Deposit To <span className="text-red-500">*</span>
                        </label>
                        <MobileSelect
                          name="depositTo"
                          value={formData.depositTo || 'Petty Cash'}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium bg-white text-slate-900 transition-all hover:border-slate-400"
                          required
                        >
                          {depositAccounts.map(account => (
                            <option key={account} value={account}>{account}</option>
                          ))}
                        </MobileSelect>
                      </div>
                    </div>

                    {/* Additional Fields - Compact */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Payment Received On
                        </label>
                        <input
                          type="date"
                          name="paymentReceivedOn"
                          value={formData.paymentReceivedOn || ''}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900 transition-all hover:border-slate-400"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                          </svg>
                          Reference#
                        </label>
                        <input
                          type="text"
                          name="referenceNumber"
                          value={formData.referenceNumber}
                          onChange={handleInputChange}
                          placeholder="Enter reference number"
                          className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900 transition-all hover:border-slate-400"
                        />
                      </div>
                    </div>

                    {/* Notes - Compact */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Notes
                      </label>
                      <textarea
                        name="notes"
                        value={formData.notes || ''}
                        onChange={handleInputChange}
                        rows="2"
                        placeholder="Add any additional notes or comments..."
                        className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900 resize-none transition-all hover:border-slate-400"
                      />
                    </div>
                  </div>
                )}

                {/* Tax & Charges Tab */}
                {activeTab === 'tax' && (
                  <div className="space-y-3">
                    {/* Tax Deduction */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-3">
                        Tax deducted?
                      </label>
                      <div className="flex gap-6">
                        <label className="flex items-center cursor-pointer group">
                          <input
                            type="radio"
                            name="taxDeducted"
                            checked={!formData.taxDeducted}
                            onChange={() => setFormData(prev => ({ ...prev, taxDeducted: false }))}
                            className="mr-2 w-5 h-5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">No Tax deducted</span>
                        </label>
                        <label className="flex items-center cursor-pointer group">
                          <input
                            type="radio"
                            name="taxDeducted"
                            checked={formData.taxDeducted}
                            onChange={() => setFormData(prev => ({ ...prev, taxDeducted: true, tdsType: 'TDS (Income Tax)' }))}
                            className="mr-2 w-5 h-5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Yes, TDS (Income Tax)</span>
                        </label>
                      </div>
                    </div>

                    {/* TDS Details - Only show if tax is deducted */}
                    {formData.taxDeducted && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 bg-orange-50 p-3 rounded-lg border border-orange-100">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Amount Withheld <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-semibold">₹</span>
                            <input
                              type="number"
                              name="amountWithheld"
                              value={formData.amountWithheld}
                              onChange={handleInputChange}
                              step="0.01"
                              min="0"
                              className="w-full pl-8 pr-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900 transition-all hover:border-slate-400"
                              required={formData.taxDeducted}
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            TDS Tax Account <span className="text-red-500">*</span>
                          </label>
                          <MobileSelect
                            name="tdsTaxAccount"
                            value={formData.tdsTaxAccount || 'Advance Tax'}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium bg-white text-slate-900 transition-all hover:border-slate-400"
                            required={formData.taxDeducted}
                          >
                            {tdsTaxAccounts.map(account => (
                              <option key={account} value={account}>{account}</option>
                            ))}
                          </MobileSelect>
                        </div>
                      </div>
                    )}

                    {/* Bank Charges */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Bank Charges (if any)
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-semibold">₹</span>
                        <input
                          type="number"
                          name="bankCharges"
                          value={formData.bankCharges || ''}
                          onChange={handleInputChange}
                          step="0.01"
                          min="0"
                          className="w-full pl-8 pr-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900 transition-all hover:border-slate-400"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Email Notification Tab */}
                {activeTab === 'email' && (
                  <div className="space-y-3">
                    {/* Send Thank You Note */}
                    <div>
                      <label className="flex items-center cursor-pointer group p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                        <input
                          type="checkbox"
                          name="sendThankYouNote"
                          checked={formData.sendThankYouNote}
                          onChange={handleInputChange}
                          className="mr-3 w-5 h-5 text-blue-600 focus:ring-blue-500 rounded border-slate-300 cursor-pointer"
                        />
                        <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">
                          Send a 'Thank you' note for this payment
                        </span>
                      </label>
                    </div>

                    {formData.sendThankYouNote && (
                      <div className="space-y-4 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                        {/* Add Custom Email Section */}
                        <div className="border-b border-indigo-200 pb-3 mb-3">
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Add Email Address
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="email"
                              value={newEmailInput}
                              onChange={(e) => setNewEmailInput(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddCustomEmail();
                                }
                              }}
                              placeholder="Enter email address"
                              className="flex-1 px-3 py-2.5 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-slate-400"
                            />
                            <button
                              type="button"
                              onClick={handleAddCustomEmail}
                              className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                            >
                              Add
                            </button>
                          </div>
                        </div>

                        {/* Email List */}
                        {allAvailableEmails.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-600 mb-2">Select email recipients:</p>
                            {allAvailableEmails.map(email => (
                              <div key={email} className="flex items-center justify-between p-2 hover:bg-white rounded transition-colors">
                                <label className="flex items-center flex-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={formData.emailRecipients.includes(email)}
                                    onChange={() => handleEmailRecipientToggle(email)}
                                    className="mr-3 w-4 h-4 text-blue-600 focus:ring-blue-500 rounded border-slate-300 cursor-pointer"
                                  />
                                  <span className="text-sm font-medium text-slate-700">{email}</span>
                                </label>
                                {customEmails.includes(email) && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCustomEmail(email)}
                                    className="ml-2 text-red-600 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                                    title="Remove email"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {allAvailableEmails.length === 0 && (
                          <p className="text-sm text-slate-500 italic">No email addresses available. Add an email above.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-semibold text-red-700">{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-3 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shadow-sm"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center gap-2"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Save as Paid</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      
      {/* Department Split Modal */}
      <DepartmentSplitModal
        isOpen={showDepartmentSplitModal}
        onClose={() => setShowDepartmentSplitModal(false)}
        onSave={handleDepartmentSplitSave}
        maxAmount={(() => {
          const isNonINR = paymentAmounts && paymentAmounts.isConversionNeeded;
          return isNonINR 
            ? (paymentAmounts?.inrAmount || 0)  // Use converted amount for non-INR
            : (selectedInvoice?.amountDetails?.receivableAmount || selectedInvoice?.grandTotal || 0); // Use invoice amount for INR
        })()}
        existingSplits={departmentSplits}
      />
    </div>
  );
};

export default PaymentModal;
