/**
 * 화학식 학습기 메인 앱 로직
 * - 구글 스프레드시트 실시간 동기화
 * - 세트 클릭 시 상세 표(테이블) 아코디언 토글
 * - 양방향 학습: 이름 ➔ 기호/식, 기호/식 ➔ 이름, 랜덤 혼합
 * - 원소 번호 외우기 모드: 원소 번호 ⇋ 이름/기호
 */

class ChemApp {
  constructor() {
    this.units = [];
    this.selectedUnits = new Set();
    this.currentCategoryTab = 'all'; // 'all' | '원소기호' | '화학식' | '이온식'
    this.expandedUnits = new Set(); // 상세 표가 열려있는 유닛 Set

    // 학습 설정
    // 'name_to_formula' | 'formula_to_name' | 'mixed' | 'atomic_to_element' | 'element_to_atomic'
    this.studyDirection = 'name_to_formula'; 

    // 상태 관리
    this.currentMode = 'home'; // 'home' | 'flashcard' | 'quiz' | 'result'
    this.activeList = [];
    this.currentIndex = 0;
    this.isCardFlipped = false;
    this.shuffleEnabled = true;

    // 시험 상태
    this.quizAnswers = [];
    this.keyboard = null;

    // 숙련도 저장소
    this.STORAGE_KEY = 'chem_study_mastery_v2';
    this.masteryMap = this.loadMastery();

    this.init();
  }

  loadMastery() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  saveMastery() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.masteryMap));
    } catch (e) {
      console.error(e);
    }
  }

  async init() {
    // 기존 캐시가 브라우저에 남아있다면 완전 삭제
    try {
      localStorage.removeItem('chem_google_sheet_data_v2');
      localStorage.removeItem('chem_google_sheet_last_sync');
    } catch (e) {}

    this.bindDomElements();
    this.initKeyboard();
    this.bindGlobalEvents();

    // 오직 구글 스프레드시트에서만 실시간 로드
    this.renderLoadingState();
    await this.syncGoogleSheets(false);
  }

  renderLoadingState() {
    if (this.dom.unitListContainer) {
      this.dom.unitListContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; background: white; border-radius: 14px; border: 1px dashed #cbd5e1;">
          <div style="font-size: 1.5rem; margin-bottom: 10px;">⏳</div>
          <p style="font-weight: 700; color: #1e293b;">구글 스프레드시트에서 최신 데이터를 불러오는 중입니다...</p>
          <p style="font-size: 0.82rem; color: #64748b; margin-top: 4px;">잠시만 기다려주세요.</p>
        </div>
      `;
    }
  }

  refreshDataFromGlobal() {
    this.units = getUnits();
    if (this.selectedUnits.size === 0 && this.units.length > 0) {
      this.selectedUnits = new Set(this.units.map(u => u.name));
    }
    this.renderHeaderDropdown();
    this.renderCategoryChips();
    this.renderUnitList();
  }

  async syncGoogleSheets(manual = false) {
    const syncStatusEl = document.getElementById('sheet-sync-status');
    const syncBtn = document.getElementById('btn-sync-sheet');
    if (syncStatusEl) {
      syncStatusEl.textContent = '스프레드시트 불러오는 중...';
      syncStatusEl.className = 'sync-status syncing';
    }
    if (syncBtn) syncBtn.classList.add('spinning');

    const result = await GoogleSheetSync.syncData();

    if (syncBtn) syncBtn.classList.remove('spinning');
    if (syncStatusEl) {
      if (result.success) {
        syncStatusEl.textContent = `🟢 스프레드시트 연결됨 (${CHEMISTRY_DATA.length}개 항목)`;
        syncStatusEl.className = 'sync-status synced';
        if (manual) {
          alert(`구글 스프레드시트에서 최신 데이터를 성공적으로 불러왔습니다!\n총 ${CHEMISTRY_DATA.length}개의 항목이 로드되었습니다.`);
        }
      } else {
        syncStatusEl.textContent = '❌ 불러오기 실패';
        syncStatusEl.className = 'sync-status fallback';
        if (this.dom.unitListContainer) {
          this.dom.unitListContainer.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; background: #fef2f2; border-radius: 14px; border: 1px solid #fecaca;">
              <div style="font-size: 1.5rem; margin-bottom: 10px;">⚠️</div>
              <p style="font-weight: 700; color: #b91c1c;">스프레드시트 데이터를 불러오지 못했습니다.</p>
              <p style="font-size: 0.82rem; color: #7f1d1d; margin-top: 4px;">인터넷 연결 상태 또는 스프레드시트 공유 권한(뷰어)을 확인해주세요.</p>
              <button type="button" onclick="window.app.syncGoogleSheets(true)" style="margin-top: 14px; padding: 8px 16px; background: #ef4444; color: white; border-radius: 8px; font-weight: 700;">다시 시도하기</button>
            </div>
          `;
        }
        return;
      }
    }

    this.refreshDataFromGlobal();
  }

  bindDomElements() {
    this.dom = {
      navTabs: document.querySelectorAll('.nav-tab'),
      setHeaderSelect: document.getElementById('set-header-select'),
      categoryChipsContainer: document.getElementById('unit-chips-container'),
      btnSelectAllUnits: document.getElementById('btn-select-all-units'),
      btnStartFlashcards: document.getElementById('btn-start-flashcards'),
      btnStartQuiz: document.getElementById('btn-start-quiz'),
      unitListContainer: document.getElementById('unit-list-container'),
      studyDirectionSelect: document.getElementById('study-direction-select'),
      btnSyncSheet: document.getElementById('btn-sync-sheet'),
      sheetSyncStatus: document.getElementById('sheet-sync-status'),
      fcDirectionSelect: document.getElementById('fc-direction-select'),
      quizDirectionSelect: document.getElementById('quiz-direction-select'),
      
      // 뷰 컨테이너
      viewHome: document.getElementById('view-home'),
      viewFlashcard: document.getElementById('view-flashcard'),
      viewQuiz: document.getElementById('view-quiz'),
      viewResult: document.getElementById('view-result'),

      // 플래시카드 요소
      fcProgressText: document.getElementById('fc-progress-text'),
      fcProgressBar: document.getElementById('fc-progress-bar'),
      fcCard: document.getElementById('fc-card'),
      fcFrontCategory: document.getElementById('fc-front-category'),
      fcFrontName: document.getElementById('fc-front-name'),
      fcFrontHint: document.getElementById('fc-front-hint'),
      fcBackFormula: document.getElementById('fc-back-formula'),
      fcBackName: document.getElementById('fc-back-name'),
      fcBackDesc: document.getElementById('fc-back-desc'),
      fcBtnPrev: document.getElementById('fc-btn-prev'),
      fcBtnFlip: document.getElementById('fc-btn-flip'),
      fcBtnNext: document.getElementById('fc-btn-next'),
      fcBtnTts: document.getElementById('fc-btn-tts'),
      fcBtnRemember: document.getElementById('fc-btn-remember'),
      fcBtnNeedReview: document.getElementById('fc-btn-need-review'),
      fcBtnBackToHome: document.getElementById('fc-btn-back-home'),

      // 시험 요소
      quizProgressText: document.getElementById('quiz-progress-text'),
      quizProgressBar: document.getElementById('quiz-progress-bar'),
      quizQuestionCategory: document.getElementById('quiz-question-category'),
      quizQuestionName: document.getElementById('quiz-question-name'),
      quizQuestionHint: document.getElementById('quiz-question-hint'),
      quizInput: document.getElementById('quiz-answer-input'),
      quizBtnBackHome: document.getElementById('quiz-btn-back-home'),
      quizFeedbackToast: document.getElementById('quiz-feedback-toast'),

      // 결과 화면 요소
      resultScoreNumber: document.getElementById('result-score-number'),
      resultScorePercent: document.getElementById('result-score-percent'),
      resultTotalCount: document.getElementById('result-total-count'),
      resultCorrectCount: document.getElementById('result-correct-count'),
      resultWrongCount: document.getElementById('result-wrong-count'),
      resultDetailsList: document.getElementById('result-details-list'),
      resultBtnRetryWrong: document.getElementById('result-btn-retry-wrong'),
      resultBtnRetryAll: document.getElementById('result-btn-retry-all'),
      resultBtnHome: document.getElementById('result-btn-home')
    };
  }

  initKeyboard() {
    this.keyboard = new ChemistryKeyboard({
      container: document.getElementById('virtual-keyboard-container'),
      onSubmit: (val) => {
        this.submitQuizAnswer(val);
      },
      onInput: (val) => {}
    });
  }

  bindGlobalEvents() {
    // 스프레드시트 수동 동기화 버튼
    if (this.dom.btnSyncSheet) {
      this.dom.btnSyncSheet.addEventListener('click', () => {
        this.syncGoogleSheets(true);
      });
    }

    // 학습 방향 설정 변경 (메인 대시보드)
    if (this.dom.studyDirectionSelect) {
      this.dom.studyDirectionSelect.addEventListener('change', (e) => {
        this.setStudyDirection(e.target.value);
      });
    }

    // 플래시카드 학습 중 실시간 방향 변경
    if (this.dom.fcDirectionSelect) {
      this.dom.fcDirectionSelect.addEventListener('change', (e) => {
        this.setStudyDirection(e.target.value);
        this.updateActiveSessionDirection('flashcard');
      });
    }

    // 시험 중 실시간 방향 변경
    if (this.dom.quizDirectionSelect) {
      this.dom.quizDirectionSelect.addEventListener('change', (e) => {
        this.setStudyDirection(e.target.value);
        this.updateActiveSessionDirection('quiz');
      });
    }

    // 상단 탭 클릭
    this.dom.navTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.dom.navTabs.forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const cat = e.currentTarget.getAttribute('data-tab');
        this.switchCategoryTab(cat);
      });
    });

    // 헤더 드롭다운 선택
    this.dom.setHeaderSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'all') {
        this.selectedUnits = new Set(this.units.map(u => u.name));
      } else {
        this.selectedUnits = new Set([val]);
      }
      this.renderCategoryChips();
      this.renderUnitList();
    });

    // 모두 선택 버튼
    this.dom.btnSelectAllUnits.addEventListener('click', () => {
      const filteredUnits = this.getFilteredUnits();
      const allSelected = filteredUnits.every(u => this.selectedUnits.has(u.name));
      if (allSelected) {
        filteredUnits.forEach(u => this.selectedUnits.delete(u.name));
      } else {
        filteredUnits.forEach(u => this.selectedUnits.add(u.name));
      }
      this.renderCategoryChips();
      this.renderUnitList();
    });

    // 대시보드 액션 버튼
    this.dom.btnStartFlashcards.addEventListener('click', () => {
      this.startFlashcards();
    });

    this.dom.btnStartQuiz.addEventListener('click', () => {
      this.startQuiz();
    });

    // 플래시카드 이벤트
    this.dom.fcCard.addEventListener('click', () => this.toggleCardFlip());
    this.dom.fcBtnFlip.addEventListener('click', () => this.toggleCardFlip());
    this.dom.fcBtnPrev.addEventListener('click', () => this.prevCard());
    this.dom.fcBtnNext.addEventListener('click', () => this.nextCard());
    this.dom.fcBtnBackToHome.addEventListener('click', () => this.showView('home'));
    
    this.dom.fcBtnRemember.addEventListener('click', () => {
      const current = this.activeList[this.currentIndex];
      const item = current.rawItem || current;
      this.masteryMap[item.id] = (this.masteryMap[item.id] || 0) + 1;
      this.saveMastery();
      this.nextCard();
    });

    this.dom.fcBtnNeedReview.addEventListener('click', () => {
      const current = this.activeList[this.currentIndex];
      const item = current.rawItem || current;
      this.masteryMap[item.id] = Math.max(0, (this.masteryMap[item.id] || 0) - 1);
      this.saveMastery();
      this.nextCard();
    });

    this.dom.fcBtnTts.addEventListener('click', (e) => {
      e.stopPropagation();
      this.speakCurrentCard();
    });

    // 키보드 단축키
    window.addEventListener('keydown', (e) => {
      if (this.currentMode === 'flashcard') {
        if (e.code === 'Space') {
          e.preventDefault();
          this.toggleCardFlip();
        } else if (e.code === 'ArrowLeft') {
          this.prevCard();
        } else if (e.code === 'ArrowRight') {
          this.nextCard();
        }
      } else if (this.currentMode === 'quiz') {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.submitQuizAnswer(this.dom.quizInput.value.trim());
        }
      }
    });

    // 시험 이벤트 (확인창 없이 즉시 메인 화면으로 이동)
    this.dom.quizBtnBackHome.addEventListener('click', () => {
      this.showView('home');
    });

    // 결과 화면 이벤트
    this.dom.resultBtnHome.addEventListener('click', () => {
      this.showView('home');
      this.renderUnitList();
    });

    this.dom.resultBtnRetryAll.addEventListener('click', () => {
      this.startQuizWithItems(this.activeList);
    });

    this.dom.resultBtnRetryWrong.addEventListener('click', () => {
      const wrongItems = this.quizAnswers.filter(a => !a.isCorrect).map(a => a.problem);
      if (wrongItems.length === 0) {
        alert('틀린 문제가 없습니다! 전체 문제를 다시 풀어보세요.');
        return;
      }
      this.startQuizWithItems(wrongItems);
    });
  }

  switchCategoryTab(tab) {
    this.currentCategoryTab = tab;
    const filtered = this.getFilteredUnits();
    this.selectedUnits = new Set(filtered.map(u => u.name));
    this.renderCategoryChips();
    this.renderUnitList();
  }

  getFilteredUnits() {
    if (this.currentCategoryTab === 'all') {
      return this.units;
    }
    return this.units.filter(u => u.category === this.currentCategoryTab);
  }

  renderHeaderDropdown() {
    let html = `<option value="all">전체 세트 (${CHEMISTRY_DATA.length}항목)</option>`;
    this.units.forEach(u => {
      html += `<option value="${u.name}">${u.name} (${u.count}항목)</option>`;
    });
    this.dom.setHeaderSelect.innerHTML = html;
  }

  renderCategoryChips() {
    const filteredUnits = this.getFilteredUnits();
    this.dom.categoryChipsContainer.innerHTML = filteredUnits.map(unit => {
      const isSelected = this.selectedUnits.has(unit.name);
      return `
        <button type="button" class="unit-chip ${isSelected ? 'active' : ''}" data-unit="${unit.name}">
          ${unit.name}
          <span class="chip-count">${unit.count}</span>
        </button>
      `;
    }).join('');

    this.dom.categoryChipsContainer.querySelectorAll('.unit-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const uName = chip.getAttribute('data-unit');
        if (this.selectedUnits.has(uName)) {
          if (this.selectedUnits.size > 1) {
            this.selectedUnits.delete(uName);
          } else {
            alert('최소 1개 이상의 과를 선택해야 합니다.');
            return;
          }
        } else {
          this.selectedUnits.add(uName);
        }
        this.renderCategoryChips();
        this.renderUnitList();
      });
    });
  }

  /**
   * 세트 리스트 렌더링 & 아코디언 표(Table) 토글
   */
  renderUnitList() {
    const filteredUnits = this.getFilteredUnits();
    this.dom.unitListContainer.innerHTML = filteredUnits.map(unit => {
      const masteredCount = unit.items.filter(it => (this.masteryMap[it.id] || 0) >= 2).length;
      const progressPercent = Math.round((masteredCount / unit.count) * 100);
      const isSelected = this.selectedUnits.has(unit.name);
      const isExpanded = this.expandedUnits.has(unit.name);

      return `
        <div class="unit-accordion-wrapper ${isExpanded ? 'expanded' : ''}" data-unit="${unit.name}">
          <div class="unit-menu-card ${isSelected ? 'selected' : ''}">
            <div class="unit-card-left">
              <div class="unit-card-badge ${this.getCategoryClass(unit.category)}">${unit.category}</div>
              <div class="unit-card-info">
                <h4 class="unit-card-title">${unit.name}</h4>
                <p class="unit-card-sub">총 ${unit.count}개 문항 · 마스터율 ${progressPercent}% (${masteredCount}/${unit.count}) · <strong>클릭하여 목록 보기</strong></p>
              </div>
            </div>
            <div class="unit-card-actions">
              <button type="button" class="btn-quick-study" data-action="study" data-unit="${unit.name}" title="플래시카드 학습">
                📖 학습
              </button>
              <button type="button" class="btn-quick-quiz" data-action="quiz" data-unit="${unit.name}" title="시험 시작">
                🏆 시험
              </button>
              <div class="chevron-box" title="세트 상세 표 펼치기/접기">
                <svg class="chevron-icon ${isExpanded ? 'rotated' : ''}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </div>
          </div>

          <!-- 세트 클릭 시 펼쳐지는 상세 표 (Table) -->
          <div class="unit-table-container ${isExpanded ? 'open' : ''}">
            <div class="unit-table-header-tip">
              <span>📋 <strong>${unit.name}</strong> 전체 목록 (${unit.count}개)</span>
              <button type="button" class="btn-toggle-select-unit" data-unit="${unit.name}">
                ${isSelected ? '✓ 선택됨' : '+ 학습에 포함하기'}
              </button>
            </div>
            <div class="unit-table-responsive">
              <table class="chem-data-table">
                <thead>
                  <tr>
                    <th style="width: 45px;">순번</th>
                    <th>이름</th>
                    <th>기호 / 화학식</th>
                    <th>원소 번호</th>
                    <th>구분</th>
                    <th style="width: 50px;">듣기</th>
                  </tr>
                </thead>
                <tbody>
                  ${unit.items.map((item, idx) => `
                    <tr>
                      <td class="text-center">${idx + 1}</td>
                      <td><strong>${item.name}</strong></td>
                      <td><span class="formula-chip">${item.formula}</span></td>
                      <td class="text-center">${item.atomicNumber !== null ? `<span class="badge-atomic">${item.atomicNumber}번</span>` : '-'}</td>
                      <td><span class="table-cat-badge ${this.getCategoryClass(item.category)}">${item.category}</span></td>
                      <td class="text-center">
                        <button type="button" class="btn-row-tts" data-name="${item.name}" data-formula="${item.formula}" title="발음 듣기">🔊</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // 아코디언 토글 이벤트
    this.dom.unitListContainer.querySelectorAll('.unit-menu-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // 내부 버튼 클릭 제외
        if (e.target.closest('button')) return;

        const wrapper = card.closest('.unit-accordion-wrapper');
        const uName = wrapper.getAttribute('data-unit');
        if (this.expandedUnits.has(uName)) {
          this.expandedUnits.delete(uName);
        } else {
          this.expandedUnits.add(uName);
        }
        this.renderUnitList();
      });
    });

    // 개별 빠른 학습/시험 버튼
    this.dom.unitListContainer.querySelectorAll('.btn-quick-study').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uName = btn.getAttribute('data-unit');
        const targetUnit = this.units.find(u => u.name === uName);
        if (targetUnit) this.startFlashcardsWithItems(targetUnit.items);
      });
    });

    this.dom.unitListContainer.querySelectorAll('.btn-quick-quiz').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uName = btn.getAttribute('data-unit');
        const targetUnit = this.units.find(u => u.name === uName);
        if (targetUnit) this.startQuizWithItems(targetUnit.items);
      });
    });

    // 테이블 내 듣기 버튼
    this.dom.unitListContainer.querySelectorAll('.btn-row-tts').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = btn.getAttribute('data-name');
        const formula = btn.getAttribute('data-formula');
        this.speakText(`${name}, ${formula}`);
      });
    });

    // 표 상단 선택 포함 토글 버튼
    this.dom.unitListContainer.querySelectorAll('.btn-toggle-select-unit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uName = btn.getAttribute('data-unit');
        if (this.selectedUnits.has(uName)) {
          if (this.selectedUnits.size > 1) {
            this.selectedUnits.delete(uName);
          } else {
            alert('최소 1개 이상의 과를 선택해야 합니다.');
          }
        } else {
          this.selectedUnits.add(uName);
        }
        this.renderCategoryChips();
        this.renderUnitList();
      });
    });
  }

  getCategoryClass(category) {
    if (category.includes('원소')) return 'element';
    if (category.includes('이온')) return 'ion';
    return 'molecule';
  }

  showView(viewName) {
    this.currentMode = viewName;
    this.dom.viewHome.classList.remove('active');
    this.dom.viewFlashcard.classList.remove('active');
    this.dom.viewQuiz.classList.remove('active');
    this.dom.viewResult.classList.remove('active');

    if (viewName === 'home') this.dom.viewHome.classList.add('active');
    if (viewName === 'flashcard') this.dom.viewFlashcard.classList.add('active');
    if (viewName === 'quiz') this.dom.viewQuiz.classList.add('active');
    if (viewName === 'result') this.dom.viewResult.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * 양방향 및 원소 번호 모드에 맞게 학습 문제 카드 객체 생성
   */
  generateProblem(item, direction) {
    let mode = direction;
    const atomicNum = item.atomicNumber || (window.KNOWN_ATOMIC_NUMBERS && (window.KNOWN_ATOMIC_NUMBERS[item.formula] || window.KNOWN_ATOMIC_NUMBERS[item.name])) || null;

    if (mode === 'mixed') {
      const options = ['name_to_formula', 'formula_to_name'];
      if (atomicNum) {
        options.push('element_to_atomic');
      }
      mode = options[Math.floor(Math.random() * options.length)];
    }

    if (mode === 'formula_to_name') {
      return {
        mode: 'formula_to_name',
        question: item.formula,
        answer: item.name,
        questionSub: `${item.category} (${item.unit})`,
        answerSub: atomicNum ? `원자 번호: ${atomicNum}번` : '',
        hint: `한글 명칭을 입력하세요. (${item.unit})`,
        rawItem: item
      };
    } else if (mode === 'element_to_atomic' && atomicNum) {
      return {
        mode: 'element_to_atomic',
        question: `${item.name} (${item.formula})`,
        answer: String(atomicNum),
        questionSub: `원소 번호 맞히기`,
        answerSub: `원자 번호: ${atomicNum}번`,
        hint: `${item.name}의 원자 번호(숫자)를 입력하세요`,
        rawItem: item
      };
    } else if (mode === 'atomic_to_element' && atomicNum) {
      return {
        mode: 'atomic_to_element',
        question: String(atomicNum),
        answer: item.formula,
        questionSub: `원소기호 맞히기`,
        answerSub: '',
        hint: `${atomicNum}번 원소의 기호를 입력하세요`,
        rawItem: item
      };
    } else {
      // 기본: name_to_formula (이름 ➔ 기호/식)
      return {
        mode: 'name_to_formula',
        question: item.name,
        answer: item.formula,
        questionSub: atomicNum ? `원소기호 (원자번호 ${atomicNum}번)` : `${item.category} (${item.unit})`,
        answerSub: item.description || (atomicNum ? `원자 번호 ${atomicNum}번` : ''),
        hint: `화학식 또는 원소기호를 입력하세요`,
        rawItem: item
      };
    }
  }

  setStudyDirection(direction) {
    this.studyDirection = direction;
    // 모든 셀렉트 박스 동기화
    if (this.dom.studyDirectionSelect) this.dom.studyDirectionSelect.value = direction;
    if (this.dom.fcDirectionSelect) this.dom.fcDirectionSelect.value = direction;
    if (this.dom.quizDirectionSelect) this.dom.quizDirectionSelect.value = direction;
  }

  updateActiveSessionDirection(sessionType) {
    if (!this.activeList || this.activeList.length === 0) return;

    // 현재 세션의 원본 아이템 리스트 추출
    const rawItems = this.activeList.map(item => item.rawItem || item);

    // 새 방향으로 문제들 재생성
    this.activeList = rawItems.map(item => this.generateProblem(item, this.studyDirection));

    if (sessionType === 'flashcard') {
      this.isCardFlipped = false;
      this.renderCurrentCard();
      this.showToast(`학습 방향이 [${this.getDirectionLabel(this.studyDirection)}]으로 변경되었습니다.`, 'info');
    } else if (sessionType === 'quiz') {
      this.renderCurrentQuiz();
      this.showToast(`시험 방향이 [${this.getDirectionLabel(this.studyDirection)}]으로 변경되었습니다.`, 'info');
    }
  }

  // ================= 플래시카드 로직 =================
  startFlashcards() {
    const rawItems = this.getSelectedItems();
    if (rawItems.length === 0) {
      alert('선택된 항목이 없습니다. 단원을 선택해주세요.');
      return;
    }
    this.startFlashcardsWithItems(rawItems);
  }

  startFlashcardsWithItems(items) {
    // 셀렉트 박스 동기화
    if (this.dom.fcDirectionSelect) this.dom.fcDirectionSelect.value = this.studyDirection;

    this.activeList = items.map(item => this.generateProblem(item, this.studyDirection));
    if (this.shuffleEnabled) {
      this.shuffleArray(this.activeList);
    }
    this.currentIndex = 0;
    this.isCardFlipped = false;
    this.renderCurrentCard();
    this.showView('flashcard');
  }

  renderCurrentCard() {
    if (this.activeList.length === 0) return;
    const problem = this.activeList[this.currentIndex];

    // 뒷면 노출 잔상 완벽 차단: 즉시 앞면으로 리셋
    this.isCardFlipped = false;
    this.dom.fcCard.classList.add('no-transition');
    this.dom.fcCard.classList.remove('flipped');
    void this.dom.fcCard.offsetHeight; // 강제 리플로우

    const total = this.activeList.length;
    const cur = this.currentIndex + 1;
    this.dom.fcProgressText.textContent = `${cur} / ${total}`;
    this.dom.fcProgressBar.style.width = `${(cur / total) * 100}%`;

    // 앞면 내용 바인딩
    this.dom.fcFrontCategory.textContent = problem.questionSub;
    this.dom.fcFrontName.textContent = problem.question;
    if (this.dom.fcFrontHint) {
      this.dom.fcFrontHint.textContent = '';
      this.dom.fcFrontHint.style.display = 'none';
    }

    // 뒷면 내용 바인딩 (이전 잔상 방지)
    this.dom.fcBackFormula.textContent = problem.answer;
    if (this.dom.fcBackName) this.dom.fcBackName.textContent = '';
    if (this.dom.fcBackDesc) {
      if (problem.mode === 'element_to_atomic' && problem.rawItem.atomicNumber) {
        this.dom.fcBackDesc.textContent = `원자 번호 ${problem.rawItem.atomicNumber}번`;
        this.dom.fcBackDesc.style.display = 'block';
      } else {
        this.dom.fcBackDesc.textContent = '';
        this.dom.fcBackDesc.style.display = 'none';
      }
    }

    this.dom.fcBtnPrev.disabled = (this.currentIndex === 0);

    // 다음 프레임에서 애니메이션 복원 (0.25초 부드러운 회전 가능)
    requestAnimationFrame(() => {
      this.dom.fcCard.classList.remove('no-transition');
    });
  }

  getDirectionLabel(mode) {
    switch (mode) {
      case 'name_to_formula': return '기호/화학식을 맞히기';
      case 'formula_to_name': return '이름을 맞히기';
      case 'mixed': return '방향 랜덤';
      case 'element_to_atomic': return '원소 번호 맞히기';
      case 'atomic_to_element': return '원소 번호로 원소 맞히기';
      default: return '기호/화학식을 맞히기';
    }
  }

  toggleCardFlip() {
    this.isCardFlipped = !this.isCardFlipped;
    if (this.isCardFlipped) {
      this.dom.fcCard.classList.add('flipped');
    } else {
      this.dom.fcCard.classList.remove('flipped');
    }
  }

  switchCardTo(newIndex) {
    if (newIndex < 0 || newIndex >= this.activeList.length) return;

    // 카드가 뒤집혀 있는 상태라면 잔상 원천 차단을 위해 먼저 뒷면 내용을 지우고 즉시 리셋
    if (this.isCardFlipped) {
      this.isCardFlipped = false;
      this.dom.fcCard.classList.add('no-transition');
      this.dom.fcCard.classList.remove('flipped');
      if (this.dom.fcBackFormula) this.dom.fcBackFormula.textContent = '';
      void this.dom.fcCard.offsetHeight;
    }

    this.currentIndex = newIndex;
    this.renderCurrentCard();
  }

  nextCard() {
    if (this.currentIndex < this.activeList.length - 1) {
      this.switchCardTo(this.currentIndex + 1);
    } else {
      if (confirm('플래시카드 학습을 완료했습니다! 다시 처음부터 학습하시겠습니까?')) {
        this.switchCardTo(0);
      } else {
        this.showView('home');
      }
    }
  }

  prevCard() {
    if (this.currentIndex > 0) {
      this.switchCardTo(this.currentIndex - 1);
    }
  }

  speakCurrentCard() {
    const problem = this.activeList[this.currentIndex];
    if (!problem) return;
    this.speakText(`${problem.rawItem.name}, ${problem.rawItem.formula}`);
  }

  speakText(text) {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  // ================= 시험 로직 =================
  startQuiz() {
    const rawItems = this.getSelectedItems();
    if (rawItems.length === 0) {
      alert('선택된 항목이 없습니다. 단원을 선택해주세요.');
      return;
    }
    this.startQuizWithItems(rawItems);
  }

  startQuizWithItems(items) {
    if (this.dom.quizDirectionSelect) this.dom.quizDirectionSelect.value = this.studyDirection;

    // items가 rawItem 목록이거나 이미 problem 목록일 수 있음
    this.activeList = items.map(item => {
      if (item.rawItem) return item;
      return this.generateProblem(item, this.studyDirection);
    });

    this.shuffleArray(this.activeList);
    this.currentIndex = 0;
    this.quizAnswers = [];
    this.showView('quiz');

    this.keyboard.setTarget(this.dom.quizInput);
    this.renderCurrentQuiz();
  }

  renderCurrentQuiz() {
    if (this.activeList.length === 0) return;
    const problem = this.activeList[this.currentIndex];
    const total = this.activeList.length;
    const cur = this.currentIndex + 1;

    this.dom.quizProgressText.textContent = `${cur} / ${total}`;
    this.dom.quizProgressBar.style.width = `${(cur / total) * 100}%`;

    this.dom.quizQuestionCategory.textContent = problem.questionSub;
    this.dom.quizQuestionName.textContent = problem.question;
    this.dom.quizQuestionHint.textContent = `${this.getDirectionLabel(problem.mode)}: ${problem.hint}`;

    this.dom.quizInput.value = '';
    this.dom.quizInput.setAttribute('inputmode', 'none');

    // -----------------------------------------------------------------
    // 각 학습/문제 유형에 맞춘 전용 가상 키보드 레이아웃 스마트 적용
    // 1) 원소 번호 맞히기 (답: 숫자): 쿼티 숨기고 오직 숫자 키패드만 표시!
    // 2) 원소기호 맞히기 (답: 원소기호): 숫자 키보드 완전히 빼고 영문 쿼티만 표시!
    // 3) 이름 맞히기 (답: 한글 명칭): 상단 툴바 모두 빼고 오직 한글 쿼티만 표시!
    // 4) 분자식 맞히기: 숫자/이온 빼고 분자식 첨자(₁~₀)와 영문 쿼티만 표시!
    // 5) 이온식 맞히기: 숫자 빼고 이온 전하(⁺, ⁻)와 분자식 첨자, 영문 쿼티만 표시!
    // -----------------------------------------------------------------
    const raw = problem.rawItem || {};
    const cat = raw.category || '';

    if (problem.mode === 'element_to_atomic') {
      // 1) 원소 번호 맞히기: 오직 숫자 키패드만 남김
      this.keyboard.setDisplayMode('numpad');
    } else if (problem.mode === 'formula_to_name') {
      // 3) 이름 맞히기: 오직 한글 쿼티만 남김 (상단 툴바 모두 숨김)
      this.keyboard.setDisplayMode('qwerty');
      this.keyboard.setKeyboardMode('ko');
      this.keyboard.setToolbarConfig({ showNum: false, showIon: false, showSub: false });
    } else {
      // 기호/화학식 맞히기 모드 (기본 영문)
      this.keyboard.setDisplayMode('qwerty');
      this.keyboard.setKeyboardMode('en');
      this.keyboard.toggleShift(true);

      const isAtomicToElement = (problem.mode === 'atomic_to_element');
      const isElement = cat.includes('원소') || isAtomicToElement;
      const isMolecule = cat.includes('분자') || cat.includes('화학');
      const isIon = cat.includes('이온');

      if (isElement) {
        // 2) 원소기호 맞히기: 숫자 키보드 완전히 빼고 영문 쿼티만 남김!
        this.keyboard.setToolbarConfig({ showNum: false, showIon: false, showSub: false });
      } else if (isMolecule) {
        // 4) 분자식: 숫자/이온 빼고 분자식 첨자만 활성화
        this.keyboard.setToolbarConfig({ showNum: false, showIon: false, showSub: true });
      } else if (isIon) {
        // 5) 이온식: 숫자 빼고 이온 전하 & 첨자만 활성화
        this.keyboard.setToolbarConfig({ showNum: false, showIon: true, showSub: true });
      } else {
        const hasIonChar = problem.answer && (problem.answer.includes('+') || problem.answer.includes('-') || problem.answer.includes('⁺') || problem.answer.includes('⁻'));
        this.keyboard.setToolbarConfig({ showNum: false, showIon: hasIonChar, showSub: true });
      }
    }

    this.dom.quizInput.focus();
  }

  /**
   * 스마트 정답 판정
   */
  checkAnswerCorrect(userAns, problem) {
    if (!userAns) return false;

    const normalize = (str) => {
      return str
        .replace(/\s+/g, '')
        .replace(/\^/g, '')
        .replace(/₀/g, '0').replace(/₁/g, '1').replace(/₂/g, '2').replace(/₃/g, '3').replace(/₄/g, '4')
        .replace(/₅/g, '5').replace(/₆/g, '6').replace(/₇/g, '7').replace(/₈/g, '8').replace(/₉/g, '9')
        .replace(/⁰/g, '0').replace(/¹/g, '1').replace(/²/g, '2').replace(/³/g, '3').replace(/⁴/g, '4')
        .replace(/⁺/g, '+').replace(/⁻/g, '-').replace(/–/g, '-')
        .trim();
    };

    const normUser = normalize(userAns);
    const normTarget = normalize(problem.answer);

    // 1. 단순 일치
    if (normUser === normTarget) return true;

    // 2. 한글 이름 정답일 때 (예: "염화 수소" vs "염화수소")
    const cleanKo = (s) => s.replace(/\s+/g, '').trim();
    if (cleanKo(userAns) === cleanKo(problem.answer)) return true;

    // 3. 이온 전하 순서 유연성 (2+ vs +2)
    const flipCharge = (s) => s.replace(/(\d+)([+-])/, '$1$2').replace(/([+-])(\d+)/, '$2$1');
    if (flipCharge(normUser) === flipCharge(normTarget)) return true;

    return false;
  }

  submitQuizAnswer(answer) {
    if (!answer) {
      this.showToast('답을 입력해주세요!', 'warn');
      return;
    }

    const currentProblem = this.activeList[this.currentIndex];
    const isCorrect = this.checkAnswerCorrect(answer, currentProblem);

    const raw = currentProblem.rawItem;
    if (isCorrect) {
      this.masteryMap[raw.id] = (this.masteryMap[raw.id] || 0) + 1;
    } else {
      this.masteryMap[raw.id] = Math.max(0, (this.masteryMap[raw.id] || 0) - 1);
    }
    this.saveMastery();

    this.quizAnswers.push({
      problem: currentProblem,
      userAnswer: answer,
      isCorrect: isCorrect
    });

    if (isCorrect) {
      this.showToast(`정답입니다! 👏 (${currentProblem.answer})`, 'success');
    } else {
      this.showToast(`오답! 정답: [ ${currentProblem.answer} ]`, 'error');
    }

    setTimeout(() => {
      if (this.currentIndex < this.activeList.length - 1) {
        this.currentIndex++;
        this.renderCurrentQuiz();
      } else {
        this.finishQuiz();
      }
    }, 850);
  }

  showToast(message, type = 'info') {
    const toast = this.dom.quizFeedbackToast;
    toast.textContent = message;
    toast.className = `quiz-toast ${type} show`;
    setTimeout(() => {
      toast.classList.remove('show');
    }, 1700);
  }

  finishQuiz() {
    this.showView('result');
    const total = this.quizAnswers.length;
    const correctCount = this.quizAnswers.filter(a => a.isCorrect).length;
    const wrongCount = total - correctCount;
    const percent = Math.round((correctCount / total) * 100);

    this.dom.resultScoreNumber.textContent = `${percent}점`;
    this.dom.resultScorePercent.textContent = `정답률 ${percent}%`;
    this.dom.resultTotalCount.textContent = `${total}문제`;
    this.dom.resultCorrectCount.textContent = `${correctCount}문제`;
    this.dom.resultWrongCount.textContent = `${wrongCount}문제`;

    this.dom.resultDetailsList.innerHTML = this.quizAnswers.map(ans => {
      return `
        <div class="result-item-card ${ans.isCorrect ? 'correct' : 'wrong'}">
          <div class="result-item-status">
            ${ans.isCorrect ? '⭕ 정답' : '❌ 오답'}
          </div>
          <div class="result-item-info">
            <div class="result-item-name">${ans.problem.question} <span class="tag-mode">(${this.getDirectionLabel(ans.problem.mode)})</span></div>
            <div class="result-item-detail">
              <span>내 답안: <strong>${ans.userAnswer || '(미입력)'}</strong></span>
              <span>정답: <strong class="correct-text">${ans.problem.answer}</strong></span>
            </div>
            <div class="result-item-desc">${ans.problem.rawItem.unit} · ${ans.problem.rawItem.category} ${ans.problem.rawItem.atomicNumber ? `(원자번호 ${ans.problem.rawItem.atomicNumber}번)` : ''}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  getSelectedItems() {
    const list = [];
    CHEMISTRY_DATA.forEach(item => {
      if (this.selectedUnits.has(item.unit)) {
        list.push(item);
      }
    });
    return list;
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new ChemApp();
});
