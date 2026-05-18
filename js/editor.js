/* ── TEXT EDITOR ── */

// <br> ⇔ 改行 変換（textareaで見やすく編集するため）
function _toDisplay(html) { return (html || '').replace(/<br\s*\/?>/gi, '\n'); }
function _toHtml(text)    { return (text || '').replace(/\n/g, '<br>'); }

let _currentEditTab = 'seals';
const _editTabDefs = [
    { id: 'seals',   label: '太陽の紋章（20種）' },
    { id: 'tones',   label: '銀河の音（13種）'   },
    { id: 'chakras', label: 'チャクラ（5種）'     },
    { id: 'eki',     label: '易（65卦）'          },
];

function openEditModal() {
    _buildEditUI();
    document.getElementById('editOverlay').classList.add('active');
}
function closeEditModal() {
    document.getElementById('editOverlay').classList.remove('active');
}

function _buildEditUI() {
    // タブヘッダー生成
    document.getElementById('editTabsEl').innerHTML = _editTabDefs.map(t =>
        `<button class="edit-tab-btn${t.id===_currentEditTab?' active':''}"
         onclick="switchEditTab('${t.id}',this)">${t.label}</button>`
    ).join('');

    // 各セクション生成
    const sealsHtml = seals.map(name => `
        <div class="edit-item">
            <label>${name}</label>
            <textarea rows="3" data-type="seal" data-key="${name}">${_toDisplay(sealDescriptions[name])}</textarea>
        </div>`).join('');

    const tonesHtml = toneDescriptions.map((desc, i) => `
        <div class="edit-item">
            <label>銀河の音 ${i+1}</label>
            <textarea rows="3" data-type="tone" data-key="${i}">${_toDisplay(desc)}</textarea>
        </div>`).join('');

    const chakraLabels = ['0系：頭部', '1系：喉', '2系：心臓', '3系：腹', '4系：生殖'];
    const chakrasHtml = [0,1,2,3,4].map(k => `
        <div class="edit-item">
            <label>${chakraLabels[k]}</label>
            <textarea rows="3" data-type="chakra" data-key="${k}">${_toDisplay(chakraDescriptions[k])}</textarea>
        </div>`).join('');

    const ekiHtml = ekiList.map((e, i) => `
        <div class="edit-item">
            <label>易 ${i+1}</label>
            <div class="edit-eki-grid">
                <textarea rows="2" data-type="eki-name" data-key="${i}" placeholder="卦の名前">${e.name}</textarea>
                <textarea rows="2" data-type="eki-desc" data-key="${i}" placeholder="説明文">${e.desc}</textarea>
            </div>
        </div>`).join('');

    document.getElementById('editScrollArea').innerHTML = `
        <div class="edit-section${_currentEditTab==='seals'  ?' active':''}" id="edit-seals"  >${sealsHtml}</div>
        <div class="edit-section${_currentEditTab==='tones'  ?' active':''}" id="edit-tones"  >${tonesHtml}</div>
        <div class="edit-section${_currentEditTab==='chakras'?' active':''}" id="edit-chakras">${chakrasHtml}</div>
        <div class="edit-section${_currentEditTab==='eki'    ?' active':''}" id="edit-eki"    >${ekiHtml}</div>
    `;
    document.getElementById('editScrollArea').scrollTop = 0;
}

function switchEditTab(tab, btn) {
    _currentEditTab = tab;
    document.querySelectorAll('.edit-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.edit-section').forEach(s => s.classList.remove('active'));
    document.getElementById('edit-' + tab).classList.add('active');
    document.getElementById('editScrollArea').scrollTop = 0;
}

async function saveEdits() {
    // textareaの値をデータ配列に書き戻す
    document.querySelectorAll('[data-type="seal"]').forEach(el => {
        sealDescriptions[el.dataset.key] = _toHtml(el.value);
    });
    document.querySelectorAll('[data-type="tone"]').forEach(el => {
        toneDescriptions[parseInt(el.dataset.key)] = _toHtml(el.value);
    });
    document.querySelectorAll('[data-type="chakra"]').forEach(el => {
        chakraDescriptions[el.dataset.key] = _toHtml(el.value);
    });
    document.querySelectorAll('[data-type="eki-name"]').forEach(el => {
        ekiList[parseInt(el.dataset.key)].name = el.value;
    });
    document.querySelectorAll('[data-type="eki-desc"]').forEach(el => {
        ekiList[parseInt(el.dataset.key)].desc = el.value;
    });

    // PATが未設定の場合はトークン入力ダイアログを表示
    if (!_ghToken) {
        openTokenModal();
        return;
    }

    await _doSaveToGitHub();
}

async function _doSaveToGitHub() {
    const saveBtn = document.querySelector('.efbtn-save');
    const origText = saveBtn.textContent;
    saveBtn.textContent = '⏳ 保存中...';
    saveBtn.disabled = true;

    try {
        const payload = { sealDescriptions, toneDescriptions, chakraDescriptions, ekiList };
        const jsonString = JSON.stringify(payload, null, 2);
        await writeDataToGitHub(jsonString);
        closeEditModal();
        showToast('✅ GitHubに保存しました！', 'success');
    } catch(e) {
        console.error('save error:', e);
        const msg = e.message || '';
        if (msg.includes('401') || msg.includes('Bad credentials')) {
            _ghToken = '';
            showToast('🔐 認証エラー。PATを確認してください。', 'error');
            openTokenModal();
        } else if (msg.includes('404')) {
            showToast('❌ ファイルが見つかりません。GITHUB_FILE の設定を確認してください。', 'error');
        } else {
            showToast('❌ 保存に失敗しました: ' + msg, 'error');
        }
    } finally {
        saveBtn.textContent = origText;
        saveBtn.disabled = false;
    }
}

async function resetEdits() {
    if (!confirm('GitHubから最新データを再読み込みしますか？\n（編集中の内容は破棄されます）')) return;
    closeEditModal();
    await initApp();
    showToast('🔄 データを再読み込みしました。', 'success');
}

/* ── TOKEN MODAL ── */
function openTokenModal() {
    document.getElementById('tokenOverlay').classList.add('active');
    document.getElementById('tokenInput').focus();
}
function closeTokenModal() {
    document.getElementById('tokenOverlay').classList.remove('active');
}
async function confirmToken() {
    const val = document.getElementById('tokenInput').value.trim();
    if (!val) { showToast('PATを入力してください。', 'error'); return; }
    _ghToken = val;
    document.getElementById('tokenInput').value = '';
    closeTokenModal();
    // SHAを再取得してから保存
    await fetchGhFileSha();
    await _doSaveToGitHub();
}
function clearToken() {
    _ghToken = '';
    showToast('🔒 認証情報をクリアしました。', 'success');
    closeTokenModal();
}

/* ── TOAST NOTIFICATION ── */
function showToast(msg, type = 'success') {
    let toast = document.getElementById('ghToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'ghToast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = 'gh-toast gh-toast-' + type + ' show';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
}
