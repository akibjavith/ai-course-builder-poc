import React from 'react';

export default function Step2CourseDetailsForm({ courseData, updateCourseData, onNext, onBack }) {
  const { details } = courseData;

  const handleChange = (e) => {
    updateCourseData('details', { ...details, [e.target.name]: e.target.value });
  };

  const handleObjChange = (index, val) => {
    const newObjs = [...details.learning_objectives];
    newObjs[index] = val;
    updateCourseData('details', { ...details, learning_objectives: newObjs });
  };

  const addObj = () => {
    updateCourseData('details', { 
      ...details, 
      learning_objectives: [...details.learning_objectives, ''] 
    });
  };

  const removeObj = (index) => {
    const newObjs = details.learning_objectives.filter((_, i) => i !== index);
    updateCourseData('details', { ...details, learning_objectives: newObjs });
  };

  const isValid = details.title && details.description && details.target_audience && details.duration;

  return (
    <div>
      <h2 className="text-xl font-medium text-gray-900 mb-6">Step 2: Course Details</h2>
      <div className="space-y-6 flex flex-col">
        <div>
          <label className="block text-sm font-medium text-gray-700">Course Title</label>
          <input 
            type="text" name="title" value={details.title} onChange={handleChange} 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
           <label className="block text-sm font-medium text-gray-700">Description</label>
           <textarea 
             name="description" rows={3} value={details.description} onChange={handleChange}
             className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
           />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
           <div>
             <label className="block text-sm font-medium text-gray-700">Target Audience</label>
             <input type="text" name="target_audience" value={details.target_audience} onChange={handleChange}
               className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
             />
           </div>
           <div>
             <label className="block text-sm font-medium text-gray-700">Difficulty</label>
             <select name="difficulty" value={details.difficulty} onChange={handleChange}
               className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
             >
               <option value="beginner">Beginner</option>
               <option value="intermediate">Intermediate</option>
               <option value="advanced">Advanced</option>
             </select>
           </div>
           <div>
             <label className="block text-sm font-medium text-gray-700">Duration (e.g. 2 hours)</label>
             <input type="text" name="duration" value={details.duration} onChange={handleChange}
               className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
             />
           </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Learning Objectives</label>
          {details.learning_objectives.map((obj, i) => (
             <div key={i} className="flex mb-2">
                <input 
                  type="text" value={obj} onChange={(e) => handleObjChange(i, e.target.value)}
                  className="flex-1 rounded-l-md border-gray-300 shadow-sm border p-2 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <button 
                  onClick={() => removeObj(i)}
                  className="bg-red-500 text-white px-3 rounded-r-md"
                >
                  X
                </button>
             </div>
          ))}
          <button onClick={addObj} className="text-sm text-indigo-600 hover:text-indigo-900 mt-2 font-medium">
             + Add Objective
          </button>
        </div>

      </div>
      <div className="mt-8 flex justify-between">
        <button onClick={onBack} className="bg-white border border-gray-300 text-gray-700 px-5 py-2 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
          Back
        </button>
        <button 
          onClick={onNext}
          disabled={!isValid}
          className="bg-indigo-600 border border-transparent text-white px-5 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
