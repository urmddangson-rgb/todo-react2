import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api/todos';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10초 타임아웃
});

// 요청 인터셉터
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 네트워크 에러 처리
    if (error.code === 'ECONNABORTED') {
      const customError = new Error('요청 시간이 초과되었습니다. 서버를 확인해주세요.');
      customError.status = 408;
      return Promise.reject(customError);
    }
    
    // 연결 에러 처리
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      const customError = new Error('서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.');
      customError.status = 503;
      return Promise.reject(customError);
    }
    
    // HTTP 에러 응답 처리
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      let message = '요청 처리 중 오류가 발생했습니다.';
      
      if (data && data.message) {
        message = data.message;
      } else if (data && data.error) {
        message = data.error;
      } else {
        switch (status) {
          case 400:
            message = '잘못된 요청입니다.';
            break;
          case 404:
            message = '요청한 리소스를 찾을 수 없습니다.';
            break;
          case 500:
            message = '서버 내부 오류가 발생했습니다.';
            break;
          default:
            message = `오류가 발생했습니다. (${status})`;
        }
      }
      
      const customError = new Error(message);
      customError.status = status;
      customError.data = data;
      return Promise.reject(customError);
    }
    
    return Promise.reject(error);
  }
);

// 할일 목록 조회
export const getTodos = async () => {
  try {
    const response = await api.get('/');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// 특정 할일 조회
export const getTodo = async (id) => {
  try {
    const response = await api.get(`/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// 할일 생성
export const createTodo = async (todoData) => {
  try {
    const response = await api.post('/', todoData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// 할일 수정
export const updateTodo = async (id, todoData) => {
  try {
    const response = await api.put(`/${id}`, todoData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// 할일 삭제
export const deleteTodo = async (id) => {
  try {
    const response = await api.delete(`/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// 백엔드 연결 상태 확인
export const checkConnection = async () => {
  try {
    const startTime = Date.now();
    const response = await api.get('/', { timeout: 5000 });
    const responseTime = Date.now() - startTime;
    
    return {
      connected: true,
      responseTime,
      status: response.status,
      url: API_BASE_URL,
      timestamp: new Date().toLocaleString('ko-KR')
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message || '연결 실패',
      url: API_BASE_URL,
      timestamp: new Date().toLocaleString('ko-KR'),
      status: error.status || 'N/A'
    };
  }
};

// 백엔드 URL 내보내기
export const getApiUrl = () => API_BASE_URL;

