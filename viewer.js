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
let textMode = '가로';
let isTextHidden = false;
let isToggling = false;

let webtoonObserver = null;
let pageTrackerObserver = null;
const visibleWebtoonPages = new Set();

// 데이터 통합 저장소
let dataType = 'none';
let ocrDataMap = {};
let mokuroData = null;

function setupPageTrackerObserver() {
  if (pageTrackerObserver) {
    pageTrackerObserver.disconnect();
  }

  pageTrackerObserver = new IntersectionObserver(
    (entries) => {
      if (isToggling) return;

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
          wrapper.style.height = 'auto'; // 화면에 보일 때는 이미지 크기에 맞춰 자동 조절

          if (!img.src || img.src === window.location.href || img.src === '') {
            img.src = URL.createObjectURL(files[idx]);
          } else if (img.complete) {
            tryDrawWebtoonText(idx, img, overlay);
          }
        } else {
          visibleWebtoonPages.delete(idx);
          if (img.src && img.src.startsWith('blob:')) {
            wrapper.style.height = `${wrapper.clientHeight}px`; // 화면에서 벗어나 이미지 해제 전, 스크롤 튐 방지를 위해 현재 높이 고정
            URL.revokeObjectURL(img.src);
            img.removeAttribute('src');
          }
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
    if (img.complete && img.src && img.src.startsWith('blob:')) {
      applyStyles(img);
    }
  });
  
  // 브라우저가 이미지 크기(layout)를 완전히 줄인 후 텍스트 박스를 그리도록 동기화
  requestAnimationFrame(() => {
    renderTextBoxes(isTextHidden);
    applyTextOpacity();
  });
}

function render() {
  viewerContainer.querySelectorAll('img').forEach((img) => {
    if (img.src && img.src.startsWith('blob:')) {
      URL.revokeObjectURL(img.src);
    }
    img.remove();
  });
  viewerContainer
    .querySelectorAll('.webtoon-wrapper')
    .forEach((n) => n.remove());

  if (isWebtoonMode) {
    overlayContainer.innerHTML = '';
    setupWebtoonObserver();
    setupPageTrackerObserver();
    visibleWebtoonPages.clear();

    files.forEach((file, idx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'webtoon-wrapper';
      wrapper.dataset.index = idx;
      
      // 오버레이 기준점 및 정렬 완벽 고정
      wrapper.style.position = 'relative';
      wrapper.style.display = 'flex';
      wrapper.style.justifyContent = 'center';
      wrapper.style.alignItems = 'flex-start';
      wrapper.style.minHeight = '100vh';

      const img = document.createElement('img');
      img.className = 'webtoon-img';
      img.decoding = 'async';

      const localOverlay = document.createElement('div');
      localOverlay.className = 'webtoon-overlay';

      wrapper.appendChild(img);
      wrapper.appendChild(localOverlay);
      viewerContainer.appendChild(wrapper);

      img.onload = () => {
        applyStyles(img);
        wrapper.style.minHeight = '0';
        wrapper.style.height = 'auto'; 
        tryDrawWebtoonText(idx, img, localOverlay);
      };

      webtoonObserver.observe(wrapper);
      pageTrackerObserver.observe(wrapper);
    });
  } else {
    if (pageTrackerObserver) pageTrackerObserver.disconnect();
    singleImg.onload = () => {
      updateAllStyles();
    };
    singleImg.src = URL.createObjectURL(files[currentIndex]);
    viewerContainer.appendChild(singleImg);
  }

  btnPrev.style.display = isWebtoonMode ? 'none' : '';
  btnNext.style.display = isWebtoonMode ? 'none' : '';

  btnFitWidth.disabled = false;
  btnFitScreen.disabled = false;
  btnOriginal.disabled = false;

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

toggleBtn.addEventListener('click', () => {
  if (isToggling) return;

  let targetIndex = currentIndex;
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
  isToggling = true;

  if (isWebtoonMode) {
    displayMode = 'fit-width';
    zoomFactor = 1;
  }
  render();

  if (isWebtoonMode) {
    window.scrollTo(0, 0);

    let anchorAttempts = 0;
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
        currentIndex = targetIndex;
        if (files.length > 0) {
          pageInfo.textContent = `${currentIndex + 1} / ${files.length}`;
          pageSelect.value = currentIndex;
        }
        isToggling = false;
      }
    }, 50);
  } else {
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

function applyZoom(multiplier) {
  let currentWrapper = null;
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

  if (isWebtoonMode && currentWrapper) {
    requestAnimationFrame(() => {
      currentWrapper.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
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

  if (e.key === 'Tab') {
    e.preventDefault();
    menuToggleBtn.click();
    return;
  }

  if (e.key.toLowerCase() === 'h') {
    btnVerticalHover.click();
    return;
  }

  if (e.key.toLowerCase() === 'w') {
    toggleBtn.click();
    return;
  }

  if (e.key === '+' || e.key === '=') {
    applyZoom(1.1);
  } else if (e.key === '-') {
    applyZoom(0.9);
  } else if (e.key === 'ArrowLeft') nextImage();
  else if (e.key === 'ArrowRight') prevImage();
});

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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

function drawPageText(pageIndex, imgEl, targetLayer) {
  if (isTextHidden) return;
  if (dataType === 'paddle') drawPaddleText(pageIndex, imgEl, targetLayer);
  else if (dataType === 'mokuro') drawMokuroText(pageIndex, imgEl, targetLayer);
}

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

    const sanitizedContent = block.content.replace(/\n/g, ' ');
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

      if (textMode === '호버') navigator.clipboard.writeText(sanitizedContent);
    });

    const textSpan = document.createElement('span');
    textSpan.textContent = sanitizedContent;
    textBox.appendChild(textSpan);
    targetLayer.appendChild(textBox);
  });
}

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

    let originalLines = Array.isArray(block.lines)
      ? block.lines.map((t) => String(t ?? ''))
      : [];
    const sanitizedContent = originalLines.join(' ').replace(/\n/g, ' ');
    if (!sanitizedContent) return;

    const textBox = document.createElement('div');
    textBox.className = 'line-box';

    if (textMode === '가로') {
      textBox.classList.add('translated');
    }

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

      if (textMode === '호버') navigator.clipboard.writeText(sanitizedContent);
    });

    const textSpan = document.createElement('span');
    textSpan.textContent = sanitizedContent;
    textBox.appendChild(textSpan);
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
        overlay.innerHTML = '';

        if (img.clientWidth > 0 && img.clientHeight > 0) {
          overlay.style.position = 'absolute';
          overlay.style.width = `${img.clientWidth}px`;
          overlay.style.height = `${img.clientHeight}px`;
          overlay.style.left = `${img.offsetLeft}px`;
          overlay.style.top = `${img.offsetTop}px`;
          overlay.style.pointerEvents = 'none';
        }

        if (!isTextHidden && visibleWebtoonPages.has(idx)) {
          drawPageText(idx, img, overlay);
        }
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

btnHorizontalHover.addEventListener('click', () => {
  textMode = textMode === '가로' ? '호버' : '가로';
  btnHorizontalHover.textContent =
    textMode === '가로' ? '가로모드' : '호버모드';
  btnVerticalHover.textContent = '세로모드';
  applyTextOpacity();
  renderTextBoxes(isTextHidden);
});

btnVerticalHover.addEventListener('click', () => {
  textMode = textMode === '세로' ? '호버' : '세로';
  btnVerticalHover.textContent = textMode === '세로' ? '세로모드' : '호버모드';
  btnHorizontalHover.textContent = '가로모드';
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
  if (isTextHidden || !visibleWebtoonPages.has(idx) || overlay.innerHTML !== '')
    return;
  if (!img.complete || img.naturalWidth === 0) return;

  if (img.clientWidth === 0) {
    setTimeout(() => tryDrawWebtoonText(idx, img, overlay), 50);
    return;
  }

  overlay.style.position = 'absolute';
  overlay.style.width = `${img.clientWidth}px`;
  overlay.style.height = `${img.clientHeight}px`;
  overlay.style.left = `${img.offsetLeft}px`;
  overlay.style.top = `${img.offsetTop}px`;
  overlay.style.pointerEvents = 'none';

  drawPageText(idx, img, overlay);
  applyTextOpacity();
}

let resizeTimeout = null;
window.addEventListener('resize', () => {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    updateAllStyles();
  }, 100);
});