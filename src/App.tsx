import { useState, useEffect, useMemo } from 'react';
import { 
  Mail, Webhook, Settings, Activity, Plus, Search, Trash2, ShieldCheck, MailOpen, CheckCircle2, Clock, Navigation,
  LayoutDashboard, Users, Building2, Briefcase, Filter, MessageSquare, ArrowRight, CornerDownRight, Sparkles, AlertCircle,
  TrendingUp, Fingerprint, ShieldAlert, Zap, Command, ChevronRight, MoreHorizontal, Send, LogOut
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc } from 'firebase/firestore';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { db, auth, signInWithGoogle } from './lib/firebase';
import { API_URL } from './config/api';
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
  bodyHtml?: string;
  summary: string;
  action_items: string[];
  intent: string;
  priority: "Urgent" | "Client Req" | "Vendor Submission" | "Interview" | "Follow-up" | "Important" | "To Read" | "Archived" | "Spam" | "Phishing";
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
    budgetLPA?: number | null;
    candidateName?: string | null;
    vendorName?: string | null;
    experienceYears?: number | null;
    noticePeriodDays?: number | null;
    expectedCTC?: string | null;
    hasResume?: boolean | null;
    skills?: string[] | null;
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

// Error Handler as per guidelines
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookTarget[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [newWebhookName, setNewWebhookName] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [isAddingWebhook, setIsAddingWebhook] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Listeners
  useEffect(() => {
    if (!user) {
      setEmails([]);
      setWebhooks([]);
      return;
    }

    const qEmails = query(collection(db, 'emails'), orderBy('received_at', 'desc'));
    const unsubEmails = onSnapshot(qEmails, (snapshot) => {
      setEmails(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Email)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'emails'));

    const qWebhooks = query(collection(db, 'webhooks'), orderBy('created_at', 'desc'));
    const unsubWebhooks = onSnapshot(qWebhooks, (snapshot) => {
      setWebhooks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WebhookTarget)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'webhooks'));

    return () => {
      unsubEmails();
      unsubWebhooks();
    };
  }, [user]);

  useEffect(() => {
    checkGmailStatus();
  }, []);

  const checkGmailStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/gmail/status`);
      if (res.ok) {
        const data = await res.json();
        setIsGmailConnected(data.connected);
      }
    } catch (e) {}
  };

  const filteredEmails = useMemo(() => {
    if (!searchQuery) return emails;
    const lowerQuery = searchQuery.toLowerCase();
    return emails.filter(email => 
      email.subject.toLowerCase().includes(lowerQuery) ||
      email.sender.toLowerCase().includes(lowerQuery) ||
      email.body.toLowerCase().includes(lowerQuery) ||
      email.summary.toLowerCase().includes(lowerQuery) ||
      email.metadata?.candidateName?.toLowerCase().includes(lowerQuery) ||
      email.metadata?.role?.toLowerCase().includes(lowerQuery)
    );
  }, [emails, searchQuery]);

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
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_URL}/api/gmail/fetch?limit=100`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        console.log(`Synced ${data.count} emails`);
      }
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    checkGmailStatus();
  }, []);

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
      }
    } catch (e) {}
  };

  const handleToggleWebhook = async (id: string) => {
    await fetch(`${API_URL}/api/webhooks/${id}/toggle`, { method: 'PUT' });
  };

  const handleDeleteWebhook = async (id: string) => {
    await fetch(`${API_URL}/api/webhooks/${id}`, { method: 'DELETE' });
  };

  const getPriorityColor = (priority: string) => {
    const map: Record<string, string> = {
      'Urgent': 'bg-rose-50 text-rose-700 border-rose-200',
      'Client Req': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Vendor Submission': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'Interview': 'bg-blue-50 text-blue-700 border-blue-200',
      'Follow-up': 'bg-amber-50 text-amber-700 border-amber-200',
      'Important': 'bg-violet-50 text-violet-700 border-violet-200',
      'To Read': 'bg-slate-50 text-slate-600 border-slate-200',
      'Archived': 'bg-slate-100 text-slate-500 border-slate-200',
      'Spam': 'bg-orange-50 text-orange-700 border-orange-200',
      'Phishing': 'bg-rose-600 text-white border-rose-700',
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
      const emailRef = doc(db, 'emails', emailId);
      await updateDoc(emailRef, updates);
      
      const interactionColl = collection(db, 'interactions');
      await addDoc(interactionColl, {
        email_id: emailId,
        action: updates.action || 'update',
        user_feedback: updates.feedback || 'App UI update',
        created_at: new Date().toISOString()
      });

      if (selectedEmail && selectedEmail.id === emailId) {
        setSelectedEmail({ ...selectedEmail, ...updates });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'emails');
    }
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
    
    // UI will update automatically via real-time sync
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <Activity className="w-8 h-8 text-indigo-600 animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold mb-8 shadow-xl shadow-indigo-200">
           <Activity className="w-9 h-9" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">HireNestOS</h1>
        <p className="text-slate-500 mb-8 text-center max-w-sm font-medium">Mission Control for Staffing Operations. Authenticate to enter the command center.</p>
        <Button 
          onClick={signInWithGoogle} 
          className="h-12 px-8 bg-indigo-600 hover:bg-black text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-3"
        >
          <img src="https://www.google.com/favicon.ico" className="w-4 h-4 invert brightness-200" alt="Google" />
          Continue with Google
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans text-slate-900 border-t border-slate-200">
      {/* Sidebar Navigation */}
      <aside className="w-64 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col z-30 transition-all">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">HireNestOS</span>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2 mt-2">Mission Control</div>
          <div className="flex items-center px-3 py-2 text-sm font-medium rounded-lg bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50">
            <LayoutDashboard className="w-5 h-5 mr-3 text-indigo-500" />
            Command Center
          </div>
          <div className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer">
            <Users className="w-5 h-5 mr-3 text-slate-400" />
            Candidate Pipeline
          </div>
          <div className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer">
            <Building2 className="w-5 h-5 mr-3 text-slate-400" />
            Vendor Partners
          </div>
          <div className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer">
            <Briefcase className="w-5 h-5 mr-3 text-slate-400" />
            Client Ops
          </div>
          
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-8 mb-2 px-2">Integrations</div>
          <div className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer">
            <MailOpen className="w-5 h-5 mr-3 text-slate-400" />
            OmniMail Stream
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
        <div className="p-4 border-t border-slate-100 space-y-3">
          <div className="px-3 py-2 flex items-center justify-between border border-slate-100 rounded-xl bg-slate-50/50">
            <div className="flex items-center min-w-0">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="ml-3 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{user.email}</p>
                <p className="text-[10px] text-slate-400">Authenticated</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-500" onClick={() => signOut(auth)}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
          <div className="p-4 bg-slate-900 rounded-xl text-white shadow-lg overflow-hidden relative border border-slate-800">
            <div className="absolute top-0 right-0 p-3">
              <span className="flex h-2 w-2 relative">
                {isSyncing && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isSyncing ? 'bg-indigo-500' : 'bg-emerald-500'}`}></span>
              </span>
            </div>
            <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest mb-1">{isSyncing ? 'Syncing...' : 'Ingestion Mode'}</p>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold truncate text-indigo-50">
                {isSyncing ? 'Ingesting Streams' : 'Active Ingestion'}
              </p>
              {isSyncing && <Activity className="w-3 h-3 text-indigo-400 animate-spin" />}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-row h-full bg-slate-50 z-10 overflow-hidden relative">
        {/* Left Section: List & Tabs */}
        <div className={`flex flex-col h-full bg-white transition-all duration-300 border-r border-slate-200 ${selectedEmail ? 'w-1/2' : 'w-full'}`}>
          {/* Header */}
          <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-indigo-50 rounded-lg">
                <Command className="w-4 h-4 text-indigo-600" />
              </div>
              <h1 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Staffing Command Center</h1>
            </div>
            <div className="flex items-center gap-3">
              {isSyncing ? (
                <div className="flex items-center px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-[10px] font-bold text-indigo-600 gap-2 shadow-sm animate-pulse">
                  <Activity className="w-3 h-3 text-indigo-500 animate-spin" /> Ingesting Streams...
                </div>
              ) : (
                <div className="flex items-center px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-[10px] font-mono text-slate-500 gap-2 shadow-sm">
                  <Zap className="w-3 h-3 text-amber-500" /> System Live
                </div>
              )}
              
              <div className="h-6 w-px bg-slate-200 mx-1"></div>

              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-[10px] font-bold uppercase tracking-wider bg-white shadow-sm border-slate-200 hover:bg-slate-50 gap-2"
                onClick={handleFetchGmail}
                disabled={isSyncing || !isGmailConnected}
              >
                {isSyncing ? <Activity className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                Sync Gmail
              </Button>

              <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg" onClick={handleSimulateEmail}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </header>

          <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4">
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Total Signals</p>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-black">{emails.length}</span>
                  <Activity className="w-4 h-4 text-emerald-500" />
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Match Quality</p>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-black">
                    {emails.length > 0 ? Math.round(emails.reduce((acc, e) => acc + (e.match_score?.score || 0), 0) / emails.length) : 0}%
                  </span>
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Relays</p>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-black">{webhooks.filter(w => w.active).length}</span>
                  <Zap className="w-4 h-4 text-amber-500" />
                </div>
              </div>
            </div>

            <Tabs defaultValue="inbox" className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <TabsList className="bg-slate-100/50 p-1 h-9 border border-slate-200/50">
                  <TabsTrigger value="inbox" className="text-xs px-4 h-7">Signals</TabsTrigger>
                  <TabsTrigger value="connectors" className="text-xs px-4 h-7">Connectors</TabsTrigger>
                </TabsList>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded px-2 h-8 w-48 focus-within:ring-1 focus-within:ring-indigo-500">
                  <Search className="w-3.5 h-3.5 text-slate-400 mr-2" />
                  <input 
                    type="text" 
                    placeholder="Filter command..." 
                    className="bg-transparent text-xs outline-none w-full" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <TabsContent value="inbox" className="flex-1 min-h-0 mt-0">
                <div className="h-full border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-slate-50/10">
                  {filteredEmails.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                      <div className="relative mb-6">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isSyncing ? 'bg-indigo-600 text-white animate-pulse shadow-indigo-200 shadow-xl' : 'bg-slate-100 text-slate-300'}`}>
                          {isSyncing ? <Activity className="w-8 h-8 animate-spin" /> : <Mail className="w-10 h-10" />}
                        </div>
                        {isSyncing && (
                          <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1 rounded-full border-2 border-white">
                            <Zap className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <h3 className="text-sm font-black text-slate-800 mb-1">
                        {isSyncing ? 'Synchronizing Recruiter Intelligence' : searchQuery ? 'No matching signals' : 'Command Center Offline'}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium max-w-[200px] leading-relaxed">
                        {isSyncing 
                          ? 'Fetching latest streams from Gmail, analyzing candidate intent and match scores...' 
                          : searchQuery 
                            ? 'Adjust your filters to see more recruitment signals.' 
                            : 'Connect your Gmail or click Sync to begin ingesting recruitment signals.'}
                      </p>
                      {!isSyncing && !searchQuery && (
                        <Button 
                          onClick={handleFetchGmail} 
                          className="mt-6 h-9 bg-indigo-600 text-white px-6 rounded-xl text-[10px] items-center gap-2"
                        >
                          <Zap className="w-3.5 h-3.5" /> Start Initial Ingestion
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 overflow-auto scrollbar-hide">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase">Priority</th>
                            <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase">Sender</th>
                            <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase">Intelligence Summary</th>
                            <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase text-right">Age</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredEmails.map((email) => (
                            <tr 
                              key={email.id} 
                              onClick={() => setSelectedEmail(email)}
                              className={`group cursor-pointer hover:bg-slate-50 transition-all ${selectedEmail?.id === email.id ? 'bg-indigo-50/50' : ''}`}
                            >
                              <td className="px-4 py-3 align-top">
                                <Badge variant="outline" className={`text-[9px] font-black uppercase px-2 h-5 flex items-center w-fit border-none shadow-none ${getPriorityColor(email.priority)}`}>
                                  {email.priority === 'Vendor Submission' ? 'SUBMISSION' : email.priority}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 align-top max-w-[120px]">
                                <p className="text-xs font-bold text-slate-900 truncate tracking-tight">{email.sender.split('<')[0].trim()}</p>
                                <p className="text-[10px] text-slate-400 truncate font-medium">{email.subject}</p>
                              </td>
                              <td className="px-4 py-3 align-top">
                                <p className="text-xs text-slate-600 line-clamp-1 leading-snug">
                                  {email.summary.split('.')[0]}.
                                </p>
                                <div className="flex gap-1.5 mt-1.5">
                                  {email.match_score && (
                                    <span className={`text-[9px] font-bold px-1 rounded flex items-center gap-1 ${
                                      email.match_score.score > 70 ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'
                                    }`}>
                                      <Fingerprint className="w-2.5 h-2.5" /> Match: {email.match_score.score}%
                                    </span>
                                  )}
                                  {email.metadata?.candidateName && (
                                    <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1 rounded">
                                      {email.metadata.candidateName}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 align-top text-right text-[10px] text-slate-400 font-mono">
                                {formatDistanceToNow(new Date(email.received_at), { addSuffix: false })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="connectors" className="flex-1 min-h-0 mt-0">
                 {/* Webhooks table or grid */}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Right Section: Intelligence Detail */}
        {selectedEmail && (
          <div className="flex-1 h-full bg-slate-50 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                  (selectedEmail.match_score?.score || 0) > 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {selectedEmail.match_score?.score || 0}%
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-900 truncate max-w-[200px]">{selectedEmail.subject}</h2>
                  <p className="text-[10px] text-slate-500 font-medium">{selectedEmail.sender}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-wider" onClick={() => setSelectedEmail(null)}>
                  Close
                </Button>
                <Button size="sm" className="h-8 bg-indigo-600 text-white hover:bg-indigo-700 text-[10px] font-bold uppercase tracking-wider shadow-sm">
                  Action
                </Button>
              </div>
            </header>

            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6">
                {/* Security Shield */}
                {selectedEmail.security?.status !== 'Safe' && (
                  <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                    selectedEmail.security?.status === 'Phishing' ? 'bg-rose-50 border-rose-100 text-rose-900' : 'bg-amber-50 border-amber-100 text-amber-900'
                  }`}>
                    <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-tight mb-1">Threat Detected: {selectedEmail.security?.status}</p>
                      <p className="text-[11px] opacity-80 leading-snug mb-3">{selectedEmail.security?.reason || "Irregular payload signature detected."}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-[9px] bg-white border-rose-200 text-rose-700" onClick={() => setSelectedEmail(null)}>Discard</Button>
                        <Button size="sm" className="h-7 text-[9px] bg-indigo-600 text-white" onClick={() => handleUpdateInteraction(selectedEmail.id, { security_status: 'Safe' })}>Allow Once</Button>
                      </div>
                    </div>
                  </div>
                )}

                <Tabs defaultValue="briefing" className="w-full">
                  <TabsList className="bg-slate-200/40 p-1 mb-6 border border-slate-200/50 w-full justify-start">
                    <TabsTrigger value="briefing" className="text-[10px] uppercase font-bold tracking-wider px-4">Executive Brief</TabsTrigger>
                    <TabsTrigger value="intel" className="text-[10px] uppercase font-bold tracking-wider px-4">Market Intel</TabsTrigger>
                    <TabsTrigger value="outreach" className="text-[10px] uppercase font-bold tracking-wider px-4 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-indigo-500" /> Outreach Agent
                    </TabsTrigger>
                    <TabsTrigger value="workflow" className="text-[10px] uppercase font-bold tracking-wider px-4">Workflow</TabsTrigger>
                  </TabsList>

                  <TabsContent value="briefing">
                    <div className="space-y-6">
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3">
                          <Activity className="w-4 h-4 text-indigo-100 group-hover:text-indigo-200 transition-colors" />
                        </div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">AI Executive Snapshot</h3>
                        <div className="space-y-4">
                          <p className="text-sm text-slate-800 leading-relaxed font-medium">
                            {selectedEmail.summary}
                          </p>
                          <div className="flex flex-wrap gap-2">
                             {selectedEmail.action_items.map((item, i) => (
                               <Badge key={i} variant="secondary" className="bg-indigo-50/50 text-indigo-700 border-indigo-100 text-[10px] px-2 py-1 flex items-center gap-1.5 rounded-lg font-medium">
                                 <CheckCircle2 className="w-3 h-3" /> {item}
                               </Badge>
                             ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                           <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-100">
                             <CardTitle className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2">
                               <Fingerprint className="w-3 h-3" /> Match Confidence
                             </CardTitle>
                           </CardHeader>
                           <CardContent className="p-4 flex flex-col items-center justify-center min-h-[140px]">
                              <div className="relative w-24 h-24">
                                <svg className="w-full h-full transform -rotate-90">
                                  <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                                  <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * (selectedEmail.match_score?.score || 0)) / 100} className="text-indigo-600 transition-all duration-1000" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <span className="text-xl font-black text-slate-900">{selectedEmail.match_score?.score || 0}%</span>
                                  <span className="text-[8px] font-bold text-slate-400 uppercase">Score</span>
                                </div>
                              </div>
                           </CardContent>
                        </Card>
                        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                           <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-100">
                             <CardTitle className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2">
                               <Building2 className="w-3 h-3" /> Vendor Trust
                             </CardTitle>
                           </CardHeader>
                           <CardContent className="p-4 flex flex-col justify-center min-h-[140px] space-y-4">
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-[10px] font-bold uppercase mb-1">
                                  <span className="text-slate-400">Quality Index</span>
                                  <span className="text-indigo-600">{selectedEmail.vendor_intelligence?.submissionQuality || 'N/A'}</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-indigo-500 h-full transition-all duration-1000" 
                                    style={{ width: selectedEmail.vendor_intelligence?.submissionQuality === 'High' ? '90%' : selectedEmail.vendor_intelligence?.submissionQuality === 'Medium' ? '50%' : '20%' }} 
                                  />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-[10px] font-bold uppercase mb-1">
                                  <span className="text-slate-400">Spam Likelihood</span>
                                  <span className="text-rose-600">{Math.round((selectedEmail.vendor_intelligence?.spamLikelihood || 0) * 100)}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-rose-500 h-full transition-all duration-1000" 
                                    style={{ width: `${(selectedEmail.vendor_intelligence?.spamLikelihood || 0) * 100}%` }} 
                                  />
                                </div>
                              </div>
                           </CardContent>
                        </Card>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="intel">
                    <div className="space-y-4">
                      {selectedEmail.metadata ? (
                        <div className="grid grid-cols-1 gap-4">
                          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Extracted Intelligence</h4>
                            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                              {selectedEmail.metadata.candidateName && (
                                <div>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Candidate</p>
                                  <p className="text-xs font-bold text-slate-900 border-b border-indigo-100 pb-1">{selectedEmail.metadata.candidateName}</p>
                                </div>
                              )}
                              {selectedEmail.metadata.role && (
                                <div>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Target Role</p>
                                  <p className="text-xs font-bold text-slate-900 border-b border-indigo-100 pb-1">{selectedEmail.metadata.role}</p>
                                </div>
                              )}
                              {selectedEmail.metadata.experienceYears && (
                                <div>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Experience</p>
                                  <p className="text-xs font-bold text-slate-900">{selectedEmail.metadata.experienceYears} Years</p>
                                </div>
                              )}
                              {selectedEmail.metadata.expectedCTC && (
                                <div>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Expected CTC</p>
                                  <p className="text-xs font-bold text-indigo-600">{selectedEmail.metadata.expectedCTC}</p>
                                </div>
                              )}
                              {selectedEmail.metadata.noticePeriodDays !== null && (
                                <div>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Availability</p>
                                  <p className="text-xs font-bold text-slate-900">{selectedEmail.metadata.noticePeriodDays} Days Notice</p>
                                </div>
                              )}
                              {selectedEmail.metadata.budgetLPA && (
                                <div>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Budget Index</p>
                                  <p className="text-xs font-bold text-emerald-600">{selectedEmail.metadata.budgetLPA} LPA</p>
                                </div>
                              )}
                            </div>
                            
                            {selectedEmail.metadata.skills && selectedEmail.metadata.skills.length > 0 && (
                              <div className="pt-4 border-t border-slate-100">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-3 px-1">Required Skills Matrix</p>
                                <div className="flex flex-wrap gap-2">
                                  {selectedEmail.metadata.skills.map((skill, i) => (
                                    <span key={i} className="bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600 px-2 py-1 rounded-lg">
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {selectedEmail.match_score && selectedEmail.match_score.gaps.length > 0 && (
                            <div className="bg-rose-50 border border-rose-100 p-5 rounded-2xl shadow-sm space-y-4">
                              <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                                <AlertCircle className="w-3 h-3" /> Critical Gaps Identified
                              </h4>
                              <div className="space-y-2">
                                {selectedEmail.match_score.gaps.map((gap, i) => (
                                  <div key={i} className="flex items-center gap-3 bg-white/50 p-2 rounded-lg border border-rose-100 text-[11px] font-medium text-rose-800">
                                    <ArrowRight className="w-3 h-3 shrink-0 text-rose-400" />
                                    {gap}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-20 text-center opacity-30">
                          <Users className="w-12 h-12 mx-auto mb-4" />
                          <p className="text-sm font-bold uppercase tracking-tight">No Entities Extracted</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="outreach">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Outreach Strategy</h4>
                         <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 h-8">
                            <button className="text-[9px] font-black uppercase px-3 rounded-md bg-white shadow-sm text-indigo-700">Executive</button>
                            <button className="text-[9px] font-black uppercase px-3 rounded-md text-slate-500">Concise</button>
                            <button className="text-[9px] font-black uppercase px-3 rounded-md text-slate-500">Aggressive</button>
                         </div>
                      </div>
                      
                      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                        <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden group flex-1 flex flex-col">
                          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Zap className="w-20 h-20" />
                          </div>
                          
                          <div className="relative z-10 flex-1 flex flex-col">
                             <div className="flex items-center gap-2 mb-4">
                               <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                                 <Fingerprint className="w-3 h-3 text-indigo-300" />
                               </div>
                               <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Generated Reply Draft</span>
                             </div>
                             
                             <textarea 
                               className="bg-transparent text-sm leading-relaxed font-medium flex-1 outline-none resize-none scrollbar-hide text-indigo-50 min-h-[150px]"
                               defaultValue={selectedEmail.outreach_draft || `Dear Team,\n\nI have reviewed the submission for ${selectedEmail.metadata?.candidateName || 'the candidate'} for the ${selectedEmail.metadata?.role || 'role'}. The match score is ${selectedEmail.match_score?.score || 0}%.\n\nCould you clarify the notice period availability?`}
                             />
                          </div>

                          <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between relative z-10">
                            <p className="text-[10px] text-white/40 italic">Drafted via Gemini 3 Flash</p>
                            <div className="flex gap-2">
                              <Button size="sm" className="h-8 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white gap-2 px-4 shadow-lg shadow-indigo-500/20">
                                <Send className="w-3 h-3" /> Execute Send
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                        <div className="grid grid-cols-2 gap-3 shrink-0">
                          <Button variant="outline" className="h-10 text-[10px] font-bold uppercase tracking-widest border-slate-200 bg-white shadow-sm flex items-center gap-2">
                            <MessageSquare className="w-3.5 h-3.5 text-indigo-500" /> WhatsApp Agent
                          </Button>
                          <Button variant="outline" className="h-10 text-[10px] font-bold uppercase tracking-widest border-slate-200 bg-white shadow-sm flex items-center gap-2">
                            <Plus className="w-3.5 h-3.5 text-indigo-500" /> Add to ATS
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="workflow">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">OmniMail Signal Journey</h3>
                      <div className="relative border-l-2 border-indigo-100 ml-4 space-y-10">
                        <div className="relative pl-8">
                          <div className="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-emerald-500 border-4 border-white shadow-sm flex items-center justify-center" />
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">T-0:00 Ingested</p>
                          <p className="text-xs font-bold text-slate-900">Communication locked via GMail Stream</p>
                          <p className="text-[10px] text-slate-400 mt-1">{new Date(selectedEmail.received_at).toLocaleTimeString()}</p>
                        </div>
                        <div className="relative pl-8">
                          <div className="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-indigo-500 border-4 border-white shadow-sm flex items-center justify-center" />
                          <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">T+0:02 Intelligence</p>
                          <p className="text-xs font-bold text-slate-900">Gemini 3.1 completed entity extraction</p>
                          <div className="mt-2 flex gap-1.5 flex-wrap">
                            <span className="bg-slate-100 text-[9px] font-bold px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">Schema Map: OK</span>
                            <span className="bg-slate-100 text-[9px] font-bold px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">Risk Scan: SAFE</span>
                          </div>
                        </div>
                        <div className="relative pl-8">
                          <div className="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-amber-500 border-4 border-white shadow-sm flex items-center justify-center" />
                          <p className="text-[10px] font-black text-amber-400 uppercase mb-1">T+0:03 Routing</p>
                          <p className="text-xs font-bold text-slate-900">Broadcasted to Command Center Workspaces</p>
                          {webhooks.filter(w => w.active).length > 0 && (
                            <p className="text-[10px] text-emerald-500 font-bold mt-1">✓ Sent to {webhooks.filter(w => w.active).length} relays</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>
          </div>
        )}
      </main>    </div>
  );
}

