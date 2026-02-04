import { useState, useRef, useEffect } from 'react';

/**
 * SearchableDropdown Component
 * 
 * A professional, reusable dropdown with search, keyboard navigation, and smooth animations
 * 
 * @param {Array} options - Array of options to display
 * @param {String} value - Currently selected value
 * @param {Function} onChange - Callback when value changes
 * @param {String} placeholder - Placeholder text
 * @param {Boolean} disabled - Whether dropdown is disabled
 * @param {String} className - Additional CSS classes
 * @param {String} emptyMessage - Message when no options available
 */
const SearchableDropdown = ({
  options = [],
  value = '',
  onChange,
  placeholder = 'Search...',
  disabled = false,
  className = '',
  emptyMessage = 'No options available',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const dropdownRef = useRef(null);

  // Filter options based on search text
  useEffect(() => {
    if (searchText.trim() === '') {
      setFilteredOptions(options);
    } else {
      const filtered = options.filter((option) =>
        option.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredOptions(filtered);
    }
  }, [searchText, options]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchText('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchText('');
    } else if (e.key === 'Enter' && filteredOptions.length > 0) {
      e.preventDefault();
      handleSelect(filteredOptions[0]);
    }
  };

  const handleSelect = (option) => {
    onChange(option);
    setIsOpen(false);
    setSearchText('');
  };

  const handleFocus = () => {
    if (!disabled && options.length > 0) {
      setIsOpen(true);
      setSearchText('');
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Input Field */}
      <input
        type="text"
        value={isOpen ? searchText : value}
        onChange={(e) => {
          setSearchText(e.target.value);
          setIsOpen(true);
        }}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={value || placeholder}
        disabled={disabled || options.length === 0}
        className={`w-full text-sm py-2 pr-8 transition-all duration-200 ${
          disabled || options.length === 0
            ? 'input-field bg-gray-50 cursor-not-allowed'
            : 'input-field cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
        }`}
        style={{ cursor: disabled || options.length === 0 ? 'not-allowed' : 'pointer' }}
      />

      {/* Dropdown Arrow Icon */}
      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

      {/* Dropdown Menu */}
      {isOpen && filteredOptions.length > 0 && (
        <div
          className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-2xl animate-slideDown"
          style={{ maxHeight: '240px', overflowY: 'auto' }}
        >
          {filteredOptions.map((option, index) => (
            <div
              key={option}
              onClick={() => handleSelect(option)}
              className={`px-4 py-2.5 cursor-pointer text-sm transition-colors duration-150 ${
                value === option
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-blue-50'
              } ${index === 0 ? 'rounded-t-lg' : ''} ${
                index === filteredOptions.length - 1 ? 'rounded-b-lg' : ''
              }`}
              style={{ cursor: 'pointer' }}
            >
              <div className="flex items-center justify-between">
                <span>{option}</span>
                {value === option && (
                  <svg
                    className="w-4 h-4 text-blue-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Results Message */}
      {isOpen && filteredOptions.length === 0 && searchText && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-2xl p-4 text-center text-sm text-gray-500 animate-slideDown">
          No results found for "{searchText}"
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;
