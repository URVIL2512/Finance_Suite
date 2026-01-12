import { format } from 'date-fns';
import ActionDropdown from './ActionDropdown';

const CustomerTable = ({ customers, onEdit, onDelete, onView }) => {
  if (customers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        No customers found. Add your first customer to get started.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="table-header">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                Client Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                Mobile
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                Country
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                GSTIN
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                Created At
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {customers.map((customer) => (
              <tr key={customer._id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {customer.displayName || customer.clientName || '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {customer.email || '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {typeof customer.mobile === 'object' 
                    ? (customer.mobile?.number ? `${customer.mobile.countryCode || ''} ${customer.mobile.number}` : '-')
                    : (customer.mobile || '-')}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {customer.country || customer.billingAddress?.country || '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {customer.gstin || '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {customer.createdAt ? format(new Date(customer.createdAt), 'dd/MM/yyyy') : '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                  <ActionDropdown
                    onView={() => onView(customer)}
                    onEdit={() => onEdit(customer)}
                    onDelete={() => onDelete(customer._id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomerTable;

