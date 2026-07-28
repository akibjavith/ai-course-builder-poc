import React, { useState } from 'react';
import { PlayCircle, Sparkles } from 'lucide-react';
import Stepper from './components/Stepper';
import SourceSelection from './components/SourceSelection';
import CourseDetails from './components/CourseDetails';
import PublishDashboard from './components/PublishDashboard';
import CoursesDashboard from './pages/CoursesDashboard';
import CourseStructure from './components/CourseStructure';
import CourseContent from './components/CourseContent';
import LessonPreviewEditorModal from './components/LessonPreviewEditorModal';
import ChatbotCourseCreator from './components/ChatbotCourseCreator';
import { getCourseById } from './api';
import logo from './assets/logo.png';
import Button from './components/ui/Button.jsx';


function App() {
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'builder' | 'viewer'
  const [viewingCourse, setViewingCourse] = useState(null);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [contentGenUi, setContentGenUi] = useState({
    loadingMap: {},
    isGeneratingAll: false,
    modalConfig: null,
  });
  const [courseData, setCourseData] = useState({
    sourceType: 'external',
    details: {
      courseType: 'Custom Course',
      subject: '',
      courseName: '',
      description: '',
      price: '',
      duration: '',
      learningHours: '',
      requirements: '',
      level: 'beginner',
      language: 'English',
      scriptingLanguage: 'NA',
      bannerImage: null,
      evaluator: ''
    },
    structure: { modules: [] },
    content: []
  });

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 5));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  const resetBuilder = () => {
    setCurrentStep(1);
    setCourseData({
      sourceType: 'external',
      details: {
        courseType: 'Custom Course',
        subject: '',
        courseName: '',
        description: '',
        price: '',
        duration: '',
        learningHours: '',
        requirements: '',
        level: 'beginner',
        language: 'English',
        scriptingLanguage: 'NA',
        bannerImage: null,
        evaluator: ''
      },
      structure: { modules: [] },
      content: []
    });
    setView('dashboard');
  };

  const updateCourseData = (key, value) => {
    setCourseData(prev => {
      const resolvedValue = typeof value === 'function' ? value(prev[key]) : value;
      return { ...prev, [key]: resolvedValue };
    });
  };

  const handleEditCourse = async (course) => {
    try {
      // Fetch full data from MySQL first
      const res = await getCourseById(course.id);
      const fullCourse = res.course || course;

      setCourseData({
        id: fullCourse.id,
        sourceType: fullCourse.sourceType || fullCourse.details?.source_type || 'external',
        details: fullCourse.details || {
          courseType: 'Custom Course',
          subject: '',
          courseName: '',
          description: '',
          price: '',
          duration: '',
          learningHours: '',
          requirements: '',
          level: 'beginner',
          language: 'English',
          scriptingLanguage: 'NA',
          bannerImage: null,
          evaluator: ''
        },
        structure: fullCourse.structure || { modules: [] },
        content: fullCourse.content || [],
        quiz: fullCourse.quiz || [],
        usageHistory: fullCourse.usageHistory || [],
        mysql_id: fullCourse.mysql_id
      });
      setCurrentStep(1);
      setView('builder');
    } catch (err) {
      console.error("Error loading course for edit", err);
      alert("Failed to load full course content.");
    }
  };

  const handleViewCourse = async (course) => {
    try {
      // Fetch full data from MySQL first
      const res = await getCourseById(course.id);
      const fullCourse = res.course || course;
      setViewingCourse(fullCourse);
      setView('viewer');
    } catch (err) {
      console.error("Error loading course for view", err);
      alert("Failed to load course content.");
    }
  };

  if (view === 'dashboard') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex flex-wrap justify-between items-center gap-3">
             <div className="flex items-center gap-3">
                <img src={logo} alt="Logo" className="h-10 w-auto object-contain" />
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI Course Builder</h1>
             </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" onClick={() => setView('chatbot')}>
                <Sparkles className="w-4 h-4" /> Create via AI Chatbot
              </Button>
              <Button variant="primary" onClick={() => { resetBuilder(); setView('builder'); }}>
                + Create New Course
              </Button>
            </div>
          </div>
        </header>
        <main>
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <CoursesDashboard 
               onViewCourse={handleViewCourse} 
               onEditCourse={handleEditCourse}
               onStartChatbot={() => setView('chatbot')}
            />
          </div>
        </main>
      </div>
    );
  }

  if (view === 'chatbot') {
    return (
      <ChatbotCourseCreator
        onClose={() => setView('dashboard')}
      />
    );
  }

  if (view === 'viewer') {
    return (
      <LessonPreviewEditorModal
        courseData={viewingCourse}
        initialMIdx={0}
        initialCIdx={0}
        readOnly={true}
        onClose={() => setView('dashboard')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <header className="bg-white border-b border-slate-200 mb-8 sticky top-0 z-50">
           <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex flex-wrap justify-between items-center gap-3">
             <div className="flex items-center gap-3">
                <img src={logo} alt="Logo" className="h-10 w-auto object-contain" />
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Course Builder Wizard</h1>
             </div>
             <button
               onClick={() => setView('dashboard')}
               className="text-sky-600 hover:text-sky-800 font-semibold transition rounded-lg px-2 py-1 -mx-2 -my-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
             >
               Back to Dashboard
             </button>
           </div>
        </header>

      <div className={`mx-auto pb-12 px-4 sm:px-6 lg:px-8 transition-all duration-500 ${[2, 3, 4, 5].includes(currentStep) ? 'max-w-7xl' : 'max-w-4xl'}`}>
        <Stepper currentStep={currentStep} />
        
          {currentStep === 1 && (
            <SourceSelection 
              courseData={courseData} 
              updateCourseData={updateCourseData} 
              onNext={nextStep} 
            />
          )}
          {currentStep === 2 && (
            <CourseDetails 
              courseData={courseData} 
              updateCourseData={updateCourseData} 
              onNext={nextStep} 
              onBack={prevStep}
            />
          )}
          {currentStep === 3 && (
            <CourseStructure 
              courseData={courseData} 
              updateCourseData={updateCourseData} 
              onNext={nextStep} 
              onBack={prevStep}
            />
          )}
          {currentStep === 4 && (
            <CourseContent 
              courseData={courseData} 
              updateCourseData={updateCourseData} 
              contentGenUi={contentGenUi}
              setContentGenUi={setContentGenUi}
              onNext={nextStep} 
              onBack={prevStep}
            />
          )}
          {currentStep === 5 && (
            <PublishDashboard 
              courseData={courseData} 
              updateCourseData={updateCourseData}
              onBack={prevStep}
              onComplete={resetBuilder}
            />
          )}
        </div>
    </div>
  );
}

export default App;
