import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { settingsAPI } from '../services/api';
import ProfileModal from '../components/ProfileModal';

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [declaration, setDeclaration] = useState('');
  const [terms, setTerms] = useState(['']);
  const [bankDetails, setBankDetails] = useState({
    companyName: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    swiftCode: '',
    branch: '',
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showToast, setShowToast] = useState(false);
  const [initialDeclaration, setInitialDeclaration] = useState('');
  const [initialTerms, setInitialTerms] = useState([]);
  const [initialBankDetails, setInitialBankDetails] = useState({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.get();
      const settings = response.data;
      if (settings.declaration !== undefined) {
        setDeclaration(settings.declaration || '');
        setInitialDeclaration(settings.declaration || '');
      }
      if (settings.termsAndConditions && settings.termsAndConditions.length > 0) {
        setTerms(settings.termsAndConditions);
        setInitialTerms(settings.termsAndConditions);
      }
      if (settings.bankDetails) {
        const bankDetailsData = {
          companyName: settings.bankDetails.companyName || '',
          bankName: settings.bankDetails.bankName || '',
          accountNumber: settings.bankDetails.accountNumber || '',
          ifscCode: settings.bankDetails.ifscCode || '',
          swiftCode: settings.bankDetails.swiftCode || '',
          branch: settings.bankDetails.branch || '',
        };
        setBankDetails(bankDetailsData);
        setInitialBankDetails(bankDetailsData);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      showMessage('error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 300);
    }, 4000);
  };

  const handleTermChange = (index, value) => {
    const newTerms = [...terms];
    newTerms[index] = value;
    setTerms(newTerms);
  };

  const handleAddTerm = () => {
    setTerms([...terms, '']);
  };

  const handleRemoveTerm = (index) => {
    if (terms.length > 1) {
      const newTerms = terms.filter((_, i) => i !== index);
      setTerms(newTerms);
    }
  };

  const handleBankDetailChange = (field, value) => {
    setBankDetails({
      ...bankDetails,
      [field]: value,
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Filter out empty terms
      const validTerms = terms.filter(term => term.trim() !== '');
      
      // Check which section was modified
      const declarationChanged = declaration !== initialDeclaration;
      const termsChanged = JSON.stringify(validTerms) !== JSON.stringify(initialTerms);
      const bankDetailsChanged = JSON.stringify(bankDetails) !== JSON.stringify(initialBankDetails);
      
      // Only validate terms if they were changed
      if (termsChanged && validTerms.length === 0) {
        showMessage('error', 'Please add at least one term and condition');
        setSaving(false);
        return;
      }
      
      // Build update payload with only changed sections
      const updatePayload = {};
      if (declarationChanged) {
        updatePayload.declaration = declaration;
      }
      if (termsChanged) {
        updatePayload.termsAndConditions = validTerms;
      }
      if (bankDetailsChanged) {
        updatePayload.bankDetails = bankDetails;
      }
      
      // If nothing changed, show message and return
      if (!declarationChanged && !termsChanged && !bankDetailsChanged) {
        showMessage('success', 'No changes to save.');
        setSaving(false);
        return;
      }
      
      await settingsAPI.update(updatePayload);
      
      // Update initial values after successful save
      if (declarationChanged) {
        setInitialDeclaration(declaration);
      }
      if (termsChanged) {
        setInitialTerms(validTerms);
      }
      if (bankDetailsChanged) {
        setInitialBankDetails(bankDetails);
      }
      
      // Show appropriate message based on what was changed
      const changedSections = [];
      if (declarationChanged) changedSections.push('declaration');
      if (termsChanged) changedSections.push('terms and conditions');
      if (bankDetailsChanged) changedSections.push('bank details');
      
      if (changedSections.length > 0) {
        showMessage('success', `Settings saved successfully! ${changedSections.join(', ')} ${changedSections.length === 1 ? 'has' : 'have'} been updated.`);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showMessage('error', error.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-14 w-14 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
          <p className="text-slate-600 font-medium text-base">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Settings</h1>
              <p className="text-xs text-slate-500">Manage invoice settings and preferences</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProfileModal(true)}
              className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 
                       text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl
                       transition-all duration-200 border-2 border-white active:scale-[0.95]"
              title="View Profile"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5"
              title="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Close</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {message.text && (
        <div
          className={`fixed top-4 right-4 z-50 transform transition-all duration-300 ease-out ${
            showToast ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
          }`}
        >
          <div
            className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-lg border backdrop-blur-sm min-w-[320px] ${
              message.type === 'success'
                ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-800'
                : 'bg-gradient-to-r from-red-50 to-red-100 border-red-200 text-red-800'
            }`}
          >
            {message.type === 'success' ? (
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <p className="font-semibold text-sm flex-1">{message.text}</p>
            <button
              onClick={() => setShowToast(false)}
              className="text-current opacity-70 hover:opacity-100 transition-opacity"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Declaration Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Declaration</h2>
          </div>
        </div>
        <textarea
          value={declaration}
          onChange={(e) => setDeclaration(e.target.value)}
          placeholder="Enter declaration text (e.g., 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.')"
          rows="4"
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white transition-all placeholder:text-slate-400"
        />
      </div>

      {/* Two Column Layout - Terms and Bank Details Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* Terms and Conditions Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Terms and Conditions</h2>
                <p className="text-xs text-slate-500">Customize terms for invoice PDFs</p>
              </div>
            </div>
            <button
              onClick={handleAddTerm}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add</span>
            </button>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[500px] pr-1">
            {terms.map((term, index) => (
              <div
                key={index}
                className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                <div className="flex-shrink-0 w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white font-semibold text-xs mt-0.5">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <textarea
                    value={term}
                    onChange={(e) => handleTermChange(index, e.target.value)}
                    placeholder="Enter term and condition..."
                    rows="2"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white transition-all placeholder:text-slate-400"
                  />
                </div>
                {terms.length > 1 && (
                  <button
                    onClick={() => handleRemoveTerm(index)}
                    className="flex-shrink-0 p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bank Details Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Bank Details</h2>
              <p className="text-xs text-slate-500">Configure bank details for invoice PDFs</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 flex-1">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                value={bankDetails.companyName}
                onChange={(e) => handleBankDetailChange('companyName', e.target.value)}
                placeholder="Kology Ventures Private Limited"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Bank Name</label>
              <input
                type="text"
                value={bankDetails.bankName}
                onChange={(e) => handleBankDetailChange('bankName', e.target.value)}
                placeholder="ICICI Bank Ltd."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Account Number</label>
              <input
                type="text"
                value={bankDetails.accountNumber}
                onChange={(e) => handleBankDetailChange('accountNumber', e.target.value)}
                placeholder="471405500040"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">IFSC Code</label>
              <input
                type="text"
                value={bankDetails.ifscCode}
                onChange={(e) => handleBankDetailChange('ifscCode', e.target.value)}
                placeholder="ICIC0004714"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">SWIFT Code</label>
              <input
                type="text"
                value={bankDetails.swiftCode}
                onChange={(e) => handleBankDetailChange('swiftCode', e.target.value)}
                placeholder="ICICNBBCTS"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Branch</label>
              <input
                type="text"
                value={bankDetails.branch}
                onChange={(e) => handleBankDetailChange('branch', e.target.value)}
                placeholder="AEC Cross Road"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button - Fixed at bottom */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Save Settings</span>
            </>
          )}
        </button>
      </div>

      {/* Profile Modal */}
      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
    </div>
  );
};

export default Settings;
