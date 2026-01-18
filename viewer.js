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

// ✅ 추가: 투명도 버튼 참조
const btnOpacity = document.getElementById('opacity-btn');

// ✅ 번역 보기용: 블록 내 여러 줄을 하나로 합치기 (줄바꿈 제거)
// - '.'/ '．'가 2개 이상 연속되면 1개로 줄여 OCR의 과도한 점(.)을 완화
function mergeBlockLines(block) {
  if (!block || !Array.isArray(block.lines)) return '';
  return block.lines.map((t) => String(t ?? '').replace(/[．.]{2,}/g, '.')).join('');
}

// 페이지 이동용으로 추가
const pageInfo = document.getElementById('page-info');
const pageInput = document.getElementById('page-input');
const goPageBtn = document.getElementById('go-page-btn');

singleImg.addEventListener('load', () => {
  // 이미지가 화면에 완전히 렌더링된 뒤 텍스트박스 그리기
  renderTextBoxes(isTextHidden);
});

// ✅ 추가: 텍스트 박스 투명도 상태
let textOpacity = 1.0; // 1.0=100%, 0.0=0%

// [수정된 투명도 적용 함수]
function applyTextOpacity() {
  // 1. 단일 모드 오버레이
  const singleContainer = document.getElementById('overlay-container');
  // 2. 웹툰 모드 오버레이들 (현재 렌더링된 모든 것)
  const webtoonContainers = document.querySelectorAll('.webtoon-overlay');

  const isHidden = textOpacity === 0;

  // 헬퍼 함수: 요소에 hide-mode 클래스 토글
  const toggleClass = (el) => {
    if (!el) return;
    if (isHidden) {
      el.classList.add('hide-mode');
    } else {
      el.classList.remove('hide-mode');
    }
  };

  // 단일 모드 적용
  toggleClass(singleContainer);

  // 웹툰 모드 적용 (모든 이미지에 대해 반복)
  webtoonContainers.forEach((el) => toggleClass(el));
}

// 상태 변수
let files = []; //이미지 파일들
let currentIndex = 0;
let isWebtoonMode = false;
//let displayMode = 'fit-screen';
let displayMode = 'default';
let zoomFactor = 1;
let mokuroData = null;

// 스타일 적용
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
    img.style.width = `${zoomFactor * 80}%`;
    img.style.height = 'auto';
  } else {
    const w = img.naturalWidth * zoomFactor;
    img.style.width = `${w}px`;
    img.style.height = 'auto';
  }
}

// 모든 이미지에 스타일 재적용 + 텍스트박스
function updateAllStyles() {
  // 1. 이미지 스타일(크기 등) 적용
  viewerContainer.querySelectorAll('img').forEach((img) => {
    if (img.complete) applyStyles(img);
    else img.onload = () => applyStyles(img);
  });

  // 2. ✅ 수정됨: 모드 상관없이 텍스트 박스 렌더링 함수 호출
  // (renderTextBoxes 안에서 모드별로 알아서 처리하도록 맡김)
  renderTextBoxes(isTextHidden);

  // 3. 투명도 적용
  applyTextOpacity();
}

// 렌더링
function render() {
  viewerContainer.querySelectorAll('img').forEach((n) => n.remove());
  // ✅ 웹툰 모드 래퍼들도 싹 지워야 함 (기존 코드는 img만 지웠음)
  viewerContainer.querySelectorAll('.webtoon-wrapper').forEach((n) => n.remove());

  if (isWebtoonMode) {
    // [웹툰 모드]
    overlayContainer.innerHTML = ''; // 단일 모드용 오버레이 초기화

    files.forEach((file, idx) => {
      // 1. 래퍼(Wrapper) 생성
      const wrapper = document.createElement('div');
      wrapper.className = 'webtoon-wrapper';

      // 2. 이미지 생성
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.className = 'webtoon-img';

      // 3. 개별 오버레이 생성
      const localOverlay = document.createElement('div');
      localOverlay.className = 'webtoon-overlay';

      // 4. 구조 조립: Wrapper > [Img, Overlay]
      wrapper.appendChild(img);
      wrapper.appendChild(localOverlay);
      viewerContainer.appendChild(wrapper);

      // 5. 로드 완료 후 스타일 및 텍스트 렌더링
      img.onload = () => {
        applyStyles(img);

        // ★ 핵심: 이 이미지(idx)에 해당하는 텍스트 박스를 localOverlay에 그리기
        // (아래에서 만들 drawPageText 함수 호출)
        drawPageText(idx, img, localOverlay);

        // ✅ [추가] 텍스트를 그린 직후, 현재 투명도 설정(hide-mode)을 즉시 적용
        applyTextOpacity();
      };
    });
  } else {
    // [단일 이미지 모드] (기존 로직 유지)
    singleImg.onload = () => {
      updateAllStyles(); // 내부에서 renderTextBoxes 호출함
    };
    singleImg.src = URL.createObjectURL(files[currentIndex]);
    viewerContainer.appendChild(singleImg);
  }

  // 버튼 상태 갱신
  btnPrev.style.display = isWebtoonMode ? 'none' : '';
  btnNext.style.display = isWebtoonMode ? 'none' : '';

  // 페이지 정보 업데이트
  if (files.length > 0) {
    pageInfo.textContent = `${currentIndex + 1} / ${files.length}`;
    pageInput.value = currentIndex + 1;
  } else {
    pageInfo.textContent = '0 / 0';
    pageInput.value = '';
  }
}

// 이미지 이동 함수
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

// 초기 줌 리셋
function resetZoom() {
  zoomFactor = 1;
}

// 파일 입력 (폴더)
pickBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const allFiles = Array.from(fileInput.files);
  files = allFiles
    .filter((f) => /\.(jpe?g|png|gif|bmp|webp)$/i.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (!files.length) {
    alert('이미지 파일이 없습니다.');
    [toggleBtn, btnPrev, btnNext, btnFitWidth, btnFitScreen, btnOriginal, btnZoomOut, btnZoomIn].forEach(
      (btn) => (btn.disabled = true),
    );
    return;
  }
  [toggleBtn, btnPrev, btnNext, btnFitWidth, btnFitScreen, btnOriginal, btnZoomOut, btnZoomIn].forEach(
    (btn) => (btn.disabled = false),
  );
  resetZoom();
  currentIndex = 0;
  render();
});

// 웹툰 모드 토글
toggleBtn.addEventListener('click', () => {
  isWebtoonMode = !isWebtoonMode;
  toggleBtn.textContent = isWebtoonMode ? '단일모드로 전환' : '웹툰모드 켜기';
  render();
});

// 버튼 이벤트 연결
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
loadJsonBtn.addEventListener('click', () => jsonInput.click());

// 클릭 영역 핸들링
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

// Shift + 마우스 휠로 줌
viewerContainer.addEventListener('wheel', (e) => {
  if (!e.shiftKey) return;
  e.preventDefault();
  if (e.deltaY < 0) zoomFactor *= 1.1;
  else if (e.deltaY > 0) zoomFactor *= 0.9;
  updateAllStyles();
});

// 키보드 줌
window.addEventListener('keydown', (e) => {
  if (e.key === '+' || e.key === '=') {
    zoomFactor *= 1.1;
    updateAllStyles();
  } else if (e.key === '-') {
    zoomFactor *= 0.9;
    updateAllStyles();
  } else if (e.key === 'ArrowLeft') {
    // ✅ 왼쪽 화살표: 다음 페이지 (Manga Style)
    nextImage();
  } else if (e.key === 'ArrowRight') {
    // ✅ 오른쪽 화살표: 이전 페이지 (Manga Style)
    prevImage();
  }
});

// Mokuro 파일 입력 및 JSON 파싱
jsonInput.addEventListener('change', () => {
  const file = jsonInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      mokuroData = JSON.parse(reader.result);
      console.log('Mokuro JSON data PARSED!:', mokuroData);
      render();
    } catch (e) {
      console.error('Invalid JSON in Mokuro file:', e);
    }
  };
  reader.readAsText(file);
});

//value가 min~max 벗어나면 min|max값이 되게끔.
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * 특정 페이지(pageIndex)의 텍스트 블록을
 * 특정 이미지(imgEl) 기준으로 계산하여
 * 특정 레이어(targetLayer)에 그리는 함수
 */
function drawPageText(pageIndex, imgEl, targetLayer) {
  // 1. 예외 처리
  if (isTextHidden) return;
  if (!mokuroData || !mokuroData.pages) return;
  const page = mokuroData.pages[pageIndex];
  if (!page || !page.blocks || page.blocks.length === 0) return;
  if (imgEl.naturalWidth === 0) return;

  // 2. 좌표 계산 준비
  // 웹툰 모드는 Wrapper(relative) 기준이므로 offset이 0일 수 있음.
  // 하지만 img가 Wrapper 내에서 margin: auto 등으로 이동했다면 계산 필요.
  // 가장 확실한 방법: img의 좌표 - targetLayer(부모)의 좌표

  // (단, .webtoon-wrapper > .webtoon-overlay 구조에서는 둘 다 (0,0) 시작이므로 offset=0 가정 가능)
  // (단일 모드는 viewerContainer 기준이므로 기존 로직 필요)

  // 여기서는 범용성을 위해 getBoundingClientRect 차이를 구함
  const imgRect = imgEl.getBoundingClientRect();
  const layerRect = targetLayer.getBoundingClientRect(); // 부모 혹은 자신

  // 오버레이가 이미지와 완전히 겹쳐 있다고 가정할 때의 오프셋
  const offsetX = imgRect.left - layerRect.left;
  const offsetY = imgRect.top - layerRect.top;

  const scale = imgEl.clientWidth / imgEl.naturalWidth;
  const fontSizeCap = calculateDynamicFontSizeCap(page.blocks);

  // 3. 블록 순회 및 생성 (기존 로직 재사용)
  page.blocks.forEach((block) => {
    if (!block.lines || !block.lines_coords) return;

    const correctedCoords = fixVerticalLineCoords(block);

    // [STEP A] 통합 바운딩 박스 계산
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

    const rawWidth = bMaxX - bMinX;
    const rawHeight = bMaxY - bMinY;
    let padX = block.lines.length === 2 || block.lines.length === 3 ? rawWidth * 0.25 : rawWidth * 0.1;
    const padY = rawHeight * 0.03;

    const bx1 = clamp(bMinX - padX, 0, imgEl.naturalWidth);
    const by1 = clamp(bMinY - padY, 0, imgEl.naturalHeight);
    const bx2 = clamp(bMaxX + padX, 0, imgEl.naturalWidth);
    const by2 = clamp(bMaxY + padY, 0, imgEl.naturalHeight);

    const bgLeft = offsetX + bx1 * scale;
    const bgTop = offsetY + by1 * scale;
    const bgWidth = (bx2 - bx1) * scale;
    const bgHeight = (by2 - by1) * scale;

    // [STEP B] 배경 박스
    const bgBox = document.createElement('div');
    bgBox.className = 'bg-box';
    bgBox.style.left = `${bgLeft}px`;
    bgBox.style.top = `${bgTop}px`;
    bgBox.style.width = `${bgWidth}px`;
    bgBox.style.height = `${bgHeight}px`;
    targetLayer.appendChild(bgBox);

    // [STEP C] 텍스트 박스 (보임/안보임 분기)
    const isTranslatedView = textOpacity === 1;

    if (!isTranslatedView) {
      // (기존) 원문 파이프라인
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

        // 폰트 크기
        if (block.font_size) {
          const capped = fontSizeCap ? Math.min(block.font_size, fontSizeCap) : block.font_size;
          textBox.style.fontSize = `${Math.max(1, Math.floor(capped * scale * 0.98))}px`;
        } else {
          const tSize = block.vertical ? bounds.w * scale : bounds.h * scale;
          textBox.style.fontSize = `${tSize * 0.95}px`;
        }

        textBox.addEventListener('click', (e) => {
          e.stopPropagation();
          const all = document.querySelectorAll('.line-box.selected');
          all.forEach((b) => b.classList.remove('selected'));
          textBox.classList.add('selected');
          if (textOpacity === 0) {
            navigator.clipboard.writeText(lineText);
          }
        });
        textBox.textContent = lineText;
        targetLayer.appendChild(textBox);
      });
    } else {
      // (번역) 병합 파이프라인
      let originalLines = Array.isArray(block.lines)
        ? block.lines.map((t) => String(t ?? '').replace(/[．.]{2,}/g, '.'))
        : [];
      const mergedText = originalLines.join('');
      if (!mergedText) return;

      const textBox = document.createElement('div');
      textBox.className = 'line-box translated';
      textBox.style.left = `${bgLeft}px`;
      textBox.style.top = `${bgTop}px`;

      if (block.vertical) {
        textBox.style.width = `${bgWidth}px`;
        textBox.style.height = `${bgHeight}px`;
      } else {
        textBox.style.width = `${bgWidth}px`;
        textBox.style.height = `${bgHeight}px`;
      }

      if (block.font_size) {
        const capped = fontSizeCap ? Math.min(block.font_size, fontSizeCap) : block.font_size;
        textBox.style.fontSize = `${Math.max(1, Math.floor(capped * scale * 0.98))}px`;
      }

      textBox.addEventListener('click', (e) => {
        e.stopPropagation();
        const all = document.querySelectorAll('.line-box.selected');
        all.forEach((b) => b.classList.remove('selected'));
        textBox.classList.add('selected');
      });
      textBox.textContent = mergedText;
      targetLayer.appendChild(textBox);
    }
  });
}

// 텍스트박스 렌더링
function renderTextBoxes(isTextHidden) {
  // =========================================
  // [Case A] 웹툰 모드
  // =========================================
  if (isWebtoonMode) {
    const wrappers = viewerContainer.querySelectorAll('.webtoon-wrapper');

    wrappers.forEach((wrapper, idx) => {
      const img = wrapper.querySelector('img');
      const overlay = wrapper.querySelector('.webtoon-overlay');

      if (img && overlay) {
        // 1. 일단 무조건 비웁니다 (제거 버튼 눌렀을 때를 위해)
        overlay.innerHTML = '';

        // 2. '생성' 상태일 때만 다시 그립니다
        if (!isTextHidden) {
          drawPageText(idx, img, overlay);
        }
      }
    });

    // 3. 투명도 및 숨김 클래스 재적용
    applyTextOpacity();
    return;
  }

  // =========================================
  // [Case B] 단일 이미지 모드
  // =========================================
  overlayContainer.innerHTML = ''; // 초기화

  // 제거 상태면 여기서 끝
  if (isTextHidden) return;

  // 단일 모드용 통합 레이어 생성
  const unifiedLayer = document.createElement('div');
  unifiedLayer.style.position = 'absolute';
  unifiedLayer.style.top = '0';
  unifiedLayer.style.left = '0';
  unifiedLayer.style.width = '100%';
  unifiedLayer.style.height = '100%';
  overlayContainer.appendChild(unifiedLayer);

  // 그리기
  drawPageText(currentIndex, singleImg, unifiedLayer);

  // 투명도 적용
  applyTextOpacity();
}

/**
 * 다각형 좌표([[x,y],...])를 받아 사각형 바운딩 박스(x, y, w, h)를 반환
 */
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

/**
 * 세로쓰기일 경우, 라인들의 시작점(Y)을 블록 내에서 통일감 있게 보정하는 함수
 * (삐뚤빼뚤한 시작점을 가장 위쪽 라인 기준으로 맞춤)
 */
function fixVerticalLineCoords(block) {
  // 깊은 복사로 원본 데이터 보호
  const coords = JSON.parse(JSON.stringify(block.lines_coords));

  if (!block.vertical || coords.length < 2) {
    return coords;
  }

  // 1. 모든 라인의 minY(시작 높이)를 수집
  const minYs = coords.map((line) => Math.min(...line.map((p) => p[1])));

  // 2. 블록 전체의 '기준 Top' 찾기 (가장 위에 있는 라인의 Y값)
  const blockTop = Math.min(...minYs);

  // 3. 보정 허용 오차 (픽셀 단위, 예: 30px 이내 차이는 같은 줄로 간주)
  const TOLERANCE = 30;

  // 4. 좌표 보정
  return coords.map((line, i) => {
    const currentMinY = minYs[i];

    // 이 라인이 기준점(blockTop)과 가깝다면 (오차 범위 내)
    if (Math.abs(currentMinY - blockTop) < TOLERANCE) {
      // Y좌표 이동량 계산 (위로 끌어올림)
      const diff = currentMinY - blockTop;
      // 라인의 모든 점의 Y좌표를 diff만큼 뺌
      return line.map(([x, y]) => [x, y - diff]);
    }
    return line;
  });
}

//json 구조 :
// pages[0], pages[1], pages[2]
// img_path : 이미지파일 이름
// img_width :
// img_height :
// blocks[0], [1], ...[9] : 9개의 말풍선이 있다
// box [0],,[4] : 말풍선의 4개의 꼭지점 좌표?
// font_size : 이미지의 크기에 맞는 OCR이 제공한 폰트크기
// lines : [0], ,,[4] : 이게 text
// lines_coords: [0], [1], [2], [3] : 말풍선안에 4개의 줄이 있고 각각의 줄에 text가 있는 형태

// ZIP 선택
pickZipBtn.addEventListener('click', () => zipInput.click());
// ZIP 파일 입력 처리 (최소한 변경)
zipInput.addEventListener('change', async (e) => {
  const zipFile = e.target.files[0];
  if (!zipFile) return;

  // 1) ZIP 로드
  const zip = await JSZip.loadAsync(zipFile);
  const imgEntries = [];

  // 2) 이미지와 .mokuro 분류
  zip.forEach((_, entry) => {
    if (/\.(jpe?g|png|gif|bmp|webp)$/i.test(entry.name)) {
      imgEntries.push(entry);
    } else if (/\.mokuro$/i.test(entry.name)) {
      entry.async('string').then((txt) => {
        mokuroData = JSON.parse(txt);
      });
    }
  });

  // 3) Blob → File 객체 변환
  const imageFiles = await Promise.all(
    imgEntries.map((entry) => entry.async('blob').then((blob) => new File([blob], entry.name, { type: blob.type }))),
  );
  files = imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  // 4) 렌더링 및 초기화
  [toggleBtn, btnPrev, btnNext, btnFitWidth, btnFitScreen, btnOriginal, btnZoomOut, btnZoomIn].forEach(
    (btn) => (btn.disabled = false),
  );
  currentIndex = 0;
  resetZoom();
  render();

  // ✅ [추가] ZIP 로딩 완료 후 자동으로 UI 숨기기 (몰입 모드)
  // 왼쪽 컨트롤 패널 숨기기
  const controls = document.querySelector('.controls');
  if (controls) controls.classList.add('hidden');

  // 오른쪽 메뉴 리스트 숨기기
  const menuList = document.getElementById('menu-list');
  if (menuList) menuList.classList.add('hidden-menu');
});

const hideButton = document.getElementById('toggle-controls-btn');
const controls = document.querySelector('.controls');
let isHidden = false;
hideButton.addEventListener('click', () => {
  isHidden = !isHidden;
  controls.classList.toggle('hidden', isHidden);
  hideButton.textContent = isHidden ? '컨' : '컨';
});

const hideTextButton = document.getElementById('toggle-text-btn');
let isTextHidden = false;
hideTextButton.addEventListener('click', () => {
  isTextHidden = !isTextHidden;
  updateAllStyles();
  hideTextButton.textContent = isTextHidden ? '제거' : '생성';
  console.log(isTextHidden);
});

// ✅ 추가: 투명도 버튼 동작 (순환)
btnOpacity.addEventListener('click', () => {
  // 1. 다음 단계로 순환
  const steps = [1.0, 0.0];
  const idx = steps.indexOf(textOpacity);
  textOpacity = steps[(idx + 1) % steps.length];

  // 2. 즉시 반영
  applyTextOpacity();

  // 3. 라벨 갱신 (투명도)
  if (textOpacity == 0) {
    btnOpacity.textContent = `안보임`;
  } else {
    btnOpacity.textContent = `보임`;
  }

  // ✅ 모드(원문/번역 보기)가 바뀌었으므로 오버레이를 다시 생성해야 함
  // - 안보임: 라인 단위
  // - 보임: 블록 단위(줄 병합)
  renderTextBoxes(isTextHidden);
});

/**
 * 페이지의 텍스트 블록 목록을 기반으로 동적 폰트 크기 상한선을 계산합니다.
 * OCR 오류로 인한 비정상적인 폰트 크기를 보정하는 데 사용됩니다.
 * @param {Array} blocks 현재 페이지의 모든 블록 객체 배열
 * @returns {number} 이 페이지에 적용할 최대 폰트 크기
 */
function calculateDynamicFontSizeCap(blocks) {
  // 1. 모든 폰트 사이즈를 배열로 추출
  const fontSizes = blocks.map((block) => block.font_size);

  const sortedSizes = [...fontSizes].sort((a, b) => a - b);
  let median;

  if (sortedSizes.length % 2 === 0) {
    // 짝수면 lower median
    median = sortedSizes[sortedSizes.length / 2 - 1];
  } else {
    median = sortedSizes[Math.floor(sortedSizes.length / 2)];
  }

  // 4. 중앙값의 1.2배를 최대 허용치로 설정. 이 배수는 조절 가능합니다.
  const OUTLIER_MULTIPLIER = 1.2;
  const cap = median * OUTLIER_MULTIPLIER;

  // 5. 최소 캡 값을 보장 (예: 기본 폰트 크기가 매우 작은 경우를 대비)
  const MINIMUM_CAP = 10;

  return Math.max(cap, MINIMUM_CAP);
}

// ✅ 추가: 특정 페이지로 점프하는 함수
function jumpToPage() {
  if (!files.length) return;

  // 입력값 가져오기 (문자열 -> 정수 변환)
  let page = parseInt(pageInput.value);

  // 유효성 검사 (숫자인지, 범위 내인지)
  if (isNaN(page) || page < 1 || page > files.length) {
    alert(`1부터 ${files.length} 사이의 페이지를 입력하세요.`);
    return;
  }

  // 배열 인덱스는 0부터 시작하므로 -1
  currentIndex = page - 1;

  if (isWebtoonMode) {
    // 웹툰 모드일 경우 해당 이미지 위치로 스크롤 이동
    const images = viewerContainer.querySelectorAll('img');
    if (images[currentIndex]) {
      images[currentIndex].scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  } else {
    // 단일 모드일 경우 화면 다시 그리기
    render();
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }
}

// ✅ 추가: 이벤트 리스너 등록
goPageBtn.addEventListener('click', jumpToPage);

// 엔터키 입력 시에도 이동하도록 설정
pageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    jumpToPage();
  }
});

// ✅ 추가: 빈 공간(바탕화면, 이미지 배경 등) 클릭 시 선택 초기화
document.body.addEventListener('click', (e) => {
  // 현재 선택된(.selected) 모든 박스를 찾아서
  const selectedBoxes = document.querySelectorAll('.line-box.selected');

  // 하나씩 순회하며 선택 해제 (초기화)
  selectedBoxes.forEach((box) => {
    box.classList.remove('selected');
  });

  // 2. [추가] 드래그로 긁은 텍스트(시스템 하이라이트) 해제
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges(); // 현재 잡혀있는 모든 드래그 영역을 제거
  }
});

// [viewer.js 추가] 우측 상단 메뉴 토글 기능
// [viewer.js] 맨 아래 교체: UI 전체 토글 (Master UI Toggle)
const menuToggleBtn = document.getElementById('menu-toggle-btn');
const menuList = document.getElementById('menu-list');
const uicontrols = document.querySelector('.controls'); // 왼쪽 컨트롤 패널

// 1. '≡' 버튼 클릭 이벤트 (마스터 스위치)
// - 이 버튼을 누를 때만 메뉴와 왼쪽 컨트롤바가 열리거나 닫힙니다.
menuToggleBtn.addEventListener('click', () => {
  // 메뉴 리스트의 숨김 클래스(.hidden-menu)를 토글
  // (toggle은 클래스가 추가되면 true(숨김), 제거되면 false(보임)를 반환)
  const isMenuHidden = menuList.classList.toggle('hidden-menu');

  // 메뉴 상태에 맞춰 왼쪽 컨트롤 패널도 강제로 동기화
  if (isMenuHidden) {
    // 메뉴가 닫히면 -> 컨트롤도 숨김
    uicontrols.classList.add('hidden');
  } else {
    // 메뉴가 열리면 -> 컨트롤도 보임
    uicontrols.classList.remove('hidden');
  }
});

// ✅ 수정됨: 메뉴 내부 버튼('컨트롤', '텍스트', '보임')에는
// '메뉴를 닫는 기능'을 추가하지 않았습니다.
// 따라서 해당 버튼들을 눌러 기능을 실행해도 메뉴창은 계속 열려 있습니다.

// (옵션) 메뉴 내부 버튼을 눌렀을 때도 메뉴와 컨트롤을 닫고 싶다면 아래 주석을 해제하세요.
// menuList.querySelectorAll('button').forEach((btn) => {
//   btn.addEventListener('click', () => {
//     menuList.classList.add('hidden-menu');
//     uicontrols.classList.add('hidden');
//   });
// });
