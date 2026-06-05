# OmniMail 이메일 연동 API 상세 명세서 (mail-api-spec.md)

이 문서는 크롬 확장 프로그램 백그라운드 서비스 워커에서 브라우저 로그인 세션 쿠키를 활용하여 네이버 메일 및 Gmail 메일을 조회하는 API 엔드포인트와 데이터 구조를 명세합니다.

---

## 1. 네이버 메일 (Naver Mail) 웹 API 명세

네이버 메일은 별도의 공식 개발자용 메일 조회 API를 제공하지 않으므로, 사용자가 브라우저 웹 인터페이스에서 사용하는 비공식 내부 JSON API를 활용하여 연동합니다.

### 1-1. 요청 정보
* **엔드포인트:** `https://mail.naver.com/json/list/`
* **HTTP 메서드:** `POST` (또는 `GET`도 호환 가능)
* **필수 보안 헤더:**
  - `Cookie`: 네이버 세션 쿠키 `NID_AUT` 및 `NID_SES`
  - `Referer`: `https://mail.naver.com/` (네이버 웹 서비스 내부에서 요청한 것처럼 CORS 보안 정책 우회 및 위장용)
  - `User-Agent`: 표준 브라우저 헤더 정보

### 1-2. 요청 파라미터 (POST Form Data / Query String)
| 파라미터명 | 설명 | 추천 설정값 |
|---|---|---|
| `page` | 조회할 페이지 번호 | `1` |
| `folderSn` | 메일함 번호 (폴더 SN) | `0` (받은메일함. 스팸 및 휴지통 메일 유입 방지용) |
| `sortField` | 정렬 기준 필드 | `receivedTime` |
| `sortType` | 정렬 방식 | `desc` (최신 메일 우선) |

### 1-3. 응답 데이터 포맷 (JSON)
네이버 내부 API가 반환하는 JSON의 핵심 구조는 다음과 같습니다:

```json
{
  "result": "OK",
  "mailData": [
    {
      "mailId": "123456",
      "subject": "네이버플러스 멤버십 결제 완료 안내",
      "from": {
        "email": "pay-naver@naver.com",
        "name": "네이버페이"
      },
      "receivedTime": 1717545600, // Unix Timestamp
      "bodySnippet": "네이버플러스 멤버십 이용요금 4,900원이 안전하게 결제 완료되었습니다."
    }
  ]
}
```

---

## 2. Gmail (구글 메일) Atom Feed API 명세

구글은 메일 요약 및 신규 메일 알림용도로 세션이 열려있을 때 쿠키 및 세션 정보로 접근할 수 있는 Atom Feed API를 제공합니다.

### 2-1. 요청 정보
* **엔드포인트:** `https://mail.google.com/mail/feed/atom`
* **HTTP 메서드:** `GET`
* **인증 방식:**
  - 브라우저의 구글 계정 로그인 세션 쿠키를 크롬 백그라운드 단에서 획득하여 헤더에 담아 전송합니다.
  - 구글 세션 쿠키 도메인: `mail.google.com` 및 `accounts.google.com`

### 2-2. Gmail 연동 기술적 한계 및 대응
* **수량 제한:** 이 Feed API는 오직 **"읽지 않은 최신 메일 최대 20개"**까지만 반환하는 하드웨어적 제한이 존재합니다.
* **UI/UX 대응 방안:** 대시보드 화면상에 "Gmail은 읽지 않은 최신 메일 최대 20개까지만 동기화됩니다"라는 안내 배너 또는 툴팁 문구를 명시합니다.

### 2-3. 응답 데이터 포맷 (XML Atom Feed)
XML 형식으로 제공되는 응답 데이터의 핵심 구조는 다음과 같습니다:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://purl.org/atom/ns#" version="0.3">
  <title>Gmail - Inbox for example@gmail.com</title>
  <fullcount>1</fullcount>
  <entry>
    <title>[GitHub] Security Alert: 1 vulnerability found</title>
    <summary>We found a vulnerable dependency in your repository OmniMail.</summary>
    <author>
      <name>GitHub</name>
      <email>notifications@github.com</email>
    </author>
    <id>tag:gmail.google.com,2004:1789456123456</id>
    <issued>2026-06-05T01:30:00Z</issued> <!-- ISO 8601 포맷 -->
  </entry>
</feed>
```

---

## 3. 공통 데이터 정제 (Normalization) 정책

각 메일사별로 다른 포맷(JSON, XML)의 데이터를 동일한 형태로 가공하여 Zustand 스토어에 전달해야 합니다. 정제될 이메일 스펙은 다음과 같이 단일화합니다.

| 필드명 | 타입 | 설명 | 추출처 (네이버 / Gmail) |
|---|---|---|---|
| `id` | `string` | 고유 식별자 (중복 방지용 UID) | `mailId` / `<id>` 값 전체 |
| `accountId` | `string` | 계정 식별 | `naver` / `gmail` |
| `senderEmail` | `string` | 발신인 이메일 | `from.email` / `<author><email>` |
| `senderName` | `string` | 발신인 이름 | `from.name` / `<author><name>` |
| `subject` | `string` | 이메일 제목 | `subject` / `<title>` |
| `bodySnippet` | `string` | 본문 일부 요약 | `bodySnippet` / `<summary>` |
| `receivedAt` | `string` | 수신 시각 (ISO string) | `receivedTime` (변환) / `<issued>` |
