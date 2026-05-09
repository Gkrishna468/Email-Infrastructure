import React, { useState, useEffect, useMemo } from 'react';
import { 
  Mail, 
  Search, 
  Zap, 
  Activity, 
  Command, 
  Plus, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  User, 
  Briefcase, 
  Clock, 
  LayoutDashboard,
  Inbox,
  Workflow,
  Settings,
  LogOut,
  ChevronDown,
  ExternalLink
} from 'lucide-react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  limit
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';

// Helper for Tailwind classes
const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

const API_URL = window.location.origin;

interface Email {
  id: string;
  subject: string;
  snippet: string;
  from: string;
  date: string;
  match_score: {
    score: number;
    reasons: string[];
  };
  metadata: {
    candidateName: string;
    role: string;
  };
  userId: string;
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inbox' | 'workflow'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  // 1. Auth Listener and URL Param Check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        checkGmailStatus(u.uid);
      }
    });

    // Check for URL parameters (e.g. from redirect)
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail') === 'connected') {
      setIsGmailConnected(true);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return unsubscribe;
  }, []);

  // 2. Real-time Email Listener
  useEffect(() => {
    if (!user) {
      setEmails([]);
      return;
    }

    const q = query(
      collection(db, 'emails'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Email));
      setEmails(docs);
    });

    return unsubscribe;
  }, [user]);

  // 3. Gmail Status Check
  const checkGmailStatus = async (uid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/gmail/status?userId=${uid}`);
      if (res.ok) {
        const data = await res.json();
        setIsGmailConnected(data.connected);
      }
    } catch (e) {
      console.error("Status check error:", e);
    }
  };

  // 4. Connect Gmail
  const handleConnectGmail = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/auth/google?userId=${user.uid}`);
      if (res.ok) {
        const { url } = await res.json();
        const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
        
        const messageHandler = (event: MessageEvent) => {
          if (event.data.type === 'GMAIL_CONNECTED') {
            setIsGmailConnected(true);
            window.removeEventListener('message', messageHandler);
          }
        };
        window.addEventListener('message', messageHandler);
      }
    } catch (e) {
      console.error("Auth error:", e);
    }
  };

  // 5. Ingest Emails
  const handleSyncGmail = async () => {
    if (isSyncing || !user) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_URL}/api/gmail/fetch?limit=10&userId=${user.uid}`, { method: 'POST' });
      const data = await res.json();
      console.log(`Synced ${data.count} emails`);
    } catch (e) {
      console.error("Sync error:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const login = () => {
    signInWithPopup(auth, new GoogleAuthProvider());
  };

  const logout = () => {
    signOut(auth);
  };

  const filteredEmails = useMemo(() => {
    return emails.filter(e => 
      e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.metadata.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.metadata.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [emails, searchQuery]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white overflow-hidden relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600 blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400 blur-[120px] animate-pulse delay-700" />
        </div>
        
        <div className="w-full max-w-md relative z-10 space-y-8">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-900/20 mb-2">
              <Command className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-black tracking-tight">OmniMail</h1>
            <p className="text-slate-400 font-medium">Production-grade staffing command center.</p>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-6">
            <div className="space-y-4">
              {[
                { icon: <Zap className="w-4 h-4" />, text: "Real-time Gmail Stream Ingestion" },
                { icon: <Activity className="w-4 h-4" />, text: "AI Candidate Intent Score" },
                { icon: <CheckCircle2 className="w-4 h-4" />, text: "Automated Outreach Workflows" }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="text-indigo-400 bg-indigo-400/10 p-1.5 rounded-lg">{item.icon}</span>
                  {item.text}
                </div>
              ))}
            </div>

            <button 
              onClick={login}
              className="w-full h-14 bg-white text-slate-950 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-100 transition-all active:scale-[0.98]"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" referrerPolicy="no-referrer" />
              Continue with Workspace
            </button>
            <p className="text-[10px] text-center text-slate-500 uppercase tracking-widest font-bold">Secure AI Governance Active</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar Rail */}
      <aside className="w-20 border-r border-slate-100 flex flex-col items-center py-8 gap-8 bg-slate-50/30">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
          <Command className="w-6 h-6 text-white" />
        </div>
        
        <nav className="flex flex-col gap-4 flex-1">
          {[
            { id: 'dashboard', icon: <LayoutDashboard /> },
            { id: 'inbox', icon: <Inbox /> },
            { id: 'workflow', icon: <Workflow /> },
            { id: 'settings', icon: <Settings /> }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                activeTab === item.id 
                  ? "bg-white text-indigo-600 shadow-sm border border-slate-200" 
                  : "text-slate-400 hover:text-slate-600 hover:bg-white"
              )}
            >
              {React.cloneElement(item.icon as React.ReactElement, { className: "w-5 h-5" })}
            </button>
          ))}
        </nav>

        <button onClick={logout} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
          <LogOut className="w-5 h-5" />
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Header Bar */}
        <header className="h-20 border-b border-slate-100 px-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight capitalize">{activeTab}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex h-2 w-2 relative">
                  <span className={cn("inline-flex rounded-full h-2 w-2", isGmailConnected ? "bg-emerald-500" : "bg-slate-300")}></span>
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {isGmailConnected ? "Workspace Synchronized" : "Connection Pending"}
                </span>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-100 mx-2"></div>

            {!isGmailConnected ? (
              <button 
                onClick={handleConnectGmail}
                className="h-9 px-4 bg-indigo-50 text-indigo-600 rounded-full text-[11px] font-bold flex items-center gap-2 hover:bg-indigo-100"
              >
                <ChevronRight className="w-3.5 h-3.5" /> Authorize Streams
              </button>
            ) : (
              <button 
                onClick={handleSyncGmail}
                disabled={isSyncing}
                className={cn(
                  "h-9 px-4 rounded-full text-[11px] font-bold flex items-center gap-2 transition-all shadow-sm",
                  isSyncing 
                    ? "bg-indigo-600 text-white animate-pulse" 
                    : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"
                )}
              >
                {isSyncing ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
                {isSyncing ? "Ingesting..." : "Sync Intelligence"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500" />
              <input 
                type="text" 
                placeholder="Query recruits, roles, or match scores..." 
                className="h-10 w-80 pl-10 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white focus:border-indigo-200 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex -space-x-2">
               <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-9 h-9 rounded-xl border-2 border-white shadow-sm" alt="Profile" referrerPolicy="no-referrer" />
            </div>
          </div>
        </header>

        {/* Dynamic Views */}
        <div className="flex-1 overflow-hidden flex">
          {/* List Area */}
          <div className="w-[450px] border-r border-slate-100 flex flex-col bg-slate-50/20">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Intelligence Stream</h3>
              <Filter className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-pointer" />
            </div>

            <div className="flex-1 overflow-auto scrollbar-hide py-2 px-4 space-y-2">
              {filteredEmails.length > 0 ? filteredEmails.map((email) => (
                <div 
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className={cn(
                    "p-4 rounded-2xl cursor-pointer transition-all border",
                    selectedEmail?.id === email.id 
                      ? "bg-white border-indigo-200 shadow-xl shadow-indigo-100/50 scale-[1.01]" 
                      : "bg-transparent border-transparent hover:bg-white hover:border-slate-100"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                      {email.metadata.candidateName.charAt(0)}
                    </div>
                    <div className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                      email.match_score.score > 80 ? "bg-emerald-50 text-emerald-600" : 
                      email.match_score.score > 50 ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"
                    )}>
                      {email.match_score.score}% Match
                    </div>
                  </div>
                  
                  <h4 className="text-xs font-black text-slate-800 line-clamp-1 mb-1">{email.subject}</h4>
                  <p className="text-[10px] font-bold text-slate-500 mb-2">{email.metadata.candidateName} • {email.metadata.role}</p>
                  <p className="text-[10px] text-slate-400 line-clamp-1">{email.snippet}</p>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-40">
                  <Inbox className="w-12 h-12 mb-4 text-slate-300" />
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Awaiting Feed...</p>
                </div>
              )}
            </div>
          </div>

          {/* Details Area */}
          <div className="flex-1 bg-white overflow-auto p-12">
            {selectedEmail ? (
              <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between border-b border-slate-100 pb-8">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-3xl bg-indigo-600 flex items-center justify-center text-white text-2xl font-black">
                      {selectedEmail.metadata.candidateName.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedEmail.metadata.candidateName}</h2>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                          <Briefcase className="w-3.5 h-3.5" /> {selectedEmail.metadata.role}
                        </span>
                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                        <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                          <Clock className="w-3.5 h-3.5" /> 2h ago
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="h-10 px-6 bg-slate-900 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider hover:bg-slate-800 transition-all">
                      Deploy Outreach
                    </button>
                    <button className="h-10 w-10 border border-slate-200 rounded-xl flex items-center justify-center hover:bg-slate-50">
                      <ExternalLink className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-1 p-6 rounded-2xl border border-slate-100 bg-slate-50/30">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Intelligence Verdict</h5>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-slate-900">{selectedEmail.match_score.score}</span>
                      <span className="text-xs font-black text-slate-400 uppercase">/100</span>
                    </div>
                    <div className="mt-4 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-wider inline-block">
                      High Growth Potential
                    </div>
                  </div>
                  
                  <div className="col-span-2 p-6 rounded-2xl border border-slate-100 bg-white shadow-sm">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">AI Reasoning Analysis</h5>
                    <div className="space-y-3">
                      {selectedEmail.match_score.reasons.map((reason, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-[11px] font-medium text-slate-600 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />
                          {reason}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Signal Context</h5>
                  <div className="p-8 rounded-3xl border border-slate-100 bg-slate-50/10 text-slate-700 leading-relaxed font-sans italic text-sm">
                    "{selectedEmail.snippet}..."
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-6">
                  <Zap className="w-10 h-10 text-slate-200" />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">Omniscient Signal Preview</h3>
                <p className="text-sm text-slate-400 font-medium max-w-sm">Select an intelligence stream from the sidebar to begin candidate triage and outreach deployment.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
