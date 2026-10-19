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
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
