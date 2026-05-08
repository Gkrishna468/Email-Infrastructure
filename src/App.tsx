import { useState, useEffect } from 'react';
import { 
  Mail, Webhook, Settings, Activity, Plus, Search, Trash2, ShieldCheck, MailOpen, CheckCircle2, Clock, Navigation,
  TrendingUp, Users, Zap, MessageSquare, ArrowRight, CornerUpLeft, Filter, RefreshCcw, MoreVertical,
  ThumbsUp, ThumbsDown, Info, AlertTriangle, UserPlus, FileSearch, Building2, BrainCircuit, Sparkles,
  ChevronRight, ExternalLink, Command, ZapOff, Fingerprint, Layers
} from 'lucide-react';
import { API_URL } from './config/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { Progress } from '../components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

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
  match_score?: {
    score: number;
    gaps: string[];
    reasoning: string;
  } | null;
  vendor_intelligence?: {
    isKnownVendor: boolean;
    submissionQuality: "High" | "Medium" | "Low";
    spamLikelihood: number;
  } | null;
  metadata?: {
    role?: string | null;
    budget?: string | null;
    candidate_name?: string | null;
    vendor_name?: string | null;
    experienceYears?: number | null;
    noticePeriodDays?: number | null;
    expectedCTC?: string | null;
    hasResume?: boolean | null;
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
  const [outreachTone, setOutreachTone] = useState<string>('Founder');
  const [isDraftEditable, setIsDraftEditable] = useState(false);
  const [activeTab, setActiveTab] = useState('inbox');

  const fetchEmails = async () => {
    try {
      const res = await fetch(`${API_URL}/api/emails`);
      if (res.ok) setEmails(await res.json());
    } catch (e) {}
  };

  const fetchWebhooks = async () => {
    try {
      const res = await fetch(`${API_URL}/api/webhooks`);
      if (res.ok) setWebhooks(await res.json());
    } catch (e) {}
  };

  const checkGmailStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/gmail/status`);
      if (res.ok) {
        const data = await res.json();
        setIsGmailConnected(data.connected);
      }
    } catch (e) {}
  };

  const handleConnectGmail = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/google`);
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
      const res = await fetch(`${API_URL}/api/gmail/fetch`, { method: 'POST' });
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
      const res = await fetch(`${API_URL}/api/webhooks`, {
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
    await fetch(`${API_URL}/api/webhooks/${id}/toggle`, { method: 'PUT' });
    fetchWebhooks();
  };

  const handleDeleteWebhook = async (id: string) => {
    await fetch(`${API_URL}/api/webhooks/${id}`, { method: 'DELETE' });
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
      const res = await fetch(`${API_URL}/api/emails/${emailId}/interaction`, {
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
    
    await fetch(`${API_URL}/api/webhooks/ingress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(random)
    });
    
    // UI will update on next poll or we can just wait 2 sec and fetch
    setTimeout(fetchEmails, 2000);
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans text-slate-900">
        {/* Sidebar Navigation */}
        <aside className="w-18 lg:w-64 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col z-30 transition-all duration-300">
          <div className="p-4 lg:p-6 flex items-center gap-3 border-b border-slate-100">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-indigo-200 shadow-lg">
              <BrainCircuit className="w-6 h-6 text-white" />
            </div>
            <div className="hidden lg:block overflow-hidden">
              <span className="font-bold text-lg tracking-tight block">HireNestOS</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gen-AI Staffing</span>
            </div>
          </div>
          
          <ScrollArea className="flex-1 px-3 py-4">
            <div className="space-y-6">
              <div>
                <p className="hidden lg:block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-3">CORE OPS</p>
                <div className="space-y-1">
                  <button 
                    onClick={() => setActiveTab('inbox')}
                    className={`w-full flex items-center px-3 py-2.5 text-sm font-bold rounded-xl border border-transparent transition-all group ${
                      activeTab === 'inbox' ? 'bg-indigo-50 text-indigo-700 border-indigo-100/50' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <MailOpen className={`w-5 h-5 mr-0 lg:mr-3 transition-transform group-hover:scale-110 ${activeTab === 'inbox' ? 'text-indigo-500' : 'text-slate-400'}`} />
                    <span className="hidden lg:block">Intelligence Inbox</span>
                  </button>
                  <button className="w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-xl text-slate-500 hover:bg-slate-50 border border-transparent transition-all group">
                    <Users className="w-5 h-5 mr-0 lg:mr-3 text-slate-400 group-hover:text-indigo-400" />
                    <span className="hidden lg:block">Candidate Graph</span>
                  </button>
                  <button className="w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-xl text-slate-500 hover:bg-slate-50 border border-transparent transition-all group">
                    <TrendingUp className="w-5 h-5 mr-0 lg:mr-3 text-slate-400 group-hover:text-indigo-400" />
                    <span className="hidden lg:block">Market Insights</span>
                  </button>
                </div>
              </div>

              <div>
                <p className="hidden lg:block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-3">INTEGRATIONS</p>
                <div className="space-y-1">
                  <button 
                    onClick={() => setActiveTab('webhooks')}
                    className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-xl border border-transparent transition-all group ${
                      activeTab === 'webhooks' ? 'bg-indigo-50 text-indigo-700 border-indigo-100/50' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Webhook className={`w-5 h-5 mr-0 lg:mr-3 transition-transform group-hover:scale-110 ${activeTab === 'webhooks' ? 'text-indigo-500' : 'text-slate-400'}`} />
                    <span className="hidden lg:block">Connectors</span>
                  </button>
                </div>
              </div>

              <div>
                <p className="hidden lg:block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-3">AGENT NETWORK</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-3 py-1 text-[11px] text-slate-500">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${isGmailConnected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span className="hidden lg:block font-bold">Inbox Agent</span>
                    </div>
                    {isGmailConnected && <Badge className="hidden lg:flex bg-emerald-50 text-emerald-700 text-[8px] h-4 border-emerald-100 uppercase">ACTIVE</Badge>}
                  </div>
                  <div className="flex items-center justify-between px-3 py-1 text-[11px] text-slate-500">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 mr-2" />
                      <span className="hidden lg:block font-bold">Outreach Agent</span>
                    </div>
                    <Badge className="hidden lg:flex bg-indigo-50 text-indigo-700 text-[8px] h-4 border-indigo-100 uppercase">READY</Badge>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-slate-100">
            <div className="p-3 bg-slate-950 rounded-2xl text-white shadow-xl overflow-hidden relative border border-slate-800 hidden lg:block">
              <div className="absolute top-0 right-0 p-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">AI Health</p>
              <p className="text-xs font-bold text-indigo-100">Engine Operational</p>
            </div>
          </div>
        </aside>

        {/* Main Content Areas (Split Pane) */}
        <div className="flex-1 flex overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsContent value="inbox" className="flex-1 overflow-hidden p-0 m-0 border-0 data-[state=active]:flex flex-col">
              {/* Inbox Pane */}
              <main className={`flex-1 flex flex-col bg-white transition-all duration-500 ${selectedEmail ? 'hidden md:flex' : 'flex'}`}>
            <header className="h-16 border-b border-slate-100 px-6 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <h1 className="text-sm font-black uppercase tracking-widest text-slate-400">Intelligence Inbox</h1>
                <div className="h-4 w-px bg-slate-200" />
                <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-0 font-bold px-2 py-0.5">
                  {emails.length} Records
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" className="rounded-xl border-slate-200 font-bold text-xs" onClick={handleSimulateEmail}>
                  <RefreshCcw className="w-3 h-3 mr-2 text-indigo-500" />
                  Simulate Triage
                </Button>
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                  <Settings className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-50 flex items-center gap-2 bg-slate-50/30">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Search candidates, roles, or intent..." 
                    className="pl-10 h-10 bg-white border-slate-200 rounded-xl text-sm shadow-sm focus-visible:ring-indigo-500 ring-offset-0" 
                  />
                </div>
                <Button variant="outline" size="icon" className="rounded-xl border-slate-200 shrink-0">
                  <Filter className="w-4 h-4 text-slate-500" />
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="divide-y divide-slate-50">
                  {emails.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                      <Sparkles className="w-12 h-12 mb-4 text-slate-200" />
                      <p className="font-bold text-sm">Waiting for AI ingestion...</p>
                    </div>
                  ) : (
                    emails.map((email) => (
                      <div 
                        key={email.id}
                        onClick={() => setSelectedEmail(email)}
                        className={`p-4 cursor-pointer transition-all border-l-4 hover:bg-slate-50 group relative ${
                          selectedEmail?.id === email.id ? 'bg-indigo-50/30 border-indigo-600' : 'border-transparent'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-black text-xs text-slate-900 truncate tracking-tight">{email.sender}</span>
                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{email.intent}</span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 shrink-0">
                            {formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 mb-1 group-hover:text-indigo-600 transition-colors">{email.subject}</h3>
                        <p className="text-xs text-slate-500 line-clamp-1 mb-3">{email.summary}</p>
                        
                        <div className="flex items-center flex-wrap gap-2">
                          {email.match_score && (
                            <Badge className={`${
                              email.match_score.score > 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              email.match_score.score > 50 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                              'bg-rose-50 text-rose-700 border-rose-100'
                            } text-[10px] font-black h-5 border shadow-none`}>
                              Match: {email.match_score.score}%
                            </Badge>
                          )}
                          {email.vendor_intelligence?.isKnownVendor && (
                            <Badge className="bg-blue-50 text-blue-700 border-blue-100 text-[10px] font-black h-5 border shadow-none">
                              Verified Vendor
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </main>

            </TabsContent>

            <TabsContent value="webhooks" className="flex-1 overflow-hidden p-0 m-0 border-0 data-[state=active]:flex flex-col">
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">OS Connectors</h2>
                    <p className="text-xs text-slate-500 font-medium whitespace-pre-wrap">Sync intelligence to your staffing stack.</p>
                  </div>
                  <Button size="sm" onClick={() => setIsAddingWebhook(true)} className="bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-100 font-bold border-0">
                    <Plus className="w-4 h-4 mr-2" /> New Connector
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {webhooks.length === 0 ? (
                    <div className="col-span-full h-48 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                      <Webhook className="w-10 h-10 text-slate-300 mb-3" />
                      <p className="font-bold text-slate-400">No active relays configured.</p>
                    </div>
                  ) : (
                    webhooks.map((hook) => (
                      <Card key={hook.id} className="rounded-2xl border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-indigo-100 group">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                          <div>
                            <CardTitle className="text-sm font-black text-slate-800">{hook.name}</CardTitle>
                            <CardDescription className="text-[10px] truncate max-w-[200px] font-mono">{hook.url}</CardDescription>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                <MoreVertical className="w-4 h-4 text-slate-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="rounded-xl border-slate-100 shadow-xl overflow-hidden">
                              <DropdownMenuItem className="text-xs font-bold py-2" onClick={() => handleToggleWebhook(hook.id)}>
                                {hook.active ? 'Pause Sync' : 'Resume Sync'}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-xs font-bold py-2 text-rose-600" onClick={() => handleDeleteWebhook(hook.id)}>
                                Remove Connector
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </CardHeader>
                        <CardFooter className="pt-0 flex items-center justify-between">
                           <Badge className={`${hook.active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'} text-[9px] font-black h-5 border shadow-none`}>
                             {hook.active ? 'OPERATIONAL' : 'PAUSED'}
                           </Badge>
                           <div className="flex gap-2">
                             <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                               <Layers className="w-3 h-3 text-slate-400" />
                             </div>
                           </div>
                        </CardFooter>
                      </Card>
                    ))
                  )}
                </div>

                {/* Add Webhook Drawer/Dialog */}
                <Sheet open={isAddingWebhook} onOpenChange={setIsAddingWebhook}>
                  <SheetContent className="sm:max-w-md bg-white border-l-0 shadow-2xl rounded-l-[2rem]">
                    <SheetHeader className="pb-8">
                      <SheetTitle className="text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                        <Webhook className="w-6 h-6 text-indigo-600" /> New Connector
                      </SheetTitle>
                      <SheetDescription className="text-xs font-medium text-slate-500">
                        Create a real-time event bridge for HireNest intelligence.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Internal Alias</Label>
                        <Input 
                          placeholder="e.g. Talent CRM Sync" 
                          className="h-12 bg-slate-50 border-slate-200 rounded-xl focus:ring-indigo-500 text-sm font-bold ring-offset-0"
                          value={newWebhookName}
                          onChange={(e) => setNewWebhookName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Final Destination URL (POST)</Label>
                        <Input 
                          placeholder="https://..." 
                          className="h-12 bg-slate-50 border-slate-200 rounded-xl focus:ring-indigo-500 text-sm font-bold ring-offset-0"
                          value={newWebhookUrl}
                          onChange={(e) => setNewWebhookUrl(e.target.value)}
                        />
                      </div>
                      <Button className="w-full h-14 bg-slate-950 text-white hover:bg-slate-900 rounded-2xl shadow-xl font-black text-xs uppercase tracking-widest group border-0" onClick={handleAddWebhook}>
                        Initialize Relay <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* Intelligence Detail Panel (Split Pane replacement for Dialog) */}
          <AnimatePresence mode="wait">
            {selectedEmail ? (
              <motion.aside
                key="detail"
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-full md:w-[45%] lg:w-[45%] xl:w-[40%] border-l border-slate-200 bg-white flex flex-col z-20 shadow-[-20px_0_40px_rgba(0,0,0,0.02)]"
              >
            <div className="h-16 border-b border-slate-100 px-6 flex items-center justify-between shrink-0 bg-white sticky top-0 z-40 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setSelectedEmail(null)} className="md:hidden">
                  <ArrowRight className="w-5 h-5 rotate-180" />
                </Button>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-tight text-indigo-600 flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4" /> Intelligence Cockpit
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Decision Engine v2.4</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-xl border-slate-200 h-8 font-bold text-xs" onClick={() => setSelectedEmail(null)}>
                  Close
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6 space-y-8">
                {/* Header Information */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Badge className={`${getPriorityColor(selectedEmail.priority)} h-5 font-black uppercase text-[9px] border shadow-none px-2 rounded-lg`}>
                        {selectedEmail.priority}
                      </Badge>
                      <Badge className={`${getSecurityColor(selectedEmail.security?.status)} h-5 font-black uppercase text-[9px] border shadow-none px-2 rounded-lg`}>
                         {selectedEmail.security?.status}
                      </Badge>
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">{selectedEmail.subject}</h2>
                    
                    <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                      <Avatar className="h-10 w-10 border-2 border-white shadow-sm ring-1 ring-slate-100">
                        <AvatarFallback className="bg-indigo-600 text-white font-black text-xs">
                          {selectedEmail.sender[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-black text-slate-900 truncate tracking-tight">{selectedEmail.sender}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                           Ingested {formatDistanceToNow(new Date(selectedEmail.received_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* AI Recommendation Banner */}
                   <div className="bg-slate-950 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Sparkles className="w-20 h-20" />
                    </div>
                    <div className="relative z-10 space-y-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/50">
                          <Zap className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Founder Co-Pilot Mode</p>
                          <h3 className="text-sm font-black text-white tracking-tight">AI Strategy Recommendations</h3>
                        </div>
                      </div>
                      
                      <div className="text-xs text-indigo-100/90 leading-relaxed font-bold border-l-2 border-indigo-500/50 pl-4 py-1">
                        Analysis complete. This candidate aligns with current high-growth openings. High match confidence detected.
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <Button className="bg-indigo-600 text-white hover:bg-indigo-500 font-black text-xs h-11 rounded-2xl border-0 shadow-xl shadow-indigo-900/40">
                          Send Outreach
                        </Button>
                        <Button variant="outline" className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-900 hover:text-white font-bold text-xs h-11 rounded-2xl">
                          Delegate Triage
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Intelligence Insights */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Match Score</span>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-slate-900">{selectedEmail.match_score?.score || 0}</span>
                        <span className="text-xs font-black text-slate-400">%</span>
                      </div>
                      <Progress value={selectedEmail.match_score?.score || 0} className="h-1.5 bg-slate-50" />
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trust Level</span>
                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 text-[8px] h-4 border-indigo-100 font-black">VERIFIED</Badge>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-lg font-black text-slate-900 leading-tight">High Reliability</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Known Vendor</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Intelligence Tabs */}
                <Tabs defaultValue="outreach" className="w-full">
                  <TabsList className="w-full bg-slate-50 p-1 rounded-2xl mb-6">
                    <TabsTrigger value="outreach" className="flex-1 data-[state=active]:bg-white rounded-xl font-black text-[10px] py-2 shadow-sm uppercase transition-all">Outreach Agent</TabsTrigger>
                    <TabsTrigger value="intelligence" className="flex-1 data-[state=active]:bg-white rounded-xl font-black text-[10px] py-2 shadow-sm uppercase transition-all">Deep Invariants</TabsTrigger>
                    <TabsTrigger value="audit" className="flex-1 data-[state=active]:bg-white rounded-xl font-black text-[10px] py-2 shadow-sm uppercase transition-all">Audit</TabsTrigger>
                  </TabsList>

                  <TabsContent value="outreach" className="space-y-6">
                    <div className="flex items-center justify-between">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Composer Tone</p>
                       <div className="flex gap-1">
                         {['Founder', 'Executive', 'Warm'].map(tone => (
                           <button 
                             key={tone} 
                             onClick={() => setOutreachTone(tone)}
                             className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                               outreachTone === tone ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                             }`}
                           >
                             {tone}
                           </button>
                         ))}
                       </div>
                    </div>

                    <div className="bg-indigo-50/30 rounded-3xl border-2 border-indigo-100 overflow-hidden shadow-sm group">
                      <div className="p-1 border-b border-indigo-100 flex items-center justify-between bg-white/50">
                        <div className="flex items-center gap-2 px-3 py-2">
                           <Avatar className="h-6 w-6">
                             <AvatarFallback className="bg-indigo-100 text-indigo-700 text-[8px] font-black">AI</AvatarFallback>
                           </Avatar>
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Drafting Agent</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-300 hover:text-indigo-600" onClick={() => setIsDraftEditable(!isDraftEditable)}>
                           {isDraftEditable ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4 rotate-45" />}
                        </Button>
                      </div>
                      <div className="p-6">
                        {isDraftEditable ? (
                          <textarea 
                            className="w-full h-64 bg-transparent border-0 focus:ring-0 text-sm font-bold text-slate-800 leading-relaxed resize-none p-0 outline-none"
                            value={selectedEmail.outreach_draft || ''}
                            onChange={(e) => {
                              if (selectedEmail) {
                                setSelectedEmail({...selectedEmail, outreach_draft: e.target.value});
                              }
                            }}
                          />
                        ) : (
                          <div className="text-sm font-bold text-slate-800 leading-relaxed min-h-[16rem]">
                             {selectedEmail.outreach_draft}
                          </div>
                        )}
                      </div>
                      <div className="p-4 bg-white/50 border-t border-indigo-100 flex items-center justify-between">
                         <div className="flex -space-x-2">
                           {[1,2,3].map(i => <div key={i} className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white" />)}
                         </div>
                         <Button className="bg-slate-900 text-white hover:bg-slate-800 h-10 px-6 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl border-0">
                           Approve & Release
                         </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="intelligence" className="space-y-6">
                     <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Signal Extraction</h4>
                        <div className="grid grid-cols-2 gap-3">
                           {selectedEmail.metadata ? Object.entries(selectedEmail.metadata).map(([key, val]) => (
                             val && (
                               <div key={key} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm border-l-2 border-l-indigo-400">
                                 <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-tighter">{key.replace(/_/g, ' ')}</p>
                                 <p className="text-xs font-black text-slate-900 truncate">{String(val)}</p>
                               </div>
                             )
                           )) : (
                             <p className="text-xs text-slate-400 italic font-bold">No structured metadata available.</p>
                           )}
                        </div>
                     </div>

                     <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Derived Tasks</h4>
                        <div className="space-y-2">
                           {selectedEmail.action_items?.map((item, idx) => (
                             <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-all cursor-pointer shadow-sm">
                                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-all">
                                   <Activity className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                                </div>
                                <span className="text-[11px] font-bold text-slate-700 flex-1">{item}</span>
                                <Plus className="w-4 h-4 text-slate-200 group-hover:text-indigo-400" />
                             </div>
                           ))}
                        </div>
                     </div>
                  </TabsContent>

                  <TabsContent value="audit" className="space-y-6">
                     <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                        <div className="relative border-l-2 border-slate-100 ml-4 space-y-8">
                           <div className="relative pl-6">
                              <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center shadow-md shadow-indigo-200">
                                 <CheckCircle2 className="w-3 h-3 text-white" />
                              </div>
                              <h4 className="text-sm font-black text-slate-900 tracking-tight">Ingress Point Reached</h4>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Confirmed Layer 1</p>
                           </div>
                           <div className="relative pl-6">
                              <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center">
                                 <Sparkles className="w-3 h-3 text-slate-500" />
                              </div>
                              <h4 className="text-sm font-black text-slate-900 tracking-tight">Gemini Reasoning v3</h4>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Logic Execution Success</p>
                           </div>
                           <div className="relative pl-6">
                              <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center">
                                 <Webhook className="w-3 h-3 text-slate-400" />
                              </div>
                              <h4 className="text-sm font-black text-slate-900 tracking-tight">Relay Finalized</h4>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Status: OK 200</p>
                           </div>
                        </div>
                     </div>
                  </TabsContent>
                </Tabs>

                <div className="pt-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Original Raw Content</h4>
                  <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                    <pre className="text-[11px] font-bold text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">
                       {selectedEmail.body}
                    </pre>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </motion.aside>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 hidden md:flex flex-col items-center justify-center p-12 text-center bg-slate-50/[0.02]"
          >
             <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center shadow-2xl border border-slate-100 mb-8 overflow-hidden relative group">
                <div className="absolute inset-0 bg-indigo-600 translate-y-24 group-hover:translate-y-0 transition-transform duration-500" />
                <img src="https://api.dicebear.com/7.x/bottts/svg?seed=HirN" alt="AI" className="w-12 h-12 relative z-10 group-hover:invert transition-all" />
             </div>
             <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">Talent Intelligence Center</h3>
             <p className="text-xs font-bold text-slate-400 max-w-[240px] leading-relaxed">
                Select an inbound signal to activate the premium decision cockpit and agent network.
             </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>
</TooltipProvider>
  );
}

