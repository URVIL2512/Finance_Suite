import { useState, useEffect, useRef } from 'react';

/**
 * Reusable global search input.
 *
 * Props:
 * - value: controlled search string (optional initial value)
 * - onChange: (debouncedValue: string) => void
 * - placeholder: string
 * - className: extra classes for the outer wrapper
 * - widthClass: override width (defaults to w-64 on desktop, full on mobile)
 * - autoFocus: focus on mount
 * - debounceMs: debounce delay (default 300ms)
 */
const SearchBar = ({
  value = '',
  onChange,
  placeholder = 'Search...',
  className = '',
  widthClass = 'w-full sm:w-64',
  autoFocus = false,
  debounceMs = 300,
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const inputRef = useRef(null);

  // Keep internal state in sync when external value changes (e.g. URL query, navigation)
  useEffect(() => {
    if (value !== undefined && value !== inputValue) {
      setInputValue(value || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Debounce notifying parent about changes
  useEffect(() => {
    if (!onChange) return;

    const handle = setTimeout(() => {
      onChange(inputValue.trim());
    }, debounceMs);

    return () => clearTimeout(handle);
  }, [inputValue, debounceMs, onChange]);

  // Optional autofocus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  // Global keyboard shortcuts: Ctrl+K (or Cmd+K) and '/' to focus search
  useEffect(() => {
    const handler = (event) => {
      const isCtrlK =
        (event.key === 'k' || event.key === 'K') &&
        (event.ctrlKey || event.metaKey);
      const isSlash = event.key === '/' && !event.ctrlKey && !event.metaKey;

      if (!isCtrlK && !isSlash) return;

      const target = event.target;
      const isEditable =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      // Allow typing '/' inside inputs/textareas
      if (isSlash && isEditable) return;

      event.preventDefault();

      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleClear = () => {
    setInputValue('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div
      className={`relative ${widthClass} ${className}`}
    >
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        className="pl-10 pr-9 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-finance-blue focus:border-transparent bg-white text-gray-900 placeholder-gray-400 transition-shadow transition-colors w-full"
      />
      <svg
        className="absolute left-3 top-2.5 w-5 h-5 text-gray-400 pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      {inputValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
          title="Clear search"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export default SearchBar;

