import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Send, BookOpen, Layers, CheckCircle, 
  HelpCircle, Eye, Sparkles, ChevronRight, ChevronLeft, 
  Trash2, Loader2, Award, FileText, Check, Paperclip, 
  Mic, Lightbulb, Compass, ThumbsUp, ThumbsDown, Copy, 
  RotateCcw, X, Search, Bell, Info, Plus, PanelLeft
} from 'lucide-react';
import { chatWithChatbotBuilder, createCourse, uploadDoc, generateLessonContent, saveChatbotDraft, getChatbotDrafts, getChatbotDraft, deleteChatbotDraft, renameChatbotDraft, getSubjects } from '../api';
import logo from '../assets/logo.png';

const SUGGESTED_CHIPS = [
  "Create a Python programming course",
  "Design a Basic English Grammar course",
  "Build a Data Science & AI curriculum",
  "Generate a digital marketing class"
];

const STEPS = [
  { id: 'GATHER_DETAILS', label: 'Details', icon: FileText },
  { id: 'OUTLINE_EDIT', label: 'Outline', icon: Layers },
  { id: 'CONTENT_GEN', label: 'Lessons', icon: BookOpen },
  { id: 'QUIZ_GEN', label: 'Quizzes', icon: HelpCircle },
  { id: 'READY', label: 'Publish', icon: CheckCircle }
];

export default function ChatbotCourseCreator({ onClose }) {
  // States
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickReplies, setQuickReplies] = useState([]);
  const [currentStep, setCurrentStep] = useState('GATHER_DETAILS');
  const [deepThinkActive, setDeepThinkActive] = useState(false);
  const [generatingChapter, setGeneratingChapter] = useState(null);
  const [activeLessonModal, setActiveLessonModal] = useState(null);
  
  // Collage Sidebar & DB Draft States
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [draftsList, setDraftsList] = useState([]);
  const [activeDraftId, setActiveDraftId] = useState(() => 'draft_' + Date.now());
  const [searchQuery, setSearchQuery] = useState('');
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [editingTitleText, setEditingTitleText] = useState('');
  const [activeCardDetails, setActiveCardDetails] = useState(null);
  const [dbSubjects, setDbSubjects] = useState([]);
  const [subjectSearchText, setSubjectSearchText] = useState('');
  const [subjectDropdownOpen, setSubjectDropdownOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [messageFeedback, setMessageFeedback] = useState({});
  
  // Course data state
  const [courseData, setCourseData] = useState({
    sourceType: 'external',
    details: {
      courseType: 'Custom Course',
      subject: '',
      courseName: '',
      description: '',
      price: '299',
      duration: '14',
      requirements: '',
      level: 'beginner',
      language: 'English',
      scriptingLanguage: 'NA',
      evaluator: 'Sarah Johnson'
    },
    structure: { modules: [] },
    content: [],
    quiz: []
  });

  // Attachments
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Load drafts list on mount and check for shared url parameter
  const fetchDraftsList = async () => {
    try {
      const res = await getChatbotDrafts();
      if (res && res.status === 'success') {
        setDraftsList(res.drafts || []);
      }
    } catch (err) {
      console.error("Failed to load drafts list from MySQL", err);
    }
  };

  const loadDbSubjects = async () => {
    try {
      const res = await getSubjects();
      const standardList = [
        "English", "Maths", "Science", "Social", "Physics", "Chemistry", "Biology",
        "History", "Geography", "Economics", "Computer Science", "Data Science",
        "Machine Learning", "AI", "Python Programming", "Digital Marketing", "Business Management"
      ];
      
      if (res && res.status === 'success') {
        const rawSubjects = res.subjects || [];
        const seen = new Set();
        const cleanList = [];

        // Add standard list first
        standardList.forEach(s => {
          seen.add(s.toLowerCase());
          cleanList.push(s);
        });

        // Filter and add database subjects
        rawSubjects.forEach(item => {
          const name = (item.subject_name || '').trim();
          if (!name || name.length < 2 || name.length > 50) return;
          if (/^[^a-zA-Z0-9]+$/.test(name)) return;
          if (/^[\d]+$/.test(name)) return;
          if (name.includes('@@') || name.includes('test') || name.includes('eee')) return;

          const lower = name.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            cleanList.push(name);
          }
        });

        // Sort alphabetically
        cleanList.sort((a, b) => a.localeCompare(b));
        setDbSubjects(cleanList);
      } else {
        setDbSubjects(standardList);
      }
    } catch (err) {
      console.error("Failed to load subjects from database", err);
      const standardList = [
        "English", "Maths", "Science", "Social", "Physics", "Chemistry", "Biology",
        "History", "Geography", "Economics", "Computer Science", "Data Science",
        "Machine Learning", "AI", "Python Programming", "Digital Marketing", "Business Management"
      ];
      setDbSubjects(standardList);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlDraftId = params.get('draftId');
    if (urlDraftId) {
      loadSpecificDraft(urlDraftId);
    }
    fetchDraftsList();
    loadDbSubjects();
  }, []);

  // Auto-save active draft to MySQL DB when state updates
  useEffect(() => {
    if (activeDraftId && Array.isArray(messages) && messages.length > 0) {
      // Look for manual override name or extracted name, else fallback to first user message
      let derivedName = courseData?.details?.courseName || "";
      if (!derivedName.trim()) {
        const firstUserMsg = messages.find(m => m.role === 'user');
        if (firstUserMsg) {
          derivedName = firstUserMsg.content;
          if (derivedName.length > 30) {
            derivedName = derivedName.slice(0, 30) + "...";
          }
        } else {
          derivedName = "Untitled Chat";
        }
      }

      // Default price to "0" in backend save to protect schemas
      const normalizedDetails = {
        ...(courseData?.details || {}),
        price: courseData?.details?.price || "0"
      };

      const payload = {
        id: activeDraftId,
        courseName: derivedName,
        currentStep,
        courseData: { ...courseData, details: normalizedDetails },
        messages
      };
      
      saveChatbotDraft(payload)
        .then(() => {
          getChatbotDrafts().then(res => {
            if (res && res.status === 'success') {
              setDraftsList(res.drafts || []);
            }
          });
        })
        .catch(err => console.error("MySQL draft autosave failed", err));
    }
  }, [messages, courseData, currentStep, activeDraftId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend, overrideStep = null, overrideCourseData = null) => {
    if (!textToSend.trim() && !attachedFile) return;
    if (loading) return;

    let finalMessageText = textToSend;

    // Transition to chat workspace if on landing screen
    if (!started) {
      setStarted(true);
    }

    const userMsg = {
      role: 'user',
      content: finalMessageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);
    setQuickReplies([]);

    try {
      const currentMessages = Array.isArray(messages) ? messages : [];
      const historyForApi = currentMessages.concat(userMsg)
        .filter(m => m && typeof m.content === 'string')
        .map(m => ({
          role: m.role || 'user',
          content: m.content || ''
        }));

      const stepToUse = overrideStep || currentStep;
      const courseDataToUse = overrideCourseData || courseData;
      const res = await chatWithChatbotBuilder(historyForApi, stepToUse, courseDataToUse);

      if (res && res.status === 'success') {
        const assistantMsg = {
          role: 'assistant',
          content: res.reply || '',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          metadata: res.metadata || null,
          metadataType: res.type || null
        };

        setMessages(prev => [...prev, assistantMsg]);
        setQuickReplies(res.quickReplies || []);

        // Safe merging of metadata suggestions into courseData
        if (res.metadata) {
          setCourseData(prev => {
            const updated = { ...prev };
            if (res.type === 'details') {
              updated.details = { ...(prev.details || {}), ...res.metadata, price: "0" };
              setActiveCardDetails({ ...res.metadata, price: "0" });
            } else if (res.type === 'structure') {
              const normalizedModules = (res.metadata?.modules || []).map(m => {
                if (!m) return null;
                const normalizedChapters = (m.chapters || []).map(c => {
                  if (!c) return null;
                  return {
                    ...c,
                    contents: c.contents || [],
                    content: c.content || {
                      content_type: 'html',
                      html_content: '',
                      completed: false
                    }
                  };
                }).filter(Boolean);
                return { ...m, chapters: normalizedChapters };
              }).filter(Boolean);
              
              updated.structure = { ...res.metadata, modules: normalizedModules };

              const flatChapters = [];
              normalizedModules.forEach((m) => {
                m.chapters?.forEach((c) => {
                  flatChapters.push({ module: m.title || '', title: c.title || '' });
                });
              });
              updated.content = flatChapters.map(fc => {
                const existing = prev.content?.find(ex => ex.module_title === fc.module && ex.chapter_title === fc.title);
                return existing || {
                  module_title: fc.module,
                  chapter_title: fc.title,
                  contents: []
                };
              });
            } else if (res.type === 'content') {
              if (res.metadata.prompts) {
                updated.content = (prev.content || []).map(c => {
                  const match = res.metadata.prompts.find(p => p && p.title === c.chapter_title);
                  return match ? { ...c, prompt: match.prompt } : c;
                });
              } else if (res.metadata.prompt) {
                updated.content = (prev.content || []).map(c => {
                  if (c.chapter_title === res.metadata.title) {
                    return { ...c, prompt: res.metadata.prompt };
                  }
                  return c;
                });
              }
            } else if (res.type === 'quiz') {
              updated.quiz = res.metadata.questions || res.metadata || [];
            }
            return updated;
          });
        }
      }
    } catch (err) {
      console.error("API Call error", err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I encountered an error processing your query. Let's try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Regenerate Response
  const handleRegenerateResponse = async () => {
    const currentMessages = Array.isArray(messages) ? messages : [];
    if (currentMessages.length < 2 || loading) return;
    
    let lastUserMessageIdx = -1;
    for (let i = currentMessages.length - 1; i >= 0; i--) {
      if (currentMessages[i] && currentMessages[i].role === 'user') {
        lastUserMessageIdx = i;
        break;
      }
    }

    if (lastUserMessageIdx === -1) return;

    const lastUserMessage = currentMessages[lastUserMessageIdx];
    const trimmedMessages = currentMessages.slice(0, lastUserMessageIdx);
    
    setMessages(trimmedMessages);
    setInputMessage(lastUserMessage.content || '');
    
    handleSendMessage(lastUserMessage.content || '');
  };

  // Ingestion File Attach
  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setAttachedFile(file);
    try {
      const res = await uploadDoc(file);
      if (res && res.status === 'success') {
        setCourseData(prev => ({
          ...prev,
          sourceType: 'internal'
        }));
        handleSendMessage(`I've uploaded the document "${file.name}" to help create the course content. Please outline the syllabus based on it.`);
      }
    } catch (err) {
      console.error("Failed to upload document", err);
      alert("Failed to upload document.");
      setAttachedFile(null);
    } finally {
      setUploadingFile(false);
    }
  };

  // Final Publish
  const handlePublish = async () => {
    if (!courseData.details?.courseName) {
      alert("Cannot publish a course without a name. Please define course details first.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        sourceType: courseData.sourceType || 'external',
        details: courseData.details || {},
        structure: courseData.structure || { modules: [] },
        content: courseData.content || [],
        quiz: courseData.quiz || []
      };
      const result = await createCourse(payload);
      if (result && result.status === 'success') {
        localStorage.removeItem('ai_chatbot_course_draft');
        alert("Success! Your AI course has been published to your academy.");
        onClose();
      }
    } catch (err) {
      console.error("Publishing error", err);
      alert("Error publishing course.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (!window.confirm("Are you sure you want to discard your draft and start over?")) return;
    handleResetWithoutConfirm();
  };

  // Copy to clipboard helper
  const handleCopyText = (text, index) => {
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedIndex(index);
        setTimeout(() => {
          setCopiedIndex(null);
        }, 2000);
      })
      .catch(err => {
        console.error("Copy failed", err);
      });
  };

  // Feedback loader (like/dislike toggles)
  const handleFeedback = (index, type) => {
    setMessageFeedback(prev => {
      const current = prev[index];
      const nextType = current === type ? null : type;
      return { ...prev, [index]: nextType };
    });
  };

  // Rename a draft in local state and DB
  const handleRenameDraft = async (id) => {
    if (!editingTitleText.trim()) {
      setEditingDraftId(null);
      return;
    }
    
    try {
      await renameChatbotDraft(id, editingTitleText.trim());
      setDraftsList(prev => prev.map(d => d.id === id ? { ...d, courseName: editingTitleText.trim() } : d));
      
      if (id === activeDraftId) {
        setCourseData(prev => ({
          ...prev,
          details: {
            ...prev.details,
            courseName: editingTitleText.trim()
          }
        }));
      }
    } catch (err) {
      console.error("Rename failed", err);
    } finally {
      setEditingDraftId(null);
    }
  };

  // Load a draft from MySQL
  const loadSpecificDraft = async (id) => {
    try {
      setLoading(true);
      const res = await getChatbotDraft(id);
      if (res && res.status === 'success' && res.draft) {
        const d = res.draft;
        setActiveDraftId(d.id);
        setMessages(d.messages || []);
        setCourseData(d.courseData || {
          sourceType: 'external',
          details: { level: 'beginner', language: 'English', scriptingLanguage: 'NA', price: '0' },
          structure: { modules: [] },
          content: [],
          quiz: []
        });
        setCurrentStep(d.currentStep || 'GATHER_DETAILS');
        setStarted(true);
        if (d.courseData?.details) {
          setActiveCardDetails({ ...d.courseData.details, price: "0" });
        } else {
          setActiveCardDetails(null);
        }
      }
    } catch (err) {
      console.error("Failed to load specific draft", err);
      alert("Failed to load draft.");
    } finally {
      setLoading(false);
    }
  };

  // Delete draft from MySQL
  const handleDeleteDraft = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this draft session from MySQL?")) return;
    try {
      const res = await deleteChatbotDraft(id);
      if (res && res.status === 'success') {
        setDraftsList(prev => prev.filter(d => d.id !== id));
        if (activeDraftId === id) {
          handleResetWithoutConfirm();
        }
      }
    } catch (err) {
      console.error("Failed to delete draft", err);
      alert("Failed to delete draft.");
    }
  };

  const handleResetWithoutConfirm = () => {
    const newId = 'draft_' + Date.now();
    setActiveDraftId(newId);
    setMessages([]);
    setCourseData({
      sourceType: 'external',
      details: {
        courseType: 'Custom Course',
        subject: '',
        courseName: '',
        description: '',
        price: '0',
        duration: '14',
        requirements: '',
        level: 'beginner',
        language: 'English',
        scriptingLanguage: 'NA',
        evaluator: 'Sarah Johnson'
      },
      structure: { modules: [] },
      content: [],
      quiz: []
    });
    setStarted(false);
    setCurrentStep('GATHER_DETAILS');
    setQuickReplies([]);
    setActiveCardDetails(null);
    setAttachedFile(null);
  };

  // Group drafts dynamically by modify date
  const getGroupedDrafts = () => {
    const filtered = draftsList.filter(d => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (d.courseName || '').toLowerCase().includes(q) || (d.currentStep || '').toLowerCase().includes(q);
    });

    const groups = {
      today: [],
      yesterday: [],
      previous: []
    };

    const now = new Date();
    
    filtered.forEach(d => {
      if (!d.updated_at) return;
      const dDate = new Date(d.updated_at);
      const diffTime = Math.abs(now - dDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) - 1;

      if (diffDays === 0) {
        groups.today.push(d);
      } else if (diffDays === 1) {
        groups.yesterday.push(d);
      } else {
        groups.previous.push(d);
      }
    });

    return groups;
  };

  // Export Chat log to Markdown file
  const handleExportChat = () => {
    if (!Array.isArray(messages) || messages.length === 0) {
      alert("No chat messages to export yet.");
      return;
    }
    
    let textContent = `# Chat Log: Course Architect Assistant\n`;
    textContent += `Generated: ${new Date().toLocaleString()}\n`;
    textContent += `Course Title: ${courseData?.details?.courseName || 'Untitled'}\n`;
    textContent += `=========================================\n\n`;

    messages.forEach((msg) => {
      const roleName = msg.role === 'user' ? 'USER' : 'AI ARCHITECT';
      textContent += `### [${roleName}] (${msg.timestamp || ''})\n`;
      textContent += `${msg.content}\n\n`;
      if (msg.metadataType) {
        textContent += `*Metadata attachment type: ${msg.metadataType}*\n\n`;
      }
      textContent += `-----------------------------------------\n\n`;
    });

    const blob = new Blob([textContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `chat_export_${courseData?.details?.courseName || 'draft'}.md`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy share URL to clipboard
  const handleShareWorkspace = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?draftId=${activeDraftId}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        alert(`Workspace link copied to clipboard!\nShare this URL: ${shareUrl}`);
      })
      .catch(err => {
        console.error("Clipboard write failed", err);
        alert("Failed to copy link to clipboard.");
      });
  };

  // Lesson generation content block writer
  const handleGenerateLessonContent = async (mIdx, cIdx, chapterTitle, moduleTitle) => {
    const chapter = courseData.structure?.modules?.[mIdx]?.chapters?.[cIdx];
    if (!chapter) return;

    const chapterObj = courseData.content?.find(c => c.module_title === moduleTitle && c.chapter_title === chapterTitle);
    const chapterPrompt = chapterObj?.prompt || `Generate a detailed structured lesson on ${chapterTitle}`;

    setGeneratingChapter({ mIdx, cIdx });
    try {
      const res = await generateLessonContent({
        title: chapterTitle,
        module_title: moduleTitle,
        prompt: chapterPrompt,
        type: 'html',
        course_details: courseData.details
      });

      if (res && res.blocks) {
        setCourseData(prev => {
          const latestModules = JSON.parse(JSON.stringify(prev.structure?.modules || []));
          const targetChapter = latestModules[mIdx]?.chapters?.[cIdx];
          if (targetChapter) {
            targetChapter.contents = [{
              type: 'lesson-blocks',
              title: res.title || chapterTitle,
              blocks: res.blocks,
              source: 'ai',
              completed: true,
              timestamp: new Date().toISOString()
            }];
            targetChapter.content = {
              content_type: 'lesson-blocks',
              html_content: '',
              completed: true
            };
          }
          return {
            ...prev,
            structure: { ...prev.structure, modules: latestModules }
          };
        });
      }
    } catch (err) {
      console.error("Failed to generate content blocks", err);
      alert("Failed to generate content for this chapter.");
    } finally {
      setGeneratingChapter(null);
    }
  };

  // Inline lesson outline chapters list
  const renderInlineContent = (modules) => {
    if (!modules || !Array.isArray(modules) || modules.length === 0) return null;
    return (
      <div className="mt-4 bg-slate-900/95 border border-slate-700/80 rounded-2xl p-5 space-y-4 text-left shadow-xl animate-fade-in">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h4 className="font-bold text-xs text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5" /> Chapters Lesson Creator
          </h4>
        </div>
        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
          {modules.map((module, mIdx) => {
            if (!module) return null;
            return (
              <div key={mIdx} className="space-y-2">
                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Module {mIdx + 1}: {module.title}
                </h5>
                <div className="space-y-2">
                  {module.chapters?.map((chapter, cIdx) => {
                    if (!chapter) return null;
                    const hasContent = Array.isArray(chapter.contents) && chapter.contents.length > 0;
                    const isGenerating = generatingChapter?.mIdx === mIdx && generatingChapter?.cIdx === cIdx;

                    return (
                      <div key={cIdx} className="bg-slate-950/80 border border-slate-900 rounded-xl p-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-200 truncate">{chapter.title}</p>
                          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-1.5 border ${
                            hasContent 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          }`}>
                            {hasContent ? 'Content Ready' : 'Pending Content'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleGenerateLessonContent(mIdx, cIdx, chapter.title, module.title)}
                            disabled={isGenerating || hasContent}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition active:scale-95 ${
                              hasContent 
                                ? 'bg-slate-900 text-slate-500 cursor-not-allowed border border-slate-850'
                                : isGenerating
                                  ? 'bg-indigo-950 text-indigo-400 border border-indigo-900/30'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                            }`}
                          >
                            {isGenerating ? (
                              <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Writing...</span>
                            ) : (
                              'Write Lesson'
                            )}
                          </button>
                          {hasContent && (
                            <button
                              onClick={() => {
                                const blockObj = chapter.contents[0];
                                setActiveLessonModal({
                                  moduleTitle: module.title,
                                  chapterTitle: chapter.title,
                                  blocks: blockObj.blocks || []
                                });
                              }}
                              className="bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition active:scale-95 animate-pulse"
                            >
                              View Lesson
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-slate-850 pt-3">
          <button
            onClick={() => {
              setCurrentStep('QUIZ_GEN');
              handleSendMessage("Lessons are ready. Let's build the course quizzes!", 'QUIZ_GEN');
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1 shadow-md"
          >
            Syllabus Lessons Complete <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // Formatted HTML tag and CSS styling blocks renderer
  const renderLessonBlocks = (blocks) => {
    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
      return <p className="text-slate-400 text-xs italic">No content blocks found.</p>;
    }

    return (
      <div className="space-y-4">
        {blocks.map((block, idx) => {
          if (!block) return null;
          
          switch (block.type) {
            case 'heading':
              return (
                <h3 key={idx} className={`font-black tracking-tight text-slate-150 mt-6 ${
                  block.level === 1 ? 'text-sm border-b border-slate-850 pb-1 text-indigo-400 uppercase tracking-wide' :
                  block.level === 2 ? 'text-xs text-slate-200' : 'text-[11px] text-slate-350'
                }`}>
                  {block.text}
                </h3>
              );
            case 'paragraph':
              return (
                <p key={idx} className="text-slate-300 text-xs leading-relaxed text-justify mt-2">
                  {block.text}
                </p>
              );
            case 'bullet_list':
              return (
                <ul key={idx} className="list-disc list-inside text-xs text-slate-350 space-y-1 mt-2 pl-3">
                  {block.items?.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              );
            case 'numbered_list':
              return (
                <ol key={idx} className="list-decimal list-inside text-xs text-slate-350 space-y-1 mt-2 pl-3">
                  {block.items?.map((item, i) => <li key={i}>{item}</li>)}
                </ol>
              );
            case 'image':
              return (
                <div key={idx} className="my-4 space-y-1.5 text-center">
                  <div className="bg-slate-950 border border-slate-850 rounded-xl p-5 text-slate-400 text-[10px]">
                    [AI Illustration Representation: {block.caption}]
                  </div>
                  {block.caption && <p className="text-[9px] text-slate-500 italic">{block.caption}</p>}
                </div>
              );
            case 'video':
              return (
                <div key={idx} className="my-4 space-y-1.5 text-center">
                  <div className="bg-slate-950 border border-slate-850 rounded-xl p-5 text-slate-400 text-[10px]">
                    [AI Video Representation: {block.caption}]
                  </div>
                  {block.caption && <p className="text-[9px] text-slate-500 italic">{block.caption}</p>}
                </div>
              );
            case 'table':
              return (
                <div key={idx} className="overflow-x-auto my-4 rounded-xl border border-slate-850 shadow-inner">
                  <table className="min-w-full text-xs text-slate-300">
                    <thead className="bg-slate-950 text-indigo-400 font-bold uppercase tracking-wider text-[9px] border-b border-slate-800">
                      <tr>
                        {block.headers?.map((h, i) => <th key={i} className="px-3 py-2 text-left">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 bg-slate-950/20">
                      {block.rows?.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-900/30">
                          {row.map((cell, cIdx) => <td key={cIdx} className="px-3 py-2 text-slate-305">{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            case 'callout':
              return (
                <div key={idx} className={`p-4 rounded-xl border my-4 text-xs leading-relaxed ${
                  block.callout_type === 'info' ? 'bg-blue-550/10 border-blue-500/25 text-blue-300' :
                  block.callout_type === 'warning' ? 'bg-amber-550/10 border-amber-500/25 text-amber-300' :
                  block.callout_type === 'danger' ? 'bg-red-550/10 border-red-500/25 text-red-300' :
                  'bg-emerald-550/10 border-emerald-500/25 text-emerald-300'
                }`}>
                  {block.text}
                </div>
              );
            case 'code':
              return (
                <div key={idx} className="bg-slate-950 rounded-xl border border-slate-850 p-3.5 my-4 font-mono text-[10px] text-slate-300 relative shadow-md">
                  <button 
                    onClick={() => handleCopyText(block.code)}
                    className="absolute top-3 right-3 text-slate-500 hover:text-indigo-400 transition"
                    title="Copy Code"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <div className="text-[9px] text-indigo-400 uppercase tracking-widest font-black border-b border-slate-900 pb-1.5 mb-2.5">
                    {block.language || 'Code Snippet'}
                  </div>
                  <pre className="overflow-x-auto whitespace-pre-wrap">{block.code}</pre>
                  {block.explanation && (
                    <p className="text-[9px] text-slate-400 border-t border-slate-900 pt-2 mt-2 leading-relaxed italic">
                      {block.explanation}
                    </p>
                  )}
                </div>
              );
            case 'example':
              return (
                <div key={idx} className="bg-slate-950 border border-slate-850 rounded-xl p-4 my-4 space-y-2 text-xs">
                  <span className="text-[9px] bg-sky-500/20 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded font-black uppercase tracking-wider">Example</span>
                  <p className="font-bold text-slate-200">{block.scenario}</p>
                  <p className="text-slate-350 leading-relaxed text-[10px]">{block.detail}</p>
                </div>
              );
            case 'quiz':
            case 'knowledge_check':
              return (
                <div key={idx} className="bg-indigo-950/20 border border-indigo-900/30 rounded-xl p-4 my-4 space-y-2 text-xs">
                  <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                    {block.type === 'quiz' ? 'Interactive Quiz' : 'Knowledge Check'}
                  </span>
                  <p className="font-bold text-slate-200">{block.question}</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {block.options?.map((opt, i) => (
                      <div 
                        key={i} 
                        className={`p-2 rounded border text-[10px] ${
                          opt === (block.correctAnswer || block.answer) 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold' 
                            : 'bg-slate-900/40 border-slate-850 text-slate-500'
                        }`}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                  {block.explanation && (
                    <p className="text-[9px] text-slate-450 border-t border-slate-900/50 pt-2.5 mt-2.5 leading-relaxed italic">
                      {block.explanation}
                    </p>
                  )}
                </div>
              );
            case 'summary':
              return (
                <div key={idx} className="bg-slate-950 border border-slate-850 rounded-xl p-4 my-4 space-y-2 text-xs">
                  <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded font-black uppercase tracking-wider">Key Takeaways</span>
                  <ul className="list-disc list-inside space-y-1 text-slate-350 mt-1">
                    {block.points?.map((pt, i) => <li key={i}>{pt}</li>)}
                  </ul>
                </div>
              );
            case 'reference':
              return (
                <div key={idx} className="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-850 px-3 py-1 rounded-full text-[9px] text-slate-300 hover:text-indigo-400 hover:border-indigo-500/30 transition mr-2 mb-2">
                  <Compass className="w-3.5 h-3.5 text-indigo-450" />
                  <a href={block.url} target="_blank" rel="noreferrer" className="underline">{block.title}</a>
                </div>
              );
            default:
              return null;
          }
        })}
      </div>
    );
  };

  // 1. Safe Details card renderer
  const renderInlineDetails = (details, idx) => {
    if (!details) return null;
    
    const latestDetailsCardIndex = messages
      .map((m, i) => m.metadataType === 'details' ? i : -1)
      .filter(idx => idx !== -1)
      .pop();
    const isLatest = idx === latestDetailsCardIndex;

    const data = isLatest ? (activeCardDetails || details) : details;
    if (!data || !data.courseName) return null;

    const CODE_OPTIONS = [
      "NA", "Python", "SQL", "C++", "C", "MySQL", "PostgreSQL", "Java", "JavaScript"
    ];

    const LANGUAGE_OPTIONS = ["English", "Spanish", "French", "German", "Hindi"];

    // local function to update details
    const updateDetailsField = (field, value) => {
      setActiveCardDetails(prev => {
        const current = prev || { ...details, price: "0" };
        const updated = { ...current, [field]: value };
        if (field === 'subject') {
          setSubjectSearchText(value);
        }
        return updated;
      });
    };

    if (isLatest) {
      const displayedSubject = subjectSearchText || data.subject || '';
      
      const durationVal = parseInt(activeCardDetails?.duration ?? details.duration);
      const durationNum = isNaN(durationVal) ? 14 : durationVal;

      return (
        <div className="mt-4 bg-gradient-to-br from-indigo-50/95 via-white/95 to-sky-50/95 border border-indigo-200/80 rounded-2xl p-6 space-y-4 text-left shadow-xl animate-fade-in relative z-10 text-indigo-950">
          <div className="flex justify-between items-center border-b border-indigo-100 pb-2.5">
            <h4 className="font-extrabold text-xs text-indigo-800 flex items-center gap-1.5 uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5" /> Course Details Editor
            </h4>
            <span className="text-[8px] bg-indigo-100 text-indigo-700 border border-indigo-200/40 px-2 py-0.5 rounded uppercase font-black tracking-widest animate-pulse">
              Active Draft
            </span>
          </div>

          <div className="space-y-3.5">
            {/* Title */}
            <div>
              <label className="text-[8px] uppercase tracking-widest text-indigo-500 font-extrabold block mb-1">Course Title</label>
              <input
                type="text"
                value={activeCardDetails?.courseName ?? details.courseName ?? ''}
                onChange={(e) => updateDetailsField('courseName', e.target.value)}
                className="w-full bg-white/90 border border-indigo-200/50 rounded-xl px-3 py-2 text-xs text-indigo-950 placeholder-indigo-300 focus:border-indigo-550 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition shadow-sm"
                placeholder="e.g. Intro to Python Programming"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-[8px] uppercase tracking-widest text-indigo-500 font-extrabold block mb-1">Description</label>
              <textarea
                value={activeCardDetails?.description ?? details.description ?? ''}
                onChange={(e) => updateDetailsField('description', e.target.value)}
                className="w-full bg-white/90 border border-indigo-200/50 rounded-xl px-3 py-2 text-xs text-indigo-950 placeholder-indigo-300 focus:border-indigo-550 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition h-20 resize-none shadow-sm"
                placeholder="What will students learn in this course?"
              />
            </div>

            {/* Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Searchable Subject Combobox */}
              <div className="relative text-left">
                <label className="text-[8px] uppercase tracking-widest text-indigo-500 font-extrabold block mb-1">Subject</label>
                <input
                  type="text"
                  value={displayedSubject}
                  onFocus={() => setSubjectDropdownOpen(true)}
                  onBlur={() => {
                    setTimeout(() => setSubjectDropdownOpen(false), 250);
                  }}
                  onChange={(e) => {
                    setSubjectSearchText(e.target.value);
                    setSubjectDropdownOpen(true);
                    updateDetailsField('subject', e.target.value);
                  }}
                  className="w-full bg-white/90 border border-indigo-200/50 rounded-xl px-3 py-2 text-xs text-indigo-950 placeholder-indigo-300 focus:border-indigo-550 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition shadow-sm"
                  placeholder="Search subject..."
                />
                
                {/* Dropdown Suggestions List */}
                {subjectDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-indigo-100 rounded-xl max-h-40 overflow-y-auto shadow-2xl z-50 text-left divide-y divide-indigo-50 scrollbar-thin scrollbar-thumb-indigo-200">
                    {dbSubjects
                      .filter(s => 
                        (s || '').toLowerCase().includes(displayedSubject.toLowerCase())
                      )
                      .map((s, sIdx) => (
                        <div
                          key={sIdx}
                          onMouseDown={() => {
                            setSubjectSearchText(s);
                            updateDetailsField('subject', s);
                            setSubjectDropdownOpen(false);
                          }}
                          className="px-3 py-2 hover:bg-indigo-50 hover:text-indigo-900 cursor-pointer text-xs transition text-indigo-950"
                        >
                          {s}
                        </div>
                      ))}
                    {dbSubjects.filter(s => 
                      (s || '').toLowerCase().includes(displayedSubject.toLowerCase())
                    ).length === 0 && (
                      <div className="px-3 py-2 text-indigo-400 text-xs italic">
                        No matching subjects
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[8px] uppercase tracking-widest text-indigo-500 font-extrabold block mb-1">Code Support</label>
                <select
                  value={activeCardDetails?.scriptingLanguage ?? details.scriptingLanguage ?? 'NA'}
                  onChange={(e) => updateDetailsField('scriptingLanguage', e.target.value)}
                  className="w-full bg-white/90 border border-indigo-200/50 rounded-xl px-2.5 py-2 text-xs text-indigo-950 focus:border-indigo-550 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition shadow-sm cursor-pointer"
                >
                  {CODE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[8px] uppercase tracking-widest text-indigo-500 font-extrabold block mb-1">Language</label>
                <select
                  value={activeCardDetails?.language ?? details.language ?? 'English'}
                  onChange={(e) => updateDetailsField('language', e.target.value)}
                  className="w-full bg-white/90 border border-indigo-200/50 rounded-xl px-2.5 py-2 text-xs text-indigo-950 focus:border-indigo-550 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition shadow-sm cursor-pointer"
                >
                  {LANGUAGE_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            {/* Level Select Pills */}
            <div>
              <label className="text-[8px] uppercase tracking-widest text-indigo-500 font-extrabold block mb-1.5">Difficulty Level</label>
              <div className="flex gap-2">
                {['beginner', 'intermediate', 'advanced'].map(lvl => (
                  <button
                     key={lvl}
                     type="button"
                     onClick={() => updateDetailsField('level', lvl)}
                     className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition ${
                       (activeCardDetails?.level ?? details.level) === lvl 
                         ? 'bg-indigo-600 text-white shadow-md' 
                         : 'bg-white/90 text-indigo-700 border border-indigo-150/60 hover:bg-indigo-50 hover:text-indigo-900 transition'
                     }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[8px] uppercase tracking-widest text-indigo-500 font-extrabold block">Duration</label>
                <span className="text-[10px] text-indigo-600 font-black">{durationNum} Days</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="7"
                  max="60"
                  value={durationNum}
                  onChange={(e) => updateDetailsField('duration', e.target.value)}
                  className="flex-1 accent-indigo-600 bg-indigo-100 rounded-lg appearance-none h-1 cursor-pointer"
                />
              </div>
            </div>

            {/* Prerequisites/Requirements */}
            <div>
              <label className="text-[8px] uppercase tracking-widest text-indigo-500 font-extrabold block mb-1">Requirements</label>
              <input
                type="text"
                value={activeCardDetails?.requirements ?? details.requirements ?? ''}
                onChange={(e) => updateDetailsField('requirements', e.target.value)}
                className="w-full bg-white/90 border border-indigo-200/50 rounded-xl px-3 py-2 text-xs text-indigo-950 placeholder-indigo-300 focus:border-indigo-550 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition shadow-sm"
                placeholder="e.g. Basic internet knowledge, laptop"
              />
            </div>
          </div>

          {/* Submit CTA */}
          <div className="border-t border-indigo-100 pt-4 mt-2 flex gap-3">
            <button
              onClick={() => {
                handleSendMessage("Please regenerate the course details suggestion card with a fresh name and description.");
              }}
              className="flex-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 hover:border-indigo-300 font-bold py-2.5 rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Regenerate
            </button>

            <button
              onClick={() => {
                const finalDetails = {
                  ...details,
                  ...activeCardDetails,
                  price: "0"
                };
                const updatedCourseData = {
                  ...courseData,
                  details: finalDetails
                };
                setCourseData(updatedCourseData);
                setCurrentStep('OUTLINE_EDIT');
                handleSendMessage(
                  `I confirm these details: "${finalDetails.courseName}". Please generate the syllabus outline next.`,
                  'OUTLINE_EDIT',
                  updatedCourseData
                );
              }}
              className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-900/10"
            >
              <Check className="w-3.5 h-3.5" /> Confirm & Propose Syllabus
            </button>
          </div>
        </div>
      );
    }

    // Read-only static layout (for historical cards in the timeline, price-free)
    return (
      <div className="mt-4 bg-gradient-to-br from-indigo-50/60 to-sky-50/60 border border-indigo-100/50 rounded-2xl p-5 space-y-4 text-left shadow-sm text-indigo-950">
        <div className="flex justify-between items-center border-b border-indigo-100/50 pb-2">
          <h4 className="font-bold text-xs text-indigo-800 flex items-center gap-1.5 uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5" /> Details Proposal
          </h4>
          <span className="text-[9px] bg-indigo-100/50 text-indigo-700 border border-indigo-200/30 px-2 py-0.5 rounded uppercase font-extrabold tracking-wider">
            {data.level || 'beginner'}
          </span>
        </div>
        <div className="space-y-2.5">
          <div>
            <span className="text-[8px] uppercase tracking-widest text-indigo-500 font-extrabold block">Course Title</span>
            <p className="text-indigo-950 font-black text-xs">{data.courseName}</p>
          </div>
          <div>
            <span className="text-[8px] uppercase tracking-widest text-indigo-500 font-extrabold block">Description</span>
            <p className="text-indigo-900 text-xs leading-relaxed">{data.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-indigo-100/40 pt-3">
            <div>
              <span className="text-[8px] uppercase tracking-widest text-indigo-500/80 font-bold block">Subject</span>
              <span className="text-indigo-950 font-semibold">{data.subject || 'General'}</span>
            </div>
            <div>
              <span className="text-[8px] uppercase tracking-widest text-indigo-500/80 font-bold block">Code Support</span>
              <span className="text-indigo-950 font-semibold">{data.scriptingLanguage || 'NA'}</span>
            </div>
            <div>
              <span className="text-[8px] uppercase tracking-widest text-indigo-500/80 font-bold block">Duration</span>
              <span className="text-indigo-950 font-semibold">{data.duration || 14} Days</span>
            </div>
            <div>
              <span className="text-[8px] uppercase tracking-widest text-indigo-500/80 font-bold block">Language</span>
              <span className="text-indigo-950 font-semibold">{data.language || 'English'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 2. Safe Syllabus tree renderer
  const renderInlineStructure = (structure) => {
    if (!structure || !structure.modules || !Array.isArray(structure.modules) || structure.modules.length === 0) return null;
    return (
      <div className="mt-4 bg-slate-900/95 border border-slate-700/80 rounded-2xl p-5 space-y-4 text-left shadow-xl animate-fade-in">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h4 className="font-bold text-xs text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5" /> Syllabus Proposal
          </h4>
          <span className="text-[9px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2.5 py-0.5 rounded font-black uppercase tracking-wider">
            {structure.modules.length} Modules
          </span>
        </div>
        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
          {structure.modules.map((m, mIdx) => {
            if (!m) return null;
            return (
              <div key={mIdx} className="bg-slate-950/80 border border-slate-900 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-slate-200 font-bold text-xs">
                  <span className="bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Mod {mIdx+1}</span>
                  <span>{m.title}</span>
                </div>
                <div className="pl-3.5 space-y-1 border-l border-slate-800 text-[11px] text-slate-400">
                  {Array.isArray(m.chapters) && m.chapters.map((c, cIdx) => {
                    if (!c) return null;
                    return (
                      <div key={cIdx} className="flex items-center gap-1.5 py-0.5">
                        <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                        <span>{c.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-slate-850 pt-3">
          <button
            onClick={() => {
              setCurrentStep('CONTENT_GEN');
              handleSendMessage("Outline is perfect. Start drafting chapter lesson prompts!", 'CONTENT_GEN');
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1 shadow-md"
          >
            Confirm Syllabus Outline <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // 3. Safe Quiz questions renderer
  const renderInlineQuiz = (quiz) => {
    if (!quiz) return null;
    const list = Array.isArray(quiz) ? quiz : quiz.questions || [];
    if (!Array.isArray(list) || list.length === 0) return null;
    
    return (
      <div className="mt-4 bg-slate-900/95 border border-slate-700/80 rounded-2xl p-5 space-y-4 text-left shadow-xl animate-fade-in">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h4 className="font-bold text-xs text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5" /> Assessment Exam
          </h4>
          <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-black uppercase tracking-wider">
            {list.length} Questions
          </span>
        </div>
        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
          {list.map((q, idx) => {
            if (!q) return null;
            return (
              <div key={idx} className="bg-slate-950/80 border border-slate-900 rounded-xl p-3 space-y-2 text-xs">
                <p className="font-bold text-slate-350">{idx+1}. {q.question}</p>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {Array.isArray(q.options) && q.options.map((opt, oIdx) => (
                    <div 
                      key={oIdx}
                      className={`p-1.5 rounded text-[10px] border ${
                        opt === q.answer 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold' 
                          : 'bg-slate-900/50 border-slate-850 text-slate-500'
                      }`}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-slate-850 pt-3">
          <button
            onClick={() => {
              setCurrentStep('READY');
              handleSendMessage("Quizzes look great! Let's finalize and publish this course.");
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1 shadow-md"
          >
            Confirm Quiz & Finalize <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-gradient-to-tr from-rose-100 via-violet-100 to-sky-100 text-slate-800 font-sans overflow-hidden">
      
      {/* 1. Collapsible Left Navigation Sidebar */}
      <div className={`h-full flex flex-col justify-between bg-white/70 backdrop-blur-md border-r border-white/50 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'} overflow-hidden`}>
        {sidebarOpen ? (
          /* Expandable Full View Sidebar */
          <div className="flex-1 flex flex-col min-h-0 py-6 px-4 space-y-6">
            {/* Sidebar Brand Header */}
            <div className="flex items-center justify-between text-left">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 flex items-center justify-center">
                  <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <span className="font-extrabold text-sm text-slate-800 tracking-tight font-black">IC Leaf</span>
              </div>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 hover:bg-slate-200/55 rounded-lg text-slate-500 transition"
                title="Collapse sidebar"
              >
                <PanelLeft className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* New Course Action Button */}
            <button
              onClick={handleResetWithoutConfirm}
              className="w-full relative group overflow-hidden bg-slate-900 hover:bg-slate-850 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow active:scale-95 transition-all duration-300 border border-slate-850"
            >
              {/* Subtle hover background glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-rose-500/10 via-violet-500/10 to-sky-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-rose-250 via-violet-300 to-sky-300 flex items-center justify-center text-slate-900 shadow-sm group-hover:rotate-90 transition-transform duration-500">
                <Plus className="w-2.5 h-2.5 stroke-[3.5] text-slate-800" />
              </div>
              <span className="relative z-10 font-bold tracking-wide">New Course</span>
            </button>

            {/* Search Input Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search drafts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/50 border border-slate-200/60 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500/30 transition shadow-inner"
              />
              {searchQuery && (
                <X className="w-3 h-3 text-slate-400 hover:text-slate-655 absolute right-3 top-3 cursor-pointer" onClick={() => setSearchQuery('')} />
              )}
            </div>

            {/* History Feed Categories */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-slate-200">
              {(() => {
                const groups = getGroupedDrafts();
                const renderGroup = (title, items) => {
                  if (items.length === 0) return null;
                  return (
                    <div className="space-y-1.5 text-left">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block px-1">{title}</span>
                      <div className="space-y-0.5">
                        {items.map(d => {
                          const isActive = d.id === activeDraftId;
                          const isEditing = d.id === editingDraftId;
                          return (
                            <div
                              key={d.id}
                              onClick={() => !isEditing && loadSpecificDraft(d.id)}
                              className={`group flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition ${
                                isActive 
                                  ? 'bg-indigo-600 text-white shadow font-semibold' 
                                  : 'text-slate-605 hover:bg-slate-105/80 hover:text-slate-900'
                              }`}
                            >
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editingTitleText}
                                  onChange={(e) => setEditingTitleText(e.target.value)}
                                  onBlur={() => handleRenameDraft(d.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleRenameDraft(d.id);
                                    } else if (e.key === 'Escape') {
                                      setEditingDraftId(null);
                                    }
                                  }}
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                  className="bg-white text-slate-800 px-2 py-0.5 rounded border border-indigo-400 text-xs w-full focus:outline-none"
                                />
                              ) : (
                                <span 
                                  className="truncate pr-2 select-none flex-1 text-left"
                                  title="Double click to rename"
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setEditingDraftId(d.id);
                                    setEditingTitleText(d.courseName || "Untitled Course");
                                  }}
                                >
                                  {d.courseName || 'Untitled Course'}
                                </span>
                              )}
                              {!isEditing && (
                                <button
                                  onClick={(e) => handleDeleteDraft(d.id, e)}
                                  className={`opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-655 transition ${isActive ? 'hover:bg-indigo-700 text-indigo-300 hover:text-white' : ''}`}
                                  title="Delete draft"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                };

                const totalItems = groups.today.length + groups.yesterday.length + groups.previous.length;
                if (totalItems === 0) {
                  return (
                    <p className="text-[10px] text-slate-400 italic text-center pt-8">No draft courses found.</p>
                  );
                }

                return (
                  <div className="space-y-4">
                    {renderGroup("Today", groups.today)}
                    {renderGroup("Yesterday", groups.yesterday)}
                    {renderGroup("Previous Days", groups.previous)}
                  </div>
                );
              })()}
            </div>

            {/* Bottom Profile Area */}
            <div className="border-t border-slate-200/50 pt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-400 to-indigo-500 flex items-center justify-center text-white font-extrabold text-[10px] shadow-sm">
                  IL
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-[11px] font-bold text-slate-800 truncate leading-none">IC Leaf admin</p>
                  <p className="text-[9px] text-slate-400 truncate mt-0.5">admin@icleaf.com</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 hover:bg-red-50 hover:text-red-650 rounded-lg text-slate-400 transition"
                title="Exit to Dashboard"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Collapsed Mini Sidebar View */
          <div className="flex-1 flex flex-col items-center py-6 justify-between">
            <div className="flex flex-col items-center gap-6">
              {/* Logo - no box, just raw logo */}
              <div 
                onClick={() => setSidebarOpen(true)}
                className="w-8 h-8 flex items-center justify-center cursor-pointer hover:scale-105 transition"
                title="Expand sidebar"
              >
                <img src={logo} alt="Logo" className="w-7 h-7 object-contain" />
              </div>
              
              {/* New Course Button */}
              <button 
                onClick={handleResetWithoutConfirm}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-transparent hover:bg-gradient-to-tr hover:from-rose-100 hover:via-violet-100 hover:to-sky-100 text-slate-500 hover:text-slate-800 hover:shadow-sm hover:border hover:border-white/50 transition active:scale-95"
                title="New Course"
              >
                <Plus className="w-4 h-4 stroke-[2]" />
              </button>

              {/* Message Square (Active Session) */}
              <button 
                onClick={() => setSidebarOpen(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-transparent hover:bg-gradient-to-tr hover:from-rose-100 hover:via-violet-100 hover:to-sky-100 text-slate-500 hover:text-slate-800 hover:shadow-sm hover:border hover:border-white/50 transition active:scale-95"
                title="Active Session"
              >
                <MessageSquare className="w-4 h-4 stroke-[2]" />
              </button>

              {/* Search Button */}
              <button 
                onClick={() => setSidebarOpen(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-transparent hover:bg-gradient-to-tr hover:from-rose-100 hover:via-violet-100 hover:to-sky-100 text-slate-500 hover:text-slate-850 hover:shadow-sm hover:border hover:border-white/50 transition active:scale-95"
                title="Search drafts"
              >
                <Search className="w-4 h-4 stroke-[2]" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-5">
              <div 
                className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-400 to-indigo-500 flex items-center justify-center text-white font-extrabold text-[10px] shadow-sm cursor-pointer hover:scale-105 transition"
                onClick={() => setSidebarOpen(true)}
                title="IC Leaf admin"
              >
                IL
              </div>
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-600 text-slate-450 transition active:scale-95"
                title="Exit to Dashboard"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Main Chat Panel */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Splash Landing Screen */}
        {!started ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-12 max-w-4xl mx-auto w-full">
            
            {/* Pulsating Glowing orb */}
            <div className="relative group cursor-pointer select-none">
              <div className="absolute inset-0 bg-gradient-to-tr from-rose-400 via-pink-400 to-sky-400 rounded-full blur-2xl opacity-40 group-hover:opacity-75 transition-all duration-700 animate-pulse" />
              
              <div className="relative w-52 h-52 rounded-full bg-gradient-to-tr from-white/30 to-white/10 border border-white/40 shadow-inner flex items-center justify-center overflow-hidden transition-all duration-500 group-hover:scale-105 group-active:scale-95">
                <div className="absolute inset-2 bg-gradient-to-br from-indigo-500/20 via-sky-400/20 to-pink-500/30 rounded-full blur-sm" />
                <div className="absolute top-4 left-6 w-16 h-8 bg-white/45 rounded-full rotate-[-15deg] filter blur-[2px]" />
                
                <img 
                  src={logo} 
                  alt="Sphere logo" 
                  className="w-24 h-24 object-contain opacity-85 group-hover:opacity-100 transition-all duration-500 animate-float" 
                />
              </div>
            </div>

            {/* Central Headings */}
            <div className="space-y-3">
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 leading-none">
                AI Powered <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent font-black">Course Creator</span>
              </h1>
              <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                Build professional curriculums and structured lessons dynamically with real-time AI conversation guidance.
              </p>
            </div>

            {/* Suggestion Chips */}
            <div className="space-y-2.5">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Quick Suggestions</span>
              <div className="flex flex-wrap gap-2 justify-center max-w-xl">
                {SUGGESTED_CHIPS.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(chip)}
                    className="bg-white/70 hover:bg-white text-indigo-700 hover:text-indigo-900 border border-white/60 hover:border-indigo-400/30 px-4 py-2 rounded-full text-xs font-semibold shadow-sm transition active:scale-95"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Welcome bottom Input container */}
            <div className="w-full max-w-2xl bg-white/80 backdrop-blur-md rounded-2xl border border-white/60 p-3 shadow-lg flex flex-col gap-2">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask me anything about creating your course..."
                className="w-full bg-transparent resize-none focus:outline-none text-sm text-slate-800 placeholder-slate-400 px-2 py-1 h-14"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(inputMessage);
                  }
                }}
              />
              <div className="flex justify-between items-center border-t border-slate-100 pt-2 px-2">
                <div className="flex gap-2 items-center">
                  <button 
                    onClick={() => setDeepThinkActive(prev => !prev)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${deepThinkActive ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>Deep Think</span>
                  </button>
                </div>
                <button
                  onClick={() => handleSendMessage(inputMessage)}
                  disabled={!inputMessage.trim()}
                  className="bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 transition shadow active:scale-95 disabled:opacity-50"
                >
                  <span>Send</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Native file upload input hook */}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
            />

          </div>
        ) : (
          
          /* Full Screen Scrollable Chat Workspace */
          <div className="flex-1 flex flex-col h-full bg-white/30 backdrop-blur-sm relative">
            
            {/* Header Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 bg-white/70 border-b border-slate-200/50 backdrop-blur-md">
              <div className="flex items-center gap-3 text-left">
                {!sidebarOpen && (
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-1.5 hover:bg-slate-200/55 rounded-lg text-slate-500 transition mr-1"
                    title="Expand sidebar"
                  >
                    <PanelLeft className="w-4.5 h-4.5" />
                  </button>
                )}
                
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200/60 p-1.5 shadow-sm flex items-center justify-center">
                  <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">AI Chat Course Creator</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Syllabus Draft Step: <span className="text-indigo-600 font-black">{currentStep}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleShareWorkspace}
                  className="bg-white/80 hover:bg-slate-100 text-slate-700 border border-slate-200 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 shadow-sm flex items-center gap-1"
                  title="Share workspace link"
                >
                  <Compass className="w-3.5 h-3.5" /> Share
                </button>

                <button
                  onClick={handleExportChat}
                  className="bg-white/80 hover:bg-slate-100 text-slate-700 border border-slate-200 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 shadow-sm flex items-center gap-1 mr-1"
                  title="Export chat history"
                >
                  <FileText className="w-3.5 h-3.5" /> Export Chat
                </button>

                {courseData?.details?.courseName && (
                  <button
                    onClick={handlePublish}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black px-4 py-1.5 rounded-xl text-xs transition active:scale-95 shadow-md flex items-center gap-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Publish Course
                  </button>
                )}
                
                <button 
                  onClick={handleReset}
                  className="bg-white/80 hover:bg-red-50 text-slate-655 hover:text-red-650 border border-slate-250/60 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 shadow-sm"
                >
                  Discard
                </button>
              </div>
            </div>

            {/* Chat Messages Feed Container (Centered with max-width) */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200">
              <div className="max-w-4xl mx-auto w-full space-y-6">
                
                {messages.length === 0 && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-200/60 rounded-2xl rounded-bl-none p-4 shadow-sm text-slate-800 leading-relaxed text-sm max-w-[80%]">
                      Hello! I am your AI Course Architect. I am ready to build your custom course. What topic should we start with?
                    </div>
                  </div>
                )}

                {Array.isArray(messages) && messages.map((msg, idx) => {
                  if (!msg) return null;
                  const isUser = msg.role === 'user';
                  return (
                    <div 
                      key={idx} 
                      className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
                    >
                      <div className="space-y-1 max-w-[80%]">
                        
                        {/* Bubble content */}
                        <div className={`p-4 shadow-sm leading-relaxed ${
                          isUser 
                            ? 'bg-indigo-600 text-white rounded-2xl rounded-br-none' 
                            : 'bg-white border border-slate-200/80 text-slate-800 rounded-2xl rounded-bl-none'
                        }`}>
                          <div className="text-sm whitespace-pre-line">{msg.content}</div>

                          {/* Render custom metadata cards inline inside the bubble */}
                          {!isUser && msg.metadataType === 'details' && renderInlineDetails(msg.metadata, idx)}
                          {!isUser && msg.metadataType === 'structure' && renderInlineStructure(msg.metadata)}
                          {!isUser && msg.metadataType === 'content' && renderInlineContent(courseData.structure?.modules)}
                          {!isUser && msg.metadataType === 'quiz' && renderInlineQuiz(msg.metadata)}
                          
                          <div className="text-[9px] text-right mt-1.5 opacity-60">
                            {msg.timestamp}
                          </div>
                        </div>

                        {/* Assistant Actions Bar */}
                        {!isUser && (
                          <div className="flex items-center justify-between px-1 text-slate-400 mt-2">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleFeedback(idx, 'like')} 
                                className={`transition ${
                                  messageFeedback[idx] === 'like' 
                                    ? 'text-emerald-600 scale-105' 
                                    : 'hover:text-slate-800'
                                }`} 
                                title="Like"
                              >
                                <ThumbsUp className={`w-3.5 h-3.5 ${messageFeedback[idx] === 'like' ? 'fill-current' : ''}`} />
                              </button>
                              
                              <button 
                                onClick={() => handleFeedback(idx, 'dislike')} 
                                className={`transition ${
                                  messageFeedback[idx] === 'dislike' 
                                    ? 'text-rose-600 scale-105' 
                                    : 'hover:text-slate-800'
                                }`} 
                                title="Dislike"
                              >
                                <ThumbsDown className={`w-3.5 h-3.5 ${messageFeedback[idx] === 'dislike' ? 'fill-current' : ''}`} />
                              </button>

                              <button 
                                onClick={() => handleCopyText(msg.content, idx)} 
                                className="hover:text-slate-800 transition" 
                                title="Copy"
                              >
                                {copiedIndex === idx ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600 animate-fade-in" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white/80 border border-slate-200/50 rounded-2xl rounded-bl-none p-4 shadow-sm flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      <span className="text-xs text-slate-500 font-medium animate-pulse">Architect is planning...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Inline suggested replies quick chips */}
            {quickReplies.length > 0 && (
              <div className="bg-transparent py-2">
                <div className="max-w-4xl mx-auto w-full px-6 flex flex-wrap gap-2 items-center">
                  <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black mr-1">Suggestions:</span>
                  {quickReplies.map((reply, index) => (
                    <button
                       key={index}
                       onClick={() => handleSendMessage(reply)}
                       className="bg-white/90 hover:bg-indigo-50 text-indigo-600 hover:text-indigo-800 border border-slate-200/80 hover:border-indigo-300 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-sm transition active:scale-95"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom active Chat Input Console */}
            <div className="p-4 bg-transparent border-t border-slate-200/20 backdrop-blur-sm">
              <div className="max-w-4xl mx-auto bg-white/85 backdrop-blur-md rounded-2xl border border-slate-200/60 p-2.5 shadow-md flex flex-col gap-2">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Tell the AI architect what to add or modify..."
                  className="w-full bg-transparent resize-none focus:outline-none text-sm text-slate-800 placeholder-slate-400 px-2 py-1 h-14"
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(inputMessage);
                    }
                  }}
                />
                <div className="flex justify-between items-center border-t border-slate-100/60 pt-2 px-2">
                  <div className="flex gap-2 items-center">
                    <button 
                      onClick={() => setDeepThinkActive(prev => !prev)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${deepThinkActive ? 'bg-indigo-50/80 text-indigo-600 border border-indigo-100' : 'text-slate-500 hover:bg-slate-150/40'}`}
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>Deep Think</span>
                    </button>
                  </div>
                  <button
                    onClick={() => handleSendMessage(inputMessage)}
                    disabled={!inputMessage.trim() || loading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 transition shadow active:scale-95 disabled:opacity-50"
                  >
                    <span>Send</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Hidden file input element */}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
            />

          </div>
        )}

      </div>

      {/* 3. Lesson Blocks Preview Modal Overlay */}
      {activeLessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl text-slate-100">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div>
                <h3 className="font-extrabold text-[10px] text-indigo-400 uppercase tracking-widest">{activeLessonModal.moduleTitle}</h3>
                <h2 className="text-sm font-bold text-slate-100 mt-0.5">{activeLessonModal.chapterTitle}</h2>
              </div>
              <button
                onClick={() => setActiveLessonModal(null)}
                className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-250 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
              {renderLessonBlocks(activeLessonModal.blocks)}
            </div>
            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 flex justify-end bg-slate-950/40">
              <button
                onClick={() => setActiveLessonModal(null)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-5 rounded-xl text-xs transition active:scale-95 shadow-md"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
