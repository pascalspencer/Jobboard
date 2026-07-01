
const STORAGE_KEY_JOBS = 'jobs-list';
const STORAGE_KEY_CONFIG = 'site-config';
const SHARED_STORAGE_URL = 'https://jsonblob.com/api/jsonBlob/019f1e01-a381-7cda-b295-ca85e6829680';

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function escapeHtml(s){return (s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function daysAgo(dateStr){
  const d=Math.floor((Date.now()-new Date(dateStr).getTime())/86400000);
  if(d<=0)return 'posted today';
  if(d===1)return 'posted yesterday';
  return 'posted '+d+'d ago';
}

function stripMarkdownImages(text){
  if(!text) return '';
  return text
    .split('\n')
    .map(line=>line.replace(/!\[[^\]]*\]\([^\)]*\)/g,'').trim())
    .filter(line=>line)
    .join('\n');
}

function cleanDescriptionText(text){
  if(!text) return '';
  text = stripMarkdownImages(text).replace(/<img[^>]*>/gi,'');
  return text
    .split('\n')
    .map(line=>line.trim())
    .map(line=>line.replace(/\*\*/g,'').replace(/\*\[/g,'[').replace(/\[\*/g,'[').replace(/\*(?=\S)/g,'').replace(/^#+\s*/,'').replace(/\[(.*?)\]\((.*?)\)/g,'$1').trim())
    .filter(line=>{
      if(!line) return false;
      if(/^URL Source:/i.test(line)) return false;
      if(/^Markdown Content:/i.test(line)) return false;
      if(/^!\[.*\]\(.*\)$/.test(line)) return false;
      if(/^(?:Title|Job Title|Job Type|Location|Job Summary|Job Description|Company):/i.test(line)) return false;
      if(/^Jobs?\s*·/i.test(line)) return false;
      if(/^Apply on Job$/i.test(line)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

function formatJobDescriptionHtml(text){
  if(!text) return '<p class="job-desc no-desc">No description provided.</p>';
  const lines=text.split('\n').map(line=>line.trim()).filter(Boolean);
  const sections=[];
  let current={title:'', content:[]};

  const normalizeMarkerLine=line=>line.replace(/^[\*\u2022\s]+|[\*\u2022\s]+$/g,'').trim();
  const isHeading=line=>/^(Required Skills(?: and Qualifications)?|About(?:\s+micro1)?|Scope of Work|Key Responsibilities|Required Skills and Qualifications|Preferred Qualifications)\s*:*/i.test(normalizeMarkerLine(line));
  const isRoleDetail=line=>/^(Role Title|Role Type|Location)\s*:/i.test(normalizeMarkerLine(line));
  const parseListItems=lines=>{
    const items=[];
    let currentItem='';
    lines.forEach(line=>{
      const match=line.match(/^\s*(?:\d+\.|[-*+]|•)\s+(.*)$/);
      if(match){
        if(currentItem) items.push(currentItem.trim());
        currentItem=match[1].trim();
      } else if(line.trim()){
        if(currentItem) currentItem += ' '+line.trim();
        else items.push(line.trim());
      }
    });
    if(currentItem) items.push(currentItem.trim());
    if(items.length<=1 && lines.length>1){
      const fallback=lines
        .map(line=>line.replace(/^\s*(?:\d+\.|[-*+]|•)?\s*/,'').trim())
        .filter(Boolean);
      if(fallback.length>1) return fallback;
    }
    return items;
  };

  lines.forEach(line=>{
    if(isHeading(line)){
      if(current.title || current.content.length) sections.push(current);
      current={title:line.replace(/:$/,'').trim(),content:[]};
    } else if(isRoleDetail(line)){
      if(current.title==='Role details' || (!current.title && !current.content.length)){
        current.title='Role details';
        current.content.push(line);
      } else {
        if(current.title || current.content.length) sections.push(current);
        current={title:'Role details',content:[line]};
      }
    } else {
      current.content.push(line);
    }
  });
  if(current.title || current.content.length) sections.push(current);

  const renderSection=section=>{
    const title=escapeHtml(section.title);
    const content=section.content;
    if(!section.title){
      return `<p>${escapeHtml(content.join(' '))}</p>`;
    }
    if(/^Role details$/i.test(section.title)){
      return `<div class="section"><h3>${title}</h3>${content.map(line=>{
        const m=line.match(/^(Role Title|Role Type|Location)\s*:\s*(.*)$/i);
        return m ? `<p><strong>${escapeHtml(m[1])}:</strong> ${escapeHtml(m[2])}</p>` : `<p>${escapeHtml(line)}</p>`;
      }).join('')}</div>`;
    }
    if(/^Scope of Work$/i.test(section.title)){
      const items=parseListItems(content);
      return `<div class="section"><h3>${title}</h3><ol>${items.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ol></div>`;
    }
    if(/^Required Skills$/i.test(section.title)){
      const skills=parseListItems(content).map(skill=>skill.replace(/^[:\-\d.]+\s*/,'').trim()).filter(Boolean);
      return `<div class="section"><h3>${title}</h3><p>${skills.map(skill=>escapeHtml(skill)).join(', ')}</p></div>`;
    }
    if(/^Required Skills and Qualifications$/i.test(section.title)){
      const items=parseListItems(content).map(item=>item.replace(/^[:\-\d.]+\s*/,'').trim()).filter(Boolean);
      return `<div class="section"><h3>${title}</h3><ol>${items.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ol></div>`;
    }
    if(/^Preferred Qualifications$/i.test(section.title)){
      const items=parseListItems(content).map(item=>item.replace(/^[:\-\d.]+\s*/,'').trim()).filter(Boolean);
      return `<div class="section"><h3>${title}</h3><ol>${items.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ol></div>`;
    }
    if(/^About\s+/i.test(section.title)){
      return `<div class="section"><h3>${title}</h3><p>${escapeHtml(content.join(' '))}</p></div>`;
    }
    if(/^(Key Responsibilities|Required Skills and Qualifications|Preferred Qualifications)$/i.test(section.title)){
      const items=parseListItems(content);
      return `<div class="section"><h3>${title}</h3><ol>${items.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ol></div>`;
    }
    return `<div class="section"><h3>${title}</h3><p>${escapeHtml(content.join(' '))}</p></div>`;
  };

  return sections.map(renderSection).join('');
}

function getStorage(){
  if(window.storage && typeof window.storage.get==='function' && typeof window.storage.set==='function'){
    return window.storage;
  }
  return {
    async get(key){
      try{
        const res=await fetch(SHARED_STORAGE_URL,{cache:'no-store'});
        if(!res.ok) throw new Error('shared storage unavailable');
        const data=await res.json();
        const value=data && Object.prototype.hasOwnProperty.call(data,key)?data[key]:null;
        if(value!==null && value!==undefined){
          return {value};
        }
      }catch(e){}
      return {value: localStorage.getItem(key)};
    },
    async set(key, value){
      try{
        let data={};
        try{
          const res=await fetch(SHARED_STORAGE_URL,{cache:'no-store'});
          if(res.ok){
            data=await res.json();
          }
        }catch(e){}
        data[key]=value;
        await fetch(SHARED_STORAGE_URL,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store'});
      }catch(e){}
      localStorage.setItem(key, value);
    }
  };
}

async function loadJobs(){
  try{
    const storage=getStorage();
    const r=await storage.get(STORAGE_KEY_JOBS,true);
    return r&&r.value?JSON.parse(r.value):[];
  }catch(e){return [];}
}
async function saveJobs(jobs){
  const storage=getStorage();
  await storage.set(STORAGE_KEY_JOBS,JSON.stringify(jobs),true);
}
async function loadConfig(){
  try{
    const storage=getStorage();
    const r=await storage.get(STORAGE_KEY_CONFIG,true);
    return r&&r.value?JSON.parse(r.value):null;
  }catch(e){return null;}
}
async function saveConfig(cfg){
  const storage=getStorage();
  await storage.set(STORAGE_KEY_CONFIG,JSON.stringify(cfg),true);
}

function getRoute(){
  const h=location.hash;
  if(h.startsWith('#jobspot')){
    const parts=h.split('/');
    return {admin:true, secret:parts[1]||''};
  }
  return {admin:false};
}

let state={jobs:[],config:null,search:'',tagFilter:null,showFilled:false,currentPage:0};

async function init(){
  state.jobs=await loadJobs();
  state.config=await loadConfig();
  render();
}
window.addEventListener('hashchange',render);

function render(){
  const route=getRoute();
  if(route.admin){
    renderAdmin(route.secret);
  }else{
    renderPublic();
  }
}

function allTags(){
  const set=new Set();
  state.jobs.forEach(j=>(j.tags||[]).forEach(t=>set.add(t)));
  return Array.from(set);
}

function renderPublic(){
  const app=document.getElementById('app');
  const q=state.search.trim().toLowerCase();
  let jobs=state.jobs.filter(j=>{
    if(!state.showFilled && j.status==='filled') return false;
    if(state.tagFilter && !(j.tags||[]).includes(state.tagFilter)) return false;
    if(q){
      const hay=(j.title+' '+j.company+' '+j.location+' '+j.description).toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
  jobs.sort((a,b)=>new Date(b.postedDate)-new Date(a.postedDate));
  
  if(state.currentPage*6>=jobs.length&&jobs.length>0)state.currentPage=Math.max(0,Math.ceil(jobs.length/6)-1);
  const totalPages=Math.ceil(jobs.length/6);
  const paginatedJobs=jobs.slice(state.currentPage*6,(state.currentPage+1)*6);

  const tags=allTags();

  app.innerHTML=`
    <div class="wrap">
      <header class="site">
        <p class="eyebrow">curated, updated as roles open</p>
        <h1 class="wordmark">Open Roles</h1>
        <p class="sub">A running list of opportunities worth a look. Click to apply directly.</p>
      </header>
      <div class="controls">
        <div class="controls-top">
          <input type="text" class="search" id="searchInput" placeholder="Search by title, company, or location" value="${escapeHtml(state.search)}">
        </div>
        <div class="tags-container">
          <span class="chip chip-static chip-wrapper ${state.tagFilter===null?'active':''}" data-tag="">All</span>
          <div class="tags-scroll">
            ${tags.map(t=>`<span class="chip chip-wrapper ${state.tagFilter===t?'active':''}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('')}
            <span class="chip chip-wrapper ${state.showFilled?'active':''}" id="toggleFilled">Show filled</span>
          </div>
        </div>
      </div>
      <div class="feed" id="feed"></div>
      ${totalPages>1?`<div class="pagination" id="pagination"></div>`:''}
      <footer class="site">curated by hand &middot; no listings are sponsored</footer>
    </div>
  `;

  const feed=document.getElementById('feed');
  if(jobs.length===0){
    feed.innerHTML=`<div class="empty"><h2>Nothing matches yet</h2><p>Try a different search or check back soon &mdash; new roles get added regularly.</p></div>`;
  }else{
    feed.innerHTML=paginatedJobs.map(j=>{
      const descText=cleanDescriptionText(j.description);
      const descHtml=formatJobDescriptionHtml(descText);
      const showMore=descText.length>320;
      return `
      <div class="card ${j.status==='filled'?'filled':''}">
        <div class="card-top">
          <div class="card-head">
            <h2 class="job-title">${escapeHtml(j.title)}</h2>
            <div class="company-row">
              <span class="company-name">${escapeHtml(j.company)}</span>
              ${j.location?`<span>${escapeHtml(j.location)}</span>`:''}
            </div>
          </div>
          <span class="stamp">${j.status==='filled'?'Filled':daysAgo(j.postedDate)}</span>
        </div>
        ${(j.tags&&j.tags.length)?`<div class="card-badges">${j.tags.slice(0,5).map(t=>`<span class="badge">${escapeHtml(t)}</span>`).join('')}</div>`:''}
        <div class="job-desc clamped" id="desc-${j.id}"><div class="job-detail">${descHtml}</div></div>
        ${showMore?`<button class="more-link" data-id="${j.id}">Read full description</button>`:''}
        <div class="card-footer">
          <div class="card-meta">
            <span>${j.tags&&j.tags.length?`${j.tags.length} required skills`: 'No skill tags'}</span>
            <span>${j.status==='filled'?'Closed':'Open'}</span>
          </div>
          <a class="apply-btn" href="${j.status==='filled'?'#':escapeHtml(j.referralLink)}" target="_blank" rel="noopener">${j.status==='filled'?'Filled':'Apply now'}</a>
        </div>
      </div>
      `;
    }).join('');
  }

  document.getElementById('searchInput').oninput=e=>{state.search=e.target.value;state.currentPage=0;render();};
  document.querySelectorAll('.chip[data-tag]').forEach(c=>{
    c.onclick=()=>{state.tagFilter=c.dataset.tag||null;state.currentPage=0;render();};
  });
  document.getElementById('toggleFilled').onclick=()=>{state.showFilled=!state.showFilled;state.currentPage=0;render();};
  document.querySelectorAll('.more-link').forEach(btn=>{
    btn.onclick=()=>{
      const el=document.getElementById('desc-'+btn.dataset.id);
      if(el.classList.contains('clamped')){
        el.classList.remove('clamped');
        el.classList.add('expanded');
        btn.textContent='Show less';
      } else {
        el.classList.add('clamped');
        el.classList.remove('expanded');
        btn.textContent='Read full description';
      }
    };
  });
  
  if(totalPages>1){
    const pag=document.getElementById('pagination');
    let html=`<button id="prevBtn" ${state.currentPage===0?'disabled':''}>← Prev</button>`;
    for(let i=0;i<totalPages;i++){
      html+=`<button class="page-btn ${state.currentPage===i?'active':''}" data-page="${i}">${i+1}</button>`;
    }
    html+=`<button id="nextBtn" ${state.currentPage===totalPages-1?'disabled':''}>Next →</button>`;
    pag.innerHTML=html;
    document.getElementById('prevBtn').onclick=()=>{if(state.currentPage>0){state.currentPage--;render();}};
    document.getElementById('nextBtn').onclick=()=>{if(state.currentPage<totalPages-1){state.currentPage++;render();}};
    document.querySelectorAll('.page-btn').forEach(btn=>{
      btn.onclick=()=>{state.currentPage=parseInt(btn.dataset.page);render();};
    });
  }
}

async function renderAdmin(secretFromUrl){
  const app=document.getElementById('app');

  if(!state.config){
    app.innerHTML=`
      <div class="admin-wrap">
        <div class="setup-box">
          <p class="eyebrow">first-time setup</p>
          <h1 class="wordmark" style="font-size:28px;">Claim admin access</h1>
          <p class="sub" style="margin:0 auto 20px;">Choose a private phrase. You'll bookmark a link containing it &mdash; that link is the only way in.</p>
          <div class="field" style="text-align:left;">
            <label>Admin phrase</label>
            <input type="password" id="newSecret" placeholder="something only you know">
          </div>
          <button class="primary" id="claimBtn">Save and continue</button>
        </div>
      </div>
    `;
    document.getElementById('claimBtn').onclick=async()=>{
      const v=document.getElementById('newSecret').value.trim();
      if(!v) return;
      await saveConfig({secret:v});
      state.config={secret:v};
      location.hash='#jobspot/'+encodeURIComponent(v);
      render();
    };
    return;
  }

  if(secretFromUrl!==state.config.secret){
    app.innerHTML=`
      <div class="admin-wrap">
        <div class="setup-box">
          <p class="eyebrow">admin</p>
          <h1 class="wordmark" style="font-size:28px;">Enter your phrase</h1>
          <div class="field" style="text-align:left;">
            <input type="password" id="checkSecret" placeholder="admin phrase">
          </div>
          <button class="primary" id="checkBtn">Continue</button>
        </div>
      </div>
    `;
    document.getElementById('checkBtn').onclick=()=>{
      const v=document.getElementById('checkSecret').value.trim();
      location.hash='#jobspot/'+encodeURIComponent(v);
      render();
    };
    return;
  }

  const secretUrl=location.origin+location.pathname+'#jobspot/'+encodeURIComponent(state.config.secret);

  app.innerHTML=`
    <div class="admin-bar">admin mode &mdash; keep this link private &middot; <a href="#" id="exitAdmin" style="color:#fff;">view public site</a></div>
    <div class="admin-wrap">
      <div class="admin-card">
        <h2>Bookmark this</h2>
        <p class="hint">This is your only way back into admin mode:</p>
        <a class="secret-url" href="${secretUrl}">${secretUrl}</a>
      </div>

      <div class="admin-card">
        <h2>Add a role</h2>
        <div class="field">
          <label>Job posting URL</label>
          <input type="url" id="fetchUrl" placeholder="https://company.com/careers/role">
        </div>
        <button class="ghost" id="fetchBtn">Pull details from URL</button>
        <p class="status-note" id="fetchStatus"></p>
        <div style="margin-top:18px;">
          <div class="field"><label>Job title</label><input type="text" id="f-title"></div>
          <div class="row2">
            <div class="field"><label>Company</label><input type="text" id="f-company"></div>
            <div class="field"><label>Location</label><input type="text" id="f-location"></div>
          </div>
          <div class="field"><label>Tags (comma-separated)</label><input type="text" id="f-tags" placeholder="remote, engineering, senior"></div>
          <div class="field"><label>Description</label><textarea id="f-desc"></textarea></div>
          <div class="field"><label>Your referral link (what people land on when they click Apply)</label><input type="url" id="f-link" placeholder="https://company.com/apply?ref=..."></div>
          <button class="primary" id="saveJobBtn">Publish role</button>
        </div>
      </div>

      <div class="admin-card">
        <h2>Live roles (${state.jobs.length})</h2>
        <div id="adminJobList"></div>
      </div>
    </div>
  `;

  document.getElementById('exitAdmin').onclick=(e)=>{e.preventDefault();location.hash='';render();};

  function clearJobForm(){
    document.getElementById('f-title').value='';
    document.getElementById('f-company').value='';
    document.getElementById('f-location').value='';
    document.getElementById('f-tags').value='';
    document.getElementById('f-desc').value='';
    document.getElementById('f-link').value='';
  }

  document.getElementById('fetchBtn').onclick=async()=>{
    const url=document.getElementById('fetchUrl').value.trim();
    const statusEl=document.getElementById('fetchStatus');
    if(!url){statusEl.textContent='Paste a URL first.';return;}
    statusEl.textContent='Fetching…';
    try{
      const res=await fetch('https://r.jina.ai/'+url);
      if(!res.ok) throw new Error('fetch failed');
      const text=await res.text();
      const originalLines=text.split(/\r?\n/);
      const trimmedLines=originalLines.map(l=>l.trim());
      let title='';
      let titleIndex=-1;
      for(let i=0;i<trimmedLines.length;i++){
        const stripped=trimmedLines[i].replace(/^#+\s*/,'');
        if(stripped.length>4 && stripped.length<120 && !stripped.startsWith('http')){title=stripped;titleIndex=i;break;}
      }
      let company='';
      try{ company=new URL(url).hostname.replace('www.','').split('.')[0]; company=company.charAt(0).toUpperCase()+company.slice(1); }catch(e){}
      const rawBody=originalLines.filter((line,index)=>{
        const trimmed=line.trim();
        if(index===titleIndex) return false;
        if(!trimmed) return true;
        if(/^https?:\/\//i.test(trimmed)) return false;
        return true;
      }).join('\n');
      const body=cleanDescriptionText(rawBody);

      document.getElementById('f-title').value=title;
      document.getElementById('f-company').value=company;
      document.getElementById('f-desc').value=body;
      statusEl.textContent='Pulled — check the fields below before publishing, auto-fetch is best-effort.';
    }catch(e){
      clearJobForm();
      statusEl.textContent="Couldn't auto-fetch this site. The form has been cleared so you can enter details manually.";
    }
  };

  document.getElementById('saveJobBtn').onclick=async()=>{
    const title=document.getElementById('f-title').value.trim();
    const link=document.getElementById('f-link').value.trim();
    if(!title || !link){alert('Title and referral link are required.');return;}
    const job={
      id:uid(),
      title,
      company:document.getElementById('f-company').value.trim(),
      location:document.getElementById('f-location').value.trim(),
      tags:document.getElementById('f-tags').value.split(',').map(t=>t.trim()).filter(Boolean),
      description:cleanDescriptionText(document.getElementById('f-desc').value.trim()),
      referralLink:link,
      status:'active',
      postedDate:new Date().toISOString()
    };
    state.jobs.push(job);
    await saveJobs(state.jobs);
    render();
  };

  renderAdminJobList();
}

function renderAdminJobList(){
  const list=document.getElementById('adminJobList');
  if(!list) return;
  const jobs=[...state.jobs].sort((a,b)=>new Date(b.postedDate)-new Date(a.postedDate));
  if(jobs.length===0){
    list.innerHTML='<p class="hint">No roles yet — add one above.</p>';
    return;
  }
  list.innerHTML=jobs.map(j=>`
    <div class="admin-job-row">
      <div class="info">
        <strong>${escapeHtml(j.title)}</strong>
        <p>${escapeHtml(j.company)} &middot; ${j.status==='filled'?'filled':'active'} &middot; ${daysAgo(j.postedDate)}</p>
      </div>
      <div class="actions">
        <button class="ghost" data-action="toggle" data-id="${j.id}">${j.status==='filled'?'Mark active':'Mark filled'}</button>
        <button class="danger" data-action="delete" data-id="${j.id}">Delete</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-action="toggle"]').forEach(btn=>{
    btn.onclick=async()=>{
      const job=state.jobs.find(j=>j.id===btn.dataset.id);
      job.status=job.status==='filled'?'active':'filled';
      await saveJobs(state.jobs);
      render();
    };
  });
  list.querySelectorAll('[data-action="delete"]').forEach(btn=>{
    btn.onclick=async()=>{
      if(!confirm('Delete this role permanently?')) return;
      state.jobs=state.jobs.filter(j=>j.id!==btn.dataset.id);
      await saveJobs(state.jobs);
      render();
    };
  });
}

init();

