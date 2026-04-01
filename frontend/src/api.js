import axios from 'axios';

const API_URL = 'http://localhost:8001'; // FastAPI running on your Wi-Fi IP

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
  // payload = { course_json: {...} }
  // Route to /course/create which uses course_store.py so dashboard can read it back
  const response = await axios.post(`${API_URL}/course/create`, payload.course_json);
  return response.data;
};

