// Canvas Setup
const canvas = document.getElementById('wave-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const maxPoints = 100;
const historyData = [[], [], [], []];
// Bauhaus Monotone Palette
const colors = ['#ffffff', '#cccccc', '#999999', '#666666'];

// Data rendering loop for high performance
function renderWaves() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Grid
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for(let i=0; i<canvas.width; i+=40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
    for(let i=0; i<canvas.height; i+=40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    const sliceHeight = canvas.height / 4;

    historyData.forEach((channel, idx) => {
        if(channel.length === 0) return;
        
        ctx.beginPath();
        ctx.strokeStyle = colors[idx];
        ctx.lineWidth = 1.5;
        
        // Disable glow for Bauhaus
        ctx.shadowBlur = 0;

        const baseY = (idx * sliceHeight) + (sliceHeight / 2);
        
        channel.forEach((val, i) => {
            const x = (i / maxPoints) * canvas.width;
            // Map val (roughly 0 to 1) to amplitude
            const y = baseY - (val - 0.5) * (sliceHeight * 0.8);
            
            if(i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
    });

    requestAnimationFrame(renderWaves);
}
requestAnimationFrame(renderWaves);

// Stats Initialization
const statsContainer = document.getElementById('channel-stats');
historyData.forEach((_, i) => {
    statsContainer.innerHTML += `
        <div class="stat-box" id="stat-${i}">
            <div class="stat-label">CH_${i+1} PWR</div>
            <div class="stat-val">0.00</div>
        </div>
    `;
});

// Real-time EventSource connection
const source = new EventSource('/api/stream');

source.onmessage = function(event) {
    const data = JSON.parse(event.data);
    
    data.channels.forEach((val, i) => {
        historyData[i].push(val);
        if(historyData[i].length > maxPoints) {
            historyData[i].shift();
        }
        
        // Update stats
        const box = document.getElementById(`stat-${i}`);
        const valEl = box.querySelector('.stat-val');
        valEl.textContent = val.toFixed(2);
        
        // Light up box based on power
        if(val > 0.7) {
            box.classList.add('active');
        } else {
            box.classList.remove('active');
        }
    });

    // Randomize Radar and Log entries periodically to simulate active system
    if(Math.random() > 0.8) {
        spawnRadarEntity();
        addLogEntry(`[HAPTIC] Object spatial mapping resolved. Sending ${Math.floor(Math.random()*10)}v impulse.`);
    }
};

source.onerror = function() {
    console.error("EventSource failed. Reconnecting...");
    // Update status
    document.querySelector('.status-indicator span').textContent = "Disconnected - Retrying";
    document.querySelector('.pulse-dot').style.backgroundColor = "#333333";
};

source.onopen = function() {
    document.querySelector('.status-indicator span').textContent = "System Active";
    document.querySelector('.pulse-dot').style.backgroundColor = "#ffffff";
};

// Spatial Radar Logic
const radar = document.getElementById('radar');
function spawnRadarEntity() {
    const angle = Math.random() * Math.PI * 2;
    const distance = 20 + Math.random() * 80; // percent form center
    
    const x = 50 + Math.cos(angle) * (distance / 2);
    const y = 50 + Math.sin(angle) * (distance / 2);
    
    const el = document.createElement('div');
    el.className = 'radar-entity';
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    
    radar.appendChild(el);
    setTimeout(() => el.remove(), 4000); // clear after 4s
}

// Log Logic
const logsContainer = document.getElementById('logs-container');
function addLogEntry(msg) {
    const d = new Date();
    const timeStr = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}.${d.getMilliseconds().toString().padStart(3,'0')}`;
    
    const entry = document.createElement('div');
    entry.className = msg.includes('[HAPTIC]') ? 'log-entry haptic' : 'log-entry system';
    entry.innerHTML = `<span class="time">${timeStr}</span> ${msg}`;
    
    logsContainer.appendChild(entry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

// Controls Logic
function triggerMockEvent(type) {
    addLogEntry(`[SYS] Manual Override Triggered: ${type}`);
    for(let i=0; i<3; i++) {
        setTimeout(() => spawnRadarEntity(), i*500);
    }
}
