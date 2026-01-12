import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { getAuthToken } from '../utils/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const InvoiceTable = ({ invoices, onEdit, onDelete, onView, onRecordPayment, onViewPDF, selectedInvoices = [], onSelectInvoice, onSelectAll }) => {
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [viewingPdfInvoice, setViewingPdfInvoice] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const dropdownRefs = useRef({});
  const buttonRefs = useRef({});

  // Calculate dropdown position when opened
  useEffect(() => {
    if (openDropdown !== null) {
      const button = buttonRefs.current[openDropdown];
      if (button) {
        const rect = button.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 4,
          right: window.innerWidth - rect.right - window.scrollX,
        });
      }
    }
  }, [openDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown !== null) {
        const dropdownRef = dropdownRefs.current[openDropdown];
        const button = buttonRefs.current[openDropdown];
        if (dropdownRef && !dropdownRef.contains(event.target) && button && !button.contains(event.target)) {
          setOpenDropdown(null);
        }
      }
    };

    if (openDropdown !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      // Also close on scroll
      const handleScroll = () => setOpenDropdown(null);
      window.addEventListener('scroll', handleScroll, true);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [openDropdown]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        window.URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  const handleViewPDF = async (invoice) => {
    const token = getAuthToken();
    if (!token) {
      alert('Please login to view PDF');
      return;
    }
    
    setViewingPdfInvoice(invoice);
    setPdfModalOpen(true);
    setPdfLoading(true);
    
    try {
      const url = `${API_URL}/invoices/${invoice._id}/pdf`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch PDF');
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      setPdfBlobUrl(blobUrl);
    } catch (error) {
      console.error('Error loading PDF:', error);
      alert(`Failed to load PDF: ${error.message || 'Please try again.'}`);
      setPdfModalOpen(false);
      setViewingPdfInvoice(null);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleClosePDFModal = () => {
    if (pdfBlobUrl) {
      window.URL.revokeObjectURL(pdfBlobUrl);
    }
    setPdfModalOpen(false);
    setViewingPdfInvoice(null);
    setPdfBlobUrl(null);
    setPdfLoading(false);
  };
  if (invoices.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        No invoices found. Create your first invoice to get started.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="table-header">
            <tr>
              {onSelectInvoice && (
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20 w-12">
                  <input
                    type="checkbox"
                    checked={selectedInvoices.length === invoices.length && invoices.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onSelectAll(invoices.map(inv => inv._id));
                      } else {
                        onSelectAll([]);
                      }
                    }}
                    className="w-4 h-4 text-finance-blue bg-gray-100 border-gray-300 rounded focus:ring-finance-blue"
                  />
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Invoice #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Client
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Subtotal
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                GST
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Grand Total
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invoices.map((invoice) => {
              const totalGst = (invoice.cgst || 0) + (invoice.sgst || 0) + (invoice.igst || 0);
              const currency = invoice.currencyDetails?.invoiceCurrency || invoice.currency || 'INR';
              const baseAmount = invoice.amountDetails?.baseAmount || invoice.subTotal || 0;
              const invoiceTotal = invoice.amountDetails?.invoiceTotal || invoice.grandTotal || 0;
              return (
                <tr key={invoice._id} className="hover:bg-gray-50">
                  {onSelectInvoice && (
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedInvoices.includes(invoice._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onSelectInvoice(invoice._id, true);
                          } else {
                            onSelectInvoice(invoice._id, false);
                          }
                        }}
                        className="w-4 h-4 text-finance-blue bg-gray-100 border-gray-300 rounded focus:ring-finance-blue"
                      />
                    </td>
                  )}
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    {onViewPDF ? (
                      <button
                        onClick={() => onViewPDF(invoice)}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                      >
                        {invoice.invoiceNumber}
                      </button>
                    ) : (
                      <span className="text-gray-900">{invoice.invoiceNumber}</span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(invoice.invoiceDate), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {invoice.clientDetails?.name || 'N/A'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {currency} {baseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {currency} {totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    {currency} {invoiceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {(() => {
                      const displayStatus = invoice.status || 'Unpaid';
                      if (displayStatus === 'Paid') {
                        return <span className="badge-success">{displayStatus}</span>;
                      } else if (displayStatus === 'Partial') {
                        return <span className="badge-warning">{displayStatus}</span>;
                      } else {
                        return <span className="badge-neutral">{displayStatus}</span>;
                      }
                    })()}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="relative inline-block">
                      <button
                        ref={(el) => (buttonRefs.current[invoice._id] = el)}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOpenDropdown(openDropdown === invoice._id ? null : invoice._id);
                        }}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-finance-blue focus:ring-offset-2 transition-all duration-200"
                        title="Actions"
                        aria-expanded={openDropdown === invoice._id}
                        aria-haspopup="true"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Dropdown Portal - Rendered outside table to avoid overflow clipping */}
      {openDropdown !== null && createPortal(
        <div
          ref={(el) => (dropdownRefs.current[openDropdown] = el)}
          className="fixed w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-[9999]"
          style={{
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`,
          }}
        >
          <div className="py-1" role="menu">
            {(() => {
              const invoice = invoices.find(inv => inv._id === openDropdown);
              if (!invoice) return null;
              
              return (
                <>
                  {onRecordPayment && invoice.status !== 'Paid' && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOpenDropdown(null);
                        if (onRecordPayment) {
                          onRecordPayment(invoice);
                        }
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      role="menuitem"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="10" r="8" strokeWidth="2" fill="none"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v4m0 0l-3-3m3 3l3-3" />
                        <line x1="6" y1="18" x2="18" y2="18" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <span className="text-finance-blue font-medium">Record Payment</span>
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenDropdown(null);
                      if (onView) {
                        onView(invoice);
                      } else {
                        console.error('onView handler is not provided');
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    role="menuitem"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span className="text-finance-blue">View</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenDropdown(null);
                      if (onViewPDF) {
                        onViewPDF(invoice);
                      } else {
                        handleViewPDF(invoice);
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    role="menuitem"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="text-finance-blue">PDF</span>
                  </button>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenDropdown(null);
                      onDelete(invoice._id);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    role="menuitem"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="text-status-danger">Delete</span>
                  </button>
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* PDF Viewer Modal */}
      {pdfModalOpen && viewingPdfInvoice && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[10000] p-4"
          onClick={handleClosePDFModal}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Invoice PDF</h2>
                  <p className="text-sm text-white/90">#{viewingPdfInvoice.invoiceNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Download Button */}
                <button
                  onClick={async () => {
                    try {
                      const token = getAuthToken();
                      const url = `${API_URL}/invoices/${viewingPdfInvoice._id}/pdf`;
                      const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                          Authorization: `Bearer ${token}`,
                          Accept: 'application/pdf',
                        },
                      });
                      if (response.ok) {
                        const blob = await response.blob();
                        const blobUrl = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        link.download = `invoice-${viewingPdfInvoice.invoiceNumber}.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(blobUrl);
                      }
                    } catch (error) {
                      console.error('Error downloading PDF:', error);
                    }
                  }}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
                  title="Download PDF"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download</span>
                </button>
                {/* Close Button */}
                <button
                  onClick={handleClosePDFModal}
                  className="w-10 h-10 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
                  title="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 overflow-hidden bg-gray-100 relative">
              {pdfLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
                    <p className="text-slate-600 font-medium">Loading PDF...</p>
                  </div>
                </div>
              ) : pdfBlobUrl ? (
                <iframe
                  src={pdfBlobUrl}
                  className="w-full h-full border-0"
                  title={`Invoice PDF - ${viewingPdfInvoice.invoiceNumber}`}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <p className="text-slate-600">Failed to load PDF</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceTable;

