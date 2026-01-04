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
  overlayContainer.innerHTML = '';

  if (isTextHidden) return;
  if (!mokuroData || !mokuroData.pages) return;

  const page = mokuroData.pages[currentIndex];
  if (!page || !page.blocks || page.blocks.length === 0) return;

  // 동적 폰트 크기 상한선 계산
  const fontSizeCap = calculateDynamicFontSizeCap(page.blocks);

  // 이미지 스케일 및 오프셋 계산
  const contRect = viewerContainer.getBoundingClientRect();
  const imgRect = singleImg.getBoundingClientRect();
  const offsetX = imgRect.left - contRect.left;
  const offsetY = imgRect.top - contRect.top;
  const scale = singleImg.clientWidth / singleImg.naturalWidth;

  page.blocks.forEach((block) => {
    const correctedFontSize = Math.min(block.font_size, fontSizeCap);
    const fontSz = Math.max(1, Math.round(correctedFontSize * scale));

    // 무조건 줄(Line) 단위로 순회하며 그리기
    block.lines.forEach((lineText, index) => {
      const coords = block.lines_coords[index];
      // coords 구조: [[x,y], [x,y], [x,y], [x,y]] (점 4개)

      // 점 4개에서 사각형의 min/max 좌표 추출
      // (Mokuro 데이터가 보장된다면 coords는 반드시 존재)
      const xs = coords.map((p) => p[0]);
      const ys = coords.map((p) => p[1]);

      const x1 = Math.min(...xs);
      const x2 = Math.max(...xs);
      const y1 = Math.min(...ys);
      const y2 = Math.max(...ys);

      const w0 = x2 - x1;
      const h0 = y2 - y1;

      // 뷰어 내 좌표로 변환
      const left = offsetX + x1 * scale;
      const top = offsetY + y1 * scale;
      const width = w0 * scale;
      const height = h0 * scale;

      // 박스 생성
      const box = document.createElement('div');
      box.className = 'textbox';
      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;

      // 텍스트 생성
      const textInBox = document.createElement('div');
      textInBox.className = 'textInBox';
      textInBox.style.fontSize = `${fontSz}px`;
      textInBox.innerHTML = lineText;

      // 세로쓰기 적용
      if (block.vertical) {
        textInBox.style.writingMode = 'vertical-rl';
      }

      box.appendChild(textInBox);
      overlayContainer.appendChild(box);
    });
  });

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
