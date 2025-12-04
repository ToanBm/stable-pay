import axios from 'axios';
import { API_BASE_URL } from '@/utils/constants';

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    // Bypass ngrok warning page for free tier
    'ngrok-skip-browser-warning': 'true',
  },
  timeout: 30000, // 30 seconds timeout
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    // Check if response is HTML (ngrok warning page)
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('text/html')) {
      console.error('[API] Received HTML instead of JSON - possible ngrok warning page');
      throw new Error('Ngrok warning page detected. Please visit the ngrok URL in browser first to bypass the warning.');
    }
    return response;
  },
  (error) => {
    // Check if error response is HTML (ngrok warning page)
    if (error.response?.data && typeof error.response.data === 'string' && error.response.data.includes('ngrok')) {
      console.error('[API] Ngrok warning page detected in error response');
      return Promise.reject(new Error('Ngrok warning page detected. Please visit the ngrok URL in browser first.'));
    }
    
    // Extract error message
    let message = 'An error occurred';
    if (error.response?.data?.error) {
      message = error.response.data.error;
    } else if (error.response?.data?.message) {
      message = error.response.data.message;
    } else if (error.message) {
      message = error.message;
    }
    
    // Provide user-friendly error messages
    if (error.code === 'ECONNREFUSED') {
      message = `Cannot connect to backend. Is the server running?`;
    } else if (error.code === 'ERR_NETWORK') {
      message = 'Network error. Please check your connection.';
    } else if (error.response?.status === 404) {
      message = `API endpoint not found: ${error.config?.url}`;
    } else if (error.response?.status >= 500) {
      message = `Server error: ${error.response?.statusText || 'Internal server error'}`;
    }
    
    return Promise.reject(new Error(message));
  }
);
