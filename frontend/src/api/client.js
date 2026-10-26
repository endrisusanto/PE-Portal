import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('pe_portal_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Token Refresh on 401
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Intercept guest write / update attempts
    if (
      error.response?.data?.code === 'GUEST_WRITE_BLOCKED' ||
      ((error.response?.status === 401 || error.response?.status === 403) &&
        typeof error.response?.data?.message === 'string' &&
        error.response.data.message.includes('Wajib login dengan ADCorp'))
    ) {
      window.dispatchEvent(
        new CustomEvent('pe_guest_action_blocked', {
          detail: {
            message: error.response?.data?.message || 'Wajib login dengan ADCorp untuk melakukan aksi write atau update',
            action: originalRequest?.method,
          },
        })
      );
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('pe_portal_refresh_token');

      // If no refresh token or already retried, clear session
      if (!refreshToken || originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
        localStorage.removeItem('pe_portal_token');
        localStorage.removeItem('pe_portal_refresh_token');
        localStorage.removeItem('pe_portal_user');
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post('/api/v1/auth/refresh', {
          refresh_token: refreshToken,
        });

        const newToken = data.token;
        const newRefreshToken = data.refresh_token;

        localStorage.setItem('pe_portal_token', newToken);
        if (newRefreshToken) {
          localStorage.setItem('pe_portal_refresh_token', newRefreshToken);
        }

        api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('pe_portal_token');
        localStorage.removeItem('pe_portal_refresh_token');
        localStorage.removeItem('pe_portal_user');
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
