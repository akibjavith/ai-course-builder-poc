import React, { useState } from 'react';
import { PlayCircle } from 'lucide-react';
import Stepper from './components/Stepper';
import SourceSelection from './components/SourceSelection';
import CourseDetails from './components/CourseDetails';
import InteractiveCourseCreator from './components/InteractiveCourseCreator';
import HybridContentEditor from './components/HybridContentEditor';
import PublishDashboard from './components/PublishDashboard';
import CoursesDashboard from './pages/CoursesDashboard';
import CourseViewer from './components/CourseViewer';
import CourseStructure from './components/CourseStructure';
import CourseContent from './components/CourseContent';
import { getCourseById } from './api';

function App() {
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'builder' | 'viewer'
  const [viewingCourse, setViewingCourse] = useState(null);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [courseData, setCourseData] = useState({
    sourceType: 'external',
    details: {
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
    setCourseData(prev => ({ ...prev, [key]: value }));
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
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center shadow-sm">
                  <PlayCircle className="text-white w-6 h-6" />
               </div>
               <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI Course Builder</h1>
            </div>
            <button 
              onClick={() => { resetBuilder(); setView('builder'); }}
              className="bg-sky-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-sky-700 transition shadow-sm active:scale-95"
            >
              + Create New Course
            </button>
          </div>
        </header>
        <main>
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <CoursesDashboard 
               onViewCourse={handleViewCourse} 
               onEditCourse={handleEditCourse}
            />
          </div>
        </main>
      </div>
    );
  }

  if (view === 'viewer') {
    return <CourseViewer course={viewingCourse} onBack={() => setView('dashboard')} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
       <header className="bg-white border-b border-gray-200 mb-8 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Course Builder Wizard</h1>
            <button 
              onClick={() => setView('dashboard')}
              className="text-sky-600 hover:text-sky-900 font-semibold transition"
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
              onNext={nextStep} 
              onBack={prevStep}
            />
          )}
          {currentStep === 5 && (
            <PublishDashboard 
              courseData={courseData} 
              onBack={prevStep}
              onComplete={resetBuilder}
            />
          )}
        </div>
    </div>
  );
}

export default App;
