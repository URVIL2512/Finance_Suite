import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { invoiceAPI } from '../services/api';
import InvoiceForm from './InvoiceForm';
import { useToast } from '../contexts/ToastContext';

const InvoiceViewEdit = ({ invoice, onClose, onUpdate, customers = [] }) => {
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState(invoice);

  useEffect(() => {
    if (invoice) {
      setInvoiceData(invoice);
    }
  }, [invoice]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setInvoiceData(invoice); // Reset to original data
  };

  const handleSave = async (updatedInvoice) => {
    try {
      setLoading(true);
      const response = await invoiceAPI.update(invoice._id, updatedInvoice);
      
      if (response.data) {
        setInvoiceData(response.data);
        setIsEditing(false);
        if (onUpdate) {
          onUpdate(response.data);
        }
        showToast('Invoice updated successfully!', 'success');
      }
    } catch (error) {
      console.error('Error updating invoice:', error);
      showToast(error.response?.data?.message || 'Failed to update invoice', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!invoice) return null;

  // If editing, show InvoiceForm
  if (isEditing) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full my-8 max-h-[95vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          {/* Professional Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-3.5 rounded-t-2xl flex-shrink-0">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold">Edit Invoice</h2>
                  <p className="text-xs text-white/90">#{invoice.invoiceNumber}</p>
                </div>
              </div>
              <button
                onClick={handleCancel}
                className="w-8 h-8 rounded-lg text-white hover:bg-white/20 flex items-center justify-center transition-all duration-200"
                title="Cancel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          {/* Form Content */}
          <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-white p-6">
            <InvoiceForm
              invoice={invoiceData}
              customers={customers}
              onSubmit={handleSave}
              onCancel={handleCancel}
            />
          </div>
        </div>
      </div>
    );
  }

  // View mode
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Invoice #{invoiceData.invoiceNumber}</h2>
                <p className="text-sm text-white/90 mt-0.5">
                  {invoiceData.invoiceDate ? format(new Date(invoiceData.invoiceDate), 'dd MMM yyyy') : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {invoiceData.status !== 'Paid' && (
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
                  title="Edit Invoice"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Edit</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg text-white hover:bg-white/20 flex items-center justify-center transition-colors"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-slate-50 to-white">
          {/* Quick Info Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</div>
              <div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                  invoiceData.status === 'Paid'
                    ? 'bg-emerald-100 text-emerald-700'
                    : invoiceData.status === 'Partial'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {invoiceData.status || 'Pending'}
                </span>
              </div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Due Date</div>
              <div className="text-sm font-semibold text-slate-900">
                {invoiceData.dueDate ? format(new Date(invoiceData.dueDate), 'dd MMM yyyy') : '-'}
              </div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Currency</div>
              <div className="text-sm font-semibold text-slate-900">
                {invoiceData.currencyDetails?.invoiceCurrency || invoiceData.currency || 'INR'}
              </div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Exchange Rate</div>
              <div className="text-sm font-semibold text-slate-900">
                {invoiceData.currencyDetails?.exchangeRate || invoiceData.exchangeRate || '1'}
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            {/* Client Info - Left Column */}
            <div className="lg:col-span-1 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <h3 className="text-sm font-bold text-slate-900">Client</h3>
              </div>
              <div className="space-y-2.5">
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-0.5">Name</div>
                  <div className="text-sm font-semibold text-slate-900">{invoiceData.clientDetails?.name || '-'}</div>
                </div>
                {invoiceData.clientEmail && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-0.5">Email</div>
                    <div className="text-xs text-slate-700">{invoiceData.clientEmail}</div>
                  </div>
                )}
                {invoiceData.clientMobile && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-0.5">Mobile</div>
                    <div className="text-xs text-slate-700">{invoiceData.clientMobile}</div>
                  </div>
                )}
                {(invoiceData.clientDetails?.state || invoiceData.clientDetails?.country) && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-0.5">Location</div>
                    <div className="text-xs text-slate-700">
                      {[invoiceData.clientDetails?.state, invoiceData.clientDetails?.country].filter(Boolean).join(', ') || '-'}
                    </div>
                  </div>
                )}
                {invoiceData.clientDetails?.gstin && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-0.5">GSTIN</div>
                    <div className="text-xs text-slate-700">{invoiceData.clientDetails.gstin}</div>
                  </div>
                )}
                {invoiceData.clientDetails?.address && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-0.5">Address</div>
                    <div className="text-xs text-slate-700">{invoiceData.clientDetails.address}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Amount Summary - Right Column */}
            <div className="lg:col-span-2 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-sm font-bold text-slate-900">Amount Summary</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-1">Base Amount</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {invoiceData.currencyDetails?.invoiceCurrency || invoiceData.currency || 'INR'} {(invoiceData.amountDetails?.baseAmount || invoiceData.subTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-1">GST ({invoiceData.gstPercentage || 0}%)</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {invoiceData.currencyDetails?.invoiceCurrency || invoiceData.currency || 'INR'} {((invoiceData.cgst || 0) + (invoiceData.sgst || 0) + (invoiceData.igst || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                {(invoiceData.tdsAmount || 0) > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-1">TDS ({invoiceData.tdsPercentage || 0}%)</div>
                    <div className="text-sm font-semibold text-orange-600">
                      {invoiceData.currencyDetails?.invoiceCurrency || invoiceData.currency || 'INR'} {(invoiceData.tdsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                )}
                {(invoiceData.tcsAmount || 0) > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-1">TCS ({invoiceData.tcsPercentage || 0}%)</div>
                    <div className="text-sm font-semibold text-slate-900">
                      {invoiceData.currencyDetails?.invoiceCurrency || invoiceData.currency || 'INR'} {(invoiceData.tcsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                )}
                {(invoiceData.remittanceCharges || 0) > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-1">Remittance</div>
                    <div className="text-sm font-semibold text-slate-900">
                      {invoiceData.currencyDetails?.invoiceCurrency || invoiceData.currency || 'INR'} {(invoiceData.remittanceCharges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                )}
                <div className="col-span-2 md:col-span-3 pt-2 mt-2 border-t border-slate-200">
                  <div className="flex justify-between items-center">
                    <div className="text-sm font-bold text-slate-700">Grand Total</div>
                    <div className="text-lg font-bold text-blue-600">
                      {invoiceData.currencyDetails?.invoiceCurrency || invoiceData.currency || 'INR'} {(invoiceData.amountDetails?.invoiceTotal || invoiceData.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-1">Receivable</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {invoiceData.currencyDetails?.invoiceCurrency || invoiceData.currency || 'INR'} {(invoiceData.amountDetails?.receivableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-1">Amount Received</div>
                  <div className="text-sm font-semibold text-emerald-600">
                    {invoiceData.currencyDetails?.invoiceCurrency || invoiceData.currency || 'INR'} {(invoiceData.receivedAmount || invoiceData.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div 
                  className="rounded-[10px] text-center mb-3"
                  style={{
                    border: '1.5px solid #2563EB',
                    backgroundColor: '#F0F7FF',
                    padding: '12px 18px',
                    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.12)'
                  }}
                >
                  <div 
                    className="text-xs font-semibold mb-2"
                    style={{ 
                      color: '#1E3A8A',
                      fontSize: '12px',
                      fontWeight: 600,
                      letterSpacing: '0.5px'
                    }}
                  >
                    Balance Due
                  </div>
                  <div 
                    className="font-extrabold"
                    style={{
                      color: '#0F172A',
                      fontSize: '22px',
                      fontWeight: 800
                    }}
                  >
                    {invoiceData.currencyDetails?.invoiceCurrency || invoiceData.currency || 'INR'} {(() => {
                      const receivable = invoiceData.amountDetails?.receivableAmount || 0;
                      const received = invoiceData.receivedAmount || invoiceData.paidAmount || 0;
                      const balanceDue = Math.max(0, receivable - received);
                      return balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Items Section */}
          {invoiceData.items && invoiceData.items.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-4">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <h3 className="text-sm font-bold text-slate-900">Items ({invoiceData.items.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Item Name</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Description</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">HSN/SAC</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Qty</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Rate</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoiceData.items.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-xs font-semibold text-slate-900">{item.name || '-'}</td>
                        <td className="px-3 py-2 text-xs text-slate-700">{item.description || '-'}</td>
                        <td className="px-3 py-2 text-xs text-center text-slate-600">{item.hsnSac || '-'}</td>
                        <td className="px-3 py-2 text-xs text-center text-slate-600">{item.quantity || 0}</td>
                        <td className="px-3 py-2 text-xs text-right text-slate-600">{(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-xs text-right font-semibold text-slate-900">{(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Additional Details */}
          {(invoiceData.serviceDetails || invoiceData.notes || invoiceData.lutArn) && (
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-sm font-bold text-slate-900">Additional Details</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                {invoiceData.serviceDetails?.description && (
                  <div>
                    <div className="font-semibold text-slate-500 mb-0.5">Service</div>
                    <div className="text-slate-700">{invoiceData.serviceDetails.description || invoiceData.serviceDetails?.serviceType || '-'}</div>
                  </div>
                )}
                {invoiceData.serviceDetails?.engagementType && (
                  <div>
                    <div className="font-semibold text-slate-500 mb-0.5">Engagement</div>
                    <div className="text-slate-700">{invoiceData.serviceDetails.engagementType}</div>
                  </div>
                )}
                {invoiceData.serviceDetails?.period && (
                  <div>
                    <div className="font-semibold text-slate-500 mb-0.5">Period</div>
                    <div className="text-slate-700">
                      {[invoiceData.serviceDetails.period.month, invoiceData.serviceDetails.period.year].filter(Boolean).join(' ') || '-'}
                    </div>
                  </div>
                )}
                {invoiceData.lutArn && (
                  <div>
                    <div className="font-semibold text-slate-500 mb-0.5">LUT/ARN</div>
                    <div className="text-slate-700">{invoiceData.lutArn}</div>
                  </div>
                )}
                {invoiceData.notes && (
                  <div className="col-span-2 md:col-span-3">
                    <div className="font-semibold text-slate-500 mb-0.5">Notes</div>
                    <div className="text-slate-700 bg-slate-50 p-2 rounded text-xs">{invoiceData.notes}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-200">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-semibold text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceViewEdit;
