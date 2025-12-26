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

singleImg.addEventListener('load', () => {
  // 이미지가 화면에 완전히 렌더링된 뒤 텍스트박스 그리기
  renderTextBoxes(isTextHidden);
});

// ✅ 추가: 텍스트 박스 투명도 상태
let textOpacity = 1.0; // 1.0=100%, 0.0=0%

// ✅ 추가: 오버레이 투명도 적용 함수
function applyTextOpacity() {
  overlayContainer.style.opacity = String(textOpacity);
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
    files.forEach((file) => {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.className = 'webtoon-img';
      img.onload = () => applyStyles(img);
      viewerContainer.appendChild(img);
    });
    overlayContainer.innerHTML = '';
  } else {
    singleImg.src = URL.createObjectURL(files[currentIndex]);
    viewerContainer.appendChild(singleImg);
  }
  updateAllStyles();
  btnPrev.style.display = isWebtoonMode ? 'none' : '';
  btnNext.style.display = isWebtoonMode ? 'none' : '';
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
      (btn) => (btn.disabled = true)
    );
    return;
  }
  [toggleBtn, btnPrev, btnNext, btnFitWidth, btnFitScreen, btnOriginal, btnZoomOut, btnZoomIn].forEach(
    (btn) => (btn.disabled = false)
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
function renderTextBoxes(isTextHidden) {
  //무조건 기존 오버레이 초기화
  overlayContainer.innerHTML = '';

  if (isTextHidden) return;

  // JSON 미로드 시 스킵 (일단 이미지만 렌더링 했을때) 이거 나중에는 무조건 이미지,json 둘다 한번에 로드하게끔 변경해야함.
  if (!mokuroData || !mokuroData.pages) return;

  const page = mokuroData.pages[currentIndex]; //현재 페이지의 내용들을 page객체에 저장
  if (!page || !page.blocks || page.blocks.length === 0) return; // ✅ 안전 장치 추가

  // ✅ 추가: 동적 폰트 크기 상한선 계산
  const fontSizeCap = calculateDynamicFontSizeCap(page.blocks);

  // 2) Compute image scale and its offset *inside* the viewer-container
  //    - scale: current displayed px per natural px (aspect ratio preserved => X == Y)
  //    - offsetX/offsetY: letterboxing gap because the img is centered in the container
  const contRect = viewerContainer.getBoundingClientRect();
  const imgRect = singleImg.getBoundingClientRect();
  const offsetX = imgRect.left - contRect.left;
  const offsetY = imgRect.top - contRect.top;
  const scale = singleImg.clientWidth / singleImg.naturalWidth;

  page.blocks.forEach((block) => {
    const [x1, y1, x2, y2] = block.box;
    const w0 = x2 - x1;
    const h0 = y2 - y1;

    const expand = 0; // <-- adjust if you want to grow boxes
    const halfExpW = Math.round((w0 * expand) / 2);
    const halfExpH = Math.round((h0 * expand) / 2);

    const xmin = clamp(x1 - halfExpW, 0, singleImg.naturalWidth);
    const ymin = clamp(y1 - halfExpH, 0, singleImg.naturalHeight);
    const xmax = clamp(x2 + halfExpW, 0, singleImg.naturalWidth);
    const ymax = clamp(y2 + halfExpH, 0, singleImg.naturalHeight);
    const w = xmax - xmin;
    const h = ymax - ymin;

    // 3) Place relative to overlay (which is relative to viewer-container)
    const left = offsetX + xmin * scale;
    const top = offsetY + ymin * scale;
    const width = w * scale;
    const height = h * scale;

    // ✅ 수정: 보정된 폰트 크기를 계산하여 사용
    const correctedFontSize = Math.min(block.font_size, fontSizeCap);
    const fontSz = Math.max(1, Math.round(correctedFontSize * scale));

    const box = document.createElement('div');
    box.className = 'textbox';
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;

    const textInBox = document.createElement('div');
    textInBox.className = 'textInBox';
    textInBox.style.fontSize = `${fontSz}px`;
    //textInBox.innerHTML = block.lines.join("<br>");
    //if (block.vertical) textInBox.style.writingMode = "vertical-rl";

    // ▼▼▼ [수정 시작] ▼▼▼

    // 1. 줄바꿈(<br>) 없이 텍스트를 하나로 합칩니다. (번역 품질 향상)
    textInBox.innerHTML = block.lines.join('');

    // 2. CSS로 박스 크기에 맞춰 자동 줄바꿈 처리 (모양 유지)
    textInBox.style.whiteSpace = 'normal'; // CSS의 nowrap 속성 덮어쓰기
    textInBox.style.lineHeight = '1.2';

    // 핵심: 단어 중간에 끊기지 않도록 설정 (줄바꿈 빈도 감소)
    textInBox.style.wordBreak = 'keep-all';
    textInBox.style.overflowWrap = 'anywhere';

    // 3. 박스 크기 여유 주기 (살짝 벗어나게)
    if (block.vertical) {
      // [세로쓰기]
      textInBox.style.writingMode = 'vertical-rl';
      textInBox.style.textOrientation = 'upright';

      // 높이를 10% 더 여유 있게 잡음
      textInBox.style.height = '110%';
      textInBox.style.top = '-5%'; // 위로 살짝 올려서 중앙 정렬 효과
      textInBox.style.width = '100%';
    } else {
      // [가로쓰기]
      // 너비를 15% 더 여유 있게 잡음
      textInBox.style.width = '115%';
      textInBox.style.marginLeft = '-7.5%'; // 왼쪽으로 살짝 당겨서 중앙 정렬 효과
      textInBox.style.height = 'auto';
    }

    // ▲▲▲ [수정 끝] ▲▲▲

    box.appendChild(textInBox);
    overlayContainer.appendChild(box);
  });
  // ✅ 추가: 박스들을 그린 직후 현재 투명도 반영
  applyTextOpacity();
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
    imgEntries.map((entry) => entry.async('blob').then((blob) => new File([blob], entry.name, { type: blob.type })))
  );
  files = imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  // 4) 기존 로직 재사용
  [toggleBtn, btnPrev, btnNext, btnFitWidth, btnFitScreen, btnOriginal, btnZoomOut, btnZoomIn].forEach(
    (btn) => (btn.disabled = false)
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

  // 2. 텍스트 블록이 3개 미만이면 통계가 무의미하므로 매우 큰 값을 반환 (사실상 제한 없음)
  // if (fontSizes.length < 3) {
  //   return 9999;
  // }

  // 3. 중앙값(Median) 계산
  const sortedSizes = [...fontSizes].sort((a, b) => a - b);
  const midIndex = Math.floor(sortedSizes.length / 2);
  const median = sortedSizes[midIndex];

  // 4. 중앙값의 2.5배를 최대 허용치로 설정. 이 배수는 조절 가능합니다.
  const OUTLIER_MULTIPLIER = 1.2;
  const cap = median * OUTLIER_MULTIPLIER;

  // 5. 최소 캡 값을 보장 (예: 기본 폰트 크기가 매우 작은 경우를 대비)
  const MINIMUM_CAP = 15;

  return Math.max(cap, MINIMUM_CAP);
}
