// viewer.js (메모리 안전 버전)
document.addEventListener('DOMContentLoaded', () => {
  // ====== 1) 상태 ======
  const MAX_CACHE = 8; // 보유할 최대 페이지 수(가시 범위 + 버퍼)
  const state = {
    // pages: [{ name, getBlob: () => Promise<Blob> }]
    pages: [],
    ocrData: null,
    currentIndex: 0,
    isWebtoonMode: false,
    displayMode: 'original', // 'fit-width' | 'fit-screen' | 'original'
    zoomFactor: 1.0,
    isTextOverlayVisible: true,
    areControlsVisible: true,

    // object URL LRU 캐시
    cache: new Map(),         // index -> { url }
    cacheOrder: [],           // 최근 사용 순서 (뒤가 최신)
    io: null,                 // 웹툰 모드 IntersectionObserver
  };

  // ====== 2) DOM ======
  const dom = {
    selectZipButton: document.getElementById('pick-zip'),
    zipInputElement: document.getElementById('zip-input'),
    selectFolderButton: document.getElementById('pick-folder'),
    folderInputElement: document.getElementById('folder-input'),
    selectMokuroButton: document.getElementById('load-json'),
    mokuroInputElement: document.getElementById('json-input'),

    toggleModeButton: document.getElementById('toggle-mode'),
    previousButton: document.getElementById('prev'),
    nextButton: document.getElementById('next'),

    fitWidthButton: document.getElementById('fit-width'),
    fitScreenButton: document.getElementById('fit-screen'),
    originalSizeButton: document.getElementById('original'),
    zoomInButton: document.getElementById('zoom-in'),
    zoomOutButton: document.getElementById('zoom-out'),

    viewerContainer: document.getElementById('viewer-container'),
    overlayContainer: document.getElementById('overlay-container'),
    singleImageElement: document.getElementById('viewer'),

    leftClickZone: document.getElementById('click-left'),
    rightClickZone: document.getElementById('click-right'),

    controlsContainer: document.querySelector('.controls'),
    toggleControlsButton: document.getElementById('toggle-controls-btn'),
    toggleTextButton: document.getElementById('toggle-text-btn'),
  };

  // ====== 3) 유틸: 캐시 & URL 정리 ======
  function touchCacheIndex(idx) {
    const pos = state.cacheOrder.indexOf(idx);
    if (pos !== -1) state.cacheOrder.splice(pos, 1);
    state.cacheOrder.push(idx);
  }
  function addCache(idx, url) {
    state.cache.set(idx, { url });
    touchCacheIndex(idx);
    evictIfNeeded();
  }
  function evictIfNeeded() {
    while (state.cacheOrder.length > MAX_CACHE) {
      const evictIdx = state.cacheOrder.shift();
      const entry = state.cache.get(evictIdx);
      if (entry) {
        try { URL.revokeObjectURL(entry.url); } catch {}
        state.cache.delete(evictIdx);
      }
    }
  }
  function clearAllCache() {
    state.cache.forEach(({ url }) => { try { URL.revokeObjectURL(url); } catch {} });
    state.cache.clear();
    state.cacheOrder.length = 0;
  }

  async function ensureUrlFor(index) {
    if (index < 0 || index >= state.pages.length) return null;
    if (state.cache.has(index)) {
      touchCacheIndex(index);
      return state.cache.get(index).url;
    }
    const blob = await state.pages[index].getBlob();
    const url = URL.createObjectURL(blob);
    addCache(index, url);
    return url;
  }

  function prefetch(index) {
    if (index < 0 || index >= state.pages.length) return;
    ensureUrlFor(index).catch(() => {});
  }

  // ====== 4) 네비게이션 / 뷰 상태 ======
  const navigate = {
    next: () => {
      if (!state.pages.length) return;
      state.currentIndex = (state.currentIndex + 1) % state.pages.length;
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    },
    previous: () => {
      if (!state.pages.length) return;
      state.currentIndex = (state.currentIndex - 1 + state.pages.length) % state.pages.length;
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    },
  };

  const view = {
    changeMode: (mode) => {
      state.displayMode = mode;
      state.zoomFactor = 1.0;
    },
    zoom: (direction) => {
      state.zoomFactor *= (direction === 'in' ? 1.1 : 0.9);
    },
    toggleWebtoonMode: () => {
      state.isWebtoonMode = !state.isWebtoonMode;
    },
  };

  // ====== 5) 스타일 적용 / 텍스트 박스 ======
  function applyImageStyles(img) {
    img.style.display = 'block';
    img.style.margin = '0 auto';

    switch (state.displayMode) {
      case 'fit-width':
        img.style.width = `${state.zoomFactor * 100}%`;
        img.style.height = 'auto';
        break;
      case 'fit-screen':
        img.style.width = 'auto';
        img.style.height = `${state.zoomFactor * 100}vh`;
        break;
      case 'original':
      default: {
        const originalWidth = (img.naturalWidth || img.width) * state.zoomFactor;
        img.style.width = `${originalWidth}px`;
        img.style.height = 'auto';
      }
    }
  }

  function renderTextBoxes() {
    dom.overlayContainer.innerHTML = '';
    if (!state.isTextOverlayVisible || state.isWebtoonMode || !state.ocrData || !state.ocrData.pages) return;

    const pageData = state.ocrData.pages[state.currentIndex];
    if (!pageData) return;

    const imageElement = dom.singleImageElement;
    const containerRect = dom.viewerContainer.getBoundingClientRect();
    const imageRect = imageElement.getBoundingClientRect();

    const imageOffsetX = imageRect.left - containerRect.left;
    const imageOffsetY = imageRect.top - containerRect.top;
    const imageScale = imageElement.clientWidth / imageElement.naturalWidth;
    if (!isFinite(imageScale)) return;

    pageData.blocks.forEach(block => {
      const [x1, y1, x2, y2] = block.box;
      const boxNaturalWidth = x2 - x1;
      const boxNaturalHeight = y2 - y1;

      const scaledFontSize = Math.max(1, Math.round(block.font_size * imageScale));

      const textBoxContainer = document.createElement('div');
      textBoxContainer.className = 'textbox';
      textBoxContainer.style.left = `${imageOffsetX + x1 * imageScale}px`;
      textBoxContainer.style.top = `${imageOffsetY + y1 * imageScale}px`;
      textBoxContainer.style.width = `${boxNaturalWidth * imageScale}px`;
      textBoxContainer.style.height = `${boxNaturalHeight * imageScale}px`;

      const textElement = document.createElement('div');
      textElement.className = 'textInBox';
      textElement.style.fontSize = `${scaledFontSize}px`;
      textElement.innerHTML = block.lines.join('<br>');
      if (block.vertical) textElement.style.writingMode = 'vertical-rl';

      textBoxContainer.appendChild(textElement);
      dom.overlayContainer.appendChild(textBoxContainer);
    });
  }

  // ====== 6) 렌더링 ======
  async function renderSingle() {
    // single 이미지만 표시, 웹툰 슬롯 제거
    destroyWebtoonIfAny();
    dom.singleImageElement.style.display = 'block';
    dom.overlayContainer.style.display = state.isTextOverlayVisible ? 'block' : 'none';

    const url = await ensureUrlFor(state.currentIndex);
    if (!url) return;

    // 이전 src와 동일하면 다시 그릴 필요 없음
    if (dom.singleImageElement.src !== url) {
      dom.singleImageElement.src = url;
    }

    dom.singleImageElement.onload = () => {
      applyImageStyles(dom.singleImageElement);
      renderTextBoxes();
    };

    // 가벼운 프리페치
    prefetch(state.currentIndex + 1);
    prefetch(state.currentIndex - 1);
  }

  function destroyWebtoonIfAny() {
    const list = document.getElementById('webtoon-list');
    if (list) list.remove();
    if (state.io) {
      state.io.disconnect();
      state.io = null;
    }
  }

  async function renderWebtoon() {
    // single 이미지/오버레이 숨김
    dom.singleImageElement.style.display = 'none';
    dom.overlayContainer.style.display = 'none';

    // 기존 웹툰 리스트 제거
    destroyWebtoonIfAny();

    // 가상 리스트 컨테이너 생성(빈 슬롯만 먼저)
    const list = document.createElement('div');
    list.id = 'webtoon-list';
    dom.viewerContainer.appendChild(list);

    for (let i = 0; i < state.pages.length; i++) {
      const slot = document.createElement('div');
      slot.className = 'page-slot';
      slot.dataset.index = String(i);
      // 초기 높이 임시(화면 70%): 실제 로드 후 자동으로 맞춰짐
      slot.style.minHeight = '70vh';
      list.appendChild(slot);
    }

    // 보이는 슬롯만 로드/언로드
    state.io = new IntersectionObserver(async entries => {
      for (const entry of entries) {
        const idx = parseInt(entry.target.dataset.index, 10);
        if (entry.isIntersecting) {
          // mount
          if (entry.target.dataset.mounted === '1') continue;
          entry.target.dataset.mounted = '1';

          const img = document.createElement('img');
          img.className = 'webtoon-img';
          img.setAttribute('loading', 'lazy');
          try {
            const url = await ensureUrlFor(idx);
            if (!url) continue;
            img.src = url;
            img.onload = () => {
              applyImageStyles(img);
              entry.target.style.minHeight = 'auto';
            };
            entry.target.appendChild(img);
            // 미리 앞장 프리페치
            prefetch(idx + 1);
          } catch {
            entry.target.dataset.mounted = '0';
          }
        } else {
          // unmount (보이지 않을 때는 과감히 떼서 메모리 절약)
          if (entry.target.dataset.mounted === '1') {
            entry.target.dataset.mounted = '0';
            entry.target.innerHTML = '';
            // 캐시는 LRU 정책으로 자연 정리됨
          }
        }
      }
    }, { root: null, rootMargin: '800px 0px' });

    // 관찰 시작
    list.querySelectorAll('.page-slot').forEach(el => state.io.observe(el));
  }

  async function render() {
    if (!state.pages.length) return;
    if (state.isWebtoonMode) await renderWebtoon();
    else await renderSingle();

    updateControlStates();
  }

  function updateControlStates() {
    dom.toggleModeButton.textContent = state.isWebtoonMode ? '단일모드 전환' : '웹툰모드 켜기';
    dom.previousButton.style.display = state.isWebtoonMode ? 'none' : '';
    dom.nextButton.style.display = state.isWebtoonMode ? 'none' : '';

    dom.toggleControlsButton.textContent = state.areControlsVisible ? '컨트롤 숨기기' : '컨트롤 보이기';
    dom.controlsContainer.classList.toggle('hidden', !state.areControlsVisible);

    dom.toggleTextButton.textContent = state.isTextOverlayVisible ? '텍스트 숨기기' : '텍스트 보이기';
  }

  // ====== 7) 초기화 ======
  function initializeViewer(pages, ocrData = null) {
    if (!pages.length) {
      alert('표시할 이미지 파일이 없습니다.');
      return;
    }

    // 기존 리소스 정리
    destroyWebtoonIfAny();
    clearAllCache();
    dom.singleImageElement.src = ''; // 잠재적 디코드 해제 유도

    state.pages = pages;
    state.ocrData = ocrData;
    state.currentIndex = 0;
    state.zoomFactor = 1.0;

    const allButtons = [
      dom.toggleModeButton, dom.previousButton, dom.nextButton,
      dom.fitWidthButton, dom.fitScreenButton, dom.originalSizeButton,
      dom.zoomInButton, dom.zoomOutButton
    ];
    allButtons.forEach(btn => btn.disabled = false);

    render();
  }

  // ====== 8) 이벤트 바인딩 ======
  function initializeEventListeners() {
    // 폴더(파일 핸들만, 메모리 부담 적음)
    dom.selectFolderButton.addEventListener('click', () => dom.folderInputElement.click());
    dom.folderInputElement.addEventListener('change', (e) => {
      const files = Array.from(e.target.files).filter(f => /\.(jpe?g|png|gif|bmp|webp)$/i.test(f.name));
      const pages = files
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        .map(file => ({
          name: file.name,
          getBlob: () => Promise.resolve(file),
        }));
      initializeViewer(pages);
    });

    // Mokuro JSON
    dom.selectMokuroButton.addEventListener('click', () => dom.mokuroInputElement.click());
    dom.mokuroInputElement.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          state.ocrData = JSON.parse(reader.result);
          render(); // overlay 반영
        } catch (err) {
          alert('올바르지 않은 Mokuro 파일입니다.');
          console.error('Invalid JSON in Mokuro file:', err);
        }
      };
      reader.readAsText(file);
    });

    // ZIP (지연 추출)
    dom.selectZipButton.addEventListener('click', () => dom.zipInputElement.click());
    dom.zipInputElement.addEventListener('change', async (e) => {
      const zipFile = e.target.files[0];
      if (!zipFile) return;

      const zip = await JSZip.loadAsync(zipFile);
      let ocrData = null;
      const imageEntries = [];

      zip.forEach((relativePath, entry) => {
        if (/\.(jpe?g|png|gif|bmp|webp)$/i.test(entry.name)) {
          imageEntries.push(entry);
        } else if (/\.mokuro$/i.test(entry.name)) {
          // OCR 파일은 한 번만 로드
          entry.async('string').then(text => { try { ocrData = JSON.parse(text); } catch {} });
        }
      });

      imageEntries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const pages = imageEntries.map((entry) => ({
        name: entry.name,
        getBlob: () => entry.async('blob'),
      }));

      initializeViewer(pages, ocrData);
    });

    // 네비게이션
    dom.previousButton.addEventListener('click', async () => { navigate.previous(); await render(); });
    dom.nextButton.addEventListener('click', async () => { navigate.next(); await render(); });
    dom.leftClickZone.addEventListener('click', async () => { navigate.previous(); await render(); });
    dom.rightClickZone.addEventListener('click', async () => { navigate.next(); await render(); });

    // 뷰 모드
    dom.toggleModeButton.addEventListener('click', async () => { view.toggleWebtoonMode(); await render(); });
    dom.fitWidthButton.addEventListener('click', async () => { view.changeMode('fit-width'); await render(); });
    dom.fitScreenButton.addEventListener('click', async () => { view.changeMode('fit-screen'); await render(); });
    dom.originalSizeButton.addEventListener('click', async () => { view.changeMode('original'); await render(); });

    // 줌
    dom.zoomInButton.addEventListener('click', async () => { view.zoom('in'); await render(); });
    dom.zoomOutButton.addEventListener('click', async () => { view.zoom('out'); await render(); });

    dom.viewerContainer.addEventListener('wheel', async e => {
      if (!e.shiftKey) return;
      e.preventDefault();
      view.zoom(e.deltaY < 0 ? 'in' : 'out');
      await render();
    });

    window.addEventListener('keydown', async e => {
      if (e.key === '+' || e.key === '=') { view.zoom('in'); await render(); }
      else if (e.key === '-') { view.zoom('out'); await render(); }
    });

    // UI 토글
    dom.toggleControlsButton.addEventListener('click', () => {
      state.areControlsVisible = !state.areControlsVisible;
      updateControlStates();
    });

    dom.toggleTextButton.addEventListener('click', async () => {
      state.isTextOverlayVisible = !state.isTextOverlayVisible;
      await render();
    });

    // 탭 닫힘/새로고침 시 리소스 해제
    window.addEventListener('beforeunload', () => {
      destroyWebtoonIfAny();
      clearAllCache();
    });
  }

  // ====== 9) 시작 ======
  initializeEventListeners();
});
