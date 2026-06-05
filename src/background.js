import { parseGmailAtomFeed, parseNaverMails } from './features/mail-sync/syncService';

/**
 * OmniMail Chrome Extension - Background Service Worker (Advanced Sizing & Security)
 * 
 * [학습 포인트]
 * 1. Single Tab Policy: 중복 탭 생성을 예방하기 위해 기존 대시보드 탭의 존재 여부를 
 *    chrome.tabs.query로 조회한 뒤, 존재하면 활성화 포커스만 이동시킵니다.
 * 2. chrome.action.onClicked: 팝업창을 생략하고 확장 아이콘 클릭 즉시 새 탭 오픈 이벤트를 캡처합니다.
 * 3. Sender Verification: 보안 위조 방지를 위해 sender.id와 chrome.runtime.id가 일치하는지 교차 검증합니다.
 */

console.log('[OmniMail Background] 서비스 워커가 로드되었습니다!');

if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    console.log('[OmniMail Debug] DNR 규칙 매칭 감지:', info);
  });
}

// 1. 확장 프로그램 아이콘 클릭 시 새 탭 전체 화면 활성화 (Single Tab Policy)
chrome.action.onClicked.addListener(async () => {
  const dashboardUrl = chrome.runtime.getURL('index.html');
  
  try {
    // 브라우저의 전체 탭을 검색하여 OmniMail 대시보드가 열려 있는지 확인합니다.
    const tabs = await chrome.tabs.query({});
    const existingTab = tabs.find(tab => tab.url === dashboardUrl);

    if (existingTab) {
      // 이미 대시보드 탭이 있다면 해당 탭을 전면으로 활성화하고 창을 활성화합니다.
      await chrome.tabs.update(existingTab.id, { active: true });
      await chrome.windows.update(existingTab.windowId, { drawAttention: true, focused: true });
      console.log('[OmniMail Background] 기존 대시보드 탭을 감지하여 포커스를 전환했습니다.');
    } else {
      // 켜져 있는 탭이 없을 경우에만 신규 새 탭으로 넓게 열어줍니다.
      await chrome.tabs.create({ url: dashboardUrl });
      console.log('[OmniMail Background] 새 탭 전체 화면으로 대시보드를 생성했습니다.');
    }
  } catch (error) {
    console.error('[OmniMail Background] 대시보드 탭 전환 에러:', error);
    // 폴백 조치: 에러 시 일단 새 탭 생성
    chrome.tabs.create({ url: dashboardUrl });
  }
});

// 2. 알람(Alarm)을 활용한 주기적 백그라운드 동기화 셋업
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('omnimail-sync-alarm', { periodInMinutes: 10 });
  console.log('[OmniMail Background] 10분 주기 동기화 알람이 생성되었습니다.');
});

// 알람 이벤트 리스너
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'omnimail-sync-alarm') {
    console.log('[OmniMail Background] 백그라운드 10분 동기화 알람이 발동했습니다!');
    runSilentSync();
  }
});

// 3. React UI(새 탭 대시보드)와 소통하는 메시지 리스너 (프록시 프레임)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // [보안 조치] 발신처 무결성 검증 (우리 확장 프로그램 내부 컨텍스트에서 전송된 메시지만 응답)
  if (sender.id !== chrome.runtime.id) {
    console.error('[OmniMail Background] 비인가 발신처로부터의 메시징 유입을 차단했습니다.');
    return false; // 즉시 채널 닫기
  }

  if (request.action === 'REFRESH_MAILS') {
    console.log('[OmniMail Background] 실시간 동기화 요청(REFRESH_MAILS)을 수신했습니다.');
    executeSync(sendResponse);
    return true; // 비동기 응답 채널 유지 (확실하게 격리)
  }

  if (request.action === 'VERIFY_ACCOUNT') {
    console.log('[OmniMail Background] 실시간 세션 검증 요청(VERIFY_ACCOUNT)을 수신했습니다.', request.accountId);
    executeVerify(request.accountId, request.email, sendResponse);
    return true; // 비동기 응답 채널 유지 (확실하게 격리)
  }

  if (request.action === 'DETECT_SESSIONS') {
    console.log('[OmniMail Background] 실시간 세션 감지 요청(DETECT_SESSIONS)을 수신했습니다.');
    executeDetectSessions(sendResponse);
    return true; // 비동기 응답 채널 유지 (확실하게 격리)
  }
  
  if (request.action === 'PING') {
    sendResponse({ status: 'PONG', message: '백그라운드가 연결되어 있습니다!' });
    return false; // 동기 응답 완료 후 즉시 채널 닫기
  }
  
  return false; // 정의되지 않은 액션은 즉시 채널 닫기
});

/**
 * 실제 이메일 동기화를 집행하고 그 결과를 리액트 UI에 반환하는 코어 함수
 */
async function executeSync(sendResponse) {
  try {
    const naverResult = await syncNaverMail();
    const gmailResult = await syncGmailMail();
    
    const combinedMails = [...naverResult.emails, ...gmailResult.emails];
    
    sendResponse({
      success: true,
      emails: combinedMails,
      loginEmails: {
        naver: naverResult.loginEmail,
        gmail: gmailResult.loginEmail
      }
    });
  } catch (error) {
    console.error('[OmniMail Background] 동기화 오류 발생:', error);
    sendResponse({
      success: false,
      error: error.message || '이메일을 동기화하는 도중 에러가 발생했습니다.'
    });
  }
}

/**
 * 백그라운드 자동 주기적 동기화용 (UI 응답 없이 사일런트 구동)
 */
async function runSilentSync() {
  try {
    const naverResult = await syncNaverMail();
    const gmailResult = await syncGmailMail();
    const count = naverResult.emails.length + gmailResult.emails.length;
    
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#f54e00' });
  } catch (e) {
    console.error('[OmniMail Background] 사일런트 동기화 실패:', e);
  }
}

/**
 * Naver/Nid 쿠키 통합 획득 및 DNR 동적 세션 규칙 설정 헬퍼 함수
 */
async function setupNaverDNR(ruleId) {
  let cookieHeader = '';
  try {
    // 1. chrome.cookies API를 사용하여 naver.com 및 하위 도메인 관련 쿠키들을 획득합니다.
    const cookies = await new Promise((resolve) => {
      chrome.cookies.getAll({ domain: 'naver.com' }, (cookies) => {
        resolve(cookies || []);
      });
    });
    if (cookies && cookies.length > 0) {
      const naverWhitelist = ['NID_AUT', 'NID_SES', 'NNB', 'NEO_SES'];
      const nowInSeconds = Date.now() / 1000;
      const validCookies = cookies.filter(c => {
        if (c.expirationDate && c.expirationDate < nowInSeconds) {
          return false;
        }
        if (!c.name || !c.value) return false;
        const dom = c.domain || '';
        const isNaverDomain = dom === 'naver.com' || dom.endsWith('.naver.com');
        return isNaverDomain && naverWhitelist.includes(c.name);
      });

      // 도메인 상세도를 기준으로 정렬 및 중복 제거
      const cookieMap = new Map();
      const sortedCookies = [...validCookies].sort((a, b) => {
        const lenA = a.domain ? a.domain.length : 0;
        const lenB = b.domain ? b.domain.length : 0;
        return lenA - lenB;
      });

      for (const cookie of sortedCookies) {
        cookieMap.set(cookie.name, cookie.value);
      }

      const cookieParts = [];
      for (const [name, value] of cookieMap.entries()) {
        cookieParts.push(`${name}=${value}`);
      }

      cookieHeader = cookieParts.join('; ');
      
      console.log('[OmniMail Debug] 네이버 DNR 쿠키 정제 완료 - 총 개수:', cookieMap.size,
                  '| 헤더 문자열 길이:', cookieHeader.length);
    } else {
      console.warn('[OmniMail Debug] 네이버 쿠키가 비어있습니다.');
    }
  } catch (cookieError) {
    console.error('[OmniMail Debug] 네이버 쿠키 획득 실패:', cookieError);
  }

  // declarativeNetRequest (DNR) 동적 세션 규칙 등록
  if (cookieHeader && chrome.declarativeNetRequest) {
    try {
      const rules = [{
        id: ruleId,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'cookie', operation: 'set', value: cookieHeader },
            { header: 'referer', operation: 'set', value: 'https://mail.naver.com/' },
            { header: 'origin', operation: 'set', value: 'https://mail.naver.com' },
            { header: 'sec-fetch-site', operation: 'set', value: 'same-origin' },
            { header: 'sec-fetch-mode', operation: 'set', value: 'cors' },
            { header: 'sec-fetch-dest', operation: 'set', value: 'empty' }
          ]
        },
        condition: {
          urlFilter: 'https://mail.naver.com/v2/api/*',
          resourceTypes: ['xmlhttprequest', 'other']
        }
      }];

      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [ruleId],
        addRules: rules
      });
      console.log(`[OmniMail Debug] DNR 동적 세션 규칙 등록 완료 (Rule ID: ${ruleId})`);
    } catch (dnrError) {
      console.error('[OmniMail Debug] DNR 규칙 등록 실패:', dnrError);
    }
  }
  return cookieHeader;
}

/**
 * Gmail 쿠키 획득 및 DNR 동적 세션 규칙 설정 헬퍼 함수
 */
async function setupGmailDNR(ruleId) {
  let cookieHeader = '';
  try {
    // google.com 및 mail.google.com 하위의 세션 쿠키를 획득합니다.
    const cookies1 = await new Promise((resolve) => {
      chrome.cookies.getAll({ domain: 'google.com' }, (cookies) => {
        resolve(cookies || []);
      });
    });
    const cookies2 = await new Promise((resolve) => {
      chrome.cookies.getAll({ domain: 'mail.google.com' }, (cookies) => {
        resolve(cookies || []);
      });
    });
    const cookies = [...cookies1, ...cookies2];

    if (cookies && cookies.length > 0) {
      // 구글 로그인 세션 유지에 필요한 핵심 인증 쿠키 및 보안 세션 쿠키 수집
      const googleWhitelist = [
        'SID', 'HSID', 'SSID', 'APISID', 'SAPISID',
        '__Secure-1PSID', '__Secure-3PSID', '__Secure-1PAPISID', '__Secure-3PAPISID',
        'OSID'
      ];
      const nowInSeconds = Date.now() / 1000;
      const validCookies = cookies.filter(c => {
        if (c.expirationDate && c.expirationDate < nowInSeconds) {
          return false;
        }
        if (!c.name || !c.value) return false;
        const dom = c.domain || '';
        const isGoogleDomain = dom === 'google.com' || dom.endsWith('.google.com');
        return isGoogleDomain && googleWhitelist.includes(c.name);
      });

      const cookieMap = new Map();
      const sortedCookies = [...validCookies].sort((a, b) => {
        const lenA = a.domain ? a.domain.length : 0;
        const lenB = b.domain ? b.domain.length : 0;
        return lenA - lenB;
      });

      for (const cookie of sortedCookies) {
        cookieMap.set(cookie.name, cookie.value);
      }

      const cookieParts = [];
      for (const [name, value] of cookieMap.entries()) {
        cookieParts.push(`${name}=${value}`);
      }

      cookieHeader = cookieParts.join('; ');
      console.log('[OmniMail Debug] Gmail DNR 쿠키 정제 완료 - 총 개수:', cookieMap.size,
                  '| 헤더 문자열 길이:', cookieHeader.length);
    }
  } catch (cookieError) {
    console.error('[OmniMail Debug] 구글 쿠키 획득 실패:', cookieError);
  }

  // declarativeNetRequest (DNR)를 통해 Cookie 및 Referer를 강제 주입합니다.
  if (cookieHeader && chrome.declarativeNetRequest) {
    try {
      const rules = [{
        id: ruleId,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'cookie', operation: 'set', value: cookieHeader },
            { header: 'referer', operation: 'set', value: 'https://mail.google.com/' },
            { header: 'origin', operation: 'set', value: 'https://mail.google.com' },
            { header: 'sec-fetch-site', operation: 'set', value: 'same-origin' },
            { header: 'sec-fetch-mode', operation: 'set', value: 'cors' },
            { header: 'sec-fetch-dest', operation: 'set', value: 'empty' }
          ]
        },
        condition: {
          urlFilter: 'https://mail.google.com/mail/feed/atom*',
          resourceTypes: ['xmlhttprequest', 'other']
        }
      }];

      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [ruleId],
        addRules: rules
      });
      console.log(`[OmniMail Debug] Gmail DNR 규칙 등록 완료 (Rule ID: ${ruleId})`);
    } catch (dnrError) {
      console.error('[OmniMail Debug] Gmail DNR 규칙 등록 실패:', dnrError);
    }
  }
  return cookieHeader;
}

/**
 * ① 네이버 메일 세션 연동 및 파싱 (v2 API 대응)
 */
async function syncNaverMail() {
  let loginEmail = '';
  let tempKey = '';
  const ruleId = 10001; // 네이버 API 세션 변조용 동적 규칙 고유 ID
  
  try {
    // 1. DNR 및 쿠키 헤더 셋업
    await setupNaverDNR(ruleId);
    await new Promise(resolve => setTimeout(resolve, 300)); // 규칙 바인딩 딜레이
  } catch (err) {
    console.error('[OmniMail Debug] DNR 초기 설정 오류:', err);
  }

  const headers = {
    'Content-Type': 'application/json'
  };

  try {
    console.log('[OmniMail Debug] initData fetch 시작...');
    const initResponse = await fetch('https://mail.naver.com/v2/api/mail/init', {
      method: 'POST',
      headers: headers,
      credentials: 'include',
      body: JSON.stringify({})
    });
    console.log('[OmniMail Debug] initData Response HTTP Status:', initResponse.status);
    if (initResponse.ok) {
      const initText = await initResponse.text();
      console.log('[OmniMail Debug] initData Response Body (First 150 chars):', initText.substring(0, 150));
      if (initText.trim().startsWith('<')) {
        console.warn('[OmniMail Debug] initData 응답이 HTML(리다이렉션)입니다. 세션이 만료된 것으로 추정됩니다.');
        loginEmail = '';
      } else {
        try {
          const initData = JSON.parse(initText);
          loginEmail = initData.userEmail || initData.envInfo?.emailAddress || '';
          tempKey = initData.tempKey || '';
          console.log('[OmniMail Debug] initData 파싱 성공. 이메일 존재 여부:', !!loginEmail, 'tempKey 존재 여부:', !!tempKey);
        } catch (parseErr) {
          console.error('[OmniMail Debug] initData JSON 파싱 실패:', parseErr.message);
        }
      }
    }
  } catch (e) {
    console.error('[OmniMail Debug] 네이버 프로필 조회 실패:', e);
  }

  let emails;
  const listHeaders = {
    'Content-Type': 'application/json'
  };
  if (tempKey) {
    listHeaders['tempKey'] = tempKey;
    listHeaders['tempkey'] = tempKey;
  }

  try {
    console.log('[OmniMail Debug] v2/api/mail/list fetch 시작...');
    const response = await fetch('https://mail.naver.com/v2/api/mail/list', {
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
    console.log('[OmniMail Debug] list Response HTTP Status:', response.status);
    if (response.ok) {
      const listText = await response.text();
      console.log('[OmniMail Debug] list Response Body (First 150 chars):', listText.substring(0, 150));
      if (listText.trim().startsWith('<')) {
        throw new Error('네이버 로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
      }
      try {
        const data = JSON.parse(listText);
        emails = parseNaverMails(data);
        console.log('[OmniMail Debug] list 파싱 완료. 메일 개수:', emails ? emails.length : 0);
      } catch (parseErr) {
        console.error('[OmniMail Debug] list JSON 파싱 실패:', parseErr.message);
        throw parseErr;
      }
    } else {
      throw new Error(`Naver Mail HTTP Error: ${response.status}`);
    }
  } catch (err) {
    console.error('[OmniMail Debug] list fetch 실패:', err);
    throw err;
  } finally {
    // 6. 통신 성공/실패 여부와 관계없이 세션 규칙을 반드시 즉시 삭제해 브라우징 간섭을 클린업합니다.
    if (chrome.declarativeNetRequest) {
      try {
        await chrome.declarativeNetRequest.updateSessionRules({
          removeRuleIds: [ruleId]
        });
        console.log('[OmniMail Debug] DNR 동적 세션 규칙 해제 완료 (Rule ID: 10001)');
      } catch (dnrCleanError) {
        console.error('[OmniMail Debug] DNR 규칙 해제 실패:', dnrCleanError);
      }
    }
  }
  
  return { emails, loginEmail };
}

/**
 * 실시간 이메일 계정 세션 연동 검증을 담당하는 핵심 함수
 */
async function executeVerify(accountId, email, sendResponse) {
  const ruleId = 10002;
  try {
    if (accountId === 'naver') {
      await setupNaverDNR(ruleId);
      await new Promise(resolve => setTimeout(resolve, 300)); // 딜레이
      
      const initResponse = await fetch('https://mail.naver.com/v2/api/mail/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({})
      });
      
      if (!initResponse.ok) {
        throw new Error(`프로필 조회 API 실패 (HTTP status: ${initResponse.status})`);
      }
      
      const initText = await initResponse.text();
      if (initText.trim().startsWith('<')) {
        sendResponse({ success: false, error: '네이버 로그인 세션을 찾을 수 없습니다. 브라우저에서 먼저 네이버에 로그인해 주세요.' });
        return;
      }
      const initData = JSON.parse(initText);
      const actualEmail = initData.userEmail || initData.envInfo?.emailAddress || '';
      
      if (!actualEmail) {
        sendResponse({ success: false, error: '네이버 로그인 세션을 찾을 수 없습니다. 브라우저에서 먼저 네이버에 로그인해 주세요.' });
      } else if (actualEmail.toLowerCase().trim() !== email.toLowerCase().trim()) {
        sendResponse({
          success: false,
          error: `입력하신 이메일(${email})이 현재 브라우저에 로그인된 네이버 계정(${actualEmail})과 일치하지 않습니다.`
        });
      } else {
        sendResponse({ success: true });
      }
    } else if (accountId === 'gmail') {
      await setupGmailDNR(ruleId);
      await new Promise(resolve => setTimeout(resolve, 300)); // 딜레이
      
      const response = await fetch('https://mail.google.com/mail/feed/atom', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (response.status === 401 || !response.ok) {
        sendResponse({ success: false, error: '구글 로그인 세션을 찾을 수 없습니다. 브라우저에서 먼저 구글에 로그인해 주세요.' });
        return;
      }
      
      const xmlText = await response.text();
      if (xmlText.trim().startsWith('<html') || xmlText.includes('Sign in')) {
        sendResponse({ success: false, error: '구글 로그인 세션이 유효하지 않습니다. 브라우저에서 로그인을 완료해 주세요.' });
        return;
      }
      
      let actualEmail = '';
      const titleMatch = xmlText.match(/<title>Gmail - Inbox for (.*?)<\/title>/);
      if (titleMatch && titleMatch[1]) {
        actualEmail = titleMatch[1].trim();
      }
      
      if (!actualEmail) {
        sendResponse({ success: false, error: '구글 로그인 이메일을 추출할 수 없습니다.' });
      } else if (actualEmail.toLowerCase().trim() !== email.toLowerCase().trim()) {
        sendResponse({
          success: false,
          error: `입력하신 이메일(${email})이 현재 브라우저에 로그인된 구글 계정(${actualEmail})과 일치하지 않습니다.`
        });
      } else {
        sendResponse({ success: true });
      }
    } else {
      sendResponse({ success: false, error: '지원하지 않는 계정 타입입니다.' });
    }
  } catch (error) {
    console.error('[OmniMail Background] 실시간 세션 검증 에러:', error);
    sendResponse({ success: false, error: error.message || '세션을 검증하는 도중 예상치 못한 오류가 발생했습니다.' });
  } finally {
    if (chrome.declarativeNetRequest) {
      try {
        await chrome.declarativeNetRequest.updateSessionRules({
          removeRuleIds: [ruleId]
        });
        console.log(`[OmniMail Debug] DNR 동적 세션 규칙 해제 완료 (Rule ID: ${ruleId})`);
      } catch (dnrCleanError) {
        console.error('[OmniMail Debug] DNR 규칙 해제 실패:', dnrCleanError);
      }
    }
  }
}

/**
 * 실시간 세션 감지를 담당하는 핵심 함수
 */
/**
 * 실시간 세션 감지를 담당하는 핵심 함수
 */
async function executeDetectSessions(sendResponse) {
  const debugLogs = [];
  try {
    debugLogs.push('[Background] 실시간 세션 스캔 시작...');
    const naverEmail = await detectNaverSession(debugLogs);
    const gmailEmail = await detectGmailSession(debugLogs);
    debugLogs.push('[Background] 실시간 세션 스캔 완료.');
    sendResponse({
      success: true,
      sessions: {
        naver: naverEmail,
        gmail: gmailEmail
      },
      debugLogs: debugLogs
    });
  } catch (error) {
    console.error('[OmniMail Background] 세션 감지 오류:', error);
    debugLogs.push(`[Background Error] ${error.message || error}`);
    sendResponse({
      success: false,
      error: error.message || '세션을 감지하는 도중 에러가 발생했습니다.',
      debugLogs: debugLogs
    });
  }
}

/**
 * 네이버 세션 존재 여부 및 이메일 감지
 */
async function detectNaverSession(logs = []) {
  const ruleId = 10004;
  logs.push('[Naver] 세션 감지 시작...');
  try {
    const cookieHeader = await setupNaverDNR(ruleId);
    const cookieCount = cookieHeader ? cookieHeader.split(';').length : 0;
    logs.push(`[Naver] 쿠키 조회 완료 - 가져온 쿠키 개수: ${cookieCount}`);
    
    await new Promise(resolve => setTimeout(resolve, 300)); // 딜레이
    
    logs.push('[Naver] API (v2/api/mail/init) Fetch 요청 전송 중...');
    const initResponse = await fetch('https://mail.naver.com/v2/api/mail/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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
          return email;
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
    console.error('[OmniMail Background] 네이버 세션 감지 실패:', e);
  } finally {
    if (chrome.declarativeNetRequest) {
      try {
        await chrome.declarativeNetRequest.updateSessionRules({
          removeRuleIds: [ruleId]
        });
      } catch (dnrCleanError) {
        console.error('[OmniMail Debug] DNR 규칙 해제 실패:', dnrCleanError);
      }
    }
  }
  return '';
}

/**
 * 구글 세션 존재 여부 및 이메일 감지
 */
async function detectGmailSession(logs = []) {
  const ruleId = 10005;
  logs.push('[Gmail] 세션 감지 시작...');
  try {
    const cookieHeader = await setupGmailDNR(ruleId);
    const cookieCount = cookieHeader ? cookieHeader.split(';').length : 0;
    logs.push(`[Gmail] 쿠키 조회 완료 - 가져온 쿠키 개수: ${cookieCount}`);
    
    await new Promise(resolve => setTimeout(resolve, 300)); // 딜레이
    
    logs.push('[Gmail] API (feed/atom) Fetch 요청 전송 중...');
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
          return email;
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
    console.error('[OmniMail Background] 구글 세션 감지 실패:', e);
  } finally {
    if (chrome.declarativeNetRequest) {
      try {
        await chrome.declarativeNetRequest.updateSessionRules({
          removeRuleIds: [ruleId]
        });
      } catch (dnrCleanError) {
        console.error('[OmniMail Debug] DNR 규칙 해제 실패:', dnrCleanError);
      }
    }
  }
  return '';
}




/**
 * ② Gmail Atom Feed 연동 및 파싱
 */
async function syncGmailMail() {
  const ruleId = 10003;
  try {
    await setupGmailDNR(ruleId);
    await new Promise(resolve => setTimeout(resolve, 300)); // 딜레이

    const response = await fetch('https://mail.google.com/mail/feed/atom', {
      method: 'GET',
      credentials: 'include'
    });
    
    if (response.status === 401) {
      return { emails: [], loginEmail: '' };
    }
    
    if (!response.ok) {
      throw new Error(`Gmail Feed HTTP Error: ${response.status}`);
    }
    
    const xmlText = await response.text();
    console.log('[OmniMail Debug] Gmail Atom Feed XML 수신 완료. 길이:', xmlText.length, 
                '| 안 읽은 항목 수(entry 개수):', (xmlText.match(/<entry>/g) || []).length);
    if (xmlText.trim().startsWith('<html') || xmlText.includes('Sign in')) {
      return { emails: [], loginEmail: '' };
    }

    const emails = parseGmailAtomFeed(xmlText);
    
    let loginEmail = '';
    const titleMatch = xmlText.match(/<title>Gmail - Inbox for (.*?)<\/title>/);
    if (titleMatch && titleMatch[1]) {
      loginEmail = titleMatch[1].trim();
    }
    
    return { emails, loginEmail };
  } catch (error) {
    console.error('[OmniMail Background] Gmail 동기화 오류:', error);
    return { emails: [], loginEmail: '' };
  } finally {
    if (chrome.declarativeNetRequest) {
      try {
        await chrome.declarativeNetRequest.updateSessionRules({
          removeRuleIds: [ruleId]
        });
        console.log('[OmniMail Debug] Gmail DNR 규칙 해제 완료 (Rule ID: 10003)');
      } catch (dnrCleanError) {
        console.error('[OmniMail Debug] Gmail DNR 규칙 해제 실패:', dnrCleanError);
      }
    }
  }
}
