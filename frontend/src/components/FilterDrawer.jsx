import { useEffect, useState } from 'react';
import { useFilter } from '../contexts/FilterContext';
import { filterConfigurations } from '../config/filterConfig';

const FilterDrawer = () => {
  const {
    isFilterDrawerOpen,
    closeFilterDrawer,
    activeModule,
    getActiveFilters,
    updateFilter,
    clearFilter,
    clearAllFilters,
    getActiveFilterCount,
  } = useFilter();

  const [localFilters, setLocalFilters] = useState({});

  // Load active filters when drawer opens
  useEffect(() => {
    if (isFilterDrawerOpen && activeModule) {
      setLocalFilters(getActiveFilters(activeModule));
    }
  }, [isFilterDrawerOpen, activeModule, getActiveFilters]);

  if (!activeModule || !filterConfigurations[activeModule]) {
    return null;
  }

  const config = filterConfigurations[activeModule];
  const activeCount = getActiveFilterCount(activeModule);

  const handleInputChange = (key, value) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApplyFilters = () => {
    // Apply all local filters to the global state
    Object.keys(localFilters).forEach(key => {
      if (localFilters[key] !== null && localFilters[key] !== undefined && localFilters[key] !== '') {
        updateFilter(activeModule, key, localFilters[key]);
      } else {
        clearFilter(activeModule, key);
      }
    });
    closeFilterDrawer();
  };

  const handleClearAll = () => {
    setLocalFilters({});
    clearAllFilters(activeModule);
  };

  const handleClose = () => {
    closeFilterDrawer();
  };

  const renderFilterField = (field) => {
    const value = localFilters[field.key] || '';

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            style={{ cursor: 'text' }}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleInputChange(field.key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            style={{ cursor: 'pointer' }}
          >
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'dateRange':
        const dateRangeValue = value || { from: '', to: '' };
        return (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={dateRangeValue.from || ''}
                onChange={(e) =>
                  handleInputChange(field.key, {
                    ...dateRangeValue,
                    from: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                style={{ cursor: 'pointer' }}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={dateRangeValue.to || ''}
                onChange={(e) =>
                  handleInputChange(field.key, {
                    ...dateRangeValue,
                    to: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                style={{ cursor: 'pointer' }}
              />
            </div>
          </div>
        );

      case 'amountRange':
        const amountRangeValue = value || { min: '', max: '' };
        return (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Min</label>
              <input
                type="number"
                value={amountRangeValue.min || ''}
                onChange={(e) =>
                  handleInputChange(field.key, {
                    ...amountRangeValue,
                    min: e.target.value,
                  })
                }
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                style={{ cursor: 'text' }}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max</label>
              <input
                type="number"
                value={amountRangeValue.max || ''}
                onChange={(e) =>
                  handleInputChange(field.key, {
                    ...amountRangeValue,
                    max: e.target.value,
                  })
                }
                placeholder="∞"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                style={{ cursor: 'text' }}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black transition-opacity z-40 ${
          isFilterDrawerOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleClose}
        style={{ cursor: 'pointer' }}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isFilterDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{config.title}</h2>
            {activeCount > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                {activeCount} filter{activeCount > 1 ? 's' : ''} active
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            style={{ cursor: 'pointer' }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter Fields - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {config.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {field.label}
              </label>
              {renderFilterField(field)}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 space-y-3">
          <button
            onClick={handleApplyFilters}
            className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm"
            style={{ cursor: 'pointer' }}
          >
            Apply Filters
          </button>
          <button
            onClick={handleClearAll}
            className="w-full px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-md font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            style={{ cursor: 'pointer' }}
          >
            Clear All
          </button>
        </div>
      </div>
    </>
  );
};

export default FilterDrawer;
