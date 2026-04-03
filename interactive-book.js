/* ============================================
   RANDROID'S CODEX — Interactive Book UI
   Canvas-based book with page curves, perspective,
   and page turn animations. Inspired by Grudgekeeper.
   ============================================ */
(function () {
  'use strict';

  // --- Design tokens (matching site) ---
  var COLORS = {
    bg: '#0a0a0f',
    bgCard: '#16161f',
    bgCardHover: '#1c1c28',
    text: '#e8e8ed',
    textSec: '#9898a8',
    textMuted: '#5c5c6e',
    accent: '#e74c3c',
    accentGlow: '#ff6b6b',
    teal: '#00cec9',
    gold: '#fdcb6e',
    border: '#2a2a3a',
    pageBg: '#1a1a26',
    pageLight: '#22222e',
    coverDark: '#0e0e16',
    coverEdge: '#2a1a1a',
    spine: '#111118',
    wood: '#1c1410',
    woodLight: '#2a2018',
  };

  // roundRect polyfill for older browsers
  if (!CanvasRenderingContext2D.prototype.roundRect) {
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

  var SEGMENT_COUNT = 8;
  var PERSPECTIVE = 0.04; // how much narrower the top is
  var SPINE_CURVE = 0.055; // how much pages curve into spine
  var PAGE_TURN_MS = 600;
  var FONT_SANS = "'Inter', sans-serif";
  var FONT_MONO = "'JetBrains Mono', monospace";

  // --- State ---
  var state = {
    isOpen: false,
    pages: [],
    currentSpread: 0,
    turning: false,
    turnProgress: 0,
    turnDirection: 1,
    turnStartTime: 0,
    postId: null,
    tocMode: false,
    tocEntries: [],
    animFrame: null,
    isMobile: false,
    hoverSide: null, // 'left' or 'right' or null
  };

  // --- DOM ---
  var overlay, canvas, ctx, closeBtn, navHint;

  function createDOM() {
    overlay = document.createElement('div');
    overlay.id = 'bookOverlay';

    canvas = document.createElement('canvas');
    canvas.id = 'bookCanvas';
    overlay.appendChild(canvas);

    closeBtn = document.createElement('button');
    closeBtn.className = 'book-close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close book');
    overlay.appendChild(closeBtn);

    navHint = document.createElement('div');
    navHint.className = 'book-nav-hint';
    navHint.textContent = 'click pages to turn // esc to close';
    overlay.appendChild(navHint);

    document.body.appendChild(overlay);
    ctx = canvas.getContext('2d');
  }

  // --- Resize ---
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.isMobile = window.innerWidth < 768;
  }

  // --- Book Dimensions ---
  function getBookRect() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var bookW, bookH;
    if (state.isMobile) {
      bookW = vw * 0.92;
      bookH = vh * 0.65;
    } else {
      bookW = Math.min(vw * 0.75, 960);
      bookH = Math.min(vh * 0.7, 580);
    }
    var x = (vw - bookW) / 2;
    var y = (vh - bookH) / 2 - 10;
    return { x: x, y: y, w: bookW, h: bookH };
  }

  // --- Procedural Parchment Noise ---
  var noiseCanvas = null;
  function generateNoise(w, h) {
    if (noiseCanvas && noiseCanvas.width === Math.ceil(w) && noiseCanvas.height === Math.ceil(h)) return noiseCanvas;
    noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = Math.ceil(w);
    noiseCanvas.height = Math.ceil(h);
    var nc = noiseCanvas.getContext('2d');
    var imgData = nc.createImageData(noiseCanvas.width, noiseCanvas.height);
    var d = imgData.data;
    for (var i = 0; i < d.length; i += 4) {
      var v = Math.random() * 18 - 9;
      d[i] = 26 + v;
      d[i + 1] = 26 + v;
      d[i + 2] = 38 + v;
      d[i + 3] = 255;
    }
    nc.putImageData(imgData, 0, 0);
    return noiseCanvas;
  }

  // --- Draw Robot Doodle ---
  function drawRobot(ctx, cx, cy, size, color) {
    var s = size / 60;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color || COLORS.teal;
    ctx.lineWidth = 1.5 * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.35;

    // Antenna
    ctx.beginPath();
    ctx.moveTo(0, -22 * s);
    ctx.lineTo(0, -30 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -32 * s, 3 * s, 0, Math.PI * 2);
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.roundRect(-14 * s, -22 * s, 28 * s, 22 * s, 4 * s);
    ctx.stroke();

    // Eyes
    ctx.fillStyle = COLORS.accent;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(-8 * s, -16 * s, 6 * s, 6 * s);
    ctx.fillStyle = COLORS.teal;
    ctx.fillRect(2 * s, -16 * s, 6 * s, 6 * s);

    // Mouth
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(-6 * s, -4 * s);
    ctx.lineTo(6 * s, -4 * s);
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.roundRect(-12 * s, 2 * s, 24 * s, 28 * s, 3 * s);
    ctx.stroke();

    // Belt
    ctx.beginPath();
    ctx.moveTo(-12 * s, 14 * s);
    ctx.lineTo(12 * s, 14 * s);
    ctx.stroke();

    // Arms
    ctx.beginPath();
    ctx.moveTo(-12 * s, 6 * s);
    ctx.lineTo(-20 * s, 18 * s);
    ctx.moveTo(12 * s, 6 * s);
    ctx.lineTo(20 * s, 18 * s);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(-6 * s, 30 * s);
    ctx.lineTo(-8 * s, 40 * s);
    ctx.moveTo(6 * s, 30 * s);
    ctx.lineTo(8 * s, 40 * s);
    ctx.stroke();

    ctx.restore();
  }

  // --- Draw Curved Page ---
  function drawCurvedPage(side, bk, opts) {
    opts = opts || {};
    var pageW = bk.w / 2;
    var pageH = bk.h;
    var pInset = bk.w * PERSPECTIVE;
    var sCurve = pageW * SPINE_CURVE;
    var spineX = bk.x + bk.w / 2;
    var alpha = opts.alpha !== undefined ? opts.alpha : 1;
    var xOffset = opts.xOffset || 0;
    var shadowDepth = opts.shadowDepth || 0;

    ctx.save();
    ctx.globalAlpha = alpha;

    var outerX, topOuter, topSpine, botOuter, botSpine;

    if (side === 'left') {
      outerX = bk.x + xOffset;
      topOuter = { x: outerX + pInset, y: bk.y };
      topSpine = { x: spineX + xOffset, y: bk.y + pInset * 0.3 };
      botOuter = { x: outerX, y: bk.y + pageH };
      botSpine = { x: spineX + xOffset, y: bk.y + pageH };
    } else {
      outerX = bk.x + bk.w + xOffset;
      topOuter = { x: outerX - pInset, y: bk.y };
      topSpine = { x: spineX + xOffset, y: bk.y + pInset * 0.3 };
      botOuter = { x: outerX, y: bk.y + pageH };
      botSpine = { x: spineX + xOffset, y: bk.y + pageH };
    }

    ctx.beginPath();
    // Top edge
    ctx.moveTo(topOuter.x, topOuter.y);
    ctx.lineTo(topSpine.x, topSpine.y);

    // Spine edge (curved segments going down)
    for (var i = 1; i <= SEGMENT_COUNT; i++) {
      var t = i / SEGMENT_COUNT;
      var sy = topSpine.y + (botSpine.y - topSpine.y) * t;
      var bend = 0;
      if (i <= 2) {
        bend = sCurve * (1 - t * (SEGMENT_COUNT / 3));
      } else if (i <= SEGMENT_COUNT - 1) {
        bend = -sCurve * 0.15 * Math.sin(t * Math.PI);
      }
      var sx = (side === 'left') ? topSpine.x - bend : topSpine.x + bend;
      ctx.lineTo(sx, sy);
    }

    // Bottom edge
    ctx.lineTo(botOuter.x, botOuter.y);
    // Outer edge back up
    ctx.lineTo(topOuter.x, topOuter.y);
    ctx.closePath();

    // Shadow behind page
    if (shadowDepth > 0) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8 + shadowDepth * 4;
      ctx.shadowOffsetY = 2 + shadowDepth;
      ctx.fillStyle = COLORS.pageBg;
      ctx.fill();
      ctx.restore();
    }

    // Fill page
    ctx.fillStyle = COLORS.pageBg;
    ctx.fill();

    // Noise texture overlay
    ctx.save();
    ctx.clip();
    var noise = generateNoise(pageW, pageH);
    var drawX = (side === 'left') ? bk.x + xOffset : spineX + xOffset;
    ctx.globalAlpha = 0.3;
    ctx.drawImage(noise, drawX, bk.y, pageW, pageH);
    ctx.restore();

    // Aged edges gradient
    ctx.save();
    ctx.clip();
    var edgeGrad;
    if (side === 'left') {
      edgeGrad = ctx.createLinearGradient(outerX, bk.y, outerX + 30, bk.y);
    } else {
      edgeGrad = ctx.createLinearGradient(outerX, bk.y, outerX - 30, bk.y);
    }
    edgeGrad.addColorStop(0, 'rgba(231, 76, 60, 0.06)');
    edgeGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = edgeGrad;
    ctx.fill();

    // Top/bottom darkening
    var topGrad = ctx.createLinearGradient(0, bk.y, 0, bk.y + 25);
    topGrad.addColorStop(0, 'rgba(0,0,0,0.15)');
    topGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = topGrad;
    ctx.fill();
    ctx.restore();

    // Spine shadow
    ctx.save();
    ctx.clip();
    var spineGrad;
    if (side === 'left') {
      spineGrad = ctx.createLinearGradient(spineX + xOffset, 0, spineX + xOffset - 40, 0);
    } else {
      spineGrad = ctx.createLinearGradient(spineX + xOffset, 0, spineX + xOffset + 40, 0);
    }
    spineGrad.addColorStop(0, 'rgba(0,0,0,0.4)');
    spineGrad.addColorStop(0.5, 'rgba(0,0,0,0.1)');
    spineGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = spineGrad;
    ctx.fillRect(side === 'left' ? spineX + xOffset - 40 : spineX + xOffset, bk.y, 40, pageH);
    ctx.restore();

    // Page border
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.restore();

    // Return clipping info for content rendering
    return {
      side: side,
      outerX: topOuter.x,
      spineX: topSpine.x,
      topY: Math.max(topOuter.y, topSpine.y) + 4,
      botY: botOuter.y,
      pInset: pInset,
    };
  }

  // --- Content Pagination ---
  function parsePostContent(postId) {
    var template = document.getElementById(postId);
    if (!template) return [];
    var div = document.createElement('div');
    div.innerHTML = template.innerHTML;
    var elements = [];

    for (var i = 0; i < div.childNodes.length; i++) {
      var node = div.childNodes[i];
      if (node.nodeType === 3) {
        var t = node.textContent.trim();
        if (t) elements.push({ type: 'p', text: t });
      } else if (node.nodeType === 1) {
        var tag = node.tagName.toLowerCase();
        if (tag === 'time') {
          elements.push({ type: 'date', text: node.textContent.trim() });
        } else if (tag === 'h1') {
          elements.push({ type: 'h1', text: node.textContent.trim() });
        } else if (tag === 'h2') {
          elements.push({ type: 'h2', text: node.textContent.trim() });
        } else if (tag === 'h3') {
          elements.push({ type: 'h3', text: node.textContent.trim() });
        } else if (tag === 'p') {
          elements.push({ type: 'p', text: node.textContent.trim() });
        } else if (tag === 'blockquote') {
          elements.push({ type: 'quote', text: node.textContent.trim() });
        } else if (tag === 'ol' || tag === 'ul') {
          var items = node.querySelectorAll('li');
          for (var j = 0; j < items.length; j++) {
            elements.push({ type: 'li', text: (j + 1) + '. ' + items[j].textContent.trim() });
          }
        } else if (tag === 'img') {
          // Skip images in book view
        }
      }
    }
    return elements;
  }

  function wrapText(text, maxW, font) {
    ctx.font = font;
    var words = text.split(' ');
    var lines = [];
    var line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line + (line ? ' ' : '') + words[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function paginateContent(elements, bk) {
    var pageW = bk.w / 2;
    var usableW = pageW - 60; // padding on each side
    if (state.isMobile) usableW = bk.w - 50;
    var pageH = bk.h - 50; // top/bottom padding
    var pages = [];
    var currentPage = [];
    var yPos = 0;
    var lineH = 20;
    var titleLineH = 28;
    var h2LineH = 24;

    function newPage() {
      if (currentPage.length > 0) {
        pages.push(currentPage);
      }
      currentPage = [];
      yPos = 0;
    }

    function addBlock(item) {
      var font, lh, color, leftPad = 0;
      switch (item.type) {
        case 'date':
          font = '12px ' + FONT_MONO;
          lh = 18;
          color = COLORS.textMuted;
          break;
        case 'h1':
          font = 'bold 20px ' + FONT_SANS;
          lh = titleLineH;
          color = COLORS.text;
          if (yPos > 0) yPos += 12;
          break;
        case 'h2':
          font = 'bold 16px ' + FONT_SANS;
          lh = h2LineH;
          color = COLORS.teal;
          if (yPos > 0) yPos += 14;
          break;
        case 'h3':
          font = 'bold 14px ' + FONT_SANS;
          lh = 20;
          color = COLORS.gold;
          if (yPos > 0) yPos += 10;
          break;
        case 'quote':
          font = 'italic 13px ' + FONT_SANS;
          lh = lineH;
          color = COLORS.textSec;
          leftPad = 16;
          if (yPos > 0) yPos += 8;
          break;
        case 'li':
          font = '13px ' + FONT_SANS;
          lh = lineH;
          color = COLORS.textSec;
          leftPad = 12;
          if (yPos > 0) yPos += 4;
          break;
        default:
          font = '13px ' + FONT_SANS;
          lh = lineH;
          color = COLORS.textSec;
          if (yPos > 0) yPos += 8;
      }

      var lines = wrapText(item.text, usableW - leftPad, font);
      for (var i = 0; i < lines.length; i++) {
        if (yPos + lh > pageH) {
          newPage();
        }
        currentPage.push({
          text: lines[i],
          y: yPos,
          font: font,
          color: color,
          leftPad: leftPad,
          isQuote: item.type === 'quote',
        });
        yPos += lh;
      }
    }

    for (var i = 0; i < elements.length; i++) {
      addBlock(elements[i]);
    }
    newPage(); // flush last page

    return pages;
  }

  // --- Build TOC ---
  function buildTOC() {
    var posts = [];
    for (var i = 1; i <= 10; i++) {
      var tmpl = document.getElementById('post-' + i);
      if (!tmpl) break;
      var div = document.createElement('div');
      div.innerHTML = tmpl.innerHTML;
      var h1 = div.querySelector('h1');
      var time = div.querySelector('time');
      if (h1) {
        posts.push({
          id: 'post-' + i,
          title: h1.textContent.trim(),
          date: time ? time.textContent.trim() : '',
        });
      }
    }
    return posts;
  }

  // --- Render Page Content ---
  function renderPageContent(pageData, bk, side, pageNum) {
    if (!pageData) return;
    var pageW = bk.w / 2;
    var padX = 30;
    var padY = 28;
    var contentX;
    if (state.isMobile) {
      contentX = bk.x + padX;
    } else if (side === 'left') {
      contentX = bk.x + padX;
    } else {
      contentX = bk.x + bk.w / 2 + padX;
    }

    ctx.save();

    // Clip to page area roughly
    var clipX = (side === 'left' || state.isMobile) ? bk.x + 2 : bk.x + bk.w / 2 + 2;
    var clipW = state.isMobile ? bk.w - 4 : pageW - 4;
    ctx.beginPath();
    ctx.rect(clipX, bk.y + 2, clipW, bk.h - 4);
    ctx.clip();

    for (var i = 0; i < pageData.length; i++) {
      var item = pageData[i];
      var x = contentX + item.leftPad;
      var y = bk.y + padY + item.y;

      // Quote left border
      if (item.isQuote) {
        ctx.fillStyle = COLORS.accent;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(contentX + 2, y - 2, 2, 16);
        ctx.globalAlpha = 1;
      }

      ctx.font = item.font;
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, x, y + 13);
    }

    // Page number
    ctx.font = '11px ' + FONT_MONO;
    ctx.fillStyle = COLORS.textMuted;
    ctx.globalAlpha = 0.5;
    var numText = String(pageNum);
    if (side === 'left' || state.isMobile) {
      ctx.fillText(numText, contentX, bk.y + bk.h - 12);
    } else {
      var tw = ctx.measureText(numText).width;
      ctx.fillText(numText, contentX + clipW - padX * 2 - tw, bk.y + bk.h - 12);
    }

    ctx.restore();
  }

  // --- Render TOC Page ---
  function renderTOCLeft(bk) {
    var padX = 30, padY = 30;
    var x = bk.x + padX;
    var y = bk.y + padY;
    var pageW = state.isMobile ? bk.w : bk.w / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(bk.x + 2, bk.y + 2, pageW - 4, bk.h - 4);
    ctx.clip();

    // Title
    ctx.font = 'bold 11px ' + FONT_MONO;
    ctx.fillStyle = COLORS.accent;
    ctx.fillText('// RANDROID\'S', x, y + 14);

    ctx.font = 'bold 26px ' + FONT_SANS;
    ctx.fillStyle = COLORS.text;
    ctx.fillText('CODEX', x, y + 48);

    // Decorative line
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y + 58);
    ctx.lineTo(x + 120, y + 58);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Robot mascot
    drawRobot(ctx, x + 60, y + 120, 80, COLORS.teal);

    // Stats
    var statsY = y + 185;
    ctx.font = '11px ' + FONT_MONO;
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText('projects: 27', x, statsY);
    ctx.fillText('playable: 15', x, statsY + 18);
    ctx.fillText('languages: 9', x, statsY + 36);
    ctx.fillText('agents: countless', x, statsY + 54);

    // Subtitle
    ctx.font = 'italic 12px ' + FONT_SANS;
    ctx.fillStyle = COLORS.textSec;
    ctx.globalAlpha = 0.6;
    ctx.fillText('Thoughts from the Dojo', x, bk.y + bk.h - 20);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function renderTOCRight(bk) {
    var padX = 30, padY = 30;
    var spineX = bk.x + bk.w / 2;
    var x = state.isMobile ? bk.x + padX : spineX + padX;
    var y = bk.y + padY;
    var pageW = state.isMobile ? bk.w : bk.w / 2;

    ctx.save();
    var clipX = state.isMobile ? bk.x + 2 : spineX + 2;
    ctx.beginPath();
    ctx.rect(clipX, bk.y + 2, pageW - 4, bk.h - 4);
    ctx.clip();

    // Header
    ctx.font = 'bold 11px ' + FONT_MONO;
    ctx.fillStyle = COLORS.teal;
    ctx.fillText('TABLE OF CONTENTS', x, y + 14);

    // Decorative line
    ctx.strokeStyle = COLORS.teal;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y + 22);
    ctx.lineTo(x + pageW - padX * 2 - 10, y + 22);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Entries
    var toc = buildTOC();
    state.tocEntries = [];
    var entryY = y + 48;
    var availW = pageW - padX * 2 - 20;

    for (var i = 0; i < toc.length; i++) {
      var entry = toc[i];
      // Number
      ctx.font = 'bold 14px ' + FONT_MONO;
      ctx.fillStyle = COLORS.accent;
      ctx.fillText((i + 1) + '.', x, entryY);

      // Title (truncate if needed)
      ctx.font = '13px ' + FONT_SANS;
      ctx.fillStyle = COLORS.text;
      var title = entry.title;
      while (ctx.measureText(title).width > availW - 30 && title.length > 20) {
        title = title.slice(0, -4) + '...';
      }
      ctx.fillText(title, x + 24, entryY);

      // Date
      ctx.font = '10px ' + FONT_MONO;
      ctx.fillStyle = COLORS.textMuted;
      ctx.fillText(entry.date, x + 24, entryY + 18);

      // Dots line
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(x + 24, entryY + 28);
      ctx.lineTo(x + availW, entryY + 28);
      ctx.stroke();
      ctx.setLineDash([]);

      // Store for click detection
      state.tocEntries.push({
        id: entry.id,
        x: clipX,
        y: entryY - 10,
        w: pageW - 4,
        h: 45,
      });

      entryY += 52;
    }

    ctx.restore();
  }

  // --- Draw Full Book ---
  function drawBook() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var bk = getBookRect();

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background surface (dark table)
    var tableGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
    tableGrad.addColorStop(0, '#12100e');
    tableGrad.addColorStop(1, '#080808');
    ctx.fillStyle = tableGrad;
    ctx.fillRect(0, 0, w, h);

    // Book shadow on table
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 15;
    ctx.fillStyle = COLORS.coverDark;
    ctx.fillRect(bk.x - 6, bk.y - 4, bk.w + 12, bk.h + 12);
    ctx.restore();

    // Back cover
    ctx.fillStyle = COLORS.coverDark;
    ctx.fillRect(bk.x - 4, bk.y - 3, bk.w + 8, bk.h + 8);
    // Cover edge accent
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.2;
    ctx.strokeRect(bk.x - 4, bk.y - 3, bk.w + 8, bk.h + 8);
    ctx.globalAlpha = 1;

    // Page stack (visible edges underneath)
    for (var s = 3; s >= 1; s--) {
      ctx.fillStyle = s % 2 === 0 ? '#1d1d29' : '#1b1b27';
      ctx.globalAlpha = 0.5;
      var off = s * 2;
      ctx.fillRect(bk.x + off, bk.y + bk.h + off - 2, bk.w - off * 2, 2);
      ctx.fillRect(bk.x - off, bk.y + off, 2, bk.h - off * 2);
      ctx.fillRect(bk.x + bk.w + off - 2, bk.y + off, 2, bk.h - off * 2);
    }
    ctx.globalAlpha = 1;

    // Total pages
    var totalPages = state.pages.length;
    var spread = state.currentSpread;

    if (state.isMobile) {
      // Single page mode
      var pageIdx = spread;
      drawCurvedPage('left', bk, { shadowDepth: 2 });

      if (state.tocMode && pageIdx === 0) {
        renderTOCLeft(bk);
      } else if (state.tocMode && pageIdx === 1) {
        renderTOCRight(bk);
      } else {
        var dataIdx = state.tocMode ? pageIdx - 2 : pageIdx;
        if (state.pages[dataIdx]) {
          renderPageContent(state.pages[dataIdx], bk, 'left', dataIdx + 1);
        }
      }
    } else {
      // Spread mode: left and right pages
      var leftIdx, rightIdx;
      if (state.tocMode) {
        leftIdx = spread * 2;
        rightIdx = spread * 2 + 1;
      } else {
        leftIdx = spread * 2;
        rightIdx = spread * 2 + 1;
      }

      // Draw left page
      drawCurvedPage('left', bk, { shadowDepth: 2 });
      // Draw right page
      drawCurvedPage('right', bk, { shadowDepth: 2 });

      // Spine line
      var spineX = bk.x + bk.w / 2;
      ctx.strokeStyle = COLORS.spine;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(spineX, bk.y);
      ctx.lineTo(spineX, bk.y + bk.h);
      ctx.stroke();

      // Spine glow
      var sg = ctx.createLinearGradient(spineX - 8, 0, spineX + 8, 0);
      sg.addColorStop(0, 'transparent');
      sg.addColorStop(0.5, 'rgba(231, 76, 60, 0.07)');
      sg.addColorStop(1, 'transparent');
      ctx.fillStyle = sg;
      ctx.fillRect(spineX - 8, bk.y, 16, bk.h);

      // Render content
      if (state.tocMode && spread === 0) {
        renderTOCLeft(bk);
        renderTOCRight(bk);
      } else {
        var baseIdx = state.tocMode ? (spread - 1) * 2 : spread * 2;
        if (state.tocMode && spread > 0) {
          if (state.pages[baseIdx]) renderPageContent(state.pages[baseIdx], bk, 'left', baseIdx + 1);
          if (state.pages[baseIdx + 1]) renderPageContent(state.pages[baseIdx + 1], bk, 'right', baseIdx + 2);
        } else if (!state.tocMode) {
          if (state.pages[leftIdx]) renderPageContent(state.pages[leftIdx], bk, 'left', leftIdx + 1);
          if (state.pages[rightIdx]) renderPageContent(state.pages[rightIdx], bk, 'right', rightIdx + 1);
        }
      }

      // Robot decoration on non-TOC pages (bottom right corner occasionally)
      if (spread > 0 && spread % 3 === 0) {
        drawRobot(ctx, bk.x + bk.w - 50, bk.y + bk.h - 55, 50, COLORS.accent);
      }
      if (spread > 0 && spread % 4 === 1) {
        drawRobot(ctx, bk.x + 45, bk.y + bk.h - 55, 45, COLORS.teal);
      }
    }

    // Hover indicator
    if (state.hoverSide && !state.turning) {
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = COLORS.teal;
      if (state.hoverSide === 'left') {
        ctx.fillRect(bk.x, bk.y, bk.w / 2, bk.h);
      } else {
        ctx.fillRect(bk.x + bk.w / 2, bk.y, bk.w / 2, bk.h);
      }
      ctx.restore();
    }

    // Page turn animation overlay
    if (state.turning) {
      drawPageTurn(bk);
    }
  }

  // --- Page Turn Animation ---
  function drawPageTurn(bk) {
    var t = state.turnProgress;
    // Ease in-out
    t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    var pageW = bk.w / 2;
    var spineX = bk.x + bk.w / 2;

    ctx.save();

    if (state.turnDirection === 1) {
      // Turning forward: right page lifts and goes left
      var angle = t * Math.PI; // 0 to PI
      var flipW = pageW * Math.abs(Math.cos(angle));
      var flipX;
      if (t < 0.5) {
        flipX = spineX;
      } else {
        flipX = spineX - flipW;
      }

      // Shadow under turning page
      ctx.fillStyle = 'rgba(0,0,0,' + (0.3 * Math.sin(t * Math.PI)) + ')';
      ctx.fillRect(flipX - 5, bk.y - 2, flipW + 10, bk.h + 4);

      // The turning page
      ctx.fillStyle = COLORS.pageLight;
      ctx.fillRect(flipX, bk.y, flipW, bk.h);

      // Gradient to simulate page curve
      var grad = ctx.createLinearGradient(flipX, 0, flipX + flipW, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0.2)');
      grad.addColorStop(0.3, 'rgba(0,0,0,0)');
      grad.addColorStop(0.7, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.15)');
      ctx.fillStyle = grad;
      ctx.fillRect(flipX, bk.y, flipW, bk.h);
    } else {
      // Turning backward: left page lifts and goes right
      var angle = t * Math.PI;
      var flipW = pageW * Math.abs(Math.cos(angle));
      var flipX;
      if (t < 0.5) {
        flipX = spineX - flipW;
      } else {
        flipX = spineX;
      }

      ctx.fillStyle = 'rgba(0,0,0,' + (0.3 * Math.sin(t * Math.PI)) + ')';
      ctx.fillRect(flipX - 5, bk.y - 2, flipW + 10, bk.h + 4);

      ctx.fillStyle = COLORS.pageLight;
      ctx.fillRect(flipX, bk.y, flipW, bk.h);

      var grad = ctx.createLinearGradient(flipX, 0, flipX + flipW, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0.15)');
      grad.addColorStop(0.3, 'rgba(0,0,0,0)');
      grad.addColorStop(0.7, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = grad;
      ctx.fillRect(flipX, bk.y, flipW, bk.h);
    }

    ctx.restore();
  }

  // --- Page Navigation ---
  function getMaxSpread() {
    var totalPages = state.pages.length;
    if (state.isMobile) {
      var total = state.tocMode ? totalPages + 2 : totalPages;
      return total - 1;
    } else {
      var total = state.tocMode ? totalPages + 2 : totalPages;
      return Math.ceil(total / 2) - 1;
    }
  }

  function turnPage(dir) {
    if (state.turning) return;
    var maxSpread = getMaxSpread();
    var newSpread = state.currentSpread + dir;
    if (newSpread < 0 || newSpread > maxSpread) return;

    state.turning = true;
    state.turnDirection = dir;
    state.turnStartTime = performance.now();
    state.turnProgress = 0;

    function animateTurn(now) {
      var elapsed = now - state.turnStartTime;
      state.turnProgress = Math.min(elapsed / PAGE_TURN_MS, 1);

      if (state.turnProgress >= 1) {
        state.turning = false;
        state.currentSpread = newSpread;
        state.turnProgress = 0;
        render();
        return;
      }
      render();
      requestAnimationFrame(animateTurn);
    }
    requestAnimationFrame(animateTurn);
  }

  function jumpToPost(postId) {
    var elements = parsePostContent(postId);
    var bk = getBookRect();
    state.pages = paginateContent(elements, bk);
    state.postId = postId;
    state.tocMode = true;
    // Jump to spread 1 (first content spread after TOC)
    state.currentSpread = state.isMobile ? 2 : 1;
    render();
  }

  // --- Render Loop ---
  function render() {
    drawBook();
  }

  function startRenderLoop() {
    render();
    // We don't need continuous RAF - render on events only
  }

  // --- Event Handlers ---
  function handleClick(e) {
    if (state.turning) return;
    var bk = getBookRect();
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;

    // Check if click is outside book
    if (mx < bk.x - 20 || mx > bk.x + bk.w + 20 || my < bk.y - 20 || my > bk.y + bk.h + 20) {
      closeBook();
      return;
    }

    // Check TOC clicks
    if (state.tocMode && state.currentSpread === 0 && !state.isMobile) {
      for (var i = 0; i < state.tocEntries.length; i++) {
        var entry = state.tocEntries[i];
        if (mx >= entry.x && mx <= entry.x + entry.w && my >= entry.y && my <= entry.y + entry.h) {
          jumpToPost(entry.id);
          return;
        }
      }
    }
    // Mobile TOC on page index 1
    if (state.tocMode && state.isMobile && state.currentSpread === 1) {
      for (var i = 0; i < state.tocEntries.length; i++) {
        var entry = state.tocEntries[i];
        if (mx >= entry.x && mx <= entry.x + entry.w && my >= entry.y && my <= entry.y + entry.h) {
          jumpToPost(entry.id);
          return;
        }
      }
    }

    // Page turn based on click side
    var midX = state.isMobile ? bk.x + bk.w / 2 : bk.x + bk.w / 2;
    if (mx > midX) {
      turnPage(1);
    } else {
      turnPage(-1);
    }
  }

  function handleMouseMove(e) {
    if (state.turning) return;
    var bk = getBookRect();
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;

    if (mx < bk.x || mx > bk.x + bk.w) {
      if (state.hoverSide !== null) {
        state.hoverSide = null;
        render();
      }
      return;
    }

    var newSide = mx < bk.x + bk.w / 2 ? 'left' : 'right';
    if (newSide !== state.hoverSide) {
      state.hoverSide = newSide;
      render();
    }
  }

  function handleKeyDown(e) {
    if (!state.isOpen) return;
    if (e.key === 'Escape') {
      closeBook();
      e.preventDefault();
    } else if (e.key === 'ArrowRight' || e.key === ' ') {
      turnPage(1);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      turnPage(-1);
      e.preventDefault();
    }
  }

  // Touch support
  var touchStartX = 0;
  function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
  }
  function handleTouchEnd(e) {
    if (!state.isOpen) return;
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      if (dx < 0) turnPage(1);
      else turnPage(-1);
    } else {
      // Tap - treat as click
      var fakeEvent = { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
      handleClick(fakeEvent);
    }
  }

  // --- Open / Close ---
  function openBook(postId) {
    if (!overlay) createDOM();
    resize();

    if (postId) {
      var elements = parsePostContent(postId);
      var bk = getBookRect();
      state.pages = paginateContent(elements, bk);
      state.postId = postId;
      state.tocMode = true;
      state.currentSpread = state.isMobile ? 2 : 1;
    } else {
      // Open to TOC
      state.pages = [];
      state.postId = null;
      state.tocMode = true;
      state.currentSpread = 0;
    }

    state.isOpen = true;
    state.turning = false;
    state.hoverSide = null;

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    // Trigger fade-in
    requestAnimationFrame(function () {
      overlay.classList.add('open');
      overlay.classList.add('fade-in');
      startRenderLoop();
    });

    // Bind events
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchend', handleTouchEnd);
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      closeBook();
    });
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', onResize);
  }

  function onResize() {
    if (!state.isOpen) return;
    resize();
    // Re-paginate
    if (state.postId) {
      var elements = parsePostContent(state.postId);
      var bk = getBookRect();
      state.pages = paginateContent(elements, bk);
    }
    render();
  }

  function closeBook() {
    if (!state.isOpen) return;
    state.isOpen = false;
    overlay.classList.remove('open');
    overlay.classList.remove('fade-in');
    document.body.style.overflow = '';

    setTimeout(function () {
      if (!state.isOpen) {
        overlay.style.display = 'none';
        canvas.removeEventListener('click', handleClick);
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('resize', onResize);
      }
    }, 400);
  }

  // --- Public API ---
  window.RandroidCodex = {
    open: openBook,
    close: closeBook,
    isOpen: function () { return state.isOpen; },
  };

})();
