import React, { useState } from 'react';
import { storeCourse } from '../api';
import { Loader2, CheckCircle, Database } from 'lucide-react';

export default function PublishDashboard({ courseData, onBack, onComplete }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const { details, structure, content } = courseData;



  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await storeCourse({ course_json: courseData });
      setSaved(true);
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err) {
      setErrorMsg("Failed to save course. Ensure the backend is running and reachable.");
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-medium text-gray-900 mb-6">Step 3: Review & Publish</h2>
      
      {saved ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-green-100 rounded-xl shadow-sm">
           <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
           <h3 className="text-2xl font-bold text-gray-900">Course Published Successfully!</h3>
           <p className="text-gray-500 mt-2">Redirecting you to your dashboard...</p>
        </div>
      ) : (
        <>
          {/* Summary Card */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{details.title}</h3>
            <p className="text-gray-600 mb-6">{details.description}</p>
            
            <div className="flex flex-wrap gap-3 text-xs font-semibold text-gray-600 mb-8 border-b border-gray-100 pb-6">
              <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full uppercase tracking-wider">{courseData.sourceType} Context</span>
              <span className="bg-gray-100 px-3 py-1.5 rounded-full uppercase tracking-wider">{details.difficulty}</span>
              <span className="bg-gray-100 px-3 py-1.5 rounded-full uppercase tracking-wider">{details.duration}</span>
              <span className="bg-gray-100 px-3 py-1.5 rounded-full uppercase tracking-wider">Audience: {details.target_audience}</span>
            </div>

            <h4 className="font-semibold text-gray-800 mb-4 flex items-center">
              Modules & Content Summary
            </h4>
            
            <div className="space-y-4">
              {(structure.modules || []).map((mod, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <h5 className="font-semibold text-gray-800 text-sm mb-2">{mod.title}</h5>
                  <div className="space-y-1">
                    {(mod.chapters || []).map((chap, j) => {
                       const cData = (content || []).find(c => c.module_title === mod.title && c.title === chap.title);
                       return (
                         <div key={j} className="flex justify-between items-center text-xs py-1 px-2 rounded bg-white border border-gray-100">
                           <span className="font-medium text-gray-700">{chap.title}</span>
                           <span className={cData ? "text-green-600 font-semibold italic" : "text-red-500 font-semibold animate-pulse"}>
                             {cData 
                               ? ((cData.files && cData.files.length > 0) 
                                   ? `${cData.files.length} Internal Item(s)` 
                                   : (cData.explanation ? 'AI Text Ready' : 'AI Processing')) 
                               : "Missing Content"}
                           </span>
                         </div>
                       );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Card */}
          <div className="bg-indigo-600 rounded-xl p-6 text-white shadow-md flex flex-col md:flex-row items-center justify-between mb-8">
             <div className="mb-4 md:mb-0">
               <h3 className="text-lg font-bold flex items-center mb-1">
                 <CheckCircle className="w-5 h-5 mr-2 text-indigo-200" /> Course Assembly Complete!
               </h3>
               <p className="text-indigo-200 text-sm">Publish it to the platform database to start learning.</p>
               {errorMsg && <p className="text-red-300 text-xs mt-2 font-medium">{errorMsg}</p>}
             </div>
             <div className="flex space-x-3 w-full md:w-auto">
                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 md:flex-none bg-green-500 text-white hover:bg-green-600 px-6 py-2.5 text-sm rounded-lg font-bold transition shadow-sm flex items-center justify-center disabled:opacity-75"
                >
                  {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Publishing...</> : <><Database className="w-4 h-4 mr-2" /> Publish Course</>}
                </button>
             </div>
          </div>

          <div className="flex justify-start">
            <button 
              onClick={onBack} 
              disabled={saving}
              className="bg-white border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg hover:bg-gray-50 transition shadow-sm disabled:opacity-50 font-medium"
            >
              Back to Content Editor
            </button>
          </div>
        </>
      )}
    </div>
  );
}
