import React, { useState } from 'react';
import { Layers, BookOpen, PenTool, Loader2 } from 'lucide-react';
import { generateOutlineSkeleton } from '../api';

export default function OutlineForm({ description, onOutlineGenerated }) {
  const [modulesCount, setModulesCount] = useState(3);
  const [chaptersCount, setChaptersCount] = useState(4);
  const [assessmentsCount, setAssessmentsCount] = useState(1);
  const [mcqCount, setMcqCount] = useState(5);
  const [assessmentText, setAssessmentText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const response = await generateOutlineSkeleton({
        description,
        modules_count: modulesCount,
        chapters_per_module: chaptersCount,
        assessments_per_module: assessmentsCount,
        mcq_per_module: mcqCount,
        assessment_text: assessmentText
      });
      // response.data contains the modules
      onOutlineGenerated(response.data.modules, { mcqCount, assessmentsCount, assessmentText });
    } catch (error) {
      console.error("Failed to generate outline skeleton", error);
      alert("Failed to generate outline skeleton.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 w-full md:w-96 rounded-lg bg-indigo-50/50 p-5 border border-indigo-100 backdrop-blur-md shadow-sm">
      <h3 className="font-semibold text-indigo-900 mb-3 text-sm flex items-center">
        <Layers className="w-4 h-4 mr-2 text-indigo-500" /> Specify Course Structure
      </h3>
      <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Modules</label>
            <div className="relative">
              <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="number" min="1" max="20"
                value={modulesCount} onChange={(e) => setModulesCount(parseInt(e.target.value) || 1)}
                className="w-full pl-9 pr-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Chapters / Module</label>
            <div className="relative">
              <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="number" min="1" max="10"
                value={chaptersCount} onChange={(e) => setChaptersCount(parseInt(e.target.value) || 1)}
                className="w-full pl-9 pr-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Assessments / Module</label>
              <div className="relative">
                 <PenTool className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input 
                   type="number" min="0" max="5"
                   value={assessmentsCount} onChange={(e) => setAssessmentsCount(parseInt(e.target.value) || 0)}
                   className="w-full pl-9 pr-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                 />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">MCQs / Module</label>
              <div className="relative">
                 <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input 
                   type="number" min="0" max="20"
                   value={mcqCount} onChange={(e) => setMcqCount(parseInt(e.target.value) || 0)}
                   className="w-full pl-9 pr-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                 />
              </div>
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Assessment Criteria (Optional)</label>
            <textarea
              rows={3}
              placeholder="What specifically should the assessments focus on?"
              value={assessmentText} onChange={(e) => setAssessmentText(e.target.value)}
              className="w-full bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm p-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-y"
            />
          </div>
      </div>
      
      <button 
        onClick={handleGenerate}
        disabled={loading}
        className="mt-2 w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-md py-2.5 font-bold text-sm hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 transition shadow-sm flex items-center justify-center transform active:scale-[0.98]"
      >
        {loading ? <><Loader2 className="animate-spin h-4 w-4 mr-2" /> Generating Skeleton...</> : 'Generate Outline'}
      </button>
    </div>
  );
}
