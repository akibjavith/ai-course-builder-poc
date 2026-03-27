import axios from 'axios';

const API_URL = 'http://localhost:8000'; // FastAPI default port

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
  const response = await axios.post(`${API_URL}/course/generate-quiz`, data);
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
