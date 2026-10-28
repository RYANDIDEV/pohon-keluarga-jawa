const viewport = document.getElementById('treeViewport');
const canvas = document.getElementById('treeCanvas');
let scale = 1, panning = false, pointX = 0, pointY = 0, startX = 0, startY = 0;

let activeTreeId = localStorage.getItem('activeTreeId') || null;

let draggingPersonId = null;
let personDragStartX = 0, personDragStartY = 0;
let personInitialOffsetX = 0, personInitialOffsetY = 0;

function setTransform() { canvas.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`; }

function findNodeByUniqueId(id) {
    for (let f of family) {
        if (f.id === id) return f;
        if (f.spouses) {
            for (let s of f.spouses) {
                if (s.id === id) return s;
                if (s.siblings) {
                    for (let sib of s.siblings) {
                        if (sib.id === id) return sib;
                    }
                }
            }
        }
    }
    return null;
}

window.startDragPerson = function(e, id) {
    e.stopPropagation(); 
    draggingPersonId = id;
    let personNode = findNodeByUniqueId(id);
    if (!personNode) return;

    personInitialOffsetX = personNode.offsetX || 0;
    personInitialOffsetY = personNode.offsetY || 0;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    personDragStartX = clientX / scale;
    personDragStartY = clientY / scale;
};

viewport.onmousedown = function (e) {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    e.preventDefault(); startX = e.clientX - pointX; startY = e.clientY - pointY; panning = true;
}
viewport.onmouseup = function () { panning = false; if(draggingPersonId) { saveAndRender(); draggingPersonId = null; } }
viewport.onmouseleave = function () { panning = false; if(draggingPersonId) { saveAndRender(); draggingPersonId = null; } }

viewport.onmousemove = function (e) {
    if (draggingPersonId) {
        e.preventDefault();
        const dx = (e.clientX / scale) - personDragStartX;
        const dy = (e.clientY / scale) - personDragStartY;
        let personNode = findNodeByUniqueId(draggingPersonId);
        if (personNode) {
            personNode.offsetX = personInitialOffsetX + dx;
            personNode.offsetY = personInitialOffsetY + dy;
            const el = document.getElementById(`person-${draggingPersonId}`);
            if (el) el.style.transform = `translate(${personNode.offsetX}px, ${personNode.offsetY}px)`;
            updateSvgLines(); 
        }
        return;
    }
    if (!panning) return; 
    pointX = e.clientX - startX; pointY = e.clientY - startY;
    setTransform();
}

viewport.ontouchstart = function (e) {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'SELECT') return;
    if (e.touches.length === 1) { startX = e.touches[0].clientX - pointX; startY = e.touches[0].clientY - pointY; panning = true; }
}
viewport.ontouchmove = function (e) {
    if (draggingPersonId && e.touches.length === 1) {
        e.preventDefault();
        const dx = (e.touches[0].clientX / scale) - personDragStartX;
        const dy = (e.touches[0].clientY / scale) - personDragStartY;
        let personNode = findNodeByUniqueId(draggingPersonId);
        if (personNode) {
            personNode.offsetX = personInitialOffsetX + dx;
            personNode.offsetY = personInitialOffsetY + dy;
            const el = document.getElementById(`person-${draggingPersonId}`);
            if (el) el.style.transform = `translate(${personNode.offsetX}px, ${personNode.offsetY}px)`;
            updateSvgLines();
        }
        return;
    }
    if (!panning || e.touches.length !== 1) return; e.preventDefault();
    pointX = e.touches[0].clientX - startX; pointY = e.touches[0].clientY - startY;
    setTransform();
}
viewport.ontouchend = function () { panning = false; if(draggingPersonId) { saveAndRender(); draggingPersonId = null; } }

viewport.onwheel = function (e) {
    e.preventDefault(); const xs = (e.clientX - pointX) / scale, ys = (e.clientY - pointY) / scale;
    const delta = (e.deltaY > 0) ? -0.1 : 0.1; scale += delta; scale = Math.min(Math.max(0.3, scale), 3);
    pointX = e.clientX - xs * scale; pointY = e.clientY - ys * scale;
    setTransform();
}

window.zoomCanvas = function(delta) { scale += delta; scale = Math.min(Math.max(0.3, scale), 3); setTransform(); }
window.resetZoom = function() { 
    scale = 1; 
    const viewRect = viewport.getBoundingClientRect();
    pointX = viewRect.width / 2 - 100; pointY = 50; 
    setTransform(); 
}

let family = JSON.parse(localStorage.getItem('familyData')) || [];
let historyStack = JSON.parse(localStorage.getItem('familyHistory')) || [];

function pushHistory() {
    try {
        historyStack.push(JSON.stringify(family));
        if (historyStack.length > 20) historyStack.shift();
        localStorage.setItem('familyHistory', JSON.stringify(historyStack));
    } catch(e) { console.error(e); }
}

window.undoAction = function() {
    if (historyStack.length === 0) { alert("Tidak ada aksi untuk di-undo!"); return; }
    const previousState = historyStack.pop();
    family = JSON.parse(previousState);
    localStorage.setItem('familyHistory', JSON.stringify(historyStack));
    saveAndRender();
}

window.resetPositions = function() {
    if(confirm("Kembalikan semua kotak di keluarga ini ke susunan rapi otomatis?")) {
        pushHistory();
        family.forEach(f => {
            if (f.treeId === activeTreeId || f.id === activeTreeId) {
                f.offsetX = 0; f.offsetY = 0;
                if(f.spouses) {
                    f.spouses.forEach(s => { 
                        s.offsetX = 0; s.offsetY = 0; 
                        if (s.siblings) s.siblings.forEach(sib => { sib.offsetX = 0; sib.offsetY = 0; });
                    });
                }
            }
        });
        saveAndRender();
    }
}

document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undoAction(); }
});

let groupedForOrder = {};
family.forEach(f => {
    if (!f.gender) f.gender = 'L'; 
    if (f.spouses) { 
        f.spouses = f.spouses.map((s, idx) => { 
            if (!s.gender) s.gender = 'P'; 
            if (!s.spouseOrder) s.spouseOrder = idx + 1; 
            if (!s.siblings) s.siblings = []; 
            return s; 
        }); 
        f.spouses.sort((a, b) => a.spouseOrder - b.spouseOrder);
    }
    if (!f.parentId && f.posX === undefined) { f.posX = 0; f.posY = 0; }
    
    let key = f.parentId || 'root_' + f.treeId;
    if (!groupedForOrder[key]) groupedForOrder[key] = [];
    groupedForOrder[key].push(f);
});

for (let key in groupedForOrder) {
    groupedForOrder[key].sort((a,b) => family.indexOf(a) - family.indexOf(b));
    groupedForOrder[key].forEach((f, idx) => {
        if (f.childOrder === undefined) f.childOrder = idx + 1;
    });
}

let currentAction = null, targetNodeId = null, targetSpouseId = null;

function renderSidebar() {
    const sidebarList = document.getElementById('sidebarList');
    const treeGroups = {};
    family.forEach(f => {
        if (!f.parentId) {
            if (!treeGroups[f.treeId]) treeGroups[f.treeId] = f;
        }
    });
    const roots = Object.values(treeGroups);
    
    if (roots.length === 0) {
        sidebarList.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size: 13px; margin-top:20px;">Belum ada keluarga.</p>';
        document.getElementById('activeTreeTitle').textContent = 'Bagan Kosong';
        return;
    }

    if (!activeTreeId || !roots.some(r => r.treeId === activeTreeId)) {
        activeTreeId = roots[0].treeId;
        localStorage.setItem('activeTreeId', activeTreeId);
    }

    let html = '';
    roots.forEach(r => {
        const isActive = r.treeId === activeTreeId ? 'active' : '';
        html += `<button class="sidebar-btn ${isActive}" onclick="switchTab('${r.treeId}')">🌳 Keluarga ${r.name}</button>`;
        if (r.treeId === activeTreeId) {
            document.getElementById('activeTreeTitle').textContent = `Keluarga ${r.name}`;
        }
    });
    sidebarList.innerHTML = html;
}

window.switchTab = function(id) {
    activeTreeId = id;
    localStorage.setItem('activeTreeId', id);
    resetZoom();
    saveAndRender();
}

function saveAndRender() {
    localStorage.setItem('familyData', JSON.stringify(family));
    renderSidebar();
    renderTree();
}

function getSortedSiblings(parentId) {
    let activeFamily = family.filter(f => f.treeId === activeTreeId);
    let siblingsList = activeFamily.filter(f => f.parentId === parentId);
    
    let parentNode = parentId ? family.find(f => f.id === parentId) : null;
    
    siblingsList.sort((a, b) => {
        if (parentNode && parentNode.spouses && parentNode.spouses.length > 0) {
            let defPartner = parentNode.spouses[0].id;
            let aPid = a.partnerId || defPartner;
            let bPid = b.partnerId || defPartner;

            let spA = parentNode.spouses.find(s => s.id === aPid);
            let spB = parentNode.spouses.find(s => s.id === bPid);
            let aIndex = spA ? spA.spouseOrder : 99;
            let bIndex = spB ? spB.spouseOrder : 99;
            
            if (aIndex !== bIndex) return aIndex - bIndex; 
        }
        return (a.childOrder || 1) - (b.childOrder || 1);
    });
    
    return siblingsList;
}

// ==========================================
// FITUR AI SILSILAH CHATBOT PINTAR
// ==========================================
const aiChatArea = document.getElementById('aiChatArea');
const aiInput = document.getElementById('aiInput');

window.openAIModal = function() {
    document.getElementById('aiModal').style.display = 'flex';
    aiChatArea.innerHTML = ''; 
    aiInput.value = '';
    
    let activeFamily = family.filter(f => f.treeId === activeTreeId);
    if(activeFamily.length === 0) {
        appendChatMessage('ai', "Halo! Sepertinya belum ada data keluarga di bagan ini. Silakan tambahkan leluhur terlebih dahulu.");
    } else {
        appendChatMessage('ai', "Halo! Saya adalah Asisten AI Penjaga Silsilah. Berikut adalah rangkuman silsilah keluarga Anda saat ini:");
        let summaryHTML = generateAITextHTML();
        appendChatMessage('ai', summaryHTML);
        appendChatMessage('ai', "Anda juga bisa bertanya langsung secara spesifik (tidak perlu mengetik nama lengkap), misalnya:<br>• <i>'Siapa keponakan Ryandi?'</i><br>• <i>'Siapa Paman/Bibi dari Okta?'</i><br>• <i>'Siapa saudara kandung Yuda?'</i>");
    }
    
    setTimeout(() => aiInput.focus(), 100);
}

window.closeAIModal = function() {
    document.getElementById('aiModal').style.display = 'none';
}

aiInput.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        window.sendUserMessage();
    }
});

window.sendUserMessage = function() {
    let text = aiInput.value.trim();
    if(!text) return;
    
    appendChatMessage('user', text);
    aiInput.value = '';
    
    let loadingId = 'loading-' + Date.now();
    appendChatMessage('ai', '<span style="font-style:italic; color:#94a3b8;">Sedang menganalisis struktur urutan silsilah Jawa...</span>', loadingId);
    
    setTimeout(() => {
        let response = processAILogic(text);
        document.getElementById(loadingId).innerHTML = response;
        aiChatArea.scrollTop = aiChatArea.scrollHeight;
    }, 600);
}

function appendChatMessage(sender, html, id = null) {
    let div = document.createElement('div');
    div.className = `chat-bubble chat-${sender}`;
    if(id) div.id = id;
    div.innerHTML = html;
    aiChatArea.appendChild(div);
    aiChatArea.scrollTop = aiChatArea.scrollHeight;
}

function generateAITextHTML() {
    let activeFamily = family.filter(f => f.treeId === activeTreeId);
    let activeRoots = activeFamily.filter(f => !f.parentId);
    if (activeRoots.length === 0) return "Belum ada anggota di keluarga ini.";

    let html = `<div style="font-size: 13.5px;">`;
    activeRoots.sort((a,b) => (a.childOrder||1) - (b.childOrder||1));
    activeRoots.forEach((root) => {
        html += explainPersonRecursive(root.id, 0);
    });
    html += `</div>`;
    return html;
}

function explainPersonRecursive(personId, level) {
    let p = family.find(f => f.id === personId);
    if (!p) return "";

    let text = "";
    let indent = level * 15; 
    let genderStr = p.gender === 'L' ? 'L' : 'P';
    
    let boxStyle = `style="margin-left:${indent}px; padding: 8px; margin-bottom: 8px; background: #f8fafc; border-left: 3px solid #8b5cf6; border-radius: 4px;"`;

    if (level === 0) {
        text += `<div ${boxStyle}><strong>🌳 LELUHUR: ${p.name}</strong> (${genderStr})<br>`;
    } else {
        text += `<div ${boxStyle}>👤 <b>${p.name}</b> (${genderStr})<br>`;
    }

    if (p.spouses && p.spouses.length > 0) {
        if (p.spouses.length === 1) {
            let sp = p.spouses[0];
            text += `<span style="color:#d97706; font-size: 12.5px;">💍 Pasangan: <b>${sp.name}</b></span>`;
            
            if (sp.siblings && sp.siblings.length > 0) {
                let kakaks = sp.siblings.filter(s => s.siblingOrder < 0).map(s => s.name);
                let adiks = sp.siblings.filter(s => s.siblingOrder > 0).map(s => s.name);
                let sibStr = [];
                if(kakaks.length > 0) sibStr.push(`Kakak: ${kakaks.join(', ')}`);
                if(adiks.length > 0) sibStr.push(`Adik: ${adiks.join(', ')}`);
                text += `<br><span style="font-size:11.5px; color:#64748b;">(Saudara Kandung ${sp.name}: ${sibStr.join(' | ')})</span>`;
            }
        } else {
            text += `<span style="color:#d97706; font-size: 12.5px;">💍 Memiliki ${p.spouses.length} pasangan:</span><ul style="margin:4px 0; padding-left:18px; font-size: 12.5px;">`;
            p.spouses.forEach(sp => {
                text += `<li><b>${sp.name}</b> (Ke-${sp.spouseOrder})`;
                if (sp.siblings && sp.siblings.length > 0) {
                    let kakaks = sp.siblings.filter(s => s.siblingOrder < 0).map(s => s.name);
                    let adiks = sp.siblings.filter(s => s.siblingOrder > 0).map(s => s.name);
                    let sibStr = [];
                    if(kakaks.length > 0) sibStr.push(`Kakak: ${kakaks.join(', ')}`);
                    if(adiks.length > 0) sibStr.push(`Adik: ${adiks.join(', ')}`);
                    text += ` <br><span style="font-size:11.5px; color:#64748b;">[Saudara: ${sibStr.join(' | ')}]</span>`;
                }
                text += `</li>`;
            });
            text += `</ul>`;
        }
    }

    let childrenList = getSortedSiblings(personId);
    if (childrenList.length > 0) {
        let grouped = {};
        childrenList.forEach(c => {
            let pid = c.partnerId || 'unknown';
            if (!grouped[pid]) grouped[pid] = [];
            grouped[pid].push(c);
        });

        text += `</div>`;

        let sortedPids = Object.keys(grouped).sort((a, b) => {
            if (a === 'unknown') return -1;
            if (b === 'unknown') return 1;
            let spA = p.spouses ? p.spouses.find(s => s.id === a) : null;
            let spB = p.spouses ? p.spouses.find(s => s.id === b) : null;
            let ordA = spA ? spA.spouseOrder : 99;
            let ordB = spB ? spB.spouseOrder : 99;
            return ordA - ordB;
        });

        sortedPids.forEach(pid => {
            let partnerName = "Pasangan Tunggal / Tidak Ditetapkan";
            if (pid !== 'unknown') {
                let sp = p.spouses ? p.spouses.find(s => s.id === pid) : null;
                if (sp) partnerName = sp.name;
            }
            
            text += `<div style="margin-left:${indent + 10}px; font-size:12.5px; font-weight:bold; color:#2563eb; margin-top:8px; margin-bottom:5px;">
                        ↳ Keturunan dengan ${partnerName} (${grouped[pid].length} Anak):
                     </div>`;

            grouped[pid].sort((a, b) => (a.childOrder||1) - (b.childOrder||1));
            grouped[pid].forEach(c => {
                text += explainPersonRecursive(c.id, level + 1);
            });
        });
    } else {
         text += `</div>`;
    }

    return text;
}

function processAILogic(query) {
    let q = query.toLowerCase();
    let activeFamily = family.filter(f => f.treeId === activeTreeId);
    
    if (q.includes('rangkum') || q.includes('silsilah') || q.includes('jelaskan') || q.includes('keluarga ini')) {
        return generateAITextHTML();
    }

    let allPeople = [];
    activeFamily.forEach(f => {
        allPeople.push({ ...f, type: 'blood' });
        if (f.spouses) {
            f.spouses.forEach(s => {
                allPeople.push({ ...s, type: 'spouse', bloodId: f.id });
                if(s.siblings) {
                    s.siblings.forEach(sib => {
                        allPeople.push({ ...sib, type: 'spouse_sibling', spouseId: s.id });
                    });
                }
            });
        }
    });

    let mentionedPerson = null;
    let ignoreWords = ['siapa','anak','dari','orang','tua','pasangan','istri','suami','kakak','adik','saudara','keluarga','yang','nama','namanya','adalah','punya', 'cucu', 'keponakan', 'ponakan', 'panggil', 'memanggil', 'sebutan', 'kakek', 'nenek', 'mbah', 'putu', 'paman', 'bibi', 'tante', 'om', 'pakde', 'pakdhe', 'bude', 'budhe', 'paklik', 'bulik', 'berapa'];
    let queryWords = q.split(/\s+/).filter(w => w.length > 2 && !ignoreWords.includes(w));

    for (let p of allPeople) {
        if (q.includes(p.name.toLowerCase())) {
            mentionedPerson = p;
            break;
        }
    }

    if (!mentionedPerson && queryWords.length > 0) {
        let bestMatch = null;
        let bestScore = 0;
        for (let p of allPeople) {
            let pNameParts = p.name.toLowerCase().split(/\s+/);
            let score = 0;
            for (let w of queryWords) {
                if (pNameParts.some(part => part.includes(w) || w.includes(part))) {
                    score++;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestMatch = p;
            }
        }
        if (bestMatch) mentionedPerson = bestMatch;
    }

    if (!mentionedPerson) {
        return "Maaf, saya tidak dapat menemukan nama tersebut di bagan ini. Pastikan Anda mengetik sebagian namanya dengan benar.";
    }

    let mName = `<b>${mentionedPerson.name}</b>`;

    if (q.includes('cucu') || q.includes('putu')) {
        if (mentionedPerson.type !== 'blood') return `Maaf, untuk kerabat dari pihak pasangan, data cucu difokuskan ke keturunan garis lurus di sistem ini.`;
        
        let children = getSortedSiblings(mentionedPerson.id);
        let cucuList = [];
        
        children.forEach(c => {
            let grandChildren = getSortedSiblings(c.id);
            grandChildren.forEach(gc => cucuList.push(`<li>${gc.name} (Anak dari ${c.name})</li>`));
        });

        if (cucuList.length === 0) return `${mName} tercatat belum/tidak memiliki cucu di bagan ini.`;

        let mbahTerm = mentionedPerson.gender === 'L' ? 'Mbah Kakung' : 'Mbah Putri / Mbah Uti';
        return `<b>${mentionedPerson.name}</b> memiliki ${cucuList.length} cucu. <br><br>Dalam Silsilah Jawa, para cucu ini memanggil ${mName} dengan sebutan <b>${mbahTerm}</b>.<br><br>Daftar Cucu:<br><ul style="margin:5px 0 0 0; padding-left:20px;">${cucuList.join('')}</ul>`;
    }

    else if (q.includes('keponakan') || q.includes('ponakan')) {
        let bloodRefId = null;
        let myIndex = 0;
        let siblingsList = [];
        let isSpouseSide = false;
        let parentId = null;

        if (mentionedPerson.type === 'blood') {
            bloodRefId = mentionedPerson.id;
            parentId = mentionedPerson.parentId;
            siblingsList = getSortedSiblings(parentId);
            myIndex = siblingsList.findIndex(s => s.id === mentionedPerson.id);
        } else if (mentionedPerson.type === 'spouse') {
            bloodRefId = mentionedPerson.bloodId;
            let bp = family.find(f => f.id === bloodRefId);
            parentId = bp.parentId;
            siblingsList = getSortedSiblings(parentId);
            myIndex = siblingsList.findIndex(s => s.id === bloodRefId);
        } else if (mentionedPerson.type === 'spouse_sibling') {
            isSpouseSide = true;
            let mainSpouse = activeFamily.find(f => f.id === findNodeByUniqueId(mentionedPerson.spouseId).bloodId).spouses.find(s => s.id === mentionedPerson.spouseId);
            
            let keponakanList = [];
            let isOlder = mentionedPerson.siblingOrder < 0; 
            let panggilan = mentionedPerson.gender === 'L' ? (isOlder ? 'Pakdhe' : 'Paklik / Om') : (isOlder ? 'Budhe' : 'Bulik / Tante');

            let childrenOfSpouse = activeFamily.filter(f => f.parentId === findNodeByUniqueId(mentionedPerson.spouseId).bloodId && f.partnerId === mentionedPerson.spouseId);
            childrenOfSpouse.sort((a,b) => (a.childOrder||1) - (b.childOrder||1));
            childrenOfSpouse.forEach(sc => {
                keponakanList.push(`<li>${sc.name} (Anak dari ${mainSpouse.name}) ➔ Memanggil ${mName}: <b>${panggilan}</b></li>`);
            });

            if (keponakanList.length === 0) return `${mName} belum/tidak memiliki keponakan yang tercatat di bagan ini.`;
            return `Keponakan dari ${mName} berjumlah ${keponakanList.length} orang:<br><ul style="margin:5px 0 0 0; padding-left:20px;">${keponakanList.join('')}</ul>`;
        }

        if (!isSpouseSide && bloodRefId) {
            let siblings = siblingsList.filter(f => f.id !== bloodRefId);
            let keponakanList = [];
            
            siblings.forEach(sib => {
                let sibIndex = siblingsList.findIndex(s => s.id === sib.id);
                let isOlder = myIndex < sibIndex; 
                let panggilan = mentionedPerson.gender === 'L' ? (isOlder ? 'Pakdhe' : 'Paklik / Om') : (isOlder ? 'Budhe' : 'Bulik / Tante');

                let sibChildren = getSortedSiblings(sib.id);
                sibChildren.forEach(sc => {
                    keponakanList.push(`<li>${sc.name} (Anak dari ${sib.name}) ➔ Memanggil ${mName}: <b>${panggilan}</b></li>`);
                });
            });

            if (parentId) {
                let parent = activeFamily.find(f => f.id === parentId);
                if (parent && parent.parentId) {
                    let pSibList = getSortedSiblings(parent.parentId);
                    let pIndex = pSibList.findIndex(s => s.id === parent.id);
                    let pSiblings = pSibList.filter(f => f.id !== parent.id);
                    
                    pSiblings.forEach(ps => {
                        let psIndex = pSibList.findIndex(s => s.id === ps.id);
                        let amIOlder = psIndex > pIndex; 
                        let panggilan = mentionedPerson.gender === 'L' ? (amIOlder ? 'Pakdhe' : 'Paklik / Om') : (amIOlder ? 'Budhe' : 'Bulik / Tante');

                        let cousins = activeFamily.filter(f => f.parentId === ps.id);
                        cousins.forEach(cop => {
                            let cousinChildren = getSortedSiblings(cop.id);
                            cousinChildren.forEach(cc => {
                                keponakanList.push(`<li>${cc.name} (Anak Sepupu, dari ${cop.name}) ➔ Memanggil ${mName}: <b>${panggilan}</b></li>`);
                            });
                        });
                    });
                }
            }

            if (keponakanList.length === 0) return `${mName} belum/tidak memiliki keponakan yang tercatat di bagan ini.`;
            return `Keponakan dari ${mName} berjumlah ${keponakanList.length} orang:<br><ul style="margin:5px 0 0 0; padding-left:20px;">${keponakanList.join('')}</ul>`;
        }
    }

    else if (q.includes('paman') || q.includes('tante') || q.includes('om') || q.includes('pakde') || q.includes('pakdhe') || q.includes('bude') || q.includes('budhe') || q.includes('paklik') || q.includes('bulik')) {
        if (mentionedPerson.type !== 'blood') return `Maaf, untuk saat ini pencarian Paman/Bibi difokuskan pada keturunan kandung. Silakan tanyakan Paman/Bibi dari anak kandung.`;
        if (!mentionedPerson.parentId) return `${mName} adalah Leluhur Utama, tidak ada data saudara orang tuanya di atasnya.`;
        
        let parent = activeFamily.find(f => f.id === mentionedPerson.parentId);
        let resultList = [];
        
        if (parent.parentId) {
            let pSibList = getSortedSiblings(parent.parentId);
            let parentSiblings = pSibList.filter(f => f.id !== parent.id);
            let parentIndex = pSibList.findIndex(s => s.id === parent.id);
            
            parentSiblings.forEach(ps => {
                let psIndex = pSibList.findIndex(s => s.id === ps.id);
                let isOlder = psIndex < parentIndex; 
                
                let panggilan = ps.gender === 'L' ? (isOlder ? 'Pakdhe' : 'Paklik / Om') : (isOlder ? 'Budhe' : 'Bulik / Tante');
                resultList.push(`<li><b>${ps.name}</b> (Saudara Kandung ${parent.name}) ➔ <b>${panggilan}</b></li>`);
                
                if (ps.spouses && ps.spouses.length > 0) {
                    ps.spouses.forEach(sp => {
                        let pSpouse = sp.gender === 'L' ? (isOlder ? 'Pakdhe' : 'Paklik / Om') : (isOlder ? 'Budhe' : 'Bulik / Tante');
                        resultList.push(`<li><b>${sp.name}</b> (Pasangan ${ps.name}) ➔ <b>${pSpouse}</b></li>`);
                    });
                }
            });

            let grandParent = activeFamily.find(f => f.id === parent.parentId);
            if (grandParent && grandParent.parentId) {
                let gpSibList = getSortedSiblings(grandParent.parentId);
                let gpIndex = gpSibList.findIndex(s => s.id === grandParent.id);
                let gpSiblings = gpSibList.filter(f => f.id !== grandParent.id);

                gpSiblings.forEach(gps => {
                    let gpsIndex = gpSibList.findIndex(s => s.id === gps.id);
                    let isMbahDhe = gpsIndex < gpIndex; 
                    
                    let parentCousins = activeFamily.filter(f => f.parentId === gps.id);
                    parentCousins.forEach(cop => {
                        let panggilan = cop.gender === 'L' ? (isMbahDhe ? 'Pakdhe' : 'Paklik / Om') : (isMbahDhe ? 'Budhe' : 'Bulik / Tante');
                        resultList.push(`<li><b>${cop.name}</b> (Saudara Sepupu ${parent.name}) ➔ <b>${panggilan}</b></li>`);
                        
                        if (cop.spouses && cop.spouses.length > 0) {
                            cop.spouses.forEach(sp => {
                                let pSpouse = sp.gender === 'L' ? (isMbahDhe ? 'Pakdhe' : 'Paklik / Om') : (isMbahDhe ? 'Budhe' : 'Bulik / Tante');
                                resultList.push(`<li><b>${sp.name}</b> (Pasangan ${cop.name}) ➔ <b>${pSpouse}</b></li>`);
                            });
                        }
                    });
                });
            }
        }

        if (mentionedPerson.partnerId) {
            let parentSpouse = parent.spouses ? parent.spouses.find(s => s.id === mentionedPerson.partnerId) : null;
            if (!parentSpouse && parent.spouses && parent.spouses.length > 0) {
                parentSpouse = parent.spouses[0]; 
            }

            if (parentSpouse && parentSpouse.siblings) {
                parentSpouse.siblings.forEach(sib => {
                    let isOlder = sib.siblingOrder < 0;
                    let panggilan = sib.gender === 'L' ? (isOlder ? 'Pakdhe' : 'Paklik / Om') : (isOlder ? 'Budhe' : 'Bulik / Tante');
                    resultList.push(`<li><b>${sib.name}</b> (Saudara Kandung ${parentSpouse.name}) ➔ <b>${panggilan}</b></li>`);
                });
            }
        } else if (parent.spouses && parent.spouses.length > 0) {
            let parentSpouse = parent.spouses[0];
            if (parentSpouse && parentSpouse.siblings) {
                parentSpouse.siblings.forEach(sib => {
                    let isOlder = sib.siblingOrder < 0;
                    let panggilan = sib.gender === 'L' ? (isOlder ? 'Pakdhe' : 'Paklik / Om') : (isOlder ? 'Budhe' : 'Bulik / Tante');
                    resultList.push(`<li><b>${sib.name}</b> (Saudara Kandung ${parentSpouse.name}) ➔ <b>${panggilan}</b></li>`);
                });
            }
        }

        if (resultList.length === 0) return `${mName} tidak memiliki Paman/Bibi yang setara di bagan ini.`;

        return `Paman dan Bibi (Setara generasi orang tua) dari ${mName} berjumlah ${resultList.length} orang:<br><ul style="margin:5px 0 0 0; padding-left:20px;">${resultList.join('')}</ul>`;
    }

    else if (q.includes('kakek') || q.includes('nenek') || q.includes('mbah')) {
        if (mentionedPerson.type !== 'blood') return `Maaf, pencarian Kakek/Nenek hanya difokuskan pada garis keturunan sedarah di sistem ini.`;
        if (!mentionedPerson.parentId) return `${mName} adalah Leluhur Utama di bagan ini, data kakek/neneknya tidak tercatat di atasnya.`;

        let parent = activeFamily.find(f => f.id === mentionedPerson.parentId);
        if (!parent || !parent.parentId) return `Data kakek/nenek dari ${mName} belum dicatat di bagan (hanya sampai orang tua).`;

        let grandParent = activeFamily.find(f => f.id === parent.parentId);
        let gpPartner = "Tunggal/Tidak Diketahui";
        if (grandParent.spouses && parent.partnerId) {
            let sp = grandParent.spouses.find(s => s.id === parent.partnerId);
            if(sp) gpPartner = sp.name;
        }

        return `Kakek dan Nenek kandung dari ${mName} adalah <b>${grandParent.name}</b> dan <b>${gpPartner}</b>.<br><br>Dalam Silsilah Jawa, ${mName} memanggil mereka <b>Mbah Kakung</b> (Kakek) dan <b>Mbah Putri / Mbah Uti</b> (Nenek).`;
    }

    else if (q.includes('anak') || q.includes('putra') || q.includes('putri')) {
        let children = [];
        if (mentionedPerson.type === 'blood') {
            children = getSortedSiblings(mentionedPerson.id);
        } else if (mentionedPerson.type === 'spouse') {
            children = activeFamily.filter(f => f.parentId === mentionedPerson.bloodId && f.partnerId === mentionedPerson.id);
            children.sort((a,b) => (a.childOrder||1) - (b.childOrder||1));
        } else {
            return `Maaf, informasi keturunan dari ${mName} difokuskan ke keturunan garis darah pasangan.`;
        }

        if (children.length === 0) return `${mName} tercatat belum/tidak memiliki anak dalam bagan ini.`;
        
        let childNames = children.map(c => `<li>${c.name} (${c.gender === 'L' ? 'Laki-laki' : 'Perempuan'})</li>`).join('');
        
        let panggilBapakIbu = mentionedPerson.gender === 'L' ? 'Bapak/Ayah' : 'Ibu';
        return `${mName} memiliki ${children.length} anak, mereka memanggil ${mName} dengan sebutan <b>${panggilBapakIbu}</b>:<br><ul style="margin:5px 0 0 0; padding-left:20px;">${childNames}</ul>`;
    }

    else if (q.includes('pasangan') || q.includes('istri') || q.includes('suami') || q.includes('nikah')) {
        if (mentionedPerson.type === 'blood') {
            if (!mentionedPerson.spouses || mentionedPerson.spouses.length === 0) {
                return `${mName} tercatat belum/tidak memiliki pasangan dalam bagan ini.`;
            }
            let spouseNames = mentionedPerson.spouses.map(s => `<li>${s.name} ${mentionedPerson.spouses.length > 1 ? `(Pasangan ke-${s.spouseOrder})` : ''}</li>`).join('');
            return `Pasangan dari ${mName} adalah:<br><ul style="margin:5px 0 0 0; padding-left:20px;">${spouseNames}</ul>`;
        } 
        else if (mentionedPerson.type === 'spouse') {
            let bloodPartner = activeFamily.find(f => f.id === mentionedPerson.bloodId);
            return `Pasangan dari ${mName} adalah <b>${bloodPartner.name}</b>.`;
        }
        else {
            return `Maaf, informasi pasangan dari ${mName} tidak tercatat, karena beliau adalah saudara kandung dari pihak pasangan.`;
        }
    }

    else if (q.includes('orang tua') || q.includes('bapak') || q.includes('ibu') || q.includes('ayah')) {
        if (mentionedPerson.type === 'blood') {
            if (!mentionedPerson.parentId) return `${mName} adalah Leluhur di bagan ini (data orang tuanya tidak ada di atasnya).`;
            
            let parent = activeFamily.find(f => f.id === mentionedPerson.parentId);
            let partner = "Tunggal/Tidak Diketahui";
            if (parent.spouses && mentionedPerson.partnerId) {
                let sp = parent.spouses.find(s => s.id === mentionedPerson.partnerId);
                if(sp) partner = sp.name;
            }
            return `Orang tua dari ${mName} adalah <b>${parent.name}</b> (Bapak/Ayah) dan <b>${partner}</b> (Ibu).`;
        } else {
            return `Maaf, data orang tua dari ${mName} tidak dicatat secara spesifik dalam pohon keluarga ini.`;
        }
    }

    else if (q.includes('saudara') || q.includes('kakak') || q.includes('adik') || q.includes('sepupu')) {
        if (mentionedPerson.type === 'blood') {
            let siblingsList = getSortedSiblings(mentionedPerson.parentId);
            let siblings = siblingsList.filter(f => f.id !== mentionedPerson.id);
            
            let kakakList = []; let adikList = []; let sepupuList = [];
            let myIndex = siblingsList.findIndex(s => s.id === mentionedPerson.id);
            
            siblings.forEach(s => {
                if(siblingsList.findIndex(x => x.id === s.id) < myIndex) kakakList.push(s.name);
                else adikList.push(s.name);
            });

            if (mentionedPerson.parentId) {
                let parent = activeFamily.find(f => f.id === mentionedPerson.parentId);
                if (parent && parent.parentId) {
                    let pSibList = getSortedSiblings(parent.parentId);
                    let pSiblings = pSibList.filter(f => f.id !== parent.id);
                    pSiblings.forEach(ps => {
                        let cousins = activeFamily.filter(f => f.parentId === ps.id);
                        cousins.forEach(c => sepupuList.push(c.name));
                    });
                }
            }

            if(siblings.length === 0 && sepupuList.length === 0) return `${mName} adalah anak tunggal (tidak punya saudara atau sepupu yang tercatat).`;

            let textRet = `Kerabat sedarah dari ${mName} di generasi yang sama adalah:`;
            if(kakakList.length > 0) textRet += `<br><b>Kakak:</b> ${kakakList.join(', ')}`;
            if(adikList.length > 0) textRet += `<br><b>Adik:</b> ${adikList.join(', ')}`;
            if(sepupuList.length > 0) textRet += `<br><b>Saudara Sepupu:</b> ${sepupuList.join(', ')}`;
            return textRet;
        } 
        else if (mentionedPerson.type === 'spouse' || mentionedPerson.type === 'spouse_sibling') {
            let spouseArray = [];
            if (mentionedPerson.type === 'spouse') spouseArray = mentionedPerson.siblings || [];
            else {
                let mainSpouse = activeFamily.find(f => f.id === findNodeByUniqueId(mentionedPerson.spouseId).bloodId).spouses.find(s => s.id === mentionedPerson.spouseId);
                spouseArray = [{name: mainSpouse.name, siblingOrder: 0}].concat(mainSpouse.siblings.filter(s => s.id !== mentionedPerson.id));
            }
            if(spouseArray.length === 0) return `${mName} tidak memiliki saudara kandung yang tercatat di bagan ini.`;
            return `Saudara kandung dari ${mName} adalah: <br> • ${spouseArray.map(s=>s.name).join('<br> • ')}`;
        }
    }

    return `Saya menemukan <b>${mentionedPerson.name}</b> di dalam silsilah ini. <br><br>Mohon beri pertanyaan spesifik mengenai orang tersebut, misalnya:<br>- "Siapa Paman/Bibi ${mentionedPerson.name}?"<br>- "Siapa saudara ${mentionedPerson.name}?"<br>- "Siapa keponakan ${mentionedPerson.name}?"`;
}

window.openModal = function(action, nodeId, spouseId = null) {
    currentAction = action; targetNodeId = nodeId; targetSpouseId = spouseId;
    const modal = document.getElementById('customModal');
    
    if(action === 'root') document.getElementById('modalTitle').textContent = "Tambah Leluhur Baru";
    else if(action === 'child') document.getElementById('modalTitle').textContent = "Tambah Anak";
    else if(action === 'older_sibling' || action === 'spouse_older_sibling') document.getElementById('modalTitle').textContent = "Tambah Kakak Kandung";
    else if(action === 'younger_sibling' || action === 'spouse_younger_sibling') document.getElementById('modalTitle').textContent = "Tambah Adik Kandung";
    else document.getElementById('modalTitle').textContent = "Tambah Pasangan";

    document.getElementById('modalName').value = ''; 
    document.getElementById('radioL').checked = true; 
    
    const partnerGroup = document.getElementById('partnerSelectionGroup');
    const partnerSelect = document.getElementById('modalPartnerId');
    const spouseOrderGroup = document.getElementById('spouseOrderGroup');
    const childOrderGroup = document.getElementById('childOrderGroup');
    
    childOrderGroup.style.display = 'none';

    if (action === 'child') {
        const parent = family.find(f => f.id === nodeId);
        if (parent && parent.spouses && parent.spouses.length > 0) {
            partnerSelect.innerHTML = '<option value="">-- Bebas / Tunggal --</option>';
            parent.spouses.forEach(sp => {
                let isSelected = (sp.id === spouseId) ? 'selected' : '';
                partnerSelect.innerHTML += `<option value="${sp.id}" ${isSelected}>${sp.name}</option>`;
            });
            partnerGroup.style.display = 'block';
        } else {
            partnerGroup.style.display = 'none';
        }
    } else {
        partnerGroup.style.display = 'none';
    }

    if (action === 'spouse') {
        spouseOrderGroup.style.display = 'block';
        const target = family.find(f => f.id === nodeId);
        const nextOrder = (target.spouses ? target.spouses.length : 0) + 1;
        document.getElementById('modalSpouseOrder').value = nextOrder > 4 ? 4 : nextOrder;
    } else {
        spouseOrderGroup.style.display = 'none';
    }

    modal.style.display = 'flex';
    document.getElementById('modalName').focus();
}

window.openEditModal = function(e, nodeId, isBlood, spouseId = null) {
    if(e) e.stopPropagation();
    currentAction = isBlood ? 'edit_blood' : 'edit_spouse';
    targetNodeId = nodeId; targetSpouseId = spouseId;
    
    const modal = document.getElementById('customModal');
    document.getElementById('modalTitle').textContent = "Edit Anggota";
    const person = family.find(f => f.id === nodeId);
    let targetPerson = isBlood ? person : person.spouses.find(s => s.id === spouseId);

    document.getElementById('modalName').value = targetPerson.name;
    if(targetPerson.gender === 'P') document.getElementById('radioP').checked = true;
    else document.getElementById('radioL').checked = true;
    
    const partnerGroup = document.getElementById('partnerSelectionGroup');
    const partnerSelect = document.getElementById('modalPartnerId');
    const spouseOrderGroup = document.getElementById('spouseOrderGroup');
    const childOrderGroup = document.getElementById('childOrderGroup');

    if (isBlood) {
        childOrderGroup.style.display = 'block';
        document.getElementById('modalChildOrder').value = targetPerson.childOrder || 1;
        
        if (person.parentId) {
            const parentInfo = family.find(f => f.id === person.parentId);
            if (parentInfo && parentInfo.spouses && parentInfo.spouses.length > 0) {
                partnerSelect.innerHTML = '<option value="">-- Bebas / Tunggal --</option>';
                parentInfo.spouses.forEach(sp => {
                    let isSelected = (sp.id === person.partnerId) ? 'selected' : '';
                    partnerSelect.innerHTML += `<option value="${sp.id}" ${isSelected}>${sp.name}</option>`;
                });
                partnerGroup.style.display = 'block';
            } else {
                partnerGroup.style.display = 'none';
            }
        } else {
            partnerGroup.style.display = 'none';
        }
    } else {
        childOrderGroup.style.display = 'none';
        partnerGroup.style.display = 'none';
    }

    if (!isBlood) {
        spouseOrderGroup.style.display = 'block';
        document.getElementById('modalSpouseOrder').value = targetPerson.spouseOrder || 1;
    } else {
        spouseOrderGroup.style.display = 'none';
    }

    modal.style.display = 'flex';
    document.getElementById('modalName').focus();
}

window.closeModal = function() { document.getElementById('customModal').style.display = 'none'; }

window.submitModal = function() {
    const nameValue = document.getElementById('modalName').value.trim();
    const genderValue = document.querySelector('input[name="modalGender"]:checked').value;
    const spouseOrderValue = parseInt(document.getElementById('modalSpouseOrder').value) || 1;
    const childOrderValue = parseInt(document.getElementById('modalChildOrder').value) || 1;
    
    if (!nameValue) { alert("Mohon isi nama terlebih dahulu!"); return; }

    pushHistory();

    if (currentAction === 'edit_blood') {
        const person = family.find(f => f.id === targetNodeId);
        person.name = nameValue; 
        person.gender = genderValue;
        person.childOrder = childOrderValue;
        if (person.parentId) {
            const partnerGroup = document.getElementById('partnerSelectionGroup');
            if (partnerGroup.style.display === 'block') {
                const partnerId = document.getElementById('modalPartnerId').value;
                person.partnerId = partnerId !== "" ? partnerId : null;
            }
        }
    } 
    else if (currentAction === 'edit_spouse') {
        const person = family.find(f => f.id === targetNodeId);
        const spouse = person.spouses.find(s => s.id === targetSpouseId);
        spouse.name = nameValue; 
        spouse.gender = genderValue;
        spouse.spouseOrder = spouseOrderValue;
        person.spouses.sort((a, b) => a.spouseOrder - b.spouseOrder);
    }
    else {
        const newId = Date.now().toString();

        if (currentAction === 'root') {
            let roots = family.filter(f => !f.parentId);
            let mOrder = roots.length > 0 ? Math.max(...roots.map(r=>r.childOrder||1)) + 1 : 1;
            family.push({ id: newId, treeId: newId, name: nameValue, gender: genderValue, parentId: null, childOrder: mOrder, spouses: [] });
            activeTreeId = newId;
            localStorage.setItem('activeTreeId', activeTreeId);
            resetZoom();
        } else if (currentAction === 'child') {
            const target = family.find(f => f.id === targetNodeId);
            const partnerId = document.getElementById('modalPartnerId').value; 
            let sibs = family.filter(f => f.parentId === targetNodeId);
            let mOrder = sibs.length > 0 ? Math.max(...sibs.map(r=>r.childOrder||1)) + 1 : 1;
            family.push({ id: newId, treeId: target.treeId, name: nameValue, gender: genderValue, parentId: targetNodeId, partnerId: (partnerId !== "" ? partnerId : null), childOrder: mOrder, spouses: [] });
        } else if (currentAction === 'older_sibling' || currentAction === 'younger_sibling') {
            const target = family.find(f => f.id === targetNodeId);
            
            let sibs = family.filter(f => f.parentId === target.parentId && f.treeId === target.treeId);
            let newOrder = currentAction === 'older_sibling' ? (target.childOrder || 1) : (target.childOrder || 1) + 1;
            
            sibs.forEach(s => {
                if ((s.childOrder || 1) >= newOrder) s.childOrder = (s.childOrder || 1) + 1;
            });

            const newNode = { 
                id: newId, treeId: target.treeId, name: nameValue, gender: genderValue, 
                parentId: target.parentId, partnerId: target.partnerId, childOrder: newOrder, spouses: [] 
            };
            family.push(newNode);
        } else if (currentAction === 'spouse') {
            const target = family.find(f => f.id === targetNodeId);
            if (!target.spouses) target.spouses = [];
            target.spouses.push({ id: newId, name: nameValue, gender: genderValue, spouseOrder: spouseOrderValue, siblings: [] });
            target.spouses.sort((a, b) => a.spouseOrder - b.spouseOrder);
        } else if (currentAction === 'spouse_older_sibling' || currentAction === 'spouse_younger_sibling') {
            const person = family.find(f => f.id === targetNodeId);
            const spouse = person.spouses.find(s => s.id === targetSpouseId);
            if (!spouse.siblings) spouse.siblings = [];

            let existingKakak = spouse.siblings.filter(s => s.siblingOrder < 0).length;
            let existingAdik = spouse.siblings.filter(s => s.siblingOrder > 0).length;
            
            let order = currentAction === 'spouse_older_sibling' ? -(existingKakak + 1) : (existingAdik + 1);

            spouse.siblings.push({ id: newId, name: nameValue, gender: genderValue, siblingOrder: order });
            spouse.siblings.sort((a, b) => a.siblingOrder - b.siblingOrder);
        }
    }
    saveAndRender(); closeModal(); 
}

function updateSvgLines() {
    const svg = document.getElementById('treeSvg');
    const canvasRect = canvas.getBoundingClientRect();
    let svgHtml = '';
    const O = 5000; 

    const activeFamily = family.filter(f => f.treeId === activeTreeId);

    activeFamily.forEach(person => {
        if (person.spouses && person.spouses.length > 0) {
            let mainBox = document.getElementById(`box-${person.id}`);
            if (!mainBox) return;
            let mainRect = mainBox.getBoundingClientRect();

            person.spouses.forEach(spouse => {
                let spouseBox = document.getElementById(`box-${spouse.id}`);
                if (!spouseBox) return;
                let spouseRect = spouseBox.getBoundingClientRect();

                let x1 = O + (mainRect.left + mainRect.width / 2 - canvasRect.left) / scale;
                let y1 = O + (mainRect.top + mainRect.height / 2 - canvasRect.top) / scale;
                let x2 = O + (spouseRect.left + spouseRect.width / 2 - canvasRect.left) / scale;
                let y2 = O + (spouseRect.top + spouseRect.height / 2 - canvasRect.top) / scale;

                svgHtml += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="tree-line" stroke-dasharray="0" />`;

                if (spouse.siblings && spouse.siblings.length > 0) {
                    let sTopY = O + (spouseRect.top - canvasRect.top) / scale;
                    let lineY = sTopY - 20; 
                    
                    let minX = x2, maxX = x2;
                    let sibBoxesX = [];

                    spouse.siblings.forEach(sib => {
                        let sibBox = document.getElementById(`box-${sib.id}`);
                        if (sibBox) {
                            let sibRect = sibBox.getBoundingClientRect();
                            let sibX = O + (sibRect.left + sibRect.width / 2 - canvasRect.left) / scale;
                            minX = Math.min(minX, sibX);
                            maxX = Math.max(maxX, sibX);
                            sibBoxesX.push({x: sibX, y: O + (sibRect.top - canvasRect.top) / scale});
                        }
                    });

                    svgHtml += `<line x1="${minX}" y1="${lineY}" x2="${maxX}" y2="${lineY}" class="tree-line-dashed" />`;
                    svgHtml += `<line x1="${x2}" y1="${lineY}" x2="${x2}" y2="${sTopY}" class="tree-line-dashed" />`;
                    sibBoxesX.forEach(sibPos => {
                        svgHtml += `<line x1="${sibPos.x}" y1="${lineY}" x2="${sibPos.x}" y2="${sibPos.y}" class="tree-line-dashed" />`;
                    });
                }
            });
        }
    });

    activeFamily.forEach(child => {
        if (child.parentId) {
            let parentInfo = activeFamily.find(f => f.id === child.parentId);
            let childBox = document.getElementById(`box-${child.id}`);
            if (!parentInfo || !childBox) return;

            let pBox = document.getElementById(`box-${parentInfo.id}`);
            if (!pBox) return;
            let pRect = pBox.getBoundingClientRect();
            let startX = O + (pRect.left + pRect.width / 2 - canvasRect.left) / scale;
            let startY = O + (pRect.top + pRect.height - canvasRect.top) / scale;

            let activePartnerId = child.partnerId;
            if (!activePartnerId && parentInfo && parentInfo.spouses && parentInfo.spouses.length > 0) {
                activePartnerId = parentInfo.spouses[0].id;
            }

            if (activePartnerId) {
                let spouseBox = document.getElementById(`box-${activePartnerId}`);
                if (spouseBox) {
                    let sRect = spouseBox.getBoundingClientRect();
                    let spouseX = O + (sRect.left + sRect.width / 2 - canvasRect.left) / scale;
                    let spouseY = O + (sRect.top + sRect.height - canvasRect.top) / scale;
                    startX = startX + (spouseX - startX) / 2; 
                    startY = Math.max(startY, spouseY); 
                }
            }

            let cRect = childBox.getBoundingClientRect();
            let endX = O + (cRect.left + cRect.width / 2 - canvasRect.left) / scale;
            let endY = O + (cRect.top - canvasRect.top) / scale;

            let midY = startY + 40; 
            if (midY > endY - 10) midY = startY + (endY - startY) / 2; 

            let pathD = `M ${startX} ${startY} V ${midY} H ${endX} V ${endY}`;
            svgHtml += `<path d="${pathD}" class="tree-line" />`;
        }
    });

    const activeRoots = activeFamily.filter(f => !f.parentId);
    if (activeRoots.length > 1) {
        let minX = Infinity, maxX = -Infinity, topY = Infinity;
        let validRoots = [];
        activeRoots.forEach(r => {
            let box = document.getElementById(`box-${r.id}`);
            if (box) {
                let rect = box.getBoundingClientRect();
                let cx = O + (rect.left + rect.width / 2 - canvasRect.left) / scale;
                let ty = O + (rect.top - canvasRect.top) / scale;
                minX = Math.min(minX, cx); maxX = Math.max(maxX, cx); topY = Math.min(topY, ty);
                validRoots.push({ cx, ty });
            }
        });

        if (validRoots.length > 1) {
            let lineY = topY - 30; 
            svgHtml += `<line x1="${minX}" y1="${lineY}" x2="${maxX}" y2="${lineY}" class="tree-line" />`;
            validRoots.forEach(vr => {
                svgHtml += `<line x1="${vr.cx}" y1="${lineY}" x2="${vr.cx}" y2="${vr.ty}" class="tree-line" />`;
            });
        }
    }

    svg.innerHTML = svgHtml;
}

function renderTree() {
    const treeContainer = document.getElementById('familyTree');
    const activeRoots = family.filter(f => !f.parentId && f.treeId === activeTreeId);

    if (!activeTreeId || activeRoots.length === 0) {
        treeContainer.innerHTML = '<p style="color:#64748b; margin-top: 50px; font-size:18px;">Pilih atau tambah keluarga di Sidebar sebelah kiri.</p>';
        document.getElementById('treeSvg').innerHTML = '';
        return;
    }

    const buildNode = (parentId) => {
        const childrenList = getSortedSiblings(parentId);
        if (childrenList.length === 0) return '';
        
        const parentNode = family.find(f => f.id === parentId);

        let ulStyle = '';
        if (parentNode && parentNode.spouses && parentNode.spouses.length > 0) {
            const shiftAmount = parentNode.spouses.length * 100;
            if (parentNode.gender === 'P') ulStyle = `style="margin-left: -${shiftAmount}px; margin-right: ${shiftAmount}px;"`;
            else ulStyle = `style="margin-left: ${shiftAmount}px; margin-right: -${shiftAmount}px;"`;
        }

        let html = `<ul ${ulStyle}>`;
        let lastPartnerId = 'START';
        childrenList.forEach((child, index) => {
            let parentInfo = family.find(f => f.id === child.parentId);
            let defPartner = (parentInfo && parentInfo.spouses && parentInfo.spouses.length > 0) ? parentInfo.spouses[0].id : 'NONE';
            let currentPartnerId = child.partnerId || defPartner;
            
            if (index > 0 && lastPartnerId !== currentPartnerId && currentPartnerId !== 'NONE') {
                html += `<li style="width: 40px; min-width: 40px; padding: 0;"></li>`;
            }
            lastPartnerId = currentPartnerId;

            html += `
                <li>
                    <div class="node-wrapper">
                        <div class="person-group">
                            ${buildPersonGroupHtml(child)}
                        </div>
                    </div>
                    ${buildNode(child.id)}
                </li>
            `;
        });
        html += '</ul>';
        return html;
    };

    const buildPersonGroupHtml = (memberNode) => {
        let group = [ { ...memberNode, isBlood: true, nodeId: memberNode.id, uniqueId: memberNode.id } ];
        let spousesCount = memberNode.spouses ? memberNode.spouses.length : 0;
        
        if (spousesCount > 0) {
            memberNode.spouses.forEach(sp => {
                group.push({ ...sp, isBlood: false, nodeId: memberNode.id, spouseId: sp.id, uniqueId: sp.id });
                if (sp.siblings && sp.siblings.length > 0) {
                    sp.siblings.forEach(sib => {
                        group.push({ ...sib, isSpouseSibling: true, bloodNodeId: memberNode.id, relatedSpouseId: sp.id, uniqueId: sib.id });
                    });
                }
            });
        }

        group.sort((a, b) => {
            let getWeight = (person) => {
                if (person.isBlood) return 0; 
                
                let spOrder = person.isSpouseSibling 
                    ? memberNode.spouses.find(s => s.id === person.relatedSpouseId).spouseOrder 
                    : person.spouseOrder;
                    
                let baseWeight = spOrder === 1 ? -100 : spOrder * 100; 

                if (person.isSpouseSibling) {
                    return baseWeight + person.siblingOrder; 
                }
                return baseWeight; 
            };
            return getWeight(a) - getWeight(b);
        });

        let groupHtml = '';
        
        group.forEach(p => {
            let classes = ['member'];
            let iconHtml = p.gender === 'L' ? '<span class="icon-gender">♂️</span>' : '<span class="icon-gender">♀️</span>';
            
            classes.push(p.gender === 'L' ? 'gender-male' : 'gender-female');
            
            let childBadge = '';
            let actionBtns = '';
            let deleteAction = '';

            if (p.isBlood) {
                if (!p.parentId) classes.push('root-member');
                if (p.parentId) {
                    const parentInfo = family.find(f => f.id === p.parentId);
                    if (parentInfo && parentInfo.spouses && parentInfo.spouses.length > 0) { 
                        let activePartnerId = p.partnerId || parentInfo.spouses[0].id;
                        const partnerInfo = parentInfo.spouses.find(s => s.id === activePartnerId);
                        if (partnerInfo) {
                            let badgeColor = partnerInfo.gender === 'P' ? '#ec4899' : '#2563eb';
                            let badgeIcon = partnerInfo.gender === 'P' ? '👩‍👦' : '👨‍👦';
                            childBadge = `<div class="child-badge" style="color: ${badgeColor};">${badgeIcon} Anak dari ${partnerInfo.name}</div>`;
                        }
                    }
                }
                deleteAction = `deletePerson(event, '${p.nodeId}', true)`;
                actionBtns = `
                    <button class="btn-spouse" onclick="event.stopPropagation(); openModal('spouse', '${p.nodeId}')">+ Pasangan</button>
                    <button onclick="event.stopPropagation(); openModal('older_sibling', '${p.nodeId}')">+ Kakak</button>
                    <button onclick="event.stopPropagation(); openModal('younger_sibling', '${p.nodeId}')">+ Adik</button>
                    <button onclick="event.stopPropagation(); openModal('child', '${p.nodeId}', null)">+ Anak</button>`;
            } 
            else if (p.isSpouseSibling) {
                let sibLabel = p.siblingOrder < 0 ? "Kakak Kandung" : "Adik Kandung";
                let relatedSpouse = memberNode.spouses.find(s => s.id === p.relatedSpouseId);
                
                childBadge = `<div class="child-badge" style="color: #475569;">${sibLabel} dari ${relatedSpouse.name}</div>`;
                
                deleteAction = `deletePerson(event, '${p.bloodNodeId}', false, '${p.relatedSpouseId}', '${p.uniqueId}')`;
                actionBtns = ``; 
            } 
            else {
                classes.push('spouse-member');
                let spouseText = "";
                if (spousesCount === 1) {
                    spouseText = `💍 Pasangan dari ${memberNode.name}`;
                } else {
                    spouseText = `💍 Pasangan Ke-${p.spouseOrder || 1} dari ${memberNode.name}`;
                }
                childBadge = `<div class="child-badge spouse-badge">${spouseText}</div>`;
                
                deleteAction = `deletePerson(event, '${p.nodeId}', false, '${p.spouseId}')`;
                actionBtns = `
                    <button onclick="event.stopPropagation(); openModal('spouse_older_sibling', '${p.nodeId}', '${p.spouseId}')">+ Kakak</button>
                    <button onclick="event.stopPropagation(); openModal('spouse_younger_sibling', '${p.nodeId}', '${p.spouseId}')">+ Adik</button>
                    <button onclick="event.stopPropagation(); openModal('child', '${p.nodeId}', '${p.spouseId}')">+ Anak dr ${p.name}</button>`;
            }

            let editAction = p.isSpouseSibling 
                ? `alert('Edit saudara kandung pasangan silakan hapus dan buat ulang')` 
                : p.isBlood ? `openEditModal(event, '${p.nodeId}', true)` : `openEditModal(event, '${p.nodeId}', false, '${p.spouseId}')`;

            let pX = p.offsetX || 0;
            let pY = p.offsetY || 0;

            groupHtml += `
                <div class="single-person-wrap" id="person-${p.uniqueId}" style="transform: translate(${pX}px, ${pY}px);">
                    <div class="${classes.join(' ')}" id="box-${p.uniqueId}">
                        <div style="font-weight: 600;">${p.name} ${iconHtml}</div>
                        ${childBadge}
                        <button class="btn-action-corner btn-edit" title="Edit ${p.name}" onclick="${editAction}">✏️</button>
                        <button class="btn-action-corner btn-delete" title="Hapus ${p.name}" onclick="${deleteAction}">✕</button>
                        <button class="btn-drag-person" onmousedown="startDragPerson(event, '${p.uniqueId}')" ontouchstart="startDragPerson(event, '${p.uniqueId}')">🖐️ Geser</button>
                    </div>
                    <div class="action-btns">${actionBtns}</div>
                </div>
            `;
        });

        return groupHtml;
    };

    activeRoots.sort((a,b) => (a.childOrder||1) - (b.childOrder||1));
    let treeHtml = `<div class="tree"><ul>`;
    
    activeRoots.forEach((root, index) => {
        if (index > 0) treeHtml += `<li style="width: 50px; min-width: 50px; padding: 0;"></li>`;
        treeHtml += `
            <li>
                <div class="node-wrapper">
                    <div class="person-group">
                        ${buildPersonGroupHtml(root)}
                    </div>
                </div>
                ${buildNode(root.id)}
            </li>`;
    });
    treeHtml += `</ul></div>`;
    
    treeContainer.innerHTML = treeHtml;

    setTimeout(updateSvgLines, 50);
    setTimeout(updateSvgLines, 150);
}

window.addEventListener('resize', () => setTimeout(updateSvgLines, 50));

window.deletePerson = function(e, nodeId, isBlood, spouseId = null, siblingId = null) {
    if(e) e.stopPropagation();
    
    try {
        pushHistory();
        
        if (siblingId && siblingId !== 'undefined' && siblingId !== 'null') {
            if(confirm(`Hapus saudara kandung pasangan ini?`)) {
                const person = family.find(f => f.id === nodeId);
                const spouse = person.spouses.find(s => s.id === spouseId);
                spouse.siblings = spouse.siblings.filter(s => s.id !== siblingId);
                saveAndRender();
            }
            return;
        }

        if (isBlood) {
            const person = family.find(f => f.id === nodeId);
            if (!person) return;
            
            if(confirm(`⚠️ PERINGATAN!\nApakah Anda yakin ingin menghapus "${person.name}" beserta SEMUA keturunannya?`)) {
                const isRoot = !person.parentId;
                const idsToDelete = [nodeId, ...getDescendantIds(nodeId)];
                
                family = family.filter(f => !idsToDelete.includes(f.id));
                
                if (isRoot) {
                    const remainingRoots = family.filter(f => !f.parentId && f.treeId === person.treeId);
                    if (remainingRoots.length === 0) {
                        activeTreeId = null;
                        localStorage.removeItem('activeTreeId');
                    }
                }
                saveAndRender();
            }
        } 
        else {
            const person = family.find(f => f.id === nodeId);
            if (!person) return;
            const spouse = person.spouses.find(s => s.id === spouseId);
            if (!spouse) return;
            
            if(confirm(`Hapus pasangan bernama "${spouse.name}"? (Saudaranya juga akan ikut terhapus)`)) {
                person.spouses = person.spouses.filter(s => s.id !== spouseId);
                
                family.forEach(f => {
                    if (f.parentId === nodeId && f.partnerId === spouseId) {
                        f.partnerId = null;
                    }
                });
                saveAndRender();
            }
        }
    } catch (err) {
        console.error("Gagal menghapus:", err);
    }
};

function getDescendantIds(parentId) {
    let ids = [];
    const children = family.filter(f => f.parentId === parentId);
    children.forEach(child => { 
        ids.push(child.id); 
        ids = ids.concat(getDescendantIds(child.id)); 
    });
    return ids;
}

window.clearTree = function() {
    if(confirm("Apakah kamu yakin ingin menghapus SELURUH data di semua tab keluarga?")) {
        pushHistory();
        family = []; localStorage.removeItem('familyData'); localStorage.removeItem('familyHistory');
        localStorage.removeItem('activeTreeId');
        activeTreeId = null;
        historyStack = [];
        resetZoom(); 
        saveAndRender();
    }
}

const viewRect = viewport.getBoundingClientRect();
pointX = viewRect.width / 2 - 100; 
pointY = 50; 
setTransform(); 
renderSidebar();
renderTree();