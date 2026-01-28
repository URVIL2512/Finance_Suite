# Filter System Integration Example

## Quick Start: Adding Filters to Payment Page

This guide shows exactly how to integrate the global filter system into the Payment Management page.

---

## Step-by-Step Integration

### 1. Import Required Dependencies

Add these imports at the top of your `Payment.jsx` file:

```jsx
import { useEffect, useState } from 'react';
import { useFilter } from '../contexts/FilterContext';
import FilterButton from '../components/FilterButton';
import { applyFilters, getFieldMap } from '../utils/filterUtils';
```

### 2. Update Your Component State

```jsx
const Payment = () => {
  // Existing state
  const [payments, setPayments] = useState([]);
  
  // NEW: Add filtered data state
  const [filteredPayments, setFilteredPayments] = useState([]);
  
  // NEW: Get filter functions
  const { getActiveFilters } = useFilter();
  
  // NEW: Define module name
  const MODULE_NAME = 'payments';
  
  // NEW: Get field mapping
  const fieldMap = getFieldMap(MODULE_NAME);
  
  // ... rest of your component
};
```

### 3. Add Filter Logic

Add this useEffect hook after your data fetch logic:

```jsx
// Apply filters whenever payments or filters change
useEffect(() => {
  const filters = getActiveFilters(MODULE_NAME);
  const filtered = applyFilters(payments, filters, fieldMap);
  setFilteredPayments(filtered);
}, [payments, getActiveFilters]);
```

### 4. Update Your JSX

Replace your existing header section with:

```jsx
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-2xl font-bold text-gray-900">Payment Management</h1>
    <p className="text-sm text-gray-500 mt-1">
      Track and manage payments for invoices
    </p>
  </div>
  
  <div className="flex items-center gap-3">
    {/* NEW: Add Filter Button */}
    <FilterButton module={MODULE_NAME} />
    
    {/* Your existing buttons */}
    <button className="btn-primary">
      + Add Payment
    </button>
  </div>
</div>
```

### 5. Use Filtered Data in Your Table

Replace `payments.map()` with `filteredPayments.map()`:

```jsx
<tbody>
  {filteredPayments.map((payment) => (
    <tr key={payment._id}>
      {/* Your existing table cells */}
      <td>{payment.paymentNumber}</td>
      <td>{payment.customerName}</td>
      <td>{payment.amount}</td>
      <td>{payment.paymentMode}</td>
      <td>{payment.status}</td>
    </tr>
  ))}
</tbody>

{/* Add empty state for no results */}
{filteredPayments.length === 0 && (
  <div className="text-center py-8">
    <p className="text-gray-500">
      {payments.length === 0 
        ? 'No payments found' 
        : 'No payments match your filters'}
    </p>
  </div>
)}
```

---

## Complete Payment.jsx Example

```jsx
import { useEffect, useState } from 'react';
import { useFilter } from '../contexts/FilterContext';
import FilterButton from '../components/FilterButton';
import { applyFilters, getFieldMap } from '../utils/filterUtils';
import { paymentAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

const Payment = () => {
  // State
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Hooks
  const { showToast } = useToast();
  const { getActiveFilters } = useFilter();
  
  // Filter setup
  const MODULE_NAME = 'payments';
  const fieldMap = getFieldMap(MODULE_NAME);
  
  // Fetch payments
  useEffect(() => {
    fetchPayments();
  }, []);
  
  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await paymentAPI.getAll();
      setPayments(response.data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      showToast('Failed to load payments', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Apply filters
  useEffect(() => {
    const filters = getActiveFilters(MODULE_NAME);
    const filtered = applyFilters(payments, filters, fieldMap);
    setFilteredPayments(filtered);
  }, [payments, getActiveFilters]);
  
  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }
  
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track and manage payments for invoices
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <FilterButton module={MODULE_NAME} />
          <button 
            onClick={() => {/* Your add payment logic */}}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            + Add Payment
          </button>
        </div>
      </div>
      
      {/* Stats Cards (Optional) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Payments</p>
          <p className="text-2xl font-bold text-gray-900">{payments.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Filtered Results</p>
          <p className="text-2xl font-bold text-blue-600">{filteredPayments.length}</p>
        </div>
        {/* Add more stat cards */}
      </div>
      
      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
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
                Payment Mode
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredPayments.map((payment) => (
              <tr key={payment._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                  {payment.paymentNumber}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {payment.invoiceNumber}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {payment.customerName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(payment.paymentDate).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  INR {payment.amount.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {payment.paymentMode}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    payment.status === 'Paid' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {payment.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <button className="text-blue-600 hover:text-blue-900 mr-3">
                    View
                  </button>
                  <button className="text-red-600 hover:text-red-900">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Empty State */}
        {filteredPayments.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {payments.length === 0 ? 'No payments found' : 'No payments match your filters'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {payments.length === 0 
                ? 'Get started by creating a new payment.' 
                : 'Try adjusting your filter criteria.'}
            </p>
          </div>
        )}
      </div>
      
      {/* Pagination (Optional) */}
      {filteredPayments.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {filteredPayments.length} of {payments.length} payments
          </div>
          {/* Add pagination controls if needed */}
        </div>
      )}
    </div>
  );
};

export default Payment;
```

---

## Available Filters for Payment Module

When users click the Filter button on the Payment page, they'll see:

1. **Search** - Text input to search across all fields
2. **Status** - Dropdown: All, Paid, Pending, Failed
3. **Payment Mode** - Dropdown: All, Bank Transfer, Cash, Other
4. **Payment Date Range** - Date picker with From and To dates
5. **Amount Range** - Numeric inputs for Min and Max amount

---

## Testing Your Integration

### Test Checklist:

1. **Basic Display**
   - [ ] Filter button appears in header
   - [ ] Button shows filter icon
   - [ ] Button styling matches design system

2. **Filter Drawer**
   - [ ] Clicking button opens drawer from right
   - [ ] Drawer shows "Filter Payments" title
   - [ ] All 5 filter fields are visible
   - [ ] Backdrop appears behind drawer
   - [ ] Clicking backdrop closes drawer
   - [ ] X button closes drawer

3. **Filter Functionality**
   - [ ] Search filter works across all fields
   - [ ] Status dropdown filters correctly
   - [ ] Payment Mode dropdown filters correctly
   - [ ] Date range filters work (from, to, both)
   - [ ] Amount range filters work (min, max, both)
   - [ ] Multiple filters work together (AND logic)

4. **User Experience**
   - [ ] "Apply Filters" button applies all filters
   - [ ] Table updates instantly after applying
   - [ ] "Clear All" button resets all filters
   - [ ] Filter count badge shows active filter count
   - [ ] Empty state shows when no results
   - [ ] Filters persist after page refresh

5. **Edge Cases**
   - [ ] Works with empty data array
   - [ ] Works with 1 item in array
   - [ ] Works with 1000+ items (performance)
   - [ ] Handles null/undefined values gracefully
   - [ ] Date format parsing works correctly
   - [ ] Number parsing works correctly

---

## Customizing Filter Behavior

### Change Field Mappings

If your payment data structure is different, update the field map in `filterUtils.js`:

```javascript
payments: {
  customer: 'client.name',        // Nested field access
  status: 'paymentStatus',         // Different field name
  paymentMode: 'mode',             // Different field name
  dateRange: 'date',               // Different field name
  amountRange: 'totalAmount',      // Different field name
},
```

### Add Custom Filter Logic

To add custom filtering for a specific field, update `applyFilters` in `filterUtils.js`:

```javascript
switch (filterKey) {
  // ... existing cases
  
  case 'customField':
    return handleCustomFilter(itemValue, filterValue);
}

// Add your custom handler
const handleCustomFilter = (itemValue, filterValue) => {
  // Your custom logic here
  return true or false;
};
```

---

## Common Issues & Solutions

### Issue: Filters not working
**Solution**: Check that MODULE_NAME matches the key in `filterConfig.js`

### Issue: Fields not filtering
**Solution**: Verify fieldMap in `filterUtils.js` maps to correct data fields

### Issue: Filters not persisting
**Solution**: localStorage might be full or disabled. Clear browser data.

### Issue: Date filtering not working
**Solution**: Ensure dates are in ISO format or valid Date string

### Issue: Number filtering not working
**Solution**: Ensure values are numbers, not strings. Use `parseFloat()` if needed.

---

## Performance Tips

1. **Large Datasets**: Consider server-side filtering for 10,000+ items
2. **Debounce Search**: Add debounce to text input for better UX
3. **Memoization**: Use React.memo for table rows
4. **Virtual Scrolling**: For very large tables, use react-window
5. **Lazy Loading**: Load data in batches as user scrolls

---

## That's It!

You've successfully integrated the global filter system into your Payment page. The same steps work for any other module in your dashboard!

🎉 **Your filters are now live and working!**
