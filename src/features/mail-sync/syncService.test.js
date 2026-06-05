import { describe, it, expect } from 'vitest';
import { 
  parseGmailAtomFeed, 
  parseNaverMails, 
  sanitizeHtmlBackground
} from './syncService';
import { detectAccountType } from './detectAccountType';

describe('Mail Sync Service - 1차 백그라운드 보안 살균(sanitizeHtmlBackground) 테스트', () => {
  it('본문에 포함된 위험한 <script> 태그를 차단 문구로 치환해야 한다', () => {
    const rawHtml = '<p>안녕하세요</p><script>alert("hack");</script><div>방가워요</div>';
    const clean = sanitizeHtmlBackground(rawHtml);
    expect(clean).toContain('[보안으로 인해 스크립트 실행이 차단되었습니다]');
    expect(clean).not.toContain('<script>');
  });

  it('본문에 포함된 iframe 태그를 차단 문구로 치환해야 한다', () => {
    const rawHtml = '<iframe>src="http://badsite.com"</iframe>';
    const clean = sanitizeHtmlBackground(rawHtml);
    expect(clean).toContain('[보안으로 인해 iframe 로드가 차단되었습니다]');
  });

  it('본문 태그에 포함된 위험한 인라인 이벤트 핸들러(onerror, onload)를 도려내야 한다', () => {
    const rawHtml = '<img src="x" onerror="alert(1)" onload=\'console.log(2)\' />';
    const clean = sanitizeHtmlBackground(rawHtml);
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('onload');
    expect(clean).toContain('<img src="x"   />');
  });
});

describe('Mail Sync Service - Gmail Atom Feed 파서 테스트', () => {
  it('안전하게 Gmail Atom Feed XML 문자열을 파싱하여 정제된 JSON 배열로 반환한다', () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
    <feed version="0.3">
      <title>Gmail - Inbox</title>
      <entry>
        <title>회의 일정 공지</title>
        <summary>오늘 오후 3시에 회의실 A에서 긴급 개발 회의가 열립니다.</summary>
        <author>
          <name>김팀장</name>
          <email>leader@company.com</email>
        </author>
        <id>tag:gmail.google.com,2004:123456789</id>
        <issued>2026-06-05T01:30:00Z</issued>
      </entry>
    </feed>`;

    const result = parseGmailAtomFeed(mockXml);
    expect(result).toHaveLength(1);
    
    const mail = result[0];
    expect(mail.id).toBe('tag:gmail.google.com,2004:123456789');
    expect(mail.accountId).toBe('gmail');
    expect(mail.senderName).toBe('김팀장');
    expect(mail.senderEmail).toBe('leader@company.com');
    expect(mail.subject).toBe('회의 일정 공지');
    expect(mail.bodySnippet).toBe('오늘 오후 3시에 회의실 A에서 긴급 개발 회의가 열립니다.');
    expect(mail.receivedAt).toBe('2026-06-05T01:30:00Z');
  });

  it('XML 파싱 시 XXE(XML External Entity) 공격용 엔티티가 들어와도 안전하게 무시해야 한다', () => {
    // 외부 파일 로드를 시도하는 악의적인 XML 엔티티 주입
    const maliciousXml = `<?xml version="1.0" encoding="utf-8"?>
    <!DOCTYPE test [  
      <!ENTITY xxe SYSTEM "file:///etc/passwd">
    ]>
    <feed>
      <entry>
        <title>해킹 메일</title>
        <summary>&xxe;</summary>
        <author>
          <name>attacker</name>
          <email>hacker@evil.com</email>
        </author>
        <id>malicious-id</id>
      </entry>
    </feed>`;

    // 정규식 기반 파서는 외부 DTD나 엔티티 치환을 지원하지 않으므로, &xxe; 텍스트 그대로 취급해야 합니다.
    const result = parseGmailAtomFeed(maliciousXml);
    expect(result).toHaveLength(1);
    expect(result[0].bodySnippet).toBe('&xxe;'); // 엔티티가 파싱되어 비밀번호 파일 내용으로 유출되지 않음
  });
});

describe('Mail Sync Service - 네이버 메일 JSON 파서 테스트', () => {
  it('네이버 구형 JSON 데이터(mailData)를 수신하면 공통 데이터 규격으로 올바르게 가공한다', () => {
    const mockJson = {
      result: 'OK',
      mailData: [
        {
          mailId: 998877,
          subject: '5월 카드 이용 대금 청구서',
          from: {
            email: 'card@bank.com',
            name: '신한카드'
          },
          receivedTime: 1717545600, // Unix Timestamp
          bodySnippet: '5월 결제 금액은 총 150,000원입니다.'
        }
      ]
    };

    const result = parseNaverMails(mockJson);
    expect(result).toHaveLength(1);

    const mail = result[0];
    expect(mail.id).toBe('998877');
    expect(mail.accountId).toBe('naver');
    expect(mail.senderName).toBe('신한카드');
    expect(mail.senderEmail).toBe('card@bank.com');
    expect(mail.subject).toBe('5월 카드 이용 대금 청구서');
    expect(mail.bodySnippet).toBe('5월 결제 금액은 총 150,000원입니다.');
    expect(mail.receivedAt).toBe(new Date(1717545600 * 1000).toISOString());
  });

  it('네이버 신형 v2 JSON 데이터(mailList)를 수신해도 공통 데이터 규격으로 올바르게 가공한다', () => {
    const mockJsonV2 = {
      result: 'OK',
      mailList: [
        {
          mailId: 112233,
          subject: '신형 v2 메일 테스트',
          from: {
            email: 'v2@naver.com',
            name: '네이버V2'
          },
          receivedTime: 1717545600,
          bodySnippet: 'v2 본문 내용 요약입니다.'
        }
      ]
    };

    const result = parseNaverMails(mockJsonV2);
    expect(result).toHaveLength(1);

    const mail = result[0];
    expect(mail.id).toBe('112233');
    expect(mail.accountId).toBe('naver');
    expect(mail.senderName).toBe('네이버V2');
    expect(mail.senderEmail).toBe('v2@naver.com');
    expect(mail.subject).toBe('신형 v2 메일 테스트');
    expect(mail.bodySnippet).toBe('v2 본문 내용 요약입니다.');
    expect(mail.receivedAt).toBe(new Date(1717545600 * 1000).toISOString());
  });
});

describe('Mail Sync Service - 이메일 도메인 자동 감지(detectAccountType) 테스트', () => {
  it('정확한 구글 이메일을 주면 gmail을 반환해야 한다', () => {
    expect(detectAccountType('test@gmail.com')).toBe('gmail');
  });

  it('대소문자 혼용 및 공백이 섞인 네이버 이메일을 줘도 정제하여 naver를 반환해야 한다', () => {
    expect(detectAccountType('  TEST@NAVER.COM ')).toBe('naver');
  });

  it('이메일 골뱅이(@)가 없는 미완성 타이핑 상태에서는 null을 반환해야 한다', () => {
    expect(detectAccountType('myaccount')).toBe(null);
  });

  it('골뱅이는 있으나 도메인이 미완성인 경우 null을 반환해야 한다', () => {
    expect(detectAccountType('myaccount@')).toBe(null);
    expect(detectAccountType('myaccount@gmail')).toBe(null);
  });

  it('지원하지 않는 도메인을 주면 unsupported를 반환해야 한다', () => {
    expect(detectAccountType('user@daum.net')).toBe('unsupported');
    expect(detectAccountType('user@company.co.kr')).toBe('unsupported');
  });

  it('유사 도메인을 활용한 해킹 스푸핑 도메인이 유입될 경우 unsupported로 차단해야 한다', () => {
    // exact match 여부 검증
    expect(detectAccountType('user@naver.com.hacker.com')).toBe('unsupported');
    expect(detectAccountType('user@gmail.com-badsite.org')).toBe('unsupported');
  });
});

