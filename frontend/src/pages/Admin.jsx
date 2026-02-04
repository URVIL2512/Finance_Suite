import { useState } from 'react';
import AddNewUser from './AdminAddNewUser';
import Users from './Users';
// import { useAuth } from '../contexts/AuthContext';


function Admin() {
  const [activeTab, setActiveTab] = useState('add-user');

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Admin Panel</h1>
        <p className="text-gray-600 text-sm mt-1">
          Manage users, roles, and system configuration.
        </p>
      </div>

      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex flex-wrap gap-4" aria-label="Admin sections">
          <button
            type="button"
            onClick={() => setActiveTab('add-user')}
            className={`whitespace-nowrap py-2 px-4 border-b-2 text-sm font-medium focus:outline-none ${
              activeTab === 'add-user'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            Add New User
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`whitespace-nowrap py-2 px-4 border-b-2 text-sm font-medium focus:outline-none ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            Users Management
          </button>
        </nav>
      </div>

      {activeTab === 'add-user' && <AddNewUser />}
      {activeTab === 'users' && <Users />}
    </div>
  );
}

export default Admin;

