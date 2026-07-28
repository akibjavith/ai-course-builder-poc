import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import Button from './ui/Button.jsx';

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
            <Button variant="ghost" onClick={onClose}>
              {cancelText}
            </Button>
          )}
          <Button
            variant={
              type === 'warning' ? 'warning' :
              type === 'success' ? 'success' :
              type === 'confirm' ? 'indigo' :
              'primary'
            }
            onClick={() => {
              if (onConfirm) onConfirm();
              else onClose();
            }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
