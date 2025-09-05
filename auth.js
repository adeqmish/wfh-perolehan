// ====== CONFIG ======
const APPS_URL = 'https://script.google.com/macros/s/AKfycbx-aUvBo37bHqWb6to6zPubbHA29acZ9i4HBaBhlXt6uofoT-xGa0nLGY6LPkRNrBuQ/exec';

// ====== Helpers (session) ======
function saveSession(token, name, email){
  localStorage.setItem('wfh_token', token);
  if (name)  localStorage.setItem('wfh_name', name);
  if (email) localStorage.setItem('wfh_email', email);
}
function getToken(){ return localStorage.getItem('wfh_token'); }
function clearSession(){ localStorage.removeItem('wfh_token'); localStorage.removeItem('wfh_name'); localStorage.removeItem('wfh_email'); }

// ====== Helpers (network via hidden iframe) ======
function postViaIframe(action, fields = {}, cb){
  const iframeName = 'authFrame';
  let ifr = document.getElementById(iframeName);
  if (!ifr){
    ifr = document.createElement('iframe');
    ifr.style.display = 'none';
    ifr.name = iframeName; ifr.id = iframeName;
    document.body.appendChild(ifr);
  }
  const f = document.createElement('form');
  f.method = 'POST';
  f.action = APPS_URL;
  f.target = iframeName;
  const add = (k,v)=>{ const i=document.createElement('input'); i.type='hidden'; i.name=k; i.value=v; f.appendChild(i); };
  add('action', action);
  Object.keys(fields).forEach(k=> add(k, fields[k]));

  let handled = false;
  const onMsg = (ev)=>{
    let data = ev.data; if (typeof data === 'string'){ try{ data = JSON.parse(data); }catch(_){} }
    if (!data || typeof data !== 'object') return;
    const src = data.source;
    if (src !== 'auth' && src !== 'po-pr-uploader') return;
    handled = true;
    window.removeEventListener('message', onMsg);
    if (cb) cb(data);
  };
  window.addEventListener('message', onMsg);

  document.body.appendChild(f); f.submit(); setTimeout(()=>f.remove(), 0);
  // Fallback: jika tiada mesej (contoh: redirect fallback digunakan)
  setTimeout(()=>{ if (!handled && cb) cb({ok:false, message:'NO_MESSAGE'}); }, 8000);
}

// ====== UI helpers (login page) ======
function setLoginStatus(msg, ok){
  const el = document.getElementById('loginStatus');
  if (el){
    el.textContent = msg || '';
    el.className = 'status ' + (ok ? 'ok' : 'err');
  }
}
function showLoginLoading(msg){
  const overlay = document.getElementById('loginLoading');
  const m = document.getElementById('loginLoadingMsg');
  if (m && msg) m.textContent = msg;
  if (overlay) overlay.classList.add('show');
}
function setLoginLoadingMessage(msg){
  const m = document.getElementById('loginLoadingMsg');
  if (m && msg) m.textContent = msg;
}
function hideLoginLoading(){
  const overlay = document.getElementById('loginLoading');
  if (overlay) overlay.classList.remove('show');
}

// ====== Pages ======
function initLogin(){
  const form = document.getElementById('loginForm');
  if (!form) return;
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    setLoginStatus('', true);

    const email = form.email.value.trim();
    const password = form.password.value.trim(); // penting: trim
    if (!email || !password){
      setLoginStatus('Isi emel & kata laluan.', false);
      return;
    }

    // Tunjuk loading
    showLoginLoading('Mengesahkan akaun…');

    // URL halaman login semasa (untuk fallback redirect)
    const base = location.origin + location.pathname.replace(/[^/]+$/, '');
    const returnTo = base + 'login.html';

    postViaIframe('login', {email, password, returnTo}, (res)=>{
      if (res && res.ok && res.kind==='login'){
        // postMessage berjaya
        saveSession(res.token, res.name, res.email);
        hideLoginLoading();
        location.href = 'dashboard.html';
      } else if (res && (res.message === 'KATA LALUAN SALAH' || res.message === 'AKAUN TIADA')) {
        // Gagal auth sebenar
        hideLoginLoading();
        setLoginStatus(res.message === 'KATA LALUAN SALAH' ? 'Kata laluan salah.' : 'Akaun tidak ditemui.', false);
      } else if (res && res.message === 'NO_MESSAGE') {
        // Kemungkinan fallback redirect sedang berlaku
        setLoginLoadingMessage('Mengalihkan…');
        // Biarkan overlay terpapar sehingga halaman redirect sendiri
      } else {
        // Ralat umum
        hideLoginLoading();
        setLoginStatus('Login gagal. Cuba lagi.', false);
      }
    });
  });
}

function initForgot(){
  const form = document.getElementById('forgotForm');
  if (!form) return;
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const email = form.email.value.trim();
    if (!email) { alert('Isi emel'); return; }
    postViaIframe('forgot', {email}, ()=>{
      alert('Jika emel wujud, kata laluan baharu telah dihantar.');
      location.href = 'login.html';
    });
  });
}

function ensureAuth(cb){
  const t = getToken();
  if (!t) { location.href = 'login.html'; return; }
  postViaIframe('verify', {token:t}, (res)=>{
    if (res && res.ok) { if (cb) cb(res); }
    else { clearSession(); location.href = 'login.html'; }
  });
}

function logout(){
  const t = getToken();
  postViaIframe('logout', {token:t}, ()=>{ clearSession(); location.href = 'login.html'; });
}

// Expose globally
window.WFH = { initLogin, initForgot, ensureAuth, logout, getToken };
