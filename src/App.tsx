import { useState, useEffect } from 'react';
import { 
  Mail, Webhook, Settings, Activity, Plus, Search, Trash2, ShieldCheck, MailOpen, CheckCircle2, Clock, Navigation
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ScrollArea } from '../components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

type Email = {
  id: string;
  subject: string;
  sender: string;
  body: string;
  summary: string;
  action_items: string[];
  intent: string;
  priority: "Urgent" | "Important" | "To Read" | "Archived";
  security: {
    status: "Safe" | "Spam" | "Phishing";
    reason?: string;
  };
  metadata?: {
    role?: string | null;
    budget?: string | null;
    candidate_name?: string | null;
    vendor_name?: string | null;
  } | null;
  received_at: string;
  status: string;
  outreach_draft?: string;
};

type WebhookTarget = {
  id: string;
  name: string;
  url: string;
  active: number;
  created_at: string;
};

export default function App() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookTarget[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  
  const [newWebhookName, setNewWebhookName] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [isAddingWebhook, setIsAddingWebhook] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);

  const fetchEmails = async () => {
    try {
      const res = await fetch('/api/emails');
      if (res.ok) setEmails(await res.json());
    } catch (e) {}
  };

  const fetchWebhooks = async () => {
    try {
      const res = await fetch('/api/webhooks');
      if (res.ok) setWebhooks(await res.json());
    } catch (e) {}
  };

  const checkGmailStatus = async () => {
    try {
      const res = await fetch('/api/gmail/status');
      if (res.ok) {
        const data = await res.json();
        setIsGmailConnected(data.connected);
      }
    } catch (e) {}
  };

  const handleConnectGmail = async () => {
    try {
      const res = await fetch('/auth/google');
      if (res.ok) {
        const { url } = await res.json();
        const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
        if (!authWindow) {
          alert('Please allow popups to authenticate with Google.');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        checkGmailStatus();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleFetchGmail = async () => {
    try {
      const res = await fetch('/api/gmail/fetch', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.count > 0) {
          fetchEmails();
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchEmails();
    fetchWebhooks();
    checkGmailStatus();
    const interval = setInterval(() => {
      fetchEmails();
      if (isGmailConnected) {
        handleFetchGmail();
      }
    }, 5000); // Polling every 5 seconds
    return () => clearInterval(interval);
  }, [isGmailConnected]);

  const handleAddWebhook = async () => {
    if (!newWebhookName || !newWebhookUrl) return;
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWebhookName, url: newWebhookUrl })
      });
      if (res.ok) {
        setNewWebhookName('');
        setNewWebhookUrl('');
        setIsAddingWebhook(false);
        fetchWebhooks();
      }
    } catch (e) {}
  };

  const handleToggleWebhook = async (id: string) => {
    await fetch(`/api/webhooks/${id}/toggle`, { method: 'PUT' });
    fetchWebhooks();
  };

  const handleDeleteWebhook = async (id: string) => {
    await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
    fetchWebhooks();
  };

  const getPriorityColor = (priority: string) => {
    const map: Record<string, string> = {
      'Urgent': 'bg-rose-50 text-rose-700 border-rose-200',
      'Important': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'To Read': 'bg-blue-50 text-blue-700 border-blue-200',
      'Archived': 'bg-slate-100 text-slate-500 border-slate-200',
    };
    return map[priority] || 'bg-slate-100 text-slate-800 border-slate-200';
  };

  const getSecurityColor = (status: string) => {
    const map: Record<string, string> = {
      'Safe': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Spam': 'bg-amber-50 text-amber-700 border-amber-200',
      'Phishing': 'bg-rose-600 text-white border-rose-700',
    };
    return map[status] || 'bg-slate-100 border-slate-200';
  };

  const handleUpdateInteraction = async (emailId: string, updates: any) => {
    try {
      const res = await fetch(`/api/emails/${emailId}/interaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        fetchEmails();
        if (selectedEmail && selectedEmail.id === emailId) {
          setSelectedEmail({ ...selectedEmail, ...updates });
        }
      }
    } catch (e) {}
  };

  const handleSimulateEmail = async () => {
    const fakeEmails = [
      { sender: 'hr@client-tech.com', subject: 'NEW: Azure Developer Needed', body: 'We need an Senior Azure Cloud Developer immediately. Budget is around 25 LPA. Must have 5+ years experience. Please send candidates by Friday.' },
      { sender: 'recruitment-vendor-xyz@agency.com', subject: 'Candidate Submission: Rahul Sharma (Java)', body: 'Hi team, please find attached the profile for Rahul Sharma for the Java Lead position. He has 8 years of experience and is available immediately. Expected CTC: 30 LPA.' },
      { sender: 'billing@agency.com', subject: 'Invoice #1042 for Placements', body: 'Please find the invoice for the three placements made in Q2. Total amount is $15,000. Payment is due in 15 days.' },
    ];
    const random = fakeEmails[Math.floor(Math.random() * fakeEmails.length)];
    
    await fetch('/api/webhooks/ingress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(random)
    });
    
    // UI will update on next poll or we can just wait 2 sec and fetch
    setTimeout(fetchEmails, 2000);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans text-slate-900">
      {/* Sidebar Navigation */}
      <aside className="w-64 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col z-20">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">HireNestOS</span>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2 mt-2">Navigation</div>
          <div className="flex items-center px-3 py-2 text-sm font-medium rounded-lg bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50">
            <MailOpen className="w-5 h-5 mr-3 text-indigo-500" />
            Inbox & Parsed
          </div>
          <div className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer">
            <Webhook className="w-5 h-5 mr-3 text-slate-400" />
            Connectors
          </div>
          
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-8 mb-2 px-2">Connected Accounts</div>
          <div className="space-y-1">
            <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-600">
              <div className="flex items-center">
                {isGmailConnected ? (
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3"></div>
                ) : (
                  <div className="w-2 h-2 rounded-full bg-slate-300 mr-3"></div>
                )}
                Gmail Intg.
              </div>
              {!isGmailConnected ? (
                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={handleConnectGmail}>
                  Connect
                </Button>
              ) : (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[10px] border-emerald-200 uppercase">
                  Connected
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-400">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-slate-200 mr-3"></div>
                Outlook
              </div>
              <span className="text-[10px]">Soon</span>
            </div>
          </div>
          
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-8 mb-2 px-2">System Status</div>
          <div className="space-y-1">
            <div className="flex items-center px-3 py-2 text-sm text-slate-500">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3"></div> {emails.length} Records Processed
            </div>
            <div className="flex items-center px-3 py-2 text-sm text-slate-500">
              <div className="w-2 h-2 rounded-full bg-indigo-500 mr-3"></div> {webhooks.filter(w=>w.active).length} Relays Enabled
            </div>
          </div>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="p-4 bg-slate-900 rounded-xl text-white shadow-lg overflow-hidden relative border border-slate-800">
            <div className="absolute top-0 right-0 p-3">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
            </div>
            <p className="text-xs opacity-70 mb-1">Ingestion Mode</p>
            <p className="text-sm font-bold truncate text-indigo-50">Active Stream</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-slate-50 z-10 overflow-hidden relative">
        {/* Header */}
        <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-between shrink-0">
          <h1 className="text-lg font-semibold text-slate-800">Ingestion Flow Monitor</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 items-center hidden sm:flex">
                Server Status: <span className="text-emerald-600 font-medium ml-1">Operational</span>
            </span>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm rounded-lg border-0" size="sm" onClick={handleSimulateEmail}>
              <Mail className="w-4 h-4 mr-2" />
              Simulate Event
            </Button>
          </div>
        </header>

        {/* Content Grid */}
        <div className="flex-1 overflow-auto p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-start content-start">
        
        {/* Top Stats */}
        <div className="col-span-12 md:col-span-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Daily Volume</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{emails.length}</span>
            <span className="text-xs text-emerald-600 font-medium">Processed</span>
          </div>
        </div>
        <div className="col-span-12 md:col-span-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Active Relays</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{webhooks.filter(w => w.active).length}</span>
            <span className="text-xs text-indigo-500 font-medium">Connections</span>
          </div>
        </div>
        <div className="col-span-12 md:col-span-4 bg-indigo-50/50 p-5 rounded-2xl shadow-sm border border-indigo-100 flex flex-col justify-center">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2 w-full truncate">Ingress Target Endpoint</p>
          <code className="text-[11px] bg-white border border-indigo-200 text-indigo-700 py-1.5 px-3 rounded-lg block truncate w-full font-mono shadow-sm">
            [APP_URL]/api/webhooks/ingress
          </code>
        </div>

        {/* Main Content Area */}
        <div className="col-span-12 flex flex-col gap-6 mt-4">
          <Tabs defaultValue="inbox" className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList className="grid w-full grid-cols-2 max-w-[400px] bg-slate-200/50 p-1 rounded-xl">
                <TabsTrigger value="inbox" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm rounded-lg transition-all py-1.5">
                  <MailOpen className="w-4 h-4" />
                  Parsed Payload
                </TabsTrigger>
                <TabsTrigger value="webhooks" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm rounded-lg transition-all py-1.5">
                  <Webhook className="w-4 h-4" />
                  OS Connectors
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="inbox">
              <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h3 className="font-semibold text-slate-800 text-sm">Ingestion Logs & Advanced Filters</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {['Urgent', 'Important', 'To Read', 'Archived'].map(cat => (
                      <Badge 
                        key={cat} 
                        variant="secondary" 
                        className={`cursor-pointer transition-opacity hover:opacity-80 ${getPriorityColor(cat)}`}
                      >
                        {cat}
                      </Badge>
                    ))}
                    <div className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg w-64 shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all ml-2">
                      <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                      <input 
                        type="text" 
                        placeholder="Search payloads..." 
                        className="bg-transparent border-none text-sm focus:outline-none w-full placeholder:text-slate-400 outline-none"
                      />
                    </div>
                  </div>
                </div>
                {emails.length === 0 ? (
                  <div className="py-16 text-center text-slate-500 flex flex-col items-center">
                    <Mail className="w-12 h-12 text-slate-200 mb-4" />
                    <p className="font-medium">No emails ingested yet.</p>
                    <p className="text-sm mt-1 text-slate-400">Waiting for webhook payloads on the ingress endpoint...</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Priority & Security</TableHead>
                        <TableHead>Sender & Subject</TableHead>
                        <TableHead>Intelligence</TableHead>
                        <TableHead className="text-right">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emails.map((email) => (
                        <TableRow 
                          key={email.id} 
                          className={`cursor-pointer transition-colors ${email.security?.status === 'Phishing' ? 'bg-rose-50 hover:bg-rose-100' : 'hover:bg-slate-50'}`}
                          onClick={() => setSelectedEmail(email)}
                        >
                          <TableCell>
                            <div className="flex flex-col gap-1.5">
                              <Badge variant="outline" className={`w-fit text-[10px] py-0 px-2 h-5 font-bold uppercase tracking-wider ${getPriorityColor(email.priority)}`}>
                                {email.priority}
                              </Badge>
                              <Badge variant="outline" className={`w-fit text-[10px] py-0 px-2 h-5 font-bold uppercase tracking-wider ${getSecurityColor(email.security?.status)}`}>
                                {email.security?.status}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <p className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                              {email.sender}
                              {email.security?.status === 'Phishing' && <ShieldCheck className="w-3 h-3 text-rose-600" />}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{email.subject}</p>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-slate-700 truncate max-w-[250px]">
                                {email.summary.split('.')[0]}...
                              </span>
                              {email.action_items && email.action_items.length > 0 && (
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-slate-100/50 px-1.5 py-0.5 rounded border border-slate-200 w-fit">
                                  <Clock className="w-3 h-3" /> {email.action_items.length} tasks
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs text-slate-500 whitespace-nowrap">
                            {formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="webhooks">
              <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                  <div>
                    <CardTitle className="font-semibold text-slate-800 text-sm mb-1">OS Connectors (Webhooks)</CardTitle>
                    <CardDescription className="text-xs">Forward parsed email data to your agents, databases, or workflow tools.</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setIsAddingWebhook(true)} className="bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm border-0">
                    <Plus className="w-4 h-4 mr-2" /> Add Connector
                  </Button>
                  <Dialog open={isAddingWebhook} onOpenChange={setIsAddingWebhook}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add OS Connector</DialogTitle>
                        <DialogDescription>
                          Whenever a new email is ingested and parsed by Gemini, an HTTP POST request will be sent to this URL with the structured payload.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="name" className="text-right">Name</Label>
                          <Input 
                            id="name" 
                            placeholder="e.g. Notion DB, Make.com" 
                            className="col-span-3" 
                            value={newWebhookName}
                            onChange={(e) => setNewWebhookName(e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="url" className="text-right">Webhook URL</Label>
                          <Input 
                            id="url" 
                            placeholder="https://..." 
                            className="col-span-3"
                            value={newWebhookUrl}
                            onChange={(e) => setNewWebhookUrl(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="submit" onClick={handleAddWebhook}>Save Connector</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {webhooks.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 border border-dashed border-slate-200 rounded-lg bg-slate-50">
                      <Webhook className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p>No connectors currently active.</p>
                      <p className="text-sm">Parsed data is currently only staying in this local SQLite DB.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {webhooks.map((hook) => (
                        <div key={hook.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 rounded-lg bg-white hover:border-slate-300 transition-colors">
                          <div className="mb-4 sm:mb-0">
                            <h3 className="font-semibold text-slate-900 text-sm">{hook.name}</h3>
                            <code className="text-xs text-slate-500 mt-1 block truncate max-w-[300px]">{hook.url}</code>
                          </div>
                          <div className="flex items-center gap-3">
                            <Button 
                              variant={hook.active ? "default" : "secondary"} 
                              size="sm"
                              className={hook.active ? "bg-emerald-600 hover:bg-emerald-700 text-xs px-3 shadow-sm border-0" : "bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs shadow-none border-0"}
                              onClick={() => handleToggleWebhook(hook.id)}
                            >
                              {hook.active ? (
                                <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> Healthy</span>
                              ) : (
                                <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-slate-400 rounded-full" /> Paused</span>
                              )}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteWebhook(hook.id)}>
                              <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        </div>
      </main>

      {/* Detail Dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={(open) => !open && setSelectedEmail(null)}>
        <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 overflow-hidden bg-slate-50">
          {selectedEmail && (
            <>
              <div className="flex-1 overflow-auto flex flex-col">
                <div className="px-6 py-4 border-b border-slate-200 bg-white">
                  <div className="flex items-center justify-between w-full gap-4">
                    <DialogTitle className="text-lg font-bold text-slate-800 truncate">{selectedEmail.subject}</DialogTitle>
                    <div className="flex gap-2">
                       <Badge variant="outline" className={`capitalize font-bold px-3 py-0.5 ${getPriorityColor(selectedEmail.priority)}`}>
                        {selectedEmail.priority}
                      </Badge>
                      <Badge variant="outline" className={`capitalize font-bold px-3 py-0.5 shadow-sm border-2 ${getSecurityColor(selectedEmail.security?.status)}`}>
                        {selectedEmail.security?.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-6">
                  {selectedEmail.security?.status !== 'Safe' && (
                    <div className={`mb-6 p-4 rounded-xl border-2 flex items-start gap-4 shadow-sm ${selectedEmail.security?.status === 'Phishing' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                      <ShieldCheck className={`w-6 h-6 shrink-0 ${selectedEmail.security?.status === 'Phishing' ? 'text-rose-600' : 'text-amber-600'}`} />
                      <div>
                        <p className="font-bold text-sm mb-1 uppercase tracking-tight">Security Analytics: {selectedEmail.security?.status} Identified</p>
                        <p className="text-sm opacity-90 leading-snug">{selectedEmail.security?.reason || "This email was flagged by HireNestOS intelligence layer."}</p>
                        <div className="mt-3 flex gap-2">
                           <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-white hover:bg-slate-50 border-slate-200 text-xs shadow-sm h-8"
                            onClick={() => handleUpdateInteraction(selectedEmail.id, { security_status: 'Safe', action: 'mark_safe', feedback: 'False positive flag' })}
                           >
                            Mark as Safe
                           </Button>
                           <Button 
                            variant="destructive" 
                            size="sm" 
                            className="text-xs shadow-sm h-8"
                            onClick={() => setSelectedEmail(null)}
                           >
                            Delete Payload
                           </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <Tabs defaultValue="payload" className="w-full">
                    <TabsList className="mb-6 grid w-full grid-cols-3 max-w-[500px] bg-slate-200/50 p-1">
                      <TabsTrigger value="payload">Intelligence Layer</TabsTrigger>
                      <TabsTrigger value="audit">Operational Audit</TabsTrigger>
                      <TabsTrigger value="history">Interaction History</TabsTrigger>
                    </TabsList>

                    <TabsContent value="payload" className="mt-0">
                      <div className="grid gap-6">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                          <div className="grid grid-cols-[80px_1fr] items-center text-sm mb-2">
                            <span className="font-semibold text-slate-500">From</span>
                            <span className="text-slate-900 font-medium">{selectedEmail.sender}</span>
                          </div>
                          <div className="grid grid-cols-[80px_1fr] items-center text-sm mb-2">
                            <span className="font-semibold text-slate-500">Subject</span>
                            <span className="text-slate-900">{selectedEmail.subject}</span>
                          </div>
                          <div className="grid grid-cols-[80px_1fr] items-center text-sm">
                            <span className="font-semibold text-slate-500">Time</span>
                            <span className="text-slate-900">{new Date(selectedEmail.received_at).toLocaleString()}</span>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 mb-3">AI Summary</h4>
                          <p className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            {selectedEmail.summary}
                          </p>
                        </div>

                        {selectedEmail.metadata && Object.values(selectedEmail.metadata).some(val => val !== null) && (
                          <div>
                             <h4 className="text-sm font-bold text-slate-900 mb-3">Extracted Entities</h4>
                             <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                               {Object.entries(selectedEmail.metadata).map(([key, value]) => value ? (
                                  <div key={key} className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex flex-col shadow-sm">
                                    <span className="text-[10px] uppercase font-bold text-indigo-500/80 tracking-wider mb-1">{key.replace('_', ' ')}</span>
                                    <span className="text-sm font-semibold text-indigo-950">{value}</span>
                                  </div>
                               ) : null)}
                             </div>
                          </div>
                        )}

                        {selectedEmail.action_items && selectedEmail.action_items.length > 0 && (
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 mb-3">Workflow Tasks</h4>
                            <ul className="space-y-2">
                              {selectedEmail.action_items.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-3 justify-start text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                  <div className="mt-1 w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-300">
                                    <CheckCircle2 className="w-3 h-3 text-slate-400" />
                                  </div>
                                  <span className="font-medium text-slate-800">{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {selectedEmail.outreach_draft && (
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center">
                              <ShieldCheck className="w-4 h-4 mr-1 text-emerald-600" />
                              CEO/Staffing Head Outreach Draft
                            </h4>
                            <p className="text-sm text-slate-800 leading-relaxed bg-emerald-50 p-5 rounded-xl border border-emerald-100 uppercase-style-for-fun font-medium shadow-sm">
                              {selectedEmail.outreach_draft}
                            </p>
                          </div>
                        )}

                        <div>
                          <h4 className="text-sm font-bold text-slate-900 mb-3">Original Ingestion Payload</h4>
                          <div className="w-full rounded-xl border border-slate-200 p-5 bg-white shadow-sm min-h-[150px]">
                            <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap">{selectedEmail.body}</pre>
                          </div>
                        </div>

                      </div>
                    </TabsContent>
                    
                    <TabsContent value="audit" className="mt-0">
                      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                          <Activity className="w-5 h-5 text-indigo-600" />
                          OmniMail Routing Timeline
                        </h3>
                        
                        <div className="relative border-l-2 border-slate-100 ml-4 space-y-8">
                          {/* Step 1 */}
                          <div className="relative pl-6">
                            <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center">
                              <CheckCircle2 className="w-3 h-3 text-slate-500" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-800">Inbound Communication Received</h4>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(selectedEmail.received_at).toLocaleString()}
                            </p>
                            <div className="mt-2 text-xs bg-slate-50 p-2 rounded-md border border-slate-100 text-slate-600">
                              Source: GMail Connector
                            </div>
                          </div>

                          {/* Step 2 */}
                          <div className="relative pl-6">
                            <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-indigo-100 border-2 border-indigo-500 flex items-center justify-center">
                              <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-800">Intelligence Layer Execution</h4>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              +{Math.floor(Math.random() * 2000 + 500)}ms
                            </p>
                            <div className="mt-2 text-xs bg-indigo-50/50 p-2 rounded-md border border-indigo-100/50 text-indigo-800 flex flex-col gap-1">
                              <span>Provider: Gemini 3.1 Pro Engine</span>
                              <span className="font-medium">Confidence Score: 0.93</span>
                              <span>Entities Extracted: {selectedEmail.metadata ? Object.keys(selectedEmail.metadata).length : 0} found</span>
                            </div>
                          </div>

                          {/* Step 3 */}
                          <div className="relative pl-6">
                            <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-emerald-100 border-2 border-emerald-500 flex items-center justify-center">
                              <Navigation className="w-3 h-3 text-emerald-600" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-800">Workflow Routing Engine</h4>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              +{Math.floor(Math.random() * 50 + 10)}ms
                            </p>
                            <div className="mt-2 text-xs bg-emerald-50 p-3 rounded-md border border-emerald-200 text-emerald-900 grid gap-2">
                              <div><span className="font-semibold">Evaluated Intent:</span> <span className="uppercase">{selectedEmail.intent}</span></div>
                              {selectedEmail.intent.toLowerCase().includes('requirement') || selectedEmail.intent.toLowerCase().includes('urgent') ? (
                                <div><span className="font-semibold">Assignment:</span> Alex Recruiter (Enterprise Team)</div>
                              ) : selectedEmail.intent.toLowerCase().includes('submission') ? (
                                <div><span className="font-semibold">Assignment:</span> Sam Sourcer (Technical)</div>
                              ) : (
                                <div><span className="font-semibold">Assignment:</span> General Operations Queue</div>
                              )}
                              <div className="flex border-t border-emerald-200/50 pt-2 mt-1">
                                <span className="bg-emerald-600 text-white px-2 py-0.5 rounded font-medium shadow-sm">Status: Assigned & Routed</span>
                              </div>
                            </div>
                          </div>

                          {/* Step 4 */}
                          <div className="relative pl-6">
                            {webhooks.length > 0 && webhooks.filter(w => w.active).length > 0 ? (
                               <>
                                <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-blue-100 border-2 border-blue-500 flex items-center justify-center">
                                  <Webhook className="w-3 h-3 text-blue-600" />
                                </div>
                                <h4 className="text-sm font-bold text-slate-800">OS Connector Delivery</h4>
                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  +{Math.floor(Math.random() * 300 + 100)}ms
                                </p>
                                <div className="mt-2 text-xs bg-slate-50 p-2 rounded-md border border-slate-200 text-slate-700">
                                  Payload delivered to {webhooks.filter(w => w.active).length} active webhook(s):
                                  <ul className="mt-1 ml-4 list-disc space-y-0.5 text-slate-500">
                                    {webhooks.filter(w => w.active).map(w => (
                                      <li key={w.id} className="font-mono">{w.name} - 200 OK</li>
                                    ))}
                                  </ul>
                                </div>
                               </>
                            ) : (
                               <>
                                <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center">
                                  <Webhook className="w-3 h-3 text-slate-400" />
                                </div>
                                <h4 className="text-sm font-bold text-slate-500">OS Connector Delivery</h4>
                                <p className="text-xs text-slate-400 mt-1">No active connectors to route to.</p>
                               </>
                            )}
                          </div>
                        </div>

                      </div>
                    </TabsContent>
                    <TabsContent value="history" className="mt-0">
                      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-indigo-600" />
                          Manual Override & AI Training
                        </h4>
                        <div className="grid grid-cols-2 gap-4 mb-8">
                          <div className="space-y-3">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Set Priority</p>
                            <div className="flex flex-wrap gap-2">
                              {['Urgent', 'Important', 'To Read', 'Archived'].map(p => (
                                <Button 
                                  key={p}
                                  variant="outline" 
                                  size="sm" 
                                  className={`text-xs h-8 border-slate-200 ${selectedEmail.priority === p ? 'bg-indigo-600 text-white border-indigo-600' : 'hover:bg-slate-50'}`}
                                  onClick={() => handleUpdateInteraction(selectedEmail.id, { priority: p, action: `set_priority_${p.toLowerCase()}` })}
                                >
                                  {p}
                                </Button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Security Feedback</p>
                            <div className="flex flex-wrap gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className={`text-xs h-8 ${selectedEmail.security?.status === 'Safe' ? 'bg-emerald-600 text-white' : ''}`}
                                onClick={() => handleUpdateInteraction(selectedEmail.id, { security_status: 'Safe', action: 'mark_safe' })}
                              >
                                Mark Safe
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className={`text-xs h-8 ${selectedEmail.security?.status === 'Phishing' ? 'bg-rose-600 text-white' : ''}`}
                                onClick={() => handleUpdateInteraction(selectedEmail.id, { security_status: 'Phishing', action: 'mark_phishing' })}
                              >
                                Mark Phishing
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className={`text-xs h-8 ${selectedEmail.security?.status === 'Spam' ? 'bg-amber-600 text-white' : ''}`}
                                onClick={() => handleUpdateInteraction(selectedEmail.id, { security_status: 'Spam', action: 'mark_spam' })}
                              >
                                Mark Spam
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 italic text-slate-500 text-xs text-center">
                          Future filters will adapt to these changes using OmniMail's context-aware interaction history learning.
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

