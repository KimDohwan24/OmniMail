import { detectAccountType } from './detectAccountType';
import { parseGmailAtomFeed, parseNaverMails } from './syncService';

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

// 프론트엔드 직접 fetch에 필요한 모듈 로직 유지
export const createSyncSlice = (set, get) => ({
  // 1. 상태 (State)
  accounts: [
    { id: 'naver', name: 'Naver Mail', connected: false, email: '', color: 'bg-brand-naver' },
    { id: 'gmail', name: 'Gmail', connected: false, email: '', color: 'bg-brand-gmail' }
  ],
  emails: [],     // 동기화된 이메일 리스트
  isSyncing: false, // 새로고침 중인 상태 표시용
  lastSyncTime: null, // 마지막 성공 동기화 시점 (쿨다운 방어용)
  isHydrated: false, // 로컬 스토리지로부터 상태를 읽어왔는지 여부
  connectionError: false, // 백그라운드 스크립트와의 연결 유실 여부
  hasHostPermissions: true, // 실시간 감지용 크롬 호스트 권한 획득 여부
  sessionDebugLogs: [], // 실시간 감지 상세 디버깅 로그
  customKeywords: [],   // 지메일 커스텀 검색 키워드 목록
  
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
          })
        }));
      }

      // 커스텀 키워드 데이터 복구
      const persistedKeywords = await storageAdapter.getItem('omnimail_custom_keywords');
      if (persistedKeywords && Array.isArray(persistedKeywords)) {
        const migrated = persistedKeywords.map(item => {
          if (typeof item === 'string') {
            return { keyword: item, target: 'all' };
          }
          return item;
        });
        set({ customKeywords: migrated });
        await storageAdapter.setItem('omnimail_custom_keywords', migrated);
      }
      
      set({ isHydrated: true });
      
      // 호스트 권한 여부 선검사 후 세션 감지 자동 실행
      const hasPerm = await get().checkHostPermissions();
      if (hasPerm) {
        await get().detectSessions();
      }
    } catch (e) {
      console.error('[OmniMail SyncStore] Hydration 중 오류 발생:', e);
      set({ isHydrated: true });
    }
  },

  addCustomKeyword: async (keyword, target = 'all') => {
    const clean = keyword.trim();
    if (!clean) return;
    const current = get().customKeywords;
    if (current.some(k => k.keyword === clean)) return;

    const nextKeywords = [...current, { keyword: clean, target }];
    set({ customKeywords: nextKeywords });
    await storageAdapter.setItem('omnimail_custom_keywords', nextKeywords);
    
    // 키워드가 추가되면 메일 데이터 즉시 새로고침
    await get().fetchEmails(true);
  },

  removeCustomKeyword: async (keyword) => {
    const current = get().customKeywords;
    const nextKeywords = current.filter(k => k.keyword !== keyword);
    
    set((state) => {
      const isSelected = state.selectedChannel === keyword;
      const defaultChannel = state.selectedAccountId === 'gmail' ? 'recent' : 'important';
      return {
        customKeywords: nextKeywords,
        selectedChannel: isSelected ? defaultChannel : state.selectedChannel,
        selectedMail: state.selectedMail?.subject?.includes(keyword) ? null : state.selectedMail
      };
    });
    
    await storageAdapter.setItem('omnimail_custom_keywords', nextKeywords);
    // 키워드가 제거되면 메일 데이터 갱신
    await get().fetchEmails(true);
  },

  checkHostPermissions: async () => {
    const isExtensionEnv = typeof chrome !== 'undefined' && 
                           chrome.permissions && 
                           chrome.permissions.contains;
    if (isExtensionEnv) {
      try {
        const hasPerm = await new Promise((resolve) => {
          chrome.permissions.contains({
            origins: [
              "*://*.naver.com/*",
              "*://*.google.com/*"
            ]
          }, (result) => {
            resolve(!!result);
          });
        });
        set({ hasHostPermissions: hasPerm });
        return hasPerm;
      } catch (err) {
        console.error('[OmniMail SyncStore] 호스트 권한 확인 중 에러:', err);
        return false;
      }
    }
    set({ hasHostPermissions: true }); // Mock 환경은 기본 true
    return true;
  },

  detectSessions: async () => {
    const isExtensionEnv = typeof chrome !== 'undefined' && 
                           chrome.cookies && 
                           chrome.declarativeNetRequest && 
                           window.location.protocol === 'chrome-extension:';
    if (isExtensionEnv) {
      const logs = [];
      logs.push('[Dashboard] 실시간 세션 스캔 시작...');
      
      let naverEmail = '';
      let gmailEmail = '';

      // 1. 네이버 세션 감지
      logs.push('[Naver] 세션 감지 시작...');
      try {
        logs.push('[Naver] API (v2/api/mail/init) Fetch 요청 전송 중 (credentials: include)...');
        const initResponse = await fetch('https://mail.naver.com/v2/api/mail/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({})
        });
        
        logs.push(`[Naver] API Response HTTP Status: ${initResponse.status}`);
        if (initResponse.ok) {
          const initText = await initResponse.text();
          const firstChars = initText.substring(0, 50).trim();
          logs.push(`[Naver] API 응답 데이터 수신 완료 (첫 50자: ${firstChars})`);
          if (!initText.trim().startsWith('<')) {
            const initData = JSON.parse(initText);
            const email = initData.userEmail || initData.envInfo?.emailAddress || '';
            if (email) {
              logs.push(`[Naver] 세션 이메일 추출 성공: ${email.substring(0, 3)}***`);
              naverEmail = email;
            } else {
              logs.push('[Naver] API 응답 내에 이메일 정보가 비어있습니다.');
            }
          } else {
            logs.push('[Naver] API 응답이 HTML 형식(로그인 리다이렉션)입니다. 세션이 만료된 것으로 판단됩니다.');
          }
        } else {
          logs.push(`[Naver] API 실패 - Status: ${initResponse.status}`);
        }
      } catch (e) {
        logs.push(`[Naver Error] 감지 과정 중 예외 발생: ${e.message || e}`);
      }

      // 2. 지메일 세션 감지
      logs.push('[Gmail] 세션 감지 시작...');
      try {
        logs.push('[Gmail] API (feed/atom) Fetch 요청 전송 중 (credentials: include)...');
        const response = await fetch('https://mail.google.com/mail/feed/atom', {
          method: 'GET',
          credentials: 'include'
        });
        
        logs.push(`[Gmail] API Response HTTP Status: ${response.status}`);
        if (response.ok && response.status !== 401) {
          const xmlText = await response.text();
          const firstChars = xmlText.substring(0, 50).trim();
          logs.push(`[Gmail] API 응답 데이터 수신 완료 (첫 50자: ${firstChars})`);
          if (!xmlText.trim().startsWith('<html') && !xmlText.includes('Sign in')) {
            const titleMatch = xmlText.match(/<title>Gmail - Inbox for (.*?)<\/title>/);
            if (titleMatch && titleMatch[1]) {
              const email = titleMatch[1].trim();
              logs.push(`[Gmail] 세션 이메일 추출 성공: ${email.substring(0, 3)}***`);
              gmailEmail = email;
            } else {
              logs.push('[Gmail] Atom Feed 응답 타이틀에서 이메일을 추출하지 못했습니다.');
            }
          } else {
            logs.push('[Gmail] API 응답이 HTML(로그인 유도) 페이지입니다. 세션이 유효하지 않습니다.');
          }
        } else {
          logs.push(`[Gmail] API 실패 - Status: ${response.status}`);
        }
      } catch (e) {
        logs.push(`[Gmail Error] 감지 과정 중 예외 발생: ${e.message || e}`);
      }

      logs.push('[Dashboard] 실시간 세션 스캔 완료.');
      set({
        detectedSessions: { naver: naverEmail, gmail: gmailEmail },
        sessionDebugLogs: logs
      });
    } else {
      // Mock 환경 (Vite Dev Server, Vitest)
      set({
        detectedSessions: {
          naver: 'test.user@naver.com',
          gmail: 'test.user@gmail.com'
        }
      });
    }
  },

  connectAccount: async (id, email) => {
    // 1. 형식 검증
    const detectedType = detectAccountType(email);
    if (!detectedType || detectedType !== id) {
      set((state) => {
        const nextAccounts = state.accounts.map(acc => 
          acc.id === id ? { ...acc, connected: false, email: '' } : acc
        );
        storageAdapter.setItem('omnimail_accounts', nextAccounts);
        return {
          accounts: nextAccounts,
          mismatchError: {
            accountId: id,
            type: 'invalid_domain',
            message: `${id === 'naver' ? '네이버' : '구글'} 이메일 형식만 연동 가능합니다.`
          }
        };
      });
      return;
    }

    const isExtensionEnv = typeof chrome !== 'undefined' && 
                           chrome.cookies && 
                           chrome.declarativeNetRequest && 
                           window.location.protocol === 'chrome-extension:';

    if (isExtensionEnv) {
      try {
        set({ isSyncing: true, mismatchError: null });
        let actualEmail = '';

        if (id === 'naver') {
          const initResponse = await fetch('https://mail.naver.com/v2/api/mail/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({})
          });

          if (initResponse.ok) {
            const initText = await initResponse.text();
            if (!initText.trim().startsWith('<')) {
              const initData = JSON.parse(initText);
              actualEmail = initData.userEmail || initData.envInfo?.emailAddress || '';
            }
          }
        } else if (id === 'gmail') {
          const response = await fetch('https://mail.google.com/mail/feed/atom', {
            method: 'GET',
            credentials: 'include'
          });

          if (response.ok && response.status !== 401) {
            const xmlText = await response.text();
            if (!xmlText.trim().startsWith('<html') && !xmlText.includes('Sign in')) {
              const titleMatch = xmlText.match(/<title>Gmail - Inbox for (.*?)<\/title>/);
              if (titleMatch && titleMatch[1]) {
                actualEmail = titleMatch[1].trim();
              }
            }
          }
        }

        if (actualEmail) {
          if (actualEmail.toLowerCase().trim() !== email.toLowerCase().trim()) {
            set((state) => {
              const nextAccounts = state.accounts.map(acc => 
                acc.id === id ? { ...acc, connected: false, email: '' } : acc
              );
              storageAdapter.setItem('omnimail_accounts', nextAccounts);
              return {
                accounts: nextAccounts,
                mismatchError: {
                  accountId: id,
                  type: 'mismatch',
                  expected: email,
                  actual: actualEmail,
                  message: `입력하신 이메일(${email})이 현재 브라우저에 로그인된 계정(${actualEmail})과 일치하지 않습니다.`
                },
                isSyncing: false
              };
            });
          } else {
            set((state) => {
              const nextAccounts = state.accounts.map(acc => 
                acc.id === id ? { ...acc, connected: true, email } : acc
              );
              storageAdapter.setItem('omnimail_accounts', nextAccounts);
              return {
                accounts: nextAccounts,
                mismatchError: null,
                isSyncing: false
              };
            });
          }
        } else {
          throw new Error('로그인 세션을 찾을 수 없습니다. 브라우저에서 먼저 로그인을 진행해 주세요.');
        }
      } catch (error) {
        set((state) => {
          const nextAccounts = state.accounts.map(acc => 
            acc.id === id ? { ...acc, connected: false, email: '' } : acc
          );
          storageAdapter.setItem('omnimail_accounts', nextAccounts);
          return {
            accounts: nextAccounts,
            mismatchError: {
              accountId: id,
              type: 'verify_failed',
              message: error.message || '실시간 세션 검증 중 에러가 발생했습니다.'
            },
            isSyncing: false
          };
        });
      }
    } else {
      // Mock 환경
      const cleanEmail = email.toLowerCase().trim();
      const isMockSuccess = (id === 'naver' && cleanEmail === 'test.user@naver.com') ||
                            (id === 'gmail' && cleanEmail === 'test.user@gmail.com');
      
      if (isMockSuccess) {
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
      } else {
        set((state) => {
          const nextAccounts = state.accounts.map(acc => 
            acc.id === id ? { ...acc, connected: false, email: '' } : acc
          );
          storageAdapter.setItem('omnimail_accounts', nextAccounts);
          return {
            accounts: nextAccounts,
            mismatchError: {
              accountId: id,
              type: 'session_mismatch',
              message: '로그인 세션이 일치하지 않거나 세션이 만료되었습니다.'
            }
          };
        });
      }
    }
  },
  
  disconnectAccount: async (id) => {
    set((state) => {
      const nextAccounts = state.accounts.map(acc => 
        acc.id === id ? { ...acc, connected: false, email: '' } : acc
      );
      storageAdapter.setItem('omnimail_accounts', nextAccounts);
      
      const nextAccountId = state.selectedAccountId === id ? 'naver' : state.selectedAccountId;
      const nextChannel = state.selectedAccountId === id ? 'important' : state.selectedChannel;

      return {
        accounts: nextAccounts,
        emails: state.emails.filter(mail => mail.accountId !== id),
        selectedAccountId: nextAccountId,
        selectedChannel: nextChannel,
        selectedMail: state.selectedMail?.accountId === id ? null : state.selectedMail,
        mismatchError: state.mismatchError?.accountId === id ? null : state.mismatchError
      };
    });

    // 권한 자발적 반납 (보안 피드백 반영)
    const isExtensionEnv = typeof chrome !== 'undefined' && 
                           chrome.permissions && 
                           chrome.permissions.remove;
    if (isExtensionEnv) {
      try {
        const origin = id === 'naver' ? "*://*.naver.com/*" : "*://*.google.com/*";
        await new Promise((resolve) => {
          chrome.permissions.remove({ origins: [origin] }, (removed) => {
            resolve(removed);
          });
        });
        // 권한 상태 갱신
        await get().checkHostPermissions();
      } catch (err) {
        console.error('[OmniMail SyncStore] 호스트 권한 반납 중 에러:', err);
      }
    }
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
    const now = Date.now();
    const lastSync = get().lastSyncTime;
    if (!force && lastSync && (now - lastSync < 180000)) {
      console.log('[OmniMail SyncStore] 3분 쿨다운 미경과로 자동 동기화를 건너뜁니다.');
      return;
    }

    set({ isSyncing: true, mismatchError: null });

    const isExtensionEnv = typeof chrome !== 'undefined' && 
                           chrome.cookies && 
                           chrome.declarativeNetRequest && 
                           window.location.protocol === 'chrome-extension:';

    if (isExtensionEnv) {
      try {
        const currentAccounts = get().accounts;
        let combinedMails = [];
        let loginEmails = { naver: '', gmail: '' };

        let hasMismatch = false;
        let mismatchDetails = null;
        let hasSessionExpired = false;
        let expiredAccountId = null;

        // 1. 네이버 메일 동기화 (연동 시에만)
        const naverAcc = currentAccounts.find(a => a.id === 'naver');
        if (naverAcc && naverAcc.connected) {
          let naverEmail = '';
          let tempKey = '';
          let naverMails = [];
          let naverSuccess = false;

          try {
            const initRes = await fetch('https://mail.naver.com/v2/api/mail/init', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({})
            });

            if (initRes.ok) {
              const initText = await initRes.text();
              if (!initText.trim().startsWith('<')) {
                const initData = JSON.parse(initText);
                naverEmail = initData.userEmail || initData.envInfo?.emailAddress || '';
                tempKey = initData.tempKey || '';
                naverSuccess = true;
              }
            }
          } catch (e) {
            console.error('[Naver Init Fetch Error]', e);
          }

          if (naverSuccess) {
            const listHeaders = { 'Content-Type': 'application/json' };
            if (tempKey) {
              listHeaders['tempKey'] = tempKey;
            }

            try {
              const listRes = await fetch('https://mail.naver.com/v2/api/mail/list', {
                method: 'POST',
                headers: listHeaders,
                credentials: 'include',
                body: JSON.stringify({
                  page: 1,
                  folderSn: 0,
                  sortField: 'receivedTime',
                  sortType: 'desc',
                  size: 30
                })
              });

              if (listRes.ok) {
                const listText = await listRes.text();
                if (!listText.trim().startsWith('<')) {
                  const data = JSON.parse(listText);
                  naverMails = parseNaverMails(data);
                  combinedMails = [...combinedMails, ...naverMails];
                  loginEmails.naver = naverEmail;
                } else {
                  naverSuccess = false;
                }
              } else {
                naverSuccess = false;
              }
            } catch (e) {
              console.error('[Naver List Fetch Error]', e);
              naverSuccess = false;
            }
          }

          if (!naverSuccess) {
            hasSessionExpired = true;
            expiredAccountId = 'naver';
          } else if (naverEmail && naverAcc.email.toLowerCase().trim() !== naverEmail.toLowerCase().trim()) {
            hasMismatch = true;
            mismatchDetails = {
              accountId: 'naver',
              expected: naverAcc.email,
              actual: naverEmail
            };
          }
        }

        // 2. 지메일 메일 동기화 (연동 시에만)
        const gmailAcc = currentAccounts.find(a => a.id === 'gmail');
        if (gmailAcc && gmailAcc.connected) {
          let gmailEmail = '';
          let gmailMails = [];
          let gmailSuccess = false;

          try {
            const res = await fetch('https://mail.google.com/mail/feed/atom', {
              method: 'GET',
              credentials: 'include'
            });

            if (res.status === 401) {
              gmailSuccess = false;
            } else if (res.ok) {
              const xmlText = await res.text();
              if (!xmlText.trim().startsWith('<html') && !xmlText.includes('Sign in')) {
                gmailMails = [...gmailMails, ...parseGmailAtomFeed(xmlText)];
                gmailSuccess = true;

                const titleMatch = xmlText.match(/<title>Gmail - Inbox for (.*?)<\/title>/);
                if (titleMatch && titleMatch[1]) {
                  gmailEmail = titleMatch[1].trim();
                  loginEmails.gmail = gmailEmail;
                }
              }
            }
          } catch (e) {
            console.error('[Gmail Fetch Error]', e);
          }

          // 커스텀 키워드 검색 피드 병렬 연동
          const keywords = get().customKeywords;
          if (gmailSuccess && keywords && keywords.length > 0) {
            try {
              const searchPromises = keywords.map(async (kwObj) => {
                const kw = kwObj.keyword;
                try {
                  const searchRes = await fetch(`https://mail.google.com/mail/feed/atom?q=${encodeURIComponent(kw)}`, {
                    method: 'GET',
                    credentials: 'include'
                  });
                  if (searchRes.ok) {
                    const xml = await searchRes.text();
                    if (!xml.trim().startsWith('<html') && !xml.includes('Sign in')) {
                      return parseGmailAtomFeed(xml);
                    }
                  }
                } catch (err) {
                  console.error(`[Gmail Keyword Fetch Error for ${kw}]`, err);
                }
                return [];
              });

              const searchResults = await Promise.all(searchPromises);
              searchResults.forEach(mails => {
                gmailMails = [...gmailMails, ...mails];
              });
            } catch (searchErr) {
              console.error('[Gmail Custom Keywords Fetch Error]', searchErr);
            }
          }

          // ID 기준 중복 제거
          const uniqueGmailMails = [];
          const seenIds = new Set();
          for (const m of gmailMails) {
            if (!seenIds.has(m.id)) {
              seenIds.add(m.id);
              uniqueGmailMails.push(m);
            }
          }

          if (gmailSuccess) {
            combinedMails = [...combinedMails, ...uniqueGmailMails];
          }

          if (!gmailSuccess) {
            hasSessionExpired = true;
            expiredAccountId = 'gmail';
          } else if (gmailEmail && gmailAcc.email.toLowerCase().trim() !== gmailEmail.toLowerCase().trim()) {
            hasMismatch = true;
            mismatchDetails = {
              accountId: 'gmail',
              expected: gmailAcc.email,
              actual: gmailEmail
            };
          }
        }

        const nextAccounts = currentAccounts.map(acc => ({ ...acc }));

        if (hasSessionExpired && expiredAccountId) {
          const idx = nextAccounts.findIndex(a => a.id === expiredAccountId);
          if (idx !== -1) {
            nextAccounts[idx].connected = false;
            nextAccounts[idx].email = '';
          }
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
        } else if (hasMismatch && mismatchDetails) {
          const idx = nextAccounts.findIndex(a => a.id === mismatchDetails.accountId);
          if (idx !== -1) {
            nextAccounts[idx].connected = false;
            nextAccounts[idx].email = '';
          }
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
        } else {
          // 성공 수집된 이메일을 상태에 바인딩
          set({
            emails: combinedMails,
            isSyncing: false,
            mismatchError: null,
            lastSyncTime: Date.now()
          });
        }
      } catch (error) {
        console.error('[OmniMail SyncStore] 직접 동기화 에러:', error);
        set({ isSyncing: false });
      }
    } else {
      // Mock 환경
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
