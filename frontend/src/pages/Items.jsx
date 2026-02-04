import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { itemAPI } from '../services/api';
import ItemForm from '../components/ItemForm';
import ActionDropdown from '../components/ActionDropdown';
import ConfirmationModal from '../components/ConfirmationModal';
import { useToast } from '../contexts/ToastContext';
import SearchBar from '../components/SearchBar';
import { filterBySearchQuery, moduleSearchConfig } from '../utils/searchUtils';

const Items = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if we came from invoice page and should return after creating item
  const returnPath = location.state?.returnTo;
  const returnState = location.state?.returnState;
  
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });
  const initialSearch =
    typeof window !== 'undefined'
      ? new URLSearchParams(location.search).get('search') || ''
      : '';
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  useEffect(() => {
    fetchItems();
  }, []);

  // Listen for refresh events from import (when invoices are imported, items may be created)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'refreshMasters' || e.type === 'storage') {
        // Refresh items when masters are updated
        fetchItems();
      }
    };

    // Listen for storage events (works across tabs)
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events (works in same tab)
    window.addEventListener('refreshMasters', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('refreshMasters', handleStorageChange);
    };
  }, []);

  // Keep search state in sync with URL query param (?search=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlSearch = params.get('search') || '';
    if (urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
    }
  }, [location.search]);

  const updateSearchInUrl = (value) => {
    const params = new URLSearchParams(location.search);
    if (value && value.trim()) {
      params.set('search', value.trim());
    } else {
      params.delete('search');
    }
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      { replace: true }
    );
  };

  // Auto-show form if coming from invoice page
  useEffect(() => {
    if (returnPath && !showForm && !editingItem) {
      setShowForm(true);
    }
  }, [returnPath]);


  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await itemAPI.getAll();
      setItems(response.data);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      if (editingItem) {
        await itemAPI.update(editingItem._id, formData);
        showToast('Item updated successfully!', 'success');
        handleCancel();
        fetchItems();
      } else {
        await itemAPI.create(formData);
        showToast('Item created successfully!', 'success');
        
        // If we came from invoice page, return there after creating item
        if (returnPath && (returnPath === '/invoices' || returnPath === '/sales')) {
          fetchItems();
          // Small delay to ensure item is saved before navigating
          setTimeout(() => {
            try {
              navigate(returnPath, { 
                state: returnState || { showInvoiceForm: true },
                replace: false
              });
            } catch (error) {
              console.error('Navigation error after save:', error);
              // Fallback: close form and navigate to invoices page
              setShowForm(false);
              setEditingItem(null);
              navigate('/invoices');
            }
          }, 100);
          return;
        } else {
          handleCancel();
          fetchItems();
        }
      }
    } catch (error) {
      console.error('Error saving item:', error);
      const errorMessage = error.response?.data?.message || 'Failed to save item';
      showToast(errorMessage, 'error');
    }
  };

  const handleCancel = () => {
    // If we came from invoice page, return there when canceling
    if (returnPath && (returnPath === '/invoices' || returnPath === '/sales')) {
      console.log('🔄 Canceling item form - navigating back to:', returnPath);
      console.log('Return state:', returnState);
      
      // Close the form first
      setShowForm(false);
      setEditingItem(null);
      
      // Then navigate back with state
      try {
        navigate(returnPath, { 
          state: returnState || { showInvoiceForm: true },
          replace: false
        });
      } catch (error) {
        console.error('Navigation error on cancel:', error);
        // Fallback: navigate without state
        navigate(returnPath);
      }
      return;
    }
    
    // Normal cancel - just close the form
    setShowForm(false);
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    setDeleteConfirm({ show: true, id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    try {
      await itemAPI.delete(deleteConfirm.id);
      showToast('Item deleted successfully!', 'success');
      setDeleteConfirm({ show: false, id: null });
      fetchItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      showToast('Failed to delete item', 'error');
      setDeleteConfirm({ show: false, id: null });
    }
  };

  const filteredItems = filterBySearchQuery(
    items,
    searchQuery,
    moduleSearchConfig.items
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="page-header">
            Items Management
          </h1>
          <p className="page-subtitle">Manage products and services for invoices</p>
        </div>
        {!showForm && (
          <div className="flex items-center gap-3">
            <SearchBar
              value={searchQuery}
              onChange={(val) => {
                setSearchQuery(val);
                updateSearchInUrl(val);
              }}
              placeholder="Search items..."
            />
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary flex items-center space-x-2"
            >
              <span>+</span>
              <span>New Item</span>
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <ItemForm
          item={editingItem}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}

      {!showForm && (
        <>
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-finance-blue"></div>
              <p className="mt-4 text-slate-600 font-medium">Loading items...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="card-gradient p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Items</h2>
              <p className="text-gray-600 mb-6">
                No items created yet. Click &quot;New Item&quot; to get started.
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="card-gradient p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                No results found
              </h2>
              <p className="text-gray-600">
                Try adjusting your search keywords or clearing the search.
              </p>
            </div>
          ) : (
            <div className="card-gradient overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unit
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        HSN/SAC Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Selling Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cost Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sellable
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Purchasable
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created At
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredItems.map((item) => (
                      <tr key={item._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              item.type === 'Service'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {item.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.unit || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.hsnSac || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.sellable
                            ? `INR ${item.sellingPrice?.toFixed(2) || '0.00'}`
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.purchasable
                            ? `INR ${item.costPrice?.toFixed(2) || '0.00'}`
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.sellable ? (
                            <span className="text-green-600 font-semibold">
                              Yes
                            </span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.purchasable ? (
                            <span className="text-green-600 font-semibold">
                              Yes
                            </span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.createdAt
                            ? format(new Date(item.createdAt), 'dd/MM/yyyy')
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end">
                            <ActionDropdown
                              onEdit={() => handleEdit(item)}
                              onDelete={() => handleDelete(item._id)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: null })}
        onConfirm={handleDeleteConfirm}
        title="Confirm Delete"
        message="Are you sure you want to delete this item? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonColor="red"
      />
    </div>
  );
};

export default Items;
