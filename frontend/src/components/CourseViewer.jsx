import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronDown, ChevronRight, BookOpen,
  CheckCircle, Video, PlayCircle, ClipboardList, Send,
  ThumbsUp, Play, Pause, Volume2, VolumeX, Maximize,
  X, Star, RotateCcw
} from 'lucide-react';
import QuizViewer from './QuizViewer';

// ─── Custom HTML5 Video Player ─────────────────────────────────────────────
function CustomVideoPlayer({ src }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef(null);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  }, [playing]);

  useEffect(() => {
    return () => clearTimeout(hideTimer.current);
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); setShowControls(true); }
    resetHideTimer();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress((v.currentTime / v.duration) * 100);
  };

  const handleLoadedMetadata = () => {
    setDuration(videoRef.current?.duration || 0);
  };

  const seekTo = (e) => {
    const v = videoRef.current;
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    v.currentTime = ratio * v.duration;
  };

  const fullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen();
  };

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="relative w-full bg-black aspect-video select-none"
      onMouseMove={resetHideTimer}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); if (playing) setShowControls(false); }}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => { setPlaying(false); setShowControls(true); }}
        onClick={togglePlay}
      />

      {/* Big centre play/pause on click */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        {!playing && (
          <div className="bg-black/50 rounded-full p-6 backdrop-blur-sm">
            <Play className="w-12 h-12 text-white fill-white" onClick={togglePlay} />
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pt-8 pb-3 transition-opacity duration-300 ${showControls || hovering || !playing ? 'opacity-100' : 'opacity-0'}`}
      >
        {/* Progress bar */}
        <div
          className="w-full h-1.5 bg-white/20 rounded-full mb-3 cursor-pointer group"
          onClick={seekTo}
        >
          <div
            className="h-full bg-red-500 rounded-full relative group-hover:h-2 transition-all"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full shadow opacity-0 group-hover:opacity-100 transition" />
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="hover:text-red-400 transition">
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button onClick={toggleMute} className="hover:text-red-400 transition">
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <span className="text-xs font-mono text-gray-300">
              {fmt(duration * (progress / 100))} / {fmt(duration)}
            </span>
          </div>
          <button onClick={fullscreen} className="hover:text-red-400 transition">
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quiz Modal Overlay ─────────────────────────────────────────────────────
function QuizModal({ quiz, onClose, onFinish }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);

  const questions = Array.isArray(quiz) ? quiz : (quiz?.questions || []);

  const handleSubmit = (e) => {
    e.preventDefault();
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.answer) correct++;
    });
    const pct = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 100;
    setScore(pct);
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-6 h-6 text-red-400" />
            <h2 className="text-xl font-bold text-white">Final Course Assessment</h2>
          </div>
          {!submitted && (
            <button onClick={onClose} className="text-gray-400 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="px-6 py-6">
          {submitted ? (
            <div className="text-center py-10">
              <div className={`inline-flex items-center justify-center w-28 h-28 rounded-full mb-6 ${score >= 70 ? 'bg-green-900/50 border-2 border-green-500' : 'bg-red-900/50 border-2 border-red-500'}`}>
                <span className={`text-4xl font-black ${score >= 70 ? 'text-green-400' : 'text-red-400'}`}>{score}%</span>
              </div>
              <h3 className="text-3xl font-black text-white mb-3">
                {score >= 70 ? '🎉 Excellent!' : '📚 Keep Learning!'}
              </h3>
              <p className="text-gray-400 mb-8">
                {score >= 70
                  ? `You scored ${score}% — outstanding performance!`
                  : `You scored ${score}%. Review the material and try again.`}
              </p>
              <div className="flex gap-4 justify-center">
                {score < 70 && (
                  <button
                    onClick={() => { setSubmitted(false); setAnswers({}); setScore(null); }}
                    className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-full transition"
                  >
                    <RotateCcw className="w-4 h-4" /> Retake Quiz
                  </button>
                )}
                <button
                  onClick={() => onFinish(score)}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-full transition transform hover:scale-105"
                >
                  {score >= 70 ? '🏆 Get Certificate' : 'Continue Learning'}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {questions.length === 0 ? (
                <p className="text-gray-400 text-center py-10">No quiz questions available for this course yet.</p>
              ) : (
                <div className="space-y-6">
                  <p className="text-gray-400 text-sm border-b border-gray-700 pb-3">
                    Answer all {questions.length} questions below.
                  </p>
                  {questions.map((q, qIdx) => (
                    <div key={qIdx} className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                      <h4 className="text-base font-semibold text-white mb-4">
                        <span className="text-red-400 mr-2">{qIdx + 1}.</span>{q.question}
                      </h4>
                      <div className="space-y-2">
                        {(q.options || []).map((opt, oIdx) => (
                          <label
                            key={oIdx}
                            className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition ${
                              answers[qIdx] === opt
                                ? 'bg-red-900/40 border-red-600 text-white'
                                : 'border-gray-700 hover:border-gray-500 text-gray-300 hover:bg-gray-800'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`q-${qIdx}`}
                              required
                              className="sr-only"
                              onChange={() => setAnswers(prev => ({ ...prev, [qIdx]: opt }))}
                            />
                            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition ${
                              answers[qIdx] === opt ? 'border-red-500 bg-red-500' : 'border-gray-500'
                            }`} />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-8">
                <button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl text-lg transition transform hover:scale-[1.02] disabled:opacity-50"
                  disabled={questions.length === 0}
                >
                  Submit Assessment
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Survey / Completion Screen ─────────────────────────────────────────────
function SurveyScreen({ onFinish }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  const handleSubmit = (e) => {
    e.preventDefault();
    onFinish();
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-950 p-8">
      <div className="max-w-xl w-full text-center">
        <div className="text-6xl mb-4">🎓</div>
        <h2 className="text-4xl font-black text-white mb-2">Course Complete!</h2>
        <p className="text-gray-400 mb-10 text-lg">You've mastered all the material. Please leave a quick rating!</p>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-700 rounded-2xl p-8 text-left space-y-6">
          {/* Star rating */}
          <div>
            <label className="block text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Your Rating</label>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition transform hover:scale-110"
                >
                  <Star
                    className={`w-10 h-10 transition ${(hoverRating || rating) >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">What did you enjoy most?</label>
            <textarea required rows={3} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-red-600 focus:outline-none" placeholder="The video content was very clear..." />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">Any suggestions for improvement?</label>
            <textarea rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-red-600 focus:outline-none" placeholder="Optional..." />
          </div>

          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 transition transform hover:scale-[1.02]"
          >
            <Send className="w-5 h-5" /> Submit & Finish Course
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main CourseViewer ──────────────────────────────────────────────────────
export default function CourseViewer({ course, onBack }) {
  const { details, structure, content, quiz } = course || {};

  if (!course) return null;

  const [expandedModule, setExpandedModule] = useState(0);
  const [activeChap, setActiveChap] = useState({ modIdx: 0, chapIdx: 0 });
  const [completedItems, setCompletedItems] = useState([]);
  const [quizOpen, setQuizOpen] = useState(false);
  const [surveyMode, setSurveyMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Count totals
  let totalItems = 0;
  structure?.modules?.forEach(mod => { totalItems += (mod.chapters || []).length; });

  const progressPercent = totalItems > 0 ? Math.round((completedItems.length / totalItems) * 100) : 0;
  const isCourseFinished = totalItems > 0 && completedItems.length >= totalItems;

  const activeModule = structure?.modules?.[activeChap.modIdx];
  const activeChapData = activeModule?.chapters?.[activeChap.chapIdx];
  const activeChapContent = content?.find(c =>
    c.module_title === activeModule?.title && c.title === activeChapData?.title
  );

  const markComplete = () => {
    const key = `${activeChap.modIdx}-${activeChap.chapIdx}`;
    if (!completedItems.includes(key)) setCompletedItems(prev => [...prev, key]);
  };

  const jumpTo = (mIdx, cIdx) => {
    setExpandedModule(mIdx);
    setActiveChap({ modIdx: mIdx, chapIdx: cIdx });
  };

  const handleQuizFinish = (score) => {
    setQuizOpen(false);
    if (score >= 70) setSurveyMode(true);
  };

  // Smart media renderer — handles Video, Audio, PDF, and Documents
  const renderMediaComponent = (url) => {
    if (!url) return null;

    const lowerUrl = url.toLowerCase();

    // YouTube Embed
    const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (ytMatch) {
      return (
        <iframe
          src={`https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`}
          title="Video Player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full aspect-video border-0"
        />
      );
    }

    // Audio Files
    if (lowerUrl.includes('.mp3') || lowerUrl.includes('.wav')) {
      return (
        <div className="flex flex-col items-center justify-center py-16 bg-gray-900 w-full h-64 border-b border-gray-800">
           <Volume2 className="w-16 h-16 text-indigo-400 mb-6 animate-pulse" />
           <audio controls autoPlay controlsList="nodownload" className="w-11/12 max-w-md">
             <source src={url} />
             Your browser does not support the audio element.
           </audio>
        </div>
      );
    }

    // PDF Files
    if (lowerUrl.includes('.pdf')) {
      return (
        <div className="w-full h-[70vh] bg-gray-200">
           <object data={url} type="application/pdf" className="w-full h-full">
               <embed src={url} type="application/pdf" className="w-full h-full" />
               <div className="flex flex-col items-center justify-center h-full p-10 bg-gray-900 border border-gray-700 text-white text-center">
                  <BookOpen className="w-16 h-16 text-red-500 mb-4" />
                  <span className="font-bold text-lg mb-2">PDF Viewing Not Supported</span>
                  <span className="text-sm text-gray-400 mb-4">Your browser doesn't natively support embedded PDFs.</span>
                  <a href={url} target="_blank" rel="noreferrer" className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded-lg transition">
                     Download PDF
                  </a>
               </div>
           </object>
        </div>
      );
    }

    // Office Documents (PPT, DOC, etc)
    if (lowerUrl.includes('.ppt') || lowerUrl.includes('.pptx') || lowerUrl.includes('.doc') || lowerUrl.includes('.docx')) {
      return (
        <div className="flex flex-col items-center justify-center py-24 bg-gray-900 border-b border-gray-800 text-white text-center">
          <BookOpen className="w-16 h-16 text-blue-400 mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">Office Document</h3>
          <p className="text-gray-400 max-w-md mx-auto mb-6">This document format cannot be previewed natively in the browser. Please download it to view.</p>
          <a href={url} target="_blank" rel="noreferrer" className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition hover:-translate-y-0.5">
             Download to View 
          </a>
        </div>
      );
    }

    // Video Files (fallback based on structure from before)
    if (lowerUrl.includes('.mp4') || lowerUrl.includes('/uploads/')) {
      return <CustomVideoPlayer src={url} />;
    }

    // General fallback
    return (
      <a href={url} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center py-20 bg-gray-900 border border-gray-700 text-white hover:bg-gray-800 transition">
        <Video className="w-16 h-16 text-red-400 mb-4" />
        <span className="font-semibold text-lg">Open Media File</span>
        <span className="text-sm text-gray-400 mt-1 truncate max-w-sm">{url}</span>
      </a>
    );
  };

  if (surveyMode) {
    return <SurveyScreen onFinish={onBack} />;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col font-sans text-white">

      {/* ── Quiz Modal ── */}
      {quizOpen && (
        <QuizModal
          quiz={quiz}
          onClose={() => setQuizOpen(false)}
          onFinish={handleQuizFinish}
        />
      )}

      {/* ── Top Navigation Bar ── */}
      <header className="bg-black/80 backdrop-blur-md border-b border-gray-800 sticky top-0 z-40">
        <div className="flex items-center justify-between h-14 px-4 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="flex-shrink-0 text-gray-400 hover:text-white transition p-1"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-bold text-white truncate max-w-sm">{details?.title}</h1>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs text-gray-400 whitespace-nowrap">{completedItems.length}/{totalItems} lessons</span>
            <div className="w-32 sm:w-48 bg-gray-800 rounded-full h-1.5">
              <div
                className="bg-red-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-bold text-white whitespace-nowrap">{progressPercent}%</span>
          </div>

          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="sm:hidden text-gray-400 hover:text-white transition"
          >
            <ChevronRight className={`w-5 h-5 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </header>

      {/* ── Main Layout ── */}
      <main className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>

        {/* ── Sidebar ── */}
        <aside className={`${sidebarOpen ? 'w-72 sm:w-80' : 'w-0'} bg-gray-900 border-r border-gray-800 flex-shrink-0 overflow-y-auto transition-all duration-300 flex flex-col`}>
          <div className="p-4 border-b border-gray-800 flex-shrink-0">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Course Curriculum</p>
          </div>

          <nav className="flex-1 overflow-y-auto divide-y divide-gray-800/50">
            {structure?.modules?.map((mod, mIdx) => (
              <div key={mIdx}>
                <button
                  onClick={() => setExpandedModule(expandedModule === mIdx ? null : mIdx)}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-800 transition text-left"
                >
                  <span className="text-sm font-semibold text-gray-200 leading-snug pr-2">{mod.title}</span>
                  {expandedModule === mIdx
                    ? <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />}
                </button>

                {expandedModule === mIdx && (
                  <div className="bg-gray-950/60">
                    {(mod.chapters || []).map((chap, cIdx) => {
                      const key = `${mIdx}-${cIdx}`;
                      const isDone = completedItems.includes(key);
                      const isActive = activeChap.modIdx === mIdx && activeChap.chapIdx === cIdx;
                      return (
                        <button
                          key={cIdx}
                          onClick={() => jumpTo(mIdx, cIdx)}
                          className={`w-full flex items-start gap-3 px-5 py-3 text-left text-sm transition border-l-2 ${
                            isActive
                              ? 'border-red-500 bg-gray-800 text-white'
                              : 'border-transparent hover:border-gray-600 hover:bg-gray-800/50 text-gray-400'
                          }`}
                        >
                          <span className="mt-0.5 flex-shrink-0">
                            {isDone
                              ? <CheckCircle className="w-4 h-4 text-green-400" />
                              : <PlayCircle className={`w-4 h-4 ${isActive ? 'text-red-400' : 'text-gray-600'}`} />}
                          </span>
                          <span className={`leading-snug ${isActive ? 'font-medium' : ''}`}>{chap.title}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Final Exam Button */}
          <div className="p-4 border-t border-gray-800 flex-shrink-0">
            <button
              onClick={() => setQuizOpen(true)}
              disabled={!isCourseFinished}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition ${
                isCourseFinished
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              {isCourseFinished ? 'Take Final Exam' : `Complete all lessons first`}
            </button>
          </div>
        </aside>

        {/* ── Content Area ── */}
        <section className="flex-1 overflow-y-auto bg-gray-950">

          {!activeChapContent ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md px-6">
                <div className="text-6xl mb-4">📭</div>
                <h3 className="text-xl font-bold text-white mb-2">Content Not Yet Generated</h3>
                <p className="text-gray-400 text-sm">This chapter hasn't been generated yet. Go back to the Content editor and generate the lesson first.</p>
                <button onClick={onBack} className="mt-6 bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded-lg transition">
                  Back to Editor
                </button>
              </div>
            </div>
          ) : (
            <div>

              {/* Video / Image Hero Block */}
              {(activeChapContent.video_url || activeChapContent.content_type === 'video') ? (
                <div className="bg-black flex items-center justify-center">
                  {renderMediaComponent(activeChapContent.video_url)}
                </div>
              ) : activeChapContent.image_url ? (
                <div className="relative bg-black h-72 sm:h-96 overflow-hidden flex items-center justify-center">
                  <img
                    src={activeChapContent.image_url}
                    alt="Lesson Visual"
                    className="absolute inset-0 w-full h-full object-cover opacity-30 blur-lg"
                  />
                  <img
                    src={activeChapContent.image_url}
                    alt="Lesson Visual"
                    className="relative z-10 h-full max-w-full object-contain"
                  />
                </div>
              ) : null}

              {/* Lesson Content */}
              <div className="max-w-4xl mx-auto px-6 sm:px-10 lg:px-16 py-10">

                {/* Breadcrumb */}
                <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-3">
                  Module {activeChap.modIdx + 1} — {activeModule?.title}
                </p>
                <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-8 leading-tight">
                  {activeChapData?.title}
                </h1>

                {/* AI Generated Text */}
                {(!activeChapContent.content_type || activeChapContent.content_type === 'ai_generated') && (
                  <div className="space-y-8">
                    <div className="text-gray-300 text-lg leading-8 font-serif whitespace-pre-wrap">
                      {activeChapContent.explanation}
                    </div>

                    {/* Key Points */}
                    {activeChapContent.key_points?.length > 0 && (
                      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <span className="text-red-400">📌</span> Key Takeaways
                        </h3>
                        <ul className="space-y-3">
                          {activeChapContent.key_points.map((kp, i) => (
                            <li key={i} className="flex items-start gap-3 text-gray-300">
                              <span className="text-red-400 font-bold mt-0.5 flex-shrink-0">→</span>
                              <span>{kp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Examples */}
                    {activeChapContent.examples?.length > 0 && (
                      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">💡 Examples</h3>
                        <ul className="space-y-3">
                          {activeChapContent.examples.map((ex, i) => (
                            <li key={i} className="text-gray-300 italic border-l-2 border-gray-600 pl-4">{ex}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Document Type */}
                {activeChapContent.content_type === 'document' && (
                  <div className="bg-gray-900 border border-gray-700 rounded-2xl p-10 text-center">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 text-blue-400" />
                    <h3 className="text-2xl font-bold text-white mb-2">Reading Material</h3>
                    <p className="text-gray-400 mb-6">The instructor has provided a document for this lesson.</p>
                    <a
                      href={activeChapContent.document_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition hover:-translate-y-0.5"
                    >
                      Open Document ↗
                    </a>
                  </div>
                )}

                {/* Mark Complete CTA */}
                <div className="mt-12 bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <p className="text-white font-semibold">Done with this lesson?</p>
                    <p className="text-gray-500 text-sm mt-0.5">Mark it complete to track your progress.</p>
                  </div>
                  <button
                    onClick={markComplete}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition transform hover:scale-105 flex-shrink-0 ${
                      completedItems.includes(`${activeChap.modIdx}-${activeChap.chapIdx}`)
                        ? 'bg-green-900/50 text-green-400 border border-green-800'
                        : 'bg-red-600 hover:bg-red-500 text-white'
                    }`}
                  >
                    {completedItems.includes(`${activeChap.modIdx}-${activeChap.chapIdx}`)
                      ? <><CheckCircle className="w-4 h-4" /> Completed</>
                      : <><PlayCircle className="w-4 h-4" /> Mark as Complete</>
                    }
                  </button>
                </div>

                {/* Chapter MCQs Assessment */}
                {activeChapContent.mcqs && (
                  <div className="mt-12 bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-8 overflow-hidden shadow-inner font-sans">
                     <QuizViewer questions={activeChapContent.mcqs} title={`${activeChapData?.title} Chapter Quiz`} lightMode={false} />
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
