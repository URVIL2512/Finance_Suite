import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { getAuthToken } from '../utils/auth';
import { useToast } from '../contexts/ToastContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5004/api';

const InvoiceTable = ({ invoices, onEdit, onDelete, onVoid, onView, onRecordPayment, onViewPDF, selectedInvoices = [], onSelectInvoice, onSelectAll }) => {
  const { showToast } = useToast();
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [dropdownPositionReady, setDropdownPositionReady] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [viewingPdfInvoice, setViewingPdfInvoice] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const dropdownRefs = useRef({});
  const buttonRefs = useRef({});

  // Calculate dropdown position when opened
  useEffect(() => {
    if (openDropdown !== null) {
      // Reset position ready state when opening new dropdown
      setDropdownPositionReady(false);
      
      const calculatePosition = () => {
        const button = buttonRefs.current[openDropdown];
        if (button) {
          try {
            const rect = button.getBoundingClientRect();
            
            // Use fixed positioning relative to viewport for better visibility
            // Position dropdown below the button, aligned to the right edge of button
            const top = rect.bottom + 4; // 4px gap below button
            const left = rect.right - 192; // Align right edge (192px = dropdown width)
            
            // Ensure dropdown stays within viewport
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const dropdownWidth = 192;
            const dropdownHeight = 200; // Approximate height
            
            let finalLeft = left;
            let finalTop = top;
            
            // Adjust if dropdown would go off right edge
            if (finalLeft + dropdownWidth > viewportWidth) {
              finalLeft = viewportWidth - dropdownWidth - 10;
            }
            
            // Adjust if dropdown would go off left edge - but ensure it's not on sidebar
            // Sidebar is typically around 0-250px, so ensure dropdown is at least 260px from left
            const sidebarWidth = 260; // Approximate sidebar width
            if (finalLeft < sidebarWidth) {
              // Position to the right of the button instead
              finalLeft = rect.right + 4;
              // If that goes off screen, position to the left but ensure it's visible
              if (finalLeft + dropdownWidth > viewportWidth) {
                finalLeft = Math.max(sidebarWidth + 10, viewportWidth - dropdownWidth - 10);
              }
            }
            
            // Adjust if dropdown would go off bottom edge
            if (finalTop + dropdownHeight > viewportHeight) {
              finalTop = rect.top - dropdownHeight - 4; // Show above button instead
            }
            
            setDropdownPosition({
              top: finalTop,
              left: finalLeft,
            });
            setDropdownPositionReady(true); // Mark position as ready
            
            console.log('📌 Dropdown position calculated:', { top: finalTop, left: finalLeft, buttonRect: rect });
          } catch (error) {
            console.error('Error calculating dropdown position:', error);
            // Fallback position - ensure it's not on sidebar
            setDropdownPosition({
              top: 100,
              left: 300, // Position away from sidebar
            });
            setDropdownPositionReady(true);
          }
        } else {
          console.warn('⚠️ Button ref not found for invoice:', openDropdown);
          // Retry with multiple attempts
          let attempts = 0;
          const maxAttempts = 5;
          const retryInterval = setInterval(() => {
            attempts++;
            const retryButton = buttonRefs.current[openDropdown];
            if (retryButton) {
              clearInterval(retryInterval);
              try {
                const rect = retryButton.getBoundingClientRect();
                const top = rect.bottom + 4;
                const left = rect.right - 192;
                
                const viewportWidth = window.innerWidth;
                const sidebarWidth = 260;
                let finalLeft = left + 192 > viewportWidth ? viewportWidth - 192 - 10 : Math.max(sidebarWidth + 10, left);
                // If calculated position is too far left, position to the right of button
                if (finalLeft < sidebarWidth) {
                  finalLeft = rect.right + 4;
                  if (finalLeft + 192 > viewportWidth) {
                    finalLeft = Math.max(sidebarWidth + 10, viewportWidth - 192 - 10);
                  }
                }
                const finalTop = rect.bottom + 200 > window.innerHeight ? rect.top - 200 - 4 : top;
                
                setDropdownPosition({
                  top: finalTop,
                  left: finalLeft,
                });
                setDropdownPositionReady(true);
                console.log('✅ Dropdown position set on retry');
              } catch (error) {
                console.error('Error calculating dropdown position on retry:', error);
                setDropdownPositionReady(true); // Still show it even if calculation fails
              }
            } else if (attempts >= maxAttempts) {
              clearInterval(retryInterval);
              console.error('❌ Failed to find button after', maxAttempts, 'attempts');
              setDropdownPositionReady(true); // Show with fallback position
            }
          }, 50);
          
          return () => clearInterval(retryInterval);
        }
      };
      
      // Calculate immediately using requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        calculatePosition();
      });
      
      // Also calculate after a small delay to handle async rendering
      const timeoutId = setTimeout(() => {
        calculatePosition();
      }, 10);
      
      // Recalculate on scroll/resize
      window.addEventListener('scroll', calculatePosition, true);
      window.addEventListener('resize', calculatePosition);
      
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('scroll', calculatePosition, true);
        window.removeEventListener('resize', calculatePosition);
      };
    } else {
      // Reset position when dropdown closes
      setDropdownPosition({ top: 0, left: 0 });
      setDropdownPositionReady(false);
    }
  }, [openDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown !== null) {
        const dropdownRef = dropdownRefs.current[openDropdown];
        const button = buttonRefs.current[openDropdown];
        
        // Check if click is outside both dropdown and button
        const isClickOutside = dropdownRef && !dropdownRef.contains(event.target) && 
                               button && !button.contains(event.target);
        
        // Also check if clicking on another action button
        const clickedButtonId = Object.keys(buttonRefs.current).find(id => {
          const btn = buttonRefs.current[id];
          return btn && btn.contains && btn.contains(event.target);
        });
        
        if (isClickOutside && clickedButtonId !== openDropdown) {
          setOpenDropdown(null);
        }
      }
    };

    if (openDropdown !== null) {
      // Use capture phase to catch events early
      document.addEventListener('mousedown', handleClickOutside, true);
      // Also close on scroll
      const handleScroll = () => setOpenDropdown(null);
      window.addEventListener('scroll', handleScroll, true);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside, true);
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
      showToast('Please login to view PDF', 'error');
      return;
    }
    
    setViewingPdfInvoice(invoice);
    setPdfModalOpen(true);
    setPdfLoading(true);
    
    try {
      const url = `${API_URL}/invoices/${invoice._id}/pdf?t=${Date.now()}`;
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
      showToast(`Failed to load PDF: ${error.message || 'Please try again.'}`, 'error');
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
      <div className="overflow-x-auto overflow-y-visible">
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
                Due Date
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
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Recurring
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
              const isRecurring =
                typeof invoice?.hasRecurringSchedule === 'boolean'
                  ? invoice.hasRecurringSchedule
                  : !!invoice?.isRecurring;
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
                    {onView ? (
                      <button
                        onClick={() => onView(invoice)}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                      >
                        {invoice.invoiceNumber}
                      </button>
                    ) : onViewPDF ? (
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
                    {invoice.dueDate ? format(new Date(invoice.dueDate), 'dd/MM/yyyy') : '-'}
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
                  <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                        isRecurring
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {isRecurring ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {(() => {
                      const displayStatus = invoice.status || 'Unpaid';
                      
                      // Don't change Paid or Void status - keep as is
                      if (displayStatus === 'Paid') {
                        return <span className="badge-success">{displayStatus}</span>;
                      } else if (displayStatus === 'Void') {
                        return <span className="badge-neutral bg-orange-100 text-orange-700 border-orange-200">{displayStatus}</span>;
                      } else if (displayStatus === 'Partial') {
                        return <span className="badge-warning">{displayStatus}</span>;
                      }
                      
                      // For Unpaid invoices: Check if due date has crossed
                      // Overdue Days = Today Date - Due Date (only when today > due date)
                      if (displayStatus === 'Unpaid' && invoice.dueDate) {
                        try {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const dueDate = new Date(invoice.dueDate);
                          dueDate.setHours(0, 0, 0, 0);
                          
                          // Check if date is valid
                          if (isNaN(dueDate.getTime())) {
                            return <span className="badge-neutral">Unpaid</span>;
                          }
                          
                          // Calculate overdue days: Today Date - Due Date
                          // Only show "Overdue" if today > due date (due date has crossed)
                          const overdueDays = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                          
                          // If due date has crossed (overdueDays > 0), show "Overdue by X days"
                          if (overdueDays > 0) {
                            return (
                              <span className="badge-neutral bg-red-100 text-red-700 border-red-200">
                                Overdue by {overdueDays} day{overdueDays !== 1 ? 's' : ''}
                              </span>
                            );
                          }
                          // If due date not crossed (today <= due date), show "Unpaid"
                          else {
                            return <span className="badge-neutral">Unpaid</span>;
                          }
                        } catch (error) {
                          console.error('Error calculating days overdue:', error);
                          return <span className="badge-neutral">Unpaid</span>;
                        }
                      }
                      
                      // For unpaid invoices without due date, show "Unpaid"
                      if (displayStatus === 'Unpaid') {
                        return <span className="badge-neutral">Unpaid</span>;
                      }
                      
                      // Default fallback
                      return <span className="badge-neutral">{displayStatus}</span>;
                    })()}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="relative inline-block text-right">
                      {invoice._id ? (
                        <div className="inline-flex justify-end relative">
                          <button
                            ref={(el) => {
                              if (el && invoice._id) {
                                buttonRefs.current[invoice._id] = el;
                              }
                            }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.nativeEvent?.stopImmediatePropagation?.();
                            if (invoice._id) {
                              const newOpenState = openDropdown === invoice._id ? null : invoice._id;
                              console.log('🔘 Action button clicked for invoice:', invoice._id, 'Setting dropdown to:', newOpenState);
                              setOpenDropdown(newOpenState);
                            } else {
                              console.warn('⚠️ Invoice ID is missing');
                            }
                          }}
                          onMouseDown={(e) => {
                            // Prevent event bubbling
                            e.stopPropagation();
                          }}
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 cursor-pointer ${
                            openDropdown === invoice._id 
                              ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300' 
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                          } focus:outline-none focus:ring-2 focus:ring-finance-blue focus:ring-offset-2`}
                          title="Actions"
                          aria-expanded={openDropdown === invoice._id}
                          aria-haspopup="true"
                          type="button"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Dropdown Portal - Rendered outside table to avoid overflow clipping */}
      {/* Only render dropdown after position is calculated to prevent showing on sidebar */}
      {openDropdown !== null && dropdownPositionReady && createPortal(
                    <div
                      ref={(el) => {
                        if (el && openDropdown) {
                          dropdownRefs.current[openDropdown] = el;
                          console.log('✅ Dropdown ref set for invoice:', openDropdown);
                        }
                      }}
          className="fixed w-48 bg-white rounded-md shadow-xl ring-1 ring-black ring-opacity-10 z-[99999] border border-gray-200"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            minWidth: '192px',
            maxWidth: '192px',
          }}
          onClick={(e) => {
            // Prevent clicks inside dropdown from closing it
            e.stopPropagation();
            e.nativeEvent?.stopImmediatePropagation?.();
          }}
          onMouseDown={(e) => {
            // Prevent mousedown from triggering click outside handler
            e.stopPropagation();
            e.nativeEvent?.stopImmediatePropagation?.();
          }}
        >
          <div className="py-1" role="menu" style={{ pointerEvents: 'auto' }}>
            {(() => {
              const invoice = invoices.find(inv => inv && inv._id === openDropdown);
              if (!invoice) {
                console.warn('⚠️ Invoice not found for dropdown:', openDropdown);
                return (
                  <div className="px-4 py-2 text-sm text-gray-500">
                    Invoice not found
                  </div>
                );
              }
              
              console.log('📋 Rendering dropdown menu for invoice:', invoice.invoiceNumber || invoice._id);
              
              return (
                <>
                  {onRecordPayment && invoice.status !== 'Paid' && invoice.status !== 'Void' && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('💰 Record Payment clicked for invoice:', invoice._id);
                        setOpenDropdown(null);
                        if (onRecordPayment) {
                          onRecordPayment(invoice);
                        }
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer transition-colors"
                      role="menuitem"
                      type="button"
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
                      console.log('👁️ View clicked for invoice:', invoice._id);
                      setOpenDropdown(null);
                      if (onView) {
                        onView(invoice);
                      } else {
                        console.error('❌ onView handler is not provided');
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer transition-colors"
                    role="menuitem"
                    type="button"
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
                      console.log('📄 PDF clicked for invoice:', invoice._id);
                      setOpenDropdown(null);
                      if (onViewPDF) {
                        onViewPDF(invoice);
                      } else {
                        handleViewPDF(invoice);
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer transition-colors"
                    role="menuitem"
                    type="button"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="text-finance-blue">PDF</span>
                  </button>
                  <div className="border-t border-gray-100 my-1"></div>
                  {onEdit && invoice.status !== 'Paid' && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('✏️ Edit clicked for invoice:', invoice._id);
                        setOpenDropdown(null);
                        if (onEdit) {
                          onEdit(invoice);
                        }
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer transition-colors"
                      role="menuitem"
                      type="button"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span className="text-finance-blue">Edit</span>
                    </button>
                  )}
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
                      const url = `${API_URL}/invoices/${viewingPdfInvoice._id}/pdf?t=${Date.now()}`;
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

