import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown, Check, LayoutGrid,
  HeartPulse, ShoppingBag, Hotel, Utensils, Users, Truck, Trophy, Dumbbell,
  ShoppingBasket, Wrench, Car, Hammer, Stethoscope, Scale, Calculator, HardHat,
  Gem, Shirt, Landmark, GraduationCap, BedDouble, Languages, Package, Cross,
  Tag,
} from 'lucide-react';

/**
 * Map each category to a Lucide icon. Unknown categories fall back to a generic tag.
 */
const CATEGORY_ICON = {
  // Nationwide (PK/SA)
  'Health & Emergency':     HeartPulse,
  'Commercial & Retail':    ShoppingBag,
  'Tourism & Hospitality':  Hotel,
  'Food & Beverage':        Utensils,
  'Spiritual & Social':     Users,
  'Logistics & Finance':    Truck,
  'Entertainment & Sports': Trophy,
  'Gyms & Fitness':         Dumbbell,
  // GroceryStore (UK/FR)
  'Halal Groceries & Butchers': ShoppingBasket,
  'Car Mechanics':          Wrench,
  'Car Rentals':            Car,
  'Repair Shops':           Hammer,
  'Doctors':                Stethoscope,
  'Lawyers':                Scale,
  'Accountants':            Calculator,
  'Engineers':              HardHat,
  'Gold & Jewelry':         Gem,
  'Islamic Fashion':        Shirt,
  'Halal Gyms':             Dumbbell,
  'Mosques':                Landmark,
  'Islamic Schools':        GraduationCap,
  'Halal Hotels':           BedDouble,
  'Translation Services':   Languages,
  'Shipping Services':      Package,
  'Islamic Funeral Services': Cross,
};

export function categoryIcon(name) {
  return CATEGORY_ICON[name] || Tag;
}

export function CategorySelect({
  label,
  value,
  onChange,
  options = [],
  includeAll = true,
  placeholder = 'Select category',
  id = 'category-select',
  disabled = false,
  ...rest
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = includeAll
    ? [{ value: 'all', label: 'All categories', __icon: LayoutGrid }, ...options.map((o) => normalize(o))]
    : options.map((o) => normalize(o));

  function normalize(o) {
    if (typeof o === 'string') return { value: o, label: o, __icon: categoryIcon(o) };
    return { ...o, __icon: o.__icon || categoryIcon(o.label || o.value) };
  }

  const current = items.find((it) => it.value === value) || (includeAll ? items[0] : null);
  const CurrentIcon = current?.__icon || Tag;

  return (
    <div className="mb-1">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <div ref={rootRef} className="relative">
        <button
          id={id}
          type="button"
          onClick={() => !disabled && setOpen((v) => !v)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          {...rest}
          style={{
            background: 'var(--bg-surface)',
            border: `1px solid ${open ? 'var(--accent)' : 'var(--border-subtle)'}`,
            color: 'var(--text-primary)',
            boxShadow: open ? '0 0 0 3px var(--accent-soft)' : 'none',
          }}
          className="w-full flex items-center justify-between gap-2 pl-3 pr-2.5 py-2 rounded-md text-sm font-medium transition-all duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed hover:[border-color:var(--border-strong)]"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <CurrentIcon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            <span className="truncate">{current ? current.label : placeholder}</span>
          </span>
          <ChevronDown
            className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-muted)' }}
          />
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute z-20 mt-1 left-0 right-0 rounded-md overflow-hidden animate-fade-in-up"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div className="max-h-64 overflow-y-auto py-1">
              {items.length === 0 && (
                <div className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  No categories available
                </div>
              )}
              {items.map((opt) => {
                const selected = opt.value === value;
                const Icon = opt.__icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    style={{
                      background: selected ? 'var(--accent-soft)' : 'transparent',
                      color: selected ? 'var(--accent)' : 'var(--text-primary)',
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors duration-100 hover:[background:var(--bg-subtle)]"
                  >
                    <Icon
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: selected ? 'var(--accent)' : 'var(--text-muted)' }}
                    />
                    <span className="flex-1 truncate">{opt.label}</span>
                    {selected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
