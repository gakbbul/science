/**
 * 시험용 화학 전용 가상 키보드 (Chemical Virtual Keyboard)
 * - 상단 1열: 원소 번호 및 일반 숫자 (1, 2, 3, 4, 5, 6, 7, 8, 9, 0)
 * - 상단 2열: 이온 전하 위첨자 (⁺, ⁻, ²⁺, ²⁻, ³⁺, ³⁻)
 * - 상단 3열: 분자식 아래첨자 (₁ ~ ₀) + 괄호
 * - 하단: 표준 영문 쿼티(QWERTY) 및 한글 자판 전환 지원
 */

class ChemistryKeyboard {
  constructor(options = {}) {
    this.targetInput = null;
    this.container = options.container || document.getElementById('virtual-keyboard-container');
    this.isShift = true;
    this.keyboardMode = 'en'; // 'en' | 'ko'
    this.displayMode = 'qwerty'; // 'qwerty' | 'numpad'
    this.toolbarConfig = {
      showNum: false,
      showIon: false,
      showSub: false
    };
    this.onSubmit = options.onSubmit || (() => {});
    this.onInput = options.onInput || (() => {});
    this.init();
  }

  setTarget(inputElement) {
    this.targetInput = inputElement;
    if (this.targetInput) {
      this.targetInput.setAttribute('inputmode', 'none');
      this.targetInput.setAttribute('virtualkeyboardpolicy', 'manual');
    }
  }

  init() {
    if (!this.container) return;
    this.render();
  }

  setDisplayMode(mode) {
    if (this.displayMode !== mode) {
      this.displayMode = mode;
      this.render();
    }
  }

  setToolbarConfig(config = {}) {
    if (config.showNum !== undefined) this.toolbarConfig.showNum = config.showNum;
    if (config.showIon !== undefined) this.toolbarConfig.showIon = config.showIon;
    if (config.showSub !== undefined) this.toolbarConfig.showSub = config.showSub;

    if (!this.container) return;
    const rowNum = this.container.querySelector('.kb-toolbar-row-num');
    const rowIon = this.container.querySelector('.kb-toolbar-row-ion');
    const rowSub = this.container.querySelector('.kb-toolbar-row-sub');
    const toolbar = this.container.querySelector('.kb-quick-toolbar');

    if (rowNum) rowNum.style.display = this.toolbarConfig.showNum ? 'flex' : 'none';
    if (rowIon) rowIon.style.display = this.toolbarConfig.showIon ? 'flex' : 'none';
    if (rowSub) rowSub.style.display = this.toolbarConfig.showSub ? 'flex' : 'none';

    if (toolbar) {
      const anyVisible = this.toolbarConfig.showNum || this.toolbarConfig.showIon || this.toolbarConfig.showSub;
      toolbar.style.display = anyVisible ? 'block' : 'none';
    }
  }

  setKeyboardMode(mode) {
    this.keyboardMode = mode;
    if (this.displayMode === 'qwerty') {
      this.render();
    }
  }

  render() {
    if (this.displayMode === 'numpad') {
      // ----------------------------------------------------
      // 원소 번호 맞히기 전용: 숫자 키패드만 표시 (초간결 레이아웃)
      // ----------------------------------------------------
      this.container.innerHTML = `
        <div class="chem-keyboard chem-keyboard-numpad">
          <div class="kb-numpad-area">
            <div class="kb-row">
              <button type="button" class="kb-key kb-numpad-key" data-char="1">1</button>
              <button type="button" class="kb-key kb-numpad-key" data-char="2">2</button>
              <button type="button" class="kb-key kb-numpad-key" data-char="3">3</button>
            </div>
            <div class="kb-row">
              <button type="button" class="kb-key kb-numpad-key" data-char="4">4</button>
              <button type="button" class="kb-key kb-numpad-key" data-char="5">5</button>
              <button type="button" class="kb-key kb-numpad-key" data-char="6">6</button>
            </div>
            <div class="kb-row">
              <button type="button" class="kb-key kb-numpad-key" data-char="7">7</button>
              <button type="button" class="kb-key kb-numpad-key" data-char="8">8</button>
              <button type="button" class="kb-key kb-numpad-key" data-char="9">9</button>
            </div>
            <div class="kb-row">
              <button type="button" class="kb-key kb-backspace" id="kb-btn-backspace" title="지우기">
                ⌫ 지우기
              </button>
              <button type="button" class="kb-key kb-numpad-key" data-char="0">0</button>
              <button type="button" class="kb-key kb-enter" id="kb-btn-enter" title="제출">
                제출 ↵
              </button>
            </div>
          </div>
        </div>
      `;
      this.bindEvents();
      return;
    }

    // ----------------------------------------------------
    // 표준 쿼티 레이아웃 (영문 / 한글 + 맞춤형 툴바)
    // ----------------------------------------------------
    const qRow1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
    const qRow2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'];
    const qRow3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'];

    // 한글 2벌식 쿼티 자판
    const kRow1 = ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'];
    const kRow1Shift = ['ㅃ', 'ㅉ', 'ㄸ', 'ㄲ', 'ㅆ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅒ', 'ㅖ'];
    const kRow2 = ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'];
    const kRow3 = ['ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ'];

    const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    const subscripts = ['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉', '₀'];
    const ions = ['⁺', '⁻', '²⁺', '²⁻', '³⁺', '³⁻'];

    const anyToolbarVisible = this.toolbarConfig.showNum || this.toolbarConfig.showIon || this.toolbarConfig.showSub;

    this.container.innerHTML = `
      <div class="chem-keyboard">
        <!-- 상단 빠른 기호/숫자 바 (필요한 경우에만 노출) -->
        <div class="kb-quick-toolbar" style="display: ${anyToolbarVisible ? 'block' : 'none'}">
          <!-- 1. 원소 번호 및 숫자 -->
          <div class="kb-toolbar-row kb-toolbar-row-num" style="display: ${this.toolbarConfig.showNum ? 'flex' : 'none'}">
            <span class="kb-badge num">숫자</span>
            <div class="kb-keys-scroll">
              ${numbers.map(n => `<button type="button" class="kb-key kb-key-num" data-char="${n}">${n}</button>`).join('')}
            </div>
          </div>

          <!-- 2. 이온 전하(위첨자) -->
          <div class="kb-toolbar-row kb-toolbar-row-ion" style="display: ${this.toolbarConfig.showIon ? 'flex' : 'none'}">
            <span class="kb-badge ion">이온 전하</span>
            <div class="kb-keys-scroll">
              ${ions.map(ion => `<button type="button" class="kb-key kb-key-sup" data-char="${ion}">${ion}</button>`).join('')}
            </div>
          </div>

          <!-- 3. 분자식(아래첨자) 및 괄호 -->
          <div class="kb-toolbar-row kb-toolbar-row-sub" style="display: ${this.toolbarConfig.showSub ? 'flex' : 'none'}">
            <span class="kb-badge sub">분자식 첨자</span>
            <div class="kb-keys-scroll">
              ${subscripts.map(s => `<button type="button" class="kb-key kb-key-sub" data-char="${s}">${s}</button>`).join('')}
              <button type="button" class="kb-key kb-key-symbol" data-char="(">(</button>
              <button type="button" class="kb-key kb-key-symbol" data-char=")">)</button>
            </div>
          </div>
        </div>

        <!-- 하단 메인 쿼티 키패드 (영문/한글) -->
        <div class="kb-qwerty-area">
          ${this.keyboardMode === 'en' ? `
            <div class="kb-row">
              ${qRow1.map(char => `<button type="button" class="kb-key kb-letter" data-char="${char}">${this.isShift ? char : char.toLowerCase()}</button>`).join('')}
            </div>
            <div class="kb-row">
              ${qRow2.map(char => `<button type="button" class="kb-key kb-letter" data-char="${char}">${this.isShift ? char : char.toLowerCase()}</button>`).join('')}
            </div>
            <div class="kb-row">
              <button type="button" class="kb-key kb-shift ${this.isShift ? 'active' : ''}" id="kb-btn-shift" title="대/소문자 전환">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M12 19V5M5 12l7-7 7 7"/>
                </svg>
                <span>${this.isShift ? '대문자' : '소문자'}</span>
              </button>
              ${qRow3.map(char => `<button type="button" class="kb-key kb-letter" data-char="${char}">${this.isShift ? char : char.toLowerCase()}</button>`).join('')}
              <button type="button" class="kb-key kb-backspace" id="kb-btn-backspace" title="지우기">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
                  <line x1="18" y1="9" x2="12" y2="15"></line>
                  <line x1="12" y1="9" x2="18" y2="15"></line>
                </svg>
              </button>
            </div>
          ` : `
            <div class="kb-row">
              ${(this.isShift ? kRow1Shift : kRow1).map(char => `<button type="button" class="kb-key kb-hangul" data-char="${char}">${char}</button>`).join('')}
            </div>
            <div class="kb-row">
              ${kRow2.map(char => `<button type="button" class="kb-key kb-hangul" data-char="${char}">${char}</button>`).join('')}
            </div>
            <div class="kb-row">
              <button type="button" class="kb-key kb-shift ${this.isShift ? 'active' : ''}" id="kb-btn-shift">
                <span>쌍자음</span>
              </button>
              ${kRow3.map(char => `<button type="button" class="kb-key kb-hangul" data-char="${char}">${char}</button>`).join('')}
              <button type="button" class="kb-key kb-backspace" id="kb-btn-backspace">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
                  <line x1="18" y1="9" x2="12" y2="15"></line>
                  <line x1="12" y1="9" x2="18" y2="15"></line>
                </svg>
              </button>
            </div>
          `}

          <!-- 하단 기능 바 -->
          <div class="kb-row kb-bottom-row">
            <button type="button" class="kb-key kb-lang-toggle" id="kb-btn-lang">
              ${this.keyboardMode === 'en' ? '한글 자판' : 'ENG'}
            </button>
            <button type="button" class="kb-key kb-clear" id="kb-btn-clear">
              지우기
            </button>
            <button type="button" class="kb-key kb-space" id="kb-btn-space">
              Space
            </button>
            <button type="button" class="kb-key kb-enter" id="kb-btn-enter">
              제출 ↵
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelectorAll('.kb-key[data-char]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        let char = btn.getAttribute('data-char');
        if (btn.classList.contains('kb-letter')) {
          char = this.isShift ? char.toUpperCase() : char.toLowerCase();
          // 원소기호 입력 편의: 첫 글자 대문자 입력 후 자동으로 소문자로 전환
          if (this.isShift) {
            this.toggleShift(false);
          }
        } else if (btn.classList.contains('kb-hangul')) {
          if (this.isShift) {
            this.toggleShift(false);
          }
        }
        this.insertText(char);
      });
    });

    const shiftBtn = this.container.querySelector('#kb-btn-shift');
    if (shiftBtn) {
      shiftBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleShift(!this.isShift);
      });
    }

    const backBtn = this.container.querySelector('#kb-btn-backspace');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.deleteText();
      });
    }

    const clearBtn = this.container.querySelector('#kb-btn-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.targetInput) {
          this.targetInput.value = '';
          this.onInput('');
          this.toggleShift(true);
        }
      });
    }

    const spaceBtn = this.container.querySelector('#kb-btn-space');
    if (spaceBtn) {
      spaceBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.insertText(' ');
      });
    }

    const enterBtn = this.container.querySelector('#kb-btn-enter');
    if (enterBtn) {
      enterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.onSubmit) {
          this.onSubmit(this.targetInput ? this.targetInput.value.trim() : '');
        }
      });
    }

    // 한/영 전환 키
    const langBtn = this.container.querySelector('#kb-btn-lang');
    if (langBtn) {
      langBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.setKeyboardMode(this.keyboardMode === 'en' ? 'ko' : 'en');
      });
    }
  }

  toggleShift(forceState) {
    this.isShift = forceState !== undefined ? forceState : !this.isShift;
    const shiftBtn = this.container.querySelector('#kb-btn-shift');
    if (shiftBtn) {
      if (this.isShift) {
        shiftBtn.classList.add('active');
        if (this.keyboardMode === 'en') {
          shiftBtn.querySelector('span').textContent = '대문자';
        }
      } else {
        shiftBtn.classList.remove('active');
        if (this.keyboardMode === 'en') {
          shiftBtn.querySelector('span').textContent = '소문자';
        }
      }
    }

    if (this.keyboardMode === 'en') {
      this.container.querySelectorAll('.kb-letter').forEach(btn => {
        const base = btn.getAttribute('data-char');
        btn.textContent = this.isShift ? base.toUpperCase() : base.toLowerCase();
      });
    } else {
      this.render(); // 한글 쌍자음 리렌더
    }
  }

  insertText(text) {
    if (!this.targetInput) return;
    const input = this.targetInput;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const val = input.value;

    input.value = val.substring(0, start) + text + val.substring(end);
    const newPos = start + text.length;
    input.focus();
    input.setSelectionRange(newPos, newPos);

    this.onInput(input.value);
  }

  deleteText() {
    if (!this.targetInput) return;
    const input = this.targetInput;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const val = input.value;

    if (start === end) {
      if (start > 0) {
        input.value = val.substring(0, start - 1) + val.substring(end);
        input.focus();
        input.setSelectionRange(start - 1, start - 1);
      }
    } else {
      input.value = val.substring(0, start) + val.substring(end);
      input.focus();
      input.setSelectionRange(start, start);
    }

    if (input.value.length === 0) {
      this.toggleShift(true);
    }

    this.onInput(input.value);
  }
}

window.ChemistryKeyboard = ChemistryKeyboard;
