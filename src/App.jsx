import { useState, useEffect } from 'react';
import './App.css';
import { getTodos, createTodo, updateTodo, deleteTodo, checkConnection, getApiUrl } from './services/todoApi';

function App() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({
    connected: null,
    checking: false,
    responseTime: null,
    lastChecked: null,
    error: null
  });
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  });
  const [requestLog, setRequestLog] = useState({
    show: false,
    type: null, // 'create', 'update', 'delete'
    requestData: null,
    responseData: null,
    timestamp: null,
    success: null
  });
  const [mongoSaveStatus, setMongoSaveStatus] = useState({
    show: false,
    success: false,
    message: '',
    todoId: null,
    timestamp: null
  });

  // 할일 목록 불러오기
  const fetchTodos = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTodos();
      console.log('백엔드 응답:', response); // 디버깅용
      
      // 다양한 응답 형식 처리
      let todosData = [];
      
      if (Array.isArray(response)) {
        // 배열을 직접 반환하는 경우
        todosData = response;
      } else if (response && response.data) {
        // { data: [...] } 형식
        todosData = Array.isArray(response.data) ? response.data : [];
      } else if (response && response.success && response.data) {
        // { success: true, data: [...] } 형식
        todosData = Array.isArray(response.data) ? response.data : [];
      } else if (response && response.todos) {
        // { todos: [...] } 형식
        todosData = Array.isArray(response.todos) ? response.todos : [];
      } else {
        todosData = [];
      }
      
      setTodos(todosData);
      console.log('할일 목록:', todosData); // 디버깅용
    } catch (err) {
      const errorMessage = err?.message || err?.error || '할일 목록을 불러오는데 실패했습니다.';
      setError(errorMessage);
      console.error('할일 목록 불러오기 오류:', err);
      setTodos([]); // 에러 발생 시 빈 배열로 설정하여 화면에 표시
    } finally {
      setLoading(false);
    }
  };

  // 백엔드 연결 상태 확인
  const checkBackendConnection = async () => {
    setConnectionStatus(prev => ({ ...prev, checking: true }));
    try {
      const result = await checkConnection();
      setConnectionStatus({
        connected: result.connected,
        checking: false,
        responseTime: result.responseTime || null,
        lastChecked: result.timestamp,
        error: result.error || null,
        url: result.url || getApiUrl()
      });
      return result.connected;
    } catch (err) {
      setConnectionStatus({
        connected: false,
        checking: false,
        responseTime: null,
        lastChecked: new Date().toLocaleString('ko-KR'),
        error: err.message || '연결 확인 실패',
        url: getApiUrl()
      });
      return false;
    }
  };

  useEffect(() => {
    fetchTodos();
    checkBackendConnection();
    // 30초마다 연결 상태 확인
    const connectionInterval = setInterval(() => {
      checkBackendConnection();
    }, 30000);
    
    return () => clearInterval(connectionInterval);
  }, []);

  // 할일 추가
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('할일 제목을 입력해주세요.');
      return;
    }

    const requestData = { ...formData };
    setLoading(true);
    setError(null);
    
    // 요청 로그 초기화
    setRequestLog({
      show: true,
      type: 'create',
      requestData: requestData,
      responseData: null,
      timestamp: new Date().toLocaleString('ko-KR'),
      success: null
    });

    console.log('📤 백엔드로 전송하는 데이터:', requestData);

    try {
      const response = await createTodo(formData);
      console.log('📥 백엔드에서 받은 응답:', response);

      // 응답 로그 업데이트
      setRequestLog(prev => ({
        ...prev,
        responseData: response,
        success: true,
        timestamp: new Date().toLocaleString('ko-KR')
      }));

      // MongoDB 저장 성공 확인
      const savedData = response?.data || response;
      const isMongoSuccess = (response?.success && savedData?._id) || savedData?._id;

      if (isMongoSuccess) {
        // MongoDB 저장 성공 메시지 표시
        setMongoSaveStatus({
          show: true,
          success: true,
          message: '✅ MongoDB Compass에 데이터가 정상적으로 저장되었습니다!',
          todoId: savedData._id,
          timestamp: new Date().toLocaleString('ko-KR')
        });

        // 5초 후 자동으로 숨김
        setTimeout(() => {
          setMongoSaveStatus(prev => ({ ...prev, show: false }));
        }, 5000);
      }

      if (response && response.success) {
        setFormData({ title: '', description: '' });
        fetchTodos();
      } else if (response && response._id) {
        // 백엔드가 생성된 객체를 직접 반환하는 경우
        setFormData({ title: '', description: '' });
        fetchTodos();
      } else {
        setFormData({ title: '', description: '' });
        fetchTodos();
      }
    } catch (err) {
      const errorMessage = err?.message || err?.error || '할일 추가에 실패했습니다.';
      console.error('❌ 할일 추가 오류:', err);
      
      // 에러 로그 업데이트
      setRequestLog(prev => ({
        ...prev,
        responseData: { error: errorMessage, details: err },
        success: false,
        timestamp: new Date().toLocaleString('ko-KR')
      }));

      // MongoDB 저장 실패 메시지 표시
      setMongoSaveStatus({
        show: true,
        success: false,
        message: '❌ MongoDB에 데이터 저장 실패: ' + errorMessage,
        todoId: null,
        timestamp: new Date().toLocaleString('ko-KR')
      });

      // 5초 후 자동으로 숨김
      setTimeout(() => {
        setMongoSaveStatus(prev => ({ ...prev, show: false }));
      }, 5000);

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 할일 수정 시작
  const handleEditStart = (todo) => {
    setEditingId(todo._id);
    setFormData({
      title: todo.title,
      description: todo.description || ''
    });
  };

  // 할일 수정 취소
  const handleEditCancel = () => {
    setEditingId(null);
    setFormData({ title: '', description: '' });
  };

  // 할일 수정 완료
  const handleUpdate = async (id) => {
    if (!formData.title.trim()) {
      alert('할일 제목을 입력해주세요.');
      return;
    }

    const requestData = { id, ...formData };
    setLoading(true);
    setError(null);

    // 요청 로그 초기화
    setRequestLog({
      show: true,
      type: 'update',
      requestData: requestData,
      responseData: null,
      timestamp: new Date().toLocaleString('ko-KR'),
      success: null
    });

    console.log('📤 백엔드로 전송하는 데이터 (수정):', requestData);

    try {
      const response = await updateTodo(id, formData);
      console.log('📥 백엔드에서 받은 응답 (수정):', response);

      // 응답 로그 업데이트
      setRequestLog(prev => ({
        ...prev,
        responseData: response,
        success: true,
        timestamp: new Date().toLocaleString('ko-KR')
      }));

      // MongoDB 저장 성공 확인
      const savedData = response?.data || response;
      const isMongoSuccess = (response?.success && savedData?._id) || savedData?._id;

      if (isMongoSuccess) {
        // MongoDB 저장 성공 메시지 표시
        setMongoSaveStatus({
          show: true,
          success: true,
          message: '✅ MongoDB Compass에 데이터가 정상적으로 수정되었습니다!',
          todoId: savedData._id,
          timestamp: new Date().toLocaleString('ko-KR')
        });

        // 5초 후 자동으로 숨김
        setTimeout(() => {
          setMongoSaveStatus(prev => ({ ...prev, show: false }));
        }, 5000);
      }

      if (response && (response.success || response._id)) {
        setEditingId(null);
        setFormData({ title: '', description: '' });
        fetchTodos();
      } else {
        setEditingId(null);
        setFormData({ title: '', description: '' });
        fetchTodos();
      }
    } catch (err) {
      const errorMessage = err?.message || err?.error || '할일 수정에 실패했습니다.';
      console.error('❌ 할일 수정 오류:', err);

      // 에러 로그 업데이트
      setRequestLog(prev => ({
        ...prev,
        responseData: { error: errorMessage, details: err },
        success: false,
        timestamp: new Date().toLocaleString('ko-KR')
      }));

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 할일 삭제
  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) {
      return;
    }

    setLoading(true);
    setError(null);

    // 요청 로그 초기화
    setRequestLog({
      show: true,
      type: 'delete',
      requestData: { id },
      responseData: null,
      timestamp: new Date().toLocaleString('ko-KR'),
      success: null
    });

    console.log('📤 백엔드로 전송하는 데이터 (삭제):', { id });

    try {
      const response = await deleteTodo(id);
      console.log('📥 백엔드에서 받은 응답 (삭제):', response);

      // 응답 로그 업데이트
      setRequestLog(prev => ({
        ...prev,
        responseData: response,
        success: true,
        timestamp: new Date().toLocaleString('ko-KR')
      }));

      // MongoDB 삭제 성공 확인
      const deletedData = response?.data || response;
      const isMongoSuccess = response?.success || deletedData?._id;

      if (isMongoSuccess) {
        // MongoDB 삭제 성공 메시지 표시
        setMongoSaveStatus({
          show: true,
          success: true,
          message: '✅ MongoDB Compass에서 데이터가 정상적으로 삭제되었습니다!',
          todoId: deletedData?._id || id,
          timestamp: new Date().toLocaleString('ko-KR')
        });

        // 5초 후 자동으로 숨김
        setTimeout(() => {
          setMongoSaveStatus(prev => ({ ...prev, show: false }));
        }, 5000);
      }

      // 삭제 성공 여부와 관계없이 목록 새로고침
      fetchTodos();
    } catch (err) {
      const errorMessage = err?.message || err?.error || '할일 삭제에 실패했습니다.';
      console.error('❌ 할일 삭제 오류:', err);

      // 에러 로그 업데이트
      setRequestLog(prev => ({
        ...prev,
        responseData: { error: errorMessage, details: err },
        success: false,
        timestamp: new Date().toLocaleString('ko-KR')
      }));

      setError(errorMessage);
      // 에러가 발생해도 목록 새로고침 시도
      fetchTodos();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <div className="container">
        <div className="header-section">
          <h1>할일 관리</h1>
          <div className="header-actions">
            <button 
              className="btn btn-check-connection" 
              onClick={checkBackendConnection}
              disabled={connectionStatus.checking}
              title="연결 상태 확인"
            >
              {connectionStatus.checking ? '⏳ 확인 중...' : '🔌 연결 확인'}
            </button>
            <button 
              className="btn btn-refresh" 
              onClick={fetchTodos}
              disabled={loading}
              title="새로고침"
            >
              🔄 새로고침
            </button>
          </div>
        </div>

        {/* 백엔드 연결 상태 표시 */}
        <div className={`connection-status ${connectionStatus.connected === true ? 'connected' : connectionStatus.connected === false ? 'disconnected' : ''}`}>
          <div className="connection-status-header">
            <span className="connection-indicator">
              {connectionStatus.connected === true ? (
                <span className="status-dot connected-dot">🟢</span>
              ) : connectionStatus.connected === false ? (
                <span className="status-dot disconnected-dot">🔴</span>
              ) : (
                <span className="status-dot unknown-dot">⚪</span>
              )}
              <strong>
                {connectionStatus.connected === true 
                  ? '백엔드 연결됨' 
                  : connectionStatus.connected === false 
                  ? '백엔드 연결 안됨' 
                  : '연결 상태 확인 중...'}
              </strong>
            </span>
            {connectionStatus.url && (
              <span className="connection-url" title="백엔드 URL">
                {connectionStatus.url}
              </span>
            )}
          </div>
          {connectionStatus.connected === true && connectionStatus.responseTime && (
            <div className="connection-details">
              응답 시간: {connectionStatus.responseTime}ms
              {connectionStatus.lastChecked && (
                <span> | 마지막 확인: {connectionStatus.lastChecked}</span>
              )}
            </div>
          )}
          {connectionStatus.connected === false && connectionStatus.error && (
            <div className="connection-details error">
              오류: {connectionStatus.error}
              {connectionStatus.lastChecked && (
                <span> | 마지막 확인: {connectionStatus.lastChecked}</span>
              )}
            </div>
          )}
        </div>
        
        {error && (
          <div className="error-message">
            <strong>⚠️ 오류:</strong> {error}
          </div>
        )}

        {/* MongoDB 저장 상태 표시 */}
        {mongoSaveStatus.show && (
          <div className={`mongo-save-status ${mongoSaveStatus.success ? 'success' : 'error'}`}>
            <div className="mongo-save-header">
              <strong>{mongoSaveStatus.message}</strong>
              <button 
                className="btn-close-mongo-status" 
                onClick={() => setMongoSaveStatus(prev => ({ ...prev, show: false }))}
                title="닫기"
              >
                ✕
              </button>
            </div>
            {mongoSaveStatus.success && mongoSaveStatus.todoId && (
              <div className="mongo-save-details">
                <p>📝 MongoDB ID: <code>{mongoSaveStatus.todoId}</code></p>
                <p>⏰ 저장 시간: {mongoSaveStatus.timestamp}</p>
                <p>💾 데이터베이스: <code>test</code> | 컬렉션: <code>todos</code></p>
                <p className="mongo-success-note">✅ MongoDB Compass에서 확인하실 수 있습니다!</p>
              </div>
            )}
          </div>
        )}

        {/* 백엔드 요청/응답 로그 */}
        {requestLog.show && (
          <div className={`request-log ${requestLog.success === true ? 'success' : requestLog.success === false ? 'error' : 'pending'}`}>
            <div className="request-log-header">
              <strong>
                {requestLog.type === 'create' && '➕ 할일 추가'}
                {requestLog.type === 'update' && '✏️ 할일 수정'}
                {requestLog.type === 'delete' && '🗑️ 할일 삭제'}
                {' - '}
                {requestLog.success === null && '⏳ 전송 중...'}
                {requestLog.success === true && '✅ 성공'}
                {requestLog.success === false && '❌ 실패'}
              </strong>
              <button 
                className="btn-close-log" 
                onClick={() => setRequestLog(prev => ({ ...prev, show: false }))}
                title="닫기"
              >
                ✕
              </button>
            </div>
            <div className="request-log-content">
              <div className="log-section">
                <strong>📤 백엔드로 전송한 데이터:</strong>
                <pre className="log-data">{JSON.stringify(requestLog.requestData, null, 2)}</pre>
              </div>
              {requestLog.responseData && (
                <div className="log-section">
                  <strong>📥 백엔드에서 받은 응답:</strong>
                  <pre className="log-data">{JSON.stringify(requestLog.responseData, null, 2)}</pre>
                </div>
              )}
              {requestLog.timestamp && (
                <div className="log-timestamp">
                  <small>시간: {requestLog.timestamp}</small>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 할일 추가/수정 폼 */}
        <form onSubmit={editingId ? (e) => { e.preventDefault(); handleUpdate(editingId); } : handleCreate} className="todo-form">
          <div className="form-group">
            <label htmlFor="title">할일 제목 *</label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="할일을 입력하세요"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="description">설명</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="상세 설명을 입력하세요 (선택사항)"
              rows="3"
              disabled={loading}
            />
          </div>
          <div className="form-actions">
            {editingId ? (
              <>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  수정 완료
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleEditCancel} disabled={loading}>
                  취소
                </button>
              </>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={loading}>
                추가
              </button>
            )}
          </div>
        </form>

        {/* 할일 목록 */}
        <div className="todos-section">
          <h2>할일 목록 {todos.length > 0 && `(${todos.length})`}</h2>
          
          {loading && !todos.length && (
            <div className="loading">
              <div className="loading-spinner"></div>
              <p>로딩 중...</p>
            </div>
          )}

          {!loading && todos.length === 0 && !error && (
            <div className="empty-state">
              <p>할일이 없습니다. 새로운 할일을 추가해보세요!</p>
            </div>
          )}

          {!loading && todos.length === 0 && error && (
            <div className="empty-state">
              <p>할일 목록을 불러올 수 없습니다.</p>
              <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>{error}</p>
            </div>
          )}

          {todos.length > 0 && (
            <div className="todos-list">
              {todos.map((todo) => {
                // todo 객체가 유효한지 확인
                if (!todo || !todo._id) {
                  console.warn('유효하지 않은 할일 항목:', todo);
                  return null;
                }
                
                return (
                  <div key={todo._id} className="todo-item">
                    {editingId === todo._id ? (
                      <div className="todo-edit">
                        <div className="todo-content">
                          <h3>{todo.title || '제목 없음'}</h3>
                          {todo.description && <p>{todo.description}</p>}
                          {todo.createdAt && (
                            <small className="todo-date">
                              생성일: {new Date(todo.createdAt).toLocaleString('ko-KR')}
                            </small>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="todo-content">
                          <h3>{todo.title || '제목 없음'}</h3>
                          {todo.description && <p>{todo.description}</p>}
                          {todo.createdAt && (
                            <small className="todo-date">
                              생성일: {new Date(todo.createdAt).toLocaleString('ko-KR')}
                            </small>
                          )}
                        </div>
                        <div className="todo-actions">
                          <button
                            className="btn btn-edit"
                            onClick={() => handleEditStart(todo)}
                            disabled={loading}
                          >
                            수정
                          </button>
                          <button
                            className="btn btn-delete"
                            onClick={() => handleDelete(todo._id)}
                            disabled={loading}
                          >
                            삭제
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
