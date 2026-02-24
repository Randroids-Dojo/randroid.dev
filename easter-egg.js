/* ============================================
   EASTER EGG — Glass Break Game
   7 clicks on "building with AI agents" badge
   ============================================ */

(function () {
  'use strict';

  // ---- Badge click counter ----
  var badge = document.querySelector('.hero-badge');
  if (!badge) return;

  var clickCount = 0;
  var resetTimer = null;

  badge.addEventListener('click', function (e) {
    e.stopPropagation();
    clickCount++;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(function () { clickCount = 0; }, 3500);
    if (clickCount >= 7) {
      clickCount = 0;
      clearTimeout(resetTimer);
      launch();
    }
  });

  // ---- Load static preview & launch ----
  function launch() {
    var W = window.innerWidth;
    var H = window.innerHeight;

    var img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      var x = c.getContext('2d');
      drawImageCover(x, img, W, H);
      startGame(c, W, H);
    };
    img.onerror = function () {
      // Fallback: dark canvas matching site background
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      var x = c.getContext('2d');
      x.fillStyle = '#0a0a0f';
      x.fillRect(0, 0, W, H);
      startGame(c, W, H);
    };
    // Pick the screenshot closest to the current viewport width
    var src = W <= 600  ? 'site-preview-mobile.jpg'
            : W <= 900  ? 'site-preview-tablet.jpg'
            : W <= 1200 ? 'site-preview-mid.jpg'
            :             'site-preview.jpg';
    img.src = src;
  }

  // Draw image scaled to match viewport width (preserves horizontal layout)
  function drawImageCover(ctx, img, W, H) {
    var scale = W / img.naturalWidth;
    var sh = img.naturalHeight * scale;
    ctx.drawImage(img, 0, 0, W, sh);
    if (sh < H) {
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, sh, W, H - sh);
    }
  }

  // ====================================================
  // GAME ENGINE
  // ====================================================
  function startGame(screenshot, W, H) {

    // ---- Canvas overlay ----
    var canvas = document.createElement('canvas');
    canvas.id = 'easterEggGame';
    canvas.width = W;
    canvas.height = H;
    canvas.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'z-index:99999;touch-action:none;user-select:none;';
    document.body.appendChild(canvas);
    document.body.style.overflow = 'hidden';

    var ctx = canvas.getContext('2d');

    // Offscreen canvas to accumulate crack lines
    var crackCanvas = document.createElement('canvas');
    crackCanvas.width = W;
    crackCanvas.height = H;
    var cc = crackCanvas.getContext('2d');

    // ---- State ----
    var phase = 'countdown'; // countdown | playing | preShatter | shattering | fadeout

    // Countdown
    var cdNum   = 5;    // 5..0 then starts game
    var cdAnim  = 0;    // 0→1 progress
    var cdState = 'in'; // in | hold | out
    var cdHold  = 0;    // ms spent in hold state

    // Ball
    var ballR  = Math.max(14, Math.min(W, H) * 0.022);
    var ballX  = W * (0.35 + Math.random() * 0.3);
    var ballY  = H * (0.35 + Math.random() * 0.3);
    var spd0   = Math.min(W, H) * 0.0045;
    var ang0   = Math.PI * (0.25 + Math.random() * 0.5);
    var ballVX = Math.cos(ang0) * spd0;
    var ballVY = Math.sin(ang0) * spd0;
    var ballVisible = false;

    // Damage
    var maxHits = 18;
    var hits    = 0;

    // Shards (built at shatter time)
    var shards = null;

    // Pre-shatter flash timer
    var preShatterTimer = 0;

    // Fade-out progress (0→1)
    var fadeVal = 0;

    // rAF handle
    var raf    = null;
    var lastTs = performance.now();

    // ---- Crack drawing ----
    function addCrack(ix, iy) {
      hits++;
      var numRays   = 4 + Math.floor(Math.random() * 6);
      var baseAng   = Math.random() * Math.PI * 2;
      var maxLen    = Math.min(W, H) * 0.28;

      cc.save();
      cc.strokeStyle = 'rgba(255,255,255,0.78)';
      cc.lineWidth   = 1 + Math.random() * 0.9;
      cc.shadowColor = 'rgba(200,220,255,0.55)';
      cc.shadowBlur  = 5;
      cc.lineCap     = 'round';

      for (var r = 0; r < numRays; r++) {
        var rayAng = baseAng + (r / numRays) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        var rayLen = 40 + Math.random() * maxLen;
        drawRay(cc, ix, iy, rayAng, rayLen, 3);
      }
      cc.restore();
    }

    function drawRay(c, sx, sy, ang, remaining, depth) {
      if (remaining < 8 || depth < 1) return;
      var px = sx, py = sy, rem = remaining;
      c.beginPath();
      c.moveTo(px, py);
      while (rem > 5) {
        var seg = Math.min(12 + Math.random() * 18, rem);
        ang += (Math.random() - 0.5) * 0.42;
        px += Math.cos(ang) * seg;
        py += Math.sin(ang) * seg;
        c.lineTo(px, py);
        rem -= seg;
      }
      c.stroke();
      // Branch
      if (depth > 1 && Math.random() < 0.4) {
        var bAng = ang + (Math.random() > 0.5 ? 0.58 : -0.58) + (Math.random() - 0.5) * 0.2;
        drawRay(c, px, py, bAng, remaining * 0.42, depth - 1);
      }
    }

    // ---- Shard generation ----
    function buildShards() {
      shards = [];
      var cols = 9, rows = 6;

      // Build a jittered grid of points
      var grid = [];
      for (var r = 0; r <= rows; r++) {
        grid.push([]);
        for (var c = 0; c <= cols; c++) {
          var bx = (c / cols) * W;
          var by = (r / rows) * H;
          var edge = (r === 0 || r === rows || c === 0 || c === cols);
          var jx = edge ? 0 : (Math.random() - 0.5) * (W / cols) * 0.55;
          var jy = edge ? 0 : (Math.random() - 0.5) * (H / rows) * 0.55;
          grid[r].push({ x: bx + jx, y: by + jy });
        }
      }

      var maxD = Math.sqrt(W * W + H * H) / 2;

      for (var r2 = 0; r2 < rows; r2++) {
        for (var c2 = 0; c2 < cols; c2++) {
          var tl = grid[r2][c2];
          var tr = grid[r2][c2 + 1];
          var bl = grid[r2 + 1][c2];
          var br = grid[r2 + 1][c2 + 1];
          var mx = (tl.x + tr.x + bl.x + br.x) / 4 + (Math.random() - 0.5) * 8;
          var my = (tl.y + tr.y + bl.y + br.y) / 4 + (Math.random() - 0.5) * 8;

          [[tl, tr], [tr, br], [br, bl], [bl, tl]].forEach(function (edge2) {
            var tri = [edge2[0], edge2[1], { x: mx, y: my }];
            var cx  = (tri[0].x + tri[1].x + tri[2].x) / 3;
            var cy  = (tri[0].y + tri[1].y + tri[2].y) / 3;
            shards.push({
              tri : tri,
              cx  : cx, cy  : cy,
              tx  : 0,  ty  : 0, rot: 0,
              vx  : (cx - W / 2) / maxD * (4 + Math.random() * 4) + (Math.random() - 0.5) * 2,
              vy  : 0.5 + Math.random() * 2.5,
              vrot: (Math.random() - 0.5) * 0.13,
              alpha: 1
            });
          });
        }
      }
    }

    // ---- Draw helpers ----
    function drawBg() {
      ctx.drawImage(screenshot, 0, 0, W, H);
      ctx.drawImage(crackCanvas, 0, 0, W, H);
    }

    function drawBall() {
      if (!ballVisible) return;
      // Outer glow
      var g = ctx.createRadialGradient(ballX, ballY, 0, ballX, ballY, ballR * 3.5);
      g.addColorStop(0, 'rgba(160,190,255,0.45)');
      g.addColorStop(1, 'rgba(80,100,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ballX, ballY, ballR * 3.5, 0, Math.PI * 2);
      ctx.fill();
      // Ball body
      var bg2 = ctx.createRadialGradient(
        ballX - ballR * 0.3, ballY - ballR * 0.35, ballR * 0.1,
        ballX, ballY, ballR
      );
      bg2.addColorStop(0,   '#ffffff');
      bg2.addColorStop(0.6, 'rgba(210,220,255,0.95)');
      bg2.addColorStop(1,   'rgba(150,170,255,0.88)');
      ctx.fillStyle = bg2;
      ctx.beginPath();
      ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawCountdownLabel(label, alpha, scale) {
      var sz = Math.min(W, H) * 0.22;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(W / 2, H / 2);
      ctx.scale(scale, scale);
      ctx.font = '800 ' + sz + 'px Inter, sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      // Drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(label, 4, 4);
      // White text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }

    // ---- Main render loop ----
    function loop(ts) {
      var dt = Math.min(ts - lastTs, 50);
      lastTs = ts;

      ctx.clearRect(0, 0, W, H);

      // ----------------------------------------
      // PHASE: COUNTDOWN
      // ----------------------------------------
      if (phase === 'countdown') {
        drawBg();
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.fillRect(0, 0, W, H);

        var SPEED_IN  = 0.006;
        var SPEED_OUT = 0.008;
        var HOLD_MS   = 620;
        var label     = cdNum === 0 ? 'Go!' : String(cdNum);

        if (cdState === 'in') {
          cdAnim = Math.min(1, cdAnim + dt * SPEED_IN);
          drawCountdownLabel(label, cdAnim, 1.5 - cdAnim * 0.5);
          if (cdAnim >= 1) { cdState = 'hold'; cdHold = 0; }

        } else if (cdState === 'hold') {
          drawCountdownLabel(label, 1, 1);
          cdHold += dt;
          if (cdHold >= HOLD_MS) { cdState = 'out'; cdAnim = 0; }

        } else if (cdState === 'out') {
          cdAnim = Math.min(1, cdAnim + dt * SPEED_OUT);
          drawCountdownLabel(label, 1 - cdAnim, 1 + cdAnim * 0.3);
          if (cdAnim >= 1) {
            cdNum--;
            if (cdNum < 0) {
              ballVisible = true;
              phase = 'playing';
            } else {
              cdState = 'in';
              cdAnim  = 0;
            }
          }
        }

      // ----------------------------------------
      // PHASE: PLAYING
      // ----------------------------------------
      } else if (phase === 'playing') {
        var steps = dt / 16;
        ballX += ballVX * steps;
        ballY += ballVY * steps;

        // Wall bounces — crack at impact site
        if (ballX - ballR < 0) {
          ballX = ballR; ballVX = Math.abs(ballVX);
          addCrack(ballR * 0.4, ballY);
        } else if (ballX + ballR > W) {
          ballX = W - ballR; ballVX = -Math.abs(ballVX);
          addCrack(W - ballR * 0.4, ballY);
        }
        if (ballY - ballR < 0) {
          ballY = ballR; ballVY = Math.abs(ballVY);
          addCrack(ballX, ballR * 0.4);
        } else if (ballY + ballR > H) {
          ballY = H - ballR; ballVY = -Math.abs(ballVY);
          addCrack(ballX, H - ballR * 0.4);
        }

        drawBg();
        drawBall();

        if (hits >= maxHits) {
          buildShards();
          phase = 'preShatter';
          preShatterTimer = 0;
        }

      // ----------------------------------------
      // PHASE: PRE-SHATTER (white flash)
      // ----------------------------------------
      } else if (phase === 'preShatter') {
        preShatterTimer += dt;
        drawBg();
        drawBall();
        var flashAlpha = Math.max(0, 1 - preShatterTimer / 180);
        ctx.fillStyle = 'rgba(255,255,255,' + flashAlpha + ')';
        ctx.fillRect(0, 0, W, H);
        if (preShatterTimer >= 180) phase = 'shattering';

      // ----------------------------------------
      // PHASE: SHATTERING
      // ----------------------------------------
      } else if (phase === 'shattering') {
        ctx.drawImage(screenshot, 0, 0, W, H);

        var allDone = true;
        for (var i = 0; i < shards.length; i++) {
          var s = shards[i];
          if (s.alpha <= 0) continue;
          allDone = false;

          s.tx   += s.vx   * (dt / 16);
          s.ty   += s.vy   * (dt / 16);
          s.vy   += 0.35   * (dt / 16); // gravity
          s.rot  += s.vrot * (dt / 16);
          s.alpha = Math.max(0, s.alpha - 0.0055 * (dt / 16));

          ctx.save();
          ctx.globalAlpha = s.alpha;
          ctx.translate(s.cx + s.tx, s.cy + s.ty);
          ctx.rotate(s.rot);
          ctx.translate(-s.cx, -s.cy);
          ctx.beginPath();
          ctx.moveTo(s.tri[0].x, s.tri[0].y);
          ctx.lineTo(s.tri[1].x, s.tri[1].y);
          ctx.lineTo(s.tri[2].x, s.tri[2].y);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(screenshot, 0, 0, W, H);
          ctx.drawImage(crackCanvas, 0, 0, W, H);
          ctx.restore();
        }

        if (allDone) {
          phase   = 'fadeout';
          fadeVal = 0;
        }

      // ----------------------------------------
      // PHASE: FADE OUT (black → transparent → remove)
      // ----------------------------------------
      } else if (phase === 'fadeout') {
        fadeVal = Math.min(1, fadeVal + 0.008 * (dt / 16));
        ctx.fillStyle = 'rgba(0,0,0,' + (1 - fadeVal) + ')';
        ctx.fillRect(0, 0, W, H);
        if (fadeVal >= 1) {
          cleanup();
          return;
        }
      }

      raf = requestAnimationFrame(loop);
    }

    // ---- Input: tap/click near ball ----
    function onTap(cx, cy) {
      if (phase !== 'playing') return;
      var dx = ballX - cx;
      var dy = ballY - cy;
      var d  = Math.sqrt(dx * dx + dy * dy);
      if (d > ballR * 4.5) return;

      var boost = 12;
      if (d < 1) { dx = 0; dy = -1; d = 1; }
      ballVX += (dx / d) * boost;
      ballVY += (dy / d) * boost;

      // Speed cap
      var spd = Math.sqrt(ballVX * ballVX + ballVY * ballVY);
      var cap = Math.min(W, H) * 0.03;
      if (spd > cap) {
        ballVX = (ballVX / spd) * cap;
        ballVY = (ballVY / spd) * cap;
      }

      // Crack at ball position
      addCrack(ballX, ballY);
    }

    canvas.addEventListener('click', function (e) {
      onTap(e.clientX, e.clientY);
    });

    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      var t = e.changedTouches[0];
      onTap(t.clientX, t.clientY);
    }, { passive: false });

    function onKey(e) {
      if (e.key === 'Escape') cleanup();
    }
    document.addEventListener('keydown', onKey);

    // ---- Cleanup ----
    function cleanup() {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      var c = document.getElementById('easterEggGame');
      if (c) c.remove();
      document.body.style.overflow = '';
    }

    // ---- Kick off ----
    raf = requestAnimationFrame(loop);
  }

})();
