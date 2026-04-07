import React, { useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';

export default function ModuleAssessmentBox({ mIdx, mod, courseTitle, assessmentText, onAssessmentSaved }) {
    const [generating, setGenerating] = useState(false);
    const mcqs = mod.assessment;
  
    const handleGen = async () => {
      if (mcqs) return;
      setGenerating(true);
      try {
        const { generateAssessment } = await import('../api');
        const resp = await generateAssessment({
          course_title: courseTitle || "Course",
          module_title: mod.title,
          assessment_text: assessmentText || ""
        });
        onAssessmentSaved(resp.mcqs);
      } catch (err) {
        console.error(err);
        alert("Failed to generate module assessment");
      } finally {
        setGenerating(false);
      }
    };
  
    return (
      <div className="flex flex-col items-end">
        {!mcqs ? (
          <button onClick={handleGen} disabled={generating} className="flex items-center text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition shadow-sm border border-indigo-200">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />} Generate Assessment
          </button>
        ) : (
          <span className="flex items-center text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-md shadow-sm border border-green-100"><CheckCircle2 className="w-3.5 h-3.5 mr-1.5"/> Assessment Ready</span>
        )}
      </div>
    );
}
