document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // DOM Elements
    // ----------------------------------------------------
    const canvas = document.getElementById('matrix-canvas');
    const ctx = canvas.getContext('2d');
    const video = document.getElementById('scroll-video');
    const videoContainer = document.getElementById('video-container');
    const hudContainer = document.getElementById('hud-container');
    const hudLog = document.getElementById('hud-log');
    const hudProgress = document.getElementById('hud-progress');
    const terminalInput = document.getElementById('terminal-input');
    const terminalOutput = document.getElementById('terminal-output');
    const terminalBody = document.querySelector('.terminal-body');
    const shortcutButtons = document.querySelectorAll('.shortcut-btn');

    // ----------------------------------------------------
    // Configuration & State
    // ----------------------------------------------------
    let isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let matrixInterval = null;
    let targetTime = 0;
    let currentTime = 0;

    // Explicitly pause video and prevent autoplay
    video.autoplay = false;
    video.loop = false;
    video.pause();

    // ----------------------------------------------------
    // Video Loader & Diagnostic Logs
    // ----------------------------------------------------
    console.log("Video initializing. Current readyState:", video.readyState, "Duration:", video.duration);

    // Warm up the decoder for Safari / Chrome compatibility
    function warmUpVideoDecoder() {
        video.load();
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                video.pause();
                console.log("Video decoder warmed up successfully.");
            }).catch(error => {
                // Autoplay policy blocks playing without interaction sometimes, this is normal
                console.log("Autoplay warning/warmup block (expected):", error);
            });
        }
    }
    warmUpVideoDecoder();

    // Log errors if video fails to load or decode
    video.addEventListener('error', (e) => {
        console.error("Video load error:", video.error);
        printToTerminal(`[Hata]: Video yuklenemedi veya desteklenmeyen format. Kod: ${video.error ? video.error.code : 'unknown'}`, 'error');
    });

    // ----------------------------------------------------
    // Matrix Digital Rain
    // ----------------------------------------------------
    const characters = '01ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓYAユヨラリルレロワン'.split('');
    const fontSize = 16;
    let columns = 0;
    let drops = [];
    let isFullMatrixMode = false;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        columns = Math.floor(canvas.width / fontSize);
        drops = Array(columns).fill(1).map(() => Math.floor(Math.random() * -100)); // Start offscreen
    }

    function drawMatrix() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = `${fontSize}px monospace`;

        for (let i = 0; i < drops.length; i++) {
            const text = characters[Math.floor(Math.random() * characters.length)];
            
            if (drops[i] === 0 || Math.random() > 0.98) {
                ctx.fillStyle = '#ffffff';
            } else {
                ctx.fillStyle = '#00ff41';
            }

            const x = i * fontSize;
            const y = drops[i] * fontSize;
            ctx.fillText(text, x, y);

            if (y > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }

            drops[i]++;
        }
    }

    function initMatrixRain() {
        if (isReducedMotion) return;
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        if (matrixInterval) clearInterval(matrixInterval);
        matrixInterval = setInterval(drawMatrix, 33);
    }

    // ----------------------------------------------------
    // Video Scrubbing & HUD Updates
    // ----------------------------------------------------
    function getASCIIProgressBar(fraction) {
        const totalBars = 10;
        const filledBars = Math.round(fraction * totalBars);
        const emptyBars = totalBars - filledBars;
        const percentage = Math.round(fraction * 100);
        
        const filledStr = '#'.repeat(filledBars);
        const emptyStr = '-'.repeat(emptyBars);
        
        return `[${filledStr}${emptyStr}] ${percentage}%`;
    }

    function updateHUDLogs(fraction) {
        let statusText = 'INITIALIZING SYSTEM SCAN...';
        
        if (fraction === 0) {
            statusText = 'SYSTEM READY. WAITING FOR SCROLL FEED...';
        } else if (fraction > 0 && fraction <= 0.15) {
            statusText = 'ESTABLISHING DECRYPTION PROTOCOLS...';
        } else if (fraction > 0.15 && fraction <= 0.3) {
            statusText = 'BYPASSING PERIPHERAL LOCKS... [OK]';
        } else if (fraction > 0.3 && fraction <= 0.45) {
            statusText = 'STREAMING MEMORY BUFFER LOGS...';
        } else if (fraction > 0.45 && fraction <= 0.65) {
            statusText = 'EXTRACTING ACTIVE CODE STACKS...';
        } else if (fraction > 0.65 && fraction <= 0.8) {
            statusText = 'MAPPING GEOLOCATION COORDINATES... [ISTANBUL]';
        } else if (fraction > 0.8 && fraction <= 0.95) {
            statusText = 'SYNAPSE LINK SECURED. ACCESS GRANTED.';
        } else if (fraction > 0.95) {
            statusText = 'DECRYPTION COMPLETE. TERMINAL ONLINE.';
        }
        
        hudLog.innerHTML = statusText;
    }

    // Lerped frame progression loop
    function smoothScrollVideo() {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        
        if (scrollHeight > 0) {
            const scrollFraction = Math.max(0, Math.min(1, window.scrollY / scrollHeight));
            
            // HUD visibility state
            if (window.scrollY > 60 && scrollFraction < 0.9) {
                hudContainer.classList.add('visible');
            } else {
                hudContainer.classList.remove('visible');
            }

            // Video opacity transition when hitting bottom terminal section
            if (scrollFraction > 0.88) {
                const fadeOpacity = Math.max(0, (1 - scrollFraction) / 0.12);
                videoContainer.style.opacity = fadeOpacity;
            } else {
                videoContainer.style.opacity = 1;
            }

            // Smooth scrubbing logic based directly on video duration check
            const duration = video.duration;
            if (duration && !isNaN(duration)) {
                targetTime = scrollFraction * duration;
                
                // Linear Interpolation (Lerp)
                currentTime += (targetTime - currentTime) * 0.15;

                // CRITICAL FIX: Only set currentTime when the browser is NOT currently seeking!
                // Setting currentTime while seeking causes a backlog of requests and freezes the video frame.
                if (!video.seeking && Math.abs(currentTime - targetTime) > 0.002) {
                    video.currentTime = currentTime;
                }
            } else {
                // If duration is not loaded yet, try loading the video again periodically
                if (Math.random() < 0.01) {
                    console.log("Retrying video load, duration is currently NaN/0...");
                    video.load();
                }
            }

            // Update HUD elements
            hudProgress.textContent = getASCIIProgressBar(scrollFraction);
            updateHUDLogs(scrollFraction);
        }
        
        requestAnimationFrame(smoothScrollVideo);
    }

    // ----------------------------------------------------
    // Terminal Shell Simulation
    // ----------------------------------------------------
    function printToTerminal(text, type = 'output') {
        const outputLine = document.createElement('div');
        if (type === 'command') {
            outputLine.innerHTML = `<span class="prompt-text">ogulcansivri@matrix:~$</span> ${text}`;
        } else if (type === 'error') {
            outputLine.innerHTML = `<span style="color: #ff5f56;">[HATA]</span> ${text}`;
        } else {
            outputLine.innerHTML = text;
        }
        terminalOutput.appendChild(outputLine);
        terminalBody.scrollTop = terminalBody.scrollHeight;
    }

    function handleCommand(commandLine) {
        const cmd = commandLine.trim().toLowerCase();
        
        if (cmd === '') return;
        
        printToTerminal(commandLine, 'command');

        switch (cmd) {
            case 'help':
                printToTerminal(`Mevcut terminal komutları:
  <span class="highlight">about</span>    - Oğulcan Sivri hakkında kısa bilgi
  <span class="highlight">contact</span>  - İletişim bilgilerini listeler
  <span class="highlight">github</span>   - GitHub profil linkini açar
  <span class="highlight">linkedin</span> - LinkedIn profil linkini açar
  <span class="highlight">matrix</span>   - Dijital Matrix yağmuru modunu değiştirir
  <span class="highlight">clear</span>    - Terminal ekranını temizler
  <span class="highlight">whoami</span>   - Mevcut sistem kullanıcısı bilgisi
  <span class="highlight">sudo</span>     - Yönetici yetkileri talebi`);
                break;
                
            case 'about':
                printToTerminal(`OĞULCAN SİVRİ - Moleküler Biyolog & Genetikçi.
Biyolojik kodların (DNA/RNA) şifrelerini çözerken, dijital dünyada da web teknolojileri, veri analizi ve IT sistemleriyle ilgileniyorum.
Biyoloji ve teknolojiyi bir araya getiren projeler üretmekten keyif alıyorum.`);
                break;
                
            case 'contact':
                printToTerminal(`İrtibat kanalları kuruldu:
  Email 1 : <a href="mailto:ogulcansivrii@gmail.com" class="terminal-link">ogulcansivrii@gmail.com</a>
  Email 2 : <a href="mailto:ogulcansivri@outlook.com" class="terminal-link">ogulcansivri@outlook.com</a>
  Telefon : <a href="tel:+905336785793" class="terminal-link">0533 678 5793</a>
  LinkedIn: <a href="https://tr.linkedin.com/in/ogulcansivri" target="_blank" class="terminal-link">linkedin.com/in/ogulcansivri</a>
  Konum   : İstanbul / Türkiye`);
                break;
                
            case 'github':
                printToTerminal('GitHub profiline yönlendiriliyorsunuz...');
                setTimeout(() => {
                    window.open('https://github.com/ogulcansivri', '_blank');
                }, 1000);
                break;
                
            case 'linkedin':
                printToTerminal('LinkedIn profiline yönlendiriliyorsunuz...');
                setTimeout(() => {
                    window.open('https://tr.linkedin.com/in/ogulcansivri', '_blank');
                }, 1000);
                break;
                
            case 'matrix':
                isFullMatrixMode = !isFullMatrixMode;
                if (isFullMatrixMode) {
                    canvas.style.opacity = '1.0';
                    printToTerminal('Tam ekran Matrix modu aktif.');
                } else {
                    canvas.style.opacity = '0.35';
                    printToTerminal('Normal Matrix modu aktif.');
                }
                break;
                
            case 'clear':
                terminalOutput.innerHTML = '';
                break;
                
            case 'whoami':
                printToTerminal('OĞULCAN SİVRİ — molecular biologist & geneticist');
                break;
                
            case 'sudo':
                printToTerminal('Erişim reddedildi: Zaten root yetkilerine sahipsiniz. 😏', 'error');
                break;
                
            default:
                printToTerminal(`Komut bulunamadı: '${cmd}'. Mevcut komutları görmek için 'help' yazın.`, 'error');
                break;
        }
    }

    terminalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const command = terminalInput.value;
            handleCommand(command);
            terminalInput.value = '';
        }
    });

    document.querySelector('.terminal-window').addEventListener('click', () => {
        terminalInput.focus();
    });

    shortcutButtons.forEach(button => {
        button.addEventListener('click', () => {
            const command = button.getAttribute('data-command');
            handleCommand(command);
            terminalInput.focus();
        });
    });

    // Output video load status to terminal to help debug if needed
    setTimeout(() => {
        printToTerminal(`[Sistem]: Video Durumu - Süre: ${video.duration ? video.duration.toFixed(2) + "s" : "Yükleniyor..."}, Hazırlık Sınıfı: ${video.readyState}`);
    }, 1500);

    // ----------------------------------------------------
    // Accessibility Preferences
    // ----------------------------------------------------
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
        isReducedMotion = e.matches;
        if (isReducedMotion) {
            clearInterval(matrixInterval);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        } else {
            initMatrixRain();
        }
    });

    // ----------------------------------------------------
    // System Initialization
    // ----------------------------------------------------
    initMatrixRain();
    requestAnimationFrame(smoothScrollVideo);
});
