import axios from 'axios';

// Base API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // Increased to 60 seconds for complex operations
  headers: {
    'Content-Type': 'application/json',
  },
});

// Separate axios instance for FormData requests (no Content-Type header)
const formApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // Increased to 60 seconds for complex operations
});

// Request interceptor for adding auth tokens
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const candidatesAPI = {
  // Get all candidates
  getAll: () => api.get('/candidates'),
  
  // Get candidate by ID
  getById: (id) => api.get(`/candidates/${id}`),
  
  // Create new candidate
  create: (data) => api.post('/candidates', data),
  
  // Update candidate
  update: (id, data) => api.put(`/candidates/${id}`, data),
  
  // Delete candidate
  delete: (id) => api.delete(`/candidates/${id}`),
  
  // Search candidates
  search: (query) => api.get(`/candidates/search?q=${query}`),
  
  // Filter candidates by status
  filterByStatus: (status) => api.get(`/candidates?status=${status}`),
};

export const prescreeningAPI = {
  // Check server status
  checkStatus: () => api.get('/status'),
  
  // Set prospect name
  setProspect: (name) => api.post('/set-prospect', { name }),
  
  // Initiate call
  makeCall: (phoneNumber) => api.post('/make-call', { phoneNumber }),
  
  // Get conversation transcripts
  getTranscripts: () => api.get('/transcripts'),
  
  // Get conversation
  getConversation: () => api.get('/conversation'),
  
  // Analyze conversation
  analyzeConversation: (conversation) => api.post('/analyze', { conversation }),
  
  // End call
  endCall: () => api.post('/end-call'),
};

export const resumeAPI = {
  // Parse resume
  parseResume: (formData) => formApi.post('/parse-resume', formData),
  
  // Get parsing status
  getParsingStatus: (jobId) => api.get(`/parse-status/${jobId}`),
  
  // Download parsed data
  downloadParsedData: (jobId) => api.get(`/download-parsed/${jobId}`, {
    responseType: 'blob',
  }),
  
  // Parse and score multiple resumes
  parseAndScoreResumes: (formData) => formApi.post('/parse-and-score-resumes', formData, {
    timeout: 120000, // 2 minutes for resume parsing (AI processing + emails + reports)
  }),
  
  // Auto-process candidates (send emails and HR report)
  autoProcessCandidates: () => api.post('/auto-process-candidates'),
};

export const jobDescriptionAPI = {
  // Get all job descriptions
  getAll: () => api.get('/job-descriptions'),
  
  // Get job description by ID
  getById: (id) => api.get(`/job-descriptions/${id}`),
  
  // Create new job description
  create: (data) => api.post('/job-descriptions', data),
  
  // Update job description
  update: (id, data) => api.put(`/job-descriptions/${id}`, data),
  
  // Delete job description
  delete: (id) => api.delete(`/job-descriptions/${id}`),
  
  // Parse job description file
  parseJobDescription: (formData) => formApi.post('/parse-job-description', formData, {
    timeout: 60000, // 1 minute for job description parsing
  }),
  
  // Search job descriptions
  search: (query) => api.get(`/job-descriptions/search?q=${query}`),
  
  // Filter by status
  filterByStatus: (status) => api.get(`/job-descriptions?status=${status}`),
};

export const analyticsAPI = {
  // Get dashboard stats
  getDashboardStats: (timeRange = '30') => api.get(`/analytics/dashboard?range=${timeRange}`),
  
  // Get trends data
  getTrends: (timeRange = '30') => api.get(`/analytics/trends?range=${timeRange}`),
  
  // Get score distribution
  getScoreDistribution: () => api.get('/analytics/scores'),
  
  // Get status breakdown
  getStatusBreakdown: () => api.get('/analytics/status'),
  
  // Get top skills
  getTopSkills: () => api.get('/analytics/skills'),
  
  // Get recent activity
  getRecentActivity: () => api.get('/analytics/activity'),
};

export const authAPI = {
  // Login
  login: (credentials) => api.post('/auth/login', credentials),
  
  // Logout
  logout: () => api.post('/auth/logout'),
  
  // Get current user
  getCurrentUser: () => api.get('/auth/me'),
  
  // Refresh token
  refreshToken: () => api.post('/auth/refresh'),
};

// Utility functions
export const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error status
    return {
      message: error.response.data?.message || 'An error occurred',
      status: error.response.status,
    };
  } else if (error.request) {
    // Request was made but no response received
    return {
      message: 'Network error. Please check your connection.',
      status: 0,
    };
  } else {
    // Something else happened
    return {
      message: error.message || 'An unexpected error occurred',
      status: -1,
    };
  }
};

export default api;

