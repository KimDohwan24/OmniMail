import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Shield, 
  Settings, 
  BarChart2, 
  LogIn, 
  LogOut, 
  Sun, 
  Moon, 
  Inbox,
  Lock,
  X,
  Plus,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { useMailStore } from './store';
import { MailSidebar } from './features/mail-sidebar';
import { MailList, SlideOverViewer } from './features/mail-viewer';
import { detectAccountType } from './features/mail-sync/detectAccountType';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
dayjs.locale('ko');

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import './App.css';

const statsData = [
  { name: '월', emails: 14 },
  { name: '화', emails: 28 },
  { name: '수', emails: 19 },
  { name: '목', emails: 34 },
  { name: '금', emails: 23 },
  { name: '토', emails: 8 },
  { name: '일', emails: 12 },
];

/**
 * App Component (OmniMail 통합 메인 진입점 - 도메인 감지 및 교차 검증 탑재)
 * 
 * [학습 포인트]
 * 1. 통합 도메인 추론 폼: 이메일을 타이핑하면 detectAccountType에 의해 실시간으로 
 *    구글/네이버 브랜드 테두리와 아이콘이 동적으로 페이드인 전환됩니다.
 * 2. 교차 검증 경고 피드백: mismatchError가 수신되면, 계정 믹스매치 방지를 위한 보안 알림을 출력합니다.
 * 3. 웜 크림 테마 & 1px Hairline: 독자적 디자인 규격을 흔들림 없이 유지합니다.
 */
function App() {
  const { 
    accounts, 
    emails,
    theme, 
    connectAccount, 
    disconnectAccount, 
    toggleTheme,
    selectedMail,
    setSelectedMail,
    fetchEmails,
    isSyncing,
    mismatchError,
    isHydrated,
    hydrateSyncState
  } = useMailStore();

  const [isConnecting, setIsConnecting] = useState(false);
  const [inputEmail, setInputEmail] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const [isInline, setIsInline] = useState(false);

  // 앱 구동 시 최초 1회 메일 동기화 실행 및 화면 크기/포커스 감지 리스너 등록
  useEffect(() => {
    const init = async () => {
      // 로컬 스토리지로부터 연동 상태 복구 후 동기화 수행
      await hydrateSyncState();
      fetchEmails(true);
    };
    init();

    // 1024px(lg) 이상일 때 인라인 3단 레이아웃 활성화
    const handleResize = () => {
      setIsInline(window.innerWidth >= 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // 창 포커스 진입 시 백그라운드 쿨다운 기반 동기화 구동 (PM 가이드라인에 따른 3분 방어)
    const handleFocus = () => {
      fetchEmails(false);
    };
    window.addEventListener('focus', handleFocus);

    // Esc 키 입력 시 상세 메일 뷰 닫기 (PM 가이드라인에 따른 사용성 강화)
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedMail(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fetchEmails, setSelectedMail, hydrateSyncState]);

  // 실시간 입력된 이메일 도메인 감지
  const detectedProvider = detectAccountType(inputEmail);

  const startConnection = () => {
    setIsConnecting(true);
    setInputEmail('');
  };

  const submitConnection = (e) => {
    e.preventDefault();
    if (!['gmail', 'naver'].includes(detectedProvider)) return;
    
    connectAccount(detectedProvider, inputEmail.trim());
    setIsConnecting(false);
    setInputEmail('');
    
    // 연동 완료 직후 세션 획득 및 교차 검증 실행
    setTimeout(() => {
      fetchEmails();
    }, 150);
  };

  // 감지된 프로바이더에 따른 UI 스타일 바인딩 (UI/UX 톤다운 가이드라인 준수)
  const getInputBorderStyle = () => {
    switch (detectedProvider) {
      case 'gmail':
        return 'border-cursor-semantic-error/60 focus:border-cursor-semantic-error'; // 톤다운 레드
      case 'naver':
        return 'border-cursor-semantic-success/60 focus:border-cursor-semantic-success'; // 톤다운 그린
      case 'unsupported':
        return 'border-cursor-semantic-error focus:border-cursor-semantic-error';
      default:
        return 'border-cursor-hairline focus:border-cursor-primary/50';
    }
  };

  if (!isHydrated) {
    return (
      <div className="flex h-screen w-screen overflow-hidden font-sans text-cursor-body bg-cursor-canvas justify-center items-center">
        {/* 글래스모피즘 스켈레톤 쉬머 */}
        <div className="w-full max-w-4xl p-6 flex flex-col gap-6 animate-pulse">
          <div className="h-8 bg-cursor-surface-strong/30 rounded-lg w-1/4 backdrop-blur-md" />
          <div className="flex gap-6 h-[400px]">
            <div className="w-64 bg-cursor-surface-strong/20 rounded-xl backdrop-blur-md flex flex-col p-4 gap-4">
              <div className="h-6 bg-cursor-surface-strong/30 rounded w-3/4 animate-pulse" />
              <div className="h-6 bg-cursor-surface-strong/30 rounded w-1/2 animate-pulse" />
              <div className="h-6 bg-cursor-surface-strong/30 rounded w-5/6 animate-pulse" />
            </div>
            <div className="flex-1 bg-cursor-surface-strong/10 rounded-xl backdrop-blur-md p-6 flex flex-col gap-4">
              <div className="h-8 bg-cursor-surface-strong/30 rounded animate-pulse" />
              <div className="h-24 bg-cursor-surface-strong/20 rounded animate-pulse" />
              <div className="h-24 bg-cursor-surface-strong/20 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans text-cursor-body bg-cursor-canvas relative">
      
      {/* ---------------- 1단: Slim Left Control Bar (64px) ---------------- */}
      <aside className="w-16 flex flex-col items-center py-6 justify-between border-r border-cursor-hairline bg-cursor-surface-strong/40 shrink-0">
          <div className="flex flex-col items-center gap-6">
            <div className="w-10 h-10 rounded-xl bg-cursor-primary flex items-center justify-center">
              <Mail className="text-white" size={20} />
            </div>
            
            <div className="h-px w-8 bg-cursor-hairline" />

            <button 
              onClick={() => setActiveTab('overview')}
              className={`p-3 rounded-xl transition-all duration-200 cursor-pointer ${
                activeTab === 'overview' 
                  ? 'bg-cursor-surface-strong text-cursor-primary' 
                  : 'text-cursor-muted hover:text-cursor-ink hover:bg-cursor-canvas'
              }`}
            >
              <Inbox size={20} />
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`p-3 rounded-xl transition-all duration-200 cursor-pointer ${
                activeTab === 'analytics' 
                  ? 'bg-cursor-surface-strong text-cursor-primary' 
                  : 'text-cursor-muted hover:text-cursor-ink hover:bg-cursor-canvas'
              }`}
            >
              <BarChart2 size={20} />
            </button>
          </div>

          <div className="flex flex-col items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-3 rounded-xl text-cursor-muted hover:text-cursor-ink hover:bg-cursor-canvas transition-all duration-200 cursor-pointer"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="p-3 rounded-xl text-cursor-muted hover:text-cursor-ink hover:bg-cursor-canvas transition-all cursor-pointer">
              <Settings size={20} />
            </button>
          </div>
        </aside>

        {/* ---------------- 2단: MailSidebar (256px) ---------------- */}
        <MailSidebar />

        {/* ---------------- 3단: Main Content Area ---------------- */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* 헤더 바 */}
          <header className="h-16 px-6 flex items-center justify-between border-b border-cursor-hairline bg-cursor-canvas">
            <div className="flex flex-col">
              <h1 className="text-sm font-semibold tracking-wide text-cursor-ink">
                OmniMail 통합 메일 대시보드
              </h1>
              <span className="text-[10px] text-cursor-muted">
                {dayjs().format('YYYY년 MM월 DD일 dddd')}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cursor-surface-strong/50 border border-cursor-hairline text-xs font-medium text-cursor-ink font-sans">
                <span className={`w-2 h-2 rounded-full animate-pulse transition-colors duration-300 ${
                  isSyncing ? 'bg-[#dfa88f]' : 'bg-[#1f8a65]'
                }`} />
                {isSyncing ? '실시간 동기화 진행 중...' : '실시간 백그라운드 동기화 브로커 구동 중'}
              </div>
            </div>
          </header>

          {/* 탭 분기 렌더링 */}
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' ? (
                // ---------------- OVERVIEW TAB ----------------
                <motion.div 
                  key="overview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full w-full flex overflow-hidden relative"
                >
                  {/* 메일 리스트 영역 (선택 여부에 따라 너비 동적 가변 & 튕김 방지 트랜지션 적용) */}
                  <div className={`h-full flex flex-col transition-all duration-300 ease-in-out ${
                    isInline && selectedMail ? 'w-[400px] xl:w-[480px] shrink-0 border-r border-cursor-hairline-strong' : 'flex-1'
                  }`}>
                    <MailList />
                  </div>

                  {/* 우측 슬롯: 대화면(isInline)에서 메일 선택 상태에 따라 '상세 뷰어'와 '계정 설정'을 크로스페이드 스위칭 */}
                  <AnimatePresence mode="wait">
                    {isInline && selectedMail ? (
                      /* 3단 인라인 상세 뷰어 (대화면에서 메일 선택 시 우측 계정관리를 대체하여 노출) */
                      <SlideOverViewer 
                        key="viewer"
                        email={selectedMail}
                        onClose={() => setSelectedMail(null)}
                        isInline={true}
                      />
                    ) : (
                      /* 우측 사이드바: 계정 관리 및 교차 검증 안내 */
                      <motion.div 
                        key="accounts"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2 }}
                        className="w-80 border-l border-cursor-hairline bg-cursor-canvas-soft p-5 flex flex-col gap-6 overflow-y-auto shrink-0 select-none"
                      >
                        
                        {/* [보안 조치] 계정 교차 검증 경고 배너 표시 */}
                        {mismatchError && (
                          <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="p-4 rounded-xl border border-cursor-semantic-error/40 bg-cursor-semantic-error/5 text-xs text-cursor-semantic-error flex flex-col gap-2 keep-all"
                          >
                            {mismatchError.type === 'session_expired' ? (
                              <>
                                <div className="flex items-center gap-2 font-semibold">
                                  <ShieldAlert size={16} />
                                  <span>로그인 세션 만료</span>
                                </div>
                                <p className="leading-relaxed text-[11px] text-cursor-body">
                                  {mismatchError.message}
                                </p>
                                <a 
                                  href={mismatchError.accountId === 'naver' ? 'https://mail.naver.com/' : 'https://mail.google.com/'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 px-3 py-1.5 bg-cursor-semantic-error/20 hover:bg-cursor-semantic-error/30 text-[10px] font-semibold text-center rounded transition-all cursor-pointer text-cursor-semantic-error hover:no-underline"
                                >
                                  {mismatchError.accountId === 'naver' ? '네이버 로그인 페이지 이동' : '구글 로그인 페이지 이동'}
                                </a>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 font-semibold">
                                  <ShieldAlert size={16} />
                                  <span>보안 경고: 계정 불일치</span>
                                </div>
                                <p className="leading-relaxed text-[11px] text-cursor-body">
                                  입력하신 계정은 <strong>{mismatchError.expected}</strong> 이지만, 실제 브라우저에 로그인된 계정은 <strong>{mismatchError.actual}</strong> 입니다. 보안을 위해 연동이 차단되었습니다.
                                </p>
                              </>
                            )}
                          </motion.div>
                        )}

                        <AnimatePresence mode="wait">
                          {isConnecting ? (
                            // 1) 통합 도메인 추론 연동 폼
                            <motion.div 
                              key="connect-form"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="p-5 rounded-xl border border-cursor-hairline bg-cursor-surface-card flex flex-col gap-4"
                            >
                              <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-xs text-cursor-ink">
                                  통합 이메일 계정 추가
                                </h3>
                                <button 
                                  onClick={() => setIsConnecting(false)}
                                  className="p-1 text-cursor-muted hover:text-cursor-ink rounded cursor-pointer"
                                >
                                  <X size={14} />
                                </button>
                              </div>

                              <form onSubmit={submitConnection} className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1.5">
                                  <label className="text-[10px] text-cursor-muted font-semibold uppercase">이메일 주소</label>
                                  
                                  <div className="relative">
                                    <input 
                                      type="email" 
                                      required
                                      className={`w-full pl-3 pr-8 py-2 rounded bg-cursor-canvas border text-xs text-cursor-ink focus:outline-none transition-all ${getInputBorderStyle()}`}
                                      placeholder="example@naver.com 또는 gmail.com"
                                      value={inputEmail}
                                      onChange={(e) => setInputEmail(e.target.value)}
                                    />
                                    {/* 도메인 매칭 시 브랜드 아이콘 동적 페이드인 연출 */}
                                    <div className="absolute right-2.5 top-2.5 flex items-center justify-center">
                                      {detectedProvider === 'gmail' && (
                                        <span className="w-2.5 h-2.5 rounded-full bg-cursor-semantic-error animate-pulse" title="Gmail 감지됨" />
                                      )}
                                      {detectedProvider === 'naver' && (
                                        <span className="w-2.5 h-2.5 rounded-full bg-cursor-semantic-success animate-pulse" title="Naver Mail 감지됨" />
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Framer Motion을 활용한 도메인 분석 카드 가이드 동적 노출 */}
                                <motion.div layout className="flex flex-col gap-2">
                                  {detectedProvider === null && (
                                    <p className="text-[10px] text-cursor-muted leading-relaxed">
                                      이메일 주소를 입력하시면 도메인을 자동으로 감지하여 세션 연동 폼을 로드합니다.
                                    </p>
                                  )}
                                  
                                  {detectedProvider === 'unsupported' && (
                                    <div className="p-3 rounded bg-cursor-semantic-error/5 border border-cursor-semantic-error/20 text-[10px] text-cursor-semantic-error leading-relaxed keep-all">
                                      앗! 현재 OmniMail은 <strong>Naver Mail</strong>과 <strong>Gmail</strong> 계정만 연동을 제공합니다.
                                    </div>
                                  )}

                                  {detectedProvider === 'gmail' && (
                                    <motion.div 
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      className="p-3 rounded bg-cursor-canvas-soft border border-cursor-semantic-error/20 text-[10px] text-cursor-body flex flex-col gap-1.5 keep-all"
                                    >
                                      <div className="flex items-center gap-1.5 text-cursor-semantic-error font-semibold">
                                        <ShieldCheck size={12} />
                                        <span>Gmail 동기화 감지</span>
                                      </div>
                                      <p className="leading-relaxed text-cursor-muted">
                                        브라우저에 로그인된 구글 세션 정보와 연동을 시작합니다. (최근 읽지 않은 메일 최대 20개 동기화 지원)
                                      </p>
                                    </motion.div>
                                  )}

                                  {detectedProvider === 'naver' && (
                                    <motion.div 
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      className="p-3 rounded bg-cursor-canvas-soft border border-cursor-semantic-success/20 text-[10px] text-cursor-body flex flex-col gap-1.5 keep-all"
                                    >
                                      <div className="flex items-center gap-1.5 text-cursor-semantic-success font-semibold">
                                        <ShieldCheck size={12} />
                                        <span>네이버 메일 동기화 감지</span>
                                      </div>
                                      <p className="leading-relaxed text-cursor-muted">
                                        브라우저에 로그인된 네이버 쿠키 세션 정보와 동기화를 개시합니다.
                                      </p>
                                    </motion.div>
                                  )}
                                </motion.div>

                                <button 
                                  type="submit"
                                  disabled={!['gmail', 'naver'].includes(detectedProvider)}
                                  className={`w-full py-2 text-xs font-semibold rounded transition-all ${
                                    ['gmail', 'naver'].includes(detectedProvider)
                                      ? 'bg-cursor-primary hover:bg-cursor-primary-active text-white cursor-pointer'
                                      : 'bg-cursor-surface-strong text-cursor-muted-soft cursor-not-allowed'
                                  }`}
                                >
                                  연동 및 실시간 동기화
                                </button>
                              </form>
                            </motion.div>
                          ) : (
                            // 2) 일반 계정 리스트 & 보안 안내
                            <motion.div 
                              key="account-list"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex flex-col gap-5"
                            >
                              <div className="flex justify-between items-center mb-1">
                                <h2 className="text-[10px] font-semibold uppercase tracking-wider text-cursor-muted">
                                  연동 계정 설정
                                </h2>
                                <button
                                  onClick={startConnection}
                                  className="flex items-center gap-1 text-[10px] text-cursor-primary hover:text-cursor-primary-active font-semibold transition-all cursor-pointer"
                                >
                                  <Plus size={12} />
                                  <span>계정 추가</span>
                                </button>
                              </div>

                              <div className="flex flex-col gap-3">
                                {accounts.map(acc => (
                                  <div key={acc.id} className="p-3.5 rounded-xl border border-cursor-hairline bg-cursor-surface-card flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                      <div className={`w-7 h-7 rounded ${acc.color} flex items-center justify-center text-white font-bold text-xs`}>
                                        {acc.name.charAt(0)}
                                      </div>
                                      <div>
                                        <h4 className="font-semibold text-xs text-cursor-ink">{acc.name}</h4>
                                        <p className="text-[9px] text-cursor-muted mt-0.5 max-w-[130px] overflow-hidden text-ellipsis whitespace-nowrap font-mono">
                                          {acc.connected ? acc.email : '연동 대기 중'}
                                        </p>
                                      </div>
                                    </div>

                                    {acc.connected && (
                                      <button 
                                        onClick={() => disconnectAccount(acc.id)}
                                        className="p-1.5 text-cursor-muted hover:text-cursor-primary rounded hover:bg-cursor-canvas-soft transition-all cursor-pointer"
                                        title="연동 해제"
                                      >
                                        <LogOut size={14} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* 보안 카드 */}
                              <div className="p-4 rounded-xl border border-cursor-hairline bg-cursor-surface-card flex items-start gap-3">
                                <div className="p-2 bg-cursor-primary/10 text-cursor-primary rounded-lg shrink-0">
                                  <Shield size={16} />
                                </div>
                                <div>
                                  <h4 className="text-xs font-semibold text-cursor-ink">쿠키 보안 샌드박스</h4>
                                  <p className="text-[10px] text-cursor-muted mt-1 leading-relaxed">
                                    비밀번호를 절대 저장하지 않고, 샌드박스 내부 메모리에서만 로그인 쿠키를 이용해 요청한 뒤 안전하게 폐기합니다.
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ) : (
                // ---------------- ANALYTICS TAB ----------------
                <motion.div 
                  key="analytics"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full w-full overflow-y-auto p-6"
                >
                  <div className="max-w-3xl mx-auto flex flex-col gap-6">
                    
                    <div>
                      <h2 className="text-lg font-semibold text-cursor-ink leading-snug">이메일 수신 데이터 통계</h2>
                      <p className="text-xs text-cursor-muted">브라우저 로컬 데이터 기준 주간 유입 추이 분석</p>
                    </div>

                    {/* 차트 */}
                    <div className="p-6 rounded-xl border border-cursor-hairline bg-cursor-surface-card flex flex-col gap-4">
                      <div>
                        <h3 className="text-xs font-semibold text-cursor-ink">요일별 이메일 수신량</h3>
                        <p className="text-[10px] text-cursor-muted">최근 일주일 동안의 수입 이메일 흐름 개요</p>
                      </div>
                      
                      <div className="h-56 w-full mt-2 font-mono">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={statsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorEmails" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f54e00" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#f54e00" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="name" stroke="#807d72" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke="#807d72" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#f7f7f4', borderColor: '#e6e5e0', borderRadius: '8px', color: '#26251e', fontSize: '11px' }} />
                            <Area type="monotone" dataKey="emails" stroke="#f54e00" strokeWidth={1.5} fillOpacity={1} fill="url(#colorEmails)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-cursor-hairline bg-cursor-surface-card">
                        <span className="text-[10px] font-semibold text-cursor-muted uppercase">총 수신량</span>
                        <p className="text-xl font-semibold text-cursor-ink mt-1 font-mono">
                          {emails.length} <span className="text-xs font-normal text-cursor-muted">통</span>
                        </p>
                      </div>
                      <div className="p-4 rounded-xl border border-cursor-hairline bg-cursor-surface-card">
                        <span className="text-[10px] font-semibold text-cursor-muted uppercase">중요 자동 분류 메일</span>
                        <p className="text-xl font-semibold text-cursor-primary mt-1 font-mono">
                          {
                            emails.filter(m => {
                              const cat = useMailStore.getState().accounts.find(a => a.id === m.accountId)?.connected;
                              return cat && useMailStore.getState().emails.filter(em => em.id === m.id).length > 0;
                            }).length
                          } <span className="text-xs font-normal text-cursor-muted">통</span>
                        </p>
                      </div>
                    </div>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </main>

        {/* ---------------- 4단: SlideOverViewer (슬라이드 오버 본문 뷰어 - 모바일/태블릿용) ---------------- */}
        <AnimatePresence>
          {!isInline && selectedMail && (
            <SlideOverViewer 
              email={selectedMail}
              onClose={() => setSelectedMail(null)}
              isInline={false}
            />
          )}
        </AnimatePresence>

      </div>
  );
}

export default App;
