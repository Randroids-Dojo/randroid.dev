/* ============================================
   RANDROID'S CODEX — Interactive Book UI
   Canvas-based book with page spine curves,
   perspective, and page turn animations.
   Inspired by Grudgekeeper's book UI.
   ============================================ */
(function () {
  'use strict';

  // roundRect polyfill
  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      if (typeof r === 'number') r = [r, r, r, r];
      this.moveTo(x + r[0], y);
      this.lineTo(x + w - r[1], y);
      this.quadraticCurveTo(x + w, y, x + w, y + r[1]);
      this.lineTo(x + w, y + h - r[2]);
      this.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
      this.lineTo(x + r[3], y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - r[3]);
      this.lineTo(x, y + r[0]);
      this.quadraticCurveTo(x, y, x + r[0], y);
      this.closePath();
    };
  }

  // --- Colors ---
  var C = {
    bg: '#0a0a0f',
    text: '#e8e8ed',
    textSec: '#9898a8',
    textMuted: '#5c5c6e',
    accent: '#e74c3c',
    accentGlow: '#ff6b6b',
    teal: '#00cec9',
    gold: '#fdcb6e',
    border: '#2a2a3a',
    page: '#1c1c2a',
    pageLt: '#22222f',
    cover: '#0d0d14',
    coverFrame: '#1a1018',
    coverAccent: '#2a1520',
    spine: '#080810',
    tableTop: '#0e0c0a',
    tableMid: '#141210',
  };

  var SEGS = 10;            // spine curve segments
  var PERSP = 0.055;        // perspective amount (top inset ratio)
  var SPINE_DIP = 0.12;     // how much pages curve into spine
  var TURN_MS = 550;
  var COVER_W = 14;         // cover frame thickness
  var PAGE_EDGE_LAYERS = 5; // visible page stack layers
  var FSANS = "'Inter', sans-serif";
  var FMONO = "'JetBrains Mono', monospace";

  // --- State ---
  var S = {
    open: false, pages: [], spread: 0, turning: false,
    turnProg: 0, turnDir: 1, turnStart: 0,
    postId: null, toc: true, tocHits: [],
    raf: null, mobile: false, hover: null,
  };

  var overlay, cvs, ctx, closeBtn, hint;

  // --- DOM setup ---
  function initDOM() {
    overlay = document.createElement('div');
    overlay.id = 'bookOverlay';
    cvs = document.createElement('canvas');
    cvs.id = 'bookCanvas';
    overlay.appendChild(cvs);
    closeBtn = document.createElement('button');
    closeBtn.className = 'book-close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close book');
    overlay.appendChild(closeBtn);
    hint = document.createElement('div');
    hint.className = 'book-nav-hint';
    hint.textContent = 'click pages to turn // esc to close';
    overlay.appendChild(hint);
    document.body.appendChild(overlay);
    ctx = cvs.getContext('2d');
  }

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    cvs.width = window.innerWidth * dpr;
    cvs.height = window.innerHeight * dpr;
    cvs.style.width = window.innerWidth + 'px';
    cvs.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S.mobile = window.innerWidth < 768;
  }

  // --- Book rect: MUCH bigger, fills viewport ---
  function bkRect() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var w, h;
    if (S.mobile) {
      w = vw * 0.96; h = vh * 0.78;
    } else {
      w = Math.min(vw * 0.88, 1200);
      h = Math.min(vh * 0.85, 720);
    }
    return { x: (vw - w) / 2, y: (vh - h) / 2, w: w, h: h };
  }

  // --- Noise texture cache ---
  var _noise = null;
  function getNoise(w, h) {
    w = Math.ceil(w); h = Math.ceil(h);
    if (_noise && _noise.width === w && _noise.height === h) return _noise;
    _noise = document.createElement('canvas');
    _noise.width = w; _noise.height = h;
    var nc = _noise.getContext('2d');
    var id = nc.createImageData(w, h), d = id.data;
    for (var i = 0; i < d.length; i += 4) {
      var v = Math.random() * 20 - 10;
      d[i] = 28 + v; d[i+1] = 28 + v; d[i+2] = 42 + v; d[i+3] = 255;
    }
    nc.putImageData(id, 0, 0);
    return _noise;
  }

  // --- Draw Robot doodle ---
  function drawBot(cx, cy, sz, clr) {
    var s = sz / 60;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = clr || C.teal;
    ctx.lineWidth = 1.5 * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.3;
    // Antenna
    ctx.beginPath(); ctx.moveTo(0,-22*s); ctx.lineTo(0,-30*s); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,-32*s,3*s,0,Math.PI*2); ctx.stroke();
    // Head
    ctx.beginPath(); ctx.roundRect(-14*s,-22*s,28*s,22*s,4*s); ctx.stroke();
    // Eyes
    ctx.fillStyle = C.accent; ctx.globalAlpha = 0.25;
    ctx.fillRect(-8*s,-16*s,6*s,6*s);
    ctx.fillStyle = C.teal;
    ctx.fillRect(2*s,-16*s,6*s,6*s);
    ctx.globalAlpha = 0.3;
    // Mouth
    ctx.beginPath(); ctx.moveTo(-6*s,-4*s); ctx.lineTo(6*s,-4*s); ctx.stroke();
    // Body
    ctx.beginPath(); ctx.roundRect(-12*s,2*s,24*s,28*s,3*s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12*s,14*s); ctx.lineTo(12*s,14*s); ctx.stroke();
    // Arms
    ctx.beginPath();
    ctx.moveTo(-12*s,6*s); ctx.lineTo(-20*s,18*s);
    ctx.moveTo(12*s,6*s); ctx.lineTo(20*s,18*s);
    ctx.stroke();
    // Legs
    ctx.beginPath();
    ctx.moveTo(-6*s,30*s); ctx.lineTo(-8*s,40*s);
    ctx.moveTo(6*s,30*s); ctx.lineTo(8*s,40*s);
    ctx.stroke();
    ctx.restore();
  }

  // ============================================================
  //  DRAW A SINGLE PAGE with spine curve + perspective
  //  This is the core visual from the Grudgekeeper video:
  //  - Trapezoid shape (top narrower than bottom)
  //  - Spine edge curves inward via chain of line segments
  //  - Visible page thickness at outer edge
  // ============================================================
  function drawPage(side, bk, opts) {
    opts = opts || {};
    var halfW = bk.w / 2;
    var pxInset = bk.w * PERSP;       // perspective inset at top
    var dipPx = halfW * SPINE_DIP;     // max spine dip in px
    var spX = bk.x + halfW;           // spine X center

    // --- Compute the 4 corners (trapezoid) ---
    var topOuter, topSpine, botOuter, botSpine;
    if (side === 'left') {
      topOuter  = { x: bk.x + pxInset * 0.5, y: bk.y };
      topSpine  = { x: spX - pxInset * 0.3,   y: bk.y + pxInset * 0.5 };
      botOuter  = { x: bk.x,                   y: bk.y + bk.h };
      botSpine  = { x: spX,                    y: bk.y + bk.h };
    } else {
      topOuter  = { x: bk.x + bk.w - pxInset * 0.5, y: bk.y };
      topSpine  = { x: spX + pxInset * 0.3,          y: bk.y + pxInset * 0.5 };
      botOuter  = { x: bk.x + bk.w,                  y: bk.y + bk.h };
      botSpine  = { x: spX,                           y: bk.y + bk.h };
    }

    // --- Build spine edge as chain of curved segments ---
    var spinePoints = [topSpine];
    for (var i = 1; i <= SEGS; i++) {
      var t = i / SEGS;
      var y = topSpine.y + (botSpine.y - topSpine.y) * t;
      // Curve: strongest at top, fading toward bottom
      var curve = dipPx * Math.pow(1 - t, 1.5) * 1.2;
      // Also a slight inward bow in the middle
      curve += dipPx * 0.15 * Math.sin(t * Math.PI);
      var x;
      if (side === 'left') {
        x = topSpine.x + (botSpine.x - topSpine.x) * t - curve;
      } else {
        x = topSpine.x + (botSpine.x - topSpine.x) * t + curve;
      }
      spinePoints.push({ x: x, y: y });
    }

    // --- Draw the page shape ---
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(topOuter.x, topOuter.y);
    // Top edge to spine
    ctx.lineTo(topSpine.x, topSpine.y);
    // Spine edge down (the curved chain of segments)
    for (var i = 1; i < spinePoints.length; i++) {
      ctx.lineTo(spinePoints[i].x, spinePoints[i].y);
    }
    // Bottom edge
    ctx.lineTo(botOuter.x, botOuter.y);
    // Outer edge back up
    ctx.lineTo(topOuter.x, topOuter.y);
    ctx.closePath();

    // Shadow
    if (opts.shadow) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = C.page;
      ctx.fill();
      ctx.restore();
    }

    // Fill page
    ctx.fillStyle = C.page;
    ctx.fill();

    // Clip for interior effects
    ctx.save();
    ctx.clip();

    // Noise
    var noise = getNoise(halfW, bk.h);
    ctx.globalAlpha = 0.25;
    ctx.drawImage(noise, side === 'left' ? bk.x : spX, bk.y, halfW, bk.h);
    ctx.globalAlpha = 1;

    // Spine shadow (deep shadow where pages curve in)
    var sw = halfW * 0.18;
    var sg;
    if (side === 'left') {
      sg = ctx.createLinearGradient(spX, 0, spX - sw, 0);
    } else {
      sg = ctx.createLinearGradient(spX, 0, spX + sw, 0);
    }
    sg.addColorStop(0, 'rgba(0,0,0,0.55)');
    sg.addColorStop(0.4, 'rgba(0,0,0,0.15)');
    sg.addColorStop(1, 'transparent');
    ctx.fillStyle = sg;
    ctx.fillRect(side === 'left' ? spX - sw : spX, bk.y, sw, bk.h);

    // Outer edge darkening (aged look)
    var ew = 25;
    var eg;
    if (side === 'left') {
      eg = ctx.createLinearGradient(bk.x, 0, bk.x + ew, 0);
    } else {
      eg = ctx.createLinearGradient(bk.x + bk.w, 0, bk.x + bk.w - ew, 0);
    }
    eg.addColorStop(0, 'rgba(231,76,60,0.07)');
    eg.addColorStop(1, 'transparent');
    ctx.fillStyle = eg;
    ctx.fillRect(side === 'left' ? bk.x : bk.x + bk.w - ew, bk.y, ew, bk.h);

    // Top darkening
    var tg = ctx.createLinearGradient(0, bk.y, 0, bk.y + 30);
    tg.addColorStop(0, 'rgba(0,0,0,0.2)');
    tg.addColorStop(1, 'transparent');
    ctx.fillStyle = tg;
    ctx.fillRect(bk.x, bk.y, bk.w, 30);

    ctx.restore(); // end clip

    // Page border
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.restore();
  }

  // ============================================================
  //  DRAW THE FULL BOOK — cover, page stack, pages, spine
  // ============================================================
  function drawBook() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var bk = bkRect();
    ctx.clearRect(0, 0, vw, vh);

    // --- Dark wooden table surface ---
    var tg = ctx.createRadialGradient(vw/2, vh/2, 50, vw/2, vh/2, vw*0.65);
    tg.addColorStop(0, C.tableMid);
    tg.addColorStop(1, '#060606');
    ctx.fillStyle = tg;
    ctx.fillRect(0, 0, vw, vh);

    // Subtle wood grain lines
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 1;
    for (var gi = 0; gi < 15; gi++) {
      var gy = bk.y - 60 + gi * ((bk.h + 120) / 15);
      ctx.beginPath();
      ctx.moveTo(bk.x - 40, gy);
      ctx.bezierCurveTo(bk.x + bk.w*0.3, gy + 3, bk.x + bk.w*0.7, gy - 2, bk.x + bk.w + 40, gy + 1);
      ctx.stroke();
    }
    ctx.restore();

    var cw = COVER_W; // cover frame thickness

    // --- Book shadow on table ---
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 18;
    ctx.fillStyle = C.cover;
    ctx.fillRect(bk.x - cw, bk.y - cw, bk.w + cw*2, bk.h + cw*2);
    ctx.restore();

    // --- Back cover (leather/dark material) ---
    ctx.fillStyle = C.cover;
    ctx.fillRect(bk.x - cw, bk.y - cw, bk.w + cw*2, bk.h + cw*2);

    // Cover frame with accent stitching
    ctx.strokeStyle = C.coverAccent;
    ctx.lineWidth = cw;
    ctx.strokeRect(bk.x - cw/2, bk.y - cw/2, bk.w + cw, bk.h + cw);

    // Inner accent line (stitching)
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.2;
    ctx.setLineDash([4, 6]);
    ctx.strokeRect(bk.x - cw + 4, bk.y - cw + 4, bk.w + cw*2 - 8, bk.h + cw*2 - 8);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Outer highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bk.x - cw - 0.5, bk.y - cw - 0.5, bk.w + cw*2 + 1, bk.h + cw*2 + 1);

    // --- Page stack edges (visible at top, bottom, and outer sides) ---
    // These create the thick "block of pages" look
    var stackH = PAGE_EDGE_LAYERS * 2;

    // Bottom page edges
    for (var i = PAGE_EDGE_LAYERS; i >= 1; i--) {
      var off = i * 1.5;
      var shade = 24 + i * 3;
      ctx.fillStyle = 'rgb(' + shade + ',' + shade + ',' + (shade + 8) + ')';
      ctx.fillRect(bk.x + 2, bk.y + bk.h + off - 1, bk.w - 4, 1.5);
    }

    // Left outer page edges (left side of book)
    for (var i = PAGE_EDGE_LAYERS; i >= 1; i--) {
      var off = i * 1.5;
      var shade = 22 + i * 3;
      ctx.fillStyle = 'rgb(' + shade + ',' + shade + ',' + (shade + 8) + ')';
      ctx.fillRect(bk.x - off, bk.y + 3, 1.5, bk.h - 6);
    }

    // Right outer page edges
    for (var i = PAGE_EDGE_LAYERS; i >= 1; i--) {
      var off = i * 1.5;
      var shade = 22 + i * 3;
      ctx.fillStyle = 'rgb(' + shade + ',' + shade + ',' + (shade + 8) + ')';
      ctx.fillRect(bk.x + bk.w + off - 1.5, bk.y + 3, 1.5, bk.h - 6);
    }

    // Top page edges
    for (var i = PAGE_EDGE_LAYERS; i >= 1; i--) {
      var off = i * 1.5;
      var shade = 24 + i * 3;
      ctx.fillStyle = 'rgb(' + shade + ',' + shade + ',' + (shade + 8) + ')';
      ctx.fillRect(bk.x + 2, bk.y - off, bk.w - 4, 1.5);
    }

    // --- Draw pages ---
    if (S.mobile) {
      drawPage('left', bk, { shadow: true });
    } else {
      drawPage('left', bk, { shadow: true });
      drawPage('right', bk, { shadow: true });

      // --- Spine ---
      var spX = bk.x + bk.w / 2;

      // Spine groove (dark valley where pages meet)
      var spG = ctx.createLinearGradient(spX - 6, 0, spX + 6, 0);
      spG.addColorStop(0, 'rgba(0,0,0,0.0)');
      spG.addColorStop(0.3, 'rgba(0,0,0,0.6)');
      spG.addColorStop(0.5, 'rgba(0,0,0,0.8)');
      spG.addColorStop(0.7, 'rgba(0,0,0,0.6)');
      spG.addColorStop(1, 'rgba(0,0,0,0.0)');
      ctx.fillStyle = spG;
      ctx.fillRect(spX - 6, bk.y - 2, 12, bk.h + 4);

      // Spine line
      ctx.strokeStyle = C.spine;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(spX, bk.y - cw);
      ctx.lineTo(spX, bk.y + bk.h + cw);
      ctx.stroke();

      // Spine highlight
      ctx.strokeStyle = 'rgba(231,76,60,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(spX + 1, bk.y);
      ctx.lineTo(spX + 1, bk.y + bk.h);
      ctx.stroke();
    }

    // --- Content ---
    var sp = S.spread;

    if (S.mobile) {
      if (S.toc && sp === 0) renderTocTitle(bk);
      else if (S.toc && sp === 1) renderTocList(bk);
      else {
        var di = S.toc ? sp - 2 : sp;
        if (S.pages[di]) renderContent(S.pages[di], bk, 'left', di + 1);
      }
    } else {
      if (S.toc && sp === 0) {
        renderTocTitle(bk);
        renderTocList(bk);
      } else {
        var base = S.toc ? (sp - 1) * 2 : sp * 2;
        if (S.pages[base]) renderContent(S.pages[base], bk, 'left', base + 1);
        if (S.pages[base + 1]) renderContent(S.pages[base + 1], bk, 'right', base + 2);
      }
      // Occasional robot decorations
      if (sp > 0 && sp % 3 === 0) drawBot(bk.x + bk.w - 55, bk.y + bk.h - 58, 50, C.accent);
      if (sp > 0 && sp % 4 === 1) drawBot(bk.x + 50, bk.y + bk.h - 58, 45, C.teal);
    }

    // --- Hover hint ---
    if (S.hover && !S.turning) {
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = C.teal;
      var hx = S.hover === 'left' ? bk.x : bk.x + bk.w/2;
      var hw = S.mobile ? bk.w : bk.w/2;
      ctx.fillRect(hx, bk.y, hw, bk.h);
      ctx.restore();
    }

    // --- Page turn ---
    if (S.turning) drawTurn(bk);
  }

  // --- Page turn animation ---
  function drawTurn(bk) {
    var t = S.turnProg;
    t = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; // ease
    var halfW = bk.w / 2;
    var spX = bk.x + halfW;
    var angle = t * Math.PI;
    var flipW = halfW * Math.abs(Math.cos(angle));

    ctx.save();
    var flipX;
    if (S.turnDir === 1) {
      flipX = t < 0.5 ? spX : spX - flipW;
    } else {
      flipX = t < 0.5 ? spX - flipW : spX;
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,' + (0.35 * Math.sin(t * Math.PI)) + ')';
    ctx.fillRect(flipX - 6, bk.y - 3, flipW + 12, bk.h + 6);

    // Turning page
    ctx.fillStyle = C.pageLt;
    ctx.fillRect(flipX, bk.y, flipW, bk.h);

    // Curve shading
    var g = ctx.createLinearGradient(flipX, 0, flipX + flipW, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.25)');
    g.addColorStop(0.2, 'rgba(0,0,0,0.05)');
    g.addColorStop(0.8, 'rgba(0,0,0,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = g;
    ctx.fillRect(flipX, bk.y, flipW, bk.h);

    ctx.restore();
  }

  // ============================================================
  //  CONTENT: Parse, paginate, render
  // ============================================================
  function parsePost(id) {
    var tmpl = document.getElementById(id);
    if (!tmpl) return [];
    var div = document.createElement('div');
    div.innerHTML = tmpl.innerHTML;
    var out = [];
    for (var i = 0; i < div.childNodes.length; i++) {
      var n = div.childNodes[i];
      if (n.nodeType === 3) {
        var t = n.textContent.trim();
        if (t) out.push({ type: 'p', text: t });
      } else if (n.nodeType === 1) {
        var tag = n.tagName.toLowerCase();
        if (tag === 'time') out.push({ type: 'date', text: n.textContent.trim() });
        else if (tag === 'h1') out.push({ type: 'h1', text: n.textContent.trim() });
        else if (tag === 'h2') out.push({ type: 'h2', text: n.textContent.trim() });
        else if (tag === 'h3') out.push({ type: 'h3', text: n.textContent.trim() });
        else if (tag === 'p') out.push({ type: 'p', text: n.textContent.trim() });
        else if (tag === 'blockquote') out.push({ type: 'quote', text: n.textContent.trim() });
        else if (tag === 'ol' || tag === 'ul') {
          var li = n.querySelectorAll('li');
          for (var j = 0; j < li.length; j++)
            out.push({ type: 'li', text: (j+1) + '. ' + li[j].textContent.trim() });
        }
      }
    }
    return out;
  }

  function wrap(text, maxW, font) {
    ctx.font = font;
    var words = text.split(' '), lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line + (line ? ' ' : '') + words[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line); line = words[i];
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  function paginate(elems, bk) {
    var pw = (S.mobile ? bk.w : bk.w / 2) - 70; // usable text width
    var ph = bk.h - 60;
    var pages = [], cur = [], yPos = 0;

    function flush() { if (cur.length) { pages.push(cur); cur = []; yPos = 0; } }

    for (var i = 0; i < elems.length; i++) {
      var el = elems[i];
      var font, lh, color, pad = 0;
      switch (el.type) {
        case 'date': font = '12px '+FMONO; lh = 18; color = C.textMuted; break;
        case 'h1': font = 'bold 18px '+FSANS; lh = 26; color = C.text; if (yPos) yPos += 14; break;
        case 'h2': font = 'bold 15px '+FSANS; lh = 22; color = C.teal; if (yPos) yPos += 12; break;
        case 'h3': font = 'bold 13px '+FSANS; lh = 20; color = C.gold; if (yPos) yPos += 10; break;
        case 'quote': font = 'italic 12px '+FSANS; lh = 18; color = C.textSec; pad = 14; if (yPos) yPos += 8; break;
        case 'li': font = '12px '+FSANS; lh = 18; color = C.textSec; pad = 12; if (yPos) yPos += 4; break;
        default: font = '12.5px '+FSANS; lh = 19; color = C.textSec; if (yPos) yPos += 8;
      }
      var lines = wrap(el.text, pw - pad, font);
      for (var j = 0; j < lines.length; j++) {
        if (yPos + lh > ph) flush();
        cur.push({ text: lines[j], y: yPos, font: font, color: color, pad: pad, quote: el.type === 'quote' });
        yPos += lh;
      }
    }
    flush();
    return pages;
  }

  function renderContent(pg, bk, side, num) {
    if (!pg) return;
    var halfW = bk.w / 2;
    var px = 35, py = 30;
    var cx = (side === 'left' || S.mobile) ? bk.x + px : bk.x + halfW + px;
    var clipX = (side === 'left' || S.mobile) ? bk.x + 2 : bk.x + halfW + 2;
    var clipW = S.mobile ? bk.w - 4 : halfW - 4;

    ctx.save();
    ctx.beginPath(); ctx.rect(clipX, bk.y + 2, clipW, bk.h - 4); ctx.clip();

    for (var i = 0; i < pg.length; i++) {
      var it = pg[i], x = cx + it.pad, y = bk.y + py + it.y;
      if (it.quote) {
        ctx.fillStyle = C.accent; ctx.globalAlpha = 0.4;
        ctx.fillRect(cx + 2, y, 2, 15);
        ctx.globalAlpha = 1;
      }
      ctx.font = it.font; ctx.fillStyle = it.color;
      ctx.fillText(it.text, x, y + 13);
    }

    // Page number
    ctx.font = '10px '+FMONO; ctx.fillStyle = C.textMuted; ctx.globalAlpha = 0.4;
    var nt = String(num);
    if (side === 'right' && !S.mobile) {
      ctx.fillText(nt, cx + clipW - px*2 - ctx.measureText(nt).width, bk.y + bk.h - 14);
    } else {
      ctx.fillText(nt, cx, bk.y + bk.h - 14);
    }
    ctx.restore();
  }

  // --- TOC pages ---
  function getTocPosts() {
    var posts = [];
    for (var i = 1; i <= 10; i++) {
      var tmpl = document.getElementById('post-' + i);
      if (!tmpl) break;
      var d = document.createElement('div'); d.innerHTML = tmpl.innerHTML;
      var h = d.querySelector('h1'), t = d.querySelector('time');
      if (h) posts.push({ id: 'post-'+i, title: h.textContent.trim(), date: t ? t.textContent.trim() : '' });
    }
    return posts;
  }

  function renderTocTitle(bk) {
    var px = 35, py = 35;
    var x = bk.x + px, y = bk.y + py;
    var pw = S.mobile ? bk.w : bk.w / 2;

    ctx.save();
    ctx.beginPath(); ctx.rect(bk.x + 2, bk.y + 2, pw - 4, bk.h - 4); ctx.clip();

    // Label
    ctx.font = 'bold 11px '+FMONO; ctx.fillStyle = C.accent;
    ctx.fillText('// RANDROID\'S', x, y + 14);

    // Title
    ctx.font = 'bold 28px '+FSANS; ctx.fillStyle = C.text;
    ctx.fillText('CODEX', x, y + 50);

    // Decorative line
    ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.moveTo(x, y + 62); ctx.lineTo(x + 130, y + 62); ctx.stroke();
    ctx.globalAlpha = 1;

    // Robot
    drawBot(x + 70, y + 135, 90, C.teal);

    // Stats
    var sy = y + 210;
    ctx.font = '11px '+FMONO; ctx.fillStyle = C.textMuted;
    ctx.fillText('projects ........ 27', x, sy);
    ctx.fillText('playable ........ 15', x, sy + 20);
    ctx.fillText('languages ....... 9', x, sy + 40);
    ctx.fillText('agents .... countless', x, sy + 60);

    // Decorative teal line
    ctx.strokeStyle = C.teal; ctx.lineWidth = 0.5; ctx.globalAlpha = 0.2;
    ctx.beginPath(); ctx.moveTo(x, sy + 78); ctx.lineTo(x + 160, sy + 78); ctx.stroke();
    ctx.globalAlpha = 1;

    // Subtitle
    ctx.font = 'italic 12px '+FSANS; ctx.fillStyle = C.textSec; ctx.globalAlpha = 0.5;
    ctx.fillText('Thoughts from the Dojo', x, bk.y + bk.h - 22);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function renderTocList(bk) {
    var px = 35, py = 35;
    var spX = bk.x + bk.w / 2;
    var x = S.mobile ? bk.x + px : spX + px;
    var y = bk.y + py;
    var pw = S.mobile ? bk.w : bk.w / 2;
    var clipX = S.mobile ? bk.x + 2 : spX + 2;

    ctx.save();
    ctx.beginPath(); ctx.rect(clipX, bk.y + 2, pw - 4, bk.h - 4); ctx.clip();

    // Header
    ctx.font = 'bold 11px '+FMONO; ctx.fillStyle = C.teal;
    ctx.fillText('TABLE OF CONTENTS', x, y + 14);

    ctx.strokeStyle = C.teal; ctx.lineWidth = 0.5; ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.moveTo(x, y + 24); ctx.lineTo(x + pw - px*2 - 10, y + 24); ctx.stroke();
    ctx.globalAlpha = 1;

    var posts = getTocPosts();
    S.tocHits = [];
    var ey = y + 52;
    var aw = pw - px*2 - 20;

    for (var i = 0; i < posts.length; i++) {
      var p = posts[i];

      // Number
      ctx.font = 'bold 15px '+FMONO; ctx.fillStyle = C.accent;
      ctx.fillText((i+1) + '.', x, ey + 2);

      // Title
      ctx.font = '13px '+FSANS; ctx.fillStyle = C.text;
      var title = p.title;
      while (ctx.measureText(title).width > aw - 40 && title.length > 20)
        title = title.slice(0, -4) + '...';
      ctx.fillText(title, x + 28, ey);

      // Date
      ctx.font = '10px '+FMONO; ctx.fillStyle = C.textMuted;
      ctx.fillText(p.date, x + 28, ey + 18);

      // Dotted separator
      ctx.strokeStyle = C.border; ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.moveTo(x + 28, ey + 30); ctx.lineTo(x + aw, ey + 30); ctx.stroke();
      ctx.setLineDash([]);

      S.tocHits.push({ id: p.id, x: clipX, y: ey - 10, w: pw - 4, h: 48 });
      ey += 56;
    }

    // Small robot at bottom right
    if (!S.mobile) {
      drawBot(x + aw - 20, bk.y + bk.h - 55, 40, C.accent);
    }

    ctx.restore();
  }

  // ============================================================
  //  NAVIGATION + EVENTS
  // ============================================================
  function maxSpread() {
    var tot = S.toc ? S.pages.length + 2 : S.pages.length;
    return S.mobile ? tot - 1 : Math.max(Math.ceil(tot / 2) - 1, 0);
  }

  function turn(dir) {
    if (S.turning) return;
    var ns = S.spread + dir;
    if (ns < 0 || ns > maxSpread()) return;
    S.turning = true; S.turnDir = dir; S.turnStart = performance.now(); S.turnProg = 0;
    (function anim(now) {
      S.turnProg = Math.min((now - S.turnStart) / TURN_MS, 1);
      if (S.turnProg >= 1) { S.turning = false; S.spread = ns; S.turnProg = 0; render(); return; }
      render(); requestAnimationFrame(anim);
    })(performance.now());
  }

  function jumpPost(id) {
    var elems = parsePost(id);
    var bk = bkRect();
    S.pages = paginate(elems, bk);
    S.postId = id; S.toc = true;
    S.spread = S.mobile ? 2 : 1;
    render();
  }

  function render() { drawBook(); }

  // --- Click ---
  function onClick(e) {
    if (S.turning) return;
    var bk = bkRect();
    var r = cvs.getBoundingClientRect();
    var mx = e.clientX - r.left, my = e.clientY - r.top;

    // Outside book = close
    if (mx < bk.x - 30 || mx > bk.x + bk.w + 30 || my < bk.y - 30 || my > bk.y + bk.h + 30) {
      closeBook(); return;
    }

    // TOC clicks
    var isTocSpread = S.toc && S.spread === 0 && !S.mobile;
    var isTocMobile = S.toc && S.mobile && S.spread === 1;
    if (isTocSpread || isTocMobile) {
      for (var i = 0; i < S.tocHits.length; i++) {
        var h = S.tocHits[i];
        if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) {
          jumpPost(h.id); return;
        }
      }
    }

    // Page turn
    var mid = S.mobile ? bk.x + bk.w / 2 : bk.x + bk.w / 2;
    turn(mx > mid ? 1 : -1);
  }

  function onMove(e) {
    if (S.turning) return;
    var bk = bkRect(), r = cvs.getBoundingClientRect();
    var mx = e.clientX - r.left;
    var ns = (mx < bk.x || mx > bk.x + bk.w) ? null : (mx < bk.x + bk.w/2 ? 'left' : 'right');
    if (ns !== S.hover) { S.hover = ns; render(); }
  }

  function onKey(e) {
    if (!S.open) return;
    if (e.key === 'Escape') { closeBook(); e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === ' ') { turn(1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { turn(-1); e.preventDefault(); }
  }

  var tx0 = 0;
  function onTouchStart(e) { tx0 = e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (!S.open) return;
    var dx = e.changedTouches[0].clientX - tx0;
    if (Math.abs(dx) > 50) turn(dx < 0 ? 1 : -1);
    else onClick({ clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY });
  }

  // --- Open / Close ---
  function openBook(postId) {
    if (!overlay) initDOM();
    resize();
    if (postId) {
      S.pages = paginate(parsePost(postId), bkRect());
      S.postId = postId; S.toc = true;
      S.spread = S.mobile ? 2 : 1;
    } else {
      S.pages = []; S.postId = null; S.toc = true; S.spread = 0;
    }
    S.open = true; S.turning = false; S.hover = null;
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () {
      overlay.classList.add('open', 'fade-in');
      render();
    });
    cvs.addEventListener('click', onClick);
    cvs.addEventListener('mousemove', onMove);
    cvs.addEventListener('touchstart', onTouchStart, { passive: true });
    cvs.addEventListener('touchend', onTouchEnd);
    closeBtn.addEventListener('click', function (e) { e.stopPropagation(); closeBook(); });
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
  }

  function onResize() {
    if (!S.open) return;
    resize();
    if (S.postId) S.pages = paginate(parsePost(S.postId), bkRect());
    render();
  }

  function closeBook() {
    if (!S.open) return;
    S.open = false;
    overlay.classList.remove('open', 'fade-in');
    document.body.style.overflow = '';
    setTimeout(function () {
      if (!S.open) {
        overlay.style.display = 'none';
        cvs.removeEventListener('click', onClick);
        cvs.removeEventListener('mousemove', onMove);
        cvs.removeEventListener('touchstart', onTouchStart);
        cvs.removeEventListener('touchend', onTouchEnd);
        document.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', onResize);
      }
    }, 400);
  }

  window.RandroidCodex = {
    open: openBook,
    close: closeBook,
    isOpen: function () { return S.open; },
  };
})();
