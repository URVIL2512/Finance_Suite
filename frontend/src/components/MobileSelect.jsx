import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function getText(node) {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getText).join('');
  if (typeof node === 'object' && 'props' in node) return getText(node.props?.children);
  return '';
}

function flattenOptions(children) {
  const out = [];

  const walk = (childNodes) => {
    (Array.isArray(childNodes) ? childNodes : [childNodes]).forEach((child) => {
      if (!child) return;
      // React can pass arrays of children (e.g. from `{items.map(...)}`).
      // We must recursively flatten them to discover nested <option> nodes.
      if (Array.isArray(child)) {
        walk(child);
        return;
      }
      // React element
      if (typeof child === 'object' && child.type) {
        if (child.type === 'option') {
          out.push({
            value: child.props?.value ?? '',
            label: getText(child.props?.children),
            disabled: !!child.props?.disabled,
          });
          return;
        }
        if (child.type === 'optgroup') {
          walk(child.props?.children);
          return;
        }

        // Support Fragments and wrapper elements that contain <option> nodes.
        // (Common in responsive UIs where options are conditionally rendered.)
        if (child.props?.children) {
          walk(child.props.children);
        }
      }
    });
  };

  walk(children);
  return out;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Mobile-safe Select:
 * - Desktop (md+): render native <select>
 * - Mobile: render a custom dropdown that stays within viewport
 */
const MobileSelect = ({
  value,
  onChange,
  children,
  className,
  disabled,
  name,
  id,
  required,
  forcePortal,
  'aria-label': ariaLabel,
}) => {
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [panelStyle, setPanelStyle] = useState(null);
  const options = useMemo(() => flattenOptions(children), [children]);

  const selected = useMemo(() => {
    const v = value ?? '';
    return options.find((o) => String(o.value) === String(v)) || null;
  }, [options, value]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    const onPointerDown = (e) => {
      const btn = buttonRef.current;
      const list = listRef.current;
      if (!btn || !list) return;
      if (btn.contains(e.target) || list.contains(e.target)) return;
      setOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const btn = buttonRef.current;
    if (!btn) return;

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      const rect = btn.getBoundingClientRect();
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      const width = clamp(rect.width, 180, viewportW - 16);
      const left = clamp(rect.left, 8, viewportW - width - 8);

      // Keep the panel fully inside the viewport (critical for modals).
      const gap = 6;
      const padding = 8; // viewport edge padding
      const topDown = rect.bottom + gap;
      const availDown = Math.max(0, viewportH - topDown - padding);
      const availUp = Math.max(0, rect.top - padding);

      // Prefer opening downward unless there's clearly more room above.
      const openUp = availDown < 200 && availUp > availDown;

      const top = openUp ? undefined : topDown;
      const bottom = openUp ? viewportH - rect.top + gap : undefined;

      const maxAvail = openUp ? availUp : availDown;
      // Cap to a reasonable portion of the screen, but never exceed available space.
      const cap = Math.floor(viewportH * 0.7);
      const maxHeight = Math.min(maxAvail, cap);

      setPanelStyle({
        position: 'fixed',
        left,
        top: openUp ? undefined : top,
        bottom: openUp ? bottom : undefined,
        width,
        maxHeight,
        zIndex: 9999,
      });
    });
  }, [open]);

  const emitChange = (nextValue) => {
    if (!onChange) return;
    // Mimic native event shape: e.target.value
    onChange({ target: { value: nextValue, name, id } });
  };

  // In some modals/native stacking contexts, the browser's native <select> dropdown
  // can appear behind other elements. `forcePortal` lets callers opt into the
  // portal-based dropdown even on desktop.
  if (isDesktop && !forcePortal) {
    return (
      <select
        value={value}
        onChange={onChange}
        className={className}
        disabled={disabled}
        name={name}
        id={id}
        required={required}
        aria-label={ariaLabel}
      >
        {children}
      </select>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${className} flex items-center justify-between gap-3 text-left`}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">
          {selected?.label ?? options.find((o) => String(o.value) === '')?.label ?? 'Select'}
        </span>
        <svg className="w-4 h-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open &&
        panelStyle &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[9998] bg-black/20" onClick={() => setOpen(false)} aria-hidden="true" />
            <div
              ref={listRef}
              style={{
                ...panelStyle,
                WebkitOverflowScrolling: 'touch',
              }}
              className="z-[9999] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white shadow-xl"
              role="listbox"
            >
              {options.map((opt) => {
                const isSelected = String(opt.value) === String(value ?? '');
                return (
                  <button
                    key={`${opt.value}-${opt.label}`}
                    type="button"
                    disabled={opt.disabled}
                    className={`w-full px-4 py-3 text-left text-sm transition min-h-[44px] flex items-center ${
                      opt.disabled
                        ? 'text-slate-300 cursor-not-allowed'
                        : isSelected
                          ? 'bg-slate-100 text-slate-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => {
                      emitChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </>,
          document.body
        )}
    </>
  );
};

export default MobileSelect;

