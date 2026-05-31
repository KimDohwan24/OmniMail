# 기술 스킬: Recharts 데이터 분석 및 시각화 (글래스모피즘)

이 문서는 OmniMail 대시보드의 다크 글래스모피즘 테마 규격에 완벽히 호환되도록 미려하고 반응성이 높은 통계 그래프를 구현하기 위한 기술 가이드라인을 정의합니다.

---

## 📊 차트 컴포넌트 설계

메일 수신 트렌드 시각화에는 Recharts의 **AreaChart(영역형 차트)**를 채택하고, 그라데이션 광원(Glow) 효과를 결합하여 입체적이고 세련된 비주얼을 제공합니다.

### 1. 차트 데이터 구조 명세
그래프는 요일별로 분류된 일반 메일과 중요 메일 수신 개수를 렌더링합니다:
```javascript
const statsData = [
  { name: '월', emails: 12, spam: 4 },
  { name: '화', emails: 24, spam: 8 },
  // ...
];
```

---

## 🎨 다크 테마용 Recharts 커스텀 스타일링

Recharts의 기본 차트 스타일은 투박하기 때문에, OmniMail의 깊은 네이비 및 반투명 유리 카드 스타일과 자연스럽게 어우러지도록 다음과 같이 세부 커스텀을 수행합니다:

### 1. 영역 그라데이션 광원 효과 (Gradient Glow)
SVG `<defs>` 태그를 선언하여 부드럽게 페이드아웃되는 보라색 광원 배경을 제작합니다:
```jsx
<defs>
  <linearGradient id="glowPurple" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
  </linearGradient>
</defs>
```

### 2. 미니멀한 격자(Grid) 및 축(Axis) 처리
차트의 선들이 너무 튀어서 글래스 카드 배경을 가리지 않도록 선의 불투명도를 대폭 낮춥니다.
* **테두리 선:** 아주 얇고 투명한 그레이 컬러 (`rgba(255, 255, 255, 0.05)` 또는 `#374151`)를 사용하여 축 라인을 구성합니다.
* **축 글꼴 설정:** 차트의 요일 및 숫자 텍스트 크기를 작게 줄여 (`fontSize={10}`) 가독성과 어울림을 동시에 챙깁니다.
* **격자 숨기기:** 세로 격자선은 가급적 숨기고, 가로 격자선만 은은한 점선(Dashed)으로 처리합니다.

### 3. 글래스모피즘 커스텀 툴팁 (Tooltip Overlay)
마우스 호버 시 뜨는 정보창(Tooltip)을 대시보드 테마와 동일하게 반투명 블러 유리 카드로 직접 코딩합니다:
```jsx
<Tooltip 
  contentStyle={{ 
    backgroundColor: 'rgba(20, 24, 45, 0.95)', 
    borderColor: 'rgba(255, 255, 255, 0.05)', 
    borderRadius: '12px',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
  }}
  labelStyle={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold' }}
  itemStyle={{ color: '#fff', fontSize: '12px' }}
/>
```

---

## 📈 실시간 메일 통계 바인딩 로직 (선택 기능)
정적 데이터를 보여주는 데 그치지 않고, 연동된 실제 이메일 데이터의 날짜 정보를 활용해 차트를 업데이트합니다.
1. 메일이 패치되면 `dateISO` 수신 타임스탬프를 분석합니다.
2. 각 이메일의 수신 요일을 파악해 누적합(Count)을 구합니다.
3. 계산된 요일별 메일 개수를 Zustand 스토어의 `statsData` 상태에 반영하여 화면 그래프가 실시간으로 변동하는 동적 기능을 구현합니다.
