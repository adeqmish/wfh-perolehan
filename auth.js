<script>
/* ====== CONFIG ====== */
const APPS_URL = 'https://script.google.com/macros/s/AKfycbx-aUvBo37bHqWb6to6zPubbHA29acZ9i4HBaBhlXt6uofoT-xGa0nLGY6LPkRNrBuQ/exec';

/* ====== Session ====== */
function saveSession(token, name, email){
  localStorage.setItem('wfh_token', token);
  if (name)  localStorage.setItem('wfh_name', name);
  if (email) localStorage.setItem('wfh_email', email);
}
function getToken(){ return localStorage.getItem('wfh_token'); }
function clearSession(){
  localStorage.removeItem('wfh_token');
  localStorage.removeItem('wfh_name');
  localStorage.removeItem('wfh_email');
  localStorage.removeItem('wfh_access'); // buang cache akses bila logout
}

/* ====== Network (hidden iframe) ====== */
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
    let data = ev.data;
    if (typeof data === 'string'){ try{ data = JSON.parse(data); }catch(_){} }
    if (!data || typeof data !== 'object') return;
    const src = data.source;
    if (src !== 'auth' && src !== 'po-pr-uploader') return;
    handled = true;
    window.removeEventListener('message', onMsg);
    if (cb) cb(data);
  };
  window.addEventListener('message', onMsg);

  document.body.appendChild(f);
  f.submit();
  setTimeout(()=>f.remove(), 0);

  setTimeout(()=>{ if (!handled && cb) cb({ok:false, message:'NO_MESSAGE'}); }, 8000);
}

/* ====== UI helpers (login) ====== */
function setLoginStatus(msg, ok){
  const el = document.getElementById('loginStatus');
  if (el){ el.textContent = msg || ''; el.className = 'status ' + (ok ? 'ok' : 'err'); }
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
  const btn = document.getElementById('loginBtn');
  if (btn) btn.disabled = false;
}

/* ====== Pages ====== */
function initLogin(){
  const form = document.getElementById('loginForm');
  if (!form) return;
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    setLoginStatus('', true);

    const email = form.email.value.trim();
    const password = form.password.value.trim();
    if (!email || !password){
      setLoginStatus('Isi emel & kata laluan.', false);
      hideLoginLoading(); return;
    }
    showLoginLoading('Mengesahkan akaun…');

    const base = location.origin + location.pathname.replace(/[^/]+$/, '');
    const returnTo = base + 'login.html';

    postViaIframe('login', {email, password, returnTo}, (res)=>{
      if (res && res.ok && res.kind==='login'){
        saveSession(res.token, res.name, res.email);
        // ambil akses selepas login
        postViaIframe('myaccess', {token: res.token}, (ax)=>{
          if (ax && ax.ok && Array.isArray(ax.access)){
            localStorage.setItem('wfh_access', JSON.stringify(ax.access));
          } else {
            localStorage.setItem('wfh_access', JSON.stringify([]));
          }
          hideLoginLoading();
          location.href = 'dashboard.html';
        });
      } else if (res && (res.message === 'KATA LALUAN SALAH' || res.message === 'AKAUN TIADA')) {
        hideLoginLoading();
        setLoginStatus(res.message === 'KATA LALUAN SALAH' ? 'Kata laluan salah.' : 'Akaun tidak ditemui.', false);
      } else if (res && res.message === 'NO_MESSAGE') {
        setLoginLoadingMessage('Mengalihkan…');
      } else {
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

/* ====== Auth guard (fetch access juga) ====== */
function ensureAuth(cb){
  const t = getToken();
  if (!t) { location.href = 'login.html'; return; }
  postViaIframe('verify', {token:t}, (res)=>{
    if (res && res.ok) {
      // cuba gunakan access dari verify; jika tiada, fallback panggil myaccess
      if (Array.isArray(res.access)){
        localStorage.setItem('wfh_access', JSON.stringify(res.access));
        if (cb) cb(res);
      } else {
        postViaIframe('myaccess', {token:t}, (ax)=>{
          if (ax && ax.ok && Array.isArray(ax.access)){
            localStorage.setItem('wfh_access', JSON.stringify(ax.access));
          } else {
            localStorage.setItem('wfh_access', JSON.stringify([]));
          }
          if (cb) cb(res);
        });
      }
    } else {
      clearSession(); location.href = 'login.html';
    }
  });
}

function logout(){
  const t = getToken();
  postViaIframe('logout', {token:t}, ()=>{ clearSession(); location.href = 'login.html'; });
}

/* ====== Change password ====== */
function changePassword(oldPassword, newPassword, cb){
  const token = getToken();
  if (!token){ location.href = 'login.html'; return; }
  if (!oldPassword || !newPassword){ if (cb) cb({ok:false, message:'MEDAN_TAK_LENGKAP'}); return; }
  postViaIframe('changepassword', { token, oldPassword, newPassword }, (res)=>{ if (cb) cb(res); });
}

/* ====== Admin helpers ====== */
const ADMIN_EMAIL = 'missyahrul@unisel.edu.my';
function isAdminEmail(email){
  return String(email || localStorage.getItem('wfh_email') || '').toLowerCase() === ADMIN_EMAIL;
}
function ensureAdminOrBack(backUrl){
  const e = localStorage.getItem('wfh_email') || '';
  if (!isAdminEmail(e)) { location.href = backUrl || 'dashboard.html'; }
}
function listUsers(cb){
  const token = getToken();
  postViaIframe('listusers', { token }, (res)=>{ if (cb) cb(res); });
}
function addUser(email, pages, cb){
  const token = getToken();
  // pages: array of keys → hantar JSON
  const accessJson = JSON.stringify(Array.isArray(pages)? pages : []);
  postViaIframe('adduser', { token, email, access: accessJson }, (res)=>{ if (cb) cb(res); });
}
function deleteUser(email, cb){
  const token = getToken();
  postViaIframe('deleteuser', { token, email }, (res)=>{ if (cb) cb(res); });
}
function updateUserAccess(email, pages, cb){
  const token = getToken();
  const accessJson = JSON.stringify(Array.isArray(pages)? pages : []);
  postViaIframe('updateaccess', { token, email, access: accessJson }, (res)=>{ if (cb) cb(res); });
}

/* ====== Helpers paparan ikut akses ====== */
function getMyAccess(){
  try{ return JSON.parse(localStorage.getItem('wfh_access')||'[]'); }catch(_){ return []; }
}
function canSee(key){ return getMyAccess().includes(key) || isAdminEmail(localStorage.getItem('wfh_email')); }

/* ====== Expose ====== */
window.WFH = {
  // umum
  initLogin, initForgot, ensureAuth, logout, getToken, changePassword,
  // admin
  isAdminEmail, ensureAdminOrBack, listUsers, addUser, deleteUser, updateUserAccess,
  // akses
  getMyAccess, canSee
};
</script>
