import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X, Loader2 } from 'lucide-react';

export default function SecureDocViewer({ url, onClose }) {
  const [pdf, setPdf] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loaded, setLoaded] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);

  // Load PDF.js from CDN dynamically
  useEffect(() => {
    const loadPdfjs = () => {
      if (window.pdfjsLib) {
        setLoaded(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        setLoaded(true);
      };
      script.onerror = () => {
        setError("Failed to load PDF rendering library. Check internet connectivity.");
      };
      document.body.appendChild(script);
    };

    loadPdfjs();

    // Disable print, save, and copy shortcuts
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'p' || e.key === 's' || e.key === 'u')) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch the PDF document
  useEffect(() => {
    if (!loaded) return;
    let isCurrent = true;
    const loadPdfDoc = async () => {
      try {
        setError(null);
        const loadingTask = window.pdfjsLib.getDocument(url);
        const pdfDoc = await loadingTask.promise;
        if (isCurrent) {
          setPdf(pdfDoc);
          setNumPages(pdfDoc.numPages);
          setPageNum(1);
        }
      } catch (err) {
        console.error('Failed to load PDF document:', err);
        if (isCurrent) {
          setError(err.message || 'Invalid or corrupted document format. LibreOffice conversion might have failed.');
        }
      }
    };
    loadPdfDoc();
    return () => {
      isCurrent = false;
    };
  }, [loaded, url]);

  // Render the current page on canvas
  const renderPage = useCallback(async () => {
    if (!pdf || !canvasRef.current) return;
    setRendering(true);
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
    } catch (err) {
      console.error('Page rendering error:', err);
    } finally {
      setRendering(false);
    }
  }, [pdf, pageNum, scale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Page navigation helpers
  const goPrev = () => {
    if (pageNum > 1) setPageNum(pageNum - 1);
  };
  const goNext = () => {
    if (pageNum < numPages) setPageNum(pageNum + 1);
  };

  const zoomIn = () => setScale(s => Math.min(s + 0.2, 3));
  const zoomOut = () => setScale(s => Math.max(s - 0.2, 0.6));

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Viewer Header */}
      <header className="bg-gray-950/90 border-b border-gray-850 px-4 py-3 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <Paperclip className="w-5 h-5 text-orange-400" />
          <span className="font-bold text-sm">Secure Document Reader</span>
        </div>

        {/* Toolbar Controls */}
        {pdf && (
          <div className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5">
            <button 
              onClick={goPrev} 
              disabled={pageNum <= 1}
              className="text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-mono">
              Page {pageNum} of {numPages}
            </span>
            <button 
              onClick={goNext} 
              disabled={pageNum >= numPages}
              className="text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="h-4 w-px bg-gray-800" />
            <button onClick={zoomOut} className="text-gray-400 hover:text-white transition">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono">{Math.round(scale * 100)}%</span>
            <button onClick={zoomIn} className="text-gray-400 hover:text-white transition">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        )}

        <button 
          onClick={onClose} 
          className="text-gray-400 hover:text-white transition p-1 hover:bg-gray-900 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Main Canvas Viewport */}
      <div className="flex-1 overflow-auto p-6 flex justify-center items-start bg-gray-900/50">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full max-w-md text-center gap-4 mt-20 text-gray-300">
            <div className="w-14 h-14 bg-red-950/40 border border-red-900/50 rounded-2xl flex items-center justify-center text-red-500 text-2xl font-bold">⚠️</div>
            <div>
              <h3 className="font-bold text-white text-base">Failed to Display Document</h3>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">{error}</p>
            </div>
            <button 
              onClick={onClose} 
              className="mt-2 bg-gray-800 hover:bg-gray-755 text-white text-xs font-bold px-5 py-2.5 rounded-xl border border-gray-700 transition"
            >
              Close Reader
            </button>
          </div>
        ) : !pdf ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 mt-20">
            <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
            <span className="text-sm font-medium">Securing and opening document...</span>
          </div>
        ) : (
          <div className="relative shadow-2xl border border-gray-800 rounded-lg overflow-hidden bg-white max-w-full">
            {rendering && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-xs flex items-center justify-center z-10">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
              </div>
            )}
            <canvas ref={canvasRef} className="max-w-full block" />
          </div>
        )}
      </div>
    </div>
  );
}

// Simple Helper to reuse Paperclip icon easily
function Paperclip(props) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
