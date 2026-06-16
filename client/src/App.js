import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
} from '@assistant-ui/react';
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  Circle,
  FileText,
  Loader2,
  Moon,
  Pause,
  Play,
  RefreshCw,
  Send,
  Square,
  Sun,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import './App.css';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Progress } from './components/ui/progress';
import { cn } from './lib/utils';

const API = 'http://localhost:5000';

const initialUrl = 'https://job-boards.greenhouse.io/thinkingmachines/jobs/5111543008';

const statusMeta = {
  idle: { label: 'Idle', variant: 'secondary' },
  running: { label: 'Running', variant: 'success' },
  paused: { label: 'Paused', variant: 'warning' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
  complete: { label: 'Complete', variant: 'success' },
};

const fieldMeta = {
  queued: { icon: Circle, label: 'Queued', className: 'text-muted-foreground' },
  active: { icon: Loader2, label: 'Active', className: 'animate-spin text-primary' },
  done: { icon: CheckCircle2, label: 'Done', className: 'text-emerald-600' },
  skipped: { icon: Square, label: 'Skipped', className: 'text-muted-foreground' },
  error: { icon: XCircle, label: 'Error', className: 'text-destructive' },
};

function textFromAssistantMessage(message) {
  if (!message?.content) return '';
  if (typeof message.content === 'string') return message.content;
  return message.content
    .map((part) => (part?.type === 'text' ? part.text : ''))
    .join('')
    .trim();
}

function AssistantChat({ messages, status, onSendInstruction }) {
  const assistantMessages = useMemo(
    () =>
      messages.map((message, index) => ({
        id: `formpilot-${index}`,
        role: message.from === 'user' ? 'user' : 'assistant',
        content: [{ type: 'text', text: message.text }],
        createdAt: new Date(),
        metadata: {
          unstable_state: null,
          unstable_annotations: [],
          unstable_data: [],
          steps: [],
          custom: {},
        },
        attachments: [],
        status: { type: 'complete', reason: 'stop' },
      })),
    [messages]
  );

  const runtime = useExternalStoreRuntime({
    messages: assistantMessages,
    isRunning: status === 'running',
    isSendDisabled: status !== 'paused',
    onNew: async (message) => {
      const text = textFromAssistantMessage(message);
      if (!text) return;
      await onSendInstruction(text);
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col">
        <ThreadPrimitive.Viewport className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <ThreadPrimitive.Empty>
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <div className="rounded-full border border-border bg-muted p-3">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <p className="max-w-sm text-sm">
                Upload a resume, start a form fill, and pause whenever you need to give FormPilot extra instructions.
              </p>
            </div>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
          <ThreadPrimitive.ViewportFooter />
        </ThreadPrimitive.Viewport>

        <ComposerPrimitive.Root className="border-t border-border bg-card p-4">
          <div className="flex items-end gap-2 rounded-lg border border-input bg-background p-2 transition focus-within:ring-2 focus-within:ring-ring">
            <ComposerPrimitive.Input
              placeholder={status === 'paused' ? 'Add missing info or override a field...' : 'Pause filling to send instructions'}
              className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <ComposerPrimitive.Send asChild>
              <Button size="icon" disabled={status !== 'paused'} aria-label="Send instruction">
                <Send className="h-4 w-4" />
              </Button>
            </ComposerPrimitive.Send>
          </div>
        </ComposerPrimitive.Root>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[82%] rounded-lg bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground shadow-sm">
        <MessagePrimitive.Content components={{ Text: MessagePartPrimitive.Text }} />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-start gap-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="max-w-[86%] rounded-lg border border-border bg-card px-4 py-3 text-sm leading-6 shadow-sm">
        <MessagePrimitive.Content components={{ Text: MessagePartPrimitive.Text }} />
      </div>
    </MessagePrimitive.Root>
  );
}

function App() {
  const [profile, setProfile] = useState(null);
  const [url, setUrl] = useState(initialUrl);
  const [fields, setFields] = useState([]);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [darkMode, setDarkMode] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const fileInputRef = useRef(null);

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const completedFields = fields.filter((field) => field.status === 'done').length;
  const skippedFields = fields.filter((field) => field.status === 'skipped').length;
  const activeField = fields.find((field) => field.status === 'active');
  const currentStatus = statusMeta[status] || statusMeta.idle;

  const pushAgentMessage = useCallback((text) => {
    setMessages((prev) => [...prev, { from: 'agent', text }]);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    const es = new EventSource(`${API}/stream`);
    es.onmessage = (e) => {
      const event = JSON.parse(e.data);

      if (event.type === 'field_start') {
        setFields((prev) =>
          prev.map((field, index) => (index === event.index ? { ...field, status: 'active' } : field))
        );
      }
      if (event.type === 'field_done') {
        setFields((prev) =>
          prev.map((field, index) =>
            index === event.index
              ? { ...field, status: event.value === 'skipped' ? 'skipped' : 'done', value: event.value }
              : field
          )
        );
      }
      if (event.type === 'progress') setProgress({ done: event.done, total: event.total });
      if (event.type === 'paused') {
        setStatus('paused');
        toast.info('Form filling paused');
      }
      if (event.type === 'resumed') {
        setStatus('running');
        toast.info('Form filling resumed');
      }
      if (event.type === 'cancelled') {
        setStatus('cancelled');
        toast.error('Form filling cancelled');
      }
      if (event.type === 'complete') {
        setStatus('complete');
        toast.success('Form filled successfully. Do not submit until reviewed.');
      }
      if (event.type === 'agent_message') {
        setMessages((prev) => [...prev, { from: 'agent', text: event.text }]);
      }
    };
    es.onerror = () => {};
    return () => es.close();
  }, []);

  async function uploadResume(file) {
    if (!file) return;
    if (file.type && file.type !== 'application/pdf') {
      toast.error('Please upload a PDF resume');
      return;
    }

    setUploading(true);
    setMessages([{ from: 'agent', text: 'Reading your resume. I will pull out the details needed for the form.' }]);

    try {
      const form = new FormData();
      form.append('resume', file);

      const res = await fetch(`${API}/upload`, { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok || data.error) {
        const message = data.error || 'Upload failed. Please try again.';
        setMessages([{ from: 'agent', text: `Error: ${message}` }]);
        toast.error(message);
        return;
      }

      if (!data.profile || typeof data.profile !== 'object') {
        const message = 'Could not parse resume. Make sure it is a text-based PDF, not a scanned image.';
        setMessages([{ from: 'agent', text: message }]);
        toast.error(message);
        return;
      }

      setProfile(data.profile);
      const name = data.profile.firstName || data.profile.lastName || 'there';
      setMessages([{ from: 'agent', text: `Resume loaded. Hi ${name}. Enter the form URL and click Start.` }]);
      toast.success('Resume parsed successfully');
    } catch (err) {
      const message = `Network error: ${err.message}. Is the server running on port 5000?`;
      setMessages([{ from: 'agent', text: message }]);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  async function handleStart() {
    if (!url.trim()) {
      pushAgentMessage('Please enter a valid form URL.');
      toast.error('Form URL is required');
      return;
    }

    try {
      setStarting(true);
      pushAgentMessage('Scraping form fields and building the fill plan.');

      const res = await fetch(`${API}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        const message = data.error || 'Could not start filling.';
        pushAgentMessage(`Error: ${message}`);
        toast.error(message);
        return;
      }

      if (!data.fillPlan || !Array.isArray(data.fillPlan)) {
        const message = 'Could not build a fill plan for this form.';
        pushAgentMessage(message);
        toast.error(message);
        return;
      }

      setFields(data.fillPlan.map((field) => ({ ...field, status: 'queued' })));
      setProgress({ done: 0, total: data.fillPlan.length });
      setStatus('running');
      pushAgentMessage(`Starting to fill ${data.fillPlan.length} fields.`);
      toast.success('Fill plan generated');
    } catch (err) {
      const message = `Network error: ${err.message}`;
      pushAgentMessage(message);
      toast.error(message);
    } finally {
      setStarting(false);
    }
  }

  async function handlePause() {
    try {
      await fetch(`${API}/pause`, { method: 'POST' });
      setStatus('paused');
      pushAgentMessage('Paused. Send any missing details or field overrides, then resume when ready.');
    } catch (err) {
      pushAgentMessage(`Could not pause: ${err.message}`);
      toast.error('Could not pause');
    }
  }

  async function handleResume() {
    try {
      await fetch(`${API}/resume`, { method: 'POST' });
      setStatus('running');
      pushAgentMessage('Resuming.');
    } catch (err) {
      pushAgentMessage(`Could not resume: ${err.message}`);
      toast.error('Could not resume');
    }
  }

  async function handleCancel() {
    try {
      await fetch(`${API}/cancel`, { method: 'POST' });
      setStatus('cancelled');
      pushAgentMessage('Filling cancelled.');
    } catch (err) {
      pushAgentMessage(`Could not cancel: ${err.message}`);
      toast.error('Could not cancel');
    }
  }

  const handleInstruct = useCallback(async (userMsg) => {
    if (!userMsg.trim()) return;

    setMessages((prev) => [...prev, { from: 'user', text: userMsg }]);

    try {
      const res = await fetch(`${API}/instruct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setMessages((prev) => [...prev, { from: 'agent', text: `Could not apply instruction: ${data.error}` }]);
        toast.error('Instruction was not applied');
      } else {
        toast.success('Instruction queued');
      }
    } catch (err) {
      setMessages((prev) => [...prev, { from: 'agent', text: `Network error: ${err.message}` }]);
      toast.error('Instruction failed');
    }
  }, []);

  function handleFileChange(e) {
    uploadResume(e.target.files?.[0]);
    e.target.value = '';
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    uploadResume(e.dataTransfer.files?.[0]);
  }

  const timeline = useMemo(() => {
    const items = [];
    if (profile) items.push({ title: 'Resume parsed', detail: 'Candidate profile is ready.' });
    if (fields.length) items.push({ title: 'Fill plan created', detail: `${fields.length} fields prepared.` });
    if (activeField) items.push({ title: 'Currently filling', detail: activeField.fieldLabel });
    if (status === 'paused') items.push({ title: 'Waiting for instruction', detail: 'Resume when the updates are ready.' });
    if (status === 'complete') items.push({ title: 'Automation complete', detail: 'Review the form before submitting.' });
    if (status === 'cancelled') items.push({ title: 'Automation cancelled', detail: 'No more fields will be filled.' });
    return items.length ? items : [{ title: 'Ready', detail: 'Upload a resume to begin.' }];
  }, [activeField, fields.length, profile, status]);

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header className="border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 lg:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-normal">FormPilot</h1>
                  <p className="text-sm text-muted-foreground">AI-assisted form filling workspace</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={currentStatus.variant}>{currentStatus.label}</Badge>
              <Button variant="outline" size="icon" onClick={() => setDarkMode((value) => !value)} aria-label="Toggle dark mode">
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
            <Progress value={pct} />
            <span className="text-sm font-medium text-muted-foreground">
              {progress.total ? `${progress.done}/${progress.total} fields - ${pct}%` : 'No active run'}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 lg:h-[calc(100vh-138px)] lg:grid-cols-[320px_minmax(420px,1fr)_360px] lg:px-6">
        <section className="flex min-h-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Setup</CardTitle>
              <CardDescription>Resume, target form, and run controls.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={cn(
                  'rounded-lg border border-dashed border-border bg-muted/50 p-5 text-center transition',
                  dragActive && 'border-primary bg-primary/10'
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
              >
                <UploadCloud className="mx-auto mb-3 h-8 w-8 text-primary" />
                <p className="text-sm font-medium">{profile ? 'Resume loaded' : 'Drop resume PDF here'}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Candidate profile ready' : 'PDF only'}
                </p>
                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  {uploading ? 'Parsing resume' : 'Choose resume'}
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="form-url">
                  Form URL
                </label>
                <Input
                  id="form-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://company.com/jobs/application"
                  disabled={!profile || status === 'running'}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button onClick={handleStart} disabled={!profile || status === 'running' || uploading || starting} className="col-span-2">
                  {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Start
                </Button>
                <Button variant="warning" onClick={handlePause} disabled={status !== 'running'}>
                  <Pause className="h-4 w-4" />
                  Pause
                </Button>
                <Button variant="success" onClick={handleResume} disabled={status !== 'paused'}>
                  <RefreshCw className="h-4 w-4" />
                  Resume
                </Button>
                <Button variant="destructive" onClick={handleCancel} disabled={status !== 'running' && status !== 'paused'} className="col-span-2">
                  <XCircle className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>

          {status === 'paused' && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              <AlertCircle className="mb-2 h-4 w-4" />
              <AlertTitle>Paused for input</AlertTitle>
              <AlertDescription>Use the assistant composer to provide missing details or override field values.</AlertDescription>
            </Alert>
          )}
        </section>

        <section className="min-h-[620px] overflow-hidden rounded-lg border border-border bg-card shadow-soft lg:min-h-0">
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Assistant</h2>
                  <p className="text-sm text-muted-foreground">Missing-field conversation and run instructions.</p>
                </div>
                {status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </div>
            </div>
            <AssistantChat messages={messages} status={status} onSendInstruction={handleInstruct} />
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-4">
          <Card className="min-h-0 lg:flex-1">
            <CardHeader>
              <CardTitle>Field Progress</CardTitle>
              <CardDescription>{completedFields} complete, {skippedFields} skipped</CardDescription>
            </CardHeader>
            <CardContent className="min-h-0">
              <div className="scrollbar-thin max-h-[360px] space-y-2 overflow-y-auto pr-1 lg:max-h-[calc(100vh-390px)]">
                {fields.length ? (
                  fields.map((field, index) => {
                    const meta = fieldMeta[field.status] || fieldMeta.queued;
                    const Icon = meta.icon;
                    return (
                      <div key={`${field.fieldLabel}-${index}`} className="rounded-lg border border-border bg-background p-3 transition hover:border-primary/40">
                        <div className="flex items-start gap-3">
                          <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.className)} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{field.fieldLabel}</p>
                            <p className="truncate text-xs text-muted-foreground">{field.value || meta.label}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Field progress will appear once a fill plan is generated.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Timeline and current form status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {timeline.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="flex gap-3">
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Activity className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">Current form status</p>
                <p className="mt-1 text-sm">
                  {activeField ? `Filling ${activeField.fieldLabel}` : status === 'idle' ? 'Waiting to start' : currentStatus.label}
                </p>
              </div>

              {status === 'complete' && (
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                  <CheckCircle2 className="mb-2 h-4 w-4" />
                  <AlertTitle>Filled successfully</AlertTitle>
                  <AlertDescription>Review the browser form before submitting.</AlertDescription>
                </Alert>
              )}

              {status === 'cancelled' && (
                <Alert variant="destructive">
                  <AlertCircle className="mb-2 h-4 w-4" />
                  <AlertTitle>Run cancelled</AlertTitle>
                  <AlertDescription>The current automation run has stopped.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

export default App;
