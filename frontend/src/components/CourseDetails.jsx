import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ChevronLeft, ChevronRight, Plus, X, CheckCircle2, MessageSquareText, Wand2, Loader2, AlertCircle, Upload, Image as ImageIcon } from 'lucide-react';
import CustomSelect from './CustomSelect';
import AIAssistantSidebar from './AIAssistantSidebar';
import { autoFillCourseDetails } from '../api';

export default function CourseDetails({ courseData, updateCourseData, onNext, onBack }) {
  const [details, setDetails] = useState(courseData.details || {
    courseType: 'Custom Course',
    subject: '',
    courseName: '',
    description: '',
    price: '',
    duration: '',
    requirements: '',
    level: 'beginner',
    language: 'English',
    scriptingLanguage: 'NA',
    bannerImage: null,
    evaluator: ''
  });

  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [error, setError] = useState('');
  const [bannerPreview, setBannerPreview] = useState(null);
  const fileInputRef = useRef(null);

  const courseTypeOptions = [
    { value: 'Custom Course', label: 'Custom Course' },
    { value: 'SCORM Course', label: 'SCORM Course' }
  ];

  const subjectOptions = [
    { value: 'English', label: 'English' },
    { value: 'Maths', label: 'Maths' },
    { value: 'Science', label: 'Science' },
    { value: 'Social', label: 'Social' },
    { value: 'Physics', label: 'Physics' },
    { value: 'Chemistry', label: 'Chemistry' },
    { value: 'Biology', label: 'Biology' },
    { value: 'History', label: 'History' },
    { value: 'Geography', label: 'Geography' },
    { value: 'Economics', label: 'Economics' },
    { value: 'Computer Science', label: 'Computer Science' },
    { value: 'Data Science', label: 'Data Science' },
    { value: 'Machine Learning', label: 'Machine Learning' },
    { value: 'AI', label: 'AI' },
    { value: 'Python Programming', label: 'Python Programming' },
    { value: 'Digital Marketing', label: 'Digital Marketing' },
    { value: 'Business Management', label: 'Business Management' }
  ];

  const levelOptions = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' }
  ];

  const scriptingLanguageOptions = [
    { value: 'NA', label: 'NA' },
    { value: 'Python', label: 'Python' },
    { value: 'SQL', label: 'SQL' },
    { value: 'C++', label: 'C++' },
    { value: 'C', label: 'C' },
    { value: 'MySQL', label: 'MySQL' },
    { value: 'PostgreSQL', label: 'PostgreSQL' },
    { value: 'Java', label: 'Java' },
    { value: 'JavaScript', label: 'JavaScript' }
  ];

  const evaluatorOptions = [
    { value: 'Sarah Johnson', label: 'Sarah Johnson' },
    { value: 'Michael Chen', label: 'Michael Chen' },
    { value: 'Dr. Emily Smith', label: 'Dr. Emily Smith' },
    { value: 'Alex Rivera', label: 'Alex Rivera' }
  ];

  const handleChange = (field, value) => {
    const updated = { ...details, [field]: value };
    setDetails(updated);
    updateCourseData('details', updated);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        setError("Image size should be less than 1MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result);
        handleChange('bannerImage', file.name); // Storing name for now, in real app we'd upload
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyAISuggestion = (suggestion) => {
    // Helper to find closest match in options
    const findMatch = (val, options) => {
      if (!val) return null;
      const normalized = val.toString().toLowerCase().trim();
      return options.find(opt => 
        opt.value.toLowerCase() === normalized || 
        opt.label.toLowerCase() === normalized
      )?.value;
    };

    const adapted = {
      ...details,
      courseType: findMatch(suggestion.courseType, courseTypeOptions) || details.courseType,
      subject: findMatch(suggestion.subject, subjectOptions) || details.subject,
      courseName: suggestion.courseName || suggestion.title || details.courseName,
      description: suggestion.description || details.description,
      price: suggestion.price?.toString().replace(/[^0-9.]/g, '') || details.price,
      duration: suggestion.duration?.toString().replace(/[^0-9]/g, '') || details.duration,
      requirements: suggestion.requirements || details.requirements,
      level: findMatch(suggestion.level || suggestion.difficulty, levelOptions) || details.level,
      language: suggestion.language || details.language,
      scriptingLanguage: findMatch(suggestion.scriptingLanguage, scriptingLanguageOptions) || details.scriptingLanguage,
      evaluator: findMatch(suggestion.evaluator, evaluatorOptions) || details.evaluator
    };
    setDetails(adapted);
    updateCourseData('details', adapted);
  };

  const isMandatoryFilled = details.courseType && details.subject && details.courseName && details.description && details.price && details.duration;

  return (
    <div className="animate-fade-in space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold animate-bounce shadow-sm">
           <AlertCircle className="w-5 h-5 flex-shrink-0" />
           {error}
           <button onClick={() => setError('')} className="ml-auto p-1 hover:bg-red-100 rounded-lg transition"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-8 h-[850px]">
        {/* Main Form Section */}
        <div className="col-span-12 lg:col-span-8 bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden flex flex-col h-full">
          
          <div className="p-6 md:p-8 flex-1 scroll-smooth overflow-y-auto no-scrollbar">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div className="space-y-0.5">
                <div className="flex items-center gap-3">
                   <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Create Course</h2>
                   <span className="bg-gradient-to-r from-sky-50 to-sky-100/50 text-sky-600 px-3 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 border border-sky-100 shadow-sm">
                    <Sparkles className="w-3 h-3" /> AI ENHANCED
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  <span>Manage Course</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-sky-600">Create Course</span>
                </div>
              </div>
              
              <button 
                onClick={() => setShowSidebar(true)}
                className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-sky-700 transition shadow-lg shadow-sky-100 active:scale-95 group"
              >
                <MessageSquareText className="w-3.5 h-3.5" /> 
                <span>ASK AI</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-8">
              {/* Row 1 */}
              <CustomSelect 
                label="Course Type *"
                value={details.courseType}
                options={courseTypeOptions}
                onChange={(val) => handleChange('courseType', val)}
              />
              <CustomSelect 
                label="Subject Name *"
                value={details.subject}
                options={subjectOptions}
                onChange={(val) => handleChange('subject', val)}
              />
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Course Name *</label>
                <input 
                  type="text" 
                  value={details.courseName}
                  onChange={(e) => handleChange('courseName', e.target.value)}
                  placeholder="Enter course name"
                  className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:bg-white focus:border-sky-500 outline-none transition font-medium text-slate-800 text-sm"
                />
              </div>

              {/* Row 2 */}
              <div className="space-y-1.5 md:col-span-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Course Description *</label>
                <textarea 
                  rows={4}
                  value={details.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Enter course description"
                  className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:bg-white focus:border-sky-500 outline-none transition font-medium text-slate-700 text-sm resize-none leading-relaxed"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Course Price *</label>
                <input 
                  type="number" 
                  value={details.price}
                  onChange={(e) => handleChange('price', e.target.value)}
                  placeholder="Enter price"
                  className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:bg-white focus:border-sky-500 outline-none transition font-medium text-slate-800 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Course Duration (in Days) *</label>
                <input 
                  type="number" 
                  value={details.duration}
                  onChange={(e) => handleChange('duration', e.target.value)}
                  placeholder="Enter duration in days"
                  className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:bg-white focus:border-sky-500 outline-none transition font-medium text-slate-800 text-sm"
                />
              </div>

              {/* Row 3 */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Requirements</label>
                <input 
                  type="text" 
                  value={details.requirements}
                  onChange={(e) => handleChange('requirements', e.target.value)}
                  placeholder="Enter requirements"
                  className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:bg-white focus:border-sky-500 outline-none transition font-medium text-slate-800 text-sm"
                />
              </div>
              <CustomSelect 
                label="Course Level"
                value={details.level}
                options={levelOptions}
                onChange={(val) => handleChange('level', val)}
              />
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Course Language</label>
                <input 
                  type="text" 
                  value={details.language}
                  onChange={(e) => handleChange('language', e.target.value)}
                  placeholder="English"
                  className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:bg-white focus:border-sky-500 outline-none transition font-medium text-slate-800 text-sm"
                />
              </div>

              {/* Row 4 */}
              <div className="space-y-1.5">
                <CustomSelect 
                  label="Scripting Language"
                  value={details.scriptingLanguage}
                  options={scriptingLanguageOptions}
                  onChange={(val) => handleChange('scriptingLanguage', val)}
                />
                <p className="text-[9px] text-slate-400 font-medium ml-1">Note: Choose if your course content needs a scripting language</p>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Banner Image</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100 hover:border-sky-300 transition flex items-center gap-3 overflow-hidden"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    className="hidden"
                    accept="image/*"
                  />
                  {bannerPreview ? (
                    <img src={bannerPreview} alt="Preview" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-700 truncate">{details.bannerImage || 'Choose File'}</p>
                    <p className="text-[9px] text-slate-400 font-medium truncate">No file chosen</p>
                  </div>
                </div>
                <p className="text-[9px] text-slate-400 font-medium ml-1">Note: Upload an image smaller than 1MB | Supported formats: jpg, jpeg, png.</p>
              </div>

              <CustomSelect 
                label="Evaluator"
                value={details.evaluator}
                options={evaluatorOptions}
                onChange={(val) => handleChange('evaluator', val)}
              />
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
              disabled={!isMandatoryFilled}
              className="flex-1 bg-gradient-to-r from-sky-600 to-sky-700 text-white px-6 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:from-sky-700 hover:to-sky-800 transition-all shadow-xl shadow-sky-100 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              Confirm & Generate Structure <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* AI Assistant Sidebar */}
        <div className="col-span-12 lg:col-span-4 h-full relative lg:sticky lg:top-6 flex-shrink-0 min-w-[400px]">
          {!showSidebar ? (
            <div className="h-full w-full rounded-[2rem] bg-white border border-slate-100 shadow-xl flex flex-col items-center justify-center text-center p-8 group transition-all">
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
              courseData={courseData}
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
