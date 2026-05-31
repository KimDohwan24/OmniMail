import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Shield, 
  Settings, 
  BarChart2, 
  RefreshCw, 
  LogIn, 
  LogOut, 
  Sun, 
  Moon, 
  Inbox,
  Lock,
  X
} from 'lucide-react';
import { useMailStore } from './store';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
dayjs.locale('ko');


import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import './App.css';

// Mock stats for chart
const statsData = [
  { name: '월', emails: 14 },
  { name: '화', emails: 28 },
  { name: '수', emails: 19 },
  { name: '목', emails: 34 },
  { name: '금', emails: 23 },
  { name: '토', emails: 8 },
  { name: '일', emails: 12 },
];

function App() {
  const { accounts, theme, connectAccount, disconnectAccount, toggleTheme } = useMailStore();
  const [connectingId, setConnectingId] = useState(null);
  const [inputEmail, setInputEmail] = useState('');
  
  // Local states for UI demos
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const startConnection = (id) => {
    setConnectingId(id);
    setInputEmail('');
  };

  const submitConnection = (e) => {
    e.preventDefault();
    if (!inputEmail.trim()) return;
    connectAccount(connectingId, inputEmail.trim());
    setConnectingId(null);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans text-cursor-body bg-cursor-canvas">
      
      {/* 1. Slim Left Control bar (64px) */}
      <aside className="w-16 flex flex-col items-center py-6 justify-between border-r border-cursor-hairline bg-cursor-canvas-soft">
        <div className="flex flex-col items-center gap-6">
          {/* Logo icon */}
          <div className="w-10 h-10 rounded-xl bg-cursor-primary flex items-center justify-center">
            <Mail className="text-white" size={20} />
          </div>
          
          <div className="h-px w-8 bg-cursor-hairline" />

          {/* Navigation Items */}
          <button 
            onClick={() => setActiveTab('overview')}
            className={`p-3 rounded-xl transition-all duration-200 ${activeTab === 'overview' ? 'bg-cursor-surface-strong text-cursor-primary' : 'text-cursor-muted hover:text-cursor-ink hover:bg-cursor-canvas'}`}
          >
            <Inbox size={20} />
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`p-3 rounded-xl transition-all duration-200 ${activeTab === 'analytics' ? 'bg-cursor-surface-strong text-cursor-primary' : 'text-cursor-muted hover:text-cursor-ink hover:bg-cursor-canvas'}`}
          >
            <BarChart2 size={20} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4">
          {/* Theme switcher */}
          <button 
            onClick={toggleTheme}
            className="p-3 rounded-xl text-cursor-muted hover:text-cursor-ink hover:bg-cursor-canvas transition-all duration-200"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="p-3 rounded-xl text-cursor-muted hover:text-cursor-ink hover:bg-cursor-canvas transition-all">
            <Settings size={20} />
          </button>
        </div>
      </aside>

      {/* 2. Main Content Wrapper */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header bar */}
        <header className="h-16 px-8 flex items-center justify-between border-b border-cursor-hairline bg-cursor-canvas">
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold tracking-wide text-cursor-ink">
              OmniMail 통합 메일함
            </h1>
            <span className="text-xs text-cursor-muted">
              {dayjs().format('YYYY년 MM월 DD일 dddd')}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleRefresh}
              className={`p-2 text-cursor-muted hover:text-cursor-ink transition-all rounded-lg hover:bg-cursor-canvas-soft ${isRefreshing ? 'animate-spin text-cursor-primary' : ''}`}
            >
              <RefreshCw size={18} />
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cursor-surface-strong/50 border border-cursor-hairline text-xs font-medium text-cursor-ink">
              <span className="w-2 h-2 rounded-full bg-brand-naver animate-pulse" />
              네이버 실시간 동기화 중
            </div>
          </div>
        </header>

        {/* Inner Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Left Col: Account manager & Connection states */}
            <div className="md:col-span-1 flex flex-col gap-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-cursor-muted">이메일 계정 연동</h2>
              
              <div className="flex flex-col gap-4">
                {accounts.map(acc => (
                  <motion.div 
                    key={acc.id}
                    layout
                    className="p-5 rounded-xl border border-cursor-hairline bg-cursor-surface-card flex flex-col gap-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${acc.color} flex items-center justify-center text-white font-bold text-xs`}>
                          {acc.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-medium text-sm text-cursor-ink">{acc.name}</h3>
                          <p className="text-xs text-cursor-muted">
                            {acc.connected ? '🟢 연동 완료' : '🔴 연동 필요'}
                          </p>
                        </div>
                      </div>

                      {acc.connected ? (
                        <button 
                          onClick={() => disconnectAccount(acc.id)}
                          className="p-2 text-cursor-muted hover:text-cursor-primary rounded-lg hover:bg-cursor-canvas-soft transition-all"
                        >
                          <LogOut size={16} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => startConnection(acc.id)}
                          className="p-2 text-cursor-primary hover:bg-cursor-canvas-soft rounded-lg transition-all"
                        >
                          <LogIn size={16} />
                        </button>
                      )}
                    </div>

                    {acc.connected && (
                      <div className="text-xs py-1.5 px-3 rounded-lg bg-cursor-canvas-soft text-cursor-body font-mono overflow-hidden text-ellipsis whitespace-nowrap border border-cursor-hairline-soft">
                        {acc.email}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Security Shield Card */}
              <div className="p-5 rounded-xl border border-cursor-hairline bg-cursor-surface-card flex items-start gap-4">
                <div className="p-3 bg-cursor-primary/10 text-cursor-primary rounded-xl">
                  <Shield size={20} />
                </div>
                <div className="keep-all">
                  <h4 className="text-sm font-medium text-cursor-ink">안전한 로컬 샌드박스</h4>
                  <p className="text-xs text-cursor-muted mt-1 leading-relaxed">
                    사용자 인증 정보는 크롬 브라우저의 활성화된 로그인 세션 쿠키를 통해 안전하게 연동됩니다. 이메일 비밀번호는 시스템에 절대 저장되거나 외부로 전송되지 않습니다.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Col: Connection forms or Dashboard details */}
            <div className="md:col-span-2">
              <AnimatePresence mode="wait">
                {connectingId ? (
                  // ACCOUNT CONNECT SCENE
                  <motion.div 
                    key="connect-form"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="p-8 rounded-xl border border-cursor-hairline bg-cursor-surface-card flex flex-col gap-6"
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-medium text-cursor-ink">{accounts.find(a => a.id === connectingId)?.name} 계정 연결</h2>
                      <button 
                        onClick={() => setConnectingId(null)}
                        className="p-2 text-cursor-muted hover:text-cursor-ink rounded-lg hover:bg-cursor-canvas-soft transition-all"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <form onSubmit={submitConnection} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-cursor-muted font-medium uppercase tracking-wider">이메일 주소</label>
                        <input 
                          type="email" 
                          required
                          className="px-4 py-3 rounded-lg bg-cursor-canvas-soft border border-cursor-hairline focus:border-cursor-primary/50 text-sm text-cursor-ink focus:outline-none transition-all"
                          placeholder={connectingId === 'naver' ? 'example@naver.com' : 'example@gmail.com'}
                          value={inputEmail}
                          onChange={(e) => setInputEmail(e.target.value)}
                        />
                      </div>

                      <div className="p-4 rounded-lg bg-cursor-canvas-soft border border-cursor-hairline-soft text-xs text-cursor-muted flex items-start gap-3 keep-all">
                        <Lock size={16} className="text-cursor-primary shrink-0 mt-0.5" />
                        <span>
                          보안 및 원활한 연동을 위해, 브라우저의 다른 탭에서 해당 이메일 서비스(네이버 또는 구글)에 로그인되어 있는지 확인해 주세요.
                        </span>
                      </div>

                      <div className="flex gap-3 justify-end mt-4">
                        <button 
                          type="button"
                          onClick={() => setConnectingId(null)}
                          className="px-5 py-2.5 rounded-lg border border-cursor-hairline-strong hover:bg-cursor-canvas-soft text-sm font-medium text-cursor-ink transition-all shrink-0 whitespace-nowrap"
                        >
                          취소
                        </button>
                        <button 
                          type="submit"
                          className="px-5 py-2.5 rounded-lg bg-cursor-primary hover:bg-cursor-primary-active text-white text-sm font-medium transition-all shrink-0 whitespace-nowrap"
                        >
                          인증 및 동기화
                        </button>
                      </div>
                    </form>
                  </motion.div>
                ) : (
                  // DASHBOARD DEMO SCENE
                  <motion.div 
                    key="main-dashboard"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="flex flex-col gap-8"
                  >
                    {/* Welcome Banner */}
                    <div className="p-8 rounded-xl border border-cursor-hairline bg-cursor-canvas-soft relative overflow-hidden">
                      <div className="relative z-10 keep-all">
                        <h2 className="text-2xl font-semibold tracking-tight text-cursor-ink mb-2">OmniMail 통합 메일 대시보드</h2>
                        <p className="text-sm text-cursor-body max-w-md leading-relaxed">
                          이메일 통합 관리 공간이 준비되었습니다. 사이드바에서 네이버와 Gmail을 연동하여 수신 메일을 실시간으로 확인해 보세요.
                        </p>
                      </div>
                    </div>

                    {/* Stats Chart Card */}
                    <div className="p-6 rounded-xl border border-cursor-hairline bg-cursor-surface-card flex flex-col gap-4">
                      <div className="keep-all">
                        <h3 className="text-xs font-semibold tracking-wider text-cursor-muted uppercase">이메일 수신 흐름 개요</h3>
                        <p className="text-xs text-cursor-muted-soft">주간 이메일 유입 추이 (테스트 데이터)</p>
                      </div>
                      
                      <div className="h-48 w-100 mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={statsData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorEmails" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f54e00" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#f54e00" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="name" stroke="#807d72" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="#807d72" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e6e5e0', borderRadius: '8px', color: '#26251e' }} />
                            <Area type="monotone" dataKey="emails" stroke="#f54e00" strokeWidth={2} fillOpacity={1} fill="url(#colorEmails)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>
      </main>

    </div>
  );
}

export default App;
