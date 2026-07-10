import axios from 'axios';

const API_URL =
  (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL)?.replace(/\/+$/, '') ||
  'http://192.168.3.191:8000';

export const uploadDoc = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axios.post(`${API_URL}/course/upload-doc`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const uploadChapterMedia = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axios.post(`${API_URL}/course/upload-media`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const listMediaFiles = async () => {
  const response = await axios.get(`${API_URL}/course/list-media`);
  return response.data;
};

export const generateStructure = async (sourceType, details) => {
  const response = await axios.post(`${API_URL}/course/structure`, {
    source_type: sourceType,
    details: details
  });
  return response.data;
};

export const generateCourseQuiz = async (data) => {
  const response = await axios.post(`${API_URL}/course/quiz`, data);
  return response.data;
};

export const createCourse = async (courseData) => {
  const response = await axios.post(`${API_URL}/course/create`, courseData);
  return response.data;
};

export const getCourses = async () => {
  const response = await axios.get(`${API_URL}/courses`);
  return response.data;
};
export const generateCourseOutline = async (details) => {
  const response = await axios.post(`${API_URL}/course/outline`, details);
  return response.data;
};

export const generateLessonContent = async (payload) => {
  const response = await axios.post(`${API_URL}/course/lesson-blocks`, payload);
  return response.data;
};

export const generateImagePrompt = async (payload) => {
  const response = await axios.post(`${API_URL}/course/image-prompt`, payload);
  return response.data;
};

export const generateImage = async (payload) => {
  const response = await axios.post(`${API_URL}/course/image`, payload);
  return response.data;
};


export const storeCourse = async (payload) => {
  const courseId = payload.course_json.id;
  if (courseId) {
    const response = await axios.put(`${API_URL}/course/${courseId}`, payload.course_json);
    return response.data;
  } else {
    const response = await axios.post(`${API_URL}/course/create`, payload.course_json);
    return response.data;
  }
};

export const deleteCourse = async (courseId) => {
  const response = await axios.delete(`${API_URL}/course/${courseId}`);
  return response.data;
};

export const uploadThumbnail = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axios.post(`${API_URL}/course/upload-thumbnail`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const generateCourseTitle = async (description) => {
  const response = await axios.post(`${API_URL}/course/generate-title`, { description });
  return response.data;
};

export const fetchWebDocument = async (url) => {
  const response = await axios.post(`${API_URL}/course/fetch-web`, { url });
  return response.data;
};

export const fetchYouTubeDocument = async (youtubeUrl) => {
  const response = await axios.post(`${API_URL}/course/fetch-youtube`, { youtube_url: youtubeUrl });
  return response.data;
};

export const generateOutlineSkeleton = async (payload) => {
  const response = await axios.post(`${API_URL}/course/generate-outline`, payload);
  return response.data;
};

export const exportChapter = async (payload) => {
  const response = await axios.post(`${API_URL}/course/export`, payload);
  return response.data;
};

export const generateFlashcards = async (payload) => {
  const response = await axios.post(`${API_URL}/course/flashcards`, payload);
  return response.data;
};

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axios.post(`${API_URL}/course/upload-media`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const generateMCQs = async (payload) => {
  const response = await axios.post(`${API_URL}/course/mcq`, payload);
  return response.data;
};

export const generateAssessment = async (payload) => {
  const response = await axios.post(`${API_URL}/course/assessment`, payload);
  return response.data;
};

export const autoFillCourseDetails = async () => {
  const response = await axios.post(`${API_URL}/course/auto-fill`);
  return response.data;
};

export const chatWithAI = async (messages, scope, details, courseData, availableSubjects) => {
  const response = await axios.post(`${API_URL}/course/chat`, { 
    messages,
    scope,
    details,
    courseData,
    availableSubjects
  });
  return response.data;
};

export const getCourseById = async (courseId) => {
  const response = await axios.get(`${API_URL}/course/${courseId}`);
  return response.data;
};

export const getSubjects = async () => {
  const response = await axios.get(`${API_URL}/subjects`);
  return response.data;
};

export const getThemes = async () => {
  const response = await axios.get(`${API_URL}/course/themes`);
  return response.data;
};

export const uploadTheme = async (themeData) => {
  const response = await axios.post(`${API_URL}/course/theme`, themeData);
  return response.data;
};

export const chatWithChatbotBuilder = async (messages, currentStep, courseData) => {
  const response = await axios.post(`${API_URL}/course/chatbot-builder/chat`, {
    messages,
    currentStep,
    courseData
  });
  return response.data;
};


export const saveChatbotDraft = async (draftData) => {
  const response = await axios.post(`${API_URL}/course/chatbot-builder/draft`, draftData);
  return response.data;
};

export const getChatbotDrafts = async () => {
  const response = await axios.get(`${API_URL}/course/chatbot-builder/drafts`);
  return response.data;
};

export const getChatbotDraft = async (draftId) => {
  const response = await axios.get(`${API_URL}/course/chatbot-builder/draft/${draftId}`);
  return response.data;
};

export const deleteChatbotDraft = async (draftId) => {
  const response = await axios.delete(`${API_URL}/course/chatbot-builder/draft/${draftId}`);
  return response.data;
};

export const renameChatbotDraft = async (draftId, name) => {
  const response = await axios.post(`${API_URL}/course/chatbot-builder/draft/${draftId}/rename`, { name });
  return response.data;
};






