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
  const container = document.getElementById('overlay-container');

  if (!container) return;

  // textOpacity가 0이면(안보임 상태) -> .hide-mode 클래스 추가
  // textOpacity가 1이면(보임 상태) -> .hide-mode 클래스 제거
  if (textOpacity === 0) {
    container.classList.add('hide-mode');
  } else {
    container.classList.remove('hide-mode');
  }
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
  viewerContainer.querySelectorAll('img').forEach((img) => {
    if (img.complete) applyStyles(img);
    else img.onload = () => applyStyles(img);
  });
  if (!isWebtoonMode) {
    renderTextBoxes(isTextHidden);
  }
  // ✅ 추가: 스타일 갱신 후에도 투명도 재적용
  applyTextOpacity();
}

// 렌더링
function render() {
  viewerContainer.querySelectorAll('img').forEach((n) => n.remove());

  if (isWebtoonMode) {
    // [웹툰 모드]
    files.forEach((file) => {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.className = 'webtoon-img';
      // 웹툰 모드에서도 로드 완료 후 스타일 적용
      img.onload = () => {
        applyStyles(img);
        // 웹툰 모드는 오버레이가 없으므로 여기서 끝
      };
      viewerContainer.appendChild(img);
    });
    overlayContainer.innerHTML = '';
  } else {
    // [단일 이미지 모드]
    // 1. 이미지가 로드된 "후에" 스타일과 텍스트박스를 그리도록 설정
    singleImg.onload = () => {
      updateAllStyles(); // 이 함수가 내부적으로 renderTextBoxes를 호출함
    };

    // 2. 소스 할당 (이 시점에 로딩 시작)
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

// 텍스트박스 렌더링
// 텍스트박스 렌더링 (라인 단위 + 2 Layer 방식)
function renderTextBoxes(isTextHidden) {
  // 1. 초기화
  overlayContainer.innerHTML = '';

  if (isTextHidden) return;
  if (!mokuroData || !mokuroData.pages) return;
  const page = mokuroData.pages[currentIndex];
  if (!page || !page.blocks || page.blocks.length === 0) return;

  // ✅ 추가: 이미지가 아직 로드되지 않아 너비가 0이라면 계산 중단 (에러 방지)
  if (singleImg.naturalWidth === 0) return;

  // 2. 레이어 생성
  const bgLayer = document.createElement('div');
  bgLayer.id = 'bg-layer';
  const textLayer = document.createElement('div');
  textLayer.id = 'text-layer';

  overlayContainer.appendChild(bgLayer);
  overlayContainer.appendChild(textLayer);

  // 3. 이미지 배율 및 오프셋 계산
  const contRect = viewerContainer.getBoundingClientRect();
  const imgRect = singleImg.getBoundingClientRect();
  const offsetX = imgRect.left - contRect.left;
  const offsetY = imgRect.top - contRect.top;
  const scale = singleImg.clientWidth / singleImg.naturalWidth;

  // ✅ 페이지 단위 font-size cap (원본 좌표계 기준)
  const fontSizeCap = calculateDynamicFontSizeCap(page.blocks); // e.g. median * 1.2

  // 4. 블록 순회
  page.blocks.forEach((block) => {
    // 안전 장치
    if (!block.lines || !block.lines_coords || block.lines.length !== block.lines_coords.length) {
      return;
    }

    // 세로쓰기 보정된 좌표 가져오기
    const correctedCoords = fixVerticalLineCoords(block);

    // -------------------------------------------------------
    // [STEP A] 블록 전체를 감싸는 '통합 바운딩 박스' 계산
    // -------------------------------------------------------
    let bMinX = Infinity,
      bMinY = Infinity,
      bMaxX = -Infinity,
      bMaxY = -Infinity;

    // 블록 내의 모든 라인, 모든 점을 순회하며 가장 바깥쪽 좌표 찾기
    correctedCoords.forEach((line) => {
      line.forEach(([x, y]) => {
        if (x < bMinX) bMinX = x;
        if (x > bMaxX) bMaxX = x;
        if (y < bMinY) bMinY = y;
        if (y > bMaxY) bMaxY = y;
      });
    });

    // 1. 원본 박스의 너비와 높이를 먼저 계산합니다.
    const rawWidth = bMaxX - bMinX;
    const rawHeight = bMaxY - bMinY;

    // 2. 여백을 계산합니다. (0.05 = 5%)
    let padX = 0;
    const padY = rawHeight * 0.03;

    // 라인이 2개 or 3개인 경우 → 좌우 너비 20%
    if (block.lines.length === 2 || block.lines.length === 3) {
      padX = rawWidth * 0.25;
    } else {
      padX = rawWidth * 0.1;
    }

    // 상하좌우로 padding만큼 넓힘 (이미지 밖으로 나가지 않게 clamp 적용)
    const bx1 = clamp(bMinX - padX, 0, singleImg.naturalWidth);
    const by1 = clamp(bMinY - padY, 0, singleImg.naturalHeight);
    const bx2 = clamp(bMaxX + padX, 0, singleImg.naturalWidth);
    const by2 = clamp(bMaxY + padY, 0, singleImg.naturalHeight);

    const bw = bx2 - bx1;
    const bh = by2 - by1;

    // 뷰어상 실제 위치 변환
    const bgLeft = offsetX + bx1 * scale;
    const bgTop = offsetY + by1 * scale;
    const bgWidth = bw * scale;
    const bgHeight = bh * scale;

    // -------------------------------------------------------
    // [STEP B] 배경 박스 생성 (블록당 1개) -> bgLayer
    // -------------------------------------------------------
    const bgBox = document.createElement('div');
    bgBox.className = 'bg-box';
    bgBox.style.left = `${bgLeft}px`;
    bgBox.style.top = `${bgTop}px`;
    bgBox.style.width = `${bgWidth}px`;
    bgBox.style.height = `${bgHeight}px`;
    bgLayer.appendChild(bgBox);

    // -------------------------------------------------------
    // [STEP C] 텍스트 박스 생성
    //  - 안보임(textOpacity=0): 원문 파이프라인(기존) = 라인 단위 + 이미지 1:1
    //  - 보임(textOpacity=1): 번역 보기 파이프라인 = 줄 병합 + 블록 단위 렌더
    // -------------------------------------------------------
    const isTranslatedView = textOpacity === 1;

    if (!isTranslatedView) {
      // =========================
      // 원문 파이프라인 (기존)
      // =========================
      block.lines.forEach((rawLineText, index) => {
        // ✅ 전각(．)이든 반각(.)이든 "2개 이상" 연속되면 점 1개로 통일
        // - 엄밀히 필수는 아니지만, OCR이 "．．．" 같은 출력을 많이 만들어서
        //   복사/번역 품질을 약간 올려줌(비용 0에 가까움)
        const lineText = String(rawLineText ?? '').replace(/[．.]{2,}/g, '.');

        const coords = correctedCoords[index];
        const bounds = getPolygonBounds(coords); // 개별 라인의 바운딩 박스

        const lx1 = clamp(bounds.x, 0, singleImg.naturalWidth);
        const ly1 = clamp(bounds.y, 0, singleImg.naturalHeight);

        const lLeft = offsetX + lx1 * scale;
        const lTop = offsetY + ly1 * scale;
        const lWidth = bounds.w * scale;
        const lHeight = bounds.h * scale;

        const textBox = document.createElement('div');
        textBox.className = 'line-box';

        if (block.vertical) {
          textBox.classList.add('vertical');
        }

        textBox.style.left = `${lLeft}px`;
        textBox.style.top = `${lTop}px`;

        // ✅ 고정(width) 대신 최소(min-width) 사용
        textBox.style.minWidth = `${lWidth}px`;
        textBox.style.minHeight = `${lHeight}px`;
        textBox.style.width = 'auto';
        textBox.style.height = 'auto';

        // 폰트 크기
        if (block.font_size) {
          // ✅ cap은 "scale 적용 전"에 걸어야 페이지 전체 기준이 흔들리지 않음
          const cappedRawFont = fontSizeCap ? Math.min(block.font_size, fontSizeCap) : block.font_size;

          const scaledFontSize = cappedRawFont * scale;
          const finalFontSize = scaledFontSize * 0.98;
          textBox.style.fontSize = `${Math.max(1, Math.floor(finalFontSize))}px`;
        } else {
          const targetSize = block.vertical ? bounds.w * scale : bounds.h * scale;
          textBox.style.fontSize = `${targetSize * 0.95}px`;
        }

        // ✅ 단일 선택 모드 (나만 켜기)
        textBox.addEventListener('click', (e) => {
          e.stopPropagation();

          const allSelected = document.querySelectorAll('.line-box.selected');
          allSelected.forEach((box) => {
            if (box !== textBox) box.classList.remove('selected');
          });

          textBox.classList.toggle('selected');

          // ✅ 숨김 모드(안보임)일 때 자동 복사
          if (textOpacity === 0) {
            navigator.clipboard
              .writeText(lineText)
              .then(() => console.log('복사 완료:', lineText))
              .catch((err) => console.error('복사 실패:', err));
          }
        });

        textBox.textContent = lineText;
        textLayer.appendChild(textBox);
      });
    } else {
      // =========================
      // 번역 보기 파이프라인
      // - 같은 블록의 여러 줄을 합쳐서 "통짜 문장" DOM을 만들고,
      //   브라우저 번역(또는 향후 API 번역)에 유리하게 함
      // =========================
      // 1) 병합(번역 입력용)
      let originalLines = Array.isArray(block.lines)
        ? block.lines.map((t) => String(t ?? '').replace(/[．.]{2,}/g, '.'))
        : [];
      const mergedText = block.vertical ? originalLines.join('') : originalLines.join('\n');
      if (!mergedText) return;

      const textBox = document.createElement('div');
      textBox.className = 'line-box';
      textBox.classList.add('translated');

      // 블록 전체 박스 기준 배치
      textBox.style.left = `${bgLeft}px`;
      textBox.style.top = `${bgTop}px`;

      // ✅ 중요: 세로쓰기는 '높이'가 꽉 차야 줄바꿈(옆으로 이동)이 일어납니다.
      if (block.vertical) {
        textBox.style.height = `${bgHeight}px`;
        textBox.style.width = `${bgWidth}px`;
      } else {
        // [가로쓰기]
        // 너비를 고정해야 글자가 옆으로 끝없이 가지 않고 다음 줄로 꺾임
        textBox.style.width = `${bgWidth}px`;
        textBox.style.height = `${bgHeight}px`;
      }

      // 폰트 크기 로직 유지
      if (block.font_size) {
        // ✅ cap은 "scale 적용 전"에 걸어야 페이지 전체 기준이 흔들리지 않음
        const cappedRawFont = fontSizeCap ? Math.min(block.font_size, fontSizeCap) : block.font_size;

        const scaledFontSize = cappedRawFont * scale;
        const finalFontSize = scaledFontSize * 0.98;
        textBox.style.fontSize = `${Math.max(1, Math.floor(finalFontSize))}px`;
      }
      // 클릭 선택 로직 유지
      textBox.addEventListener('click', (e) => {
        e.stopPropagation();
        const allSelected = document.querySelectorAll('.line-box.selected');
        allSelected.forEach((box) => {
          if (box !== textBox) box.classList.remove('selected');
        });
        textBox.classList.toggle('selected');
      });

      textBox.textContent = mergedText;

      textLayer.appendChild(textBox);
    }
  });

  // 5. 투명도 적용
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

  // 3) Blob → File 객체 변환하여 files에 저장
  const imageFiles = await Promise.all(
    imgEntries.map((entry) => entry.async('blob').then((blob) => new File([blob], entry.name, { type: blob.type }))),
  );
  files = imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  // 4) 기존 로직 재사용
  [toggleBtn, btnPrev, btnNext, btnFitWidth, btnFitScreen, btnOriginal, btnZoomOut, btnZoomIn].forEach(
    (btn) => (btn.disabled = false),
  );
  currentIndex = 0;
  resetZoom();
  render();
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
