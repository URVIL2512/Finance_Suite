import { createContext, useContext, useState, useEffect } from 'react';

const FilterContext = createContext();

export const useFilter = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilter must be used within FilterProvider');
  }
  return context;
};

export const FilterProvider = ({ children }) => {
  // Store filters for each module separately
  const [filters, setFilters] = useState({
    invoices: {},
    payments: {},
    expenses: {},
    recurringExpenses: {},
    recurringInvoices: {},
    customers: {},
    items: {},
    vendors: {},
    categories: {},
    paymentModes: {},
    bankAccounts: {},
    departments: {},
    revenue: {},
  });

  // Track which module's filter drawer is open
  const [activeModule, setActiveModule] = useState(null);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Load filters from localStorage on mount
  useEffect(() => {
    try {
      const savedFilters = localStorage.getItem('dashboardFilters');
      if (savedFilters) {
        setFilters(JSON.parse(savedFilters));
      }
    } catch (error) {
      console.error('Error loading filters from localStorage:', error);
    }
  }, []);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('dashboardFilters', JSON.stringify(filters));
    } catch (error) {
      console.error('Error saving filters to localStorage:', error);
    }
  }, [filters]);

  const updateFilter = (module, filterKey, value) => {
    setFilters(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [filterKey]: value
      }
    }));
  };

  const clearFilter = (module, filterKey) => {
    setFilters(prev => {
      const newModuleFilters = { ...prev[module] };
      delete newModuleFilters[filterKey];
      return {
        ...prev,
        [module]: newModuleFilters
      };
    });
  };

  const clearAllFilters = (module) => {
    setFilters(prev => ({
      ...prev,
      [module]: {}
    }));
  };

  const getActiveFilters = (module) => {
    return filters[module] || {};
  };

  const getActiveFilterCount = (module) => {
    const moduleFilters = filters[module] || {};
    return Object.keys(moduleFilters).filter(key => {
      const value = moduleFilters[key];
      return value !== null && value !== undefined && value !== '';
    }).length;
  };

  const openFilterDrawer = (module) => {
    setActiveModule(module);
    setIsFilterDrawerOpen(true);
  };

  const closeFilterDrawer = () => {
    setIsFilterDrawerOpen(false);
    setTimeout(() => setActiveModule(null), 300); // Delay clearing module until animation completes
  };

  const value = {
    filters,
    activeModule,
    isFilterDrawerOpen,
    updateFilter,
    clearFilter,
    clearAllFilters,
    getActiveFilters,
    getActiveFilterCount,
    openFilterDrawer,
    closeFilterDrawer,
  };

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
};
