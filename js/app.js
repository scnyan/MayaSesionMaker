/* ═══════════════════════════════════════════════════════
   ▼ GitHub 設定（リポジトリに合わせて変更してください）
   ═══════════════════════════════════════════════════════ */
const GITHUB_OWNER  = 'scnyan';
const GITHUB_REPO   = 'MayaSesionMaker';
const GITHUB_BRANCH = 'main';
const GITHUB_FILE   = 'assets/maya_data.json';
/* ═══════════════════════════════════════════════════════ */

/* ── STATIC DATA（編集不可・シール名のみ） ── */
const seals = [
    "赤い竜","白い風","青い夜","黄色い種","赤い蛇",
    "白い世界の橋渡し","青い手","黄色い星","赤い月","白い犬",
    "青い猿","黄色い人","赤い空歩く人","白い魔法使い","青い鷲",
    "黄色い戦士","赤い地球","白い鏡","青い嵐","黄色い太陽"
];
const sealColors = ["赤","白","青","黄"];

/* ── MUTABLE DATA（GitHubから読み込まれる） ── */
let sealDescriptions  = {};
let toneDescriptions  = [];
let chakraDescriptions = {};
let ekiList = [];

/* ── GITHUB API STATE ── */
let _ghToken   = '';   // セッション中のみ保持（ブラウザには保存しない）
let _ghFileSha = '';   // ファイルのSHAハッシュ（上書きに必要）

/* ── GitHub Raw からデータを読み込む ── */
async function loadDataFromGitHub() {
    // キャッシュバスターを付けて常に最新を取得
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_FILE}?_=${Date.now()}`;
    const res = await fetch(rawUrl);
    if (res.ok) return await res.json();

    const localRes = await fetch(`${GITHUB_FILE}?_=${Date.now()}`);
    if (!localRes.ok) throw new Error(`HTTP ${res.status}`);
    return await localRes.json();
}

/* ── GitHub Contents API でSHAを取得 ── */
async function fetchGhFileSha() {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}?ref=${GITHUB_BRANCH}`;
    const headers = { 'Accept': 'application/vnd.github+json' };
    if (_ghToken) headers['Authorization'] = `Bearer ${_ghToken}`;
    try {
        const res = await fetch(url, { headers });
        if (res.ok) {
            const meta = await res.json();
            _ghFileSha = meta.sha || '';
        }
    } catch(e) { console.warn('fetchGhFileSha:', e); }
}

/* ── GitHub Contents API にデータを書き込む ── */
async function writeDataToGitHub(jsonString) {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`;
    // UTF-8 → base64（日本語対応）
    const encoded = btoa(unescape(encodeURIComponent(jsonString)));
    const body = {
        message: '✏️ テキストデータを更新',
        content: encoded,
        branch: GITHUB_BRANCH,
    };
    if (_ghFileSha) body.sha = _ghFileSha;

    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${_ghToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github+json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `GitHub API エラー (${res.status})`);
    }
    const result = await res.json();
    // 次回の上書きに備えてSHAを更新
    _ghFileSha = result.content?.sha || '';
}

/* ── 読み込んだデータをメモリに適用 ── */
function applyData(data) {
    if (data.sealDescriptions)   Object.assign(sealDescriptions,  data.sealDescriptions);
    if (data.toneDescriptions)   toneDescriptions.splice(0, toneDescriptions.length,   ...data.toneDescriptions);
    if (data.chakraDescriptions) Object.assign(chakraDescriptions, data.chakraDescriptions);
    if (data.ekiList)            ekiList.splice(0, ekiList.length, ...data.ekiList);
}

function plainText(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    return tmp.textContent || tmp.innerText || '';
}

function buildItemGuide(tab = 'seals') {
    const grid = document.getElementById('itemGuideGrid');
    if (!grid) return;

    let items = [];
    if (tab === 'seals') {
        items = seals.map((name, index) => ({
            kicker: `紋章 ${index + 1}`,
            title: name,
            body: plainText(sealDescriptions[name]),
            img: `assets/ms${index + 1}.png`,
            id: `seal-${index + 1}`
        }));
    } else if (tab === 'tones') {
        items = toneDescriptions.map((body, index) => ({
            kicker: `銀河の音 ${index + 1}`,
            title: `音 ${index + 1}`,
            body: plainText(body)
        }));
    } else if (tab === 'themes') {
        items = [0, 1, 2, 3, 4].map(key => ({
            kicker: '一生のテーマ',
            title: `${key}系`,
            body: chakraDescriptions[key] || ''
        }));
    } else if (tab === 'eki') {
        items = ekiList.map((eki, index) => ({
            kicker: `易 ${index + 1}`,
            title: eki.name,
            body: eki.desc
        }));
    }

    grid.innerHTML = items.map((item, index) => `
        <article class="item-card" id="${item.id || ''}" style="animation-delay:${Math.min(index * 0.018, 0.28)}s">
            <div class="item-card-head">
                ${item.img ? `<img src="${item.img}" alt="">` : ''}
                <div>
                    <div class="item-card-kicker">${item.kicker}</div>
                    <div class="item-card-title">${item.title}</div>
                </div>
            </div>
            <div class="item-card-body">${item.body || '-'}</div>
        </article>
    `).join('');
}

function switchItemGuide(tab, e) {
    if (e) addRipple(e.currentTarget, e);
    document.querySelectorAll('.item-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.itemTab === tab);
    });
    buildItemGuide(tab);
}

function scrollToItemGuide(e, tab = 'seals', sealIndex = null) {
    if (e) addRipple(e.currentTarget, e);
    const target = document.getElementById('itemGuide');
    if (!target) return;
    const tabBtn = document.querySelector(`[data-item-tab="${tab}"]`);
    if (tabBtn) switchItemGuide(tab, null);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (sealIndex) {
        setTimeout(() => {
            document.getElementById(`seal-${sealIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 420);
    }
}

function initSealBannerLinks() {
    document.querySelectorAll('#sealBanner .seal-item').forEach((item, index) => {
        const sealIndex = (index % 20) + 1;
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.addEventListener('click', () => scrollToItemGuide(null, 'seals', sealIndex));
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                scrollToItemGuide(null, 'seals', sealIndex);
            }
        });
    });
}

/* ── アプリ起動時の初期化 ── */
async function initApp() {
    const overlay  = document.getElementById('loadingOverlay');
    const loaderTx = overlay.querySelector('.loader-text');
    loaderTx.textContent = 'データを読み込み中...';
    overlay.classList.add('active');

    try {
        const data = await loadDataFromGitHub();
        applyData(data);
        buildItemGuide('seals');
        initSealBannerLinks();
        // SHAを非同期で取得（書き込み時に必要。失敗しても読み取りには影響しない）
        fetchGhFileSha();
    } catch(e) {
        console.warn('GitHub からのデータ読み込みに失敗しました:', e);
        // フォールバック：空のオブジェクト（編集モーダルで空欄表示）
        showToast('⚠️ データの読み込みに失敗しました。GitHub設定を確認してください。', 'error');
    } finally {
        overlay.classList.remove('active');
        loaderTx.textContent = 'PDF を生成中...'; // 元のテキストに戻す
    }
}

/* ── PARTICLES ── */
(function initParticles() {
    const container = document.getElementById('particles');
    for (let i = 0; i < 22; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const size = 4 + Math.random() * 8;
        p.style.cssText = `
            width:${size}px; height:${size}px;
            left:${Math.random()*100}%;
            animation-duration:${6+Math.random()*10}s;
            animation-delay:${-Math.random()*12}s;
            opacity:${0.2+Math.random()*0.5};
        `;
        container.appendChild(p);
    }
})();

/* ── APP INIT ── */
initDateSelects();
initApp();

function initDateSelects() {
    const yearEl = document.getElementById('birthYear');
    const monthEl = document.getElementById('birthMonth');
    const dayEl = document.getElementById('birthDay');
    if (!yearEl || !monthEl || !dayEl) return;

    const currentYear = new Date().getFullYear();
    yearEl.innerHTML = '<option value="">年</option>';
    for (let y = currentYear; y >= 1900; y--) {
        yearEl.insertAdjacentHTML('beforeend', `<option value="${y}">${y}年</option>`);
    }
    monthEl.innerHTML = '<option value="">月</option>';
    for (let m = 1; m <= 12; m++) {
        monthEl.insertAdjacentHTML('beforeend', `<option value="${m}">${m}月</option>`);
    }

    function updateDays() {
        const selected = dayEl.value;
        const y = parseInt(yearEl.value, 10) || 2000;
        const m = parseInt(monthEl.value, 10) || 1;
        const maxDay = new Date(y, m, 0).getDate();
        dayEl.innerHTML = '<option value="">日</option>';
        for (let d = 1; d <= maxDay; d++) {
            dayEl.insertAdjacentHTML('beforeend', `<option value="${d}">${d}日</option>`);
        }
        if (selected && parseInt(selected, 10) <= maxDay) dayEl.value = selected;
    }

    yearEl.addEventListener('change', updateDays);
    monthEl.addEventListener('change', updateDays);
    updateDays();
}

function getBirthDateParts() {
    const birthYear = parseInt(document.getElementById('birthYear').value, 10);
    const birthMonth = parseInt(document.getElementById('birthMonth').value, 10);
    const birthDay = parseInt(document.getElementById('birthDay').value, 10);
    if (!birthYear || !birthMonth || !birthDay) return null;
    return { birthYear, birthMonth, birthDay };
}

function setPreviewMode(mode, e) {
    if (e) addRipple(e.currentTarget, e);
    const isFit = mode === 'fit';
    document.body.classList.toggle('fit-preview-mode', isFit);
    document.getElementById('layoutNormalBtn')?.classList.toggle('active', !isFit);
    document.getElementById('layoutFitBtn')?.classList.toggle('active', isFit);
    if (isFit) {
        document.querySelectorAll('.desc-box, .chakra-text').forEach(el => {
            el.style.fontSize = '';
            el.style.lineHeight = '';
        });
    } else if (getComputedStyle(document.getElementById('printArea')).display !== 'none') {
        fitSheetText();
    }
}

function toggleSettingsMenu(e) {
    if (e) e.stopPropagation();
    if (e) addRipple(e.currentTarget, e);
    const overlay = document.getElementById('settingsOverlay');
    if (!overlay) return;
    const isOpen = !overlay.classList.contains('open');
    overlay.classList.toggle('open', isOpen);
    overlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    document.body.classList.toggle('settings-open', isOpen);
    e?.currentTarget?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function closeSettingsMenu(e) {
    if (e) e.stopPropagation();
    const overlay = document.getElementById('settingsOverlay');
    overlay?.classList.remove('open');
    overlay?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('settings-open');
    document.getElementById('settingsMenu')?.classList.remove('open');
    document.querySelector('.settings-trigger')?.setAttribute('aria-expanded', 'false');
}

function openAdminTextEditor(e) {
    if (e) e.stopPropagation();
    if (e) addRipple(e.currentTarget, e);
    closeSettingsMenu(e);
    openEditModal();
}

function scrollToAbout(e) {
    if (e) addRipple(e.currentTarget, e);
    const target = document.getElementById('aboutApp');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrollToMaker(e) {
    if (e) addRipple(e.currentTarget, e);
    const target = document.getElementById('inputForm');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

document.addEventListener('click', (e) => {
    const menu = document.getElementById('settingsMenu');
    if (menu && !menu.contains(e.target)) {
        menu.classList.remove('open');
    }
});

function prepareSheetPreview() {
    setPreviewMode('normal');
    const banner = document.getElementById('sealBanner');
    const title = document.getElementById('pageTitle');
    const intro = document.getElementById('aboutApp');
    const itemGuide = document.getElementById('itemGuide');
    const footer = document.querySelector('.page-footer');
    if (banner) banner.style.display = 'none';
    if (title) title.style.display = 'none';
    if (intro) intro.style.display = 'none';
    if (itemGuide) itemGuide.style.display = 'none';
    if (footer) footer.style.display = 'none';
}

function fitTextToContainer(textEl, containerEl, maxPx, minPx) {
    if (!textEl || !containerEl) return;
    textEl.style.fontSize = maxPx + 'px';
    textEl.style.lineHeight = '';
    let size = maxPx;
    while (size > minPx && containerEl.scrollHeight > containerEl.clientHeight + 1) {
        size -= 0.5;
        textEl.style.fontSize = size + 'px';
    }
}

function fitSheetText() {
    document.querySelectorAll('.desc-box').forEach(el => {
        el.style.fontSize = '20px';
        let size = 20;
        while (size > 12 && el.scrollHeight > el.clientHeight + 1) {
            size -= 0.5;
            el.style.fontSize = size + 'px';
        }
    });
    document.querySelectorAll('.theme-wrapper').forEach(wrapper => {
        fitTextToContainer(wrapper.querySelector('.chakra-text'), wrapper, 13, 9.5);
    });
}

/* ── RIPPLE ── */
function addRipple(btn, e) {
    const rect = btn.getBoundingClientRect();
    const r = document.createElement('span');
    r.className = 'ripple';
    const d = Math.max(rect.width, rect.height);
    r.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX-rect.left-d/2}px;top:${e.clientY-rect.top-d/2}px`;
    btn.appendChild(r);
    r.addEventListener('animationend', () => r.remove());
}

/* ── KIN CALCULATION (identical to original) ── */
function getBaseKinData(targetYear, month, day) {
    const isLeap = (targetYear%4===0 && targetYear%100!==0) || (targetYear%400===0);
    let cd = day;
    if (month===2 && cd===29) cd=28;
    const yearDiff = targetYear - 1939;
    let kinShift = (yearDiff*105)%260;
    if (kinShift<0) kinShift+=260;
    let jan1Kin = (248+kinShift)%260;
    const mo = [0,31,59,90,120,151,181,212,243,273,304,334];
    let kin = (jan1Kin + mo[month-1] + (cd-1));
    // 日本のマヤ暦計算では、うるう年の「3月」のみ+1補正が必要。
    // （KIN早見表の仕様：3月欄はうるう年でも非うるう年と同じ値になっているため）
    // 4月以降はmo[]の値がドリームスペル基準と一致するため補正不要。
    if (isLeap && month === 3) kin += 1;
    kin = kin%260;
    if (kin<=0) kin+=260;
    let tone = kin%13; if (tone===0) tone=13;
    let solarIndex = (kin-1)%20;
    let wsKin = kin-tone+1; if (wsKin<=0) wsKin+=260;
    let wsIndex = (wsKin-1)%20;
    return {kin,tone,solarIndex,wsIndex};
}

/* ── MAIN CALCULATE ── */
function calculateKin() {
    const name    = document.getElementById('username').value || 'ゲスト';
    const birthParts = getBirthDateParts();
    if (!birthParts) { alert("生年月日を選択してください。"); return; }
    const { birthYear, birthMonth, birthDay } = birthParts;
    const bd = getBaseKinData(birthYear, birthMonth, birthDay);

    let mirror   = 261 - bd.kin;
    let opposite = bd.kin<=130 ? bd.kin+130 : bd.kin-130;
    let solarChakraNum = (bd.solarIndex+1)%5;
    let wsChakraNum    = (bd.wsIndex+1)%5;
    let solarAnalog    = (17-bd.solarIndex+20)%20;
    let solarOccult    = 19-bd.solarIndex;
    let solarAntipode  = (bd.solarIndex+10)%20;
    const guideShifts  = [0,12,4,16,8];
    let shift          = guideShifts[(bd.tone-1)%5];
    let solarGuide     = (bd.solarIndex+shift)%20;
    let wsAnalog       = (17-bd.wsIndex+20)%20;
    let wsOccult       = 19-bd.wsIndex;
    let wsAntipode     = (bd.wsIndex+10)%20;

    let ekiIndex = Math.floor((bd.kin-1)/4);
    const ekiData = ekiList[ekiIndex];

    const today = new Date();
    const cy=today.getFullYear(), cm=today.getMonth()+1, cday=today.getDate();
    let tgtYear = cy;
    if (cm<birthMonth || (cm===birthMonth && cday<birthDay)) tgtYear--;
    const age = tgtYear - birthYear;
    let yearlyKin = (bd.kin+(age*105))%260; if (yearlyKin<=0) yearlyKin+=260;
    let yearlyTone = (bd.tone+age)%13; if (yearlyTone===0) yearlyTone=13;
    let yearlySolarIndex = (bd.solarIndex+(age*5))%20;
    let eraStartSolarIndex = (yearlySolarIndex-5*(yearlyTone-1))%20;
    if (eraStartSolarIndex<0) eraStartSolarIndex+=20;
    const yearlyEraColor = sealColors[eraStartSolarIndex%4];

    // Set text
    document.getElementById('resultName').innerText = 'マヤ暦セッション '+name+'さんのトリセツ';
    document.getElementById('resultDate').innerText = birthYear+'年'+birthMonth+'月'+birthDay+'日 生まれ';
    document.getElementById('resToneDesc').innerHTML = toneDescriptions[bd.tone-1];
    document.getElementById('resMirror').innerText = mirror;
    document.getElementById('resOpposite').innerText = opposite;
    document.getElementById('ekiName').innerText = ekiData.name;
    document.getElementById('ekiDesc').innerText = ekiData.desc;
    document.getElementById('solarName').innerText = seals[bd.solarIndex];
    document.getElementById('solarChakra').innerText = solarChakraNum+'系';
    document.getElementById('solarChakraDesc').innerText = chakraDescriptions[solarChakraNum];
    document.getElementById('solarDesc').innerHTML = sealDescriptions[seals[bd.solarIndex]];
    document.getElementById('solarImg').src = 'assets/ms'+(bd.solarIndex+1)+'.png';
    document.getElementById('solarGuide').innerText = seals[solarGuide];
    document.getElementById('solarAnalog').innerText = seals[solarAnalog];
    document.getElementById('solarOccult').innerText = seals[solarOccult];
    document.getElementById('solarAntipode').innerText = seals[solarAntipode];
    document.getElementById('wavespellName').innerText = seals[bd.wsIndex];
    document.getElementById('wsChakra').innerText = wsChakraNum+'系';
    document.getElementById('wavespellDesc').innerHTML = sealDescriptions[seals[bd.wsIndex]];
    document.getElementById('wavespellImg').src = 'assets/ms'+(bd.wsIndex+1)+'.png';
    document.getElementById('wsAnalog').innerText = seals[wsAnalog];
    document.getElementById('wsOccult').innerText = seals[wsOccult];
    document.getElementById('wsAntipode').innerText = seals[wsAntipode];
    document.getElementById('yearlyPeriod').innerText = tgtYear+'年'+birthMonth+'月'+birthDay+'日 〜';
    document.getElementById('yearlyKin').innerText = yearlyKin;
    document.getElementById('yearlyEra').innerText = yearlyEraColor+'の時代 '+yearlyTone+'年目';
    document.getElementById('resKin').innerText = bd.kin;
    document.getElementById('resTone').innerText = bd.tone;

    // Show sheet with animation
    const form    = document.getElementById('inputForm');
    const toolbar = document.getElementById('toolbar');
    const area    = document.getElementById('printArea');

    // Fade out form
    form.style.transition = 'opacity 0.4s, transform 0.4s';
    form.style.opacity = '0';
    form.style.transform = 'translateY(-16px)';
    setTimeout(() => {
        prepareSheetPreview();
        form.style.display = 'none';
        toolbar.style.display = 'flex';
        area.style.display = 'flex';
        fitSheetText();
        // Trigger reflow then add class
        void area.offsetWidth;
        area.classList.add('revealed');
    }, 420);
}

function handleCreateClick(e) {
    addRipple(e.currentTarget, e);
    calculateKin();
}

/* ── PDF DOWNLOAD ── */
const PDF_LIBS = {
    html2canvas: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
};
let activePdfUrl = '';

function loadScriptOnce(src, globalCheck) {
    if (globalCheck()) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const existing = document.querySelector('script[src="' + src + '"]');
        if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('script load failed')), { once: true });
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('script load failed'));
        document.head.appendChild(script);
    });
}

function isMobileOrInAppBrowser() {
    const ua = navigator.userAgent || '';
    const isTouchSmall = window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;
    const isInApp = /Line\/|FBAN|FBAV|Instagram|MicroMessenger|Twitter|GSA|CriOS\/.*Mobile/i.test(ua);
    const isIOS = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return isTouchSmall || isInApp || isIOS;
}

function showPrintLoading(message) {
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay ? overlay.querySelector('.loader-text') : null;
    if (text && message) text.textContent = message;
    if (overlay) overlay.classList.add('active');
}

function hidePrintLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('active');
}

function closePdfFallback() {
    const overlay = document.getElementById('pdfFallbackOverlay');
    if (overlay) overlay.classList.remove('active');
}

function showPdfFallback(url) {
    const overlay = document.getElementById('pdfFallbackOverlay');
    const link = document.getElementById('pdfOpenLink');
    if (!overlay || !link) return;
    link.href = url;
    overlay.classList.add('active');
}

async function createA4LandscapePdf() {
    const area = document.getElementById('printArea');
    if (!area || getComputedStyle(area).display === 'none') {
        throw new Error('sheet is not visible');
    }

    await Promise.all([
        loadScriptOnce(PDF_LIBS.html2canvas, () => !!window.html2canvas),
        loadScriptOnce(PDF_LIBS.jspdf, () => !!(window.jspdf && window.jspdf.jsPDF))
    ]);

    const previousScrollX = window.scrollX;
    const previousScrollY = window.scrollY;
    const wasFitPreview = document.body.classList.contains('fit-preview-mode');
    document.body.classList.remove('fit-preview-mode');
    document.body.classList.add('pdf-capture-mode');
    window.scrollTo(0, 0);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    fitSheetText();

    try {
        const canvas = await window.html2canvas(area, {
            backgroundColor: '#ffffff',
            scale: Math.min(2, window.devicePixelRatio || 1.5),
            useCORS: true,
            logging: false,
            width: area.offsetWidth,
            height: area.offsetHeight,
            windowWidth: area.offsetWidth,
            windowHeight: area.offsetHeight,
            scrollX: 0,
            scrollY: 0
        });
        const pdf = new window.jspdf.jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4',
            compress: true
        });
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 297, 210);
        return pdf.output('blob');
    } finally {
        document.body.classList.remove('pdf-capture-mode');
        if (wasFitPreview) {
            document.body.classList.add('fit-preview-mode');
            document.querySelectorAll('.desc-box, .chakra-text').forEach(el => {
                el.style.fontSize = '';
                el.style.lineHeight = '';
            });
        }
        window.scrollTo(previousScrollX, previousScrollY);
    }
}

async function openGeneratedPdf() {
    showPrintLoading('PDFを作成中...');
    try {
        const blob = await createA4LandscapePdf();
        const file = new File([blob], 'maya-session-sheet.pdf', { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: 'マヤ暦セッションシート' });
                return;
            } catch (shareErr) {
                if (shareErr && shareErr.name === 'AbortError') return;
            }
        }

        if (activePdfUrl) URL.revokeObjectURL(activePdfUrl);
        activePdfUrl = URL.createObjectURL(blob);
        const opened = window.open(activePdfUrl, '_blank', 'noopener');
        if (!opened) showPdfFallback(activePdfUrl);
    } catch (err) {
        console.error(err);
        alert('PDF作成に失敗しました。外部ブラウザで開いてから、もう一度「印刷する」を押してください。');
    } finally {
        hidePrintLoading();
    }
}

function downloadPDF(e) {
    addRipple(e.currentTarget, e);
    if (isMobileOrInAppBrowser()) {
        openGeneratedPdf();
        return;
    }
    window.print();
}


/* ── TAB SWITCH ── */
function switchTab(tab, e) {
    if (e) e.preventDefault();
    const isDate = tab === 'date';
    document.getElementById('panelDate').style.display = isDate ? '' : 'none';
    document.getElementById('panelKin').style.display  = isDate ? 'none' : '';
    document.getElementById('tabDate').classList.toggle('active', isDate);
    document.getElementById('tabKin').classList.toggle('active', !isDate);
}

/* ── KIN → シート生成 ── */
function handleKinClick(e) {
    addRipple(e.currentTarget, e);
    const name = document.getElementById('usernameKin').value || 'ゲスト';
    const kin  = parseInt(document.getElementById('kinInput').value, 10);

    if (!kin || kin < 1 || kin > 260) {
        alert('KINナンバーは1〜260で入力してください。');
        return;
    }

    // KINから tone・solarIndex・wsIndex を算出
    let tone = kin % 13; if (tone === 0) tone = 13;
    let solarIndex = (kin - 1) % 20;
    let wsKin = kin - tone + 1; if (wsKin <= 0) wsKin += 260;
    let wsIndex = (wsKin - 1) % 20;

    let mirror   = 261 - kin;
    let opposite = kin <= 130 ? kin + 130 : kin - 130;

    let solarChakraNum = (solarIndex + 1) % 5;
    let wsChakraNum    = (wsIndex + 1) % 5;

    let solarAnalog   = (17 - solarIndex + 20) % 20;
    let solarOccult   = 19 - solarIndex;
    let solarAntipode = (solarIndex + 10) % 20;
    const guideShifts = [0, 12, 4, 16, 8];
    let solarGuide    = (solarIndex + guideShifts[(tone - 1) % 5]) % 20;

    let wsAnalog   = (17 - wsIndex + 20) % 20;
    let wsOccult   = 19 - wsIndex;
    let wsAntipode = (wsIndex + 10) % 20;

    let ekiIndex = Math.floor((kin - 1) / 4);
    const ekiData = ekiList[ekiIndex];

    // 年回り：生年月日不明のため "-" 表示
    document.getElementById('resultName').innerText = 'マヤ暦セッション ' + name + 'さんのトリセツ';
    document.getElementById('resultDate').innerText = 'KIN ' + kin + ' からの作成';
    document.getElementById('resToneDesc').innerHTML = toneDescriptions[tone - 1];
    document.getElementById('resMirror').innerText   = mirror;
    document.getElementById('resOpposite').innerText = opposite;
    document.getElementById('ekiName').innerText = ekiData.name;
    document.getElementById('ekiDesc').innerText = ekiData.desc;
    document.getElementById('solarName').innerText      = seals[solarIndex];
    document.getElementById('solarChakra').innerText    = solarChakraNum + '系';
    document.getElementById('solarChakraDesc').innerText = chakraDescriptions[solarChakraNum];
    document.getElementById('solarDesc').innerHTML      = sealDescriptions[seals[solarIndex]];
    document.getElementById('solarImg').src             = 'assets/ms' + (solarIndex + 1) + '.png';
    document.getElementById('solarGuide').innerText    = seals[solarGuide];
    document.getElementById('solarAnalog').innerText   = seals[solarAnalog];
    document.getElementById('solarOccult').innerText   = seals[solarOccult];
    document.getElementById('solarAntipode').innerText = seals[solarAntipode];
    document.getElementById('wavespellName').innerText    = seals[wsIndex];
    document.getElementById('wsChakra').innerText         = wsChakraNum + '系';
    document.getElementById('wavespellDesc').innerHTML    = sealDescriptions[seals[wsIndex]];
    document.getElementById('wavespellImg').src           = 'assets/ms' + (wsIndex + 1) + '.png';
    document.getElementById('wsAnalog').innerText   = seals[wsAnalog];
    document.getElementById('wsOccult').innerText   = seals[wsOccult];
    document.getElementById('wsAntipode').innerText = seals[wsAntipode];
    document.getElementById('yearlyPeriod').innerText = '-';
    document.getElementById('yearlyKin').innerText    = '-';
    document.getElementById('yearlyEra').innerText    = '（生年月日入力で算出）';
    document.getElementById('resKin').innerText = kin;
    document.getElementById('resTone').innerText = tone;

    // アニメーション表示
    const form    = document.getElementById('inputForm');
    const toolbar = document.getElementById('toolbar');
    const area    = document.getElementById('printArea');
    const title   = document.getElementById('pageTitle');

    form.style.transition = 'opacity 0.4s, transform 0.4s';
    form.style.opacity = '0';
    form.style.transform = 'translateY(-16px)';
    setTimeout(() => {
        prepareSheetPreview();
        form.style.display = 'none';
        if (title) { title.style.display='none'; title.style.opacity=''; title.style.transition=''; }
        toolbar.style.display = 'flex';
        area.style.display = 'flex';
        fitSheetText();
        void area.offsetWidth;
        area.classList.add('revealed');
    }, 420);
}

/* ── RESET ── */
function resetForm(e) {
    addRipple(e.currentTarget, e);
    const form    = document.getElementById('inputForm');
    const toolbar = document.getElementById('toolbar');
    const area    = document.getElementById('printArea');

    area.style.transition = 'opacity 0.35s, transform 0.35s';
    area.style.opacity = '0';
    area.style.transform = 'scale(0.97)';
    setTimeout(() => {
        area.style.display  = 'none';
        area.style.opacity  = '';
        area.style.transform = '';
        area.classList.remove('revealed');
        document.body.classList.remove('fit-preview-mode');
        document.getElementById('layoutNormalBtn')?.classList.add('active');
        document.getElementById('layoutFitBtn')?.classList.remove('active');
        toolbar.style.display = 'none';
        form.style.display = 'block';
        form.style.opacity = '0';
        form.style.transform = 'translateY(-16px)';
        void form.offsetWidth;
        form.style.transition = 'opacity 0.4s, transform 0.4s';
        form.style.opacity = '1';
        form.style.transform = 'translateY(0)';
        const title2 = document.getElementById('pageTitle');
        if (title2) { title2.style.display='block'; title2.style.opacity='0'; void title2.offsetWidth; title2.style.transition='opacity 0.5s'; title2.style.opacity='1'; }
        const intro2 = document.getElementById('aboutApp');
        if (intro2) { intro2.style.display='grid'; intro2.style.opacity='0'; void intro2.offsetWidth; intro2.style.transition='opacity 0.5s'; intro2.style.opacity='1'; }
        const itemGuide2 = document.getElementById('itemGuide');
        if (itemGuide2) itemGuide2.style.display = 'block';
        const banner2 = document.getElementById('sealBanner');
        if (banner2) { banner2.style.display='block'; banner2.style.opacity='0'; void banner2.offsetWidth; banner2.style.transition='opacity 0.5s'; banner2.style.opacity='1'; }
        const footer2 = document.querySelector('.page-footer');
        if (footer2) footer2.style.display = 'block';
        setTimeout(() => form.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
        document.getElementById('username').value    = '';
        document.getElementById('birthYear').value  = '';
        document.getElementById('birthMonth').value = '';
        document.getElementById('birthDay').value   = '';
        document.getElementById('usernameKin').value = '';
        document.getElementById('kinInput').value    = '';
        switchTab('date', null);
    }, 360);
}
