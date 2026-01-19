import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import MobileSelect from './MobileSelect';

const RevenueForm = ({ revenue, onSubmit, onCancel }) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    clientName: '',
    country: '',
    service: '',
    engagementType: '',
    invoiceNumber: '',
    invoiceDate: format(new Date(), 'yyyy-MM-dd'),
    invoiceAmount: '',
    gstPercentage: '',
    gstAmount: '',
    tdsPercentage: '',
    tdsAmount: '',
    remittanceCharges: '',
    receivedAmount: '',
    dueAmount: '',
    month: format(new Date(), 'MMM'),
    year: new Date().getFullYear(),
    bankAccount: '',
  });

  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);

  useEffect(() => {
    if (revenue) {
      const invoiceDate = new Date(revenue.invoiceDate);
      setFormData({
        ...revenue,
        invoiceDate: format(invoiceDate, 'yyyy-MM-dd'),
        invoiceAmount: revenue.invoiceAmount === 0 ? '' : revenue.invoiceAmount,
        gstPercentage: revenue.gstPercentage === 0 ? '' : revenue.gstPercentage,
        gstAmount: revenue.gstAmount === 0 ? '' : revenue.gstAmount,
        tdsPercentage: revenue.tdsPercentage === 0 ? '' : revenue.tdsPercentage,
        tdsAmount: revenue.tdsAmount === 0 ? '' : revenue.tdsAmount,
        remittanceCharges: revenue.remittanceCharges === 0 ? '' : revenue.remittanceCharges,
        receivedAmount: revenue.receivedAmount === 0 ? '' : revenue.receivedAmount,
        dueAmount: revenue.dueAmount === 0 ? '' : revenue.dueAmount,
      });
      if (revenue.invoiceNumber || revenue.bankAccount) setShowAdditionalInfo(true);
    }
  }, [revenue]);

  useEffect(() => {
    const invoiceAmount = parseFloat(formData.invoiceAmount) || 0;
    const gstPercentage = parseFloat(formData.gstPercentage) || 0;
    const tdsPercentage = parseFloat(formData.tdsPercentage) || 0;
    const remittanceCharges = parseFloat(formData.remittanceCharges) || 0;
    const receivedAmount = parseFloat(formData.receivedAmount) || 0;

    // GST is calculated on base amount
    const gstAmount = (invoiceAmount * gstPercentage) / 100;
    // TDS is calculated ONLY on base amount (NOT on base + GST)
    const tdsAmount = (invoiceAmount * tdsPercentage) / 100;
    
    // Calculate total: base amount + GST - TDS - Remittance
    const total = invoiceAmount + gstAmount - tdsAmount - remittanceCharges;
    const dueAmount = total - receivedAmount;

    setFormData((prev) => ({
      ...prev,
      gstAmount: gstAmount > 0 ? Math.round(gstAmount * 100) / 100 : '',
      tdsAmount: tdsAmount > 0 ? Math.round(tdsAmount * 100) / 100 : '',
      dueAmount: dueAmount !== 0 ? Math.round(dueAmount * 100) / 100 : '',
    }));
  }, [formData.invoiceAmount, formData.gstPercentage, formData.tdsPercentage, formData.remittanceCharges, formData.receivedAmount]);

  useEffect(() => {
    const date = new Date(formData.invoiceDate);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    setFormData((prev) => ({
      ...prev,
      month: monthNames[date.getMonth()],
      year: date.getFullYear(),
    }));
  }, [formData.invoiceDate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: ['invoiceAmount', 'gstPercentage', 'tdsPercentage', 'remittanceCharges', 'receivedAmount'].includes(name)
        ? value === '' ? '' : parseFloat(value) || ''
        : value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const invoiceDate = new Date(formData.invoiceDate);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[invoiceDate.getMonth()];
    const year = invoiceDate.getFullYear();
    
    const submitData = {
      ...formData,
      invoiceDate: invoiceDate,
      month: month,
      year: year,
      invoiceAmount: parseFloat(formData.invoiceAmount) || 0,
      gstPercentage: parseFloat(formData.gstPercentage) || 0,
      gstAmount: parseFloat(formData.gstAmount) || 0,
      tdsPercentage: parseFloat(formData.tdsPercentage) || 0,
      tdsAmount: parseFloat(formData.tdsAmount) || 0,
      remittanceCharges: parseFloat(formData.remittanceCharges) || 0,
      receivedAmount: parseFloat(formData.receivedAmount) || 0,
      dueAmount: parseFloat(formData.dueAmount) || 0,
    };
    
    if (!submitData.clientName || !submitData.country || !submitData.service || !submitData.engagementType) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    
    if (!submitData.invoiceAmount || submitData.invoiceAmount <= 0) {
      showToast('Invoice amount must be greater than 0', 'error');
      return;
    }
    
    onSubmit(submitData);
  };

  const countries = ['India', 'USA', 'Canada', 'Australia'];
  const services = [
    'Website Design',
    'B2B Sales Consulting',
    'Outbound Lead Generation',
    'Social Media Marketing',
    'SEO',
    'TeleCalling',
    'Other Services',
  ];
  const engagementTypes = ['One Time', 'Recurring'];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
        <h2 className="text-lg font-bold text-finance-navy">
          {revenue ? 'Edit Revenue' : 'Add New Revenue'}
        </h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Critical Fields - Always Visible */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="form-label">Invoice Date *</label>
            <input
              type="date"
              name="invoiceDate"
              value={formData.invoiceDate}
              onChange={handleChange}
              required
              className="input-field-compact"
            />
          </div>
          <div>
            <label className="form-label">Client Name *</label>
            <input
              type="text"
              name="clientName"
              value={formData.clientName}
              onChange={handleChange}
              required
              className="input-field-compact"
            />
          </div>
          <div>
            <label className="form-label">Base Amount *</label>
            <input
              type="number"
              name="invoiceAmount"
              value={formData.invoiceAmount}
              onChange={handleChange}
              step="0.01"
              required
              className="input-field-compact"
            />
          </div>
        </div>

        {/* Amount Details - Compact Grid */}
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-2">
            <label className="form-label">GST %</label>
            <input
              type="number"
              name="gstPercentage"
              value={formData.gstPercentage}
              onChange={handleChange}
              step="0.01"
              placeholder="0"
              className="input-field-compact"
            />
          </div>
          <div className="col-span-2">
            <label className="form-label">GST Amount</label>
            <input
              type="number"
              name="gstAmount"
              value={formData.gstAmount}
              readOnly
              className="input-field-compact bg-slate-50 cursor-not-allowed"
            />
          </div>
          <div className="col-span-2">
            <label className="form-label">TDS %</label>
            <input
              type="number"
              name="tdsPercentage"
              value={formData.tdsPercentage}
              onChange={handleChange}
              step="0.01"
              placeholder="0"
              className="input-field-compact"
            />
          </div>
          <div className="col-span-2">
            <label className="form-label">TDS Amount</label>
            <input
              type="number"
              name="tdsAmount"
              value={formData.tdsAmount}
              readOnly
              className="input-field-compact bg-slate-50 cursor-not-allowed"
            />
          </div>
          <div className="col-span-2">
            <label className="form-label">Received Amount</label>
            <input
              type="number"
              name="receivedAmount"
              value={formData.receivedAmount}
              onChange={handleChange}
              step="0.01"
              placeholder="0.00"
              className="input-field-compact"
            />
          </div>
          <div className="col-span-2">
            <label className="form-label">Due Amount</label>
            <input
              type="number"
              name="dueAmount"
              value={formData.dueAmount}
              readOnly
              className="input-field-compact bg-slate-50 cursor-not-allowed font-semibold"
            />
          </div>
        </div>

        {/* Total Calculation Display */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Total Amount:</span>
            <span className="text-lg font-bold text-finance-blue">
              ₹{(() => {
                const baseAmount = parseFloat(formData.invoiceAmount) || 0;
                const gstAmount = parseFloat(formData.gstAmount) || 0;
                const tdsAmount = parseFloat(formData.tdsAmount) || 0;
                const remittanceCharges = parseFloat(formData.remittanceCharges) || 0;
                const total = baseAmount + gstAmount - tdsAmount - remittanceCharges;
                return total.toLocaleString('en-IN', { minimumFractionDigits: 2 });
              })()}
            </span>
          </div>
          <div className="text-xs text-gray-600 mt-1">
            (Base Amount + GST - TDS - Remittance)
          </div>
        </div>

        {/* Additional Fields - Compact Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="form-label">Country *</label>
            <MobileSelect
              name="country"
              value={formData.country}
              onChange={handleChange}
              required
              className="select-field-compact"
            >
              <option value="">Select</option>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </MobileSelect>
          </div>
          <div>
            <label className="form-label">Service *</label>
            <MobileSelect
              name="service"
              value={formData.service}
              onChange={handleChange}
              required
              className="select-field-compact"
            >
              <option value="">Select</option>
              {services.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </MobileSelect>
          </div>
          <div>
            <label className="form-label">Engagement Type *</label>
            <MobileSelect
              name="engagementType"
              value={formData.engagementType}
              onChange={handleChange}
              required
              className="select-field-compact"
            >
              <option value="">Select</option>
              {engagementTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </MobileSelect>
          </div>
          <div>
            <label className="form-label">Remittance Charges</label>
            <input
              type="number"
              name="remittanceCharges"
              value={formData.remittanceCharges}
              onChange={handleChange}
              step="0.01"
              placeholder="0.00"
              className="input-field-compact"
            />
          </div>
        </div>

        {/* Collapsible Additional Information */}
        <div className="border-t border-slate-200 pt-1">
          <button
            type="button"
            onClick={() => setShowAdditionalInfo(!showAdditionalInfo)}
            className="accordion-header w-full"
          >
            <span>Additional Information</span>
            <span>{showAdditionalInfo ? '−' : '+'}</span>
          </button>
          <div className={`accordion-content ${showAdditionalInfo ? 'max-h-20 mt-1' : 'max-h-0'}`}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Invoice Number</label>
                <input
                  type="text"
                  name="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={handleChange}
                  placeholder="Enter invoice number"
                  className="input-field-compact"
                />
              </div>
              <div>
                <label className="form-label">Bank Account</label>
                <input
                  type="text"
                  name="bankAccount"
                  value={formData.bankAccount}
                  onChange={handleChange}
                  placeholder="Enter bank account"
                  className="input-field-compact"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary px-5 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary px-5 py-2 text-sm"
          >
            {revenue ? 'Update' : 'Create'} Revenue
          </button>
        </div>
      </form>
    </div>
  );
};

export default RevenueForm;
