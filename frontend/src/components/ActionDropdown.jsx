import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

const ActionDropdown = ({ 
  onView, 
  onViewHistory,
  onMarkPaid,
  onEdit, 
  onDelete, 
  onActivate, 
  onDeactivate,
  onToggleActive,
  isActive,
  itemId,
  additionalActions = [] // Array of { label, icon, onClick, className }
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'bottom' });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current || typeof window === 'undefined') return;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const dropdownHeight = 200; // Approximate dropdown height
    const dropdownWidth = 192; // w-48 = 192px

    // Check if there's enough space below
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    const shouldPlaceAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

    // Calculate horizontal position (right-aligned to button)
    let left = buttonRect.right - dropdownWidth;
    
    // Ensure dropdown doesn't go off-screen to the left
    if (left < 8) {
      left = 8;
    }
    
    // Ensure dropdown doesn't go off-screen to the right
    if (left + dropdownWidth > viewportWidth - 8) {
      left = viewportWidth - dropdownWidth - 8;
    }

    // Calculate vertical position
    const top = shouldPlaceAbove 
      ? buttonRect.top - dropdownHeight - 8 // 8px gap above
      : buttonRect.bottom + 8; // 8px gap below

    setPosition({
      top,
      left,
      placement: shouldPlaceAbove ? 'top' : 'bottom'
    });
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleClickOutside = (event) => {
      if (
        buttonRef.current && 
        !buttonRef.current.contains(event.target) &&
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Small delay to ensure button is rendered
      setTimeout(updatePosition, 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, updatePosition]);

  // Update position on scroll or resize
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const handleScroll = () => {
      updatePosition();
    };

    const handleResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, updatePosition]);

  const handleAction = (action) => {
    setIsOpen(false);
    if (action) {
      action();
    }
  };

  const hasActions = onView || onViewHistory || onMarkPaid || onEdit || onDelete || onToggleActive || (onActivate && !isActive) || (onDeactivate && isActive) || additionalActions.length > 0;

  if (!hasActions) {
    return null;
  }

  return (
    <>
      <div className="relative inline-block text-left" ref={buttonRef}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>

      {isOpen && typeof document !== 'undefined' && document.body && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-48 rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-gray-200"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            transformOrigin: position.placement === 'top' ? 'bottom right' : 'top right',
          }}
        >
          <div className="py-1" role="menu" aria-orientation="vertical">
            {onViewHistory && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAction(onViewHistory);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors duration-150"
                role="menuitem"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>View History</span>
              </button>
            )}

            {onMarkPaid && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAction(onMarkPaid);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2 transition-colors duration-150"
                role="menuitem"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Mark Paid</span>
              </button>
            )}

            {onView && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAction(onView);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors duration-150"
                role="menuitem"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>View</span>
              </button>
            )}

            {onEdit && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAction(onEdit);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors duration-150"
                role="menuitem"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Edit</span>
              </button>
            )}

            {(onToggleActive || (onActivate && !isActive) || (onDeactivate && isActive)) && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onToggleActive) {
                    handleAction(() => onToggleActive(itemId, isActive));
                  } else if (isActive && onDeactivate) {
                    handleAction(() => onDeactivate(itemId));
                  } else if (!isActive && onActivate) {
                    handleAction(() => onActivate(itemId));
                  }
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2 transition-colors duration-150"
                role="menuitem"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isActive ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  )}
                </svg>
                <span>{isActive ? 'Deactivate' : 'Activate'}</span>
              </button>
            )}

            {additionalActions.length > 0 && (
              <>
                {additionalActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAction(action.onClick);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors duration-150 ${
                      action.className || 'text-gray-700 hover:bg-gray-50'
                    }`}
                    role="menuitem"
                  >
                    {action.icon && <span className="w-4 h-4">{action.icon}</span>}
                    <span>{action.label}</span>
                  </button>
                ))}
              </>
            )}

            {onDelete && (
              <>
                {(onViewHistory || onMarkPaid || onView || onEdit || onToggleActive || additionalActions.length > 0) && (
                  <div className="border-t border-gray-200 my-1"></div>
                )}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAction(onDelete);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 transition-colors duration-150"
                  role="menuitem"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default ActionDropdown;
