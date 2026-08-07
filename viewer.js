// 요소 가져오기
const toggleBtn = document.getElementById('toggle-mode');
const btnPrev = document.getElementById('prev');
const btnNext = document.getElementById('next');
const btnFitWidth = document.getElementById('fit-width');
const btnFitScreen = document.getElementById('fit-screen');
const btnOriginal = document.getElementById('original');
const btnZoomOut = document.getElementById('zoom-out');
const btnZoomIn = document.getElementById('zoom-in');
const viewerContainer = document.getElementById('viewer-container');
const overlayContainer = document.getElementById('overlay-container');
const singleImg = document.getElementById('viewer');
const clickLeft = document.getElementById('click-left');
const clickRight = document.getElementById('click-right');
const zipInput = document.getElementById('zip-input');
const pickZipBtn = document.getElementById('pick-zip');
const btnHorizontalHover = document.getElementById('btn-horizontal-hover');
const btnVerticalHover = document.getElementById('btn-vertical-hover');
const pageInfo = document.getElementById('page-info');
const pageSelect = document.getElementById('page-select');

// 상태 변수
let files = [];
let currentIndex = 0;
let isWebtoonMode = false;
let displayMode = 'fit-screen';
let zoomFactor = 1;
let textMode = '가로'; // '가로', '세로', '호버' 3가지 상태로 관리
let isTextHidden = false;
let isToggling = false; // [추가] 모드 전환 중 레이아웃 팽창으로 인한 스크롤 꼬임 방지 락

// --- [추가] 웹툰 모드 최적화를 위한 상태 변수 ---
let webtoonObserver = null;
let pageTrackerObserver = null; // [추가] 현재 읽고 있는 페이지 추적용
const visibleWebtoonPages = new Set(); // 현재 화면에 가까이 있는 페이지 인덱스 추적

// 데이터 통합 저장소
let dataType = 'none'; // 'paddle' 또는 'mokuro'
let ocrDataMap = {};
let mokuroData = null;

// --- [추가] 화면 중앙을 기준으로 현재 읽고 있는 페이지 판별 옵저버 ---
function setupPageTrackerObserver() {
  if (pageTrackerObserver) {
    pageTrackerObserver.disconnect();
  }

  pageTrackerObserver = new IntersectionObserver(
    (entries) => {
      if (isToggling) return; // [핵심] 전환 중 요동치는 화면은 옵저버 감지 무시

      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const newIndex = parseInt(entry.target.dataset.index, 10);

          if (currentIndex !== newIndex) {
            currentIndex = newIndex;
            if (files.length > 0) {
              pageInfo.textContent = `${currentIndex + 1} / ${files.length}`;
              pageSelect.value = currentIndex;
            }
          }
        }
      });
    },
    { rootMargin: '-49% 0px -49% 0px' },
  );
}

// --- [추가] 화면 중앙을 기준으로 현재 읽고 있는 페이지 판별 옵저버 ---
function setupPageTrackerObserver() {
  if (pageTrackerObserver) {
    pageTrackerObserver.disconnect();
  }

  pageTrackerObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const newIndex = parseInt(entry.target.dataset.index, 10);

          // 값이 실제로 변경되었을 때만 UI 업데이트 (불필요한 업데이트 방지)
          if (currentIndex !== newIndex) {
            currentIndex = newIndex;
            if (files.length > 0) {
              pageInfo.textContent = `${currentIndex + 1} / ${files.length}`;
              pageSelect.value = currentIndex;
            }
          }
        }
      });
    },
    { rootMargin: '-49% 0px -49% 0px' },
  );
}
// --- [추가] 화면에 보이는 웹툰 페이지만 감지하는 옵저버 설정 ---
function setupWebtoonObserver() {
  if (webtoonObserver) {
    webtoonObserver.disconnect();
  }

  webtoonObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const wrapper = entry.target;
        const idx = parseInt(wrapper.dataset.index, 10);
        const img = wrapper.querySelector('img');
        const overlay = wrapper.querySelector('.webtoon-overlay');

        if (entry.isIntersecting) {
          visibleWebtoonPages.add(idx);
          tryDrawWebtoonText(idx, img, overlay);
        } else {
          visibleWebtoonPages.delete(idx);
          overlay.innerHTML = '';
        }
      });
    },
    { rootMargin: '200% 0px' },
  );
}

singleImg.addEventListener('load', () => {
  renderTextBoxes(isTextHidden);
});

function applyTextOpacity() {
  const singleContainer = document.getElementById('overlay-container');
  const webtoonContainers = document.querySelectorAll('.webtoon-overlay');
  //const isHidden = textOpacity === 0;
  const isHidden = textMode === '호버';

  const toggleClass = (el) => {
    if (!el) return;
    if (isHidden) el.classList.add('hide-mode');
    else el.classList.remove('hide-mode');
  };

  toggleClass(singleContainer);
  webtoonContainers.forEach((el) => toggleClass(el));
}

function applyStyles(img) {
  img.style.display = 'block';
  img.style.margin = '0 auto';
  if (displayMode === 'fit-width') {
    img.style.width = `${zoomFactor * 100}%`;
    img.style.height = 'auto';
  } else if (displayMode === 'fit-screen') {
    img.style.width = 'auto';
    img.style.height = `${zoomFactor * 100}vh`;
  } else if (displayMode === 'default') {
    const isPortrait = img.naturalHeight > img.naturalWidth;
    if (isPortrait) {
      img.style.width = 'auto';
      img.style.height = `${zoomFactor * 100}vh`;
    } else {
      img.style.width = `${zoomFactor * 100}%`;
      img.style.height = 'auto';
    }
  } else {
    const w = img.naturalWidth * zoomFactor;
    img.style.width = `${w}px`;
    img.style.height = 'auto';
  }
}

function updateAllStyles() {
  viewerContainer.querySelectorAll('img').forEach((img) => {
    if (img.complete) applyStyles(img);
    else img.onload = () => applyStyles(img);
  });
  renderTextBoxes(isTextHidden);
  applyTextOpacity();
}

function render() {
  viewerContainer.querySelectorAll('img').forEach((n) => n.remove());
  viewerContainer
    .querySelectorAll('.webtoon-wrapper')
    .forEach((n) => n.remove());

  if (isWebtoonMode) {
    overlayContainer.innerHTML = '';

    // [추가] 웹툰 렌더링 시 옵저버 초기화
    setupWebtoonObserver();
    setupPageTrackerObserver();
    visibleWebtoonPages.clear();

    files.forEach((file, idx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'webtoon-wrapper';
      wrapper.dataset.index = idx;
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.className = 'webtoon-img';

      const localOverlay = document.createElement('div');
      localOverlay.className = 'webtoon-overlay';

      wrapper.appendChild(img);
      wrapper.appendChild(localOverlay);
      viewerContainer.appendChild(wrapper);

      img.onload = () => {
        applyStyles(img);
        tryDrawWebtoonText(idx, img, localOverlay);
      };

      // [추가] 래퍼 감시 시작
      webtoonObserver.observe(wrapper);
      pageTrackerObserver.observe(wrapper); // [추가] 감시 대상에 등록
    });
  } else {
    if (pageTrackerObserver) pageTrackerObserver.disconnect(); // [추가] 단일 모드일 때 해제
    singleImg.onload = () => {
      updateAllStyles();
    };
    singleImg.src = URL.createObjectURL(files[currentIndex]);
    viewerContainer.appendChild(singleImg);
  }

  btnPrev.style.display = isWebtoonMode ? 'none' : '';
  btnNext.style.display = isWebtoonMode ? 'none' : '';

  if (files.length > 0) {
    pageInfo.textContent = `${currentIndex + 1} / ${files.length}`;
    pageSelect.value = currentIndex;
  } else {
    pageInfo.textContent = '0 / 0';
  }
}

function prevImage() {
  if (!isWebtoonMode && files.length) {
    currentIndex = (currentIndex - 1 + files.length) % files.length;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    render();
  }
}
function nextImage() {
  if (!isWebtoonMode && files.length) {
    currentIndex = (currentIndex + 1) % files.length;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    render();
  }
}

function resetZoom() {
  zoomFactor = 1;
}

// 확장자명 기반 통합 파싱 함수
function processParsedData(parsed, fileName = '') {
  const ext = fileName.split('.').pop().toLowerCase();

  if (ext === 'mokuro') {
    mokuroData = parsed;
    dataType = 'mokuro';
  } else if (ext === 'paddle' || ext === 'json') {
    if (Array.isArray(parsed)) {
      const baseName =
        fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
      ocrDataMap[baseName] = parsed;
    } else {
      Object.assign(ocrDataMap, parsed);
    }
    dataType = 'paddle';
  }
}

// 3. ZIP 파일 처리
pickZipBtn.addEventListener('click', () => zipInput.click());
zipInput.addEventListener('change', async (e) => {
  const zipFile = e.target.files[0];
  if (!zipFile) return;

  const zip = await JSZip.loadAsync(zipFile);
  const imgEntries = [];
  ocrDataMap = {};
  mokuroData = null;
  const dataPromises = [];

  zip.forEach((_, entry) => {
    if (/\.(jpe?g|png|gif|bmp|webp)$/i.test(entry.name)) {
      imgEntries.push(entry);
    } else if (/\.(json|mokuro|paddle)$/i.test(entry.name)) {
      dataPromises.push(
        entry.async('string').then((txt) => {
          try {
            const parsed = JSON.parse(txt);
            const fileName = entry.name.split('/').pop();
            processParsedData(parsed, fileName);
          } catch (e) {}
        }),
      );
    }
  });

  await Promise.all(dataPromises);

  const imageFiles = await Promise.all(
    imgEntries.map((entry) =>
      entry
        .async('blob')
        .then((blob) => new File([blob], entry.name, { type: blob.type })),
    ),
  );
  files = imageFiles.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );

  enableControls();
  updatePageOptions();
  currentIndex = 0;
  resetZoom();
  render();
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

  const controls = document.querySelector('.controls');
  if (controls) controls.classList.add('hidden');
  const menuList = document.getElementById('menu-list');
  if (menuList) menuList.classList.add('hidden-menu');
});

function enableControls() {
  [
    toggleBtn,
    btnPrev,
    btnNext,
    btnFitWidth,
    btnFitScreen,
    btnOriginal,
    btnZoomOut,
    btnZoomIn,
  ].forEach((btn) => (btn.disabled = false));
}

// UI 컨트롤 이벤트
toggleBtn.addEventListener('click', () => {
  if (isToggling) return; // 전환 중 중복 클릭 방지

  let targetIndex = currentIndex;

  // 웹툰 모드 -> 단일 모드: 현재 화면 최상단 페이지 추적
  if (isWebtoonMode) {
    const wrappers = viewerContainer.querySelectorAll('.webtoon-wrapper');
    for (let wrapper of wrappers) {
      if (wrapper.getBoundingClientRect().bottom > 0) {
        targetIndex = parseInt(wrapper.dataset.index, 10);
        break;
      }
    }
  }

  isWebtoonMode = !isWebtoonMode;
  toggleBtn.textContent = isWebtoonMode ? '단일모드로 전환' : '웹툰모드 켜기';

  isToggling = true; // [추가] 렌더링 팽창 감지 차단 시작
  render();

  if (isWebtoonMode) {
    window.scrollTo(0, 0);

    let anchorAttempts = 0;
    // 이미지가 비동기 로딩되며 세로로 팽창할 때 스크롤이 밀리는 현상 완벽 방어
    // 50ms마다 총 15번(750ms) 타겟 페이지를 지속적으로 화면 맨 위로 고정시킵니다.
    const anchorInterval = setInterval(() => {
      const wrappers = viewerContainer.querySelectorAll('.webtoon-wrapper');
      if (wrappers[targetIndex]) {
        wrappers[targetIndex].scrollIntoView({
          behavior: 'auto',
          block: 'start',
        });
      }

      anchorAttempts++;
      if (anchorAttempts >= 15) {
        clearInterval(anchorInterval);

        // 팽창이 끝난 후 깔끔하게 최종 번호 UI 업데이트 및 락 해제
        currentIndex = targetIndex;
        if (files.length > 0) {
          pageInfo.textContent = `${currentIndex + 1} / ${files.length}`;
          pageSelect.value = currentIndex;
        }
        isToggling = false;
      }
    }, 50);
  } else {
    // 단일 모드로 복귀 시 상태 복구 및 스크롤 초기화
    currentIndex = targetIndex;
    if (files.length > 0) {
      pageInfo.textContent = `${currentIndex + 1} / ${files.length}`;
      pageSelect.value = currentIndex;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    setTimeout(() => {
      isToggling = false;
    }, 100);
  }
});

// [추가] 줌 배율 적용 및 스크롤 위치를 보정하는 통합 함수
function applyZoom(multiplier) {
  let currentWrapper = null;

  // 웹툰 모드일 때 화면 상단(bottom > 0)에 가장 먼저 걸쳐있는 페이지 요소 찾기
  if (isWebtoonMode) {
    const wrappers = viewerContainer.querySelectorAll('.webtoon-wrapper');
    for (let wrapper of wrappers) {
      if (wrapper.getBoundingClientRect().bottom > 0) {
        currentWrapper = wrapper;
        break;
      }
    }
  }

  zoomFactor *= multiplier;
  updateAllStyles();

  // 웹툰 모드라면 찾은 페이지의 맨 위로 즉시 스크롤
  if (isWebtoonMode && currentWrapper) {
    currentWrapper.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
}

btnPrev.addEventListener('click', prevImage);
btnNext.addEventListener('click', nextImage);
btnFitWidth.addEventListener('click', () => {
  displayMode = 'fit-width';
  resetZoom();
  updateAllStyles();
});
btnFitScreen.addEventListener('click', () => {
  displayMode = 'fit-screen';
  resetZoom();
  updateAllStyles();
});
btnOriginal.addEventListener('click', () => {
  displayMode = 'original';
  resetZoom();
  updateAllStyles();
});
btnZoomIn.addEventListener('click', () => applyZoom(1.1));
btnZoomOut.addEventListener('click', () => applyZoom(0.9));

clickLeft.addEventListener('click', (e) => {
  e.stopPropagation();
  nextImage();
  updateAllStyles();
});
clickRight.addEventListener('click', (e) => {
  e.stopPropagation();
  prevImage();
  updateAllStyles();
});

viewerContainer.addEventListener('wheel', (e) => {
  if (!e.shiftKey) return;
  e.preventDefault();
  if (e.deltaY < 0) applyZoom(1.1);
  else if (e.deltaY > 0) applyZoom(0.9);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.key === ' ') {
    if (
      document.activeElement.tagName === 'INPUT' ||
      document.activeElement.tagName === 'TEXTAREA'
    )
      return;
    e.preventDefault();
    btnHorizontalHover.click();
    return;
  }
  // [추가] 'w' 또는 'W' 키를 누르면 웹툰 모드 토글
  if (e.key.toLowerCase() === 'w') {
    toggleBtn.click();
    return;
  }

  // 줌 단축키 로직 교체
  if (e.key === '+' || e.key === '=') {
    applyZoom(1.1);
  } else if (e.key === '-') {
    applyZoom(0.9);
  } else if (e.key === 'ArrowLeft') nextImage();
  else if (e.key === 'ArrowRight') prevImage();
});

// 공용 Helper 함수
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function mergeBlockLines(block) {
  if (!block || !Array.isArray(block.lines)) return '';
  return block.lines
    .map((t) => String(t ?? '').replace(/[．.]{2,}/g, '.'))
    .join('');
}
function getPolygonBounds(coords) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  coords.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
function fixVerticalLineCoords(block) {
  const coords = JSON.parse(JSON.stringify(block.lines_coords));
  if (!block.vertical || coords.length < 2) return coords;
  const minYs = coords.map((line) => Math.min(...line.map((p) => p[1])));
  const blockTop = Math.min(...minYs);
  const TOLERANCE = 30;
  return coords.map((line, i) => {
    const currentMinY = minYs[i];
    if (Math.abs(currentMinY - blockTop) < TOLERANCE) {
      const diff = currentMinY - blockTop;
      return line.map(([x, y]) => [x, y - diff]);
    }
    return line;
  });
}
function calculateDynamicFontSizeCap(blocks) {
  const fontSizes = blocks.map((block) => block.font_size);
  const sortedSizes = [...fontSizes].sort((a, b) => a - b);
  let median =
    sortedSizes.length % 2 === 0
      ? sortedSizes[sortedSizes.length / 2 - 1]
      : sortedSizes[Math.floor(sortedSizes.length / 2)];
  return Math.max(median * 1.2, 10);
}

// 통합 렌더링 라우터
function drawPageText(pageIndex, imgEl, targetLayer) {
  if (isTextHidden) return;
  if (dataType === 'paddle') drawPaddleText(pageIndex, imgEl, targetLayer);
  else if (dataType === 'mokuro') drawMokuroText(pageIndex, imgEl, targetLayer);
}

// Paddle 방식 텍스트 그리기 로직
function drawPaddleText(pageIndex, imgEl, targetLayer) {
  const file = files[pageIndex];
  if (!file || imgEl.naturalWidth === 0) return;

  const fileName = file.name;
  const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
  let pageData =
    ocrDataMap[fileName] ||
    ocrDataMap[baseName] ||
    ocrDataMap[baseName + '_simple'] ||
    ocrDataMap['single_file_fallback'];

  if (!pageData || !Array.isArray(pageData) || pageData.length === 0) return;

  const imgRect = imgEl.getBoundingClientRect();
  const layerRect = targetLayer.getBoundingClientRect();
  const offsetX = imgRect.left - layerRect.left;
  const offsetY = imgRect.top - layerRect.top;
  const scale = imgEl.clientWidth / imgEl.naturalWidth;

  pageData.forEach((block) => {
    if (block.label === 'image' || !block.content) return;

    const [xmin, ymin, xmax, ymax] = block.bbox;
    const bx1 = Math.max(xmin, 0);
    const by1 = Math.max(ymin, 0);
    const bx2 = Math.min(xmax, imgEl.naturalWidth);
    const by2 = Math.min(ymax, imgEl.naturalHeight);

    const bgLeft = offsetX + bx1 * scale;
    const bgTop = offsetY + by1 * scale;
    const bgWidth = (bx2 - bx1) * scale;
    const bgHeight = (by2 - by1) * scale;

    let expandedWidth = bgWidth * 1.1;
    let expandedLeft = bgLeft - bgWidth * 0.05;

    // 가로모드 또는 세로모드일 때 너비 2% 추가
    if (textMode === '가로' || textMode === '세로') {
      expandedWidth = bgWidth * 1.12;
      expandedLeft = bgLeft - bgWidth * 0.06;
    }

    const bgBox = document.createElement('div');
    bgBox.className = 'bg-box';
    bgBox.style.left = `${expandedLeft}px`;
    bgBox.style.top = `${bgTop}px`;
    bgBox.style.width = `${expandedWidth}px`;
    bgBox.style.height = `${bgHeight}px`;
    targetLayer.appendChild(bgBox);

    const textBox = document.createElement('div');
    textBox.className = 'line-box';

    if (textMode === '가로') {
      textBox.classList.add('translated');
    }

    // 세로모드이거나 호버모드이면서 vertical_text일 때 세로쓰기 적용
    if (
      (textMode === '세로' || textMode === '호버') &&
      block.label === 'vertical_text'
    ) {
      textBox.classList.add('vertical');
      textBox.style.display = 'block';
    }

    textBox.style.left = `${expandedLeft}px`;
    textBox.style.top = `${bgTop}px`;
    textBox.style.width = `${expandedWidth}px`;
    textBox.style.height = `${bgHeight}px`;
    textBox.style.padding = '0';
    textBox.style.lineHeight = '1.0';

    textBox.style.whiteSpace = 'pre-wrap';
    textBox.style.wordBreak = 'break-all';
    textBox.style.lineBreak = 'anywhere';

    const sanitizedContent = block.content.replace(/\n/g, '');
    const textLen = sanitizedContent.length;
    let computedFontSize =
      textLen > 0 ? Math.sqrt((bgWidth * bgHeight) / textLen) * 0.9 : 1;

    textBox.style.fontSize = `${computedFontSize}px`;

    textBox.addEventListener('click', (e) => {
      e.stopPropagation();
      document
        .querySelectorAll('.line-box.selected')
        .forEach((b) => b.classList.remove('selected'));
      textBox.classList.add('selected');

      // 호버 모드일 때만 텍스트 복사
      if (textMode === '호버') navigator.clipboard.writeText(sanitizedContent);
    });

    textBox.textContent = sanitizedContent;
    targetLayer.appendChild(textBox);
  });
}

// Mokuro 방식 텍스트 그리기 로직 (Paddle 방식과 동일하게 통합)
function drawMokuroText(pageIndex, imgEl, targetLayer) {
  if (!mokuroData || !mokuroData.pages) return;
  const page = mokuroData.pages[pageIndex];
  if (
    !page ||
    !page.blocks ||
    page.blocks.length === 0 ||
    imgEl.naturalWidth === 0
  )
    return;

  const imgRect = imgEl.getBoundingClientRect();
  const layerRect = targetLayer.getBoundingClientRect();
  const offsetX = imgRect.left - layerRect.left;
  const offsetY = imgRect.top - layerRect.top;
  const scale = imgEl.clientWidth / imgEl.naturalWidth;

  page.blocks.forEach((block) => {
    if (!block.lines || !block.lines_coords) return;
    const correctedCoords = fixVerticalLineCoords(block);

    let bMinX = Infinity,
      bMinY = Infinity,
      bMaxX = -Infinity,
      bMaxY = -Infinity;
    correctedCoords.forEach((line) => {
      line.forEach(([x, y]) => {
        if (x < bMinX) bMinX = x;
        if (x > bMaxX) bMaxX = x;
        if (y < bMinY) bMinY = y;
        if (y > bMaxY) bMaxY = y;
      });
    });

    const bx1 = clamp(bMinX, 0, imgEl.naturalWidth);
    const by1 = clamp(bMinY, 0, imgEl.naturalHeight);
    const bx2 = clamp(bMaxX, 0, imgEl.naturalWidth);
    const by2 = clamp(bMaxY, 0, imgEl.naturalHeight);

    const bgLeft = offsetX + bx1 * scale;
    const bgTop = offsetY + by1 * scale;
    const bgWidth = (bx2 - bx1) * scale;
    const bgHeight = (by2 - by1) * scale;

    let expandedWidth = bgWidth * 1.1;
    let expandedLeft = bgLeft - bgWidth * 0.05;

    // 가로모드 또는 세로모드일 때 너비 2% 추가
    if (textMode === '가로' || textMode === '세로') {
      expandedWidth = bgWidth * 1.12;
      expandedLeft = bgLeft - bgWidth * 0.06;
    }

    const bgBox = document.createElement('div');
    bgBox.className = 'bg-box';
    bgBox.style.left = `${expandedLeft}px`;
    bgBox.style.top = `${bgTop}px`;
    bgBox.style.width = `${expandedWidth}px`;
    bgBox.style.height = `${bgHeight}px`;
    targetLayer.appendChild(bgBox);

    // 여러 줄의 텍스트를 하나의 문자열로 병합
    let originalLines = Array.isArray(block.lines)
      ? block.lines.map((t) => String(t ?? '').replace(/[．.]{2,}/g, '.'))
      : [];
    const sanitizedContent = originalLines.join('').replace(/\n/g, '');
    if (!sanitizedContent) return;

    const textBox = document.createElement('div');
    textBox.className = 'line-box';

    if (textMode === '가로') {
      textBox.classList.add('translated');
    }

    // 세로모드이거나 호버모드이면서 vertical일 때 세로쓰기 적용
    if ((textMode === '세로' || textMode === '호버') && block.vertical) {
      textBox.classList.add('vertical');
      textBox.style.display = 'block';
    }

    textBox.style.left = `${expandedLeft}px`;
    textBox.style.top = `${bgTop}px`;
    textBox.style.width = `${expandedWidth}px`;
    textBox.style.height = `${bgHeight}px`;
    textBox.style.padding = '0';
    textBox.style.lineHeight = '1.0';

    textBox.style.whiteSpace = 'pre-wrap';
    textBox.style.wordBreak = 'break-all';
    textBox.style.lineBreak = 'anywhere';

    // Paddle 방식과 동일한 폰트 사이즈 계산 로직 적용
    const textLen = sanitizedContent.length;
    let computedFontSize =
      textLen > 0 ? Math.sqrt((bgWidth * bgHeight) / textLen) * 0.9 : 1;

    textBox.style.fontSize = `${computedFontSize}px`;

    textBox.addEventListener('click', (e) => {
      e.stopPropagation();
      document
        .querySelectorAll('.line-box.selected')
        .forEach((b) => b.classList.remove('selected'));
      textBox.classList.add('selected');

      // 호버 모드일 때 텍스트 복사
      if (textMode === '호버') navigator.clipboard.writeText(sanitizedContent);
    });

    textBox.textContent = sanitizedContent;
    targetLayer.appendChild(textBox);
  });
}

function renderTextBoxes(isTextHidden) {
  if (isWebtoonMode) {
    const wrappers = viewerContainer.querySelectorAll('.webtoon-wrapper');
    wrappers.forEach((wrapper) => {
      const idx = parseInt(wrapper.dataset.index, 10);
      const img = wrapper.querySelector('img');
      const overlay = wrapper.querySelector('.webtoon-overlay');

      if (img && overlay) {
        overlay.innerHTML = ''; // 초기화

        // [수정] 현재 화면 안에 들어온 상태일 때만 생성
        if (!isTextHidden && visibleWebtoonPages.has(idx)) {
          drawPageText(idx, img, overlay);
        }
      }
    });
    applyTextOpacity();
    return;
  }

  // 단일모드 부분은 기존과 동일
  overlayContainer.innerHTML = '';
  if (isTextHidden) return;

  const unifiedLayer = document.createElement('div');
  unifiedLayer.style.position = 'absolute';
  unifiedLayer.style.top = '0';
  unifiedLayer.style.left = '0';
  unifiedLayer.style.width = '100%';
  unifiedLayer.style.height = '100%';
  overlayContainer.appendChild(unifiedLayer);

  drawPageText(currentIndex, singleImg, unifiedLayer);
  applyTextOpacity();
}

const hideButton = document.getElementById('toggle-controls-btn');
const controls = document.querySelector('.controls');
let isHidden = false;
hideButton.addEventListener('click', () => {
  isHidden = !isHidden;
  controls.classList.toggle('hidden', isHidden);
});

const hideTextButton = document.getElementById('toggle-text-btn');
hideTextButton.addEventListener('click', () => {
  isTextHidden = !isTextHidden;
  updateAllStyles();
  hideTextButton.textContent = isTextHidden ? '제거' : '생성';
});

// 1. 가로모드 ↔ 호버모드 토글 버튼
btnHorizontalHover.addEventListener('click', () => {
  textMode = textMode === '가로' ? '호버' : '가로';

  btnHorizontalHover.textContent =
    textMode === '가로' ? '가로모드' : '호버모드';
  btnVerticalHover.textContent = '세로모드'; // 반대편 버튼 텍스트 초기화

  applyTextOpacity();
  renderTextBoxes(isTextHidden);
});

// 2. 세로모드 ↔ 호버모드 토글 버튼
btnVerticalHover.addEventListener('click', () => {
  textMode = textMode === '세로' ? '호버' : '세로';

  btnVerticalHover.textContent = textMode === '세로' ? '세로모드' : '호버모드';
  btnHorizontalHover.textContent = '가로모드'; // 반대편 버튼 텍스트 초기화

  applyTextOpacity();
  renderTextBoxes(isTextHidden);
});

document.body.addEventListener('click', () => {
  document
    .querySelectorAll('.line-box.selected')
    .forEach((box) => box.classList.remove('selected'));
  const selection = window.getSelection();
  if (selection) selection.removeAllRanges();
});

const menuToggleBtn = document.getElementById('menu-toggle-btn');
const menuList = document.getElementById('menu-list');
const uicontrols = document.querySelector('.controls');

menuToggleBtn.addEventListener('click', () => {
  const isMenuHidden = menuList.classList.toggle('hidden-menu');
  if (isMenuHidden) uicontrols.classList.add('hidden');
  else uicontrols.classList.remove('hidden');
});

function updatePageOptions() {
  pageSelect.innerHTML = '';
  if (files.length === 0) {
    const opt = document.createElement('option');
    opt.text = '파일 없음';
    pageSelect.appendChild(opt);
    return;
  }
  files.forEach((file, index) => {
    const opt = document.createElement('option');
    opt.value = index;
    opt.text = `${index + 1} 페이지`;
    pageSelect.appendChild(opt);
  });
}

pageSelect.addEventListener('change', (e) => {
  const selectedIndex = parseInt(e.target.value, 10);
  if (
    !isNaN(selectedIndex) &&
    selectedIndex >= 0 &&
    selectedIndex < files.length
  ) {
    currentIndex = selectedIndex;
    if (isWebtoonMode) {
      const images = viewerContainer.querySelectorAll('img');
      if (images[currentIndex])
        images[currentIndex].scrollIntoView({
          behavior: 'auto',
          block: 'start',
        });
      pageInfo.textContent = `${currentIndex + 1} / ${files.length}`;
    } else {
      render();
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }
});

document.addEventListener(
  'dblclick',
  function (event) {
    event.preventDefault();
  },
  { passive: false },
);

function tryDrawWebtoonText(idx, img, overlay) {
  // 숨김 상태, 화면 밖, 이미 그려짐, 이미지 로딩 안 됨 상태면 취소
  if (isTextHidden || !visibleWebtoonPages.has(idx) || overlay.innerHTML !== '')
    return;
  if (!img.complete || img.naturalWidth === 0) return;

  // DOM 렌더링 직후라 너비가 0인 경우 50ms 후 재시도
  if (img.clientWidth === 0) {
    setTimeout(() => tryDrawWebtoonText(idx, img, overlay), 50);
    return;
  }

  drawPageText(idx, img, overlay);
  applyTextOpacity();
}
