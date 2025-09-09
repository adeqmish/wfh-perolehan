// ====== CONFIG ======
const APPS_URL = 'https://script.google.com/macros/s/AKfycbzvkp1QN24HwBU3R7Jy0S-g_E9577zW0Z2tFyEvQcReAfStf8XO5ygJpYQnoNwD4TTx/exec';

// ====== Helpers (session) ======
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
}

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

  // Fallback jika tiada postMessage
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
  const btn = document.getElementById('loginBtn');
  if (btn) btn.disabled = false;
}

// ====== Pages ======
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
      hideLoginLoading();
      return;
    }
    showLoginLoading('Mengesahkan akaun…');

    const base = location.origin + location.pathname.replace(/[^/]+$/, '');
    const returnTo = base + 'login.html';

    postViaIframe('login', {email, password, returnTo}, (res)=>{
      if (res && res.ok && res.kind==='login'){
        saveSession(res.token, res.name, res.email);
        hideLoginLoading();
        location.href = 'dashboard.html';
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

// ====== Password Change (dashboard modal) ======
function changePassword(oldPassword, newPassword, cb){
  const token = getToken();
  if (!token){ location.href = 'login.html'; return; }
  if (!oldPassword || !newPassword){
    if (cb) cb({ok:false, message:'MEDAN_TAK_LENGKAP'});
    return;
  }
  postViaIframe('changepassword', { token, oldPassword, newPassword }, (res)=>{
    if (cb) cb(res);
  });
}

// ====== Admin helpers & user management ======
const ADMIN_EMAIL = 'missyahrul@unisel.edu.my';
function isAdminEmail(email){
  return String(email || localStorage.getItem('wfh_email') || '').toLowerCase() === ADMIN_EMAIL;
}
function ensureAdminOrBack(backHref){
  const email = (localStorage.getItem('wfh_email')||'').toLowerCase();
  if (!isAdminEmail(email)) location.href = backHref || 'dashboard.html';
}

// List users (+access)
function listUsers(cb){
  const token = getToken();
  postViaIframe('listusers', { token }, (res)=>{ if (cb) cb(res); });
}

// Add user + access
function addUser(email, accessArray, cb){
  const token = getToken();
  const access = JSON.stringify(Array.isArray(accessArray)? accessArray : []);
  postViaIframe('adduser', { token, email, access }, (res)=>{ if (cb) cb(res); });
}

// Update access
function updateAccess(email, accessArray, cb){
  const token = getToken();
  const access = JSON.stringify(Array.isArray(accessArray)? accessArray : []);
  postViaIframe('updateaccess', { token, email, access }, (res)=>{ if (cb) cb(res); });
}

// Delete user
function deleteUser(email, cb){
  const token = getToken();
  postViaIframe('deleteuser', { token, email }, (res)=>{ if (cb) cb(res); });
}

// Get my access
function getAccess(cb){
  const token = getToken();
  postViaIframe('myaccess', { token }, (res)=>{ if (cb) cb(res); });
}

// Expose
window.WFH = {
  saveSession, getToken, clearSession,
  postViaIframe,
  setLoginStatus, showLoginLoading, setLoginLoadingMessage, hideLoginLoading,
  initLogin, initForgot,
  ensureAuth, logout,
  changePassword,
  ADMIN_EMAIL, isAdminEmail, ensureAdminOrBack,
  listUsers, addUser, updateAccess, deleteUser,
  getAccess
};
