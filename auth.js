// ====== CONFIG ======
const APPS_URL = 'https://script.google.com/macros/s/AKfycbx-aUvBo37bHqWb6to6zPubbHA29acZ9i4HBaBhlXt6uofoT-xGa0nLGY6LPkRNrBuQ/exec';

// ====== Helpers ======
function saveSession(token, name, email){
  localStorage.setItem('wfh_token', token);
  if (name)  localStorage.setItem('wfh_name', name);
  if (email) localStorage.setItem('wfh_email', email);
}
function getToken(){ return localStorage.getItem('wfh_token'); }
function clearSession(){ localStorage.removeItem('wfh_token'); localStorage.removeItem('wfh_name'); localStorage.removeItem('wfh_email'); }

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
  // Fallback: jika tiada mesej
  setTimeout(()=>{ if (!handled && cb) cb({ok:false, message:'NO_MESSAGE'}); }, 8000);
}

// ====== Pages ======
function initLogin(){
  const form = document.getElementById('loginForm');
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) return alert('Isi emel & kata laluan');

    // URL halaman login semasa (untuk fallback redirect)
    const base = location.origin + location.pathname.replace(/[^/]+$/, '');
    const returnTo = base + 'login.html';

    postViaIframe('login', {email, password, returnTo}, (res)=>{
      if (res && res.ok && res.kind==='login'){
        saveSession(res.token, res.name, res.email);
        location.href = 'dashboard.html';
      } else {
        alert('Login status: ' + (res && res.message ? res.message : 'Sila tunggu atau cuba lagi.'));
      }
    });
  });
}

function initForgot(){
  const form = document.getElementById('forgotForm');
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const email = form.email.value.trim();
    if (!email) return alert('Isi emel');
    postViaIframe('forgot', {email}, (res)=>{
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
