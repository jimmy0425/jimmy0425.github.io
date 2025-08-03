// 요소 가져오기
const pickBtn         = document.getElementById('pick-folder');
const fileInput       = document.getElementById('folder-input');
const loadJsonBtn     = document.getElementById('load-json');
const jsonInput       = document.getElementById('json-input');
const toggleBtn       = document.getElementById('toggle-mode');
const btnPrev         = document.getElementById('prev');
const btnNext         = document.getElementById('next');
const btnFitWidth     = document.getElementById('fit-width');
const btnFitScreen    = document.getElementById('fit-screen');
const btnOriginal     = document.getElementById('original');
const btnZoomOut      = document.getElementById('zoom-out');
const btnZoomIn       = document.getElementById('zoom-in');
const viewerContainer = document.getElementById('viewer-container');
const overlayContainer= document.getElementById('overlay-container');
const singleImg       = document.getElementById('viewer');
const clickLeft       = document.getElementById('click-left');
const clickRight      = document.getElementById('click-right');

const zipInput        = document.getElementById('zip-input');
const pickZipBtn      = document.getElementById('pick-zip');

singleImg.addEventListener('load', () => {
  // 이미지가 화면에 완전히 렌더링된 뒤 텍스트박스 그리기
  renderTextBoxes(isTextHidden);
});

// 상태 변수
let files = [];       //이미지 파일들
let currentIndex = 0; 
let isWebtoonMode = false;
//let displayMode = 'fit-screen';
let displayMode = 'original';
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
  } else {
    const w = img.naturalWidth * zoomFactor;
    img.style.width = `${w}px`;
    img.style.height = 'auto';
  }
}


// 모든 이미지에 스타일 재적용 + 텍스트박스
function updateAllStyles() {
  viewerContainer.querySelectorAll('img').forEach(img => {
    if (img.complete) applyStyles(img);
    else img.onload = () => applyStyles(img);
  });
  if (!isWebtoonMode) {
    renderTextBoxes(isTextHidden);
  }
}

// 렌더링
function render() {
  viewerContainer.querySelectorAll('img').forEach(n => n.remove());
  if (isWebtoonMode) {
    files.forEach(file => {
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
    render();
  }
}
function nextImage() {
  if (!isWebtoonMode && files.length) {
    currentIndex = (currentIndex + 1) % files.length;
    render();
  }
}

// 초기 줌 리셋
function resetZoom() { zoomFactor = 1; }

// 파일 입력 (폴더)
pickBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const allFiles = Array.from(fileInput.files);
  files = allFiles
    .filter(f => /\.(jpe?g|png|gif|bmp|webp)$/i.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
  if (!files.length) {
    alert('이미지 파일이 없습니다.');
    [toggleBtn, btnPrev, btnNext, btnFitWidth, btnFitScreen, btnOriginal, btnZoomOut, btnZoomIn]
      .forEach(btn => btn.disabled = true);
    return;
  }
  [toggleBtn, btnPrev, btnNext, btnFitWidth, btnFitScreen, btnOriginal, btnZoomOut, btnZoomIn]
    .forEach(btn => btn.disabled = false);
  resetZoom(); currentIndex = 0; render();
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
btnFitWidth.addEventListener('click', () => { displayMode = 'fit-width'; resetZoom(); updateAllStyles(); });
btnFitScreen.addEventListener('click', () => { displayMode = 'fit-screen'; resetZoom(); updateAllStyles(); });
btnOriginal.addEventListener('click', () => { displayMode = 'original'; resetZoom(); updateAllStyles(); });
btnZoomIn.addEventListener('click', () => { zoomFactor *= 1.1; updateAllStyles(); });
btnZoomOut.addEventListener('click', () => { zoomFactor *= 0.9; updateAllStyles(); });
loadJsonBtn.addEventListener('click', () => jsonInput.click());

// 클릭 영역 핸들링
clickLeft.addEventListener('click', e => { e.stopPropagation(); nextImage(); updateAllStyles();});
clickRight.addEventListener('click', e => { e.stopPropagation(); prevImage(); updateAllStyles();});

// Shift + 마우스 휠로 줌
viewerContainer.addEventListener('wheel', e => {
  if (!e.shiftKey) return;
  e.preventDefault();
  if (e.deltaY < 0) zoomFactor *= 1.1;
  else if (e.deltaY > 0) zoomFactor *= 0.9;
  updateAllStyles();
});

// 키보드 줌
window.addEventListener('keydown', e => {
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

  if(isTextHidden){
    return;
  }
  
  // JSON 미로드 시 스킵 (일단 이미지만 렌더링 했을때) 이거 나중에는 무조건 이미지,json 둘다 한번에 로드하게끔 변경해야함.
  if (!mokuroData || !mokuroData.pages) return;

  const page = mokuroData.pages[currentIndex];  //현재 페이지의 내용들을 page객체에 저장
  if (!page) return;   
  
  // 이미지의 화면 배치 정보 가져오기
  const imgRect = singleImg.getBoundingClientRect();
  const scaleX = imgRect.width  / singleImg.naturalWidth;
  const scaleY = imgRect.height / singleImg.naturalHeight;
  const scale  = Math.min(scaleX, scaleY);
  page.blocks.forEach(block => {  
    const [x1, y1, x2, y2] = block.box;
    const w0 = x2 - x1;
    const h0 = y2 - y1;

    // expand 비율이 필요하면 아래 값 조정
    const expand = 0; // 원하는 확장 비율로 설정
    const halfExpW = Math.round(w0 * expand / 2);
    const halfExpH = Math.round(h0 * expand / 2);

    // 원본 박스 좌표(자연 크기 기준)에서 확장 후 클램프
    const xmin = clamp(x1 - halfExpW, 0, singleImg.naturalWidth);
    const ymin = clamp(y1 - halfExpH, 0, singleImg.naturalHeight);
    const xmax = clamp(x2 + halfExpW, 0, singleImg.naturalWidth);
    const ymax = clamp(y2 + halfExpH, 0, singleImg.naturalHeight);
    const w    = xmax - xmin;
    const h    = ymax - ymin;

    // 화면 좌표계로 변환 (오프셋 + 스케일)
    const left   = imgRect.left + xmin * scale;
    const top    = imgRect.top  + ymin * scale;
    const width  = w * scale;
    const height = h * scale;
    const fontSz = clamp(Math.round(block.font_size * scale), 12, 32);

    // 박스 생성 및 스타일 적용
    const box = document.createElement('div');
    box.className = 'textbox';
    box.style.left   = `${left}px`;
    box.style.top    = `${top}px`;
    box.style.width  = `${width}px`;
    box.style.height = `${height}px`;

    // 텍스트 생성
    const textInBox = document.createElement('div');
    textInBox.className = 'textInBox';

    // OCR font_size에 비례해 화면 글자 크기 조정 (일단은 잘 작동함.)
    textInBox.style.fontSize = `${fontSz}px`;

    // lines 배열을 줄바꿈(<br>)으로 합쳐 넣기
    textInBox.innerHTML = block.lines.join('<br>');

    // 세로일 경우 세로로 표시 (이거 버튼으로 무조건 가로로 표시되게끔 변경할수 있게끔 만들자.)
    if (block.vertical) textInBox.style.writingMode = 'vertical-rl';

    box.appendChild(textInBox);
    overlayContainer.appendChild(box);
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
zipInput.addEventListener('change', async e => {
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
      entry.async('string').then(txt => {
        mokuroData = JSON.parse(txt);
      });
    }
  });

  // 3) Blob → File 객체 변환하여 files에 저장
  const imageFiles = await Promise.all(
    imgEntries.map(entry =>
      entry.async('blob').then(blob =>
        new File([blob], entry.name, { type: blob.type })
      )
    )
  );
  files = imageFiles
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  // 4) 기존 로직 재사용
  [toggleBtn, btnPrev, btnNext, btnFitWidth, btnFitScreen, btnOriginal, btnZoomOut, btnZoomIn]
    .forEach(btn => btn.disabled = false);
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
  hideButton.textContent = isHidden ? '컨트롤 보이기' : '컨트롤 숨기기';
});

const hideTextButton = document.getElementById('toggle-text-btn');
let isTextHidden = false;
hideTextButton.addEventListener('click', () => {
  isTextHidden = !isTextHidden;
  updateAllStyles();
  hideTextButton.textContent = isTextHidden ? '텍스트 보이기' : '텍스트 숨기기';
  console.log(isTextHidden);
});


