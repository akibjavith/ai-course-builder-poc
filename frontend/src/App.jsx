import React, { useState } from 'react';
import Stepper from './components/Stepper';
import Step1SourceSelection from './components/Step1SourceSelection';
import Step2CourseDetailsForm from './components/Step2CourseDetailsForm';
import Step3StructureEditor from './components/Step3StructureEditor';
import Step4ContentEditor from './components/Step4ContentEditor';
import Step5ReviewPage from './components/Step5ReviewPage';
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

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 5));
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

  if (view === 'dashboard') {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">AI Course Builder</h1>
            <button 
              onClick={() => setView('builder')}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
            >
              Create New Course
            </button>
          </div>
        </header>
        <main>
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <CoursesDashboard onViewCourse={(course) => { setViewingCourse(course); setView('viewer'); }} />
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
       <header className="bg-white shadow mb-8">
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
        
        <div className="bg-white shadow sm:rounded-lg mb-6 py-6 px-4 sm:p-6">
          {currentStep === 1 && (
            <Step1SourceSelection 
              courseData={courseData} 
              updateCourseData={updateCourseData} 
              onNext={nextStep} 
            />
          )}
          {currentStep === 2 && (
            <Step2CourseDetailsForm 
              courseData={courseData} 
              updateCourseData={updateCourseData} 
              onNext={nextStep} 
              onBack={prevStep}
            />
          )}
          {currentStep === 3 && (
            <Step3StructureEditor 
              courseData={courseData} 
              updateCourseData={updateCourseData} 
              onNext={nextStep} 
              onBack={prevStep}
            />
          )}
          {currentStep === 4 && (
            <Step4ContentEditor 
              courseData={courseData} 
              updateCourseData={updateCourseData} 
              onNext={nextStep} 
              onBack={prevStep}
            />
          )}
          {currentStep === 5 && (
            <Step5ReviewPage 
              courseData={courseData} 
              onBack={prevStep}
              onComplete={resetBuilder}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
