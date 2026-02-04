import { format } from 'date-fns';
import { useState } from 'react';

const RevenueTable = ({ revenue }) => {
  const [viewMode, setViewMode] = useState('pivot'); // 'pivot' or 'list'

  if (revenue.length === 0) {
    return null;
  }

  const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

  // Pivot view should show collections (what you actually received), not invoice totals.
  const getCollectedAmount = (rev) => Number(rev.receivedAmount || 0) || 0;

  // Helper for list view "Total" column: base + GST - TDS - remittance
  const calculateTotal = (rev) => {
    const baseAmount = rev.invoiceAmount || 0;
    const gstAmount = rev.gstAmount || 0;
    const tdsAmount = rev.tdsAmount || 0;
    const remittanceCharges = rev.remittanceCharges || 0;
    return baseAmount + gstAmount - tdsAmount - remittanceCharges;
  };

  // Group revenue by client
  const clientRevenueMap = {};
  revenue.forEach((rev) => {
    const key = `${rev.clientName}_${rev.service}_${rev.country}`;
    if (!clientRevenueMap[key]) {
      clientRevenueMap[key] = {
        clientName: rev.clientName,
        service: rev.service,
        country: rev.country,
        months: {},
        total: 0,
        ids: [], // Store all IDs for this group
        entries: [], // Store all revenue entries for this group
      };
    }
    const collected = getCollectedAmount(rev);
    clientRevenueMap[key].months[rev.month] = (clientRevenueMap[key].months[rev.month] || 0) + collected;
    clientRevenueMap[key].total += collected;
    clientRevenueMap[key].ids.push(rev._id);
    clientRevenueMap[key].entries.push(rev);
  });

  const clients = Object.values(clientRevenueMap);

  if (viewMode === 'pivot') {
    return (
      <div className="card overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-xl font-bold text-gray-900">Client-wise Monthly Revenue</h2>
          <button
            onClick={() => setViewMode('list')}
            className="px-4 py-2 text-sm font-semibold bg-white border-2 border-gray-300 hover:border-gray-400 rounded-lg hover:bg-gray-50 transition-all duration-200"
          >
            Switch to List View
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="table-header">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                  Service
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                  Country
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                  Department
                </th>
                {months.map((month) => (
                  <th
                    key={month}
                    className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider border-r border-white/20"
                  >
                    {month}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
                Total
              </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients.map((client, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r">
                    {client.clientName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r">
                    {client.service}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r">
                    {client.country}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 border-r">
                    {client.entries && client.entries.length > 0 ? (
                      client.entries.some(entry => entry.isDepartmentSplit && entry.departmentName) ? (
                        <div className="space-y-1">
                          {(() => {
                            // Group by department name and sum amounts
                            const deptAmounts = {};
                            client.entries
                              .filter(entry => entry.isDepartmentSplit && entry.departmentName)
                              .forEach(entry => {
                                const collected = getCollectedAmount(entry);
                                if (deptAmounts[entry.departmentName]) {
                                  deptAmounts[entry.departmentName] += collected;
                                } else {
                                  deptAmounts[entry.departmentName] = collected;
                                }
                              });
                            
                            return Object.entries(deptAmounts).map(([deptName, amount], index) => (
                              <div key={index} className="flex justify-between items-center bg-purple-50 px-2 py-1 rounded text-xs">
                                <span className="font-medium text-purple-700">{deptName}</span>
                                <span className="font-semibold text-purple-900">₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                            ));
                          })()}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">No splits</span>
                      )
                    ) : (
                      <span className="text-gray-400 text-xs italic">No splits</span>
                    )}
                  </td>
                  {months.map((month) => (
                    <td
                      key={month}
                      className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 text-right border-r"
                    >
                      {client.months[month] ? `₹${client.months[month].toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                  ))}
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                    ₹{client.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-finance-blue/10 font-semibold">
                <td colSpan={4} className="px-4 py-3 text-sm text-gray-900 border-r">
                  Total
                </td>
                {months.map((month) => {
                  const monthTotal = clients.reduce((sum, client) => sum + (client.months[month] || 0), 0);
                  return (
                    <td
                      key={month}
                      className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 text-right border-r"
                    >
                      ₹{monthTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                  ₹{clients.reduce((sum, client) => sum + client.total, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="card overflow-hidden">
      <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <h2 className="text-xl font-bold text-gray-900">Revenue List</h2>
        <button
          onClick={() => setViewMode('pivot')}
          className="px-4 py-2 text-sm font-semibold bg-white border-2 border-gray-300 hover:border-gray-400 rounded-lg hover:bg-gray-50 transition-all duration-200"
        >
          Switch to Pivot View
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
            <thead className="table-header">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Client
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Country
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Service
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Department
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Base Amount
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider border-r border-white/20">
                GST
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider border-r border-white/20">
                TDS
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Remittance
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Total
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Received
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider">
                Due
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {revenue.map((rev) => {
              const total = calculateTotal(rev);
              return (
              <tr key={rev._id} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {format(new Date(rev.invoiceDate), 'dd/MM/yyyy')}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {rev.clientName}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {rev.country}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {rev.service}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900">
                  {rev.isDepartmentSplit && rev.departmentName ? (
                    <div className="flex justify-between items-center bg-purple-50 px-2 py-1 rounded text-xs">
                      <span className="font-medium text-purple-700">{rev.departmentName}</span>
                      <span className="font-semibold text-purple-900">₹{getCollectedAmount(rev).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs italic">No split</span>
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  ₹{(rev.invoiceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-green-600 text-right">
                  ₹{(rev.gstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-orange-600 text-right">
                  ₹{(rev.tdsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-purple-600 text-right">
                  ₹{(rev.remittanceCharges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                  ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-green-600 text-right">
                  ₹{(rev.receivedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-red-600 text-right">
                  ₹{(rev.dueAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RevenueTable;
