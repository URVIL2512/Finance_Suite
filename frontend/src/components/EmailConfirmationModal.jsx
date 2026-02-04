import { useState, useEffect } from 'react';

const EmailConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  clientEmail, 
  loading = false,
  isNewInvoice = false // New prop to determine if this is for creating or updating
}) => {
  const [sendEmail, setSendEmail] = useState(false);

  // Reset checkbox when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSendEmail(false); // Default to unchecked
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(sendEmail);
  };

  const actionText = isNewInvoice ? 'Generate Invoice' : 'Update Invoice';
  const loadingText = isNewInvoice ? 'Generating...' : 'Updating...';

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <h2 className="text-xl font-bold text-slate-900">Send Email Confirmation</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-3xl font-light leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100"
            aria-label="Close"
            disabled={loading}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-slate-700 mb-4 leading-relaxed">
            Do you want to send the invoice to client email id:
          </p>
          
          {clientEmail ? (
            <div className="mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-blue-900 break-all">
                  {clientEmail}
                </p>
              </div>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  disabled={loading}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-slate-700 font-medium group-hover:text-slate-900">
                  Send invoice email to client
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-2 ml-8">
                {sendEmail 
                  ? 'Invoice email will be sent when you confirm' 
                  : 'Invoice will be saved without sending email'}
              </p>
            </div>
          ) : (
            <div className="mb-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ No client email found. Invoice email cannot be sent.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647A7.962 7.962 0 0112 20c0-4.418-3.582-8-8-8z"></path>
                  </svg>
                  {loadingText}
                </>
              ) : (
                actionText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailConfirmationModal;
