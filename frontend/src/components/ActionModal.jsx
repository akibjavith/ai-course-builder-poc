import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export default function ActionModal({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  type = 'info', // 'info', 'warning', 'success', 'confirm'
  onConfirm, 
  confirmText = 'OK', 
  cancelText = 'Cancel',
  icon: CustomIcon
}) {
  if (!isOpen) return null;

  const icons = {
    info: <Info className="w-6 h-6 text-sky-600" />,
    warning: <AlertCircle className="w-6 h-6 text-amber-500" />,
    success: <CheckCircle2 className="w-6 h-6 text-emerald-500" />,
    confirm: <AlertCircle className="w-6 h-6 text-indigo-500" />
  };

  const Icon = CustomIcon || icons[type] || icons.info;

  const isConfirm = type === 'confirm' || !!onConfirm;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 md:p-8">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-2xl ${
              type === 'warning' ? 'bg-amber-50' : 
              type === 'success' ? 'bg-emerald-50' : 
              type === 'confirm' ? 'bg-indigo-50' : 'bg-sky-50'
            }`}>
              {Icon}
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
          
          <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
            {message}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end">
          {isConfirm && (
            <button 
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition"
            >
              {cancelText}
            </button>
          )}
          <button 
            onClick={() => {
              if (onConfirm) onConfirm();
              else onClose();
            }}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition active:scale-95 ${
              type === 'warning' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100' :
              type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100' :
              type === 'confirm' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' :
              'bg-sky-600 hover:bg-sky-700 shadow-sky-100'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
