import { useState, useEffect } from 'react';

function App() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load messages from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('ollama-chat-history');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (err) {
        console.warn('Failed to load chat history:', err);
      }
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('ollama-chat-history', JSON.stringify(messages));
    }
  }, [messages]);

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem('ollama-chat-history');
  };

    event.preventDefault();
    if (!message.trim()) return;

    const userMessage = message.trim();
    const chatHistory = [
      ...messages,
      { role: 'user', content: userMessage },
    ];

    setMessages((current) => [...current, { role: 'user', content: userMessage }]);
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3',
          messages: chatHistory,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get a response');
      }

      const data = await response.json();
      const assistantText = data?.choices?.[0]?.message?.content || data?.response || 'No response received.';

      setMessages((current) => [
        ...current,
        { role: 'assistant', content: assistantText },
      ]);
    } catch (err) {
      setError(err.message || 'Unable to reach the backend');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <header>
        <h1>Ollama Chat</h1>
        {messages.length > 0 && (
          <button className="clear-button" onClick={clearHistory}>
            Clear History
          </button>
        )}
      </header>

      <main className="chat-window">
        <div className="messages">
          {messages.length === 0 ? (
            <p className="placeholder">Send a message to start the conversation.</p>
          ) : (
            messages.map((entry, index) => (
              <div key={index} className={`message ${entry.role}`}>
                <span className="role">{entry.role}</span>
                <p>{entry.content}</p>
              </div>
            ))
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}
        {loading && <div className="status-banner">Waiting for Ollama response...</div>}

        <form className="chat-form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
          />
          <button type="submit">Send</button>
        </form>
      </main>
    </div>
  );
}

export default App;
