// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView() {
  return {
    renderIdentity({ me, devices, sessions } = {}) {
      const root = document.createElement('div');
      root.className = 'student-identity-view';

      const appendFields = (parent, fields) => {
        const list = document.createElement('dl');
        for (const [label, value] of fields) {
          const term = document.createElement('dt');
          term.textContent = label;
          const detail = document.createElement('dd');
          detail.textContent = String(value ?? '');
          list.append(term, detail);
        }
        parent.append(list);
      };

      const modeText = (resource) => {
        if (resource?.mode === 'demo') return '예제 자료(demo)';
        if (resource?.mode === 'disconnected') return '연결 없음(disconnected)';
        if (resource?.mode === 'unknown' || !resource?.mode) return '확인 불가(unknown)';
        return null;
      };

      const stateText = (resource, name) => {
        if (resource?.status === 'loading') return `${name}: 불러오는 중`;
        if (resource?.status === 'error') {
          const message = typeof resource.error?.message === 'string' && resource.error.message
            ? resource.error.message
            : '서버가 오류 메시지를 제공하지 않았습니다.';
          const unverified = ['CONTRACT_MISMATCH', 'ENGINE_RESULT_UNVERIFIED'].includes(resource.error?.code);
          return `${name}: ${unverified ? '확인 불가' : '연결 실패'}: ${message}`;
        }
        if (resource?.status === 'ok') return null;
        return `${name}: 확인 불가`;
      };

      const makeSection = (title, resource) => {
        const section = document.createElement('section');
        const heading = document.createElement('h3');
        heading.textContent = title;
        section.append(heading);

        const status = document.createElement('p');
        status.textContent = stateText(resource, title);
        if (status.textContent) section.append(status);

        const mode = modeText(resource);
        if (mode) {
          const note = document.createElement('p');
          note.textContent = mode;
          section.append(note);
        }
        return section;
      };

      const deviceStatusText = (status) => `${({
        compliant: '보안 기준 충족',
        noncompliant: '보안 기준 미충족',
        unknown: '확인 불가',
      })[status] || '확인 불가'}(${status ?? 'unknown'})`;

      const sessionStatusText = (status) => `${({
        active: '활성',
        expired: '만료',
        revoked: '철회됨',
        unknown: '확인 불가',
      })[status] || '확인 불가'}(${status ?? 'unknown'})`;

      const accountSection = makeSection('계정', me);
      if (me?.status === 'ok' && me.data?.user) {
        appendFields(accountSection, [
          ['사용자 이름', me.data.user.label],
          ['사용자 ID', me.data.user.id],
        ]);
      }
      root.append(accountSection);

      const deviceSection = makeSection('기기', devices);
      if (me?.status === 'ok' && me.data?.device) {
        appendFields(deviceSection, [
          ['현재 기기 이름', me.data.device.label],
          ['현재 기기 ID', me.data.device.id],
          ['현재 기기 보안 상태', deviceStatusText(me.data.device.status)],
        ]);
      }
      if (devices?.status === 'ok' && Array.isArray(devices.data)) {
        if (devices.data.length === 0) {
          const empty = document.createElement('p');
          empty.textContent = '표시할 기기 정보가 없습니다.';
          deviceSection.append(empty);
        } else {
          const list = document.createElement('ul');
          for (const device of devices.data) {
            const item = document.createElement('li');
            item.textContent = `${device.label} · ID ${device.id} · ${deviceStatusText(device.status)}`;
            list.append(item);
          }
          deviceSection.append(list);
        }
      }
      root.append(deviceSection);

      const sessionSection = makeSection('세션', sessions);
      if (me?.status === 'ok' && me.data?.session) {
        appendFields(sessionSection, [
          ['현재 세션 ID', me.data.session.id],
          ['현재 세션 상태', sessionStatusText(me.data.session.status)],
        ]);
      }
      if (sessions?.status === 'ok' && Array.isArray(sessions.data)) {
        if (sessions.data.length === 0) {
          const empty = document.createElement('p');
          empty.textContent = '표시할 세션 정보가 없습니다.';
          sessionSection.append(empty);
        } else {
          const list = document.createElement('ul');
          for (const session of sessions.data) {
            const item = document.createElement('li');
            item.textContent = `세션 ID ${session.id} · ${sessionStatusText(session.status)}`;
            list.append(item);
          }
          sessionSection.append(list);
        }
      }
      root.append(sessionSection);

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
        return root;
      }

      if (status === 'loading') {
        if (typeof appId === 'string' && appId) addText('p', `선택한 업무 앱 ID: ${appId}`);
        addText('p', '접속 판정을 확인하는 중입니다.', 'student-decision-status');
        return root;
      }

      if (status === 'error') {
        if (typeof appId === 'string' && appId) addText('p', `선택한 업무 앱 ID: ${appId}`);
        const message = typeof error?.message === 'string' && error.message
          ? error.message
          : '서버가 오류 메시지를 제공하지 않았습니다.';
        addText('p', `접속 판정 요청 실패: ${message}`, 'student-decision-status');
        addText('p', '요청 실패는 거부 판정이 아니며, 접근이 허용됐다는 뜻도 아닙니다.');
        return root;
      }

      if (status !== 'ok' || !data || typeof data !== 'object') {
        addText('p', '접속 판정을 확인할 수 없습니다. 허용으로 간주하지 마세요.', 'student-decision-status');
        return root;
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
      return root;
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
        return root;
      }

      if (status === 'error') {
        const message = typeof error?.message === 'string' && error.message
          ? error.message
          : '서버가 오류 메시지를 제공하지 않았습니다.';
        const unverified = ['CONTRACT_MISMATCH', 'ENGINE_RESULT_UNVERIFIED'].includes(error?.code);
        addText(root, 'p', unverified
          ? `확인 불가: ${message} 이전 기록은 현재 결과로 표시하지 않습니다.`
          : `기록을 불러오지 못했습니다: ${message}`, 'student-events-status');
        return root;
      }

      if (status !== 'ok' || !Array.isArray(data)) {
        addText(root, 'p', '확인 불가: 기록 상태 또는 응답 형식을 확인할 수 없습니다. 이전 기록은 표시하지 않습니다.', 'student-events-status');
        return root;
      }

      // 정렬은 새 배열에서만 수행해 제공받은 data 배열을 바꾸지 않는다.
      const events = [...data].sort((left, right) => Date.parse(right.at) - Date.parse(left.at));
      if (events.length === 0) {
        addText(root, 'p', '표시할 기록이 없습니다.', 'student-events-status');
        return root;
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
      };

      const clearDetailAndRender = () => {
        detailMount.replaceChildren();
        renderRows();
      };
      kindFilter.addEventListener('change', clearDetailAndRender);
      appFilter.addEventListener('change', clearDetailAndRender);
      accessFilter.addEventListener('change', clearDetailAndRender);
      renderRows();
      return root;
    },
    renderStatus({ devices, sessions, notifications, diagnostics, mode } = {}) {
      const root = document.createElement('div');
      root.className = 'student-status-view';
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
      add(diagnosticSection, 'p', '도움 요청에 사용할 진단 정보의 지정된 여섯 필드만 복사합니다.');
      const copy = add(diagnosticSection, 'button', '도움정보 복사');
      copy.type = 'button';
      copy.disabled = !helpText;
      const feedback = add(diagnosticSection, 'p', '');
      feedback.setAttribute('role', 'status');
      copy.addEventListener('click', async () => {
        if (!helpText) return;
        try {
          await navigator.clipboard.writeText(helpText);
          feedback.textContent = '도움정보를 클립보드에 복사했습니다.';
        } catch {
          feedback.textContent = '도움정보를 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인한 뒤 도움정보 복사 버튼을 직접 누르세요.';
        }
      });
      root.append(diagnosticSection);
      return root;
    },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
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
        return root;
      }
      if (status === 'loading') {
        addText('p', 'AI 연결 점검 중입니다.', 'student-ai-connection-status');
        return root;
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
        return root;
      }

      if (status !== 'ok' || !data || typeof data !== 'object'
        || data.transportChecked !== true
        || !['test', 'verified'].includes(data.audienceAuthorization)
        || !Number.isInteger(data.modelCount) || data.modelCount < 0
        || error?.code || error?.message) {
        addText('p', 'AI 연결 점검 결과를 확인할 수 없습니다(unknown). 연결 성공으로 간주하지 않습니다.', 'student-ai-connection-status');
        return root;
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
      return root;
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
        return root;
      }

      if (!event || typeof event !== 'object' || typeof event.id !== 'string' || event.id.length === 0) {
        addText(root, 'p', '보안 기록에서 기록을 먼저 고르세요.', 'student-ai-explanation-status');
        return root;
      }
      if (explanation?.status === 'idle') {
        addText(root, 'p', 'AI 사건 설명 요청 전입니다.', 'student-ai-explanation-status');
        return root;
      }
      if (explanation?.status === 'loading') {
        addText(root, 'p', 'AI 사건 설명을 요청하는 중입니다.', 'student-ai-explanation-status');
        return root;
      }
      if (explanation?.status !== 'ok' || !explanation.data || typeof explanation.data !== 'object'
        || typeof explanation.data.summary !== 'string'
        || explanation.error?.code || explanation.error?.message) {
        showFailure('AI 설명 결과를 확인할 수 없습니다.');
        return root;
      }

      const data = explanation.data;
      if (data.executed === true) {
        showFailure('AI가 실행됐다고 응답한 설명은 사용할 수 없습니다.');
        return root;
      }
      if (data.executed !== false || data.requiresHumanConfirmation !== true) {
        showFailure('AI 설명을 사용할 수 없습니다. 실행되지 않았음과 사람 확인 필요 조건을 확인할 수 없습니다.');
        return root;
      }

      const evidence = Array.isArray(event.evidence) ? event.evidence : [];
      const evidenceIds = Array.isArray(data.evidenceIds) ? data.evidenceIds : null;
      const proposals = Array.isArray(data.proposals) ? data.proposals : null;
      if (!evidenceIds || !proposals) {
        showFailure('근거를 대조할 수 없어 AI 설명을 사용할 수 없습니다. 근거 자료 형식이 맞지 않습니다.');
        return root;
      }

      // 각 인용 목록은 개별적으로 검사한다. 같은 근거를 요약과 제안이 함께 참조하는 것은 허용한다.
      const citationLists = [evidenceIds];
      for (const proposal of proposals) {
        if (!proposal || typeof proposal !== 'object' || !Array.isArray(proposal.evidenceIds)) {
          showFailure('근거를 대조할 수 없어 AI 설명을 사용할 수 없습니다. 제안의 근거 형식이 맞지 않습니다.');
          return root;
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
        return root;
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
      return root;
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
      return root;
    },
  };
}
