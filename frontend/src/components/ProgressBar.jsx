import React from 'react';

export default function ProgressBar({ completed, total }) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  return (
    <div className="w-full bg-gray-800 rounded-full h-2.5 mb-4 my-2 border border-gray-700/50 overflow-hidden">
      <div 
        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500 ease-out" 
        style={{ width: `${percentage}%` }}
      ></div>
      <div className="text-right text-[10px] text-gray-400 font-bold uppercase mt-1">
         {percentage}% Completed ({completed}/{total})
      </div>
    </div>
  );
}
