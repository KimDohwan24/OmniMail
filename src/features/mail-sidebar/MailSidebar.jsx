import { useState } from 'react';
import { useMailStore } from '../../store';
import { classifyEmail } from '../mail-classifier/classifier';
import { ChevronDown, ChevronRight, Inbox, Mail, ShieldAlert } from 'lucide-react';

/**
 * MailSidebar Component
 * 
 * [학습 포인트]
 * 1. 로컬 분류 집계: Zustand의 emails 리스트를 classifyEmail 조건식으로 즉석 필터링하여 각 채널(중요/일반)의 메일 개수를 집계합니다.
 * 2. 아코디언 UI 상태 관리: useState를 통해 각 메일사(Naver, Gmail)별 열림/닫힘 상태를 제어합니다.
 * 3. 웜 크림 디자인 테마: Cursor 디자인의 hairline border와 폰트 크기, 간격 토큰을 반영했습니다.
 */
export function MailSidebar() {
  const { 
    accounts, 
    emails, 
    selectedAccountId, 
    selectedChannel, 
    setSelectedChannel,
    keywords,
    domains
  } = useMailStore();

  // 아코디언 상태 관리 (기본값: 둘 다 열어둠)
  const [openAccounts, setOpenAccounts] = useState({
    naver: true,
    gmail: true
  });

  const toggleAccordion = (id) => {
    setOpenAccounts(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // 계정 및 채널별 이메일 개수를 계산하는 함수
  const getMailCount = (accountId, channel) => {
    const accountMails = emails.filter(mail => mail.accountId === accountId);
    
    return accountMails.filter(mail => {
      const category = classifyEmail(mail, keywords, domains);
      return category === channel;
    }).length;
  };

  return (
    <div className="w-64 border-r border-cursor-hairline bg-cursor-canvas flex flex-col h-full select-none">
      
      {/* 사이드바 헤더 */}
      <div className="p-4 border-b border-cursor-hairline bg-cursor-canvas-soft flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-cursor-muted">
          수신 메일 채널
        </span>
      </div>

      {/* 계정 목록 트리 */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {accounts.map(acc => {
          const isOpen = openAccounts[acc.id];
          const isConnected = acc.connected;
          
          return (
            <div key={acc.id} className="flex flex-col gap-1">
              
              {/* 1. 아코디언 헤더 (계정 이름) */}
              <div 
                onClick={() => isConnected && toggleAccordion(acc.id)}
                className={`flex items-center justify-between p-2.5 rounded-lg transition-all duration-200 cursor-pointer ${
                  isConnected ? 'hover:bg-cursor-canvas-soft text-cursor-ink' : 'opacity-50 text-cursor-muted cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    isOpen ? <ChevronDown size={14} className="text-cursor-muted" /> : <ChevronRight size={14} className="text-cursor-muted" />
                  ) : (
                    <ShieldAlert size={14} className="text-cursor-semantic-error" />
                  )}
                  
                  <span className="text-sm font-medium">{acc.name}</span>
                </div>
                
                {isConnected ? (
                  <span className="text-[10px] py-0.5 px-1.5 rounded-full bg-cursor-surface-strong text-cursor-body font-mono">
                    {emails.filter(m => m.accountId === acc.id).length}
                  </span>
                ) : (
                  <span className="text-[10px] text-cursor-semantic-error font-medium">연동 필요</span>
                )}
              </div>

              {/* 2. 아코디언 바디 (채널 목록) */}
              {isConnected && isOpen && (
                <div className="pl-6 flex flex-col gap-0.5 border-l border-cursor-hairline/60 ml-3.5 my-1">
                  
                  {/* 중요 메일 채널 */}
                  <button
                    onClick={() => setSelectedChannel(acc.id, 'important')}
                    className={`flex items-center justify-between py-1.5 px-2.5 rounded-md text-xs transition-all ${
                      selectedAccountId === acc.id && selectedChannel === 'important'
                        ? 'bg-cursor-surface-strong/60 font-semibold text-cursor-primary'
                        : 'text-cursor-body hover:text-cursor-ink hover:bg-cursor-canvas-soft'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Inbox size={12} />
                      <span>#important (중요)</span>
                    </div>
                    <span className="text-[10px] font-mono font-medium text-cursor-muted">
                      {getMailCount(acc.id, 'important')}
                    </span>
                  </button>

                  {/* 일반 메일 채널 */}
                  <button
                    onClick={() => setSelectedChannel(acc.id, 'regular')}
                    className={`flex items-center justify-between py-1.5 px-2.5 rounded-md text-xs transition-all ${
                      selectedAccountId === acc.id && selectedChannel === 'regular'
                        ? 'bg-cursor-surface-strong/60 font-semibold text-cursor-primary'
                        : 'text-cursor-body hover:text-cursor-ink hover:bg-cursor-canvas-soft'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Mail size={12} />
                      <span>#regular (일반)</span>
                    </div>
                    <span className="text-[10px] font-mono font-medium text-cursor-muted">
                      {getMailCount(acc.id, 'regular')}
                    </span>
                  </button>

                </div>
              )}

            </div>
          );
        })}
      </div>

    </div>
  );
}
