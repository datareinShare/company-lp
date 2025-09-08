// ==== 送信先（GAS Webアプリ） ====
// 直書きで管理（GitHub Pages等でもそのまま動作）
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxBVnwaQ4ue_qh0-dLw1tQyneVxfOk7E4FsnsQcXukkPuwkM8kpI9nsOdBfBhEm0UvLTw/exec';
const GAS_LIST_ENDPOINT = GAS_ENDPOINT; // GET: 企業一覧, POST: 問い合わせ

// カテゴリ→見た目クラスの対応（style.cssに準拠）
const CATEGORY_TO_CLASS = {
  // 新ラベル
  '健康': 'health',
  '食育': 'food',
  '運動': 'exercise',
  '美容': 'beauty',
  '終活': 'end',
  '財産管理': 'asset',
  '保険・ファイナンシャルプランナー': 'finance',
  '不動産': 'estate',
  '弁護士': 'legal',
  '司法書士': 'judge',
  '社労士': 'consultant',
  'メンタルヘルス': 'mental',
  '防犯': 'prevention',
  '旅行・観光': 'travel',
  'その他': 'others'
};

// 旧→新カテゴリ名の正規化（スプレッドシートが旧表記でも動くように）
function normalizeCategoryName(cat){
  const m = {
    '健康情報': '健康',
    '食育情報': '食育',
    '運動情報': '運動',
    '美容情報': '美容',
    '終活情報': '終活',
    '財産管理情報': '財産管理',
    '保険・ファイナンシャルプランナー情報': '保険・ファイナンシャルプランナー',
    '不動産情報': '不動産',
    '弁護士情報': '弁護士',
    '司法書士情報': '司法書士',
    '社労士情報': '社労士',
    '防犯情報': '防犯',
    '旅行・観光情報': '旅行・観光'
  };
  const c = String(cat || '').trim();
  return m[c] || c;
}

// ユーティリティ: デバウンス
function debounce(fn, delay = 200) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, args), delay); };
}
// ユーティリティ: 正規化（大文字/小文字・全半角の差を吸収）
function normalize(str) { return (str || '').toString().toLowerCase().normalize('NFKC'); }
function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// メイン処理
document.addEventListener('DOMContentLoaded', function() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabsBar = document.querySelector('.category-tabs');
  const tabsHint = document.querySelector('.tabs-hint');
  const tabsProgressBar = document.querySelector('.tabs-progress__bar');
  const companiesGrid = document.getElementById('companiesGrid');
  const searchInput = document.getElementById('freeword');
  const clearBtn = document.getElementById('clearSearch');
  const resultCount = document.getElementById('resultCount');

  let companyCards = document.querySelectorAll('.company-card');

  let activeCategory = 'all';

  // カード描画
  function mapCategoryToClass(cat){
    const norm = normalizeCategoryName(cat);
    return CATEGORY_TO_CLASS[norm] || 'others';
  }

  function createCompanyCard(item){
    const styleClass = (item.styleClass && String(item.styleClass).trim()) || mapCategoryToClass(item.category);
    const url = (item.url && String(item.url).trim()) || '#';
    const card = document.createElement('div');
    card.className = `company-card ${styleClass}`;
    const normalized = normalizeCategoryName(item.category || '');
    card.setAttribute('data-category', normalized || 'その他');
    card.innerHTML = `
      <h3 class="company-name"></h3>
      <p class="company-message"></p>
      <a href="${url}" class="company-link" target="_blank" rel="noopener">詳細を見る →</a>
    `;
    const nameEl = card.querySelector('.company-name');
    const msgEl = card.querySelector('.company-message');
    nameEl.textContent = item.name || '';
    msgEl.textContent = item.message || '';
    // ハイライト解除用の元テキスト保存
    nameEl.dataset.original = nameEl.textContent;
    msgEl.dataset.original = msgEl.textContent;
    return card;
  }

  function renderCompanies(rows){
    companiesGrid.innerHTML = '';
    rows.forEach(item => { companiesGrid.appendChild(createCompanyCard(item)); });
    companyCards = companiesGrid.querySelectorAll('.company-card');
    applyFilters();
  }

  async function loadCompanies(){
    // まずは通常のfetch（CORS許可環境で成功）
    try {
      const res = await fetch(`${GAS_LIST_ENDPOINT}?activeOnly=true`, { method: 'GET' });
      const json = await res.json();
      if (!json || json.ok !== true) throw new Error('Invalid response');
      const rows = Array.isArray(json.rows) ? json.rows : [];
      renderCompanies(rows);
      return;
    } catch (err) {
      console.warn('fetch失敗。JSONPフォールバックを試行します:', err);
    }

    // CORS回避：JSONPフォールバック
    await new Promise((resolve) => {
      const cbName = `companiesCallback_${Date.now()}`;
      const script = document.createElement('script');
      const url = `${GAS_LIST_ENDPOINT}?activeOnly=true&callback=${cbName}&t=${Date.now()}`;
      let done = false;
      window[cbName] = (json) => {
        done = true;
        try {
          if (json && json.ok === true && Array.isArray(json.rows)) {
            renderCompanies(json.rows);
          } else {
            throw new Error('Invalid JSONP response');
          }
        } catch (e) {
          console.error('JSONP処理エラー:', e);
          companiesGrid.innerHTML = '<p>企業情報の読み込みに失敗しました。時間をおいて再度お試しください。</p>';
          resultCount.textContent = '';
        } finally {
          cleanup();
          resolve();
        }
      };
      function cleanup(){
        try { delete window[cbName]; } catch(_) { window[cbName] = undefined; }
        if (script && script.parentNode) script.parentNode.removeChild(script);
      }
      script.src = url;
      script.onerror = () => {
        if (!done) {
          console.error('JSONPスクリプトの読み込みに失敗');
          companiesGrid.innerHTML = '<p>企業情報の読み込みに失敗しました。時間をおいて再度お試しください。</p>';
          resultCount.textContent = '';
          cleanup();
          resolve();
        }
      };
      document.head.appendChild(script);
    });
  }

  function highlightMatches(card, tokens){
    const nameEl = card.querySelector('.company-name');
    const msgEl = card.querySelector('.company-message');
    // いったん元に戻す
    nameEl.innerHTML = nameEl.dataset.original;
    msgEl.innerHTML = msgEl.dataset.original;
    if (!tokens.length) return;
    // 入力トークンでハイライト（単純置換）
    tokens.forEach(tok => {
      if(!tok) return;
      const re = new RegExp('(' + escapeRegExp(tok) + ')', 'gi');
      nameEl.innerHTML = nameEl.innerHTML.replace(re, '<mark>$1</mark>');
      msgEl.innerHTML = msgEl.innerHTML.replace(re, '<mark>$1</mark>');
    });
  }

  function matchesQuery(card, query){
    if (!query) return true;
    const name = card.querySelector('.company-name').textContent;
    const msg  = card.querySelector('.company-message').textContent;
    const source = normalize(name + ' ' + msg);
    const sourceNoSpace = source.replace(/\s+/g, '');

    const tokens = query.trim().split(/\s+/).map(t => normalize(t));
    // AND 検索：すべてのトークンが含まれる
    return tokens.every(tok => {
      const tokNoSpace = tok.replace(/\s+/g, '');
      return source.includes(tok) || sourceNoSpace.includes(tokNoSpace);
    });
  }

  function applyFilters(){
    const q = searchInput.value;
    const tokens = q.trim().length ? q.trim().split(/\s+/) : [];
    let visibleCount = 0;
    companyCards.forEach(card => {
      const categoryMatch = (activeCategory === 'all') || (card.getAttribute('data-category') === activeCategory);
      const queryMatch = matchesQuery(card, q);
      const show = categoryMatch && queryMatch;
      card.style.display = show ? 'block' : 'none';
      if (show) {
        visibleCount++;
        highlightMatches(card, tokens);
      } else {
        // 非表示にする際はハイライトを戻す
        const nameEl = card.querySelector('.company-name');
        const msgEl = card.querySelector('.company-message');
        nameEl.innerHTML = nameEl.dataset.original;
        msgEl.innerHTML = msgEl.dataset.original;
      }
    });
    resultCount.textContent = `該当 ${visibleCount} 件`;
  }

  // カテゴリタブの切り替え
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      activeCategory = this.getAttribute('data-category');
      tabButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      applyFilters();
    });
  });

  // 検索入力（デバウンス）
  if (searchInput) searchInput.addEventListener('input', debounce(applyFilters, 150));

  // クリアボタン
  if (clearBtn) clearBtn.addEventListener('click', () => { searchInput.value = ''; applyFilters(); searchInput.focus(); });

  // 初期表示（企業一覧は companiesGrid があるページのみ読み込み）
  if (companiesGrid) {
    loadCompanies();
  }

  // フォーム送信処理（GAS WebアプリへPOST）
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      // Honeypot（スパム対策）
      const hp = contactForm.querySelector('input[name="website"]');
      if (hp && hp.value.trim() !== '') { return; }

      const formData = new FormData(contactForm);
      const data = {}; for (let [key, value] of formData.entries()) { data[key] = value; }

      const submitBtn = contactForm.querySelector('.submit-btn');
      const statusEl = document.getElementById('formStatus');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true; submitBtn.textContent = '送信中…';
      if (statusEl) { statusEl.classList.remove('show', 'error'); statusEl.textContent = ''; }

      // GAS 側が受け取るパラメータ名にマッピング
      const payload = new URLSearchParams({
        subject: 'LP掲載申込み',
        name: data.companyName,
        category: data.category,
        message: data.message,
        lpUrl: data.lpUrl,
        managerName: data.contactName,
        emailaddressFrom: data.email,
        phoneNumber: data.phone || '',
        others: data.additionalInfo || ''
      });

      try {
        if (!GAS_ENDPOINT) throw new Error('GAS_ENDPOINT not configured');
        const res = await fetch(GAS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: payload.toString()
        });
        let ok = res.ok;
        let json = null;
        try { json = await res.json(); if (json && typeof json.ok !== 'undefined') ok = json.ok; } catch (_) {}

        if (!ok) throw new Error(`Request failed: ${res.status}`);

        if (statusEl) {
          statusEl.textContent = '送信が完了しました。担当者宛にメールをお届けしました。';
          statusEl.classList.remove('error');
          statusEl.classList.add('show');
        }
        contactForm.reset();
      } catch (err) {
        console.error('送信エラー:', err);
        if (statusEl) {
          statusEl.textContent = '送信に失敗しました。時間をおいて再度お試しください。';
          statusEl.classList.add('show', 'error');
        } else {
          alert('送信に失敗しました。時間をおいて再度お試しください。');
        }
      } finally {
        submitBtn.disabled = false; submitBtn.textContent = originalText;
      }
    });
  }

  // 企業リンクはそのまま遷移（target=_blank）。特別なハンドラは不要。
});
  // タブのスクロール余白・フェード制御とヒントの非表示
  function updateTabsUI(){
    if (!tabsBar) return;
    const max = Math.max(0, tabsBar.scrollWidth - tabsBar.clientWidth);
    const hasOverflow = max > 1;
    const left = hasOverflow && tabsBar.scrollLeft > 2;
    const right = hasOverflow && tabsBar.scrollLeft < (max - 2);
    tabsBar.classList.toggle('show-left', left);
    tabsBar.classList.toggle('show-right', right);
    // ヒントはオーバーフローなしなら非表示
    if (!hasOverflow && tabsHint) tabsHint.classList.add('hidden');
    // シークバー更新
    if (tabsProgressBar) {
      const visible = tabsBar.clientWidth;
      const total = Math.max(visible, tabsBar.scrollWidth);
      const ratioVisible = Math.min(1, visible / total);
      const maxMove = 1 - ratioVisible;
      const offset = max > 0 ? Math.min(1, tabsBar.scrollLeft / max) : 0;
      tabsProgressBar.style.width = `${Math.max(0.08, ratioVisible) * 100}%`;
      tabsProgressBar.style.transform = `translateX(${offset * maxMove * 100}%)`;
    }
  }

  if (tabsBar) {
    updateTabsUI();
    tabsBar.addEventListener('scroll', () => {
      updateTabsUI();
      if (tabsHint && !tabsHint.classList.contains('hidden')) tabsHint.classList.add('hidden');
    });
    window.addEventListener('resize', updateTabsUI);
    // タップ/クリックでもヒントを消す
    ['pointerdown','keydown'].forEach(ev => {
      tabsBar.addEventListener(ev, () => {
        if (tabsHint && !tabsHint.classList.contains('hidden')) tabsHint.classList.add('hidden');
        updateTabsUI();
      }, { passive: true });
    });
  }
