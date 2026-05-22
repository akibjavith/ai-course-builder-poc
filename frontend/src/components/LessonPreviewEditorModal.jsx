import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit3, Save, Trash2, X } from 'lucide-react';
import PremiumRichEditor from './PremiumRichEditor';

function flattenLessons(structure) {
  const lessons = [];
  (structure?.modules || []).forEach((mod, mIdx) => {
    (mod?.chapters || []).forEach((chap, cIdx) => {
      lessons.push({ mIdx, cIdx, chapter: chap, moduleTitle: mod?.title });
    });
  });
  return lessons;
}

function getChapter(structure, mIdx, cIdx) {
  return structure?.modules?.[mIdx]?.chapters?.[cIdx] || null;
}

function buildPreviewContent(chapter) {
  if (!chapter) return null;
  const validBlocks = (chapter?.contents || []).filter((b) => b?.completed && (b?.content || b?.file_url));
  const legacy = chapter?.content?.completed ? [chapter.content] : [];
  const blocks = validBlocks.length > 0 ? validBlocks : legacy;

  const htmlBlocks = blocks.filter((b) => (b?.type === 'html' || b?.content_type === 'html') && b?.content);
  const html_content =
    htmlBlocks.length > 0
      ? htmlBlocks.map((b) => b.content).join('<hr class="my-8 border-slate-100" />')
      : null;

  const files = blocks
    .filter((b) => b?.file_url)
    .map((b) => ({ url: b.file_url, name: b.file_name || b.file_url?.split('/').pop() }));

  const explanation = blocks.find((b) => b?.explanation)?.explanation || '';

  return { html_content, files, explanation };
}

export default function LessonPreviewEditorModal({
  courseData,
  updateCourseData,
  initialMIdx,
  initialCIdx,
  startInEdit = false,
  readOnly = false,
  onClose,
}) {
  const lessons = useMemo(() => flattenLessons(courseData?.structure), [courseData?.structure]);
  const [active, setActive] = useState({ mIdx: initialMIdx, cIdx: initialCIdx });
  const [editMode, setEditMode] = useState(!readOnly && !!startInEdit);
  const activeLessonIndex = lessons.findIndex((l) => l.mIdx === active.mIdx && l.cIdx === active.cIdx);
  const chapter = getChapter(courseData?.structure, active.mIdx, active.cIdx);
  const previewContent = useMemo(() => buildPreviewContent(chapter), [chapter]);

  const initialHtml = previewContent?.html_content || chapter?.content?.html_content || '';
  const [htmlDraft, setHtmlDraft] = useState(initialHtml);

  useEffect(() => {
    const nextHtml = buildPreviewContent(getChapter(courseData?.structure, active.mIdx, active.cIdx))?.html_content || '';
    setHtmlDraft(nextHtml);
    setEditMode(!readOnly && !!startInEdit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.mIdx, active.cIdx]);

  const hasPrev = activeLessonIndex > 0;
  const hasNext = activeLessonIndex >= 0 && activeLessonIndex < lessons.length - 1;

  const goPrev = () => {
    if (!hasPrev) return;
    const prev = lessons[activeLessonIndex - 1];
    setActive({ mIdx: prev.mIdx, cIdx: prev.cIdx });
    setEditMode(false);
  };
  const goNext = () => {
    if (!hasNext) return;
    const next = lessons[activeLessonIndex + 1];
    setActive({ mIdx: next.mIdx, cIdx: next.cIdx });
    setEditMode(false);
  };

  const saveHtmlToLesson = () => {
    if (readOnly) return;
    const newModules = (courseData.structure?.modules || []).map((mod, m) => {
      if (m !== active.mIdx) return mod;
      return {
        ...mod,
        chapters: (mod.chapters || []).map((chap, c) => {
          if (c !== active.cIdx) return chap;
          const newBlock = {
            type: 'html',
            content: htmlDraft,
            source: 'ai',
            completed: true,
            timestamp: Date.now(),
          };
          return {
            ...chap,
            contents: [newBlock],
            content: {
              ...(chap.content || {}),
              content_type: 'html',
              html_content: htmlDraft,
              explanation: chap.content?.explanation || '',
              completed: true,
            },
          };
        }),
      };
    });
    updateCourseData('structure', { ...courseData.structure, modules: newModules });
    setEditMode(false);
  };

  const deleteLesson = () => {
    if (readOnly) return;
    const newModules = (courseData.structure?.modules || []).map((mod, m) => {
      if (m !== active.mIdx) return mod;
      const newChapters = [...(mod.chapters || [])];
      newChapters.splice(active.cIdx, 1);
      return { ...mod, chapters: newChapters };
    });
    updateCourseData('structure', { ...courseData.structure, modules: newModules });
    const nextLessons = flattenLessons({ ...courseData.structure, modules: newModules });
    if (nextLessons.length === 0) {
      onClose?.();
      return;
    }
    const nextIdx = Math.min(activeLessonIndex, nextLessons.length - 1);
    const next = nextLessons[nextIdx];
    setActive({ mIdx: next.mIdx, cIdx: next.cIdx });
    setEditMode(false);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative animate-scale-in">
        <div className="p-6 sm:px-10 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-sky-50 text-sky-600 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-sky-100">
                {editMode ? 'Edit Lesson' : 'Live Preview'}
              </span>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight truncate max-w-md">
                {chapter?.title || 'Lesson'}
              </h2>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {editMode ? 'Edit the lesson HTML content' : 'Reviewing how students will see this lesson'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 mr-2 border-r border-slate-100 pr-3">
              <button
                onClick={goPrev}
                disabled={!hasPrev}
                className="p-2.5 bg-slate-50 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all disabled:opacity-30 active:scale-95"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goNext}
                disabled={!hasNext}
                className="p-2.5 bg-slate-50 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all disabled:opacity-30 active:scale-95"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {!readOnly && !editMode ? (
              <button
                onClick={() => setEditMode(true)}
                className="p-3 bg-slate-50 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-2xl transition-all active:scale-95"
                title="Edit"
              >
                <Edit3 className="w-5 h-5" />
              </button>
            ) : !readOnly && editMode ? (
              <button
                onClick={saveHtmlToLesson}
                className="p-3 bg-sky-600 text-white hover:bg-sky-700 rounded-2xl transition-all active:scale-95"
                title="Save"
              >
                <Save className="w-5 h-5" />
              </button>
            ) : null}

            {!readOnly && (
              <button
                onClick={deleteLesson}
                className="p-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-2xl transition-all active:scale-95"
                title="Delete lesson"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all active:scale-95"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar bg-slate-50/30">
          <div className="max-w-4xl mx-auto px-6 py-12 sm:px-12 space-y-10 bg-white shadow-sm my-10 rounded-[2rem] border border-slate-100">
            {editMode ? (
              <PremiumRichEditor
                value={htmlDraft}
                onChange={setHtmlDraft}
                placeholder="Write or edit lesson content in HTML..."
              />
            ) : previewContent?.html_content ? (
              <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed text-lg">
                <div dangerouslySetInnerHTML={{ __html: previewContent.html_content }} className="animate-fade-in" />
              </div>
            ) : (
              <div className="text-slate-500 text-sm">
                No HTML content yet for this lesson. Click edit to add content.
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-white flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition shadow-xl active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
