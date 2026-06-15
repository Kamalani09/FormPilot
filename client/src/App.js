import { useState, useEffect, useRef } from 'react';
import './App.css';

const API = 'http://localhost:5000';

function App() {
  const [profile, setProfile] = useState(null);
  const [url, setUrl] = useState('https://job-boards.greenhouse.io/thinkingmachines/jobs/5111543008');
  const [fields, setFields] = useState([]);
  const [messages, setMessages] = useState([]);
  const [instruction, setInstruction] = useState('');
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [uploading, setUploading] = useState(false);
  const chatEndRef = useRef(null);

  // Connect to SSE stream
  useEffect(() => {
    const es = new EventSource(`${API}/stream`);
    es.onmessage = (e) => {
      const event = JSON.parse(e.data);

      if (event.type === 'field_start') {
        setFields(prev => prev.map((f, i) =>
          i === event.index ? { ...f, status: 'active' } : f
        ));
      }
      if (event.type === 'field_done') {
        setFields(prev => prev.map((f, i) =>
          i === event.index ? { ...f, status: event.value === 'skipped' ? 'skipped' : 'done', value: event.value } : f
        ));
      }
      if (event.type === 'progress') {
        setProgress({ done: event.done, total: event.total });
      }
      if (event.type === 'paused') setStatus('paused');
      if (event.type === 'resumed') setStatus('running');
      if (event.type === 'cancelled') setStatus('cancelled');
      if (event.type === 'complete') setStatus('complete');
      if (event.type === 'agent_message') {
        setMessages(prev => [...prev, { from: 'agent', text: event.text }]);
      }
    };
    es.onerror = () => {
      // SSE connection error — silently ignore, it will retry
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setMessages([{ from: 'agent', text: '📄 Reading your resume, please wait...' }]);

    try {
      const form = new FormData();
      form.append('resume', file);

      const res = await fetch(`${API}/upload`, { method: 'POST', body: form });
      const data = await res.json();

      // Check for server-side error
      if (!res.ok || data.error) {
        setMessages([{ from: 'agent', text: `❌ Error: ${data.error || 'Upload failed. Please try again.'}` }]);
        return;
      }

      // Check profile exists and is valid
      if (!data.profile || typeof data.profile !== 'object') {
        setMessages([{ from: 'agent', text: '❌ Could not parse resume. Make sure it is a text-based PDF (not a scanned image).' }]);
        return;
      }

      setProfile(data.profile);

      const name = data.profile.firstName || data.profile.lastName || 'there';
      setMessages([{ from: 'agent', text: `✅ Resume loaded! Hi ${name} 👋 Now enter the form URL and click Start.` }]);

    } catch (err) {
      setMessages([{ from: 'agent', text: `❌ Network error: ${err.message}. Is the server running on port 5000?` }]);
    } finally {
      setUploading(false);
    }
  }

  async function handleStart() {
    if (!url.trim()) {
      setMessages(prev => [...prev, { from: 'agent', text: '❌ Please enter a valid form URL.' }]);
      return;
    }

    try {
      setMessages(prev => [...prev, { from: 'agent', text: '🔍 Scraping form fields and building fill plan...' }]);

      const res = await fetch(`${API}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setMessages(prev => [...prev, { from: 'agent', text: `❌ Error: ${data.error || 'Could not start filling.'}` }]);
        return;
      }

      if (!data.fillPlan || !Array.isArray(data.fillPlan)) {
        setMessages(prev => [...prev, { from: 'agent', text: '❌ Could not build a fill plan for this form.' }]);
        return;
      }

      setFields(data.fillPlan.map(f => ({ ...f, status: 'queued' })));
      setProgress({ done: 0, total: data.fillPlan.length });
      setStatus('running');
      setMessages(prev => [...prev, { from: 'agent', text: `🚀 Starting to fill ${data.fillPlan.length} fields...` }]);

    } catch (err) {
      setMessages(prev => [...prev, { from: 'agent', text: `❌ Network error: ${err.message}` }]);
    }
  }

  async function handlePause() {
    try {
      await fetch(`${API}/pause`, { method: 'POST' });
      setStatus('paused');
      setMessages(prev => [...prev, { from: 'agent', text: '⏸ Paused. Type any instructions below and hit Resume when ready.' }]);
    } catch (err) {
      setMessages(prev => [...prev, { from: 'agent', text: `❌ Could not pause: ${err.message}` }]);
    }
  }

  async function handleResume() {
    try {
      await fetch(`${API}/resume`, { method: 'POST' });
      setStatus('running');
      setMessages(prev => [...prev, { from: 'agent', text: '▶ Resuming...' }]);
    } catch (err) {
      setMessages(prev => [...prev, { from: 'agent', text: `❌ Could not resume: ${err.message}` }]);
    }
  }

  async function handleCancel() {
    try {
      await fetch(`${API}/cancel`, { method: 'POST' });
      setStatus('cancelled');
      setMessages(prev => [...prev, { from: 'agent', text: '✖ Filling cancelled.' }]);
    } catch (err) {
      setMessages(prev => [...prev, { from: 'agent', text: `❌ Could not cancel: ${err.message}` }]);
    }
  }

  async function handleInstruct() {
    if (!instruction.trim()) return;

    const userMsg = instruction.trim();
    setMessages(prev => [...prev, { from: 'user', text: userMsg }]);
    setInstruction('');

    try {
      const res = await fetch(`${API}/instruct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setMessages(prev => [...prev, { from: 'agent', text: `❌ Could not apply instruction: ${data.error}` }]);
      }
      // Agent reply comes via SSE agent_message event, no need to set here

    } catch (err) {
      setMessages(prev => [...prev, { from: 'agent', text: `❌ Network error: ${err.message}` }]);
    }
  }

  const statusIcon = { queued: '⏳', active: '🔵', done: '✅', skipped: '⏭', error: '❌' };
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="app">
      {/* LEFT: Chat Panel */}
      <div className="chat-panel">
        <h2>FormPilot 🤖</h2>

        {!profile && (
          <div className="upload-area">
            <p>Upload your resume PDF to get started</p>
            <input
              type="file"
              accept=".pdf"
              onChange={handleUpload}
              disabled={uploading}
            />
            {uploading && <p className="uploading-text">⏳ Parsing resume...</p>}
          </div>
        )}

        {profile && status === 'idle' && (
          <div className="start-area">
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Form URL"
              className="url-input"
            />
            <button onClick={handleStart} className="btn btn-green">▶ Start Filling</button>
          </div>
        )}

        <div className="messages">
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.from}`}>
              <span>{m.from === 'agent' ? '🤖' : '👤'} {m.text}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {status === 'paused' && (
          <div className="instruct-area">
            <input
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInstruct()}
              placeholder="Type an instruction..."
              className="instruct-input"
            />
            <button onClick={handleInstruct} className="btn btn-blue">Send</button>
          </div>
        )}
      </div>

      {/* RIGHT: Form Progress Panel */}
      <div className="form-panel">
        <div className="controls">
          {status === 'running' && <button onClick={handlePause} className="btn btn-yellow">⏸ Pause</button>}
          {status === 'paused' && <button onClick={handleResume} className="btn btn-green">▶ Resume</button>}
          {(status === 'running' || status === 'paused') && (
            <button onClick={handleCancel} className="btn btn-red">✖ Cancel</button>
          )}
        </div>

        {progress.total > 0 && (
          <div className="progress-area">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <p>{progress.done} of {progress.total} fields — {pct}%</p>
          </div>
        )}

        <div className="fields-list">
          {fields.map((f, i) => (
            <div key={i} className={`field-row ${f.status}`}>
              <span className="field-icon">{statusIcon[f.status] || '⏳'}</span>
              <span className="field-label">{f.fieldLabel}</span>
              <span className="field-value">{f.value || '—'}</span>
            </div>
          ))}
        </div>

        {fields.length === 0 && status === 'idle' && (
          <div className="empty-state">
            <p>Field progress will appear here once filling starts.</p>
          </div>
        )}

        {status === 'complete' && <div className="complete-msg">✅ Form filled successfully! Do NOT submit.</div>}
        {status === 'cancelled' && <div className="cancel-msg">❌ Filling was cancelled.</div>}
      </div>
    </div>
  );
}

export default App;