import React from 'react';
import { Check } from 'lucide-react';

const steps = [
  'Setup',
  'Content',
  'Publish'
];

export default function Stepper({ currentStep }) {
  return (
    <div className="mb-8">
      <nav aria-label="Progress">
        <ol role="list" className="flex items-center justify-between">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isCompleted = currentStep > stepNumber;
            const isCurrent = currentStep === stepNumber;
            
            return (
              <li key={step} className="relative pr-8 sm:pr-20 last:pr-0">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className={`h-0.5 w-full ${isCompleted ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                </div>
                <div className="relative flex items-center justify-center">
                  <span
                    className={`h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-white
                      ${isCompleted ? 'bg-indigo-600' : isCurrent ? 'bg-white border-2 border-indigo-600' : 'bg-white border-2 border-gray-300'}
                    `}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5 text-white" />
                    ) : (
                      <span className={`text-sm font-medium ${isCurrent ? 'text-indigo-600' : 'text-gray-500'}`}>
                        {stepNumber}
                      </span>
                    )}
                  </span>
                  <span className={`absolute -bottom-6 text-sm font-medium ${isCurrent ? 'text-indigo-600' : 'text-gray-500'}`}>
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
