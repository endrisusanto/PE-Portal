import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Bot, Send, X, Settings, Sparkles } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import api from '../../api/client';
import styles from './AppShell.module.css';

export const AppShell = () => {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Chat conversation state
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am your SEIN PE Engineering AI Assistant connected to LM Studio. How can I assist with JIG development, BOM, GBA tasks, or model developments today?',
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeModel, setActiveModel] = useState('google/gemma-4-e4b');
  const [activeProvider, setActiveProvider] = useState('LM Studio');

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isChatOpen) {
      api.get('/ai/config')
        .then((res) => {
          if (res.data?.config) {
            setActiveModel(res.data.config.model_name || 'google/gemma-4-e4b');
            setActiveProvider(res.data.config.name || 'LM Studio');
          }
        })
        .catch(() => {});
    }
  }, [isChatOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const text = inputVal.trim();
    if (!text || isSending) return;

    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInputVal('');
    setIsSending(true);

    try {
      const res = await api.post('/ai/chat', {
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.data.reply || 'No response returned.' },
      ]);
      if (res.data.model) setActiveModel(res.data.model);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'AI request failed.';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ Error: ${errorMsg}` },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={styles.layout}>
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleChat={() => setIsChatOpen((prev) => !prev)}
        onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
      />

      <div className={styles.mainContainer}>
        <TopBar />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>

      {/* Floating AI Engineering Assistant */}
      {isChatOpen && (
        <div className={styles.chatDrawer}>
          <div className={styles.chatHeader}>
            <div className={styles.chatHeaderTitle}>
              <Bot size={18} />
              <div>
                <h3>SEIN PE AI Assistant</h3>
                <div className={styles.chatHeaderModel}>
                  {activeProvider} • {activeModel}
                </div>
              </div>
            </div>

            <div className={styles.chatHeaderActions}>
              <button
                type="button"
                onClick={() => {
                  setIsChatOpen(false);
                  navigate('/settings');
                }}
                className={styles.chatClose}
                title="Configure LLM API Endpoint"
              >
                <Settings size={15} />
              </button>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                className={styles.chatClose}
                aria-label="Close Chat"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className={styles.chatMessages}>
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`${styles.messageRow} ${
                  m.role === 'user' ? styles.userRow : styles.assistantRow
                }`}
              >
                <span className={styles.messageSender}>
                  {m.role === 'user' ? 'You' : 'PE Assistant'}
                </span>
                <div
                  className={`${styles.messageBubble} ${
                    m.role === 'user' ? styles.userBubble : styles.assistantBubble
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {isSending && (
              <div className={`${styles.messageRow} ${styles.assistantRow}`}>
                <span className={styles.messageSender}>PE Assistant</span>
                <div className={`${styles.messageBubble} ${styles.assistantBubble}`}>
                  <em>Thinking with {activeModel}...</em>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className={styles.chatInputContainer}>
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Ask PE Assistant about BOM, JIG, GBA, S26..."
              className={styles.chatInput}
              disabled={isSending}
              autoFocus
            />
            <button
              type="submit"
              disabled={isSending || !inputVal.trim()}
              style={{
                height: '36px',
                width: '36px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-accent)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isSending || !inputVal.trim() ? 0.5 : 1,
              }}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
