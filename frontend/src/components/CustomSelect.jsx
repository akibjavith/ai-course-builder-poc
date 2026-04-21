import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function CustomSelect({ label, value, options, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className="text-sm font-bold text-gray-700">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-5 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition text-sm text-left ${isOpen ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}`}
        >
          <span className={selectedOption ? 'text-gray-900 font-medium' : 'text-gray-400'}>
            {selectedOption ? selectedOption.label : 'Select...'}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="py-2">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-5 py-3 text-sm transition-colors hover:bg-gray-50 ${value === option.value ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-700'}`}
                >
                  {option.label}
                  {value === option.value && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
