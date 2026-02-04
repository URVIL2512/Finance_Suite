import { format } from 'date-fns';
import ActionDropdown from './ActionDropdown';

const PaymentTable = ({ payments, onEdit, onDelete, onView, onViewHistory, onViewPDF }) => {
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount) => {
    return `INR ${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  if (!payments || payments.length === 0) {
    return (
      <div className="card-gradient p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">No Payments</h2>
        <p className="text-gray-600">No payments have been recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="card-gradient overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="table-header">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Payment #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invoice
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Payment Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Payment Mode
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payments.map((payment) => (
              <tr key={payment._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {payment.paymentNumber}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {onViewHistory && payment.invoice ? (
                    <button
                      onClick={() => onViewHistory(payment.invoice)}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                    >
                      {payment.invoice.invoiceNumber}
                    </button>
                  ) : (
                    <span>{payment.invoice?.invoiceNumber || 'N/A'}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div>
                    {payment.customer?.displayName || payment.customer?.companyName || payment.customer?.clientName || 'N/A'}
                    {payment.customer?.pan && (
                      <span className="text-xs text-gray-500 ml-2">(PAN: {payment.customer.pan})</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(payment.paymentDate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                  {formatCurrency(payment.amountReceived)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {payment.hasDepartmentSplit && payment.departmentSplits && payment.departmentSplits.length > 0 ? (
                    <div className="space-y-1">
                      {payment.departmentSplits.map((split, index) => (
                        <div key={index} className="flex justify-between items-center bg-purple-50 px-2 py-1 rounded text-xs">
                          <span className="font-medium text-purple-700">{split.departmentName}</span>
                          <span className="font-semibold text-purple-900">₹{split.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs italic">No splits</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {payment.paymentMode} / {payment.depositTo}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {payment.status === 'Paid' ? (
                    <span className="badge-success">{payment.status}</span>
                  ) : (
                    <span className="badge-neutral">{payment.status}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end">
                    <ActionDropdown
                      onView={onView ? () => onView(payment) : null}
                      onEdit={onEdit ? () => onEdit(payment) : null}
                      onDelete={onDelete ? () => onDelete(payment._id) : null}
                      additionalActions={onViewPDF && payment.invoice ? [{
                        label: 'PDF',
                        icon: (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        ),
                        onClick: () => onViewPDF(payment.invoice._id || payment.invoice),
                        className: 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                      }] : []}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PaymentTable;
