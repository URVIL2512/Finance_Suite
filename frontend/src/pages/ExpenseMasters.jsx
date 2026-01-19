import { useState } from 'react';
import PaymentModeMaster from './PaymentModeMaster';
import VendorMaster from './VendorMaster';
import BankAccountMaster from './BankAccountMaster';

const ExpenseMasters = () => {
  const [activeTab, setActiveTab] = useState('payment-mode');

  const tabs = [
    { id: 'payment-mode', name: 'Payment Mode', icon: '💳' },
    { id: 'vendor', name: 'Vendor', icon: '🏢' },
    { id: 'bank-account', name: 'Bank Account', icon: '🏦' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'payment-mode':
        return <PaymentModeMaster />;
      case 'vendor':
        return <VendorMaster />;
      case 'bank-account':
        return <BankAccountMaster />;
      default:
        return <PaymentModeMaster />;
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
