/**
 * Mail Sync Store Slice (syncSlice.js)
 * 
 * [학습 포인트]
 * 1. 계정 교차 검증(Cross-Check): 백그라운드 세션에서 조회된 실제 로그인 이메일과 
 *    사용자가 UI에 입력해 둔 이메일 주소를 비교하여, 일치하지 않으면 보안을 위해 즉시 연동을 차단/해제합니다.
 * 2. Mismatch 상태 저장: UI에 사용자 경고를 노출하기 위해 mismatchError 상태를 관리합니다.
 */

// 런타임 환경 감지 및 스토리지 어댑터 정의
const isExtension = typeof chrome !== 'undefined' && 
                    chrome.storage && 
                    chrome.storage.local && 
                    window.location.protocol === 'chrome-extension:';

const storageAdapter = {
  getItem: async (key) => {
    if (isExtension) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          resolve(result[key] ? JSON.parse(result[key]) : null);
        });
      });
    } else {
      try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : null;
      } catch (e) {
        console.error('Failed to get from localStorage', e);
        return null;
      }
    }
  },
  setItem: async (key, value) => {
    const valStr = JSON.stringify(value);
    if (isExtension) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: valStr }, () => {
          resolve();
        });
      });
    } else {
      try {
        localStorage.setItem(key, valStr);
      } catch (e) {
        console.error('Failed to set to localStorage', e);
      }
    }
  }
};

export const createSyncSlice = (set, get) => ({
  // 1. 상태 (State)
  accounts: [
    { id: 'gmail', name: 'Gmail', connected: false, email: '', color: 'bg-brand-gmail' },
    { id: 'naver', name: 'Naver Mail', connected: false, email: '', color: 'bg-brand-naver' }
  ],
  emails: [],     // 동기화된 이메일 리스트
  isSyncing: false, // 새로고침 중인 상태 표시용
  lastSyncTime: null, // 마지막 성공 동기화 시점 (쿨다운 방어용)
  isHydrated: false, // 로컬 스토리지로부터 상태를 읽어왔는지 여부

  // UI 필터링 및 선택 상태
  selectedAccountId: 'naver', 
  selectedChannel: 'important', 
  selectedMail: null,          
  
  // 보안 및 계정 불일치 에러 상태 추가
  mismatchError: null, // { accountId, expected, actual } 또는 { accountId, type, message }

  // 2. 액션 (Actions)
  hydrateSyncState: async () => {
    try {
      const persistedAccounts = await storageAdapter.getItem('omnimail_accounts');
      if (persistedAccounts && Array.isArray(persistedAccounts)) {
        set((state) => ({
          accounts: state.accounts.map(acc => {
            const found = persistedAccounts.find(p => p.id === acc.id);
            if (found) {
              return { ...acc, connected: found.connected, email: found.email };
            }
            return acc;
          }),
          isHydrated: true
        }));
      } else {
        set({ isHydrated: true });
      }
    } catch (e) {
      console.error('[OmniMail SyncStore] Hydration 중 오류 발생:', e);
      set({ isHydrated: true });
    }
  },

  connectAccount: (id, email) => {
    set((state) => {
      const nextAccounts = state.accounts.map(acc => 
        acc.id === id ? { ...acc, connected: true, email } : acc
      );
      storageAdapter.setItem('omnimail_accounts', nextAccounts);
      return {
        accounts: nextAccounts,
        mismatchError: null
      };
    });
  },
  
  disconnectAccount: (id) => {
    set((state) => {
      const nextAccounts = state.accounts.map(acc => 
        acc.id === id ? { ...acc, connected: false, email: '' } : acc
      );
      storageAdapter.setItem('omnimail_accounts', nextAccounts);
      return {
        accounts: nextAccounts,
        emails: state.emails.filter(mail => mail.accountId !== id),
        selectedAccountId: state.selectedAccountId === id ? 'naver' : state.selectedAccountId,
        selectedMail: state.selectedMail?.accountId === id ? null : state.selectedMail,
        mismatchError: state.mismatchError?.accountId === id ? null : state.mismatchError
      };
    });
  },

  // UI 필터 액션
  setSelectedChannel: (accountId, channel) => set({
    selectedAccountId: accountId,
    selectedChannel: channel,
    selectedMail: null 
  }),

  setSelectedMail: (mail) => set({
    selectedMail: mail
  }),

  // 이메일 새로고침 액션 (하이브리드 지원 및 교차 검증 탑재)
  fetchEmails: async (force = false) => {
    // [PM 가이드라인] 포커스 등 자동 새로고침 시 3분 쿨다운 방어 적용
    const now = Date.now();
    const lastSync = get().lastSyncTime;
    if (!force && lastSync && (now - lastSync < 180000)) {
      console.log('[OmniMail SyncStore] 3분 쿨다운 미경과로 자동 동기화를 건너뜁니다.');
      return;
    }

    set({ isSyncing: true, mismatchError: null });
    
    // 크롬 확장 프로그램 런타임 환경인지 감지 (일반 웹 탭의 오감지 방지를 위해 프로토콜 검증 융합)
    const isExtensionEnv = typeof chrome !== 'undefined' && 
                           chrome.runtime && 
                           chrome.runtime.sendMessage && 
                           window.location.protocol === 'chrome-extension:';

    if (isExtensionEnv) {
      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'REFRESH_MAILS' }, (res) => {
            resolve(res);
          });
        });

        if (response && response.success) {
          // [보안 조치] 계정 교차 검증 (Cross-Check) & 세션 만료 검증
          let hasMismatch = false;
          let mismatchDetails = null;
          let hasSessionExpired = false;
          let expiredAccountId = null;

          const currentAccounts = get().accounts;
          const nextAccounts = currentAccounts.map(acc => ({ ...acc }));

          for (let i = 0; i < nextAccounts.length; i++) {
            const acc = nextAccounts[i];
            if (acc.connected && response.loginEmails) {
              const actualEmail = response.loginEmails[acc.id];
              
              if (!actualEmail) {
                // 스토어상 연결 표시 상태이나, 실제 세션 쿠키가 소멸되어 이메일을 얻어오지 못한 경우 (세션 만료)
                hasSessionExpired = true;
                expiredAccountId = acc.id;
                nextAccounts[i].connected = false;
                nextAccounts[i].email = '';
              } else if (acc.email.toLowerCase().trim() !== actualEmail.toLowerCase().trim()) {
                // 주소 정보가 일치하지 않는 경우 (보안 교차 검증 실패)
                hasMismatch = true;
                mismatchDetails = {
                  accountId: acc.id,
                  expected: acc.email,
                  actual: actualEmail
                };
                nextAccounts[i].connected = false;
                nextAccounts[i].email = '';
              }
            }
          }

          if (hasSessionExpired && expiredAccountId) {
            // 변경된 비활성화 계정 정보를 스토리지에 업데이트
            storageAdapter.setItem('omnimail_accounts', nextAccounts);
            set({
              accounts: nextAccounts,
              mismatchError: {
                accountId: expiredAccountId,
                type: 'session_expired',
                message: `${expiredAccountId === 'naver' ? '네이버' : '구글'} 로그인 세션이 만료되었습니다. 다시 연동해 주세요.`
              },
              isSyncing: false
            });
            console.warn(`[OmniMail SyncStore] ${expiredAccountId} 세션 만료 감지.`);
          } else if (hasMismatch && mismatchDetails) {
            // 계정 불일치 시 스토리지에 업데이트
            storageAdapter.setItem('omnimail_accounts', nextAccounts);
            set({
              accounts: nextAccounts,
              mismatchError: {
                accountId: mismatchDetails.accountId,
                type: 'mismatch',
                expected: mismatchDetails.expected,
                actual: mismatchDetails.actual
              },
              isSyncing: false
            });
            console.error('[OmniMail SyncStore] 계정 교차 검증 불일치 감지:', mismatchDetails);
          } else {
            set({ emails: response.emails, isSyncing: false, mismatchError: null, lastSyncTime: Date.now() });
          }
        } else {
          console.error('[OmniMail SyncStore] 백그라운드 동기화 실패:', response?.error);
          set({ isSyncing: false });
        }
      } catch (error) {
        console.error('[OmniMail SyncStore] 메시지 송신 중 에러:', error);
        set({ isSyncing: false });
      }
    } else {
      // 로컬 Vite Dev Server 또는 Vitest 환경일 때는 가짜(Mock) 데이터 실행
      await new Promise(resolve => setTimeout(resolve, 800));

      const connectedAccounts = get().accounts.filter(acc => acc.connected);
      const mockEmails = [];

      connectedAccounts.forEach(acc => {
        if (acc.id === 'naver') {
          mockEmails.push(
            {
              id: 'naver-1',
              accountId: 'naver',
              senderEmail: 'pay-naver@naver.com',
              senderName: '네이버페이',
              subject: '네이버플러스 멤버십 결제 안내',
              bodySnippet: '네이버플러스 멤버십 이용요금 4,900원이 결제되었습니다.',
              receivedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
            },
            {
              id: 'naver-2',
              accountId: 'naver',
              senderEmail: 'cafe-admin@naver.com',
              senderName: '네이버 카페',
              subject: '가입하신 네이버 카페에 새로운 공지사항이 등록되었습니다.',
              bodySnippet: '이번 주말 카페 정기 정모 및 운영 안내 공지글입니다.',
              receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
            }
          );
        }
        if (acc.id === 'gmail') {
          mockEmails.push(
            {
              id: 'gmail-1',
              accountId: 'gmail',
              senderEmail: 'notifications@github.com',
              senderName: 'GitHub',
              subject: '[GitHub] Security Alert: 1 vulnerability found in dependencies',
              bodySnippet: 'We found a vulnerable dependency in your repository OmniMail.',
              receivedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
            },
            {
              id: 'gmail-2',
              accountId: 'gmail',
              senderEmail: 'hello@newsletter.com',
              senderName: '개발 트렌드 소식지',
              subject: '이번 주 개발 트렌드 소식지 도착!',
              bodySnippet: 'React 19 릴리즈 소식과 Tailwind CSS v4 성능 분석 가이드',
              receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
            }
          );
        }
      });

      set({ emails: mockEmails, isSyncing: false, mismatchError: null, lastSyncTime: Date.now() });
    }
  }
});
