document.addEventListener('DOMContentLoaded', () => {
  // 1. 애플리케이션 상태 관리
  const state = {
    imageEntries: [], // [변경] File 객체 대신 zip Entry나 파일 정보를 저장
    ocrData: null,
    zip: null, // [추가] 로드된 zip 객체를 저장하기 위함
    currentIndex: 0,
    isWebtoonMode: false,
    displayMode: 'original',
    zoomFactor: 1.0,
    isTextOverlayVisible: true,
    areControlsVisible: true,
    activeBlobUrls: new Map(), // [추가] 메모리 관리를 위해 생성된 Blob URL을 추적
    webtoonState: { loadedUntilIndex: -1 }, // [추가] 웹툰 모드 스크롤 상태
  };

  // 2. DOM 요소 캐싱 (변경 없음)
  const domElements = {
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

  let webtoonObserver; // [추가] 웹툰모드 Intersection Observer

  // 3. 핵심 로직 (상태 변경)
  const navigate = {
    next: () => {
      if (state.imageEntries.length > 0) {
        state.currentIndex = (state.currentIndex + 1) % state.imageEntries.length;
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    },
    previous: () => {
      if (state.imageEntries.length > 0) {
        state.currentIndex = (state.currentIndex - 1 + state.imageEntries.length) % state.imageEntries.length;
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
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

  /**
   * [변경] 메모리 관리를 위해 사용한 Blob URL들을 해제합니다.
   */
  function cleanupBlobUrls() {
    for (const url of state.activeBlobUrls.values()) {
      URL.revokeObjectURL(url);
    }
    state.activeBlobUrls.clear();
  }

  /**
   * [변경] 새 이미지 '목록'과 OCR 데이터로 뷰어를 초기화합니다.
   * @param {object[]} imageEntries - 표시할 이미지 zipEntry 배열
   * @param {object|null} ocrData - Mokuro OCR 데이터
   * @param {JSZip|null} zipObject - 로드된 JSZip 객체
   */
  function initializeViewer(imageEntries, ocrData = null, zipObject = null) {
    if (imageEntries.length === 0) {
      alert('표시할 이미지 파일이 없습니다.');
      return;
    }

    cleanupBlobUrls(); // 이전 데이터 정리

    state.imageEntries = imageEntries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    state.ocrData = ocrData;
    state.zip = zipObject;
    state.currentIndex = 0;
    state.zoomFactor = 1.0;

    const allButtons = [
        domElements.toggleModeButton, domElements.previousButton, domElements.nextButton,
        domElements.fitWidthButton, domElements.fitScreenButton, domElements.originalSizeButton,
        domElements.zoomInButton, domElements.zoomOutButton
    ];
    allButtons.forEach(btn => btn.disabled = false);

    render();
  }

  // 4. 렌더링 로직 (DOM 업데이트)

  /**
   * 이미지 요소에 스타일을 적용합니다. (변경 없음)
   */
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
      default:
        img.style.width = `${img.naturalWidth * state.zoomFactor}px`;
        img.style.height = 'auto';
        break;
    }
  }

  /**
   * OCR 데이터를 기반으로 텍스트 상자를 렌더링합니다. (변경 없음)
   */
  function renderTextBoxes() {
    domElements.overlayContainer.innerHTML = '';
    if (!state.isTextOverlayVisible || state.isWebtoonMode || !state.ocrData || !state.ocrData.pages) {
      return;
    }
    const pageData = state.ocrData.pages[state.currentIndex];
    if (!pageData) return;
    const imageElement = domElements.singleImageElement;
    const containerRect = domElements.viewerContainer.getBoundingClientRect();
    const imageRect = imageElement.getBoundingClientRect();
    const imageOffsetX = imageRect.left - containerRect.left;
    const imageOffsetY = imageRect.top - containerRect.top;
    const imageScale = imageElement.clientWidth / imageElement.naturalWidth;
    if (!isFinite(imageScale)) return;
    pageData.blocks.forEach(block => {
      const [x1, y1, x2, y2] = block.box;
      const textBoxContainer = document.createElement('div');
      textBoxContainer.className = 'textbox';
      textBoxContainer.style.left = `${imageOffsetX + x1 * imageScale}px`;
      textBoxContainer.style.top = `${imageOffsetY + y1 * imageScale}px`;
      textBoxContainer.style.width = `${(x2 - x1) * imageScale}px`;
      textBoxContainer.style.height = `${(y2 - y1) * imageScale}px`;
      const textElement = document.createElement('div');
      textElement.className = 'textInBox';
      textElement.style.fontSize = `${Math.max(1, Math.round(block.font_size * imageScale))}px`;
      textElement.innerHTML = block.lines.join('<br>');
      if (block.vertical) {
        textElement.style.writingMode = 'vertical-rl';
      }
      textBoxContainer.appendChild(textElement);
      domElements.overlayContainer.appendChild(textBoxContainer);
    });
  }
  
  /**
   * [신규] 단일 페이지 모드를 렌더링합니다. 현재 페이지만 압축 해제합니다.
   */
  async function renderSinglePage() {
    domElements.viewerContainer.innerHTML = ''; // 이전 이미지들 제거
    domElements.viewerContainer.appendChild(domElements.singleImageElement);
    
    if (state.imageEntries.length === 0) {
      domElements.singleImageElement.src = "";
      return;
    }

    const currentEntry = state.imageEntries[state.currentIndex];
    if (!currentEntry) return;

    try {
      const blob = await currentEntry.async('blob');
      const url = URL.createObjectURL(blob);

      // 이전 Blob URL을 메모리에서 해제하고 새 URL을 추적합니다.
      cleanupBlobUrls();
      state.activeBlobUrls.set(state.currentIndex, url);

      domElements.singleImageElement.onload = () => {
        applyImageStyles(domElements.singleImageElement);
        renderTextBoxes();
      };
      domElements.singleImageElement.src = url;
    } catch (error) {
      console.error(`Error decompressing image ${currentEntry.name}:`, error);
      domElements.singleImageElement.src = "";
    }
  }

  /**
   * [신규] 웹툰 모드에서 다음 이미지 묶음을 로드합니다.
   */
  async function loadNextWebtoonBatch(batchSize = 3) {
    const startIndex = state.webtoonState.loadedUntilIndex + 1;
    if (startIndex >= state.imageEntries.length) {
      if (webtoonObserver) webtoonObserver.disconnect();
      return;
    }

    const endIndex = Math.min(startIndex + batchSize, state.imageEntries.length);
    const entriesToLoad = state.imageEntries.slice(startIndex, endIndex);

    const imageElements = await Promise.all(entriesToLoad.map(async (entry, i) => {
        const blob = await entry.async('blob');
        const url = URL.createObjectURL(blob);
        state.activeBlobUrls.set(startIndex + i, url);

        const img = document.createElement('img');
        img.src = url;
        img.className = 'webtoon-img';
        img.onload = () => applyImageStyles(img);
        return img;
    }));
    
    imageElements.forEach(img => domElements.viewerContainer.appendChild(img));
    state.webtoonState.loadedUntilIndex = endIndex - 1;

    const lastImage = imageElements[imageElements.length - 1];
    if (lastImage && state.webtoonState.loadedUntilIndex < state.imageEntries.length - 1) {
        webtoonObserver.observe(lastImage);
    } else {
        if (webtoonObserver) webtoonObserver.disconnect();
    }
  }

  /**
   * [신규] 웹툰 모드를 렌더링합니다. IntersectionObserver로 가상 스크롤을 구현합니다.
   */
  function renderWebtoonMode() {
    domElements.viewerContainer.innerHTML = '';
    state.webtoonState = { loadedUntilIndex: -1 };

    if (webtoonObserver) webtoonObserver.disconnect();
    
    webtoonObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          webtoonObserver.unobserve(entry.target);
          loadNextWebtoonBatch();
        }
      });
    }, { rootMargin: '300%' }); // 이미지가 화면에 보이기 300% 전에 미리 로드

    loadNextWebtoonBatch(); // 첫 묶음 로드
  }

  /**
   * [변경] 메인 렌더링 함수: 현재 상태에 따라 뷰어 전체를 다시 그립니다.
   */
  function render() {
    cleanupBlobUrls(); // 렌더링 시작 전 메모리 정리
    domElements.overlayContainer.innerHTML = '';

    if (state.isWebtoonMode) {
      renderWebtoonMode();
    } else {
      renderSinglePage();
    }
    updateControlStates();
  }

  /**
   * 컨트롤 버튼들의 상태를 업데이트합니다. (큰 변경 없음)
   */
  function updateControlStates() {
    domElements.toggleModeButton.textContent = state.isWebtoonMode ? '단일모드 전환' : '웹툰모드 켜기';
    domElements.previousButton.style.display = state.isWebtoonMode ? 'none' : '';
    domElements.nextButton.style.display = state.isWebtoonMode ? 'none' : '';
    domElements.toggleControlsButton.textContent = state.areControlsVisible ? '컨트롤 숨기기' : '컨트롤 보이기';
    domElements.controlsContainer.classList.toggle('hidden', !state.areControlsVisible);
    domElements.toggleTextButton.textContent = state.isTextOverlayVisible ? '텍스트 숨기기' : '텍스트 보이기';
  }

  // 5. 이벤트 리스너 초기화
  function initializeEventListeners() {
    // 폴더 선택 (기존 로직 유지, 폴더는 zip과 달리 lazy-load가 덜 중요)
    domElements.selectFolderButton.addEventListener('click', () => domElements.folderInputElement.click());
    domElements.folderInputElement.addEventListener('change', (e) => {
      const imageFiles = Array.from(e.target.files).filter(f => /\.(jpe?g|png|gif|bmp|webp)$/i.test(f.name));
      // File API는 zipEntry와 달라 일단 File 객체로 직접 초기화
      // 이 부분도 최적화가 필요하다면 별도 처리가 필요함
      initializeViewer(imageFiles.map(f => ({
          name: f.name,
          async: () => Promise.resolve(f) // File 객체를 blob처럼 다루기 위한 래퍼
      })));
    });
    
    domElements.selectMokuroButton.addEventListener('click', () => domElements.mokuroInputElement.click());
    domElements.mokuroInputElement.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          state.ocrData = JSON.parse(reader.result);
          render();
        } catch (error) {
          alert('올바르지 않은 Mokuro 파일입니다.');
        }
      };
      reader.readAsText(file);
    });

    /**
     * [변경] ZIP 파일 이벤트 리스너: 모든 파일을 한번에 압축해제하지 않습니다.
     */
    domElements.selectZipButton.addEventListener('click', () => domElements.zipInputElement.click());
    domElements.zipInputElement.addEventListener('change', async (e) => {
      const zipFile = e.target.files[0];
      if (!zipFile) return;

      try {
        const zip = await JSZip.loadAsync(zipFile);
        const imageEntries = [];
        let ocrData = null;
        const ocrPromise = [];

        zip.forEach((relativePath, zipEntry) => {
          if (/\.(jpe?g|png|gif|bmp|webp)$/i.test(zipEntry.name) && !zipEntry.dir) {
            imageEntries.push(zipEntry); // 이미지 데이터가 아닌 '파일 정보(entry)'만 저장
          } else if (/\.mokuro$/i.test(zipEntry.name)) {
            ocrPromise.push(zipEntry.async('string').then(text => {
              ocrData = JSON.parse(text);
            }));
          }
        });
        
        await Promise.all(ocrPromise); // ocr 파일 파싱이 끝날 때까지 기다림
        initializeViewer(imageEntries, ocrData, zip); // zip 객체와 파일 '목록'으로 뷰어 초기화
      } catch (error) {
        alert('ZIP 파일을 처리하는 중 오류가 발생했습니다.');
        console.error("ZIP file processing error:", error);
      }
    });

    // 네비게이션
    domElements.previousButton.addEventListener('click', () => { navigate.previous(); render(); });
    domElements.nextButton.addEventListener('click', () => { navigate.next(); render(); });
    domElements.leftClickZone.addEventListener('click', () => { if (!state.isWebtoonMode) { navigate.previous(); render(); } });
    domElements.rightClickZone.addEventListener('click', () => { if (!state.isWebtoonMode) { navigate.next(); render(); } });
    
    // 뷰 모드
    domElements.toggleModeButton.addEventListener('click', () => { view.toggleWebtoonMode(); render(); });
    domElements.fitWidthButton.addEventListener('click', () => { view.changeMode('fit-width'); render(); });
    domElements.fitScreenButton.addEventListener('click', () => { view.changeMode('fit-screen'); render(); });
    domElements.originalSizeButton.addEventListener('click', () => { view.changeMode('original'); render(); });

    // 줌
    domElements.zoomInButton.addEventListener('click', () => { view.zoom('in'); render(); });
    domElements.zoomOutButton.addEventListener('click', () => { view.zoom('out'); render(); });
    
    domElements.viewerContainer.addEventListener('wheel', e => {
      if (!e.shiftKey) return;
      e.preventDefault();
      view.zoom(e.deltaY < 0 ? 'in' : 'out');
      render();
    }, { passive: false });

    window.addEventListener('keydown', e => {
      if(state.imageEntries.length === 0) return;
      if (e.key === 'ArrowRight') { if (!state.isWebtoonMode) { navigate.next(); render(); } }
      else if (e.key === 'ArrowLeft') { if (!state.isWebtoonMode) { navigate.previous(); render(); } }
      else if (e.key === '+' || e.key === '=') { view.zoom('in'); render(); } 
      else if (e.key === '-') { view.zoom('out'); render(); }
    });

    // UI 토글
    domElements.toggleControlsButton.addEventListener('click', () => {
      state.areControlsVisible = !state.areControlsVisible;
      updateControlStates();
    });
    domElements.toggleTextButton.addEventListener('click', () => {
      state.isTextOverlayVisible = !state.isTextOverlayVisible;
      render();
    });
    
    // 창 크기가 변경될 때 텍스트 박스 위치 재조정
    window.addEventListener('resize', renderTextBoxes);
  }

  // 6. 애플리케이션 시작
  initializeEventListeners();
});
