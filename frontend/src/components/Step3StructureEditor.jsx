import React, { useState } from 'react';
import { generateStructure } from '../api';
import { Loader2, Plus, Trash2 } from 'lucide-react';

export default function Step3StructureEditor({ courseData, updateCourseData, onNext, onBack }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await generateStructure(courseData.sourceType, courseData.details);
      updateCourseData('structure', data.data);
    } catch (err) {
      setError('Failed to generate outline.');
    } finally {
      setLoading(false);
    }
  };

  const { structure } = courseData;

  const handleAddModule = () => {
    const modules = [...structure.modules, { title: 'New Module', chapters: [] }];
    updateCourseData('structure', { modules });
  };

  const handleRemoveModule = (modIdx) => {
    const modules = structure.modules.filter((_, i) => i !== modIdx);
    updateCourseData('structure', { modules });
  };

  const handleModuleTitleChange = (modIdx, title) => {
    const modules = [...structure.modules];
    modules[modIdx].title = title;
    updateCourseData('structure', { modules });
  };

  const handleAddChapter = (modIdx) => {
    const modules = [...structure.modules];
    modules[modIdx].chapters.push({ title: 'New Chapter' });
    updateCourseData('structure', { modules });
  };

  const handleRemoveChapter = (modIdx, chapIdx) => {
    const modules = [...structure.modules];
    modules[modIdx].chapters = modules[modIdx].chapters.filter((_, i) => i !== chapIdx);
    updateCourseData('structure', { modules });
  };

  const handleChapterTitleChange = (modIdx, chapIdx, title) => {
    const modules = [...structure.modules];
    modules[modIdx].chapters[chapIdx].title = title;
    updateCourseData('structure', { modules });
  };

  return (
    <div>
      <h2 className="text-xl font-medium text-gray-900 mb-6">Step 3: Course Structure</h2>

      {!structure.modules.length ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
           <p className="text-sm text-gray-500 mb-4 text-center">
              Let our AI build an initial curriculum structure based on your provided details.
           </p>
           <button 
             onClick={handleGenerate} 
             disabled={loading}
             className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
           >
             {loading && <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />}
             Generate Structure
           </button>
           {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
        </div>
      ) : (
        <div className="space-y-6">
          {structure.modules.map((mod, modIdx) => (
            <div key={modIdx} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <input 
                  type="text" 
                  value={mod.title} 
                  onChange={(e) => handleModuleTitleChange(modIdx, e.target.value)}
                  className="font-semibold text-lg border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none p-1 w-full mr-4 bg-transparent text-gray-900"
                />
                <button onClick={() => handleRemoveModule(modIdx)} className="text-red-500 hover:text-red-700">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>

              <div className="pl-6 space-y-2 border-l-2 border-gray-100">
                {mod.chapters.map((chap, chapIdx) => (
                  <div key={chapIdx} className="flex items-center justify-between group">
                    <input 
                      type="text" 
                      value={chap.title} 
                      onChange={(e) => handleChapterTitleChange(modIdx, chapIdx, e.target.value)}
                      className="text-sm border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none p-1 w-full mr-4 bg-transparent text-gray-700"
                    />
                    <button onClick={() => handleRemoveChapter(modIdx, chapIdx)} className="text-gray-400 group-hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                
                <button onClick={() => handleAddChapter(modIdx)} className="mt-3 text-xs flex items-center text-indigo-600 font-medium hover:text-indigo-800">
                  <Plus className="h-3 w-3 mr-1" /> Add Chapter
                </button>
              </div>
            </div>
          ))}

          <div className="flex space-x-4">
              <button 
                onClick={handleAddModule}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Module
              </button>
              <button 
                onClick={handleGenerate}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:opacity-50"
              >
                {loading && <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />}
                Regenerate All Structure
              </button>
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <button onClick={onBack} className="bg-white border border-gray-300 text-gray-700 px-5 py-2 rounded-md hover:bg-gray-50">
          Back
        </button>
        <button 
          onClick={onNext}
          disabled={!structure.modules.length}
          className="bg-indigo-600 text-white px-5 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
