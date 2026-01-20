import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import PaymentModeMaster from './PaymentModeMaster';
import VendorMaster from './VendorMaster';
import BankAccountMaster from './BankAccountMaster';
import ExpenseCategoryMaster from './ExpenseCategoryMaster';
import DepartmentMaster from './DepartmentMaster';

const ExpenseMasters = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('payment-mode');

  // Get return path and state from navigation
  const returnPath = location.state?.returnTo;
  const returnState = location.state?.returnState;
  const initialTab = location.state?.activeTab;

  // Set active tab from navigation state
  useEffect(() => {
    if (initialTab && ['payment-mode', 'vendor', 'bank-account', 'category', 'department'].includes(initialTab)) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const tabs = [
    { id: 'payment-mode', name: 'Payment Mode', icon: '💳' },
    { id: 'category', name: 'Category', icon: '🏷️' },
    { id: 'vendor', name: 'Vendor', icon: '🏢' },
    { id: 'bank-account', name: 'Bank Account', icon: '🏦' },
    { id: 'department', name: 'Department', icon: '🏛️' },
  ];

  const renderTabContent = () => {
    const commonProps = {
      returnPath,
      returnState,
    };

    switch (activeTab) {
      case 'payment-mode':
        return <PaymentModeMaster {...commonProps} />;
      case 'category':
        return <ExpenseCategoryMaster {...commonProps} />;
      case 'vendor':
        return <VendorMaster {...commonProps} />;
      case 'bank-account':
        return <BankAccountMaster {...commonProps} />;
      case 'department':
        return <DepartmentMaster {...commonProps} />;
      default:
        return <PaymentModeMaster {...commonProps} />;
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200
                flex items-center space-x-2
              `}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {renderTabContent()}
      </div>
    </div>
  );
};

export default ExpenseMasters;
