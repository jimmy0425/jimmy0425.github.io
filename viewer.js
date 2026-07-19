// 요소 가져오기
const pickBtn = document.getElementById('pick-folder');
const fileInput = document.getElementById('folder-input');
const loadJsonBtn = document.getElementById('load-json');
const jsonInput = document.getElementById('json-input');
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
const btnOpacity = document.getElementById('opacity-btn');
const pageInfo = document.getElementById('page-info');
const pageSelect = document.getElementById('page-select');

// 상태 변수
let files = [];
let currentIndex = 0;
let isWebtoonMode = false;
let displayMode = 'default';
let zoomFactor = 1;
let textOpacity = 1.0;
let isTextHidden = false;

// 데이터 통합 저장소
let dataType = 'none'; // 'paddle' 또는 'mokuro'
let ocrDataMap = {};
let mokuroData = null;

singleImg.addEventListener('load', () => {
  renderTextBoxes(isTextHidden);
});

function applyTextOpacity() {
  const singleContainer = document.getElementById('overlay-container');
  const webtoonContainers = document.querySelectorAll('.webtoon-overlay');
  const isHidden = textOpacity === 0;

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
    files.forEach((file, idx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'webtoon-wrapper';

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
        drawPageText(idx, img, localOverlay);
        applyTextOpacity();
      };
    });
  } else {
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

// 1. 폴더 및 파일 읽기
pickBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const allFiles = Array.from(fileInput.files);
  files = allFiles
    .filter((f) => /\.(jpe?g|png|gif|bmp|webp)$/i.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  if (!files.length) {
    alert('이미지 파일이 없습니다.');
    return;
  }

  const dataFiles = allFiles.filter((f) =>
    /\.(json|mokuro|paddle)$/i.test(f.name),
  );
  ocrDataMap = {};
  mokuroData = null;

  for (const file of dataFiles) {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      processParsedData(parsed, file.name);
    } catch (e) {
      console.error('Data parsing error', e);
    }
  }

  enableControls();
  updatePageOptions();
  resetZoom();
  currentIndex = 0;
  render();
});

// 2. 단일 데이터 파일 읽기 (.json, .mokuro, .paddle)
loadJsonBtn.addEventListener('click', () => jsonInput.click());
jsonInput.addEventListener('change', () => {
  const file = jsonInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      processParsedData(parsed, file.name);
      render();
    } catch (e) {
      console.error('Invalid Data file:', e);
    }
  };
  reader.readAsText(file);
});

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
  isWebtoonMode = !isWebtoonMode;
  toggleBtn.textContent = isWebtoonMode ? '단일모드로 전환' : '웹툰모드 켜기';
  render();
});

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
btnZoomIn.addEventListener('click', () => {
  zoomFactor *= 1.1;
  updateAllStyles();
});
btnZoomOut.addEventListener('click', () => {
  zoomFactor *= 0.9;
  updateAllStyles();
});

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
  if (e.deltaY < 0) zoomFactor *= 1.1;
  else if (e.deltaY > 0) zoomFactor *= 0.9;
  updateAllStyles();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.key === ' ') {
    if (
      document.activeElement.tagName === 'INPUT' ||
      document.activeElement.tagName === 'TEXTAREA'
    )
      return;
    e.preventDefault();
    btnOpacity.click();
    return;
  }
  if (e.key === '+' || e.key === '=') {
    zoomFactor *= 1.1;
    updateAllStyles();
  } else if (e.key === '-') {
    zoomFactor *= 0.9;
    updateAllStyles();
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

    const expandedWidth = bgWidth * 1.1;
    const expandedLeft = bgLeft - bgWidth * 0.05;

    const bgBox = document.createElement('div');
    bgBox.className = 'bg-box';
    bgBox.style.left = `${expandedLeft}px`;
    bgBox.style.top = `${bgTop}px`;
    bgBox.style.width = `${expandedWidth}px`;
    bgBox.style.height = `${bgHeight}px`;
    targetLayer.appendChild(bgBox);

    const textBox = document.createElement('div');
    textBox.className = 'line-box';
    if (textOpacity === 1) {
      textBox.classList.add('translated');
    }

    // 💡 [수정된 부분] 세로쓰기일 경우, Flexbox 환경에서 줄바꿈이 무시되는 브라우저 이슈 방지
    if (block.label === 'vertical_text') {
      textBox.classList.add('vertical');
      textBox.style.display = 'block'; // 강제로 블록 요소로 변경하여 줄바꿈 유도
    }

    textBox.style.left = `${expandedLeft}px`;
    textBox.style.top = `${bgTop}px`;
    textBox.style.width = `${expandedWidth}px`;
    textBox.style.height = `${bgHeight}px`;
    textBox.style.padding = '0';
    textBox.style.lineHeight = '1.0';

    // 💡 [수정된 부분] 박스 영역을 벗어나면 무조건 강제로 줄바꿈되도록 속성 세팅
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
      if (textOpacity === 0) navigator.clipboard.writeText(sanitizedContent);
    });

    textBox.textContent = sanitizedContent;
    targetLayer.appendChild(textBox);
  });
}

// Mokuro 방식 텍스트 그리기 로직
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
  const fontSizeCap = calculateDynamicFontSizeCap(page.blocks);

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

    const expandedWidth = bgWidth * 1.1;
    const expandedLeft = bgLeft - bgWidth * 0.05;

    const bgBox = document.createElement('div');
    bgBox.className = 'bg-box';
    bgBox.style.left = `${expandedLeft}px`;
    bgBox.style.top = `${bgTop}px`;
    bgBox.style.width = `${expandedWidth}px`;
    bgBox.style.height = `${bgHeight}px`;
    targetLayer.appendChild(bgBox);

    const isTranslatedView = textOpacity === 1;

    if (!isTranslatedView) {
      block.lines.forEach((rawLineText, index) => {
        const lineText = String(rawLineText ?? '').replace(/[．.]{2,}/g, '.');
        const coords = correctedCoords[index];
        const bounds = getPolygonBounds(coords);

        const lLeft = offsetX + clamp(bounds.x, 0, imgEl.naturalWidth) * scale;
        const lTop = offsetY + clamp(bounds.y, 0, imgEl.naturalHeight) * scale;
        const lWidth = bounds.w * scale;
        const lHeight = bounds.h * scale;

        const textBox = document.createElement('div');
        textBox.className = 'line-box';
        if (block.vertical) textBox.classList.add('vertical');
        textBox.style.left = `${lLeft}px`;
        textBox.style.top = `${lTop}px`;
        textBox.style.minWidth = `${lWidth}px`;
        textBox.style.minHeight = `${lHeight}px`;

        if (block.font_size) {
          const capped = fontSizeCap
            ? Math.min(block.font_size, fontSizeCap)
            : block.font_size;
          textBox.style.fontSize = `${Math.max(1, Math.floor(capped * scale * 0.98))}px`;
        } else {
          const tSize = block.vertical ? bounds.w * scale : bounds.h * scale;
          textBox.style.fontSize = `${tSize * 0.95}px`;
        }

        textBox.addEventListener('click', (e) => {
          e.stopPropagation();
          document
            .querySelectorAll('.line-box.selected')
            .forEach((b) => b.classList.remove('selected'));
          textBox.classList.add('selected');
          if (textOpacity === 0) navigator.clipboard.writeText(lineText);
        });
        textBox.textContent = lineText;
        targetLayer.appendChild(textBox);
      });
    } else {
      let originalLines = Array.isArray(block.lines)
        ? block.lines.map((t) => String(t ?? '').replace(/[．.]{2,}/g, '.'))
        : [];
      const mergedText = originalLines.join('').replace(/\n/g, '');
      if (!mergedText) return;

      const textBox = document.createElement('div');
      textBox.className = 'line-box translated';
      textBox.style.left = `${expandedLeft}px`;
      textBox.style.top = `${bgTop}px`;
      textBox.style.width = `${expandedWidth}px`;
      textBox.style.height = `${bgHeight}px`;
      textBox.style.padding = '0';
      textBox.style.lineHeight = '1.0';
      textBox.style.wordBreak = 'break-all';

      const textLen = mergedText.length;
      let computedFontSize =
        textLen > 0 ? Math.sqrt((bgWidth * bgHeight) / textLen) * 0.9 : 1;
      textBox.style.fontSize = `${computedFontSize}px`;

      textBox.addEventListener('click', (e) => {
        e.stopPropagation();
        document
          .querySelectorAll('.line-box.selected')
          .forEach((b) => b.classList.remove('selected'));
        textBox.classList.add('selected');
      });
      textBox.textContent = mergedText;
      targetLayer.appendChild(textBox);
    }
  });
}

function renderTextBoxes(isTextHidden) {
  if (isWebtoonMode) {
    const wrappers = viewerContainer.querySelectorAll('.webtoon-wrapper');
    wrappers.forEach((wrapper, idx) => {
      const img = wrapper.querySelector('img');
      const overlay = wrapper.querySelector('.webtoon-overlay');
      if (img && overlay) {
        overlay.innerHTML = '';
        if (!isTextHidden) drawPageText(idx, img, overlay);
      }
    });
    applyTextOpacity();
    return;
  }
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

btnOpacity.addEventListener('click', () => {
  const steps = [1.0, 0.0];
  const idx = steps.indexOf(textOpacity);
  textOpacity = steps[(idx + 1) % steps.length];
  applyTextOpacity();
  btnOpacity.textContent = textOpacity === 0 ? '안보임' : '보임';
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
