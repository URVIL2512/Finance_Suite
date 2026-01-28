# Global Filter System - UI Component Guide

## 🎨 Visual Component Breakdown

This guide shows the exact UI components, their styling, and how they work together.

---

## 1. Filter Button Component

### Visual Appearance
```
┌─────────────────────┐
│  🔍 Filters    (2)  │
└─────────────────────┘
```

### Component Structure
```jsx
<button>
  <FilterIcon />        // SVG funnel icon
  <span>Filters</span>  // Text label
  <Badge>2</Badge>      // Active count (conditional)
</button>
```

### Styling Classes
```css
.filter-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;              /* 8px */
  padding: 0.5rem 1rem;     /* 8px 16px */
  border: 1px solid #D1D5DB;
  border-radius: 0.375rem;  /* 6px */
  background: white;
  color: #374151;
  font-size: 0.875rem;      /* 14px */
  font-weight: 500;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: background-color 0.2s;
}

.filter-button:hover {
  background-color: #F9FAFB;
}

.filter-button:focus {
  outline: none;
  ring: 2px solid #3B82F6;
  ring-offset: 2px;
}
```

### Active Count Badge
```css
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.125rem 0.5rem;  /* 2px 8px */
  font-size: 0.75rem;        /* 12px */
  font-weight: 700;
  color: white;
  background-color: #3B82F6;
  border-radius: 9999px;     /* Fully rounded */
}
```

---

## 2. Filter Drawer Component

### Visual Layout
```
┌─────────────────────────────────────────────┐
│  Filter Invoices              (2 filters)  ✕│ ← Header
├─────────────────────────────────────────────┤
│                                              │
│  Search                                      │ ← Scrollable
│  ┌────────────────────────────────────────┐│   Filter
│  │ Search by invoice number, client...    ││   Fields
│  └────────────────────────────────────────┘│
│                                              │
│  Status                                      │
│  ┌────────────────────────────────────────┐│
│  │ All Statuses               ▼           ││
│  └────────────────────────────────────────┘│
│                                              │
│  Date Range                                  │
│  ┌───────────────┐  ┌───────────────────┐ │
│  │ From          │  │ To                │  │
│  │ 2026-01-01    │  │ 2026-01-31        │  │
│  └───────────────┘  └───────────────────┘  │
│                                              │
│  Amount Range                                │
│  ┌───────────────┐  ┌───────────────────┐  │
│  │ Min: 0        │  │ Max: ∞            │  │
│  └───────────────┘  └───────────────────┘  │
│                                              │
├─────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐  │ ← Footer
│  │       Apply Filters                   │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │       Clear All                       │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
    384px wide (w-96)
```

### Component Structure
```jsx
<>
  {/* Backdrop */}
  <div className="backdrop" onClick={closeDrawer} />
  
  {/* Drawer */}
  <div className="drawer">
    {/* Header */}
    <div className="header">
      <div>
        <h2>Filter Invoices</h2>
        <p>2 filters active</p>
      </div>
      <button className="close-button">✕</button>
    </div>
    
    {/* Scrollable Content */}
    <div className="content">
      {/* Filter fields render here */}
    </div>
    
    {/* Footer */}
    <div className="footer">
      <button className="apply-button">Apply Filters</button>
      <button className="clear-button">Clear All</button>
    </div>
  </div>
</>
```

### Drawer Styling
```css
/* Backdrop */
.backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 40;
  transition: opacity 300ms;
}

/* Drawer Container */
.drawer {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 24rem;              /* 384px */
  background-color: white;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
              0 10px 10px -5px rgba(0, 0, 0, 0.04);
  z-index: 50;
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 300ms ease-in-out;
}

.drawer.open {
  transform: translateX(0);
}
```

### Header Styling
```css
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #E5E7EB;
  background: linear-gradient(to right, #EFF6FF, white);
}

.header h2 {
  font-size: 1.125rem;      /* 18px */
  font-weight: 700;
  color: #111827;
}

.header p {
  font-size: 0.875rem;      /* 14px */
  color: #6B7280;
  margin-top: 0.25rem;
}

.close-button {
  color: #9CA3AF;
  cursor: pointer;
  transition: color 0.2s;
}

.close-button:hover {
  color: #4B5563;
}
```

### Content Area Styling
```css
.content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;              /* 20px between fields */
}

.filter-field {
  display: flex;
  flex-direction: column;
}

.filter-field label {
  font-size: 0.875rem;       /* 14px */
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.filter-field input,
.filter-field select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #D1D5DB;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.2s;
}

.filter-field input:focus,
.filter-field select:focus {
  outline: none;
  border-color: #3B82F6;
  ring: 2px solid #3B82F6;
}
```

### Footer Styling
```css
.footer {
  border-top: 1px solid #E5E7EB;
  padding: 1.5rem;
  background-color: #F9FAFB;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.apply-button {
  width: 100%;
  padding: 0.625rem 1rem;
  background-color: #3B82F6;
  color: white;
  border-radius: 0.375rem;
  font-weight: 500;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: background-color 0.2s;
}

.apply-button:hover {
  background-color: #2563EB;
}

.clear-button {
  width: 100%;
  padding: 0.625rem 1rem;
  background-color: white;
  color: #374151;
  border: 1px solid #D1D5DB;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.clear-button:hover {
  background-color: #F9FAFB;
}
```

---

## 3. Filter Field Types

### Text Input
```
┌─────────────────────────────────────────┐
│ Search by invoice number, client...     │
└─────────────────────────────────────────┘
```

```jsx
<input
  type="text"
  placeholder="Search by invoice number, client..."
  className="w-full px-3 py-2 border border-gray-300 rounded-md 
             focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
/>
```

### Select Dropdown
```
┌─────────────────────────────────────────┐
│ All Statuses                  ▼         │
├─────────────────────────────────────────┤
│ All Statuses                            │
│ Paid                                    │
│ Unpaid                                  │
│ Partial                                 │
│ Overdue                                 │
└─────────────────────────────────────────┘
```

```jsx
<select className="w-full px-3 py-2 border border-gray-300 rounded-md">
  <option value="">All Statuses</option>
  <option value="Paid">Paid</option>
  <option value="Unpaid">Unpaid</option>
  <option value="Partial">Partial</option>
  <option value="Overdue">Overdue</option>
</select>
```

### Date Range
```
From                    To
┌──────────────┐       ┌──────────────┐
│ 2026-01-01   │       │ 2026-01-31   │
└──────────────┘       └──────────────┘
```

```jsx
<div className="grid grid-cols-2 gap-2">
  <div>
    <label className="block text-xs text-gray-500 mb-1">From</label>
    <input type="date" className="w-full px-3 py-2 border rounded-md" />
  </div>
  <div>
    <label className="block text-xs text-gray-500 mb-1">To</label>
    <input type="date" className="w-full px-3 py-2 border rounded-md" />
  </div>
</div>
```

### Amount Range
```
Min                     Max
┌──────────────┐       ┌──────────────┐
│ 0            │       │ ∞            │
└──────────────┘       └──────────────┘
```

```jsx
<div className="grid grid-cols-2 gap-2">
  <div>
    <label className="block text-xs text-gray-500 mb-1">Min</label>
    <input type="number" placeholder="0" className="w-full px-3 py-2 border rounded-md" />
  </div>
  <div>
    <label className="block text-xs text-gray-500 mb-1">Max</label>
    <input type="number" placeholder="∞" className="w-full px-3 py-2 border rounded-md" />
  </div>
</div>
```

---

## 4. Animation States

### Opening Animation
```
Frame 1 (0ms):    Closed, translateX(100%)
Frame 2 (150ms):  Halfway, translateX(50%)
Frame 3 (300ms):  Open, translateX(0%)
```

```css
@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}
```

### Closing Animation
```
Frame 1 (0ms):    Open, translateX(0%)
Frame 2 (150ms):  Halfway, translateX(50%)
Frame 3 (300ms):  Closed, translateX(100%)
```

### Backdrop Fade
```css
.backdrop {
  transition: opacity 300ms;
  opacity: 0;
}

.backdrop.open {
  opacity: 0.5;
}
```

---

## 5. Responsive Breakpoints

### Desktop (1024px+)
```
- Drawer: 384px fixed width
- Full height
- Right-aligned
- Backdrop: Full screen
```

### Tablet (768px - 1023px)
```
- Drawer: 384px fixed width
- Full height
- Right-aligned
- Backdrop: Full screen
```

### Mobile (< 768px) - Future Enhancement
```
- Drawer: Full width
- Full height
- Bottom sheet style (optional)
- Backdrop: Full screen
```

---

## 6. Color Palette

### Primary Colors
```css
--blue-50:  #EFF6FF  (Header background)
--blue-100: #DBEAFE
--blue-500: #3B82F6  (Primary buttons, badges)
--blue-600: #2563EB  (Button hover)
--blue-700: #1D4ED8
```

### Gray Scale
```css
--gray-50:  #F9FAFB  (Footer background, hover states)
--gray-100: #F3F4F6
--gray-200: #E5E7EB  (Borders)
--gray-300: #D1D5DB  (Input borders)
--gray-400: #9CA3AF
--gray-500: #6B7280  (Secondary text)
--gray-600: #4B5563
--gray-700: #374151  (Primary text)
--gray-900: #111827  (Headings)
```

### Semantic Colors
```css
--green-100: #D1FAE5  (Success background)
--green-800: #065F46  (Success text)
--red-100:   #FEE2E2  (Error background)
--red-800:   #991B1B  (Error text)
--yellow-100: #FEF3C7 (Warning background)
--yellow-800: #92400E (Warning text)
```

---

## 7. Spacing System

### Padding/Margin Scale
```css
xs:  4px   (0.25rem)
sm:  8px   (0.5rem)
md:  12px  (0.75rem)
lg:  16px  (1rem)
xl:  20px  (1.25rem)
2xl: 24px  (1.5rem)
3xl: 32px  (2rem)
```

### Component Spacing
```css
Header padding:        24px (1.5rem)
Content padding:       24px (1.5rem)
Footer padding:        24px (1.5rem)
Field gap:             20px (1.25rem)
Button gap:            12px (0.75rem)
Label margin-bottom:   8px  (0.5rem)
```

---

## 8. Typography

### Font Family
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, 
             "Helvetica Neue", Arial, sans-serif;
```

### Font Sizes
```css
xs:   12px  (0.75rem)  - Badge text, helper text
sm:   14px  (0.875rem) - Field labels, secondary text
base: 14px  (0.875rem) - Body text, inputs
md:   14px  (0.875rem) - Subheadings
lg:   18px  (1.125rem) - Drawer title
xl:   20px  (1.25rem)  - Page titles
2xl:  24px  (1.5rem)   - Main headings
```

### Font Weights
```css
regular: 400  - Body text
medium:  500  - Labels, buttons
semibold: 600 - Emphasis
bold:    700  - Headings
```

---

## 9. Shadows

### Component Shadows
```css
/* Filter Button */
box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

/* Drawer */
box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
            0 10px 10px -5px rgba(0, 0, 0, 0.04);

/* Input Focus */
box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
```

---

## 10. Cursor Styles

### Interactive Elements
```css
button { cursor: pointer; }
input[type="text"] { cursor: text; }
input[type="date"] { cursor: pointer; }
input[type="number"] { cursor: text; }
select { cursor: pointer; }
.backdrop { cursor: pointer; }
.close-button { cursor: pointer; }
```

---

## 11. Accessibility

### Focus States
```css
button:focus,
input:focus,
select:focus {
  outline: none;
  ring: 2px solid #3B82F6;
  ring-offset: 2px;
}
```

### ARIA Labels
```jsx
<button aria-label="Open filters">
  Filters
</button>

<button aria-label="Close filter drawer">
  ✕
</button>

<div role="dialog" aria-modal="true" aria-labelledby="filter-title">
  <h2 id="filter-title">Filter Invoices</h2>
  {/* ... */}
</div>
```

### Keyboard Navigation
```
Tab:       Navigate between fields
Shift+Tab: Navigate backwards
Enter:     Apply filters (when on button)
Escape:    Close drawer
Space:     Toggle select dropdowns
```

---

## 12. Z-Index Layers
```css
.backdrop      { z-index: 40; }
.drawer        { z-index: 50; }
.dropdown-menu { z-index: 60; }  /* If needed for nested dropdowns */
```

---

## 🎨 Design System Summary

| Element | Value |
|---------|-------|
| **Drawer Width** | 384px (w-96) |
| **Animation Duration** | 300ms |
| **Border Radius** | 6px (rounded-md) |
| **Border Color** | #E5E7EB (gray-200) |
| **Primary Color** | #3B82F6 (blue-500) |
| **Text Color** | #374151 (gray-700) |
| **Backdrop Opacity** | 0.5 |
| **Focus Ring** | 2px solid blue-500 |
| **Shadow** | Soft, subtle depth |

---

## 🚀 Quick Copy-Paste Styles

### Custom CSS (if not using Tailwind)
```css
/* Add to your global styles */
.filter-system {
  --filter-blue: #3B82F6;
  --filter-gray: #6B7280;
  --filter-border: #D1D5DB;
  --filter-bg: #F9FAFB;
}

.filter-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--filter-border);
  border-radius: 0.375rem;
  background: white;
  color: var(--filter-gray);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-button:hover {
  background-color: var(--filter-bg);
}

.filter-drawer {
  position: fixed;
  top: 0;
  right: 0;
  width: 24rem;
  height: 100vh;
  background: white;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  transform: translateX(100%);
  transition: transform 300ms ease-in-out;
  z-index: 50;
}

.filter-drawer.open {
  transform: translateX(0);
}
```

---

## 🎉 Perfect!

You now have a complete visual guide to the filter system's UI components. Use this as a reference for customization or maintaining design consistency.
