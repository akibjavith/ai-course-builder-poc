import React, { useState } from 'react';
import { PlayCircle } from 'lucide-react';
import Stepper from './components/Stepper';
import InteractiveCourseCreator from './components/InteractiveCourseCreator';
import HybridContentEditor from './components/HybridContentEditor';
import PublishDashboard from './components/PublishDashboard';
import CoursesDashboard from './pages/CoursesDashboard';
import CourseViewer from './components/CourseViewer';

function App() {
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'builder' | 'viewer'
  const [viewingCourse, setViewingCourse] = useState(null);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [courseData, setCourseData] = useState({
    sourceType: 'external', // or 'internal'
    details: {
      title: '',
      description: '',
      target_audience: '',
      difficulty: 'beginner',
      duration: '',
      learning_objectives: ['']
    },
    structure: { modules: [] }, // from Step 3
    content: [] // from Step 4
  });

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 3));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  const resetBuilder = () => {
    setCurrentStep(1);
    setCourseData({
      sourceType: 'external',
      details: { title: '', description: '', target_audience: '', difficulty: 'beginner', duration: '', learning_objectives: [''] },
      structure: { modules: [] },
      content: []
    });
    setView('dashboard');
  };

  const updateCourseData = (key, value) => {
    setCourseData(prev => ({ ...prev, [key]: value }));
  };

  const handleEditCourse = (course) => {
    // Populate courseData with existing course data
    setCourseData({
      id: course.id,
      sourceType: course.sourceType || course.details?.source_type || 'external',
      details: course.details || { title: '', description: '', target_audience: '', difficulty: 'beginner', duration: '', learning_objectives: [''] },
      structure: course.structure || { modules: [] },
      content: course.content || [],
      quiz: course.quiz || []
    });
    setCurrentStep(1);
    setView('builder');
  };

  if (view === 'dashboard') {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                  <PlayCircle className="text-white w-6 h-6" />
               </div>
               <h1 className="text-2xl font-black text-gray-900 tracking-tight">AI Course Builder</h1>
            </div>
            <button 
              onClick={() => { resetBuilder(); setView('builder'); }}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-sm active:scale-95"
            >
              + Create New Course
            </button>
          </div>
        </header>
        <main>
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <CoursesDashboard 
               onViewCourse={(course) => { setViewingCourse(course); setView('viewer'); }} 
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
            <h1 className="text-2xl font-bold text-gray-900">Course Builder Wizard</h1>
            <button 
              onClick={() => setView('dashboard')}
              className="text-indigo-600 hover:text-indigo-900 font-medium"
            >
              Back to Dashboard
            </button>
          </div>
        </header>

      <div className="max-w-4xl mx-auto pb-12 px-4 sm:px-6 lg:px-8">
        <Stepper currentStep={currentStep} />
        
          {currentStep === 1 && (
            <InteractiveCourseCreator 
              courseData={courseData} 
              updateCourseData={updateCourseData} 
              onNext={nextStep} 
            />
          )}
          {currentStep === 2 && (
            <HybridContentEditor 
              courseData={courseData} 
              updateCourseData={updateCourseData} 
              onNext={nextStep} 
              onBack={prevStep}
            />
          )}
          {currentStep === 3 && (
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
