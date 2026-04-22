import React from 'react';
import { Check } from 'lucide-react';

const steps = [
  'Source',
  'Details',
  'Structure',
  'Content',
  'Publish'
];

export default function Stepper({ currentStep }) {
  return (
    <div className="mb-12">
      <nav aria-label="Progress">
        <ol role="list" className="flex items-center justify-between max-w-2xl mx-auto">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isCompleted = currentStep > stepNumber;
            const isCurrent = currentStep === stepNumber;
            
            return (
              <li key={step} className="relative flex-1 last:flex-none">
                <div className="absolute inset-0 flex items-center pr-10" aria-hidden="true">
                  <div className={`h-0.5 w-full ${isCompleted ? 'bg-sky-600' : 'bg-slate-200'}`} />
                </div>
                <div className="relative flex flex-col items-center group">
                  <span
                    className={`h-10 w-10 rounded-full flex items-center justify-center ring-8 ring-white transition-all duration-300
                      ${isCompleted ? 'bg-sky-600' : isCurrent ? 'bg-white border-2 border-sky-600 shadow-md shadow-sky-100 scale-110' : 'bg-white border-2 border-slate-200'}
                    `}
                  >
                    {isCompleted ? (
                      <Check className="w-6 h-6 text-white" />
                    ) : (
                      <span className={`text-sm font-bold ${isCurrent ? 'text-sky-600' : 'text-slate-400'}`}>
                        {stepNumber}
                      </span>
                    )}
                  </span>
                  <span className={`absolute -bottom-8 text-[11px] font-bold uppercase tracking-wider transition-colors duration-300 ${isCurrent ? 'text-sky-600' : 'text-slate-400'}`}>
                    {step}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
