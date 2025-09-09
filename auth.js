/* =========================================================
   SETTINGS (ubah ikut projek tuan)
   ========================================================= */
const APPS_URL = 'https://script.google.com/macros/s/AKfycbx853pMuyOtdpgXu_tOygPtxdVgcP1L-bh1Y6kqZhWju-tqu4SkKkj0CuL0aOALvQDc/exec';
const ADMIN_EMAILS = ['missyahrul@unisel.edu.my']; // tambah emel admin lain jika perlu

/* =========================================================
   UTILITIES: storage token & helpers
   ========================================================= */
if (!window.WFH) window.WFH = {};

WFH.getToken = function(){ try{ return localStorage.getItem('wfh_token') || ''; }catch(_){ return ''; } };
WFH.setToken = function(t){ try{ localStorage.setItem('wfh_token', t||''); }catch(_){ } };
WFH.setProfile = function(name,email){ try{
  if (name) localStorage.setItem('wfh_name', name);
  if (email) localStorage.setItem('wfh_email', email);
}catch(_){} };
WFH.logout = function(){
  try{ localStorage.removeItem('wfh_token'); }catch(_){}
  location.href = 'login.html';
};
WFH.isAdminEmail = function(email){
  email = String(email||'').toLowerCase();
  return ADMIN_EMAILS.map(e=>String(e).toLowerCase()).includes(email);
};

/* =========================================================
   postViaIframe: hantar ke Apps Script tanpa buka tab
   ========================================================= */
(function initIframePoster(){
  const IFM_ID = 'wfh_iframe_poster';
  const FORM_ID = 'wfh_form_poster';
  if (!document.getElementById(IFM_ID)) {
    const ifm = document.createElement('iframe');
    ifm.id = IFM_ID; ifm.name = IFM_ID; ifm.style.display='none';
    document.body.appendChild(ifm);
  }
  if (!document.getElementById(FORM_ID)){
    const form = document.createElement('form');
    form.id = FORM_ID; form.target = IFM_ID; form.method='POST'; form.action = APPS_URL; form.style.display='none';
    const input = document.createElement('input'); input.type='hidden'; input.name='payload'; input.id='wfh_payload';
    form.appendChild(input); document.body.appendChild(form);
  }

  window.postViaIframe = function(action, data, cb){
    function onMsg(ev){
      try{
        const d = ev.data || {};
        if (d && d.source === 'auth' && (d.kind === action || (d.kind||'').startsWith(action))) {
          window.removeEventListener('message', onMsg);
          cb && cb(d.result || d);
        }
      }catch(_){}
    }
    window.addEventListener('message', onMsg);

    const payload = JSON.stringify({ action, ...data });
    document.getElementById('wfh_payload').value = payload;
    document.getElementById('wfh_form_poster').submit();
  };
})();

/* =========================================================
   AUTH GUARD + LOGIN/FORGOT
   ========================================================= */
WFH.ensureAuth = function(onOk){
  const t = WFH.getToken();
  if (!t) { location.href = 'login.html'; return; }
  postViaIframe('ping', { token: t }, function(res){
    if (res && res.ok){
      const email = res.email || localStorage.getItem('wfh_email') || '';
      const name  = res.name  || localStorage.getItem('wfh_name')  || '';
      if (email) localStorage.setItem('wfh_email', email);
      if (name)  localStorage.setItem('wfh_name', name);
      onOk && onOk({email,name});
    } else {
      WFH.logout();
    }
  });
};

WFH.initLogin = function(){
  const form = document.getElementById('loginForm');
  const status = document.getElementById('loginStatus');
  const ov = document.getElementById('loginLoading');
  const msg = document.getElementById('loginLoadingMsg');

  function setStatus(m, ok){
    if (!status) return;
    status.textContent = m || '';
    status.className = 'status ' + (ok?'ok':'err');
  }

  form?.addEventListener('submit', function(e){
    e.preventDefault();
    const email = String(form.email.value || '').trim();
    const password = String(form.password.value || '').trim();
    if (!email || !password){ setStatus('Sila isi emel & kata laluan.', false); return; }

    ov?.classList.add('show'); if (msg) msg.textContent='Mengesahkan akaun…';
    postViaIframe('login', { email, password }, function(res){
      ov?.classList.remove('show');
      if (res && res.ok && res.token){
        WFH.setToken(res.token);
        WFH.setProfile(res.name, res.email);
        location.href = 'dashboard.html';
      } else {
        setStatus(res && res.message ? res.message : 'Gagal log masuk.', false);
      }
    });
  });
};

WFH.initForgot = function(){
  const form = document.getElementById('forgotForm');
  form?.addEventListener('submit', function(e){
    e.preventDefault();
    const email = String(form.email.value || '').trim();
    if (!email) return alert('Masukkan emel.');
    postViaIframe('forgot', { email }, function(res){
      if (res && res.ok){ alert('Jika emel wujud, pautan reset dihantar.'); location.href='login.html'; }
      else alert(res && res.message ? res.message : 'Gagal proses.');
    });
  });
};

WFH.changePassword = function(curr, next, cb){
  postViaIframe('change_password', { token: WFH.getToken(), curr, next }, function(res){
    cb && cb(res);
  });
};

WFH.getAccess = function(cb){
  postViaIframe('get_access', { token: WFH.getToken() }, function(res){
    cb && cb(res);
  });
};

/* =========================================================
   USER MANAGEMENT (Add Account page)
   ========================================================= */
WFH.addUser = function(email, access, cb){
  postViaIframe('add_user', { token: WFH.getToken(), email, access: access||[] }, function(res){ cb && cb(res); });
};
WFH.listUsers = function(cb){
  postViaIframe('list_users', { token: WFH.getToken() }, function(res){ cb && cb(res); });
};
WFH.updateAccess = function(email, access, cb){
  postViaIframe('update_access', { token: WFH.getToken(), email, access: access||[] }, function(res){ cb && cb(res); });
};
WFH.deleteUser = function(email, cb){
  postViaIframe('delete_user', { token: WFH.getToken(), email }, function(res){ cb && cb(res); });
};

/* =========================================================
   MODUL KELULUSAN PEROLEHAN
   ========================================================= */
const b64Strip = (s)=> String(s||'').replace(/^data:.*?;base64,/,'');

WFH.poSubmit = function(poNo, fileBase64, cb){
  postViaIframe('po_submit', { token: WFH.getToken(), poNo, fileBase64: b64Strip(fileBase64) }, function(res){ cb && cb(res); });
};
WFH.poListStatus = function(cb){
  postViaIframe('po_list_status', { token: WFH.getToken() }, function(res){ cb && cb(res); });
};
WFH.poListBendahari = function(cb){
  postViaIframe('po_list_bendahari', { token: WFH.getToken() }, function(res){ cb && cb(res); });
};
WFH.poBendahariSubmit = function(id, fileBase64, cb){
  postViaIframe('po_bendahari_submit', { token: WFH.getToken(), id, fileBase64: b64Strip(fileBase64) }, function(res){ cb && cb(res); });
};
WFH.poListNC = function(cb){
  postViaIframe('po_list_nc', { token: WFH.getToken() }, function(res){ cb && cb(res); });
};
WFH.poNCSubmit = function(id, fileBase64, cb){
  postViaIframe('po_nc_submit', { token: WFH.getToken(), id, fileBase64: b64Strip(fileBase64) }, function(res){ cb && cb(res); });
};
WFH.poComplete = function(id, cb){
  postViaIframe('po_complete', { token: WFH.getToken(), id }, function(res){ cb && cb(res); });
};
WFH.poListReport = function(cb){
  postViaIframe('po_list_report', { token: WFH.getToken() }, function(res){ cb && cb(res); });
};
