import React, { useState } from 'react';
import { Bot, FileText, UploadCloud, Globe, Video, Link, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import { uploadDoc, fetchWebDocument, fetchYouTubeDocument } from '../api';

export default function SourceSelection({ courseData, updateCourseData, onNext }) {
  const [sourceType, setSourceType] = useState(courseData.sourceType || 'external');
  const [activeTab, setActiveTab] = useState('file');
  const [file, setFile] = useState(null);
  const [webUrl, setWebUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSourceChange = (type) => {
    setSourceType(type);
    updateCourseData('sourceType', type);
  };

  const handleProcessSource = async () => {
    if (sourceType === 'external') {
      onNext();
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (activeTab === 'file' && file) {
        await uploadDoc(file);
      } else if (activeTab === 'web' && webUrl) {
        await fetchWebDocument(webUrl);
      } else if (activeTab === 'youtube' && youtubeUrl) {
        await fetchYouTubeDocument(youtubeUrl);
      } else {
        throw new Error("Please provide a source.");
      }
      onNext();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-3xl font-black text-gray-900 mb-3">Choose Your Knowledge Source</h2>
        <p className="text-gray-500 font-medium">Decide how you want to build your course. Use AI's vast knowledge or provide your own documents.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* External Source Card */}
        <div 
          onClick={() => handleSourceChange('external')}
          className={`relative group cursor-pointer p-8 rounded-3xl border-2 transition-all duration-300 ${
            sourceType === 'external' 
            ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50 shadow-xl' 
            : 'border-gray-100 bg-white hover:border-indigo-200 hover:shadow-lg'
          }`}
        >
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${
            sourceType === 'external' ? 'bg-indigo-600' : 'bg-gray-100 group-hover:bg-indigo-100'
          }`}>
            <Bot className={`w-8 h-8 ${sourceType === 'external' ? 'text-white' : 'text-gray-500 group-hover:text-indigo-600'}`} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">External Intelligence</h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            Let our AI generate a comprehensive course based on its extensive global knowledge. Perfect for general topics and skill-building.
          </p>
          <div className={`mt-6 flex items-center text-sm font-bold ${sourceType === 'external' ? 'text-indigo-600' : 'text-gray-400 opacity-0 group-hover:opacity-100'}`}>
            Select this option <ChevronRight className="w-4 h-4 ml-1" />
          </div>
          {sourceType === 'external' && <CheckCircle2 className="absolute top-6 right-6 w-6 h-6 text-indigo-600 animate-scale-in" />}
        </div>

        {/* Internal Source Card */}
        <div 
          onClick={() => handleSourceChange('internal')}
          className={`relative group cursor-pointer p-8 rounded-3xl border-2 transition-all duration-300 ${
            sourceType === 'internal' 
            ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50 shadow-xl' 
            : 'border-gray-100 bg-white hover:border-indigo-200 hover:shadow-lg'
          }`}
        >
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${
            sourceType === 'internal' ? 'bg-indigo-600' : 'bg-gray-100 group-hover:bg-indigo-100'
          }`}>
            <FileText className={`w-8 h-8 ${sourceType === 'internal' ? 'text-white' : 'text-gray-500 group-hover:text-indigo-600'}`} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Knowledge Base</h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            Provide your own documents, URLs, or YouTube videos. AI will extract and synthesize content specifically from your materials.
          </p>
          <div className={`mt-6 flex items-center text-sm font-bold ${sourceType === 'internal' ? 'text-indigo-600' : 'text-gray-400 opacity-0 group-hover:opacity-100'}`}>
            Select this option <ChevronRight className="w-4 h-4 ml-1" />
          </div>
          {sourceType === 'internal' && <CheckCircle2 className="absolute top-6 right-6 w-6 h-6 text-indigo-600 animate-scale-in" />}
        </div>
      </div>

      {sourceType === 'internal' && (
        <div className="mt-12 bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm animate-slide-up">
          <div className="flex border-b border-gray-100 bg-gray-50/50 p-2">
            {[
              { id: 'file', icon: UploadCloud, label: 'Upload File' },
              { id: 'web', icon: Globe, label: 'Web URL' },
              { id: 'youtube', icon: Video, label: 'YouTube Video' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${
                  activeTab === tab.id 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-8">
            {activeTab === 'file' && (
              <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/30 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group">
                <UploadCloud className="w-12 h-12 text-gray-300 group-hover:text-indigo-400 mb-4 transition-colors" />
                <p className="text-sm font-bold text-gray-700 mb-1">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-400 mb-6">PDF, DOCX, TXT, or CSV (max. 10MB)</p>
                <input 
                  type="file" 
                  className="hidden" 
                  id="file-upload"
                  onChange={(e) => setFile(e.target.files[0])}
                  accept=".pdf,.docx,.txt,.csv"
                />
                <label 
                  htmlFor="file-upload"
                  className="cursor-pointer bg-white border border-gray-200 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:border-indigo-200 hover:text-indigo-600 transition"
                >
                  {file ? file.name : 'Choose File'}
                </label>
              </div>
            )}

            {activeTab === 'web' && (
              <div className="space-y-4">
                <label className="block text-sm font-bold text-gray-700">Paste Website URL</label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    type="url" 
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    placeholder="https://example.com/article"
                    className="w-full pl-14 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled
                  />
                </div>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Link className="w-3 h-3" /> We'll extract text content from the provided webpage.
                </p>
              </div>
            )}

            {activeTab === 'youtube' && (
              <div className="space-y-4">
                <label className="block text-sm font-bold text-gray-700">YouTube Video URL</label>
                <div className="relative">
                  <Video className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    type="url" 
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full pl-14 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled
                  />
                </div>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Link className="w-3 h-3" /> We'll use the video's transcript to build your course.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium animate-pulse">
          {error}
        </div>
      )}

      <div className="flex justify-center pt-12 pb-10">
        <button 
          onClick={handleProcessSource}
          disabled={loading || (sourceType === 'internal' && activeTab === 'file' && !file) || (sourceType === 'internal' && activeTab === 'web') || (sourceType === 'internal' && activeTab === 'youtube')}
          className="group relative bg-indigo-600 text-white px-12 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition shadow-xl hover:shadow-indigo-200 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
        >
          {loading ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Analyzing Source...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              Continue to Details
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
