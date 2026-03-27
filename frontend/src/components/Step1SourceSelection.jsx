import React, { useState } from 'react';
import { uploadDoc } from '../api';
import { UploadCloud, CheckCircle, Database, Globe } from 'lucide-react';

export default function Step1SourceSelection({ courseData, updateCourseData, onNext }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleSourceChange = (type) => {
    updateCourseData('sourceType', type);
    // Switch to external resets internal doc state for safety
    if (type === 'external') {
      setFile(null);
      setUploadSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadDoc(file);
      setUploadSuccess(true);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message;
      alert("Failed to upload document: " + errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const canProceed = courseData.sourceType === 'external' || uploadSuccess;

  return (
    <div>
      <h2 className="text-xl font-medium text-gray-900 mb-6">Step 1: Select AI Memory Source</h2>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div 
          onClick={() => handleSourceChange('external')}
          className={`relative rounded-lg border p-6 flex cursor-pointer focus:outline-none 
            ${courseData.sourceType === 'external' ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-600' : 'bg-white border-gray-300'}`}
        >
          <Globe className="h-8 w-8 text-indigo-600 mr-4" />
          <div>
             <span className="block text-sm font-medium text-gray-900">External AI</span>
             <span className="mt-1 flex items-center text-sm text-gray-500">Uses vast generic knowledge of the LLM.</span>
          </div>
        </div>

        <div 
          onClick={() => handleSourceChange('internal')}
          className={`relative rounded-lg border p-6 flex cursor-pointer focus:outline-none 
            ${courseData.sourceType === 'internal' ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-600' : 'bg-white border-gray-300'}`}
        >
          <Database className="h-8 w-8 text-indigo-600 mr-4" />
          <div>
             <span className="block text-sm font-medium text-gray-900">Internal Document (RAG)</span>
             <span className="mt-1 flex items-center text-sm text-gray-500">Injects custom knowledge via PDF or DOCX.</span>
          </div>
        </div>
      </div>

      {courseData.sourceType === 'internal' && (
        <div className="mt-6 border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center">
          {!uploadSuccess ? (
            <>
              <UploadCloud className="h-12 w-12 text-gray-400 mb-4" />
              <input 
                type="file" 
                accept=".pdf,.docx" 
                className="mb-4 text-sm"
                onChange={(e) => setFile(e.target.files[0])}
              />
              <button 
                onClick={handleUpload}
                disabled={!file || uploading}
                className="bg-indigo-600 text-white px-4 py-2 rounded shadow disabled:opacity-50"
              >
                {uploading ? 'Processing Document...' : 'Upload & Process'}
              </button>
            </>
          ) : (
            <div className="flex items-center text-green-600 font-medium">
               <CheckCircle className="mr-2 h-6 w-6" />
               Document Processed Successfully!
            </div>
          )}
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <button 
          onClick={onNext}
          disabled={!canProceed}
          className="bg-indigo-600 text-white px-5 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
