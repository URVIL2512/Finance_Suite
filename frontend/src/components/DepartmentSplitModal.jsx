import { useState, useEffect } from 'react';

const DepartmentSplitModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  maxAmount, 
  existingSplits = []
}) => {
  const [splits, setSplits] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Initialize with existing splits or add one empty split
      if (existingSplits.length > 0) {
        setSplits(existingSplits.map(split => ({
          id: Date.now() + Math.random(),
          departmentName: split.departmentName || split.department || '',
          amount: split.amount
        })));
      } else {
        setSplits([{ id: Date.now(), departmentName: '', amount: '' }]);
      }
    }
  }, [isOpen, existingSplits]);

  const addSplit = () => {
    setSplits([...splits, { id: Date.now(), departmentName: '', amount: '' }]);
  };

  const removeSplit = (id) => {
    if (splits.length > 1) {
      setSplits(splits.filter(split => split.id !== id));
    }
  };

  const updateSplit = (id, field, value) => {
    setSplits(splits.map(split => 
      split.id === id ? { ...split, [field]: value } : split
    ));
  };

  const getTotalAmount = () => {
    return splits.reduce((total, split) => {
      const amount = parseFloat(split.amount) || 0;
      return total + amount;
    }, 0);
  };

  const validateSplits = () => {
    setError('');

    // Check if all splits have department name and amount
    const invalidSplits = splits.filter(split => 
      !split.departmentName || !split.departmentName.trim() || !split.amount || parseFloat(split.amount) <= 0
    );

    if (invalidSplits.length > 0) {
      setError('All splits must have a department name and valid amount greater than 0');
      return false;
    }

    // Check for duplicate department names (case insensitive)
    const departmentNames = splits.map(split => split.departmentName.trim().toLowerCase());
    const uniqueDepartmentNames = new Set(departmentNames);
    if (departmentNames.length !== uniqueDepartmentNames.size) {
      setError('Each department name can only be used once');
      return false;
    }

    // Check if total amount exceeds max amount
    const totalAmount = getTotalAmount();
    if (totalAmount > maxAmount) {
      setError(`Total split amount (₹${totalAmount.toFixed(2)}) cannot exceed ₹${maxAmount.toFixed(2)}`);
      return false;
    }

    if (totalAmount === 0) {
      setError('Total split amount must be greater than 0');
      return false;
    }

    return true;
  };

  const handleSave = () => {
    if (!validateSplits()) {
      return;
    }

    const validSplits = splits.map(split => ({
      departmentName: split.departmentName.trim(),
      amount: parseFloat(split.amount)
    }));

    onSave(validSplits);
    handleClose();
  };

  const handleClose = () => {
    setSplits([{ id: Date.now(), departmentName: '', amount: '' }]);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  const totalAmount = getTotalAmount();
  const remainingAmount = maxAmount - totalAmount;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] overflow-y-auto p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-auto my-auto max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-4 flex-shrink-0 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Department-wise Payment Split</h2>
                <p className="text-sm text-white/90 mt-0.5">
                  Split payment amount across departments
                </p>
              </div>
            </div>
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

        <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-slate-50 to-white">
          {/* Amount Summary */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Max Amount</div>
                <div className="text-lg font-bold text-slate-900">₹{maxAmount.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Split</div>
                <div className={`text-lg font-bold ${totalAmount > maxAmount ? 'text-red-600' : 'text-blue-600'}`}>
                  ₹{totalAmount.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Remaining</div>
                <div className={`text-lg font-bold ${remainingAmount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  ₹{remainingAmount.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Department Splits */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Department Splits</h3>
              <button
                type="button"
                onClick={addSplit}
                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg transition-all shadow-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Split
              </button>
            </div>

            <div className="space-y-3">
              {splits.map((split, index) => (
                <div key={split.id} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <span className="text-sm font-bold text-purple-700">{index + 1}</span>
                    </div>
                    
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Department Name</label>
                        <input
                          type="text"
                          value={split.departmentName}
                          onChange={(e) => updateSplit(split.id, 'departmentName', e.target.value)}
                          className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                          placeholder="Enter department name"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (₹)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 text-sm">₹</span>
                          <input
                            type="number"
                            value={split.amount}
                            onChange={(e) => updateSplit(split.id, 'amount', e.target.value)}
                            step="0.01"
                            min="0.01"
                            max={maxAmount}
                            className="w-full pl-7 pr-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            placeholder="0.00"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {splits.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSplit(split.id)}
                        className="flex-shrink-0 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove split"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-start gap-3 mt-4">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-semibold text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-slate-200 bg-white">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-3 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg transition-all shadow-md flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Save Splits
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepartmentSplitModal;