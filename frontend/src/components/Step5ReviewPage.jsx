import React, { useState } from 'react';
import { createCourse } from '../api';
import { Loader2, CheckCircle } from 'lucide-react';

export default function Step5ReviewPage({ courseData, onBack, onComplete }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await createCourse(courseData);
      setSaved(true);
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err) {
      alert("Failed to save course.");
      setSaving(false);
    }
  };

  const { details, structure, content } = courseData;

  return (
    <div>
      <h2 className="text-xl font-medium text-gray-900 mb-6">Step 5: Review & Publish</h2>
      
      {saved ? (
        <div className="flex flex-col items-center justify-center py-16">
           <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
           <h3 className="text-2xl font-bold text-gray-900">Course Created!</h3>
           <p className="text-gray-500 mt-2">Redirecting to Dashboard...</p>
        </div>
      ) : (
        <>
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{details.title}</h3>
            <p className="text-gray-600 mb-4">{details.description}</p>
            
            <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-6">
              <span className="bg-white border rounded px-3 py-1">Type: {courseData.sourceType.toUpperCase()}</span>
              <span className="bg-white border rounded px-3 py-1 uppercase">{details.difficulty}</span>
              <span className="bg-white border rounded px-3 py-1">{details.duration}</span>
            </div>

            <h4 className="font-semibold text-gray-800 mb-2 border-b pb-2">Modules & Content Summary</h4>
            <div className="space-y-4">
              {structure.modules.map((mod, i) => (
                <div key={i}>
                  <h5 className="font-semibold text-gray-700">{mod.title}</h5>
                  <ul className="list-disc pl-5 mt-1 text-sm text-gray-600">
                    {mod.chapters.map((chap, j) => {
                       const cData = content.find(c => c.module_title === mod.title && c.title === chap.title);
                       return (
                         <li key={j} className="flex justify-between items-center mb-1">
                           <span>{chap.title}</span>
                           <span className={cData ? "text-green-600" : "text-red-500"}>
                             {cData ? "Ready" : "Missing Content"}
                           </span>
                         </li>
                       );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex justify-between">
            <button 
              onClick={onBack} 
              disabled={saving}
              className="bg-white border border-gray-300 text-gray-700 px-5 py-2 rounded-md hover:bg-gray-50"
            >
              Back
            </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 font-medium flex items-center shadow"
            >
              {saving ? <><Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5"/> Publishing...</> : 'Publish Course'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
