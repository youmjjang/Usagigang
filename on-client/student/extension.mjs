// 마지막 총공세 · 학생 구현 요약 (제공된 PC 조회 API만 읽기)
const USAGI_PC_PATH = '/api/pc/status';
const USAGI_PC_SCHEMA = 'aleph.on.pc-status.v1';
const USAGI_PC_KEYS = ['cpu', 'memory', 'disk', 'firewall', 'network', 'events'];
const usagiNum = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const usagiPercent = v => usagiNum(v) && v <= 100;
const usagiCount = v => Number.isSafeInteger(v) && v >= 0;
const usagiGb = n => `${(n / (1024 ** 3)).toFixed(1)} GB`;
const usagiTime = date => new Date(date).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
const usagiClock = date => new Date(date).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });

function usagiNode(tag, text, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = String(text);
  return el;
}
function usagiMetric(metric, key) {
  if (metric?.state !== 'ok') return { text: '확인 불가', note: metric?.reason ? `조회 불가 사유: ${metric.reason}` : '이번 조회에서 값을 읽지 못했습니다.', percent: null };
  if (key === 'cpu' && usagiPercent(metric.usagePercent))
    return { text: `${metric.usagePercent.toFixed(1)}%`, note: 'CPU · 약 200ms 표본', percent: metric.usagePercent };
  if (key === 'memory' && usagiNum(metric.usedBytes) && usagiNum(metric.totalBytes) && metric.totalBytes > 0 && metric.usedBytes <= metric.totalBytes)
    return { text: `${usagiGb(metric.usedBytes)} / ${usagiGb(metric.totalBytes)}`, note: `사용률 ${(100 * metric.usedBytes / metric.totalBytes).toFixed(1)}%`, percent: 100 * metric.usedBytes / metric.totalBytes };
  if (key === 'disk' && usagiNum(metric.freeBytes) && usagiNum(metric.totalBytes) && metric.totalBytes > 0 && metric.freeBytes <= metric.totalBytes)
    return { text: `${usagiGb(metric.freeBytes)} 여유`, note: `전체 ${usagiGb(metric.totalBytes)} · 앱이 있는 디스크`, percent: 100 * metric.freeBytes / metric.totalBytes };
  if (key === 'firewall' && Array.isArray(metric.profiles) && metric.profiles.length === 3 &&
    ['Domain', 'Private', 'Public'].every(k => metric.profiles.some(p => p.name === k && typeof p.enabled === 'boolean'))) {
    const off = metric.profiles.filter(p => !p.enabled).map(p => p.name);
    return {
      text: off.length ? `${off.length}개 프로필 꺼짐` : '3개 프로필 켜짐',
      note: 'Windows 방화벽 · 프로필별 실측 결과', percent: null,
      profiles: ['Domain', 'Private', 'Public'].map(name => ({ name, enabled: metric.profiles.find(p => p.name === name).enabled }))
    };
  }
  if (key === 'network' && usagiCount(metric.interfaceCount) && usagiCount(metric.ipv4Count))
    return { text: `인터페이스 ${metric.interfaceCount}개`, note: `IPv4 구성 ${metric.ipv4Count}개 · 인터넷 접속 성공 여부는 아님`, percent: null, configCounts: { interfaces: metric.interfaceCount, ipv4: metric.ipv4Count } };
  if (key === 'events' && usagiCount(metric.warningCount) && usagiCount(metric.errorCount) &&
    usagiCount(metric.sampleLimit) && typeof metric.truncated === 'boolean')
    return {
      text: `경고 ${metric.warningCount}건 · 오류 ${metric.errorCount}건`,
      note: `최근 24시간 Windows System·Application · ${metric.truncated ? '일부 집계(표본 한도 도달)' : '조회한 범위 집계'} · 침해 사고 판정 아님`,
      percent: null,
      counts: { warnings: metric.warningCount, errors: metric.errorCount, sampleLimit: metric.sampleLimit, truncated: metric.truncated }
    };
  return { text: '확인 불가', note: '응답 값 또는 단위가 올바르지 않습니다.', percent: null };
}
function usagiVerifiedPc(result) {
  const data = result?.data;
  const at = typeof data?.measuredAt === 'string' ? Date.parse(data.measuredAt) : NaN;
  if (result?.ok !== true || data?.schema !== USAGI_PC_SCHEMA || data?.source !== 'local-pc' ||
    !Number.isFinite(at) || Math.abs(Date.now() - at) > 60000 ||
    !data.metrics || typeof data.metrics !== 'object') return null;
  const metrics = {};
  for (const k of USAGI_PC_KEYS) metrics[k] = usagiMetric(data.metrics[k], k);
  return { at, metrics };
}

// 기록은 브라우저 현재 탭 메모리에만 두며, 실패·오래된 값을 현재 실측으로 보여 주지 않는다.
function usagiTrend(title, values) {
  const figure = usagiNode('figure');
  figure.append(usagiNode('figcaption', `${title} · 이 탭에서 직접 조회한 실측 기록`));
  if (values.length < 2) {
    figure.append(usagiNode('p', '추이 데이터가 부족합니다. 잠시 뒤 다시 조회하면 두 실측값을 비교할 수 있습니다.', 'muted'));
    return figure;
  }
  const W = 400, H = 108, pad = 12;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${title} 최근 ${values.length}회 실측 변화. 시작 ${values[0].toFixed(1)}%, 마지막 ${values[values.length - 1].toFixed(1)}%`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '108');
  const guide = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  guide.setAttribute('x1', String(pad)); guide.setAttribute('x2', String(W - pad));
  guide.setAttribute('y1', String(H / 2)); guide.setAttribute('y2', String(H / 2));
  guide.setAttribute('stroke', '#cdd4e3'); guide.setAttribute('stroke-dasharray', '4 5');
  svg.append(guide);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  const points = values.map((v, i) => `${(pad + (W - 2 * pad) * i / (values.length - 1)).toFixed(1)},${(H - pad - (H - 2 * pad) * v / 100).toFixed(1)}`);
  line.setAttribute('points', points.join(' ')); line.setAttribute('fill', 'none');
  line.setAttribute('stroke', '#3575D5'); line.setAttribute('stroke-width', '3');
  line.setAttribute('stroke-linejoin', 'round'); line.setAttribute('stroke-linecap', 'round');
  svg.append(line);
  figure.append(svg);
  figure.append(usagiNode('p', `${values[0].toFixed(1)}% → ${values[values.length - 1].toFixed(1)}% · 측정 ${values.length}회 · 실제 연속 감시 기록 아님`, 'muted'));
  return figure;
}

// 마지막 총공세 · 학생 표시 영역 전용 디자인. 기존 입력 계약과 판정 로직은 유지한다.
// 제공 공통 UI / 인증 / 네트워크 판정 / 조치 API에는 영향을 주지 않는다.
const USAGI_VIEW_META = Object.freeze({
  'student-identity-view': ['IDENTITY & DEVICE', '계정 · 기기 · 세션', '현재 사용자와 연결 기기의 검증된 상태를 확인합니다.'],
  'student-decision-view': ['ACCESS DECISION', '업무 앱 접근 판정', '접속 허용·거부·추가 확인과 요청 실패를 구별합니다.'],
  'student-events-view': ['SECURITY EVENTS', '보안 기록 탐색', '조회된 기록만 필터링하고 근거와 상태를 확인합니다.'],
  'student-vulnerabilities-view': ['PACKAGE AUDIT', '설치 패키지 점검', '정확한 설치 버전의 공개 취약점 조회 결과만 표시합니다.'],
  'student-ai-connection-view': ['AI CONNECTION', 'AI 연결 상태', '모델 점검과 사건 설명 성공은 서로 다릅니다.'],
  'student-ai-explanation-view': ['EVIDENCE FIRST', 'AI 사건 설명', '현재 사건의 근거를 대조한 참고용 설명이며 조치가 실행되지는 않습니다.'],
  'student-action-view': ['RESPONSE STATUS', '보안 조치 결과', '조치 준비·접수·실제 효과 확인을 별개로 표시합니다.'],
});
const USAGI_THEME = Object.freeze({
  ink: '#1e293b', muted: '#61718a', accent: '#3575D5', border: '#e2e8f1',
  warning: '#9d6615', warningBg: '#fff8e9', danger: '#ae3441', dangerBg: '#fff1f3',
});
function usagiApply(el, rules) {
  if (el && el.style) Object.assign(el.style, rules);
  return el;
}
function usagiCardStyle(el) {
  return usagiApply(el, {
    background: '#fff', border: `1px solid ${USAGI_THEME.border}`, borderRadius: '14px',
    padding: 'clamp(14px,2vw,20px)', minWidth: '0', boxShadow: '0 4px 18px rgba(29,45,78,.035)',
    boxSizing: 'border-box', overflowWrap: 'anywhere'
  });
}
function usagiMessageTone(value) {
  // 보안 상태의 의미는 텍스트 그대로 유지한다. '확인 불가'는 정상으로 칠하지 않는다.
  const text = String(value || '');
  if (/(?:오류|실패|거부|차단|만료|철회|결과 불명|권한 없음|보안 기준 미충족)/.test(text)) return 'danger';
  if (/(?:확인 불가|미연결|연결 없음|미지원|아직|조회 전|추가 확인|준비 중|진행 중|불러오는 중|점검 중|요청 전|미실행|일부)/.test(text)) return 'warning';
  return 'neutral';
}
function usagiStyleStudentRows(scope, kind = '') {
  if (!scope || !scope.children) return;
  // 학생 목록이 갱신되거나 상세를 나중에 연 경우에도 같은 카드 스타일로 표시한다.
  for (const el of Array.from(scope.children)) {
    const tag = String(el.tagName || '').toLowerCase();
    if (tag === 'ul') {
      usagiApply(el, { listStyle: 'none', padding: '0', margin: '12px 0 0', display: 'grid', gap: '10px' });
      for (const li of Array.from(el.children || [])) {
        if (String(li.tagName).toLowerCase() === 'li') {
          usagiApply(li, { background: '#F7FAFF', border: `1px solid ${USAGI_THEME.border}`, borderRadius: '10px', padding: '12px 14px', minWidth: '0', overflowWrap: 'anywhere' });
        }
      }
    }
    if (tag === 'section') {
      usagiCardStyle(el);
      usagiApply(el, { marginTop: '12px' });
    }
  }
  if (kind === 'events') {
    const buttons = [];
    const visit = (el) => {
      if (!el || !el.children) return;
      if (String(el.tagName || '').toLowerCase() === 'button') buttons.push(el);
      for (const child of Array.from(el.children)) visit(child);
    };
    visit(scope);
    for (const b of buttons) usagiStyleButton(b);
  }
}
function usagiStyleButton(button) {
  usagiApply(button, {
    background: button.disabled ? '#f2f4f9' : '#EAF3FF', color: button.disabled ? '#7b8696' : '#275DA8',
    border: `1px solid ${button.disabled ? '#e6e9f0' : '#CFE2FB'}`,
    borderRadius: '9px', padding: '8px 12px', fontWeight: '700', fontSize: '12px',
    cursor: button.disabled ? 'not-allowed' : 'pointer', lineHeight: '1.4', marginTop: '5px',
    whiteSpace: 'normal', textAlign: 'left'
  });
}
// 7일차 디자인 정리: 제공 화면을 건드리지 않고 학생 표시만 작은 결과 행으로 요약한다.
// 원래 오류 코드·근거·조회 버전·확인 시각은 펼친 세부 내용에 그대로 보존한다.
function usagiCompactStudentView(root, kind) {
  const entries = Array.from(root.children || []);
  const lines = entries.map(el => String(el.textContent || ''));
  const findLine = prefix => lines.find(text => text.startsWith(prefix));
  const ai = kind === 'ai';
  const label = ai ? 'AI 연결 상태' : '설치 패키지 점검';
  const cls = ai ? 'student-ai-connection-status' : null;
  const primary = ai
    ? String(entries.find(el => el.className === cls)?.textContent || '연결 상태 확인 불가(unknown)')
    : findLine('전체 조회 상태:') ||
      findLine('조회 실패:') ||
      findLine('조회 중') ||
      findLine('조회 전') ||
      findLine('조회 결과를 확인할 수 없습니다.') ||
      '확인 불가';
  const errorCode = ai ? findLine('오류 코드:') : null;
  const time = ai ? findLine('점검 시각:') : findLine('checkedAt:');
  const models = ai ? findLine('모델 수:') : null;
  const demo = lines.some(text => text.includes('예제 자료(demo)'));
  const modeText = ai ? lines.find(text => text.includes('연결 없음(disconnected)') || text.includes('연결 상태 확인 불가(unknown)')) : null;
  const failed = /실패|오류|불가|결과 불명|미완료/.test(primary);
  const active = /조회 중|점검 중/.test(primary);
  const ready = /점검\(verified\)|모두 조회\(complete\)/.test(primary) && !demo && !failed;
  const tone = failed ? 'danger' : ready ? 'good' : 'warn';
  const colors = tone === 'good'
    ? ['#eaf8f0', '#147455', '#caecdc']
    : tone === 'danger'
      ? ['#fff2f3', '#ab3043', '#f6d9dc']
      : ['#fff8e9', '#9c6b19', '#f2dfbb'];

  // 노출 영역에는 실제 결과만. 모델 조회와 '사건 설명 완료'를 혼동하지 않는다.
  usagiApply(root, {
    background: '#fff', border: `1px solid ${USAGI_THEME.border}`,
    borderLeft: `3px solid ${USAGI_THEME.accent}`, borderRadius: '12px',
    color: USAGI_THEME.ink, padding: '0 15px', minWidth: '0', width: '100%',
    boxSizing: 'border-box', fontFamily: 'Pretendard, Malgun Gothic, Segoe UI, sans-serif',
    overflowWrap: 'anywhere'
  });
  const row = usagiApply(usagiNode('div'), {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center',
    justifyContent: 'space-between', gap: '7px 14px', padding: '12px 0'
  });
  const textBox = usagiApply(usagiNode('div'), { flex: '1 1 240px', minWidth: '0' });
  textBox.append(
    usagiApply(usagiNode('strong', label), { fontSize: '13px', color: '#223047', display: 'block' }),
    usagiApply(usagiNode('p', [primary, models, time].filter(Boolean).join(' · ')), {
      fontSize: '12px', lineHeight: '1.6', color: '#6e7e96', margin: '4px 0 0', overflowWrap: 'anywhere'
    })
  );
  if (errorCode) textBox.append(usagiApply(usagiNode('p', errorCode), {
    fontSize: '11px', color: '#ab3043', margin: '4px 0 0'
  }));
  if (demo) textBox.append(usagiApply(usagiNode('p', '예제 자료 · 실제 연결 결과가 아닙니다.'), {
    fontSize: '11px', color: '#985a15', margin: '4px 0 0'
  }));
  if (modeText && !primary.includes(modeText)) textBox.append(usagiApply(usagiNode('p', modeText), {
    fontSize: '11px', color: '#7c899c', margin: '3px 0 0'
  }));
  row.append(textBox);
  row.append(usagiApply(usagiNode('span', failed ? '확인 필요' : ready ? '점검 확인' : active ? '조회 중' : '조회 전·미확인'), {
    background: colors[0], color: colors[1], border: `1px solid ${colors[2]}`,
    borderRadius: '7px', padding: '6px 9px', fontWeight: '750',
    fontSize: '11px', whiteSpace: 'nowrap'
  }));

  const details = usagiApply(usagiNode('details'), {
    borderTop: `1px solid ${USAGI_THEME.border}`, padding: '9px 0 12px',
    color: USAGI_THEME.muted, fontSize: '12px'
  });
  const summary = usagiApply(usagiNode('summary', '오류 안내·조회 범위·원본 결과 자세히 보기'), {
    color: '#3575D5', fontWeight: '700', cursor: 'pointer', fontSize: '12px'
  });
  details.append(summary);
  const detailBody = usagiApply(usagiNode('div'), { padding: '10px 0 2px', display: 'grid', gap: '7px' });
  for (const entry of entries) {
    const tag = String(entry.tagName || '').toLowerCase();
    if (tag === 'p') usagiApply(entry, { margin: '0', padding: '5px 1px', fontSize: '12px', lineHeight: '1.6', color: '#68778e' });
    else if (tag === 'ul') usagiApply(entry, { margin: '6px 0', paddingLeft: '22px' });
    detailBody.append(entry);
  }
  details.append(detailBody);
  // 장애 상황은 조치 안내를 바로 읽을 수 있게 기본 펼침한다.
  details.open = failed;
  // 기존 요소를 이동하되 본문과 공식 데이터 속성 자체는 하나도 제거하지 않는다.
  if (typeof root.replaceChildren === 'function') root.replaceChildren();
  else root.textContent = ''; // 최소 테스트 DOM 호환
  root.append(row, details);
  return root;
}

function usagiUnifyStudentView(root) {
  if (!root || !root.className) return root;
  const key = String(root.className);
  if (key === 'student-ai-connection-view') return usagiCompactStudentView(root, 'ai');
  if (key === 'student-vulnerabilities-view') return usagiCompactStudentView(root, 'packages');
  const isStatus = key === 'student-status-view';
  const meta = USAGI_VIEW_META[key];
  if (!meta && !isStatus) return root;
  usagiApply(root, {
    color: USAGI_THEME.ink, background: '#fff', fontFamily: 'Pretendard, Malgun Gothic, Segoe UI, sans-serif',
    padding: 'clamp(10px,1.5vw,16px)', borderRadius: '12px', border: `1px solid ${USAGI_THEME.border}`,
    boxSizing: 'border-box', minWidth: '0', width: '100%', overflowWrap: 'anywhere',
    lineHeight: '1.55'
  });
  if (meta) {
    // 제공 화면에 이미 큰 제목이 있으므로 학생 카드 내부 제목은 한 줄로 축소.
    const banner = usagiApply(usagiNode('header'), {
      padding: '0 0 9px', marginBottom: '10px', borderBottom: `1px solid ${USAGI_THEME.border}`
    });
    banner.append(
      usagiApply(usagiNode('strong', meta[1]), {
        fontSize: '14px', fontWeight: '800', color: USAGI_THEME.ink
      })
    );
    if (typeof root.prepend === 'function') root.prepend(banner);
    else root.append(banner);
  }
  if (key === 'student-identity-view') {
    usagiApply(root, { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,210px),1fr))', gap: '12px' });
    const header = Array.from(root.children).find(el => String(el.tagName).toLowerCase() === 'header');
    if (header) usagiApply(header, { gridColumn: '1 / -1', marginBottom: '0' });
  }
  const elements = Array.from(root.children || []);
  for (const el of elements) {
    const tag = String(el.tagName || '').toLowerCase();
    if (tag === 'header') continue;
    if (isStatus && el.className === 'student-pc-dashboard') continue;
    if (tag === 'section') usagiCardStyle(el);
    if (tag === 'div' && key === 'student-events-view') {
      if (el.className === 'student-events-filters') {
        usagiCardStyle(el);
        usagiApply(el, { display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'end', margin: '0 0 12px' });
      }
      if (el.className === 'student-event-detail-mount') usagiStyleStudentRows(el, 'events');
    }
    if (tag === 'p' && key !== 'student-status-view') {
      const tone = usagiMessageTone(el.textContent);
      usagiApply(el, {
        color: tone === 'danger' ? USAGI_THEME.danger : tone === 'warning' ? USAGI_THEME.warning : USAGI_THEME.muted,
        background: tone === 'danger' ? USAGI_THEME.dangerBg : tone === 'warning' ? USAGI_THEME.warningBg : '#fff',
        border: `1px solid ${tone === 'danger' ? '#f2d0d5' : tone === 'warning' ? '#f1e0b8' : USAGI_THEME.border}`,
        borderRadius: '10px', padding: '8px 10px', margin: '5px 0', fontSize: '12px', lineHeight: '1.7'
      });
    }
  }
  for (const section of elements.filter(el => String(el.tagName).toLowerCase() === 'section')) {
    if (isStatus && section.className === 'student-pc-dashboard') continue;
    for (const child of Array.from(section.children || [])) {
      if (/^h[2-4]$/.test(String(child.tagName).toLowerCase())) {
        usagiApply(child, { color: USAGI_THEME.ink, fontWeight: '800', fontSize: '15px', margin: '0 0 12px' });
      }
      if (String(child.tagName).toLowerCase() === 'dl') {
        usagiApply(child, { display: 'grid', gridTemplateColumns: 'minmax(90px,auto) minmax(0,1fr)', columnGap: '12px', rowGap: '9px', margin: '0' });
        for (const item of Array.from(child.children || [])) {
          if (String(item.tagName).toLowerCase() === 'dt') usagiApply(item, { color: USAGI_THEME.muted, fontSize: '12px' });
          if (String(item.tagName).toLowerCase() === 'dd') usagiApply(item, { margin: '0', fontSize: '12px', fontWeight: '650', overflowWrap: 'anywhere' });
        }
      }
    }
    usagiStyleStudentRows(section);
  }
  if (key === 'student-events-view') usagiStyleStudentRows(root, 'events');
  if (key === 'student-vulnerabilities-view') usagiStyleStudentRows(root);
  for (const el of elements) {
    if (String(el.tagName).toLowerCase() === 'ul') usagiStyleStudentRows(root);
  }
  const styleControls = el => {
    for (const child of Array.from(el.children || [])) {
      const tag = String(child.tagName || '').toLowerCase();
      if (tag === 'button') usagiStyleButton(child);
      if (tag === 'select') usagiApply(child, { display: 'block', width: '100%', border: `1px solid ${USAGI_THEME.border}`, background: '#fff', borderRadius: '8px', minHeight: '36px', padding: '6px 10px', marginTop: '5px', color: USAGI_THEME.ink });
      if (tag === 'label') usagiApply(child, { fontSize: '12px', color: USAGI_THEME.muted, fontWeight: '700', minWidth: '140px' });
      if (!child.className || child.className !== 'student-pc-dashboard') styleControls(child);
    }
  };
  styleControls(root);
  return root;
}

// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView({ api, onChange } = {}) {
  let usagiPc = { status: 'idle', current: null, message: '아직 추이 기록에 사용할 실측값을 추가하지 않았습니다.' };
  let usagiHistory = [];
  let usagiGeneration = 0;
  let usagiAutoStarted = false;
  let usagiAutoPhase = 'idle';
  async function usagiInitialMeasurements() {
    usagiAutoPhase = 'first';
    const firstOk = await usagiRefreshPc({ automatic: true });
    if (!firstOk) { usagiAutoPhase = 'done'; return; }
    usagiAutoPhase = 'waiting';
    if (typeof onChange === 'function') onChange();
    setTimeout(async () => {
      // A manual second measurement already fulfils the initial pair.
      if (usagiHistory.length >= 2 || usagiPc.status === 'loading') {
        usagiAutoPhase = 'done';
        if (typeof onChange === 'function') onChange();
        return;
      }
      usagiAutoPhase = 'second';
      await usagiRefreshPc({ automatic: true });
      usagiAutoPhase = 'done';
      if (typeof onChange === 'function') onChange();
    }, 4000);
  }
  async function usagiRefreshPc({ automatic = false } = {}) {
    if (usagiPc.status === 'loading') return;
    const generation = ++usagiGeneration;
    const restoreFocus = !automatic && document.activeElement?.id === 'usagi-pc-refresh';
    usagiPc = { status: 'loading', current: usagiPc.current, message: usagiAutoPhase === 'second' ? '두 번째 측정 중… 완료되면 두 실측값으로 그래프를 표시합니다.' : '이 PC의 상태를 읽는 중입니다…' };
    if (typeof onChange === 'function') onChange();
    let response;
    try { response = typeof api?.get === 'function' ? await api.get(USAGI_PC_PATH) : { ok: false, error: { code: 'NOT_ALLOWED', message: '제공 조회 API를 사용할 수 없습니다.' } }; }
    catch { response = { ok: false, error: { code: 'NETWORK_ERROR', message: '로컬 조회 요청에 실패했습니다.' } }; }
    if (generation !== usagiGeneration) return;
    const current = usagiVerifiedPc(response);
    if (current) {
      usagiPc = { status: 'ok', current, message: `내 PC 실측 · ${usagiTime(current.at)} · 출처: local-pc` };
      if (usagiHistory.length === 0 || current.at > usagiHistory[usagiHistory.length - 1].at) {
        usagiHistory = [...usagiHistory, current].slice(-12);
      }
    } else {
      const code = typeof response?.error?.code === 'string' ? response.error.code : 'RESPONSE_UNVERIFIED';
      const msg = typeof response?.error?.message === 'string' ? response.error.message : '조회 결과 형식 또는 측정 시각을 검증하지 못했습니다.';
      usagiPc = { status: 'error', current: null, message: `${code}: ${msg} 이전 측정값은 현재 상태로 표시하지 않습니다. 다시 조회 버튼으로 직접 재시도하세요.` };
    }
    if (typeof onChange === 'function') onChange();
    const button = document.getElementById('usagi-pc-refresh');
    if (restoreFocus && button && typeof button.focus === 'function') button.focus({ preventScroll: true });
    return Boolean(current);
  }
  // 학생 영역에서만 표시하는 관제 디자인. 제공 UI·메뉴·상태 안내는 이동/숨김 처리하지 않는다.
  function usagiPaint(node, style) {
    Object.assign(node.style, style);
    return node;
  }
  function usagiSectionTitle(title, description) {
    const div = usagiNode('div');
    div.append(usagiPaint(usagiNode('h4', title), { margin: '0', fontSize: '16px', letterSpacing: '-.4px', color: '#1f293b' }));
    if (description) div.append(usagiPaint(usagiNode('p', description), { color: '#8492a6', margin: '5px 0 0', fontSize: '12px', lineHeight: '1.5' }));
    return div;
  }
  function usagiPill(label, tone = 'default') {
    const color = tone === 'ok' ? '#167f60' : tone === 'warning' ? '#9b691b' : '#6c7789';
    const background = tone === 'ok' ? '#effaf4' : tone === 'warning' ? '#fff7e8' : '#ffffff';
    return usagiPaint(usagiNode('span', label), {
      display: 'inline-block', color, background, border: '1px solid #e3e9f1',
      borderRadius: '999px', padding: '5px 10px', fontWeight: '700', fontSize: '11px',
      whiteSpace: 'nowrap'
    });
  }
  function usagiPanel(title, desc) {
    const block = usagiPaint(usagiNode('section'), {
      minWidth: '0', background: '#ffffff', border: '1px solid #e4eaf2',
      borderRadius: '15px', padding: '19px 20px', boxShadow: '0 7px 25px rgba(28,41,70,.04)'
    });
    block.append(usagiSectionTitle(title, desc));
    return block;
  }
  function usagiGraph() {
    const block = usagiNode('div');
    block.append(usagiPaint(usagiNode('p', '● CPU   ● 메모리'), {
      color: '#3B73B9', fontSize: '11px', fontWeight: '700', margin: '14px 0 8px'
    }));
    const entries = usagiHistory.filter(entry => usagiPercent(entry?.metrics?.cpu?.percent) && usagiPercent(entry?.metrics?.memory?.percent));
    if (entries.length < 2) {
      block.append(usagiPaint(usagiNode('p', '아직 비교할 실측 기록이 부족합니다. 「추이 기록 추가」로 2회 이상 측정하면 그래프를 표시합니다.'), {
        color: '#778498', margin: '24px 0', lineHeight: '1.7', fontSize: '12px'
      }));
      return block;
    }
    const NS = 'http://www.w3.org/2000/svg';
    const graph = document.createElementNS(NS, 'svg');
    graph.setAttribute('viewBox', '0 0 620 220');
    graph.setAttribute('width', '100%');
    graph.setAttribute('height', '220');
    graph.setAttribute('role', 'img');
    graph.setAttribute('aria-label', `실측 ${entries.length}회. CPU 마지막 ${entries.at(-1).metrics.cpu.percent.toFixed(1)}%, 메모리 마지막 ${entries.at(-1).metrics.memory.percent.toFixed(1)}%`);
    const coords = (key) => entries.map((entry, index) => {
      const x = 40 + (entries.length === 1 ? 0 : 558 * index / (entries.length - 1));
      const y = 180 - 1.48 * entry.metrics[key].percent;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    for (const val of [0, 25, 50, 75, 100]) {
      const y = 180 - val * 1.48;
      const guide = document.createElementNS(NS, 'line');
      for (const [key, value] of [['x1', '40'], ['x2', '605'], ['y1', String(y)], ['y2', String(y)], ['stroke', '#e9eef6'], ['stroke-width', '1']]) guide.setAttribute(key, value);
      graph.append(guide);
      const tick = document.createElementNS(NS, 'text');
      tick.setAttribute('x', '5'); tick.setAttribute('y', String(y + 4));
      tick.setAttribute('font-size', '11'); tick.setAttribute('fill', '#99a5b4');
      tick.textContent = `${val}%`; graph.append(tick);
    }
    for (const [key, color] of [['cpu', '#3575D5'], ['memory', '#77B5EA']]) {
      const line = document.createElementNS(NS, 'polyline');
      for (const [attr, value] of [['points', coords(key)], ['fill', 'none'], ['stroke', color], ['stroke-width', '3.4'], ['stroke-linejoin', 'round'], ['stroke-linecap', 'round']]) line.setAttribute(attr, value);
      graph.append(line);
    }
    for (const [x, at, anchor] of [[40, entries[0].at, 'start'], [598, entries[entries.length - 1].at, 'end']]) {
      const tick = document.createElementNS(NS, 'text');
      tick.setAttribute('x', String(x)); tick.setAttribute('y', '208');
      tick.setAttribute('text-anchor', anchor); tick.setAttribute('font-size', '11');
      tick.setAttribute('fill', '#687a91'); tick.textContent = usagiClock(at);
      graph.append(tick);
    }
    block.append(graph);
    block.append(usagiPaint(usagiNode('p', `이 탭의 실제 조회 ${entries.length}회 · ${usagiTime(entries[0].at)} ~ ${usagiTime(entries[entries.length - 1].at)} · 연속 감시/장기 저장 자료 아님. 탭을 닫으면 기록은 사라집니다.`), {
      color: '#8491a4', fontSize: '11px', lineHeight: '1.6', margin: '5px 0 0'
    }));
    return block;
  }
  function usagiDashboard(mode) {
    if (!usagiAutoStarted) {
      usagiAutoStarted = true;
      // Start after the initial DOM has mounted; never start a loop from render.
      setTimeout(() => { void usagiInitialMeasurements(); }, 0);
    }
    // 학생 화면의 값은 '현재 상태'가 아니라 사용자가 직접 추가한 마지막 추이 기록이다.
    // 오래된 기록도 측정 시각과 함께 보존하되, 현재값처럼 표현하지 않는다.
    const record = ['ok', 'loading'].includes(usagiPc.status) && usagiPc.current ? usagiPc.current : null;
    const observedEvent = record?.metrics?.events;
    const observedFirewall = record?.metrics?.firewall;
    const observedNetwork = record?.metrics?.network;
    const hasValidEventCounts = Boolean(observedEvent?.counts &&
      usagiCount(observedEvent.counts.warnings) && usagiCount(observedEvent.counts.errors) &&
      usagiCount(observedEvent.counts.sampleLimit) && typeof observedEvent.counts.truncated === 'boolean');
    const hasValidNetworkConfig = Boolean(observedNetwork?.configCounts &&
      usagiCount(observedNetwork.configCounts.interfaces) && usagiCount(observedNetwork.configCounts.ipv4));
    const shell = usagiPaint(usagiNode('section', undefined, 'student-pc-dashboard'), {
      background: '#F6F9FD', color: '#202a3c', border: '1px solid #e6ebf3', borderRadius: '17px',
      padding: 'clamp(16px, 2.5vw, 32px)', fontFamily: 'Pretendard, Malgun Gothic, Segoe UI, sans-serif',
      boxSizing: 'border-box', minWidth: '0'
    });
    const eyebrow = usagiPaint(usagiNode('p', 'SECURITY OVERVIEW'), {
      color: '#3575D5', fontWeight: '800', letterSpacing: '1.8px', fontSize: '11px', margin: '0 0 6px'
    });
    const intro = usagiPaint(usagiNode('div'), { display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'end', gap: '12px', marginBottom: '17px' });
    const introLeft = usagiNode('div');
    introLeft.append(eyebrow, usagiPaint(usagiNode('h3', '우사기강 관제 대시보드'), { fontSize: '27px', fontWeight: '800', letterSpacing: '-1px', margin: '0', color: '#202a3c' }));
    introLeft.append(usagiPaint(usagiNode('p', '제공 「내 PC 상태」의 현재값을 바탕으로 추이·연결·위험 신호를 구분해 확인합니다.'), { color: '#818da1', fontSize: '12px', margin: '8px 0 0' }));
    intro.append(introLeft);
    const badges = usagiPaint(usagiNode('div'), { display: 'flex', gap: '8px', flexWrap: 'wrap' });
    badges.append(usagiPill(record ? '● PC 실측 기록 있음' : '● PC 기록 없음', record ? 'ok' : 'warning'));
    badges.append(usagiPill(mode === 'disconnected' ? '● SDP 미연결' : mode === 'demo' ? '● 연결 예제' : '● SDP 연결 별도 확인'));
    intro.append(badges); shell.append(intro);
    shell.append(usagiPaint(usagiNode('p', 'CPU·메모리·디스크·방화벽의 현재값은 별도 제공 「내 PC 상태」에서 확인합니다. 이 학생 화면은 같은 로컬 조회를 이용한 추이와 연결·위험 기록만 보완하며, 확인하지 못한 값은 예시로 채우지 않습니다.'), {
      background: '#EAF3FF', border: '1px solid #D3E4F8', borderRadius: '10px', padding: '12px 14px',
      fontSize: '12px', lineHeight: '1.7', color: '#60738b', margin: '0 0 14px'
    }));
    const coreFeatures = usagiPaint(usagiNode('div'), {
      display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '0 0 24px'
    });
    coreFeatures.setAttribute('aria-label', '확인할 수 있는 정보');
    coreFeatures.append(
      usagiPill('PC 사용량 변화'),
      usagiPill('서비스 연결 상태'),
      usagiPill('Windows 경고·오류 기록')
    );
    shell.append(coreFeatures);
    const overviewTitle = usagiSectionTitle('현재 관제 요약', '상세 현재값을 반복하지 않고, 네 영역의 확인 상태만 요약합니다.');
    shell.append(overviewTitle);
    const overview = usagiPaint(usagiNode('div'), {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,190px),1fr))',
      gap: '12px', margin: '13px 0 24px'
    });
    const engineState = mode === 'disconnected'
      ? ['연결 없음', 'SDP 보안 서버가 연결되지 않았습니다.', 'warning']
      : mode === 'demo'
        ? ['예제 연결', '실제 SDP 연결 결과가 아닙니다.', 'warning']
        : mode === 'live'
          ? ['연결 상태 수신', '세부 계정·기기·세션 상태는 아래에서 확인합니다.', 'ok']
          : ['확인 불가', 'SDP 연결 모드를 확인할 수 없습니다.', 'warning'];
    const overviewItems = [
      {
        title: 'PC 실측 기록',
        value: record ? '마지막 기록 있음' : '기록 없음',
        note: record ? `${usagiTime(record.at)} · 이 PC 실측 기록 · 현재값 아님` : '제공 조회와 별도로 「추이 기록 추가」를 눌러 기록하세요.',
        tone: record ? 'ok' : 'warning',
      },
      { title: 'SDP 연결', value: engineState[0], note: engineState[1], tone: engineState[2] },
      {
        title: 'Windows 위험 신호',
        value: hasValidEventCounts ? '실측 기록 있음' : '확인 불가',
        note: hasValidEventCounts ? '최근 24시간 관측 · 침해 판정 아님' : '경고·오류 건수를 0건으로 간주하지 않습니다.',
        tone: hasValidEventCounts ? 'ok' : 'warning',
      },
      {
        title: '네트워크 관측',
        value: hasValidNetworkConfig ? '구성 정보 있음' : '확인 불가',
        note: hasValidNetworkConfig ? '로컬 구성 요약 · 실제 연결 상태는 확인 불가' : '읽지 못한 값을 정상으로 간주하지 않습니다.',
        tone: hasValidNetworkConfig ? 'ok' : 'warning',
      },
    ];
    for (const item of overviewItems) {
      const card = usagiPaint(usagiNode('article'), {
        minWidth: '0', background: '#fff', border: '1px solid #e4eaf2',
        borderRadius: '14px', padding: '16px 17px', boxSizing: 'border-box'
      });
      card.append(usagiPaint(usagiNode('strong', item.title), {
        display: 'block', color: '#66758d', fontSize: '12px', marginBottom: '10px'
      }));
      card.append(usagiPaint(usagiNode('p', item.value), {
        color: item.tone === 'ok' ? '#18775c' : '#9b691b', fontSize: '18px',
        fontWeight: '800', lineHeight: '1.35', margin: '0 0 7px', overflowWrap: 'anywhere'
      }));
      card.append(usagiPaint(usagiNode('p', item.note), {
        color: '#8492a6', fontSize: '11px', lineHeight: '1.6', margin: '0', overflowWrap: 'anywhere'
      }));
      overview.append(card);
    }
    shell.append(overview);
    const row = usagiPaint(usagiNode('div'), { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' });
    const title = usagiSectionTitle('PC 상태 기록', record ? `마지막 측정: ${usagiTime(record.at)} · 내 PC 실측(local-pc) · 현재 상태가 아닌 기록` : '아직 측정 기록이 없습니다. 조회하면 PC 사용량 변화를 확인할 수 있어요.');
    row.append(title);
    const refresh = usagiPaint(usagiNode('button', usagiPc.status === 'loading' ? '조회 중…' : '다시 조회'), {
      background: '#ffffff', color: '#59677b', border: '1px solid #e1e8f0', borderRadius: '9px',
      fontWeight: '700', fontSize: '12px', padding: '9px 13px', cursor: 'pointer'
    });
    refresh.id = 'usagi-pc-refresh'; refresh.type = 'button'; refresh.disabled = usagiPc.status === 'loading';
    refresh.addEventListener('click', usagiRefreshPc); row.append(refresh); shell.append(row);
    const status = usagiPaint(usagiNode('p', record ? `${usagiPc.message} 현재값은 별도 제공 「내 PC 상태」에서 확인하세요.` : usagiPc.message), {
      fontSize: '12px', color: usagiPc.status === 'error' ? '#ba3226' : '#78869b', margin: '0 0 13px', lineHeight: '1.7'
    });
    status.setAttribute('role', 'status'); shell.append(status);
    if (usagiAutoPhase === 'waiting' || usagiAutoPhase === 'second') {
      const autoNote = usagiPaint(usagiNode('p', usagiAutoPhase === 'waiting'
        ? '첫 측정 완료 · 4초 뒤 한 번 더 측정합니다. 두 번째 결과가 오면 짧은 구간의 변화 그래프를 표시해요.'
        : '두 번째 측정 중… 위 숫자는 첫 번째 실측 기록입니다.'), { fontSize: '12px', color: '#52627b', margin: '0 0 14px' });
      autoNote.setAttribute('role', 'status'); shell.append(autoNote);
    }
    const featureDetails = usagiNode('section', undefined, 'student-dashboard-details');
    usagiApply(featureDetails, {
      border: '1px solid #dfe7f1', borderRadius: '12px', background: '#fff',
      overflow: 'hidden', marginTop: '5px'
    });
    const featureSummary = usagiNode('h4', 'PC 상태와 연결 정보');
    usagiApply(featureSummary, {
      margin: '0', padding: '13px 16px', color: '#3575D5',
      background: '#eef5ff', fontSize: '13px', fontWeight: '750', lineHeight: '1.5'
    });
    const featureBody = usagiNode('div', undefined, 'student-dashboard-details-body');
    usagiApply(featureBody, { padding: '16px', minWidth: '0' });
    featureDetails.append(featureSummary, featureBody);
    const lower = usagiPaint(usagiNode('div'), { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: '16px', marginBottom: '16px' });
    const trend = usagiPanel('PC 사용량 변화', '직접 조회한 CPU·메모리 사용량을 시간순으로 보여 줍니다.');
    trend.append(usagiGraph()); lower.append(trend);
    const protection = usagiPanel('서비스 연결 상태', 'PC 측정 기록과 보안 서버·AI 연결 상태를 각각 확인하세요.');
    const connRows = [
      ['내 PC 추이 기록', record ? `마지막 실측 ${usagiClock(record.at)}` : '기록 없음', record ? 'ok' : 'warning'],
      ['SDP 보안 서버', mode === 'disconnected' ? '연결 없음' : '별도 확인 필요', 'default'],
      ['AI 연결 점검', '별도 AI 연결 영역에서 확인', 'default'],
      ['AI 사건 설명', '미실행·별도 확인', 'default']
    ];
    for (const [label, value, tone] of connRows) {
      const line = usagiPaint(usagiNode('div'), { display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', borderBottom: '1px solid #eef1f7', padding: '14px 0' });
      line.append(usagiPaint(usagiNode('strong', label), { fontSize: '12px', color: '#334155' }));
      line.append(usagiPill(value, tone)); protection.append(line);
    }
    lower.append(protection); featureBody.append(lower);
    const bottom = usagiPaint(usagiNode('div'), { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: '16px' });
    const events = usagiPanel('Windows 경고·오류 기록', '최근 24시간의 시스템·프로그램 기록입니다. 건수만으로 침해 여부를 판단하지 않습니다.');
    const event = observedEvent;
    events.append(usagiPaint(usagiNode('p', event?.text ?? '확인 불가'), { fontSize: '19px', fontWeight: '800', color: '#27344a', margin: '18px 0 6px' }));
    events.append(usagiPaint(usagiNode('p', event?.note ?? '최근 기록을 조회하지 못했습니다. 건수 0으로 간주하지 않습니다.'), { color: '#8492a6', fontSize: '12px', lineHeight: '1.6', margin: '0' }));
    if (event?.counts) {
      const countInfo = usagiPaint(usagiNode('div'), {
        display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px'
      });
      countInfo.append(usagiPill(`경고 ${event.counts.warnings}건`, 'warning'));
      countInfo.append(usagiPill(`오류 ${event.counts.errors}건`, event.counts.errors ? 'warning' : 'ok'));
      countInfo.append(usagiPill(event.counts.truncated ? '일부 집계' : '조회 범위 집계', event.counts.truncated ? 'warning' : 'default'));
      events.append(countInfo);
      const comparison = usagiPaint(usagiNode('figure'), { margin: '18px 0', padding: '16px', background: '#f5f8fc', borderRadius: '12px' });
      comparison.append(usagiPaint(usagiNode('figcaption', '경고·오류 건수 비교'), { fontSize: '12px', fontWeight: '700', color: '#43546e', marginBottom: '14px' }));
      const maximum = Math.max(event.counts.warnings, event.counts.errors, 1);
      for (const [label, count, color] of [['경고', event.counts.warnings, '#b67c20'], ['오류', event.counts.errors, '#bb5265']]) {
        const row = usagiPaint(usagiNode('div'), { marginBottom: '13px' });
        const caption = usagiPaint(usagiNode('div'), { display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '12px', color: '#334155', marginBottom: '6px' });
        caption.append(usagiNode('span', label), usagiNode('strong', `${count}건`));
        const track = usagiPaint(usagiNode('div'), { height: '10px', background: '#e3eaf3', borderRadius: '6px', overflow: 'hidden' });
        track.setAttribute('aria-hidden', 'true');
        track.append(usagiPaint(usagiNode('div'), { width: `${100 * count / maximum}%`, height: '100%', background: color, borderRadius: '6px' }));
        row.append(caption, track); comparison.append(row);
      }
      comparison.append(usagiPaint(usagiNode('p', '막대 길이는 두 건수의 상대 비교이며 위험 점수가 아닙니다.'), { fontSize: '11px', color: '#52627b', margin: '8px 0 0', lineHeight: '1.6' }));
      events.append(comparison);
      events.append(usagiPaint(usagiNode('p', `조회 표본 한도 ${event.counts.sampleLimit}건 · 이벤트 개별 목록은 이 PC 요약 API에서 제공하지 않습니다. 실제 경고·오류 수만 표시합니다.`), {
        fontSize: '11px', lineHeight: '1.6', color: '#8995a7', margin: '11px 0 0'
      }));
    }
    const firewall = usagiPanel('Windows 방화벽 프로필', 'Domain·Private·Public 프로필별 실측값 · PC 전체 안전 판정 아님');
    if (observedFirewall?.profiles) {
      const profileList = usagiPaint(usagiNode('ul'), {
        listStyle: 'none', padding: '0', margin: '18px 0 10px', display: 'grid', gap: '9px'
      });
      for (const profile of observedFirewall.profiles) {
        const item = usagiPaint(usagiNode('li'), {
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
          border: '1px solid #e3eaf3', borderRadius: '10px', padding: '11px 13px', background: '#f8fafd'
        });
        item.append(
          usagiPaint(usagiNode('strong', profile.name), { fontSize: '12px', color: '#334155' }),
          usagiPill(profile.enabled ? '켜짐' : '꺼짐', profile.enabled ? 'ok' : 'warning')
        );
        profileList.append(item);
      }
      firewall.append(profileList);
      firewall.append(usagiPaint(usagiNode('p', observedFirewall.note), {
        color: '#8492a6', fontSize: '12px', lineHeight: '1.6', margin: '0'
      }));
    } else {
      firewall.append(usagiPaint(usagiNode('p', '확인 불가'), {
        fontSize: '19px', fontWeight: '800', color: '#27344a', margin: '18px 0 6px'
      }));
      firewall.append(usagiPaint(usagiNode('p', '이번 조회에서 방화벽 프로필 값을 읽지 못했습니다. 켜짐으로 간주하지 않습니다.'), {
        color: '#8492a6', fontSize: '12px', lineHeight: '1.6', margin: '0'
      }));
    }

    const network = usagiPanel('네트워크 정보', '로컬 구성 요약과 실제 연결 상태를 구분합니다.');
    const net = observedNetwork;
    if (net?.configCounts) {
      const quantities = usagiPaint(usagiNode('div'), { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '12px', margin: '18px 0' });
      for (const [label, count, color] of [['인터페이스', net.configCounts.interfaces, '#3575d5'], ['IPv4 구성', net.configCounts.ipv4, '#168575']]) {
        const tile = usagiPaint(usagiNode('div'), { background: '#f5f8fc', border: '1px solid #e3eaf3', borderRadius: '12px', padding: '16px', minWidth: '0' });
        tile.append(usagiPaint(usagiNode('p', label), { color: '#52627b', fontSize: '12px', margin: '0 0 6px' }));
        tile.append(usagiPaint(usagiNode('strong', `${count}개`), { color, fontSize: '30px', letterSpacing: '-1px', display: 'block' }));
        const blocks = usagiPaint(usagiNode('div'), { display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '12px', minHeight: '12px' });
        blocks.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < Math.min(count, 12); i++) blocks.append(usagiPaint(usagiNode('span'), { width: '12px', height: '12px', borderRadius: '3px', background: color }));
        tile.append(blocks); quantities.append(tile);
      }
      network.append(quantities, usagiPaint(usagiNode('p', '블록 1개 = 구성 1개 · 최대 12개 표시, 전체 개수는 숫자로 표시합니다.'), { fontSize: '11px', color: '#52627b', lineHeight: '1.6' }));
    }
    network.append(usagiPaint(usagiNode('p', net?.text ?? '확인 불가'), { fontSize: '19px', fontWeight: '800', color: '#27344a', margin: '18px 0 6px' }));
    network.append(usagiPaint(usagiNode('p', net?.note ?? '구성 정보를 읽지 못했습니다.'), { color: '#8492a6', fontSize: '12px', lineHeight: '1.6', margin: '0' }));
    const connectionState = usagiPaint(usagiNode('div'), {
      marginTop: '14px', padding: '12px 13px', border: '1px solid #eadfbf', borderRadius: '10px', background: '#fffaf0'
    });
    connectionState.append(usagiPaint(usagiNode('strong', '실제 네트워크 연결 상태: 확인 불가'), {
      display: 'block', color: '#8a601b', fontSize: '12px', marginBottom: '5px'
    }));
    connectionState.append(usagiPaint(usagiNode('p', '현재 로컬 조회 API는 인터페이스와 IPv4 구성 개수만 제공합니다. 인터넷 접속 성공·실패는 측정하지 않았으며 연결됨으로 표시하지 않습니다.'), {
      color: '#7a6a4e', fontSize: '11px', lineHeight: '1.6', margin: '0'
    }));
    network.append(connectionState);
    bottom.append(events, firewall, network); featureBody.append(bottom);
    shell.append(featureDetails);
    return shell;
  }

  return {
    renderIdentity({ me, devices, sessions } = {}) {
      // 관제 화면의 학생 영역만 요약한다. API 계약/상태는 변경하지 않는다.
      const root = document.createElement('div');
      root.className = 'student-identity-view';
      const paint = (el, css) => { Object.assign(el.style, css); return el; };
      const node = (tag, value) => {
        const el = document.createElement(tag);
        if (value !== undefined) el.textContent = String(value);
        return el;
      };
      const palette = {
        ink: '#25334a', muted: '#718098', line: '#e3e9f2', accent: '#3575D5',
        soft: '#F7FAFF', warn: '#965e19', warnBg: '#fff8eb', danger: '#ae3441', dangerBg: '#fff1f2',
        good: '#18775c', goodBg: '#edfaf3'
      };
      paint(root, {
        boxSizing: 'border-box', width: '100%', minWidth: '0', padding: '16px',
        fontFamily: 'Pretendard, Malgun Gothic, Segoe UI, sans-serif',
        color: palette.ink, background: '#fff', border: `1px solid ${palette.line}`,
        borderRadius: '12px', lineHeight: '1.5', overflowWrap: 'anywhere'
      });
      const modeText = resource => ({
        demo: '예제 자료(demo)', disconnected: '연결 없음(disconnected)', unknown: '확인 불가(unknown)'
      })[resource?.mode] || (!resource?.mode ? '확인 불가(unknown)' : String(resource.mode));
      const deviceStatusText = status => ({
        compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가'
      })[status] || '확인 불가';
      const sessionStatusText = status => ({
        active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가'
      })[status] || '확인 불가';
      const stateText = r => {
        if (r?.status === 'loading') return '불러오는 중';
        if (r?.mode === 'disconnected' || r?.error?.code === 'ENGINE_NOT_CONNECTED')
          return '확인할 수 없음 — 과정상 SDP 미연결';
        if (r?.status === 'error')
          return ['CONTRACT_MISMATCH', 'ENGINE_RESULT_UNVERIFIED'].includes(r.error?.code) ? '확인 불가' : '연결 실패';
        if (r?.status === 'ok') return '조회 완료';
        return '확인 불가';
      };
      const resources = [
        { key: 'me', name: '계정', value: me },
        { key: 'devices', name: '기기', value: devices },
        { key: 'sessions', name: '세션', value: sessions }
      ];
      const title = paint(node('div'), { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '12px' });
      title.append(paint(node('strong', '연결 상태 요약'), { fontWeight: '800', fontSize: '14px' }));
      const modeDemo = resources.some(({ value }) => value?.mode === 'demo');
      if (modeDemo) title.append(paint(node('span', '예제 자료 · 실측 아님'), {
        color: '#995c13', fontSize: '11px', padding: '3px 8px', borderRadius: '999px',
        background: palette.warnBg, fontWeight: '700'
      }));
      root.append(title);
      const grid = paint(node('div'), {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,155px),1fr))', gap: '8px'
      });
      const itemSummary = (key, r) => {
        if (r?.status !== 'ok') return stateText(r);
        if (key === 'me') return String(r.data?.user?.label ?? '사용자 정보 확인 불가');
        if (key === 'devices') {
          const all = Array.isArray(r.data) ? r.data : null;
          if (!all) return '목록 확인 불가';
          if (!all.length) return '기기 목록 비어 있음';
          const current = me?.status === 'ok' && me.data?.device;
          return current ? `${deviceStatusText(current.status)}` : `${all.length}개 기기 조회`;
        }
        const all = Array.isArray(r.data) ? r.data : null;
        if (!all) return '목록 확인 불가';
        if (!all.length) return '세션 목록 비어 있음';
        const current = me?.status === 'ok' && me.data?.session;
        return current ? sessionStatusText(current.status) : `${all.length}개 세션 조회`;
      };
      for (const { key, name, value } of resources) {
        const caption = itemSummary(key, value);
        const critical = (key === 'devices' && value?.status === 'ok' && me?.status === 'ok' && me.data?.device?.status === 'noncompliant') ||
          (key === 'sessions' && value?.status === 'ok' && me?.status === 'ok' && ['expired', 'revoked'].includes(me.data?.session?.status));
        const disconnected = value?.mode === 'disconnected' || value?.error?.code === 'ENGINE_NOT_CONNECTED';
        const bad = value?.status === 'error' && !disconnected || critical;
        const uncertain = value?.status !== 'ok' || value?.mode === 'disconnected' || value?.mode === 'unknown' ||
          /확인 불가|비어 있음|미충족|만료|철회/.test(caption);
        const color = bad ? palette.danger : uncertain ? palette.warn : palette.good;
        const tile = paint(node('div'), {
          background: palette.soft, border: `1px solid ${palette.line}`, borderRadius: '10px',
          padding: '12px 12px 11px', minWidth: '0', boxSizing: 'border-box'
        });
        const label = paint(node('div'), { display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '7px' });
        label.append(paint(node('span'), {
          display: 'inline-block', width: '7px', height: '7px', flex: '0 0 7px',
          background: color, borderRadius: '50%'
        }));
        label.append(paint(node('strong', name), { fontSize: '12px', color: palette.ink }));
        tile.append(label);
        tile.append(paint(node('div', caption), {
          color, fontWeight: '750', fontSize: '12px', minWidth: '0', overflowWrap: 'anywhere'
        }));
        if (value?.mode === 'demo') tile.append(paint(node('div', '예제 자료'), { fontSize: '11px', marginTop: '4px', color: palette.warn }));
        if (value?.mode === 'disconnected') tile.append(paint(node('div', '연결 없음(disconnected)'), {
          fontSize: '10px', marginTop: '5px', color: palette.muted
        }));
        grid.append(tile);
      }
      root.append(grid);

      const failures = resources.filter(({ value }) => value?.status === 'error');
      const notReady = resources.filter(({ value }) => value?.status !== 'ok');
      const risky = resources.some(({ key, value }) => value?.status === 'ok' &&
        (key === 'devices' && me?.status === 'ok' && me.data?.device?.status === 'noncompliant' ||
        key === 'sessions' && me?.status === 'ok' && ['expired','revoked'].includes(me.data?.session?.status)));
      let notice = '';
      if (modeDemo) notice = '현재 예제 자료가 포함되어 있습니다. 실제 서버·PC 조회 결과와 구분해 주세요.';
      else if (failures.length) {
        const allDisconnected = failures.every(({ value }) =>
          value?.mode === 'disconnected' || value?.error?.code === 'ENGINE_NOT_CONNECTED');
        if (allDisconnected) {
          notice = '확인할 수 없음 — 과정상 SDP 미연결입니다. 로컬 PC 조회와 별도이며, 인증서·토큰·연결 설정을 임의로 만들지 않습니다.';
        } else {
          const messages = failures.map(({ value }) => String(value.error?.message || '서버가 오류 메시지를 제공하지 않았습니다.'));
          const unique = [...new Set(messages)];
          notice = unique.length === 1 ? `연결 확인 필요 · ${unique[0]}` :
            `계정·기기·세션 중 ${failures.length}개 항목의 조회가 실패했습니다. 각 오류 사유는 상세 상태에서 확인하세요.`;
        }
      } else if (notReady.length) notice = '일부 연결 상태가 확인되지 않았습니다. 확인 불가를 정상으로 처리하지 않습니다.';
      else if (risky) notice = '보안 기준 미충족 또는 만료·철회된 세션이 있습니다. 아래 상세 상태를 확인하세요.';
      if (notice) {
        const alert = paint(node('div'), {
          display: 'flex', gap: '8px', alignItems: 'start', background: palette.warnBg,
          border: '1px solid #f2e0bd', color: palette.warn, borderRadius: '9px',
          marginTop: '12px', padding: '10px 12px', fontSize: '12px', lineHeight: '1.6'
        });
        alert.append(paint(node('strong', 'ⓘ'), { flex: '0 0 auto' }));
        alert.append(node('span', notice));
        root.append(alert);
      }

      const details = paint(node('details'), { borderTop: `1px solid ${palette.line}`, marginTop: '12px', paddingTop: '11px' });
      const summary = paint(node('summary', '상세 상태 및 오류 코드 보기'), {
        color: palette.accent, fontSize: '12px', fontWeight: '750', cursor: 'pointer', padding: '2px 0'
      });
      details.append(summary);
      const body = paint(node('div'), { display: 'grid', gap: '10px', padding: '12px 0 3px' });
      const addField = (list, label, value) => {
        const dt = paint(node('dt', label), { color: palette.muted, fontSize: '12px' });
        const dd = paint(node('dd', String(value ?? '확인 불가')), {
          margin: '0', minWidth: '0', fontSize: '12px', fontWeight: '600', overflowWrap: 'anywhere'
        });
        list.append(dt, dd);
      };
      for (const { key, name, value } of resources) {
        const section = paint(node('section'), {
          border: `1px solid ${palette.line}`, borderRadius: '9px', background: '#fff',
          padding: '12px', minWidth: '0'
        });
        section.append(paint(node('strong', name), { display: 'block', marginBottom: '8px', fontSize: '12px' }));
        const list = paint(node('dl'), {
          display: 'grid', gridTemplateColumns: 'minmax(65px,85px) minmax(0,1fr)',
          gap: '8px 10px', margin: '0'
        });
        addField(list, '조회 상태', stateText(value));
        addField(list, '연결 모드', modeText(value));
        if (value?.status === 'error') {
          // 받은 오류 코드와 서버 메시지를 상세에서 항목별로 보존한다.
          addField(list, '오류 코드', value.error?.code || '확인 불가');
          addField(list, '오류 메시지', value.error?.message || '서버가 오류 메시지를 제공하지 않았습니다.');
        } else if (value?.status === 'loading') {
          addField(list, '다음 동작', '불러오는 중입니다.');
        } else if (value?.status !== 'ok') {
          addField(list, '안내', '상태를 확인할 수 없습니다. 위쪽 다시 불러오기 버튼을 직접 누르세요.');
        }
        if (key === 'me' && value?.status === 'ok') {
          if (value.data?.user) {
            addField(list, '사용자 이름', value.data.user.label);
            addField(list, '사용자 ID', value.data.user.id);
          } else addField(list, '사용자', '사용자 정보 확인 불가');
          if (value.data?.device) {
            addField(list, '현재 기기', value.data.device.label);
            addField(list, '기기 ID', value.data.device.id);
            addField(list, '기기 보안', `${deviceStatusText(value.data.device.status)}(${value.data.device.status ?? 'unknown'})`);
          }
          if (value.data?.session) {
            addField(list, '현재 세션 ID', value.data.session.id);
            addField(list, '현재 세션', `${sessionStatusText(value.data.session.status)}(${value.data.session.status ?? 'unknown'})`);
          }
        }
        if ((key === 'devices' || key === 'sessions') && value?.status === 'ok') {
          const arr = Array.isArray(value.data) ? value.data : null;
          if (!arr) addField(list, '목록', '목록 형식 확인 불가');
          else if (arr.length === 0) addField(list, '목록', `표시할 ${name} 정보가 없습니다.`);
          else {
            for (const [i, item] of arr.entries()) {
              const what = key === 'devices'
                ? `${item?.label ?? '확인 불가'} · ID ${item?.id ?? '확인 불가'} · ${deviceStatusText(item?.status)}(${item?.status ?? 'unknown'})`
                : `세션 ID ${item?.id ?? '확인 불가'} · ${sessionStatusText(item?.status)}(${item?.status ?? 'unknown'})`;
              addField(list, `${name} ${i+1}`, what);
            }
          }
        }
        section.append(list); body.append(section);
      }
      details.append(body);
      root.append(details);
      return root;
    },
    renderDecision({ status, mode, data, error, appId } = {}) {
      const root = document.createElement('div');
      root.className = 'student-decision-view';

      const addText = (tag, text, className) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        node.textContent = text;
        root.append(node);
        return node;
      };

      if (mode === 'demo') {
        addText('p', '예제 자료(demo) · 실제 서버의 접속 판정이 아닙니다.', 'student-decision-mode');
      } else if (mode === 'disconnected') {
        addText('p', '연결 없음(disconnected)', 'student-decision-mode');
      } else if (mode === 'unknown' || !mode) {
        addText('p', '연결 상태 확인 불가(unknown)', 'student-decision-mode');
      }

      if (status === 'idle') {
        addText('p', '업무 앱을 선택하고 접속을 요청하세요.', 'student-decision-status');
        return usagiUnifyStudentView(root);
      }

      if (status === 'loading') {
        if (typeof appId === 'string' && appId) addText('p', `선택한 업무 앱 ID: ${appId}`);
        addText('p', '접속 판정을 확인하는 중입니다.', 'student-decision-status');
        return usagiUnifyStudentView(root);
      }

      if (status === 'error') {
        if (typeof appId === 'string' && appId) addText('p', `선택한 업무 앱 ID: ${appId}`);
        const message = typeof error?.message === 'string' && error.message
          ? error.message
          : '서버가 오류 메시지를 제공하지 않았습니다.';
        addText('p', `접속 판정 요청 실패: ${message}`, 'student-decision-status');
        addText('p', '요청 실패는 거부 판정이 아니며, 접근이 허용됐다는 뜻도 아닙니다.');
        return usagiUnifyStudentView(root);
      }

      if (status !== 'ok' || !data || typeof data !== 'object') {
        addText('p', '접속 판정을 확인할 수 없습니다. 허용으로 간주하지 마세요.', 'student-decision-status');
        return usagiUnifyStudentView(root);
      }

      const resultAppId = typeof data.appId === 'string' && data.appId ? data.appId : appId;
      if (typeof resultAppId === 'string' && resultAppId) addText('p', `판정 대상 업무 앱 ID: ${resultAppId}`);

      const decisionLabels = {
        allow: '허용(allow)',
        deny: '거부(deny)',
        challenge: '추가 확인 필요(challenge)',
        unknown: '확인 불가(unknown)',
      };
      const decision = typeof data.decision === 'string' && Object.hasOwn(decisionLabels, data.decision)
        ? data.decision
        : 'unknown';
      addText('p', `접속 판정: ${decisionLabels[decision]}`, 'student-decision-status');

      const reason = typeof data.reason === 'string' ? data.reason : '판정 이유를 확인할 수 없습니다.';
      addText('p', `판정 이유: ${reason}`, 'student-decision-reason');
      const checkedAt = typeof data.checkedAt === 'string' ? data.checkedAt : '확인 시각을 확인할 수 없습니다.';
      addText('p', `확인 시각: ${checkedAt}`, 'student-decision-checked-at');

      if (decision === 'challenge') {
        addText('p', '이 앱은 추가 인증 또는 확인 절차를 대신 수행하지 않습니다.');
      }
      if (decision === 'unknown') {
        addText('p', '확인할 수 없는 판정이며 허용으로 처리하지 않습니다.');
      }
      return usagiUnifyStudentView(root);
    },
    renderEvents({ status, mode, data, error } = {}) {
      const root = document.createElement('div');
      root.className = 'student-events-view';

      const addText = (parent, tag, text, className) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        node.textContent = String(text ?? '');
        parent.append(node);
        return node;
      };

      if (mode === 'demo') {
        addText(root, 'p', '예제 자료(demo) · 실제 접속 기록이나 XDR 경보가 아닙니다.', 'student-events-mode');
      } else if (mode === 'disconnected') {
        addText(root, 'p', '연결 없음(disconnected)', 'student-events-mode');
      } else if (mode === 'unknown' || !mode) {
        addText(root, 'p', '연결 상태 확인 불가(unknown)', 'student-events-mode');
      }

      if (status === 'loading') {
        addText(root, 'p', '보안 기록을 불러오는 중입니다.', 'student-events-status');
        return usagiUnifyStudentView(root);
      }

      if (status === 'error') {
        const message = typeof error?.message === 'string' && error.message
          ? error.message
          : '서버가 오류 메시지를 제공하지 않았습니다.';
        const unverified = ['CONTRACT_MISMATCH', 'ENGINE_RESULT_UNVERIFIED'].includes(error?.code);
        addText(root, 'p', unverified
          ? `확인 불가: ${message} 이전 기록은 현재 결과로 표시하지 않습니다.`
          : `기록을 불러오지 못했습니다: ${message}`, 'student-events-status');
        return usagiUnifyStudentView(root);
      }

      if (status !== 'ok' || !Array.isArray(data)) {
        addText(root, 'p', '확인 불가: 기록 상태 또는 응답 형식을 확인할 수 없습니다. 이전 기록은 표시하지 않습니다.', 'student-events-status');
        return usagiUnifyStudentView(root);
      }

      // 정렬은 새 배열에서만 수행해 제공받은 data 배열을 바꾸지 않는다.
      const events = [...data].sort((left, right) => Date.parse(right.at) - Date.parse(left.at));
      if (events.length === 0) {
        addText(root, 'p', '표시할 기록이 없습니다.', 'student-events-status');
        return usagiUnifyStudentView(root);
      }

      const kindLabels = { access: '접속 기록', xdr: 'XDR 경보' };
      const stateLabels = {
        access: { allowed: '허용됨', denied: '거부됨', unknown: '확인 불가' },
        session: { active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가' },
        device: { compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가' },
      };
      const stateText = (kind, value) => {
        const original = typeof value === 'string' && value ? value : 'unknown';
        const description = stateLabels[kind]?.[original];
        return original === 'unknown' || !description
          ? `확인 불가(${original})`
          : `${description}(${original})`;
      };
      const appValue = (event) => event.appId == null ? '' : String(event.appId);
      const filterValue = (event, key) => key === 'appId' ? appValue(event) : String(key === 'kind' ? event.kind : event.state?.access ?? 'unknown');

      const filterGroup = document.createElement('div');
      filterGroup.className = 'student-events-filters';
      const makeFilter = (name, key, values) => {
        const label = document.createElement('label');
        label.textContent = `${name} `;
        const select = document.createElement('select');
        select.setAttribute('aria-label', name);

        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = '전체';
        select.append(allOption);

        for (const value of values) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = key === 'appId' && value === '' ? '앱 ID 없음' : value;
          select.append(option);
        }
        select.value = 'all';
        label.append(select);
        filterGroup.append(label);
        return select;
      };

      const kindValues = [...new Set(events.map((event) => String(event.kind)))].sort();
      const appValues = [...new Set(events.map(appValue))].sort();
      const accessValues = [...new Set(events.map((event) => String(event.state?.access ?? 'unknown')))].sort();
      const kindFilter = makeFilter('기록 종류', 'kind', kindValues);
      const appFilter = makeFilter('업무 앱', 'appId', appValues);
      const accessFilter = makeFilter('접속 상태', 'access', accessValues);
      root.append(filterGroup);

      const count = addText(root, 'p', '', 'student-events-count');
      const list = document.createElement('ul');
      list.className = 'student-events-list';
      root.append(list);
      const detailMount = document.createElement('div');
      detailMount.className = 'student-event-detail-mount';
      root.append(detailMount);

      const appendTextField = (parent, label, value) => addText(parent, 'p', `${label}: ${value}`);
      const renderDetail = (event) => {
        detailMount.replaceChildren();
        const detail = document.createElement('section');
        detail.className = 'student-event-detail';
        detail.setAttribute('data-student-event-detail', String(event.id));
        addText(detail, 'h3', `${event.id} 상세`);
        appendTextField(detail, '사건 ID', event.id);
        appendTextField(detail, '업무 앱 ID', event.appId == null ? '앱을 확인할 수 없습니다' : event.appId);

        const appendRows = (title, rows, emptyText) => {
          addText(detail, 'h4', title);
          if (rows.length === 0) {
            addText(detail, 'p', emptyText);
            return;
          }
          const items = document.createElement('ul');
          for (const row of rows) {
            const item = document.createElement('li');
            appendTextField(item, 'ID', row.id);
            appendTextField(item, '내용', row.text);
            items.append(item);
          }
          detail.append(items);
        };
        appendRows('근거(evidence)', Array.isArray(event.evidence) ? event.evidence : [], '표시할 근거가 없습니다.');
        appendRows('규칙(rules)', Array.isArray(event.rules) ? event.rules : [], '표시할 규칙이 없습니다.');

        addText(detail, 'h4', '상태');
        for (const key of ['access', 'session', 'device']) {
          appendTextField(detail, `${({ access: '접속', session: '세션', device: '기기' })[key]} 상태`, stateText(key, event.state?.[key]));
        }
        if (Array.isArray(event.supportedActions) && event.supportedActions.length > 0) {
          addText(detail, 'p', '아직 지원하지 않는 조치입니다. 조치 실행 연결은 준비 중입니다.');
          for (const action of event.supportedActions) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = `${action} 미지원`;
            button.disabled = true;
            detail.append(button);
          }
        }
        detailMount.append(detail);
        usagiStyleStudentRows(detailMount, 'events');
      };

      const renderRows = () => {
        const filtered = events.filter((event) =>
          (kindFilter.value === 'all' || filterValue(event, 'kind') === kindFilter.value)
          && (appFilter.value === 'all' || filterValue(event, 'appId') === appFilter.value)
          && (accessFilter.value === 'all' || filterValue(event, 'access') === accessFilter.value));
        count.textContent = `필터 결과: ${filtered.length}건 / 전체 ${events.length}건`;
        list.replaceChildren();
        if (filtered.length === 0) {
          addText(list, 'li', '현재 필터와 일치하는 기록이 없습니다.');
          return;
        }

        for (const event of filtered) {
          const row = document.createElement('li');
          row.setAttribute('data-student-event-id', String(event.id));
          appendTextField(row, '사건 ID', event.id);
          appendTextField(row, '시각', event.at);
          appendTextField(row, '종류', kindLabels[event.kind] || `확인 불가(${event.kind})`);
          appendTextField(row, '업무 앱', event.appId == null ? '앱을 확인할 수 없습니다' : event.appId);
          appendTextField(row, '요약', event.summary);

          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = `${event.id} 상세`;
          button.addEventListener('click', () => renderDetail(event));
          row.append(button);
          list.append(row);
        }
        usagiStyleStudentRows(root, 'events');
      };

      const clearDetailAndRender = () => {
        detailMount.replaceChildren();
        renderRows();
      };
      kindFilter.addEventListener('change', clearDetailAndRender);
      appFilter.addEventListener('change', clearDetailAndRender);
      accessFilter.addEventListener('change', clearDetailAndRender);
      renderRows();
      return usagiUnifyStudentView(root);
    },
    renderStatus({ devices, sessions, notifications, diagnostics, mode } = {}) {
      const root = document.createElement('div');
      root.className = 'student-status-view';
      root.append(usagiDashboard(mode));
      const add = (parent, tag, text) => {
        const node = document.createElement(tag);
        node.textContent = String(text ?? '');
        parent.append(node);
        return node;
      };
      const value = (input) => typeof input === 'string' || typeof input === 'number'
        ? String(input) : '확인 불가';
      const showMode = (parent, current) => {
        if (current === 'demo') add(parent, 'p', '예제 자료(demo)');
        else if (current === 'disconnected') add(parent, 'p', '연결 없음(disconnected)');
        else if (!current || current === 'unknown') add(parent, 'p', '연결 상태 확인 불가(unknown)');
      };
      showMode(root, mode);
      const failure = (parent, resource, name) => {
        const timeout = /TIMEOUT/.test(resource.error?.code ?? '');
        add(parent, 'p', `${name}를 불러오지 못했습니다${timeout ? ' (시간 초과)' : ''}: ${value(resource.error?.message)}`);
        add(parent, 'p', '다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요.');
      };
      for (const [resource, name, empty, field] of [
        [devices, '기기 정보', '등록된 기기가 없습니다.', 'label'],
        [sessions, '세션 정보', '현재 연결 없음', 'id'],
      ]) {
        const section = document.createElement('section');
        add(section, 'h3', name);
        showMode(section, resource?.mode ?? mode);
        if (field === 'id') add(section, 'p', '세션 조회 범위는 현재 검증된 연결 하나입니다.');
        if (resource?.status === 'loading') add(section, 'p', `${name}를 불러오는 중입니다.`);
        else if (resource?.status === 'error') failure(section, resource, name);
        else if (resource?.status === 'ok' && Array.isArray(resource.data)) {
          if (resource.data.length === 0) add(section, 'p', empty);
          else {
            const list = document.createElement('ul');
            for (const row of resource.data) add(list, 'li', `${field}: ${value(row[field])} · status: ${value(row.status)}`);
            section.append(list);
          }
        } else add(section, 'p', `${name}: 확인 불가. 조회 상태 또는 응답 형식을 확인할 수 없습니다.`);
        root.append(section);
      }
      const notices = document.createElement('section');
      add(notices, 'h3', '알림');
      if (Array.isArray(notifications) && notifications.length === 0) add(notices, 'p', '알림 없음: 주의할 알림이 없습니다.');
      else if (Array.isArray(notifications)) {
        const list = document.createElement('ul');
        for (const notice of notifications) {
          const item = document.createElement('li');
          for (const field of ['resource', 'code', 'message']) add(item, 'p', `${field}: ${value(notice[field])}`);
          list.append(item);
        }
        notices.append(list);
      } else add(notices, 'p', '알림: 확인 불가');
      root.append(notices);
      const diagnosticSection = document.createElement('section');
      add(diagnosticSection, 'h3', '진단 정보');
      showMode(diagnosticSection, diagnostics?.mode ?? mode);
      let helpText = '';
      if (diagnostics?.status === 'loading') add(diagnosticSection, 'p', '진단 정보를 불러오는 중입니다.');
      else if (diagnostics?.status === 'error') failure(diagnosticSection, diagnostics, '진단 정보');
      else if (diagnostics?.status === 'ok') {
        const data = diagnostics.data;
        if (data == null || (typeof data === 'object' && Object.keys(data).length === 0)) {
          add(diagnosticSection, 'p', '표시할 진단 정보가 없습니다.');
        } else if (typeof data !== 'object' || Array.isArray(data)) {
          add(diagnosticSection, 'p', '진단 정보: 확인 불가. 응답 형식을 확인할 수 없습니다.');
        } else {
          // 전체 응답을 직렬화하지 않고 공식 계약의 여섯 필드만 선택한다.
          const safe = {
            requestId: value(data.requestId),
            component: value(data.component),
            version: value(data.version),
            checkedAt: value(data.checkedAt),
            engine: { mode: value(data.engine?.mode), code: value(data.engine?.code) },
          };
          for (const field of ['requestId', 'component', 'version', 'checkedAt']) add(diagnosticSection, 'p', `${field}: ${safe[field]}`);
          for (const field of ['mode', 'code']) add(diagnosticSection, 'p', `engine.${field}: ${safe.engine[field]}`);
          helpText = JSON.stringify(safe, null, 2);
        }
      } else add(diagnosticSection, 'p', '진단 정보: 확인 불가. 조회 상태를 확인할 수 없습니다.');
      // 진단 API가 실패해도 오류 신고에 필요한 실제 확인된 상태는 복사할 수 있어야 한다.
      // 성공 응답은 위에서 선별한 여섯 필드만, 실패/미확인은 상태 및 안전한 코드만 복사한다.
      // 실패 응답의 message 또는 원본 객체 전체를 복사하지 않아 자격 증명의 우발 유출을 막는다.
      const diagnosticAvailable = Boolean(helpText);
      if (!diagnosticAvailable) {
        const status = ['loading', 'error', 'ok'].includes(diagnostics?.status)
          ? diagnostics.status : 'unknown';
        const currentMode = ['disconnected', 'demo', 'live'].includes(mode) ? mode : 'unknown';
        const safeCode = code => typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code)
          ? code : '확인 불가';
        const safeResource = resource => typeof resource === 'string'
          && ['me', 'apps', 'events', 'devices', 'sessions', 'diagnostics'].includes(resource)
          ? resource : '확인 불가';
        const notices = Array.isArray(notifications) ? notifications.slice(0, 20).map(item => ({
          resource: safeResource(item?.resource),
          code: safeCode(item?.code),
        })) : [];
        helpText = JSON.stringify({
          note: '진단 API 실측 결과가 아닌 현재 조회 상태입니다. 확인 불가 값은 추정하지 않았습니다.',
          diagnosticsStatus: status,
          connectionMode: currentMode,
          diagnosticErrorCode: safeCode(diagnostics?.error?.code),
          notificationCodes: notices,
        }, null, 2);
      }
      add(diagnosticSection, 'p', diagnosticAvailable
        ? '도움 요청을 위해 진단 API에서 확인된 지정 여섯 필드만 복사합니다.'
        : '진단 정보가 없어도 현재 조회 상태와 확인된 오류 코드만 복사할 수 있습니다. 비밀값과 오류 원문은 제외합니다.');
      const copy = add(diagnosticSection, 'button', '도움정보 복사');
      copy.type = 'button';
      const feedback = add(diagnosticSection, 'p', '');
      feedback.setAttribute('role', 'status');
      copy.addEventListener('click', async () => {
        try {
          if (typeof navigator.clipboard?.writeText === 'function') {
            await navigator.clipboard.writeText(helpText);
          } else {
            // 일부 로컬 실행 환경에서는 Clipboard API가 없어 클릭 기반 구형 복사를 이용한다.
            const field = document.createElement('textarea');
            field.value = helpText;
            field.setAttribute('readonly', '');
            Object.assign(field.style, { position: 'fixed', left: '-10000px', top: '0', opacity: '0' });
            document.body.append(field);
            let copied = false;
            try { field.select(); copied = document.execCommand?.('copy') === true; }
            finally { field.remove(); }
            if (!copied) throw new Error('CLIPBOARD_UNAVAILABLE');
          }
          feedback.textContent = diagnosticAvailable
            ? '진단 정보를 클립보드에 복사했습니다.'
            : '현재 조회 상태와 안전한 오류 코드를 클립보드에 복사했습니다. 진단 API 결과는 포함되지 않았습니다.';
        } catch {
          feedback.textContent = '도움정보를 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인하세요.';
        }
      });
      root.append(diagnosticSection);
      // 제공 엔진의 자세한 상태와 반복 오류는 삭제하지 않고 단계별로 접는다.
      // 첫 펼침에서도 모든 오류가 쏟아지지 않도록 기기/세션/알림/진단을 개별 details로 감싼다.
      const contents = Array.from(root.children || []);
      if (contents.length > 1) {
        const noticeLabel = Array.isArray(notifications)
          ? `알림 ${notifications.length}건`
          : '알림 건수 확인 불가';
        const modeLabel = mode === 'disconnected' ? '엔진 연결 없음'
          : mode === 'demo' ? '예제 자료'
            : '엔진 상태 확인 필요';
        const more = usagiNode('details', undefined, 'student-engine-details');
        usagiApply(more, {
          border: `1px solid ${USAGI_THEME.border}`, borderRadius: '12px',
          background: '#fff', marginTop: '12px', minWidth: '0', overflow: 'hidden'
        });
        const heading = usagiNode('summary', `보안 엔진 상세 · ${modeLabel} · ${noticeLabel}`);
        usagiApply(heading, {
          cursor: 'pointer', color: USAGI_THEME.accent, fontWeight: '750',
          fontSize: '13px', lineHeight: '1.5', padding: '13px 16px',
          background: '#EAF3FF', overflowWrap: 'anywhere'
        });
        more.append(heading);
        const detailsBody = usagiNode('div', undefined, 'student-engine-details-body');
        usagiApply(detailsBody, {
          display: 'grid', gap: '9px', padding: '12px', minWidth: '0'
        });
        const sectionLabels = [
          ['기기 정보', devices?.status === 'error' ? '조회 실패' : devices?.status === 'loading' ? '조회 중'
            : devices?.status === 'ok' && Array.isArray(devices.data) ? `${devices.data.length}건` : '확인 불가'],
          ['세션 정보', sessions?.status === 'error' ? '조회 실패' : sessions?.status === 'loading' ? '조회 중'
            : sessions?.status === 'ok' && Array.isArray(sessions.data) ? `${sessions.data.length}건` : '확인 불가'],
          ['알림', Array.isArray(notifications) ? `${notifications.length}건` : '건수 확인 불가'],
          ['진단 정보', diagnostics?.status === 'error' ? '조회 실패' : diagnostics?.status === 'loading' ? '조회 중'
            : diagnostics?.status === 'ok' ? '조회 결과' : '확인 불가'],
        ];
        let sectionIndex = 0;
        for (const child of contents.slice(1)) {
          if (String(child.tagName || '').toLowerCase() !== 'section') {
            detailsBody.append(child);
            continue;
          }
          const [title, state] = sectionLabels[sectionIndex] || ['상세 정보', '확인 필요'];
          sectionIndex += 1;
          const disclosure = usagiNode('details', undefined, 'student-engine-subdetails');
          usagiApply(disclosure, {
            border: `1px solid ${USAGI_THEME.border}`, borderRadius: '10px',
            background: '#fff', overflow: 'hidden', minWidth: '0'
          });
          const summary = usagiNode('summary');
          usagiApply(summary, {
            padding: '10px 13px', cursor: 'pointer', fontSize: '13px',
            fontWeight: '700', color: '#27344a', lineHeight: '1.5'
          });
          summary.append(usagiNode('span', title));
          const stateLabel = usagiNode('span', state);
          usagiApply(stateLabel, {
            marginLeft: '10px', color: state === '조회 실패' || state === '확인 불가' ? '#9d6615' : '#65758f',
            fontSize: '12px', fontWeight: '500'
          });
          summary.append(stateLabel);
          const originalHeading = Array.from(child.children || []).find(item =>
            /^h[2-4]$/i.test(String(item.tagName || '')));
          if (originalHeading) usagiApply(originalHeading, { display: 'none' });
          usagiApply(child, {
            padding: '4px 13px 12px', margin: '0', minWidth: '0',
            overflowWrap: 'anywhere', fontSize: '12px', lineHeight: '1.6'
          });
          disclosure.append(summary, child);
          detailsBody.append(disclosure);
        }
        more.append(detailsBody);
        // 핵심 관제 대시보드를 먼저 보여 주고, 제공 엔진의 상세 오류는 아래에서 필요할 때 펼친다.
        if (typeof root.replaceChildren === 'function') root.replaceChildren(contents[0], more);
        else { root.textContent = ''; root.append(contents[0], more); }
      }
      return usagiUnifyStudentView(root);
    },
    renderVulnerabilities({ status, mode, data, error } = {}) {
      const root = document.createElement('div');
      root.className = 'student-vulnerabilities-view';

      const addText = (parent, tag, text) => {
        const node = document.createElement(tag);
        node.textContent = String(text ?? '');
        parent.append(node);
        return node;
      };
      const displayValue = (value) => {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          return String(value);
        }
        return '확인 불가';
      };

      if (mode === 'demo') {
        addText(root, 'p', '예제 자료(demo) · 실제 OSV 조회 결과가 아닙니다.');
      }

      if (status === 'idle') {
        addText(root, 'p', '조회 전');
        return usagiUnifyStudentView(root);
      }
      if (status === 'loading') {
        addText(root, 'p', '조회 중');
        return usagiUnifyStudentView(root);
      }
      if (status === 'error') {
        const message = typeof error?.message === 'string' && error.message
          ? error.message
          : '오류 메시지를 확인할 수 없습니다.';
        addText(root, 'p', `조회 실패: ${message}`);
        addText(root, 'p', '조회 실패와 미조회는 취약점 없음이 아닙니다.');
        return usagiUnifyStudentView(root);
      }
      if (status !== 'ok' || !data || typeof data !== 'object' || Array.isArray(data)) {
        addText(root, 'p', '조회 결과를 확인할 수 없습니다.');
        return usagiUnifyStudentView(root);
      }

      const overallStatusLabels = {
        complete: '모두 조회(complete)',
        partial: '일부 조회 실패(partial)',
        not_checked: '아직 조회 안 함(not_checked)',
        not_configured: '조회 준비 미완료(not_configured)',
        unverifiable: 'lock 파일 확인 불가(unverifiable)',
      };
      addText(root, 'p', `전체 조회 상태: ${overallStatusLabels[data.status] || `확인 불가(${displayValue(data.status)})`}`);

      for (const [field, value] of [
        ['lockfileVersion', data.lockfileVersion],
        ['lockfileHash', data.lockfileHash],
        ['checkedAt', data.checkedAt],
      ]) {
        if (value !== undefined && value !== null) addText(root, 'p', `${field}: ${displayValue(value)}`);
      }

      if (!Array.isArray(data.packages)) {
        addText(root, 'p', '패키지 조회 결과 형식을 확인할 수 없습니다.');
        return usagiUnifyStudentView(root);
      }
      if (data.packages.length === 0) {
        addText(root, 'p', '표시할 패키지 조회 결과가 없습니다.');
        return usagiUnifyStudentView(root);
      }

      const packageStatusLabels = (pkg) => {
        if (pkg.status === 'known_vulnerabilities') return '알려진 항목 있음(known_vulnerabilities)';
        if (pkg.status === 'none_found') return '조회 범위에서 알려진 항목 없음(none_found). 이는 패키지나 앱 전체의 안전을 보장하지 않습니다.';
        if (pkg.status === 'unverifiable' && Array.isArray(pkg.vulnerabilities) && pkg.vulnerabilities.length > 0) {
          return '일부 확인·전체 조회 확인 불가(unverifiable)';
        }
        if (pkg.status === 'unverifiable') return '조회 확인 불가(unverifiable)';
        return `확인 불가(${displayValue(pkg.status)})`;
      };

      const packageList = document.createElement('ul');
      for (const pkg of data.packages) {
        const row = document.createElement('li');
        if (pkg?.name !== undefined && pkg.name !== null) {
          row.setAttribute('data-student-package-name', displayValue(pkg.name));
        }
        if (pkg?.version !== undefined && pkg.version !== null) {
          row.setAttribute('data-student-package-version', displayValue(pkg.version));
        }

        addText(row, 'p', `패키지: ${displayValue(pkg?.name)}`);
        addText(row, 'p', `정확한 설치 버전: ${displayValue(pkg?.version)}`);
        addText(row, 'p', `상태: ${packageStatusLabels(pkg || {})}`);
        if (pkg?.source !== undefined && pkg.source !== null) {
          addText(row, 'p', `출처: ${displayValue(pkg.source)}`);
        }
        if (pkg?.checkedAt !== undefined && pkg.checkedAt !== null) {
          addText(row, 'p', `패키지 확인 시각: ${displayValue(pkg.checkedAt)}`);
        }

        const vulnerabilities = Array.isArray(pkg?.vulnerabilities) ? pkg.vulnerabilities : [];
        if (vulnerabilities.length > 0) {
          addText(row, 'h4', '취약점 항목');
          const vulnerabilityList = document.createElement('ul');
          for (const vulnerability of vulnerabilities) {
            addText(vulnerabilityList, 'li', `ID: ${displayValue(vulnerability?.id)} · 수정 시각(modified): ${displayValue(vulnerability?.modified)}`);
          }
          row.append(vulnerabilityList);
        }
        packageList.append(row);
      }
      root.append(packageList);
      return usagiUnifyStudentView(root);
    },
    renderAiConnection({ status, mode, data, error, checkedAt, explanationAccepted = false } = {}) {
      const root = document.createElement('div');
      root.className = 'student-ai-connection-view';
      const addText = (tag, text, className) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        node.textContent = String(text ?? '');
        root.append(node);
        return node;
      };
      const addMode = () => {
        if (mode === 'demo') addText('p', '예제 자료(demo) · 실제 AI 연결 결과가 아닙니다.', 'student-ai-connection-mode');
        else if (mode === 'disconnected') addText('p', '연결 없음(disconnected)', 'student-ai-connection-mode');
        else if (mode === 'unknown' || !mode) addText('p', '연결 상태 확인 불가(unknown)', 'student-ai-connection-mode');
      };
      addMode();

      if (status === 'idle') {
        addText('p', 'AI 연결 점검 전입니다.', 'student-ai-connection-status');
        addText('p', '다시 점검하려면 「현재 API 연결 점검」 버튼을 직접 누르세요. 자동 점검은 하지 않습니다.');
        return usagiUnifyStudentView(root);
      }
      if (status === 'loading') {
        addText('p', 'AI 연결 점검 중입니다.', 'student-ai-connection-status');
        return usagiUnifyStudentView(root);
      }
      if (status === 'error') {
        const guidance = {
          ON_AI_PROVISIONING_PENDING: '계정 연결과 앱 권한 준비 상태를 담당자에게 확인하세요. 운영 측 권한 준비가 필요하며 학생 코드만 수정해서 해결할 수 없습니다.',
          WB_CLCO_AUTH_REQUIRED: '계정 연결을 다시 확인하고 담당자에게 인증 상태를 문의하세요.',
          WB_CLCO_ACCESS_BLOCKED: '계정 연결을 다시 확인하고 담당자에게 앱 접근 권한을 문의하세요.',
          WB_CLCO_COHORT_BUDGET_EXHAUSTED: '반 사용량 한도에 도달했습니다. 담당자에게 확인하세요.',
          WB_CLCO_LIMIT_REACHED: '이용 한도에 도달했습니다. 담당자에게 확인하세요.',
          WB_CLCO_RATE_LIMITED: '요청이 제한됐습니다. 잠시 뒤 직접 다시 점검하세요.',
          WB_CLCO_SESSION_CLOSED: '현재 이용 시간이 아닙니다. 이용 시간을 확인하세요.',
          WB_CLCO_TIMEOUT: '요청 시간이 초과됐습니다. 잠시 뒤 직접 다시 점검하세요.',
          REQUEST_TIMEOUT: '요청 시간이 초과됐습니다. 잠시 뒤 직접 다시 점검하세요.',
          ENGINE_TIMEOUT: '요청 시간이 초과됐습니다. 잠시 뒤 직접 다시 점검하세요.',
          TIMEOUT: '요청 시간이 초과됐습니다. 잠시 뒤 직접 다시 점검하세요.',
          WB_CLCO_NETWORK_ERROR: '네트워크 연결을 확인한 뒤 잠시 뒤 직접 다시 점검하세요.',
          NETWORK_ERROR: '앱 서버 연결을 확인한 뒤 잠시 뒤 직접 다시 점검하세요.',
          WB_CLCO_SERVER_UNAVAILABLE: 'AI 서버가 응답하지 않습니다. 잠시 뒤 직접 다시 점검하세요.',
          WB_CLCO_CANCELLED: '점검이 취소됐습니다. 이전 결과는 현재 점검 결과가 아닙니다.',
          CANCELLED: '점검이 취소됐습니다. 이전 결과는 현재 점검 결과가 아닙니다.',
          REQUEST_CANCELLED: '점검이 취소됐습니다. 이전 결과는 현재 점검 결과가 아닙니다.',
          ON_AI_MODEL_LIST_EMPTY: '사용할 수 있는 모델이 없습니다. 담당자에게 모델 허용 설정을 확인하세요.',
          MODEL_NOT_CONFIGURED: '사용할 모델 설정을 담당자에게 확인하세요.',
          ON_AI_AUTHORIZATION_CHANGED: '권한이 점검 도중 변경됐습니다. 담당자에게 현재 권한을 확인하세요.',
          ON_AI_TRANSPORT_PENDING: 'AI 연결 경로가 준비되지 않았습니다. 담당자에게 확인하세요.',
          ON_AI_INVALID_INPUT: '점검 입력을 확인할 수 없습니다. 담당자에게 문의하세요.',
          ON_AI_INVALID_OUTPUT: '점검 응답을 확인할 수 없습니다. 담당자에게 문의하세요.',
          AI_REQUEST_UNVERIFIED: 'AI 연결 상태를 확인할 수 없습니다. 담당자에게 문의하세요.',
        };
        const code = typeof error?.code === 'string' && Object.hasOwn(guidance, error.code)
          ? error.code
          : 'AI_REQUEST_UNVERIFIED';
        const rawMessage = error?.code === code && typeof error?.message === 'string' ? error.message : '';
        const hasSecretLikeValue = (value) => /(?:Bearer\s+\S+|sk-(?:proj-|ant-|svcacct-)?[A-Za-z0-9_-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_ -]?key|authorization|password|비밀번호|토큰)\s*[:=]\s*\S+)/i.test(value)
          || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
        const message = rawMessage.length > 0 && rawMessage.length <= 500 && !hasSecretLikeValue(rawMessage)
          ? rawMessage
          : guidance[code];
        addText('p', 'AI 연결 점검에 실패했습니다.', 'student-ai-connection-status');
        addText('p', `오류 코드: ${code}`);
        addText('p', `오류 안내: ${message}`);
        addText('p', guidance[code]);
        addText('p', '다시 점검하려면 「현재 API 연결 점검」 버튼을 직접 누르세요. 자동 점검은 하지 않습니다.');
        return usagiUnifyStudentView(root);
      }

      if (status !== 'ok' || !data || typeof data !== 'object'
        || data.transportChecked !== true
        || !['test', 'verified'].includes(data.audienceAuthorization)
        || !Number.isInteger(data.modelCount) || data.modelCount < 0
        || error?.code || error?.message) {
        addText('p', 'AI 연결 점검 결과를 확인할 수 없습니다(unknown). 연결 성공으로 간주하지 않습니다.', 'student-ai-connection-status');
        return usagiUnifyStudentView(root);
      }

      addText('p', data.audienceAuthorization === 'test'
        ? '시험 연결 점검(test)'
        : '앱 권한 확인 후 점검(verified)', 'student-ai-connection-status');
      addText('p', `모델 수: ${data.modelCount}`);
      const time = typeof checkedAt === 'string' && checkedAt.length > 0
        ? checkedAt
        : typeof data.checkedAt === 'string' && data.checkedAt.length > 0
          ? data.checkedAt
          : '확인 시각을 확인할 수 없습니다.';
      addText('p', `점검 시각: ${time}`);
      if (data.audienceAuthorization === 'test') {
        addText('p', 'test는 시험 연결이며 실제 앱 권한 확인이 아닙니다.');
      }
      if (mode === 'demo') {
        addText('p', '예제 자료(demo)이므로 실제 AI 연결 점검 결과가 아닙니다.');
      }
      if (data.audienceAuthorization === 'verified') {
        addText('p', '표시된 점검 시각 기준으로 앱 권한과 모델 응답을 확인했습니다.');
      }
      // 연결 점검은 사건 설명 성공의 근거가 아니다.
      if (explanationAccepted === false) {
        addText('p', '연결만 점검했습니다. 사건 설명은 아직 실행하지 않았습니다.');
      } else {
        addText('p', '이 연결 점검 결과로는 사건 설명의 실행 여부를 확인할 수 없습니다. 보안 기록의 별도 설명 결과를 확인하세요.');
      }
      addText('p', '다시 점검하려면 「현재 API 연결 점검」 버튼을 직접 누르세요. 자동 점검은 하지 않습니다.');
      return usagiUnifyStudentView(root);
    },
    renderExplanation({ event, explanation, checkedAt } = {}) {
      const root = document.createElement('div');
      root.className = 'student-ai-explanation-view';
      const addText = (parent, tag, text, className) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        node.textContent = String(text ?? '');
        parent.append(node);
        return node;
      };
      const safeErrorCode = (value) => typeof value === 'string' && /^[A-Z][A-Z0-9_]{2,63}$/.test(value)
        ? value : 'AI_REQUEST_UNVERIFIED';
      const safeErrorMessage = (value) => {
        if (typeof value !== 'string' || value.length === 0 || value.length > 500) {
          return '안전한 오류 메시지를 확인할 수 없습니다.';
        }
        const secretLike = /(?:Bearer\s+\S+|sk-(?:proj-|ant-|svcacct-)?[A-Za-z0-9_-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_ -]?key|authorization|password|비밀번호|토큰)\s*[:=]\s*\S+)/i.test(value)
          || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
        return secretLike ? '안전한 오류 메시지를 확인할 수 없습니다.' : value;
      };
      const showFailure = (message, className = 'student-ai-explanation-status') => {
        addText(root, 'p', message, className);
        addText(root, 'p', '보안 기록은 그대로입니다.');
      };

      // 오류를 우선 표시하되, 선택 기록이 없으면 기록 선택 안내도 함께 제공한다.
      if (explanation?.status === 'error') {
        const code = safeErrorCode(explanation.error?.code);
        const message = safeErrorMessage(explanation.error?.message);
        showFailure(`AI 설명 실패 (${code}): ${message}`);
        if (explanation.data?.executed === true) {
          addText(root, 'p', 'AI가 실행됐다고 응답한 설명은 사용할 수 없습니다.');
        }
        if (!event || typeof event !== 'object' || typeof event.id !== 'string' || event.id.length === 0) {
          addText(root, 'p', '보안 기록에서 기록을 먼저 고르세요.');
        }
        return usagiUnifyStudentView(root);
      }

      if (!event || typeof event !== 'object' || typeof event.id !== 'string' || event.id.length === 0) {
        addText(root, 'p', '보안 기록에서 기록을 먼저 고르세요.', 'student-ai-explanation-status');
        return usagiUnifyStudentView(root);
      }
      if (explanation?.status === 'idle') {
        addText(root, 'p', 'AI 사건 설명 요청 전입니다.', 'student-ai-explanation-status');
        return usagiUnifyStudentView(root);
      }
      if (explanation?.status === 'loading') {
        addText(root, 'p', 'AI 사건 설명을 요청하는 중입니다.', 'student-ai-explanation-status');
        return usagiUnifyStudentView(root);
      }
      if (explanation?.status !== 'ok' || !explanation.data || typeof explanation.data !== 'object'
        || typeof explanation.data.summary !== 'string'
        || explanation.error?.code || explanation.error?.message) {
        showFailure('AI 설명 결과를 확인할 수 없습니다.');
        return usagiUnifyStudentView(root);
      }

      const data = explanation.data;
      if (data.executed === true) {
        showFailure('AI가 실행됐다고 응답한 설명은 사용할 수 없습니다.');
        return usagiUnifyStudentView(root);
      }
      if (data.executed !== false || data.requiresHumanConfirmation !== true) {
        showFailure('AI 설명을 사용할 수 없습니다. 실행되지 않았음과 사람 확인 필요 조건을 확인할 수 없습니다.');
        return usagiUnifyStudentView(root);
      }

      const evidence = Array.isArray(event.evidence) ? event.evidence : [];
      const evidenceIds = Array.isArray(data.evidenceIds) ? data.evidenceIds : null;
      const proposals = Array.isArray(data.proposals) ? data.proposals : null;
      if (!evidenceIds || !proposals) {
        showFailure('근거를 대조할 수 없어 AI 설명을 사용할 수 없습니다. 근거 자료 형식이 맞지 않습니다.');
        return usagiUnifyStudentView(root);
      }

      // 각 인용 목록은 개별적으로 검사한다. 같은 근거를 요약과 제안이 함께 참조하는 것은 허용한다.
      const citationLists = [evidenceIds];
      for (const proposal of proposals) {
        if (!proposal || typeof proposal !== 'object' || !Array.isArray(proposal.evidenceIds)) {
          showFailure('근거를 대조할 수 없어 AI 설명을 사용할 수 없습니다. 제안의 근거 형식이 맞지 않습니다.');
          return usagiUnifyStudentView(root);
        }
        citationLists.push(proposal.evidenceIds);
      }
      const currentEvidenceIds = new Set(evidence
        .filter((item) => item && item.id !== undefined && item.id !== null)
        .map((item) => String(item.id)));
      const duplicateCitations = citationLists.some((ids) => {
        const normalized = ids.map((id) => String(id));
        return normalized.some((id, index) => normalized.indexOf(id) !== index);
      });
      const citedStrings = citationLists.flatMap((ids) => ids.map((id) => String(id)));
      const missingEvidenceIds = citedStrings.filter((id) => !currentEvidenceIds.has(id));
      const omittedEvidenceIds = evidence
        .filter((item) => item && item.id !== undefined && item.id !== null)
        .map((item) => String(item.id))
        .filter((id) => !evidenceIds.some((citedId) => String(citedId) === id));
      if (duplicateCitations || missingEvidenceIds.length > 0 || omittedEvidenceIds.length > 0) {
        showFailure('근거 ID가 현재 기록의 근거와 일치하지 않아 이 AI 설명을 사용할 수 없습니다. 근거가 맞지 않으며 내용을 보충하거나 지어내지 않았습니다.');
        const code = typeof explanation.error?.code === 'string' ? safeErrorCode(explanation.error.code) : null;
        if (code) addText(root, 'p', `오류 코드: ${code}`);
        if (missingEvidenceIds.length > 0) addText(root, 'p', `현재 기록에서 찾을 수 없는 근거 ID: ${[...new Set(missingEvidenceIds)].join(', ')}`);
        if (omittedEvidenceIds.length > 0) addText(root, 'p', `설명에서 인용하지 않은 기록 근거 ID: ${[...new Set(omittedEvidenceIds)].join(', ')}`);
        if (duplicateCitations) addText(root, 'p', '같은 인용 목록 안에서 근거 ID가 중복되었습니다.');
        return usagiUnifyStudentView(root);
      }

      root.setAttribute('data-student-explanation-event', event.id);
      addText(root, 'p', `사건 ID: ${event.id}`, 'student-ai-explanation-event-id');
      addText(root, 'h3', 'AI 설명(참고용)', 'student-ai-explanation-title');
      addText(root, 'p', data.summary, 'student-ai-explanation-summary');
      if (typeof checkedAt === 'string' && checkedAt.length > 0) addText(root, 'p', `설명 확인 시각: ${checkedAt}`);

      addText(root, 'h4', '인용한 근거');
      if (evidenceIds.length === 0) {
        addText(root, 'p', '인용한 근거 ID가 없습니다.');
      } else {
        const evidenceList = document.createElement('ul');
        for (const id of evidenceIds) {
          const item = evidence.find((candidate) => candidate && String(candidate.id) === String(id));
          addText(evidenceList, 'li', `${id} — ${item.text}`);
        }
        root.append(evidenceList);
      }

      addText(root, 'h4', '규칙');
      const rules = Array.isArray(event.rules) ? event.rules : [];
      if (rules.length === 0) {
        addText(root, 'p', '표시할 규칙이 없습니다.');
      } else {
        const ruleList = document.createElement('ul');
        for (const rule of rules) addText(ruleList, 'li', `${rule?.id ?? 'ID 확인 불가'} — ${rule?.text ?? '규칙 내용을 확인할 수 없습니다.'}`);
        root.append(ruleList);
      }

      addText(root, 'h4', '확인 불가 상태');
      const stateNames = { access: '접속', session: '세션', device: '기기' };
      const unknownStates = Object.entries(stateNames)
        .filter(([key]) => event.state?.[key] === 'unknown')
        .map(([key, label]) => `${label}: 확인 불가(unknown)`);
      if (unknownStates.length === 0) addText(root, 'p', '없음');
      else {
        const stateList = document.createElement('ul');
        for (const state of unknownStates) addText(stateList, 'li', state);
        root.append(stateList);
      }

      addText(root, 'h4', 'AI 제안');
      if (proposals.length === 0) {
        if (Array.isArray(event.supportedActions) && event.supportedActions.length === 0) {
          addText(root, 'p', '연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상).');
        } else {
          addText(root, 'p', 'AI가 제안한 조치가 없습니다.');
        }
      } else {
        const proposalList = document.createElement('ul');
        for (const proposal of proposals) {
          const item = document.createElement('li');
          addText(item, 'p', `조치: ${proposal.action ?? '확인 불가'}`);
          addText(item, 'p', `이유: ${proposal.reason ?? '이유를 확인할 수 없습니다.'}`);
          if (proposal.evidenceIds.length > 0) {
            addText(item, 'p', `근거 ID: ${proposal.evidenceIds.join(', ')}`);
          }
          addText(item, 'p', '사람 확인이 필요하며 실행되지 않았습니다.');
          proposalList.append(item);
        }
        root.append(proposalList);
      }
      return usagiUnifyStudentView(root);
    },
    renderAction({ status, event, actionId, target, receipt, observation, message, confirmationExpiresAt, error } = {}) {
      const root = document.createElement('div');
      root.className = 'student-action-view';
      const addText = (tag, text, className) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        node.textContent = String(text ?? '');
        root.append(node);
        return node;
      };
      const displayValue = (value) => {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          return String(value);
        }
        return '확인 불가';
      };
      const safeCode = (value) => typeof value === 'string' && /^[A-Z][A-Z0-9_]{2,63}$/.test(value)
        ? value : 'ACTION_RESULT_UNVERIFIED';
      const safeMessage = (value) => {
        if (typeof value !== 'string' || value.length === 0 || value.length > 500) {
          return '안전한 메시지를 확인할 수 없습니다.';
        }
        const secretLike = /(?:Bearer\s+\S+|sk-(?:proj-|ant-|svcacct-)?[A-Za-z0-9_-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_ -]?key|authorization|password|비밀번호|토큰)\s*[:=]\s*\S+)/i.test(value)
          || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
        return secretLike ? '안전한 메시지를 확인할 수 없습니다.' : value;
      };
      const addIdentifier = (label, value) => {
        if (value !== undefined && value !== null && value !== '') {
          addText('p', `${label}: ${displayValue(value)}`);
        }
      };
      const recheckGuidance = '성공이나 효과 없음으로 판단하지 마세요. 제공 화면의 「연동 시스템 결과만 재조회」로 결과를 확인하세요.';
      const statusLabels = {
        idle: '아직 미실행(idle)',
        loading: '조치 준비 또는 결과 조회 중(loading)',
        prepared: '준비됨·미실행(prepared)',
        executing: '서버에 전달 중(executing)',
        pending: '서버 접수·처리 중(pending)',
        succeeded: '효과 확인(succeeded)',
        denied: '거절(denied)',
        failed: '실패(failed)',
        unknown: '결과 불명(unknown)',
        expired: '확인 기한 지남(expired)',
        error: '요청 처리 안 됨(error)',
      };

      const knownStatus = Object.hasOwn(statusLabels, status);
      const effectConfirmed = status === 'succeeded' && observation?.effectApplied === true;
      const renderStatus = effectConfirmed
        ? statusLabels.succeeded
        : status === 'succeeded'
          ? '결과 불명(unknown) · 효과 확인 조건을 충족하지 않았습니다.'
          : knownStatus
            ? statusLabels[status]
            : `결과 불명(${displayValue(status)})`;
      addText('p', `조치 상태: ${renderStatus}`, 'student-action-status');

      if (status === 'idle') {
        addText('p', '조치는 아직 실행되지 않았습니다.');
      } else if (status === 'loading') {
        addText('p', '조치 준비 또는 결과 조회를 진행하고 있습니다.');
      } else if (status === 'prepared') {
        addText('p', '조치가 준비되었지만 아직 실행되지 않았습니다.');
        addIdentifier('확인 기한', confirmationExpiresAt);
      } else if (status === 'executing') {
        addText('p', '요청을 서버에 전달 중입니다. 결과는 아직 확인되지 않았습니다.');
        addText('p', '전달 중이며 완료 또는 성공으로 확인된 상태가 아닙니다.');
      } else if (status === 'pending') {
        addText('p', '서버가 요청을 접수해 처리 중입니다(pending). 접수 응답(ACK)은 조치 효과를 뜻하지 않으며 결과는 아직 확인되지 않았습니다.');
      } else if (status === 'succeeded') {
        if (effectConfirmed) {
          addText('p', '연동 시스템이 조치 효과를 확인했습니다.');
          addIdentifier('관측 시각', observation.observedAt);
          addText('p', 'effectApplied: true');
        } else {
          addText('p', '조치 효과를 확인할 수 없어 결과 불명으로 처리합니다. 성공이나 효과 없음으로 판단하지 않습니다.');
          addText('p', recheckGuidance);
        }
      } else if (status === 'denied') {
        addText('p', `연동 시스템이 조치를 거절했습니다: ${safeMessage(message)}`);
      } else if (status === 'failed') {
        addText('p', `조치 처리가 실패했습니다: ${safeMessage(message)}`);
      } else if (status === 'unknown') {
        addText('p', '조치 결과를 확인할 수 없습니다. 성공이나 효과 없음으로 판단하지 않습니다.');
        addText('p', recheckGuidance);
      } else if (status === 'expired') {
        addText('p', '확인 기한이 지났습니다. 조치를 진행하려면 제공 화면에서 다시 준비해야 합니다.');
      } else if (status === 'error') {
        addText('p', `요청이 처리되지 않았습니다. 오류 코드: ${safeCode(error?.code)} · ${safeMessage(error?.message)}`);
      } else {
        addText('p', '조치 상태를 확인할 수 없습니다. 성공이나 효과 없음으로 판단하지 않습니다.');
        addText('p', recheckGuidance);
      }

      addIdentifier('사건 ID', event?.id);
      if (Array.isArray(event?.evidence)) {
        const ids = event.evidence
          .filter((item) => item && item.id !== undefined && item.id !== null)
          .map((item) => displayValue(item.id));
        if (ids.length > 0) addText('p', `근거 ID: ${ids.join(', ')}`);
      }
      addIdentifier('조치 ID', actionId);
      addIdentifier('대상 ID', target?.id);
      addIdentifier('대상 세대', target?.generation);
      addIdentifier('요청 ID', receipt?.requestId);
      addIdentifier('접수 ID', receipt?.receiptId);
      addIdentifier('버전', receipt?.version);

      // 식별 표식은 입력된 식별자를 연결하며, 효과 확인 여부는 상태 문구로만 나타낸다.
      if (event?.id !== undefined && event.id !== null && event.id !== '') {
        root.setAttribute('data-student-action-event', String(event.id));
      }
      if (receipt?.requestId !== undefined && receipt.requestId !== null && receipt.requestId !== '') {
        root.setAttribute('data-student-action-request', String(receipt.requestId));
      }
      return usagiUnifyStudentView(root);
    },
  };
}
