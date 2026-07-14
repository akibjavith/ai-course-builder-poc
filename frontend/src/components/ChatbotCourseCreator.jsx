import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Send, BookOpen, Layers, CheckCircle, 
  HelpCircle, Eye, Sparkles, ChevronRight, ChevronLeft, 
  Trash2, Loader2, Award, FileText, Check, Paperclip, 
  Mic, Lightbulb, Compass, ThumbsUp, ThumbsDown, Copy, 
  RotateCcw, X, Search, Bell, Info, Plus, PanelLeft, Edit
} from 'lucide-react';
import { chatWithChatbotBuilder, createCourse, uploadDoc, generateLessonContent, saveChatbotDraft, getChatbotDrafts, getChatbotDraft, deleteChatbotDraft, renameChatbotDraft, getSubjects, getCourseById, generateStructure } from '../api';
import logo from '../assets/logo.png';
import LessonPreviewEditorModal from './LessonPreviewEditorModal';

const SUGGESTED_CHIPS = [
  "Create a Python programming course",
  "Design a Basic English Grammar course",
  "Build a Data Science & AI curriculum",
  "Generate a digital marketing class"
];

const STEPS = [
  { id: 'ASK_TOPIC', label: 'Details', icon: FileText },
  { id: 'OUTLINE_EDIT', label: 'Outline', icon: Layers },
  { id: 'READY', label: 'Publish', icon: CheckCircle }
];

export default function ChatbotCourseCreator({ onClose }) {
  // States
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickReplies, setQuickReplies] = useState([]);
  const [currentStep, setCurrentStep] = useState('ASK_TOPIC');
  const [deepThinkActive, setDeepThinkActive] = useState(false);
  const [generatingChapter, setGeneratingChapter] = useState(null);
  const [activeLessonModal, setActiveLessonModal] = useState(null);
  
  // Batch Content Gen and Preview States
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('idle'); // 'idle' | 'generating' | 'completed' | 'cancelled'
  const cancelGenerationRef = useRef(false);
  const chatInputRef = useRef(null);

  const focusInput = () => {
    setTimeout(() => {
      if (chatInputRef.current) chatInputRef.current.focus();
    }, 50);
  };
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchCompleted, setBatchCompleted] = useState(0);
  const [batchCurrentTitle, setBatchCurrentTitle] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
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
      duration: '',
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
  const lastSavedDataRef = useRef(null);

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
      const currentState = JSON.stringify({
        messages,
        courseData,
        currentStep
      });

      if (lastSavedDataRef.current === currentState) {
        return; // Skip saving if data hasn't changed since last save/load
      }

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
          lastSavedDataRef.current = currentState; // Mark current state as saved
          getChatbotDrafts().then(res => {
            if (res && res.status === 'success') {
              setDraftsList(res.drafts || []);
            }
          });
        })
        .catch(err => console.error("MySQL draft autosave failed", err));
    }
  }, [messages, courseData, currentStep, activeDraftId]);

  // Scroll to bottom on new messages and focus input
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (!loading && !isBatchGenerating) {
      focusInput();
    }
  }, [messages, loading, isBatchGenerating]);

  // Batch sequential content generation loop
  const startBatchGeneration = async (currentCourseData) => {
    setLoading(true);
    const prepareMsg = {
      role: 'assistant',
      content: "Outline confirmed! Proposing prompt blueprints and generating all lesson contents sequentially. Please wait...",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isProgressCard: true
    };
    setMessages(prev => [...prev, prepareMsg]);

    try {
      const historyForApi = messages
        .concat({ role: 'user', content: "Confirm outline and generate detailed prompt blueprints for all chapters." })
        .filter(m => m && typeof m.content === 'string')
        .map(m => ({ role: m.role || 'user', content: m.content || '' }));

      const res = await chatWithChatbotBuilder(historyForApi, 'PROMPT_GEN', currentCourseData);
      let nextCourseData = { ...currentCourseData };

      if (res && res.status === 'success' && res.metadata) {
        if (res.metadata.prompts) {
          nextCourseData.content = (currentCourseData.content || []).map(c => {
            const match = res.metadata.prompts.find(p => p && p.title === c.chapter_title);
            return match ? { ...c, prompt: match.prompt } : c;
          });
        }
        setCourseData(nextCourseData);
      }

      const chaptersToGenerate = [];
      (nextCourseData.structure?.modules || []).forEach((mod, mIdx) => {
        (mod?.chapters || []).forEach((chap, cIdx) => {
          chaptersToGenerate.push({
            mIdx,
            cIdx,
            chapterTitle: chap.title,
            moduleTitle: mod.title
          });
        });
      });

      if (chaptersToGenerate.length === 0) {
        throw new Error("No chapters found in the course structure.");
      }

      cancelGenerationRef.current = false;
      setGenerationStatus('generating');
      setIsBatchGenerating(true);
      setBatchTotal(chaptersToGenerate.length);
      setBatchCompleted(0);
      setBatchCurrentTitle(chaptersToGenerate[0].chapterTitle);
      setLoading(false);

      let updatedCourse = { ...nextCourseData };

      for (let i = 0; i < chaptersToGenerate.length; i++) {
        if (cancelGenerationRef.current) {
          setGenerationStatus('cancelled');
          setIsBatchGenerating(false);
          setLoading(false);
          const cancelMsg = {
            role: 'assistant',
            content: "Course content generation has been cancelled. Let me know if you want to resume or make adjustments to the syllabus outline.",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          setMessages(prev => [...prev, cancelMsg]);
           setQuickReplies([]);
          return;
        }

        const { mIdx, cIdx, chapterTitle, moduleTitle } = chaptersToGenerate[i];
        setBatchCurrentTitle(chapterTitle);

        const chapterObj = updatedCourse.content?.find(c => c.module_title === moduleTitle && c.chapter_title === chapterTitle);
        const chapterPrompt = chapterObj?.prompt || `Generate a detailed structured lesson on ${chapterTitle}`;

        try {
          const resBlock = await generateLessonContent({
            title: chapterTitle,
            module_title: moduleTitle,
            prompt: chapterPrompt,
            type: 'html',
            course_details: updatedCourse.details
          });

          if (resBlock && resBlock.blocks) {
            const latestModules = JSON.parse(JSON.stringify(updatedCourse.structure?.modules || []));
            const targetChapter = latestModules[mIdx]?.chapters?.[cIdx];
            if (targetChapter) {
              targetChapter.contents = [{
                type: 'lesson-blocks',
                title: resBlock.title || chapterTitle,
                blocks: resBlock.blocks,
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
            updatedCourse = {
              ...updatedCourse,
              structure: { ...updatedCourse.structure, modules: latestModules }
            };
            setCourseData(updatedCourse);
          }
        } catch (err) {
          console.error(`Failed to generate chapter block content for "${chapterTitle}"`, err);
        }

        setBatchCompleted(i + 1);
      }

      setGenerationStatus('completed');
      setIsBatchGenerating(false);
      setCurrentStep('READY');
      
      // Request final congratulations and summary from AI builder
      const finalHistory = messages.concat(
        { role: 'user', content: "Content generation is complete. Congratulate me." }
      ).map(m => ({ role: m.role || 'user', content: m.content || '' }));
      
      setLoading(true);
      const resReady = await chatWithChatbotBuilder(finalHistory, 'READY', updatedCourse);
      setLoading(false);

      if (resReady && resReady.status === 'success') {
        const finalMsg = {
          role: 'assistant',
          content: resReady.reply || "Content generation is successfully complete! You can now preview and publish your course.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, finalMsg]);
        setQuickReplies([]);
      }

    } catch (err) {
      console.error("Batch content generation failed", err);
      alert("An error occurred during content generation.");
      setIsBatchGenerating(false);
      setLoading(false);
    }
  };

  const handleSendMessage = async (textToSend, overrideStep = null, overrideCourseData = null) => {
    if (!textToSend || !textToSend.trim()) return;
    if (loading || isBatchGenerating) return;

    const lowercaseText = textToSend.trim().toLowerCase();


    // Direct interceptions for preview, publish and reset
    if (lowercaseText === "preview course") {
      setIsPreviewOpen(true);
      return;
    }
    if (lowercaseText === "publish course") {
      handlePublish();
      return;
    }
    if (lowercaseText === "create a new course" || lowercaseText === "create new course") {
      handleResetWithoutConfirm();
      return;
    }

    // Lock step transitions locally
    let nextStepToUse = currentStep;
    let nextCourseData = { ...courseData };

    if (!overrideStep) {
      if (currentStep === 'ASK_GENERATE_SKELETON') {
        const lowercaseMsg = textToSend.toLowerCase();
        const wantsGoBack = lowercaseMsg.includes("back") || lowercaseMsg.includes("no") || lowercaseMsg.includes("change") || lowercaseMsg.includes("edit");
        if (wantsGoBack) {
          nextStepToUse = 'ASK_GENERATE_SKELETON';
        } else {
          const userMsg = {
            role: 'user',
            content: textToSend,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          setMessages(prev => [...prev, userMsg]);
          setInputMessage('');
        setLoading(true);
        setQuickReplies([]);
        try {
          const details = nextCourseData.details || {};
          const safeDetails = {
            courseType: details.courseType || 'Custom Course',
            subject: details.subject || details.courseName || 'General',
            courseName: details.courseName || details.subject || 'Custom Course',
            description: details.description || details.goal || 'Learn the subject',
            price: details.price || '0',
            duration: String(details.duration || '5'),
            requirements: details.requirements || '',
            level: details.level || 'beginner',
            language: details.language || 'English',
            scriptingLanguage: details.scriptingLanguage || 'NA',
            evaluator: details.evaluator || ''
          };
          const structureRes = await generateStructure('external', safeDetails);
          const rawModules = structureRes?.data?.modules || structureRes?.modules;
          if (rawModules && rawModules.length > 0) {
            const normalizedModules = rawModules.map(m => {
              if (!m) return null;
              const normalizedChapters = (m.chapters || []).map(c => {
                if (!c) return null;
                return { ...c, contents: c.contents || [], content: c.content || { content_type: 'html', html_content: '', completed: false } };
              }).filter(Boolean);
              return { ...m, chapters: normalizedChapters };
            }).filter(Boolean);
            const flatChapters = [];
            normalizedModules.forEach(m => m.chapters?.forEach(c => flatChapters.push({ module: m.title || '', title: c.title || '' })));
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: 'Here is your personalized learning roadmap outline. Do you have anything to change in this, or would you like to add any modules?',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              metadata: { next_step: 'OUTLINE_EDIT', modules: normalizedModules },
              metadataType: 'structure'
            }]);
            setCurrentStep('OUTLINE_EDIT');
            setCourseData(prev => ({
              ...prev,
              structure: { modules: normalizedModules },
              content: flatChapters.map(fc => ({ module_title: fc.module, chapter_title: fc.title, contents: [] }))
            }));
          }
        } catch (e) { console.error('Structure fallback error:', e); }
        finally { setLoading(false); }
        return;
      }

      } else if (currentStep === 'OUTLINE_EDIT') {
        // In OUTLINE_EDIT, the user edits/refines. Confirming the outline card moves to CONFIRM_GENERATE.
        nextStepToUse = 'OUTLINE_EDIT';
      } else if (currentStep === 'CONFIRM_GENERATE') {
        const generateKeywords = ["generate course", "generate content", "generate", "yes", "continue", "start", "proceed", "let's go", "go ahead", "sure", "ok", "yep", "yeah"];
        const wantsGenerate = generateKeywords.some(kw => lowercaseText.includes(kw));
        if (wantsGenerate) {
          const userMsg = {
            role: 'user',
            content: textToSend,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          setMessages(prev => [...prev, userMsg]);
          setInputMessage('');
          startBatchGeneration(courseData);
          return;
        } else {
          nextStepToUse = 'CONFIRM_GENERATE';
        }
      }
    } else {
      nextStepToUse = overrideStep;
      if (overrideCourseData) {
        nextCourseData = overrideCourseData;
      }
    }

    let finalMessageText = textToSend;

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

      setCourseData(nextCourseData);
      const res = await chatWithChatbotBuilder(historyForApi, nextStepToUse, nextCourseData);

      if (res && res.status === 'success') {
        const assistantMsg = {
          role: 'assistant',
          content: res.reply || '',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          metadata: res.metadata || null,
          metadataType: res.type || null
        };

        setMessages(prev => [...prev, assistantMsg]);
        console.log('[ChatbotBuilder] API Response → type:', res.type, '| metadataType:', assistantMsg.metadataType, '| metadata:', res.metadata, '| reply:', res.reply);

        // Dynamically override or supplement quick replies based on the NEXT step
        let replies = res.quickReplies || [];
        const activeStep = (res.metadata && res.metadata.next_step) || nextStepToUse;
        setQuickReplies(replies);

        // Update currentStep state if returned in metadata, otherwise use robust keyword fallbacks
        if (res.metadata && res.metadata.next_step) {
          setCurrentStep(res.metadata.next_step);
        } else {
          const lowerReply = (res.reply || "").toLowerCase();
          if (currentStep === 'ASK_TOPIC') {
            if (lowerReply.includes('learning goal') || lowerReply.includes('what is your goal') || lowerReply.includes('hope to achieve')) {
              setCurrentStep('ASK_GOAL');
            }
          } else if (currentStep === 'ASK_GOAL') {
            if (lowerReply.includes('familiar') || lowerReply.includes('level') || lowerReply.includes('experience')) {
              setCurrentStep('ASK_LEVEL');
            }
          } else if (currentStep === 'ASK_LEVEL') {
            if (lowerReply.includes('learning style') || lowerReply.includes('structured') || lowerReply.includes('hands-on') || lowerReply.includes('combination') || lowerReply.includes('prefer')) {
              setCurrentStep('ASK_STYLE');
            }
          } else if (currentStep === 'ASK_STYLE') {
            if (lowerReply.includes('hour') || lowerReply.includes('duration') || lowerReply.includes('dedicate') || lowerReply.includes('time')) {
              setCurrentStep('ASK_DURATION');
            }
          } else if (currentStep === 'ASK_DURATION') {
            if (lowerReply.includes('summary') || lowerReply.includes('requirements') || lowerReply.includes('modify') || lowerReply.includes('difficulty') || lowerReply.includes('would you like to modify')) {
              setCurrentStep('CONFIRM_DETAILS');
            }
          }
        }

        // Safe merging of metadata suggestions into courseData
        if (res.metadata) {
          setCourseData(prev => {
            const updated = { ...prev };
            if (res.type === 'details' || res.type === 'details_card') {
              const tVal = res.metadata.topic !== undefined ? res.metadata.topic : (res.metadata.subject || res.metadata.courseName || prev.details?.topic);
              const gVal = res.metadata.learningGoal !== undefined ? res.metadata.learningGoal : (res.metadata.description || res.metadata.goal || res.metadata.objective || prev.details?.learningGoal);
              const lVal = res.metadata.currentLevel !== undefined ? res.metadata.currentLevel : (res.metadata.level || res.metadata.experience || prev.details?.currentLevel);
              const sVal = res.metadata.learningStyle !== undefined ? res.metadata.learningStyle : (res.metadata.requirements || res.metadata.style || prev.details?.learningStyle);
              const dVal = res.metadata.duration !== undefined ? (res.metadata.duration !== null ? String(res.metadata.duration) : null) : (res.metadata.courseDuration || res.metadata.hours || prev.details?.duration || "");

              const normalizedMetadata = {
                ...res.metadata,
                topic: tVal,
                learningGoal: gVal,
                currentLevel: lVal,
                learningStyle: sVal,
                duration: dVal,
                
                subject: tVal,
                courseName: tVal,
                description: gVal,
                goal: gVal,
                objective: gVal,
                level: lVal,
                experience: lVal,
                requirements: sVal,
                style: sVal,
                courseDuration: dVal,
                hours: dVal,
              };

              updated.details = { ...(prev.details || {}), ...normalizedMetadata, price: "0" };
              setActiveCardDetails({ ...normalizedMetadata, price: "0" });
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
        const updatedCourse = {
          ...courseData,
          sourceType: 'internal'
        };
        setCourseData(updatedCourse);
        setCurrentStep('CONFIRM_DETAILS');
        handleSendMessage(`Uploaded reference document "${file.name}". Please summarize all requirements.`, 'CONFIRM_DETAILS', updatedCourse);
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
        
        // Save the MySQL course ID to states to block republishing
        setCourseData(prev => ({
          ...prev,
          mysql_id: result.mysql_course_id
        }));

        const publishSuccessMsg = {
          role: 'assistant',
          content: `🎉 Congratulations! Your course **"${courseData.details?.courseName || 'Untitled Course'}"** has been successfully published to your academy database!\n\nIf you want to start a brand new course, click the **"New Course"** button in the sidebar.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, publishSuccessMsg]);
        setQuickReplies([]);
      }
    } catch (err) {
      console.error("Publishing error", err);
      alert("Error publishing course.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelGeneration = () => {
    cancelGenerationRef.current = true;
    setGenerationStatus('cancelled');
    setIsBatchGenerating(false);
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
        
        // Verify if the published course still exists in MySQL if it has a mysql_id
        if (d.courseData?.mysql_id) {
          try {
            const verifyRes = await getCourseById(d.courseData.mysql_id);
            if (!verifyRes || !verifyRes.course) {
              d.courseData.mysql_id = null;
            }
          } catch (verifyErr) {
            d.courseData.mysql_id = null;
          }
        }

        setActiveDraftId(d.id);
        setMessages(d.messages || []);
        setCourseData(d.courseData || {
          sourceType: 'external',
          details: { level: 'beginner', language: 'English', scriptingLanguage: 'NA', price: '0' },
          structure: { modules: [] },
          content: [],
          quiz: []
        });
        setCurrentStep(d.currentStep || 'ASK_TOPIC');
        setStarted(true);
        if (d.courseData?.details) {
          setActiveCardDetails({ ...d.courseData.details, price: "0" });
        } else {
          setActiveCardDetails(null);
        }

        // Initialize lastSavedDataRef to prevent duplicate save on load
        lastSavedDataRef.current = JSON.stringify({
          messages: d.messages || [],
          courseData: d.courseData || {},
          currentStep: d.currentStep || 'ASK_TOPIC'
        });

        // Restore generation status and counts if step is READY
        if (d.currentStep === 'READY') {
          let totalChaps = 0;
          let completedChaps = 0;
          (d.courseData?.structure?.modules || []).forEach(mod => {
            (mod?.chapters || []).forEach(chap => {
              totalChaps++;
              if (chap.contents && chap.contents.length > 0) {
                completedChaps++;
              }
            });
          });
          setBatchTotal(totalChaps);
          setBatchCompleted(completedChaps);
          setGenerationStatus('completed');
        } else {
          setGenerationStatus('idle');
          setIsBatchGenerating(false);
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
        duration: '',
        requirements: '',
        level: '',
        language: 'English',
        scriptingLanguage: 'NA',
        evaluator: 'Sarah Johnson'
      },
      structure: { modules: [] },
      content: [],
      quiz: []
    });
    setStarted(false);
    setCurrentStep('ASK_TOPIC');
    setQuickReplies([]);
    setActiveCardDetails(null);
    setAttachedFile(null);
    setGenerationStatus('idle');
    cancelGenerationRef.current = false;
    lastSavedDataRef.current = null;
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
  const renderInlineDetails = (details) => {
    if (!details) return null;
    
    return (
      <div className="mt-4 bg-white border border-slate-200/80 shadow-md rounded-2xl p-5 space-y-4 text-left animate-fade-in text-slate-800 max-w-lg w-full">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
          <h4 className="font-extrabold text-xs text-indigo-650 flex items-center gap-1.5 uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5" /> Learning Goals Summary
          </h4>
          <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded font-black uppercase tracking-wider">
            Personalized
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 text-xs">
          <div className="bg-slate-50 border border-slate-100/60 p-3 rounded-xl">
            <span className="text-[8px] uppercase tracking-widest text-slate-400 font-extrabold block mb-0.5">Learning Topic</span>
            <span className="font-bold text-slate-800">{details.subject || details.courseName || details.topic || 'Not specified'}</span>
          </div>
          <div className="bg-slate-50 border border-slate-100/60 p-3 rounded-xl">
            <span className="text-[8px] uppercase tracking-widest text-slate-400 font-extrabold block mb-0.5">Learning Goal</span>
            <span className="font-bold text-slate-800">{details.description || details.goal || details.objective || 'Not specified'}</span>
          </div>
          <div className="bg-slate-50 border border-slate-100/60 p-3 rounded-xl">
            <span className="text-[8px] uppercase tracking-widest text-slate-400 font-extrabold block mb-0.5">Current Level</span>
            <span className="font-bold text-slate-800">{details.level || details.currentLevel || details.experience || 'Not specified'}</span>
          </div>
          <div className="bg-slate-50 border border-slate-100/60 p-3 rounded-xl">
            <span className="text-[8px] uppercase tracking-widest text-slate-400 font-extrabold block mb-0.5">Learning Style</span>
            <span className="font-bold text-slate-800">{details.requirements || details.learningStyle || details.style || 'Not specified'}</span>
          </div>
          <div className="bg-slate-50 border border-slate-100/60 p-3 rounded-xl">
            <span className="text-[8px] uppercase tracking-widest text-slate-400 font-extrabold block mb-0.5">Course Duration</span>
            <span className="font-bold text-slate-800">{(details.duration || details.courseDuration || details.hours) ? `${details.duration || details.courseDuration || details.hours} Hours` : 'Not specified'}</span>
          </div>
        </div>
      </div>
    );
  };

  // Dynamically generate objective suggestion chips based on the course topic
  const getObjectiveSuggestions = (topic) => {
    const cleanTopic = (topic || "").toLowerCase();
    if (cleanTopic.includes("python")) {
      return [
        "Learn Python programming from scratch",
        "Master Python automation and scripting",
        "Build web applications with Django and Flask"
      ];
    }
    if (cleanTopic.includes("security") || cleanTopic.includes("cyber")) {
      return [
        "Learn ethical hacking and penetration testing",
        "Understand network security and firewalls",
        "Master security threat and vulnerability analysis"
      ];
    }
    if (cleanTopic.includes("data") || cleanTopic.includes("machine learning") || cleanTopic.includes("ai")) {
      return [
        "Master data analysis with Pandas and NumPy",
        "Build predictive machine learning models",
        "Understand neural networks and deep learning"
      ];
    }
    if (cleanTopic.includes("grammar") || cleanTopic.includes("english")) {
      return [
        "Master English grammar and sentence structure",
        "Improve business writing and communication",
        "Learn spoken English and conversation skills"
      ];
    }
    // Fallback templates using the custom topic
    const capitalized = topic ? (topic.charAt(0).toUpperCase() + topic.slice(1)) : "this subject";
    return [
      `Learn the core fundamentals of ${capitalized}`,
      `Master advanced techniques and tools in ${capitalized}`,
      `Build practical real-world projects with ${capitalized}`
    ];
  };

  const cleanStructureText = (text) => {
    if (!text) return "";
    const lines = text.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      // Filter out lines starting with numbers (e.g. "1. ", "2) ", "1:") — module/chapter numbering
      if (/^\d+[\.):\-]/.test(trimmed)) return false;
      // Filter out lettered list items (e.g. "a) ", "A. ")
      if (/^[a-zA-Z][\.):]\s/.test(trimmed)) return false;
      // Filter out bullet points / dashes / asterisks
      if (/^[\-\*•\–]/.test(trimmed)) return false;
      // Filter out lines starting with Module, Chapter, Unit, Lesson, Topic, Section
      const lower = trimmed.toLowerCase();
      if (lower.startsWith('module') || lower.startsWith('chapter') || lower.startsWith('unit') ||
          lower.startsWith('lesson') || lower.startsWith('topic') || lower.startsWith('section')) return false;
      // Filter out lines that look like course outline titles (short lines with colons at end)
      if (trimmed.endsWith(':') && trimmed.length < 60) return false;
      return true;
    });
    return filteredLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  // Basic markdown text formatter for chat bubble rendering
  const formatChatMessage = (text) => {
    if (!text) return null;
    
    // Split by lines
    const lines = text.split('\n');
    return lines.map((line, lIdx) => {
      // 1. Bullet list items
      const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ') || line.trim().startsWith('• ');
      let content = line;
      if (isBullet) {
        content = line.trim().replace(/^[\-\*•]\s+/, '');
      }

      // 2. Bold text helper: replace **abc** with <strong>abc</strong>
      const parts = [];
      let lastIdx = 0;
      const regex = /\*\*([^*]+)\*\*/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        if (match.index > lastIdx) {
          parts.push(content.substring(lastIdx, match.index));
        }
        parts.push(<strong key={match.index} className="font-black text-slate-905">{match[1]}</strong>);
        lastIdx = regex.lastIndex;
      }
      if (lastIdx < content.length) {
        parts.push(content.substring(lastIdx));
      }

      if (isBullet) {
        return (
          <li key={lIdx} className="list-disc ml-5 text-sm my-0.5 text-slate-700">
            {parts}
          </li>
        );
      }

      return (
        <p key={lIdx} className="text-sm my-1 text-slate-800 leading-relaxed min-h-[1rem]">
          {parts}
        </p>
      );
    });
  };

  // 2. Safe Syllabus tree renderer
  const renderInlineStructure = (structure) => {
    if (!structure || !structure.modules || !Array.isArray(structure.modules) || structure.modules.length === 0) return null;
    const courseTitle = courseData?.details?.courseName || "Custom Course Outline";
    return (
      <div className="mt-4 bg-white border border-slate-200 shadow-lg rounded-2xl p-5 space-y-4 text-left animate-fade-in">
        <div className="flex flex-col border-b border-slate-100 pb-3 gap-1">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-xs text-indigo-600 flex items-center gap-1.5 uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5" /> Syllabus Proposal
            </h4>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 ${
                (currentStep === 'OUTLINE_EDIT' || currentStep === 'EDIT_OUTLINE_CHOICE' || currentStep === 'ASK_REDUCE_COUNT' || currentStep === 'ASK_ADD_TOPIC')
                  ? 'bg-amber-50 text-amber-600 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-250'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  (currentStep === 'OUTLINE_EDIT' || currentStep === 'EDIT_OUTLINE_CHOICE' || currentStep === 'ASK_REDUCE_COUNT' || currentStep === 'ASK_ADD_TOPIC')
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-emerald-500'
                }`} />
                {(currentStep === 'OUTLINE_EDIT' || currentStep === 'EDIT_OUTLINE_CHOICE' || currentStep === 'ASK_REDUCE_COUNT' || currentStep === 'ASK_ADD_TOPIC') ? 'Reviewing' : 'Confirmed'}
              </span>
              <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-0.5 rounded font-black uppercase tracking-wider">
                {structure.modules.length} Modules
              </span>
            </div>
          </div>
          <h3 className="text-sm font-black text-slate-800 mt-1">{courseTitle}</h3>
        </div>
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
          {structure.modules.map((m, mIdx) => {
            if (!m) return null;
            return (
              <div key={mIdx} className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                  <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded text-[8px] font-black uppercase">Mod {mIdx+1}</span>
                  <span>{m.title}</span>
                </div>
                <div className="pl-3.5 space-y-1.5 border-l border-slate-200 text-[11px] text-slate-500">
                  {Array.isArray(m.chapters) && m.chapters.map((c, cIdx) => {
                    if (!c) return null;
                    return (
                      <div key={cIdx} className="flex items-center gap-1.5 py-0.5">
                        <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                        <span>{c.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {(currentStep === 'OUTLINE_EDIT' || currentStep === 'CONFIRM_GENERATE') && (
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              Great! Here's the updated course structure outline. Please take a moment to review it. Would you like to make any further modifications, or are you happy with this outline?
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => {
                  handleSendMessage("Edit outline", 'OUTLINE_EDIT', courseData);
                }}
                className="flex-1 bg-white hover:bg-slate-50 text-slate-700 font-bold py-2 rounded-xl text-xs border border-slate-200 shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" /> Edit Outline
              </button>
              <button
                onClick={() => {
                  // Transition to CONFIRM_GENERATE so AI asks for final confirmation before generation
                  setCurrentStep('CONFIRM_GENERATE');
                  handleSendMessage("I am happy with this outline. Please confirm and proceed.", 'CONFIRM_GENERATE', courseData);
                }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-md"
              >
                Confirm Outline <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 2.5 Details Summary Card Tree Renderer
  const renderInlineDetailsCard = (metadata) => {
    if (!metadata) return null;
    return (
      <div className="mt-4 bg-white border border-slate-200 shadow-lg rounded-2xl p-5 space-y-4 text-left animate-fade-in">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h4 className="font-bold text-xs text-indigo-600 flex items-center gap-1.5 uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5" /> Course Details Summary
          </h4>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 ${
            (currentStep === 'CONFIRM_DETAILS' || currentStep === 'EDIT_DETAILS_CHOICE')
              ? 'bg-amber-50 text-amber-600 border border-amber-200'
              : 'bg-emerald-50 text-emerald-600 border border-emerald-250'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              (currentStep === 'CONFIRM_DETAILS' || currentStep === 'EDIT_DETAILS_CHOICE')
                ? 'bg-amber-500 animate-pulse'
                : 'bg-emerald-500'
            }`} />
            {(currentStep === 'CONFIRM_DETAILS' || currentStep === 'EDIT_DETAILS_CHOICE') ? 'Awaiting Review' : 'Confirmed'}
          </span>
        </div>
        <div className="space-y-2.5 text-xs text-slate-700">
          <div className="flex gap-2">
            <span className="font-bold text-slate-500 w-28 flex-shrink-0">Topic:</span>
            <span className="text-slate-800 font-semibold">{metadata.topic || 'Not set'}</span>
          </div>
          <div className="flex gap-2">
            <span className="font-bold text-slate-500 w-28 flex-shrink-0">Learning Goal:</span>
            <span className="text-slate-800 font-medium">{metadata.learningGoal || 'Not set'}</span>
          </div>
          <div className="flex gap-2">
            <span className="font-bold text-slate-500 w-28 flex-shrink-0">Difficulty Level:</span>
            <span className="text-slate-800 capitalize font-medium">{metadata.currentLevel || 'beginner'}</span>
          </div>
          <div className="flex gap-2">
            <span className="font-bold text-slate-500 w-28 flex-shrink-0">Learning Style:</span>
            <span className="text-slate-800 capitalize font-medium">{metadata.learningStyle || 'balanced combination'}</span>
          </div>
          <div className="flex gap-2">
            <span className="font-bold text-slate-500 w-28 flex-shrink-0">Duration:</span>
            <span className="text-slate-800 font-semibold">{metadata.duration ? `${metadata.duration} Hours` : 'Not set'}</span>
          </div>
        </div>
        {(currentStep === 'CONFIRM_DETAILS' || currentStep === 'EDIT_DETAILS_CHOICE') && (
          <div className="border-t border-slate-100 pt-3 flex gap-2.5">
            <button
              onClick={() => {
                handleSendMessage("Edit details");
              }}
              className="flex-1 bg-white hover:bg-slate-50 text-slate-700 font-bold py-2 rounded-xl text-xs border border-slate-200 shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Edit className="w-3.5 h-3.5" /> Edit Details
            </button>
            <button
              onClick={() => {
                handleSendMessage("Confirm details & proceed");
              }}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-md"
            >
              Confirm Details <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
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
                  courseData.mysql_id ? (
                    <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Published
                    </span>
                  ) : (
                    <button
                      onClick={handlePublish}
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black px-4 py-1.5 rounded-xl text-xs transition active:scale-95 shadow-md flex items-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Publish Course
                    </button>
                  )
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
                      <div className={`space-y-1 ${(!isUser && (msg.metadataType === 'structure' || msg.metadataType === 'details_card')) ? 'w-[520px] max-w-full' : 'max-w-[80%]'}`}>
                        
                        {/* Bubble content */}
                        <div className={`p-4 shadow-sm leading-relaxed ${
                          isUser 
                            ? 'bg-indigo-600 text-white rounded-2xl rounded-br-none' 
                            : 'bg-white border border-slate-200/80 text-slate-800 rounded-2xl rounded-bl-none'
                        } ${(!isUser && (msg.metadataType === 'structure' || msg.metadataType === 'details_card')) ? 'w-full' : ''}`}>
                           {msg.content && msg.content.trim() && (
                             <div className="space-y-0.5">
                               {formatChatMessage(msg.metadataType === 'structure' ? cleanStructureText(msg.content) : msg.content)}
                             </div>
                           )}

                           {/* Render custom metadata cards inline inside the bubble */}
                           {!isUser && msg.metadataType === 'structure' && renderInlineStructure(msg.metadata)}
                           {!isUser && msg.metadataType === 'details_card' && renderInlineDetailsCard(msg.metadata)}
                          
                          <div className="text-[9px] text-right mt-1.5 opacity-60">
                            {msg.timestamp}
                          </div>
                        </div>

                        {/* Render Inline Progress Card if flagged */}
                        {!isUser && msg.isProgressCard && (isBatchGenerating || generationStatus === 'completed') && (
                          <div className="bg-white border border-slate-200 shadow-md p-5 rounded-2xl rounded-bl-none w-full flex flex-col gap-4 text-slate-800 mt-3 animate-fade-in">
                            <div className="flex items-center gap-4">
                              <div className="relative w-12 h-12 flex-shrink-0">
                                {/* Background circle */}
                                <svg className="w-full h-full transform -rotate-90">
                                  <circle
                                    cx="24"
                                    cy="24"
                                    r="20"
                                    strokeWidth="3.5"
                                    stroke="#f1f5f9"
                                    fill="transparent"
                                  />
                                  {/* Animated progress circle */}
                                  <circle
                                    cx="24"
                                    cy="24"
                                    r="20"
                                    strokeWidth="3.5"
                                    stroke={generationStatus === 'completed' ? '#10b981' : '#6366f1'}
                                    fill="transparent"
                                    strokeDasharray={125.6}
                                    strokeDashoffset={generationStatus === 'completed' ? 0 : (125.6 - (125.6 * Math.min(batchCompleted, batchTotal)) / batchTotal)}
                                    strokeLinecap="round"
                                    className="transition-all duration-500 ease-out"
                                  />
                                </svg>
                                {/* Percentage text */}
                                <div className={`absolute inset-0 flex items-center justify-center text-[10px] font-black ${generationStatus === 'completed' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                  {generationStatus === 'completed' ? '100%' : `${Math.round((batchCompleted / batchTotal) * 100)}%`}
                                </div>
                              </div>
                              <div className="flex-1 space-y-1">
                                <span className={`text-[9px] uppercase tracking-widest font-black block ${generationStatus === 'completed' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                  {generationStatus === 'completed' ? 'Content Generation Complete' : 'Writing Course Material'}
                                </span>
                                <h5 className="text-xs font-bold text-slate-800 line-clamp-1">
                                  {generationStatus === 'completed' ? 'All lessons generated successfully!' : batchCurrentTitle}
                                </h5>
                                <p className="text-[10px] text-slate-500 font-medium">
                                  Completed {batchCompleted} of {batchTotal} chapters...
                                </p>
                              </div>
                            </div>

                            {/* Action Buttons inside Card */}
                            {isBatchGenerating && (
                              <div className="border-t border-slate-100 pt-3">
                                <button
                                  onClick={() => handleCancelGeneration()}
                                  className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/50 font-bold py-2 rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1 shadow-sm"
                                >
                                  <X className="w-3.5 h-3.5" /> Cancel Course Generation
                                </button>
                              </div>
                            )}

                            {generationStatus === 'completed' && (
                              <div className="border-t border-slate-100 pt-3 flex gap-2.5">
                                <button
                                  onClick={() => setIsPreviewOpen(true)}
                                  className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60 font-bold py-2.5 rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Preview Course
                                </button>
                                {courseData.mysql_id ? (
                                  <div className="flex-1 bg-emerald-50 text-emerald-600 border border-emerald-250 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-inner">
                                    <CheckCircle className="w-3.5 h-3.5" /> Course Published
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handlePublish()}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-md shadow-indigo-900/10"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" /> Publish Course
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

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
                  ref={chatInputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                   placeholder={isBatchGenerating ? "Generating course content..." : "Tell the AI architect what to add or modify..."}
                  className="w-full bg-transparent resize-none focus:outline-none text-sm text-slate-800 placeholder-slate-400 px-2 py-1 h-14"
                  disabled={loading || isBatchGenerating}
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
                      onClick={() => !isBatchGenerating && setDeepThinkActive(prev => !prev)}
                      disabled={isBatchGenerating}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${deepThinkActive ? 'bg-indigo-50/80 text-indigo-600 border border-indigo-100' : 'text-slate-500 hover:bg-slate-150/40'} ${isBatchGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>Deep Think</span>
                    </button>


                  </div>
                  <button
                    onClick={() => handleSendMessage(inputMessage)}
                    disabled={!inputMessage.trim() || loading || isBatchGenerating}
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

      {/* 4. Full Course Previewer Modal Overlay */}
      {isPreviewOpen && (
        <LessonPreviewEditorModal
          courseData={courseData}
          updateCourseData={(updated) => setCourseData(updated)}
          initialMIdx={0}
          initialCIdx={0}
          readOnly={true}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
    </div>
  );
}
