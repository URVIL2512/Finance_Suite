import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { bankAccountAPI } from '../services/api';
import MobileSelect from './MobileSelect';

const maskLast4 = (value) => {
  if (!value) return '';
  const s = String(value).trim();
  if (!s) return '';
  return `•••• ${s.slice(-4)}`;
};

const BankAccountPicker = ({
  value,
  onChange,
  paymentMode,
  requiredForPaymentMode = 'Bank Transfer',
  label = 'Bank Account',
  placeholder = 'Select bank account',
  addNewRoute = '/masters/bank-account',
  addNewReturnState,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(false);

  const isRequired = paymentMode === requiredForPaymentMode;

  const refresh = async () => {
    try {
      setLoading(true);
      const res = await bankAccountAPI.getAll({ isActive: true });
      const active = (res.data || []).filter((a) => a?.isActive !== false);
      setBankAccounts(active);
    } catch (e) {
      console.error('Error fetching bank accounts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => {
    if (!value) return null;
    return bankAccounts.find((a) => a?.accountName === value) || null;
  }, [bankAccounts, value]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="block text-sm font-semibold text-gray-700">{label}</label>
        <button
          type="button"
          onClick={() => {
            navigate(addNewRoute, {
              state: {
                returnPath: location.pathname,
                returnState: addNewReturnState,
                openCreate: true,
              },
            });
          }}
          className="text-xs font-semibold text-finance-blue hover:underline"
        >
          + Add new
        </button>
      </div>

      <MobileSelect value={value} onChange={(e) => onChange?.(e.target.value)} className="select-field w-full">
        <option value="">{loading ? 'Loading...' : placeholder}</option>
        {bankAccounts.map((acc) => (
          <option key={acc._id || acc.accountName} value={acc.accountName}>
            {acc.accountName}
          </option>
        ))}
      </MobileSelect>

      {isRequired && (
        <p className="text-xs text-slate-500">
          Required for <span className="font-semibold">{requiredForPaymentMode}</span>.
        </p>
      )}

      {selected && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 mb-2">Bank Details</p>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Bank</span>
              <span className="font-medium text-slate-800">{selected.bankName || '-'}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">IFSC</span>
              <span className="font-mono text-slate-800">{selected.ifsc || '-'}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Account No.</span>
              <span className="font-mono text-slate-800">{maskLast4(selected.accountNumber) || '-'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankAccountPicker;

