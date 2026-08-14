/* ============================================================
   IntelliTamed — Graphiques SVG légers (aucune dépendance)
   lineChart / barChart / donutChart / progressRing
   ============================================================ */

(function (global) {
  "use strict";

  function svgEl(tag, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs || {}).forEach(function (k) {
      el.setAttribute(k, attrs[k]);
    });
    return el;
  }

  /* ---------- Graphique en ligne / aire ---------- */
  function lineChart(el, opts) {
    opts = opts || {};
    var labels = opts.labels || [];
    var series = opts.series || []; // [{ name, color, data:[] }]
    var height = opts.height || 260;
    var area = opts.area !== false;
    var showLegend = opts.showLegend !== false;
    var width = Math.max(el.clientWidth || 600, 320);

    var pad = { top: 24, right: 16, bottom: 34, left: 44 };
    var innerW = width - pad.left - pad.right;
    var innerH = height - pad.top - pad.bottom;

    var allVals = [];
    series.forEach(function (s) { allVals = allVals.concat(s.data); });
    var max = Math.max.apply(null, allVals.concat([1])) * 1.15;
    var niceMax = niceCeil(max);
    var min = 0;

    function x(i) {
      return pad.left + (labels.length <= 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW);
    }
    function y(v) {
      return pad.top + innerH - ((v - min) / (niceMax - min)) * innerH;
    }

    var svg = svgEl("svg", {
      viewBox: "0 0 " + width + " " + height,
      width: "100%",
      height: height,
      role: "img",
      "aria-label": opts.ariaLabel || "Graphique"
    });
    svg.style.overflow = "visible";

    // Grille horizontale + étiquettes
    var ticks = 4;
    for (var t = 0; t <= ticks; t++) {
      var val = min + ((niceMax - min) * t) / ticks;
      var yy = y(val);
      svg.appendChild(svgEl("line", {
        x1: pad.left, y1: yy, x2: width - pad.right, y2: yy,
        stroke: "#E8EDF4", "stroke-width": 1
      }));
      var lbl = svgEl("text", {
        x: pad.left - 8, y: yy + 4,
        "text-anchor": "end", "font-size": 11, fill: "#94A3B8"
      });
      lbl.textContent = formatVal(val);
      svg.appendChild(lbl);
    }

    // Étiquettes X
    labels.forEach(function (lab, i) {
      var lbl = svgEl("text", {
        x: x(i), y: height - 8,
        "text-anchor": "middle", "font-size": 11, fill: "#94A3B8"
      });
      lbl.textContent = lab;
      svg.appendChild(lbl);
    });

    // Séries
    series.forEach(function (s) {
      var pts = s.data.map(function (v, i) { return [x(i), y(v)]; });
      var line = "";
      var areaPath = "";
      pts.forEach(function (p, i) {
        if (i === 0) { line += "M" + p[0] + "," + p[1]; }
        else { line += " L" + p[0] + "," + p[1]; }
      });

      if (area && pts.length > 1) {
        areaPath = line + " L" + pts[pts.length - 1][0] + "," + (pad.top + innerH) +
          " L" + pts[0][0] + "," + (pad.top + innerH) + " Z";
        var grad = svgEl("defs");
        var lg = svgEl("linearGradient", {
          id: "lg-" + uid(), x1: "0", y1: "0", x2: "0", y2: "1"
        });
        lg.appendChild(svgEl("stop", { offset: "0%", "stop-color": s.color, "stop-opacity": 0.22 }));
        lg.appendChild(svgEl("stop", { offset: "100%", "stop-color": s.color, "stop-opacity": 0 }));
        grad.appendChild(lg);
        svg.appendChild(grad);
        svg.appendChild(svgEl("path", {
          d: areaPath, fill: "url(#" + lg.firstChild.id + ")", stroke: "none"
        }));
      }

      svg.appendChild(svgEl("path", {
        d: line, fill: "none", stroke: s.color,
        "stroke-width": 2.5, "stroke-linecap": "round", "stroke-linejoin": "round"
      }));

      // Points
      pts.forEach(function (p) {
        svg.appendChild(svgEl("circle", {
          cx: p[0], cy: p[1], r: 3.5, fill: "#fff", stroke: s.color, "stroke-width": 2
        }));
      });
    });

    // Légende
    if (showLegend && series.length > 1) {
      var legend = svgEl("div");
      legend.style.cssText = "display:flex;gap:16px;justify-content:center;margin-top:8px;font-size:12px;color:#64748B;";
      series.forEach(function (s) {
        var item = document.createElement("span");
        item.style.cssText = "display:inline-flex;align-items:center;gap:6px;";
        var dot = document.createElement("span");
        dot.style.cssText = "width:9px;height:9px;border-radius:50%;background:" + s.color + ";";
        item.appendChild(dot);
        item.appendChild(document.createTextNode(s.name));
        legend.appendChild(item);
      });
      el.appendChild(legend);
    }

    el.appendChild(svg);
  }

  /* ---------- Graphique en barres ---------- */
  function barChart(el, opts) {
    opts = opts || {};
    var labels = opts.labels || [];
    var values = opts.values || [];
    var color = opts.color || "#3B82F6";
    var height = opts.height || 260;
    var width = Math.max(el.clientWidth || 600, 320);

    var pad = { top: 20, right: 12, bottom: 34, left: 44 };
    var innerW = width - pad.left - pad.right;
    var innerH = height - pad.top - pad.bottom;
    var max = niceCeil(Math.max.apply(null, values.concat([1])));

    var svg = svgEl("svg", {
      viewBox: "0 0 " + width + " " + height,
      width: "100%", height: height, role: "img"
    });
    svg.style.overflow = "visible";

    var ticks = 4;
    for (var t = 0; t <= ticks; t++) {
      var val = (max * t) / ticks;
      var yy = pad.top + innerH - (innerH * t) / ticks;
      svg.appendChild(svgEl("line", {
        x1: pad.left, y1: yy, x2: width - pad.right, y2: yy, stroke: "#E8EDF4"
      }));
      var lbl = svgEl("text", {
        x: pad.left - 8, y: yy + 4, "text-anchor": "end", "font-size": 11, fill: "#94A3B8"
      });
      lbl.textContent = formatVal(val);
      svg.appendChild(lbl);
    }

    var slot = innerW / values.length;
    var barW = Math.min(34, slot * 0.55);

    values.forEach(function (v, i) {
      var h = (v / max) * innerH;
      var bx = pad.left + slot * i + (slot - barW) / 2;
      var by = pad.top + innerH - h;
      var rect = svgEl("rect", {
        x: bx, y: by, width: barW, height: h, rx: 5, fill: color, opacity: 0.85
      });
      rect.addEventListener("mouseenter", function () { rect.setAttribute("opacity", 1); });
      rect.addEventListener("mouseleave", function () { rect.setAttribute("opacity", 0.85); });
      svg.appendChild(rect);

      var lab = svgEl("text", {
        x: pad.left + slot * i + slot / 2, y: height - 8,
        "text-anchor": "middle", "font-size": 11, fill: "#94A3B8"
      });
      lab.textContent = labels[i] || "";
      svg.appendChild(lab);
    });

    el.appendChild(svg);
  }

  /* ---------- Donut / anneau ---------- */
  function donutChart(el, opts) {
    opts = opts || {};
    var segments = opts.segments || []; // [{ label, value, color }]
    var size = opts.size || 190;
    var thickness = opts.thickness || 26;
    var centerLabel = opts.centerLabel || "";
    var centerSub = opts.centerSub || "";
    var stroke = 2;
    var total = segments.reduce(function (a, s) { return a + s.value; }, 0) || 1;
    var r = (size - thickness) / 2 - stroke;
    var c = 2 * Math.PI * r;
    var cx = size / 2;
    var cy = size / 2;

    var svg = svgEl("svg", {
      viewBox: "0 0 " + size + " " + size,
      width: size, height: size, role: "img"
    });

    svg.appendChild(svgEl("circle", {
      cx: cx, cy: cy, r: r, fill: "none",
      stroke: "#EEF2F7", "stroke-width": thickness + stroke
    }));

    var offset = 0;
    segments.forEach(function (s) {
      var frac = s.value / total;
      var dash = Math.max(frac * c - 2, 0.5);
      var circle = svgEl("circle", {
        cx: cx, cy: cy, r: r, fill: "none",
        stroke: s.color, "stroke-width": thickness,
        "stroke-dasharray": dash + " " + (c - dash),
        "stroke-dashoffset": -offset,
        "transform": "rotate(-90 " + cx + " " + cy + ")"
      });
      svg.appendChild(circle);
      offset += frac * c;
    });

    var txt = svgEl("text", {
      x: cx, y: cy - 4, "text-anchor": "middle",
      "font-size": 20, "font-weight": 800, fill: "#111827"
    });
    txt.textContent = centerLabel;
    svg.appendChild(txt);

    if (centerSub) {
      var sub = svgEl("text", {
        x: cx, y: cy + 16, "text-anchor": "middle",
        "font-size": 11, fill: "#64748B"
      });
      sub.textContent = centerSub;
      svg.appendChild(sub);
    }

    el.appendChild(svg);
  }

  /* ---------- Anneau de progression ---------- */
  function progressRing(el, percent, opts) {
    opts = opts || {};
    var size = opts.size || 96;
    var thickness = opts.thickness || 9;
    var color = opts.color || "#2563EB";
    var track = opts.track || "#EEF2F7";
    var pct = Math.max(0, Math.min(100, percent));
    var r = (size - thickness) / 2;
    var c = 2 * Math.PI * r;
    var dash = (pct / 100) * c;

    var svg = svgEl("svg", {
      viewBox: "0 0 " + size + " " + size,
      width: size, height: size, role: "img"
    });

    svg.appendChild(svgEl("circle", {
      cx: size / 2, cy: size / 2, r: r, fill: "none",
      stroke: track, "stroke-width": thickness
    }));

    svg.appendChild(svgEl("circle", {
      cx: size / 2, cy: size / 2, r: r, fill: "none",
      stroke: color, "stroke-width": thickness,
      "stroke-linecap": "round",
      "stroke-dasharray": dash + " " + (c - dash),
      "transform": "rotate(-90 " + size / 2 + " " + size / 2 + ")"
    }));

    var txt = svgEl("text", {
      x: size / 2, y: size / 2 + 5, "text-anchor": "middle",
      "font-size": Math.round(size * 0.17), "font-weight": 800, fill: "#111827"
    });
    txt.textContent = Math.round(pct) + "%";
    svg.appendChild(txt);

    el.appendChild(svg);
  }

  /* ---------- Helpers ---------- */
  var uidCounter = 0;
  function uid() { return "g" + (++uidCounter) + "_" + Date.now().toString(36); }

  function niceCeil(v) {
    if (v <= 0) return 1;
    var pow = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / pow;
    var nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return nice * pow;
  }

  function formatVal(v) {
    if (v >= 1000) {
      var k = v / 1000;
      return (k % 1 === 0 ? k : k.toFixed(1)) + "k";
    }
    return v % 1 === 0 ? String(v) : v.toFixed(1);
  }

  global.IntelliCharts = {
    line: lineChart,
    bars: barChart,
    donut: donutChart,
    ring: progressRing
  };
})(window);
