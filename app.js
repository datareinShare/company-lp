// ==== EmailJS 設定（ここをあなたの値に変更）====
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';
const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
// 送信先メールアドレス（指定のアドレスに変更）
const DEST_EMAIL = 'destination@example.com';

// 初期化（キーが設定された場合のみ）
window.addEventListener('DOMContentLoaded', () => {
  if (window.emailjs && EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }
});

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
  const companyCards = document.querySelectorAll('.company-card');
  const searchInput = document.getElementById('freeword');
  const clearBtn = document.getElementById('clearSearch');
  const resultCount = document.getElementById('resultCount');

  let activeCategory = 'all';

  // 元テキストを保存（ハイライト解除用）
  companyCards.forEach(card => {
    const nameEl = card.querySelector('.company-name');
    const msgEl = card.querySelector('.company-message');
    nameEl.dataset.original = nameEl.textContent;
    msgEl.dataset.original = msgEl.textContent;
  });

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

  // 初期表示
  applyFilters();

  // 既存：フォーム送信処理（EmailJS）
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

      const params = {
        to_email: DEST_EMAIL,
        company_name: data.companyName,
        category: data.category,
        message: data.message,
        lp_url: data.lpUrl,
        contact_name: data.contactName,
        email: data.email,
        phone: data.phone || '',
        additional_info: data.additionalInfo || ''
      };

      try {
        if (!window.emailjs) throw new Error('EmailJS not loaded');
        if (EMAILJS_PUBLIC_KEY === 'YOUR_PUBLIC_KEY') throw new Error('EmailJS keys not set');
        const result = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);
        console.log('EmailJS result:', result);
        statusEl.textContent = '送信が完了しました。担当者宛にメールをお届けしました。';
        contactForm.reset();
      } catch (err) {
        console.error('送信エラー:', err);
        alert('送信に失敗しました。時間をおいて再度お試しください。');
      } finally {
        submitBtn.disabled = false; submitBtn.textContent = originalText;
      }
    });
  }

  // 既存：リンククリック時（デモ用）
  document.querySelectorAll('.company-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      alert('実際のサービスでは、こちらから企業のLPページに遷移します。');
    });
  });
});
