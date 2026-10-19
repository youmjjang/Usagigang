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
    renderDecision() { return '학생 구현 대기: 서버의 판정과 이유를 연결하세요.'; },
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
