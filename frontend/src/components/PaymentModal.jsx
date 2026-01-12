import { useState, useEffect } from 'react';
import { paymentAPI, customerAPI, invoiceAPI } from '../services/api';

const PaymentModal = ({ isOpen, onClose, invoice, payment, mode = 'edit', onPaymentRecorded }) => {
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
  const [selectedInvoice, setSelectedInvoice] = useState(invoice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableEmails, setAvailableEmails] = useState([]);
  const [customEmails, setCustomEmails] = useState([]);
  const [newEmailInput, setNewEmailInput] = useState('');

  const paymentModes = ['Cash', 'Bank Transfer', 'Bank Remittance', 'Cheque', 'Credit Card', 'UPI', 'Zoho Payments'];
  const depositAccounts = ['Petty Cash', 'Bank Account', 'Cash Account', 'Other'];
  const tdsTaxAccounts = ['Advance Tax', 'TDS Payable', 'TDS Receivable'];

  useEffect(() => {
    if (isOpen) {
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
          const receivableAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;
          const receivedAmount = invoice.receivedAmount || invoice.paidAmount || 0;
          const remainingAmount = receivableAmount - receivedAmount;
          
          setFormData(prev => ({
            ...prev,
            amountReceived: remainingAmount > 0 ? remainingAmount.toFixed(2) : '',
          }));
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

  const handleInvoiceSelect = (invoiceId) => {
    const inv = invoices.find(i => i._id === invoiceId);
    if (inv) {
      setSelectedInvoice(inv);
      
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

      const receivableAmount = inv.amountDetails?.receivableAmount || inv.grandTotal || 0;
      const receivedAmount = inv.receivedAmount || inv.paidAmount || 0;
      const remainingAmount = receivableAmount - receivedAmount;
      
      if (remainingAmount > 0) {
        setFormData(prev => ({
          ...prev,
          amountReceived: remainingAmount.toFixed(2),
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

      const receivableAmount = selectedInvoice.amountDetails?.receivableAmount || selectedInvoice.grandTotal || 0;
      const receivedAmount = selectedInvoice.receivedAmount || selectedInvoice.paidAmount || 0;
      const remainingAmount = receivableAmount - receivedAmount;

      if (amountReceived > remainingAmount) {
        setError(`Amount cannot exceed remaining amount of INR ${remainingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
        setLoading(false);
        return;
      }

      if (formData.taxDeducted && (!formData.amountWithheld || parseFloat(formData.amountWithheld) <= 0)) {
        setError('Please enter amount withheld when tax is deducted');
        setLoading(false);
        return;
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
      };

      let response;
      if (editingPayment) {
        response = await paymentAPI.update(editingPayment._id, paymentData);
      } else {
        response = await paymentAPI.create(paymentData);
      }

      if (response.data) {
        alert(`Payment ${editingPayment ? 'updated' : 'recorded'} successfully!`);
        if (onPaymentRecorded) {
          onPaymentRecorded(response.data);
        }
        handleClose();
      }
    } catch (error) {
      console.error('Error saving payment:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save payment';
      setError(errorMessage);
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
    onClose();
  };

  if (!isOpen) return null;

  const receivableAmount = selectedInvoice?.amountDetails?.receivableAmount || selectedInvoice?.grandTotal || 0;
  const receivedAmount = selectedInvoice?.receivedAmount || selectedInvoice?.paidAmount || 0;
  const remainingAmount = receivableAmount - receivedAmount;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className={`bg-white rounded-2xl shadow-2xl ${mode === 'view' ? 'max-w-4xl' : 'max-w-5xl'} w-full mx-auto my-auto max-h-[90vh] overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className={`${mode === 'view' ? 'bg-gradient-to-r from-emerald-600 to-emerald-700' : 'bg-white border-b border-gray-200'} px-6 py-4 flex-shrink-0`}>
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
              <h2 className="text-2xl font-bold text-gray-900">
                {editingPayment 
                  ? `Edit Payment - ${editingPayment.paymentNumber}`
                  : selectedInvoice 
                    ? `Payment for ${selectedInvoice.invoiceNumber}` 
                    : 'Record Payment'}
              </h2>
            )}
            <button
              onClick={handleClose}
              className={`${mode === 'view' ? 'text-white hover:bg-white/20' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'} text-3xl font-bold leading-none w-8 h-8 flex items-center justify-center rounded-lg transition-colors`}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        
        <div className={`flex-1 overflow-y-auto ${mode === 'view' ? 'p-6 bg-gradient-to-br from-slate-50 to-white' : 'p-6'}`}>
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
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <select
                  name="customer"
                  value={formData.customer || ''}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium ${
                    mode === 'view' 
                      ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' 
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                  required
                  disabled={mode === 'view'}
                >
                  <option value="">Select Customer</option>
                  {customers.map(customer => (
                    <option key={customer._id} value={customer._id}>
                      {customer.displayName || customer.companyName || customer.clientName}
                    </option>
                  ))}
                </select>
                {selectedCustomer && selectedCustomer.pan && (
                  <p className="mt-2 text-sm font-medium text-gray-700 bg-gray-50 px-3 py-1.5 rounded-md inline-block">
                    PAN: <span className="font-semibold">{selectedCustomer.pan}</span>
                  </p>
                )}
              </div>

              {editingPayment && (
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                    Payment #
                  </label>
                  <input
                    type="text"
                    value={editingPayment.paymentNumber || 'N/A'}
                    className="flex-1 px-4 py-2.5 border-2 border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-semibold"
                    disabled
                  />
                </div>
              )}

              {!invoice && (
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                    Invoice <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedInvoice?._id || ''}
                    onChange={(e) => handleInvoiceSelect(e.target.value)}
                    className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium ${
                      mode === 'view' 
                        ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' 
                        : 'border-gray-300 bg-white text-gray-900'
                    }`}
                    required
                    disabled={mode === 'view'}
                  >
                    <option value="">Select Invoice</option>
                    {invoices
                      .filter(inv => {
                        const receivable = inv.amountDetails?.receivableAmount || inv.grandTotal || 0;
                        const received = inv.receivedAmount || inv.paidAmount || 0;
                        return receivable - received > 0;
                      })
                      .map(inv => (
                        <option key={inv._id} value={inv._id}>
                          {inv.invoiceNumber} - INR {(inv.amountDetails?.receivableAmount || inv.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                  Amount Received (INR) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="amountReceived"
                  value={formData.amountReceived || ''}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0.01"
                  max={remainingAmount}
                  className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-lg ${
                    mode === 'view' 
                      ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' 
                      : 'border-gray-300 text-gray-900'
                  }`}
                  required
                  disabled={mode === 'view'}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                  User Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="userEmail"
                  value={formData.userEmail || ''}
                  onChange={handleInputChange}
                  placeholder="Enter email to send Paytm slip"
                  className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium ${
                    mode === 'view' 
                      ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' 
                      : 'border-gray-300 text-gray-900'
                  }`}
                  required
                  disabled={mode === 'view'}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                  Bank Charges (if any)
                </label>
                <input
                  type="number"
                  name="bankCharges"
                  value={formData.bankCharges || ''}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium ${
                    mode === 'view' 
                      ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' 
                      : 'border-gray-300 text-gray-900'
                  }`}
                  disabled={mode === 'view'}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  Tax deducted?
                </label>
                <div className="flex gap-6">
                  <label className={`flex items-center ${mode === 'view' ? 'cursor-default' : 'cursor-pointer'}`}>
                    <input
                      type="radio"
                      name="taxDeducted"
                      checked={!formData.taxDeducted}
                      onChange={() => setFormData(prev => ({ ...prev, taxDeducted: false }))}
                      className="mr-2 w-4 h-4 text-blue-600 focus:ring-blue-500"
                      disabled={mode === 'view'}
                    />
                    <span className="text-sm font-medium text-gray-700">No Tax deducted</span>
                  </label>
                  <label className={`flex items-center ${mode === 'view' ? 'cursor-default' : 'cursor-pointer'}`}>
                    <input
                      type="radio"
                      name="taxDeducted"
                      checked={formData.taxDeducted}
                      onChange={() => setFormData(prev => ({ ...prev, taxDeducted: true, tdsType: 'TDS (Income Tax)' }))}
                      className="mr-2 w-4 h-4 text-blue-600 focus:ring-blue-500"
                      disabled={mode === 'view'}
                    />
                    <span className="text-sm font-medium text-gray-700">Yes, TDS (Income Tax)</span>
                  </label>
                </div>
              </div>

              {formData.taxDeducted && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                      Amount Withheld <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="amountWithheld"
                      value={formData.amountWithheld}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium ${
                        mode === 'view' 
                          ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' 
                          : 'border-gray-300 text-gray-900'
                      }`}
                      required={formData.taxDeducted}
                      disabled={mode === 'view'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                      TDS Tax Account <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="tdsTaxAccount"
                      value={formData.tdsTaxAccount || 'Advance Tax'}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium ${
                        mode === 'view' 
                          ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' 
                          : 'border-gray-300 bg-white text-gray-900'
                      }`}
                      required={formData.taxDeducted}
                      disabled={mode === 'view'}
                    >
                      {tdsTaxAccounts.map(account => (
                        <option key={account} value={account}>{account}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                  Payment Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="paymentDate"
                  value={formData.paymentDate || ''}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium ${
                    mode === 'view' 
                      ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' 
                      : 'border-gray-300 text-gray-900'
                  }`}
                  required
                  disabled={mode === 'view'}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                  Payment Mode
                </label>
                <select
                  name="paymentMode"
                  value={formData.paymentMode || 'Cash'}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium ${
                    mode === 'view' 
                      ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' 
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                  disabled={mode === 'view'}
                >
                  {paymentModes.map(mode => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                  Payment Received On
                </label>
                <input
                  type="date"
                  name="paymentReceivedOn"
                  value={formData.paymentReceivedOn || ''}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium ${
                    mode === 'view' 
                      ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' 
                      : 'border-gray-300 text-gray-900'
                  }`}
                  disabled={mode === 'view'}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                  Deposit To <span className="text-red-500">*</span>
                </label>
                <select
                  name="depositTo"
                  value={formData.depositTo || 'Petty Cash'}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium ${
                    mode === 'view' 
                      ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' 
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                  required
                  disabled={mode === 'view'}
                >
                  {depositAccounts.map(account => (
                    <option key={account} value={account}>{account}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                  Reference#
                </label>
                <input
                  type="text"
                  name="referenceNumber"
                  value={formData.referenceNumber}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium ${
                    mode === 'view' 
                      ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' 
                      : 'border-gray-300 text-gray-900'
                  }`}
                  disabled={mode === 'view'}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes || ''}
                  onChange={handleInputChange}
                  rows="3"
                  className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium resize-none ${
                    mode === 'view' 
                      ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed' 
                      : 'border-gray-300 text-gray-900'
                  }`}
                  disabled={mode === 'view'}
                />
              </div>

              <div className="md:col-span-2 border-t border-gray-200 pt-5 mt-2">
                <label className={`flex items-center mb-3 ${mode === 'view' ? 'cursor-default' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    name="sendThankYouNote"
                    checked={formData.sendThankYouNote}
                    onChange={handleInputChange}
                    className="mr-3 w-5 h-5 text-blue-600 focus:ring-blue-500 rounded border-gray-300"
                    disabled={mode === 'view'}
                  />
                  <span className="text-sm font-semibold text-gray-800">
                    Send a 'Thank you' note for this payment
                  </span>
                </label>
                {formData.sendThankYouNote && (
                  <div className="mt-3 ml-8 space-y-4 bg-gray-50 p-4 rounded-lg">
                    {/* Add Custom Email Section */}
                    {mode !== 'view' && (
                      <div className="border-b border-gray-200 pb-3 mb-3">
                        <label className="block text-sm font-semibold text-gray-800 mb-2">
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
                            className="flex-1 px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomEmail}
                            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Email List */}
                    {allAvailableEmails.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-600 mb-2">Select email recipients:</p>
                        {allAvailableEmails.map(email => (
                          <div key={email} className="flex items-center justify-between">
                            <label className={`flex items-center flex-1 ${mode === 'view' ? 'cursor-default' : 'cursor-pointer'}`}>
                              <input
                                type="checkbox"
                                checked={formData.emailRecipients.includes(email)}
                                onChange={() => handleEmailRecipientToggle(email)}
                                className="mr-3 w-4 h-4 text-blue-600 focus:ring-blue-500 rounded border-gray-300"
                                disabled={mode === 'view'}
                              />
                              <span className="text-sm font-medium text-gray-700">{email}</span>
                            </label>
                            {mode !== 'view' && customEmails.includes(email) && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomEmail(email)}
                                className="ml-2 text-red-600 hover:text-red-700 p-1"
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
                      <p className="text-sm text-gray-500 italic">No email addresses available. Add an email above.</p>
                    )}
                  </div>
                )}
              </div>
              </div>

              {error && (
                <div className="mt-5 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                  <p className="text-sm font-semibold text-red-700">{error}</p>
                </div>
              )}

              <div className="mt-6 pt-5 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors shadow-sm"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save as Paid'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
