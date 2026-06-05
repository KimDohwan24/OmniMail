/**
 * Mail Sync Service (syncService.js)
 * 
 * [학습 포인트]
 * 1. 백그라운드 서비스 워커(MV3) 환경은 브라우저 DOM API(DOMParser 등)를 사용할 수 없습니다.
 * 2. 따라서 외부 라이브러리(XXE 취약성 예방) 대신 정규식을 기반으로 안전하게 Gmail Atom Feed XML을 파싱합니다.
 * 3. 2단계 방어막(Defense in Depth): 백그라운드에서 위험 패턴을 1차 정제(sanitizeHtmlBackground)하고, 화면단에서 2차 DOMPurify를 수행합니다.
 */

/**
 * HTML 본문 내부의 아주 위험한 태그 및 인라인 이벤트 속성을 백그라운드에서 1차 살균하는 헬퍼 함수
 * @param {string} html 
 * @returns {string} 1차 정제된 HTML
 */
export function sanitizeHtmlBackground(html) {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '[보안으로 인해 스크립트 실행이 차단되었습니다]')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '[보안으로 인해 iframe 로드가 차단되었습니다]')
    .replace(/on\w+\s*=\s*".*?"/gi, '') // onerror="...", onload="..." 등 제거
    .replace(/on\w+\s*=\s*'.*?'/gi, '');
}

/**
 * 정규식 기반의 Gmail Atom Feed XML 파서 (의존성 없음, XXE 공격 차단)
 * @param {string} xmlString 
 * @returns {object[]} 정제된 이메일 객체 배열
 */
export function parseGmailAtomFeed(xmlString) {
  if (!xmlString) return [];
  
  const entries = [];
  // <entry>...</entry> 노드들을 글로벌하게 매칭하여 추출합니다.
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  
  while ((match = entryRegex.exec(xmlString)) !== null) {
    const entryContent = match[1];
    
    // 단순 태그 내용 추출
    const title = extractTagContent(entryContent, 'title');
    const summary = extractTagContent(entryContent, 'summary');
    const id = extractTagContent(entryContent, 'id');
    const issued = extractTagContent(entryContent, 'issued');
    
    // author 노드 추출 및 파싱
    const authorContent = extractTagContent(entryContent, 'author');
    const senderName = extractTagContent(authorContent, 'name') || 'Unknown';
    const senderEmail = extractTagContent(authorContent, 'email') || '';
    
    entries.push({
      id: id || `gmail-${Date.now()}-${Math.random()}`,
      accountId: 'gmail',
      senderEmail,
      senderName,
      subject: title,
      bodySnippet: sanitizeHtmlBackground(summary), // 1차 보안 살균
      receivedAt: issued || new Date().toISOString()
    });
  }
  
  return entries;
}

/**
 * 특정 XML 태그 내의 텍스트 콘텐츠를 추출하는 유틸리티 함수
 * @param {string} source 
 * @param {string} tagName 
 * @returns {string} 태그 내부 문자열
 */
function extractTagContent(source, tagName) {
  if (!source) return '';
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`);
  const match = source.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * 네이버 메일 JSON API 응답 데이터를 공통 데이터 규격으로 정제합니다.
 * @param {object} jsonResponse 
 * @returns {object[]} 정제된 이메일 객체 배열
 */
export function parseNaverMails(jsonResponse) {
  if (!jsonResponse) return [];
  
  // 구형 mailData와 신형 mailList 중 존재하는 데이터 소스를 채택합니다.
  const rawList = jsonResponse.mailList || jsonResponse.mailData;
  if (!rawList || !Array.isArray(rawList)) return [];
  
  return rawList.map(mail => ({
    id: String(mail.mailId),
    accountId: 'naver',
    senderEmail: mail.from?.email || '',
    senderName: mail.from?.name || 'Unknown',
    subject: mail.subject || '',
    bodySnippet: sanitizeHtmlBackground(mail.bodySnippet), // 1차 보안 살균
    // 네이버 유닉스 타임스탬프(초 단위)를 ISO 표준 String으로 변환합니다.
    receivedAt: mail.receivedTime 
      ? new Date(mail.receivedTime * 1000).toISOString()
      : new Date().toISOString()
  }));
}



