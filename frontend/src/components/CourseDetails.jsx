import React, { useState, useEffect } from 'react';
import { Sparkles, ChevronLeft, ChevronRight, Plus, X, CheckCircle2, MessageSquareText, Wand2, Loader2, AlertCircle } from 'lucide-react';
import CustomSelect from './CustomSelect';
import AIAssistantSidebar from './AIAssistantSidebar';
import { autoFillCourseDetails } from '../api';

export default function CourseDetails({ courseData, updateCourseData, onNext, onBack }) {
  const [details, setDetails] = useState(courseData.details || {
    title: '',
    description: '',
    target_audience: '',
    difficulty: 'beginner',
    duration: '',
    learning_objectives: ['']
  });

  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [error, setError] = useState('');

  const difficultyOptions = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' }
  ];

  const handleChange = (field, value) => {
    const updated = { ...details, [field]: value };
    setDetails(updated);
    updateCourseData('details', updated);
  };

  const handleObjectiveChange = (index, value) => {
    const newObjectives = [...details.learning_objectives];
    newObjectives[index] = value;
    handleChange('learning_objectives', newObjectives);
  };

  const addObjective = () => {
    handleChange('learning_objectives', [...details.learning_objectives, '']);
  };

  const removeObjective = (index) => {
    const newObjectives = details.learning_objectives.filter((_, i) => i !== index);
    handleChange('learning_objectives', newObjectives);
  };

  const handleAutoFill = async () => {
    if (courseData.sourceType === 'external') {
      setError("You have not uploaded any document or url to fill. Use Ask AI to create or fill the fields.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const resp = await autoFillCourseDetails();
      const newDetails = resp.details;
      setDetails(newDetails);
      updateCourseData('details', newDetails);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to auto-fill details.");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAISuggestion = (suggestion) => {
    setDetails(suggestion);
    updateCourseData('details', suggestion);
  };

  return (
    <div className="animate-fade-in space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold animate-bounce shadow-sm">
           <AlertCircle className="w-5 h-5 flex-shrink-0" />
           {error}
           <button onClick={() => setError('')} className="ml-auto p-1 hover:bg-red-100 rounded-lg transition"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-8 h-[750px]">
        {/* Main Form Section - Fixed Width */}
        <div className="col-span-12 lg:col-span-8 bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden flex flex-col h-full">

          
          <div className="p-6 md:p-8 flex-1 scroll-smooth overflow-y-auto no-scrollbar">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="space-y-0.5">
                <div className="flex items-center gap-3">
                   <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Course Details</h2>
                   <span className="bg-gradient-to-r from-sky-50 to-sky-100/50 text-sky-600 px-3 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 border border-sky-100 shadow-sm">
                    <Sparkles className="w-3 h-3" /> AI ENHANCED
                  </span>
                </div>
                <p className="text-slate-400 font-semibold text-[10px] tracking-wide uppercase">Fine-tune your learning journey backbone.</p>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowSidebar(true)}
                  className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-sky-700 transition shadow-lg shadow-sky-100 active:scale-95 group"
                >
                  <MessageSquareText className="w-3.5 h-3.5" /> 
                  <span>ASK AI</span>
                </button>

              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-5">
                {/* Title */}
                <div className="space-y-1.5 group">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Course Title</label>
                  <input 
                    type="text" 
                    value={details.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="e.g. Introduction to Artificial Intelligence"
                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:bg-white focus:border-sky-500 outline-none transition font-medium text-slate-800 text-sm placeholder:text-slate-300"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5 group">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</label>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${details.description.length > 900 ? 'bg-red-50 text-red-400' : 'bg-slate-100 text-slate-400'}`}>
                      {details.description.length} / 1000
                    </span>
                  </div>
                  <textarea 
                    rows={3}
                    value={details.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Describe what this course is about..."
                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:bg-white focus:border-sky-500 outline-none transition font-medium text-slate-700 text-sm resize-none leading-relaxed placeholder:text-slate-300"
                    maxLength={1000}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1.5 group">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Audience</label>
                    <input 
                      type="text" 
                      value={details.target_audience}
                      onChange={(e) => handleChange('target_audience', e.target.value)}
                      placeholder="e.g. Beginners"
                      className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:bg-white focus:border-sky-500 outline-none transition font-medium text-slate-800 text-xs"
                    />
                  </div>
                  <CustomSelect 
                    label="Difficulty"
                    value={details.difficulty}
                    options={difficultyOptions}
                    onChange={(val) => handleChange('difficulty', val)}
                  />
                  <div className="space-y-1.5 group">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Duration</label>
                    <input 
                      type="text" 
                      value={details.duration}
                      onChange={(e) => handleChange('duration', e.target.value)}
                      placeholder="6 hours"
                      className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:bg-white focus:border-sky-500 outline-none transition font-medium text-slate-800 text-xs"
                    />
                  </div>
                </div>

                {/* Learning Objectives */}
                <div className="space-y-4 pt-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Objectives</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {details.learning_objectives.map((obj, idx) => (
                      <div key={idx} className="flex gap-2 group animate-scale-in">
                        <div className="flex-1 relative">
                          <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-500 opacity-60" />
                          <input 
                            type="text" 
                            value={obj}
                            onChange={(e) => handleObjectiveChange(idx, e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:bg-white focus:border-sky-500 outline-none transition font-medium text-slate-700 text-[11px]"
                          />
                        </div>
                        <button 
                          onClick={() => removeObjective(idx)}
                          className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={addObjective}
                    className="group flex items-center gap-2 text-slate-400 px-4 py-2 text-[10px] font-bold hover:text-sky-600 transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" /> ADD OBJECTIVE
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 bg-gray-50/50 border-t border-gray-50 flex flex-col md:flex-row justify-between gap-4">
            <button 
              onClick={onBack}
              className="px-6 py-3.5 border-2 border-slate-100 text-slate-600 rounded-2xl font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-white hover:text-sky-600 transition-all active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button 
              onClick={onNext}
              disabled={!details.title || !details.description}
              className="flex-1 bg-gradient-to-r from-sky-600 to-sky-700 text-white px-6 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:from-sky-700 hover:to-sky-800 transition-all shadow-xl shadow-sky-100 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              Confirm & Generate Structure <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* AI Assistant Sidebar Area - Always Reserved */}
        <div className="col-span-12 lg:col-span-4 h-full relative lg:sticky lg:top-6">
          {!showSidebar ? (
            <div className="h-[750px] rounded-[2rem] bg-white border border-slate-100 shadow-xl flex flex-col items-center justify-center text-center p-8 group transition-all">
               <div className="w-16 h-16 bg-slate-50 rounded-2xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <MessageSquareText className="w-8 h-8 text-sky-400 opacity-50" />
               </div>
               <h3 className="text-slate-400 font-bold text-sm mb-2">AI Assistant Workspace</h3>
               <p className="text-[10px] text-slate-300 font-medium max-w-[160px] mb-6">Toggle the assistant to brainstorm or refine your course details.</p>
               <button 
                  onClick={() => setShowSidebar(true)}
                  className="flex items-center gap-2 bg-sky-600 text-white px-5 py-3 rounded-xl text-xs font-bold hover:bg-sky-700 transition shadow-lg shadow-sky-100 active:scale-95 group"
                >
                  <MessageSquareText className="w-3.5 h-3.5" />
                  <span>ASK AI</span>
                </button>
            </div>
          ) : (
            <AIAssistantSidebar 
              details={details}
              onApply={handleApplyAISuggestion} 
              onClose={() => setShowSidebar(false)} 
              scope="Course Details"
            />
          )}
        </div>
      </div>
    </div>
  );
}
