import axios from 'axios';

const API_URL =  'http://192.168.3.158:8000'; // FastAPI running on your Wi-Fi IP

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

export const generateStructure = async (sourceType, details) => {
  const response = await axios.post(`${API_URL}/course/structure`, {
    source_type: sourceType,
    details: details
  });
  return response.data;
};

export const generateChapter = async (data) => {
  const response = await axios.post(`${API_URL}/course/generate`, data);
  return response.data;
};

export const generateCourseQuiz = async (data) => {
  const response = await axios.post(`${API_URL}/course/quiz`, data);
  return response.data;
};

export const regenerateChapter = async (data) => {
  const response = await axios.post(`${API_URL}/course/regenerate`, data);
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
  const response = await axios.post(`${API_URL}/course/lesson`, payload);
  return response.data;
};

export const generateVoiceScript = async (payload) => {
  const response = await axios.post(`${API_URL}/course/voice`, payload);
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

export const compileVideo = async (payload) => {
  const response = await axios.post(`${API_URL}/course/compile-video`, payload);
  return response.data;
};

export const startAsyncGeneration = async (payload) => {
  const response = await axios.post(`${API_URL}/course/generate-async`, payload);
  return response.data;
};

export const checkAsyncStatus = async (taskId) => {
  const response = await axios.get(`${API_URL}/course/task-status/${taskId}`);
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

export const chatWithAI = async (messages) => {
  const response = await axios.post(`${API_URL}/course/chat`, { messages });
  return response.data;
};


