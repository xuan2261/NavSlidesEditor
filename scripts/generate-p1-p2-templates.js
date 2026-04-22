/**
 * Generate Phase 03 (P1) + Phase 04 (P2) templates
 * P1: Electronics, Automation, Electrical (5 templates each = 15)
 * P2: Measurement, Power Electronics, Mechanical, Technical Drawing, Fluid Mechanics (3 each = 15)
 * Total: 30 new templates
 */
const fs = require('fs')
const path = require('path')

// ── Helpers ──────────────────────────────────────────
function titleSlide(id, bg, primary, text, title, subtitle) {
  return {
    id,
    elements: [
      {
        type: 'shape',
        shape: 'rect',
        x: 0,
        y: 0,
        width: 960,
        height: 8,
        fill: primary,
        stroke: 'none',
        strokeWidth: 0,
        locked: true,
        zIndex: 0,
      },
      {
        type: 'text',
        x: 60,
        y: 100,
        width: 840,
        height: 120,
        zIndex: 1,
        content: `<h1 style="text-align:center; color:${text}">${title}</h1>`,
      },
      {
        type: 'text',
        x: 160,
        y: 260,
        width: 640,
        height: 60,
        zIndex: 2,
        content: `<p style="text-align:center; color:${text}80">${subtitle}</p>`,
      },
      {
        type: 'shape',
        shape: 'rect',
        x: 380,
        y: 245,
        width: 200,
        height: 2,
        fill: `${primary}60`,
        stroke: 'none',
        strokeWidth: 0,
        locked: true,
        zIndex: 3,
      },
    ],
    background: { type: 'color', color: bg },
  }
}

function outlineSlide(id, bg, primary, text, items) {
  const ol = items.map((i) => `<li>${i}</li>`).join('')
  return {
    id,
    elements: [
      {
        type: 'shape',
        shape: 'rect',
        x: 0,
        y: 0,
        width: 960,
        height: 6,
        fill: primary,
        stroke: 'none',
        strokeWidth: 0,
        locked: true,
        zIndex: 0,
      },
      {
        type: 'text',
        x: 40,
        y: 20,
        width: 880,
        height: 50,
        zIndex: 1,
        content: `<h2 style="color:${primary}">Nội dung bài giảng</h2>`,
      },
      {
        type: 'shape',
        shape: 'rect',
        x: 40,
        y: 70,
        width: 880,
        height: 1,
        fill: `${primary}30`,
        stroke: 'none',
        strokeWidth: 0,
        locked: true,
        zIndex: 2,
      },
      {
        type: 'text',
        x: 60,
        y: 90,
        width: 840,
        height: 400,
        zIndex: 3,
        content: `<ol style="color:${text}; font-size:22px; line-height:2">${ol}</ol>`,
      },
    ],
    background: { type: 'color', color: bg },
  }
}

function contentSlide(id, bg, primary, text, heading, bodyHtml) {
  return {
    id,
    elements: [
      {
        type: 'shape',
        shape: 'rect',
        x: 0,
        y: 0,
        width: 960,
        height: 6,
        fill: primary,
        stroke: 'none',
        strokeWidth: 0,
        locked: true,
        zIndex: 0,
      },
      {
        type: 'text',
        x: 40,
        y: 20,
        width: 880,
        height: 50,
        zIndex: 1,
        content: `<h2 style="color:${primary}">${heading}</h2>`,
      },
      {
        type: 'shape',
        shape: 'rect',
        x: 40,
        y: 70,
        width: 880,
        height: 1,
        fill: `${primary}30`,
        stroke: 'none',
        strokeWidth: 0,
        locked: true,
        zIndex: 2,
      },
      {
        type: 'text',
        x: 40,
        y: 85,
        width: 880,
        height: 430,
        zIndex: 3,
        content: `<div style="color:${text}; font-size:20px; line-height:1.7">${bodyHtml}</div>`,
      },
    ],
    background: { type: 'color', color: bg },
  }
}

function twoColSlide(id, bg, primary, text, heading, leftHtml, rightHtml) {
  return {
    id,
    elements: [
      {
        type: 'shape',
        shape: 'rect',
        x: 0,
        y: 0,
        width: 960,
        height: 6,
        fill: primary,
        stroke: 'none',
        strokeWidth: 0,
        locked: true,
        zIndex: 0,
      },
      {
        type: 'text',
        x: 40,
        y: 20,
        width: 880,
        height: 50,
        zIndex: 1,
        content: `<h2 style="color:${primary}">${heading}</h2>`,
      },
      {
        type: 'shape',
        shape: 'rect',
        x: 40,
        y: 70,
        width: 880,
        height: 1,
        fill: `${primary}30`,
        stroke: 'none',
        strokeWidth: 0,
        locked: true,
        zIndex: 2,
      },
      {
        type: 'text',
        x: 40,
        y: 85,
        width: 420,
        height: 420,
        zIndex: 3,
        content: `<div style="color:${text}; font-size:18px; line-height:1.7">${leftHtml}</div>`,
      },
      {
        type: 'shape',
        shape: 'rect',
        x: 475,
        y: 85,
        width: 1,
        height: 420,
        fill: `${primary}20`,
        stroke: 'none',
        strokeWidth: 0,
        locked: true,
        zIndex: 4,
      },
      {
        type: 'text',
        x: 495,
        y: 85,
        width: 420,
        height: 420,
        zIndex: 5,
        content: `<div style="color:${text}; font-size:18px; line-height:1.7">${rightHtml}</div>`,
      },
    ],
    background: { type: 'color', color: bg },
  }
}

function tableSlide(id, bg, primary, text, heading, tableHtml) {
  return {
    id,
    elements: [
      {
        type: 'shape',
        shape: 'rect',
        x: 0,
        y: 0,
        width: 960,
        height: 6,
        fill: primary,
        stroke: 'none',
        strokeWidth: 0,
        locked: true,
        zIndex: 0,
      },
      {
        type: 'text',
        x: 40,
        y: 20,
        width: 880,
        height: 50,
        zIndex: 1,
        content: `<h2 style="color:${primary}">${heading}</h2>`,
      },
      {
        type: 'shape',
        shape: 'rect',
        x: 40,
        y: 70,
        width: 880,
        height: 1,
        fill: `${primary}30`,
        stroke: 'none',
        strokeWidth: 0,
        locked: true,
        zIndex: 2,
      },
      {
        type: 'text',
        x: 40,
        y: 85,
        width: 880,
        height: 430,
        zIndex: 3,
        content: `<div style="color:${text}; font-size:17px">${tableHtml}</div>`,
      },
    ],
    background: { type: 'color', color: bg },
  }
}

function qnaSlide(id, bg, primary, text) {
  return {
    id,
    elements: [
      {
        type: 'text',
        x: 60,
        y: 140,
        width: 840,
        height: 120,
        zIndex: 0,
        content: `<h1 style="text-align:center; color:${primary}">Hỏi &amp; Đáp</h1>`,
      },
      {
        type: 'text',
        x: 160,
        y: 280,
        width: 640,
        height: 60,
        zIndex: 1,
        content: `<p style="text-align:center; color:${text}80; font-size:20px">Cảm ơn đã theo dõi bài giảng!</p>`,
      },
    ],
    background: { type: 'color', color: bg },
  }
}

function summarySlide(id, bg, primary, text, items) {
  const ul = items.map((i) => `<li>${i}</li>`).join('')
  return {
    id,
    elements: [
      {
        type: 'shape',
        shape: 'rect',
        x: 0,
        y: 0,
        width: 960,
        height: 6,
        fill: primary,
        stroke: 'none',
        strokeWidth: 0,
        locked: true,
        zIndex: 0,
      },
      {
        type: 'text',
        x: 40,
        y: 20,
        width: 880,
        height: 50,
        zIndex: 1,
        content: `<h2 style="color:${primary}">Tổng kết</h2>`,
      },
      {
        type: 'shape',
        shape: 'rect',
        x: 40,
        y: 70,
        width: 880,
        height: 1,
        fill: `${primary}30`,
        stroke: 'none',
        strokeWidth: 0,
        locked: true,
        zIndex: 2,
      },
      {
        type: 'text',
        x: 60,
        y: 90,
        width: 840,
        height: 400,
        zIndex: 3,
        content: `<ul style="color:${text}; font-size:20px; line-height:2">${ul}</ul>`,
      },
    ],
    background: { type: 'color', color: bg },
  }
}

function labTitleSlide(id, bg, primary, text, title) {
  return {
    id,
    elements: [
      {
        type: 'shape',
        shape: 'rect',
        x: 0,
        y: 0,
        width: 960,
        height: 10,
        fill: primary,
        stroke: 'none',
        strokeWidth: 0,
        locked: true,
        zIndex: 0,
      },
      {
        type: 'shape',
        shape: 'rect',
        x: 0,
        y: 530,
        width: 960,
        height: 10,
        fill: primary,
        stroke: 'none',
        strokeWidth: 0,
        locked: true,
        zIndex: 1,
      },
      {
        type: 'text',
        x: 60,
        y: 80,
        width: 840,
        height: 50,
        zIndex: 2,
        content: `<p style="text-align:center; color:${primary}; font-size:18px; text-transform:uppercase; letter-spacing:3px">BÁO CÁO THÍ NGHIỆM</p>`,
      },
      {
        type: 'text',
        x: 60,
        y: 150,
        width: 840,
        height: 100,
        zIndex: 3,
        content: `<h1 style="text-align:center; color:${text}">${title}</h1>`,
      },
      {
        type: 'text',
        x: 160,
        y: 300,
        width: 640,
        height: 80,
        zIndex: 4,
        content: `<p style="text-align:center; color:${text}80">Nhóm: ... · MSSV: ... · Ngày TN: ...</p>`,
      },
    ],
    background: { type: 'color', color: bg },
  }
}

// eslint-disable-next-line unused-imports/no-unused-vars
function labSlide(id, bg, primary, text, heading, bodyHtml) {
  return contentSlide(id, bg, primary, text, heading, bodyHtml)
}

function seminarTitleSlide(id, bg, primary, text, title, subtitle) {
  return {
    id,
    elements: [
      {
        type: 'shape',
        shape: 'rect',
        x: 0,
        y: 0,
        width: 12,
        height: 540,
        fill: primary,
        stroke: 'none',
        strokeWidth: 0,
        locked: true,
        zIndex: 0,
      },
      {
        type: 'text',
        x: 60,
        y: 60,
        width: 840,
        height: 50,
        zIndex: 1,
        content: `<p style="color:${primary}; font-size:16px; text-transform:uppercase; letter-spacing:4px">SEMINAR</p>`,
      },
      {
        type: 'text',
        x: 60,
        y: 120,
        width: 840,
        height: 120,
        zIndex: 2,
        content: `<h1 style="color:${text}">${title}</h1>`,
      },
      {
        type: 'text',
        x: 60,
        y: 280,
        width: 640,
        height: 60,
        zIndex: 3,
        content: `<p style="color:${text}80">${subtitle}</p>`,
      },
    ],
    background: { type: 'color', color: bg },
  }
}

function projectTitleSlide(id, bg, primary, text, title) {
  return {
    id,
    elements: [
      {
        type: 'shape',
        shape: 'rect',
        x: 0,
        y: 260,
        width: 960,
        height: 4,
        fill: `${primary}40`,
        stroke: 'none',
        strokeWidth: 0,
        locked: true,
        zIndex: 0,
      },
      {
        type: 'text',
        x: 60,
        y: 60,
        width: 840,
        height: 50,
        zIndex: 1,
        content: `<p style="text-align:center; color:${primary}; font-size:16px; text-transform:uppercase; letter-spacing:4px">ĐỒ ÁN / PROJECT</p>`,
      },
      {
        type: 'text',
        x: 60,
        y: 120,
        width: 840,
        height: 120,
        zIndex: 2,
        content: `<h1 style="text-align:center; color:${text}">${title}</h1>`,
      },
      {
        type: 'text',
        x: 160,
        y: 290,
        width: 640,
        height: 80,
        zIndex: 3,
        content: `<p style="text-align:center; color:${text}80">Nhóm: ... · GVHD: ... · Học kỳ: ...</p>`,
      },
    ],
    background: { type: 'color', color: bg },
  }
}

function templateObj(
  id,
  category,
  title,
  description,
  tags,
  difficulty,
  gradientDir,
  colorScheme,
  slides
) {
  return {
    id,
    category,
    title,
    description,
    tags,
    difficulty,
    thumbnail: {
      type: 'gradient',
      gradient: `linear-gradient(${gradientDir}, ${colorScheme.background}, ${colorScheme.primary}20)`,
    },
    colorScheme,
    theme: 'black',
    transition: 'slide',
    slides,
  }
}

// ══════════════════════════════════════════════════════
// PHASE 03: P1 Templates
// ══════════════════════════════════════════════════════

const ELEC = { primary: '#ffd700', background: '#1a1200', text: '#fff5d0', accent: '#ff8c00' }
const AUTO = { primary: '#ff4757', background: '#1a0a0e', text: '#ffd5d0', accent: '#ff6b81' }
const POWER = { primary: '#4ecdc4', background: '#0a1a18', text: '#d0fff5', accent: '#2ecc71' }

function genElectronicsTemplates() {
  const c = ELEC
  const templates = []

  // 4.1 Tổng quan — Bán dẫn
  templates.push(
    templateObj(
      'elec-lecture-overview',
      'electronics',
      'Bài giảng tổng quan — Linh kiện bán dẫn',
      'Template bài giảng về linh kiện bán dẫn: Diode, BJT, MOSFET, Op-Amp. 10 slides.',
      ['semiconductor', 'diode', 'bjt', 'mosfet', 'op-amp', 'lecture'],
      'intermediate',
      '135deg',
      c,
      [
        titleSlide(
          'e1-s1',
          c.background,
          c.primary,
          c.text,
          'Linh kiện bán dẫn & Mạch khuếch đại',
          'Giảng viên: ... · Lớp: ... · Ngày: ...'
        ),
        outlineSlide('e1-s2', c.background, c.primary, c.text, [
          'Diode bán dẫn',
          'Transistor BJT',
          'BJT Amplifier',
          'MOSFET',
          'Op-Amp lý tưởng',
          'Mạch khuếch đại Op-Amp',
        ]),
        contentSlide(
          'e1-s3',
          c.background,
          c.primary,
          c.text,
          'Diode bán dẫn',
          '<p><b>Đặc tuyến I-V:</b></p><p>• Vùng phân cực thuận: dòng tăng khi V > V<sub>γ</sub> (≈ 0.7V Si)</p><p>• Vùng phân cực ngược: dòng rò rất nhỏ (I<sub>s</sub>)</p><p>• Phương trình Shockley:</p><p style="text-align:center; font-size:22px; margin:15px 0">$$I_D = I_s \\left(e^{\\frac{V_D}{nV_T}} - 1\\right)$$</p><p><b>Ứng dụng:</b> Chỉnh lưu, kẹp áp, ổn áp Zener</p>'
        ),
        twoColSlide(
          'e1-s4',
          c.background,
          c.primary,
          c.text,
          'Transistor BJT — NPN & PNP',
          '<p><b>Cấu tạo NPN:</b></p><p>Emitter (n) → Base (p) → Collector (n)</p><p><b>3 vùng hoạt động:</b></p><ul><li>Cắt (Cut-off)</li><li>Khuếch đại (Active)</li><li>Bão hoà (Saturation)</li></ul><p>$$I_C = \\beta \\cdot I_B$$</p>',
          '<p><b>Cấu tạo PNP:</b></p><p>Emitter (p) → Base (n) → Collector (p)</p><p><b>Đặc điểm:</b></p><ul><li>Dòng chảy ngược chiều NPN</li><li>V<sub>EB</sub> > 0 để dẫn</li><li>Ít phổ biến hơn NPN</li></ul>'
        ),
        contentSlide(
          'e1-s5',
          c.background,
          c.primary,
          c.text,
          'BJT Amplifier — Common Emitter',
          '<p><b>Mạch khuếch đại CE:</b></p><p>• Đảo pha 180° giữa input và output</p><p>• Hệ số khuếch đại điện áp:</p><p style="text-align:center; font-size:24px; margin:15px 0">$$A_v = -g_m \\cdot R_C = -\\frac{I_C \\cdot R_C}{V_T}$$</p><p>• Trở kháng vào: r<sub>π</sub> = β/g<sub>m</sub></p><p>• Trở kháng ra: ≈ R<sub>C</sub></p><p><b>Phân cực:</b> Voltage divider bias → ổn định điểm làm việc Q</p>'
        ),
        contentSlide(
          'e1-s6',
          c.background,
          c.primary,
          c.text,
          'MOSFET — Enhancement & Depletion',
          '<p><b>Enhancement MOSFET:</b></p><p>• Kênh N: V<sub>GS</sub> > V<sub>th</sub> → dẫn</p><p>• Vùng tuyến tính: $$I_D = \\mu_n C_{ox} \\frac{W}{L}\\left[(V_{GS}-V_{th})V_{DS} - \\frac{V_{DS}^2}{2}\\right]$$</p><p>• Vùng bão hoà: $$I_D = \\frac{1}{2}\\mu_n C_{ox} \\frac{W}{L}(V_{GS}-V_{th})^2$$</p><p><b>Ưu điểm so với BJT:</b> Trở kháng vào cực cao, tốc độ đóng cắt nhanh</p>'
        ),
        twoColSlide(
          'e1-s7',
          c.background,
          c.primary,
          c.text,
          'Op-Amp lý tưởng — Luật vàng',
          '<p><b>Đặc tính lý tưởng:</b></p><ul><li>Gain vô hạn: A → ∞</li><li>Z<sub>in</sub> → ∞</li><li>Z<sub>out</sub> → 0</li><li>Bandwidth → ∞</li></ul><p><b>Luật vàng:</b></p><p style="font-size:22px">$$V^+ = V^-$$</p><p style="font-size:22px">$$I_{in} = 0$$</p>',
          '<p><b>Op-Amp thực tế:</b></p><ul><li>A<sub>OL</sub> ≈ 10<sup>5</sup> – 10<sup>6</sup></li><li>Z<sub>in</sub> ≈ 1MΩ – 10<sup>12</sup>Ω</li><li>GBW ≈ 1–100 MHz</li><li>Slew rate: 0.5–100 V/μs</li></ul><p><b>IC phổ biến:</b></p><p>741, LM358, TL072, OPA2134</p>'
        ),
        twoColSlide(
          'e1-s8',
          c.background,
          c.primary,
          c.text,
          'Mạch khuếch đại Op-Amp',
          '<p><b>Đảo (Inverting):</b></p><p style="font-size:22px; margin:10px 0">$$A_v = -\\frac{R_f}{R_1}$$</p><p>• V<sub>in</sub> vào cực (−)</p><p>• Đảo pha 180°</p><p>• Z<sub>in</sub> = R<sub>1</sub></p>',
          '<p><b>Không đảo (Non-Inv):</b></p><p style="font-size:22px; margin:10px 0">$$A_v = 1 + \\frac{R_f}{R_1}$$</p><p>• V<sub>in</sub> vào cực (+)</p><p>• Cùng pha</p><p>• Z<sub>in</sub> rất cao</p>'
        ),
        tableSlide(
          'e1-s9',
          c.background,
          c.primary,
          c.text,
          'So sánh linh kiện bán dẫn',
          '<table style="width:100%; border-collapse:collapse"><tr style="border-bottom:2px solid #ffd700"><th style="padding:8px; text-align:left">Thông số</th><th style="padding:8px">BJT</th><th style="padding:8px">MOSFET</th><th style="padding:8px">Op-Amp</th></tr><tr style="border-bottom:1px solid #ffd70030"><td style="padding:8px">Điều khiển</td><td style="padding:8px; text-align:center">Dòng (I<sub>B</sub>)</td><td style="padding:8px; text-align:center">Áp (V<sub>GS</sub>)</td><td style="padding:8px; text-align:center">Vi sai</td></tr><tr style="border-bottom:1px solid #ffd70030"><td style="padding:8px">Z<sub>in</sub></td><td style="padding:8px; text-align:center">Trung bình</td><td style="padding:8px; text-align:center">Rất cao</td><td style="padding:8px; text-align:center">Rất cao</td></tr><tr style="border-bottom:1px solid #ffd70030"><td style="padding:8px">Tốc độ</td><td style="padding:8px; text-align:center">Nhanh</td><td style="padding:8px; text-align:center">Rất nhanh</td><td style="padding:8px; text-align:center">GBW limited</td></tr><tr><td style="padding:8px">Ứng dụng</td><td style="padding:8px; text-align:center">Khuếch đại analog</td><td style="padding:8px; text-align:center">Digital, nguồn</td><td style="padding:8px; text-align:center">Signal processing</td></tr></table>'
        ),
        qnaSlide('e1-s10', c.background, c.primary, c.text),
      ]
    )
  )

  // 4.2 Chi tiết — Op-Amp
  templates.push(
    templateObj(
      'elec-lecture-opamp',
      'electronics',
      'Bài giảng chi tiết — Mạch khuếch đại thuật toán',
      'Template chi tiết về cấu hình Op-Amp: Summer, Diff, Integrator, Comparator, Schmitt trigger. 12 slides.',
      ['op-amp', 'integrator', 'comparator', 'active-filter', 'lecture'],
      'advanced',
      '150deg',
      c,
      [
        titleSlide(
          'e2-s1',
          c.background,
          c.primary,
          c.text,
          'Mạch khuếch đại thuật toán (Op-Amp)',
          'Các cấu hình ứng dụng cơ bản & nâng cao'
        ),
        outlineSlide('e2-s2', c.background, c.primary, c.text, [
          'Summing Amplifier',
          'Differential Amplifier',
          'Integrator & Differentiator',
          'Active Filter',
          'Comparator & Schmitt Trigger',
          'Ứng dụng DAC/ADC',
        ]),
        contentSlide(
          'e2-s3',
          c.background,
          c.primary,
          c.text,
          'Summing Amplifier',
          '<p><b>Mạch cộng đảo:</b></p><p style="text-align:center; font-size:22px; margin:15px 0">$$V_o = -R_f\\left(\\frac{V_1}{R_1} + \\frac{V_2}{R_2} + \\frac{V_3}{R_3}\\right)$$</p><p>• N ngõ vào → weighted sum</p><p>• Nếu R<sub>1</sub> = R<sub>2</sub> = R<sub>3</sub> = R: V<sub>o</sub> = −(R<sub>f</sub>/R)(V<sub>1</sub>+V<sub>2</sub>+V<sub>3</sub>)</p><p><b>Ứng dụng:</b> Audio mixer, DAC R-2R</p>'
        ),
        contentSlide(
          'e2-s4',
          c.background,
          c.primary,
          c.text,
          'Differential Amplifier',
          '<p style="text-align:center; font-size:22px; margin:15px 0">$$V_o = \\frac{R_f}{R_1}(V_2 - V_1)$$</p><p>• Khuếch đại hiệu: loại bỏ nhiễu common-mode</p><p>• CMRR (Common-Mode Rejection Ratio):</p><p style="text-align:center">$$CMRR = 20\\log\\frac{A_d}{A_{cm}}$$ (dB)</p><p><b>Yêu cầu:</b> Điện trở match chính xác</p>'
        ),
        contentSlide(
          'e2-s5',
          c.background,
          c.primary,
          c.text,
          'Integrator',
          '<p><b>Mạch tích phân:</b></p><p style="text-align:center; font-size:22px; margin:15px 0">$$V_o = -\\frac{1}{RC}\\int V_{in} \\, dt$$</p><p>• Thay R<sub>f</sub> bằng tụ C</p><p>• Xung vuông vào → tam giác ra</p><p>• Cần R<sub>f</sub> song song C để chống bão hoà DC</p>'
        ),
        contentSlide(
          'e2-s6',
          c.background,
          c.primary,
          c.text,
          'Differentiator',
          '<p><b>Mạch vi phân:</b></p><p style="text-align:center; font-size:22px; margin:15px 0">$$V_o = -RC\\frac{dV_{in}}{dt}$$</p><p>• Thay R<sub>1</sub> bằng tụ C</p><p>• Tam giác vào → xung vuông ra</p><p>• Nhạy nhiễu tần số cao → cần R<sub>s</sub> nối tiếp C</p>'
        ),
        twoColSlide(
          'e2-s7',
          c.background,
          c.primary,
          c.text,
          'Active Filter — Low-pass & High-pass',
          '<p><b>LPF bậc 1:</b></p><p>$$f_c = \\frac{1}{2\\pi R_f C}$$</p><p>• Roll-off: -20 dB/decade</p><p>• Butterworth: phẳng nhất</p><p>• Chebyshev: steep hơn</p>',
          '<p><b>HPF bậc 1:</b></p><p>$$f_c = \\frac{1}{2\\pi R_1 C}$$</p><p>• Hoán đổi R và C so với LPF</p><p>• Band-pass = LPF + HPF cascade</p><p>• Sallen-Key topology phổ biến</p>'
        ),
        contentSlide(
          'e2-s8',
          c.background,
          c.primary,
          c.text,
          'Comparator',
          '<p><b>So sánh Open-loop:</b></p><p>• V<sub>in</sub> > V<sub>ref</sub> → V<sub>o</sub> = +V<sub>sat</sub></p><p>• V<sub>in</sub> < V<sub>ref</sub> → V<sub>o</sub> = −V<sub>sat</sub></p><p><b>Schmitt Trigger:</b></p><p>• Positive feedback → trễ (hysteresis)</p><p>• $$V_{TH} = \\frac{R_1}{R_1+R_2}V_{sat}$$</p><p>• $$V_{TL} = -\\frac{R_1}{R_1+R_2}V_{sat}$$</p><p>• Chống nhiễu, tạo xung vuông sạch</p>'
        ),
        contentSlide(
          'e2-s9',
          c.background,
          c.primary,
          c.text,
          'Instrumentation Amplifier',
          '<p>Kết hợp 3 Op-Amp → CMRR rất cao</p><p style="text-align:center; font-size:22px; margin:15px 0">$$A_v = \\left(1 + \\frac{2R_1}{R_{gain}}\\right)\\frac{R_3}{R_2}$$</p><p>• Chỉ cần thay đổi R<sub>gain</sub> để điều chỉnh gain</p><p>• IC: INA128, AD620, INA333</p><p><b>Ứng dụng:</b> Đo cầu Wheatstone, strain gauge, ECG</p>'
        ),
        contentSlide(
          'e2-s10',
          c.background,
          c.primary,
          c.text,
          'Ứng dụng trong DAC/ADC',
          '<p><b>DAC R-2R Ladder:</b></p><p>• N bit → summing amplifier</p><p>• MSB có trọng số lớn nhất</p><p><b>ADC Flash:</b></p><p>• 2<sup>N</sup>−1 comparators song song</p><p>• Nhanh nhất nhưng tốn linh kiện</p><p><b>ADC SAR (Successive Approximation):</b></p><p>• Binary search → N clock cycles</p><p>• Phổ biến nhất trong MCU</p>'
        ),
        summarySlide('e2-s11', c.background, c.primary, c.text, [
          'Summer: cộng tín hiệu có trọng số',
          'Differential: khuếch đại vi sai, loại nhiễu CM',
          'Integrator/Differentiator: xử lý tín hiệu theo thời gian',
          'Active Filter: LPF, HPF, BPF với gain',
          'Comparator & Schmitt: tạo logic từ analog',
          'Instrumentation Amp: đo lường chính xác cao',
        ]),
        qnaSlide('e2-s12', c.background, c.primary, c.text),
      ]
    )
  )

  // 4.3 Lab Report — BJT
  templates.push(
    templateObj(
      'elec-lab-bjt',
      'electronics',
      'Lab Report — Khảo sát đặc tuyến BJT',
      'Template báo cáo thí nghiệm đo đặc tuyến BJT: I<sub>C</sub>-V<sub>CE</sub>, xác định β. 8 slides.',
      ['bjt', 'lab', 'experiment', 'characteristic', 'electronics'],
      'beginner',
      '180deg',
      c,
      [
        labTitleSlide(
          'e3-s1',
          c.background,
          c.primary,
          c.text,
          'Khảo sát đặc tuyến Transistor BJT'
        ),
        contentSlide(
          'e3-s2',
          c.background,
          c.primary,
          c.text,
          'Mục đích thí nghiệm',
          '<ul style="font-size:20px; line-height:2"><li>Vẽ đặc tuyến ngõ ra I<sub>C</sub> − V<sub>CE</sub> ở các mức I<sub>B</sub> khác nhau</li><li>Vẽ đặc tuyến truyền đạt I<sub>C</sub> − I<sub>B</sub></li><li>Xác định hệ số khuếch đại dòng β = I<sub>C</sub>/I<sub>B</sub></li><li>Xác định vùng hoạt động: cắt, khuếch đại, bão hoà</li><li>BJT sử dụng: 2N2222 (NPN)</li></ul>'
        ),
        contentSlide(
          'e3-s3',
          c.background,
          c.primary,
          c.text,
          'Sơ đồ mạch thí nghiệm',
          '<p><b>Thiết bị:</b></p><ul><li>BJT 2N2222, breadboard</li><li>2 nguồn DC (V<sub>BB</sub>, V<sub>CC</sub>)</li><li>R<sub>B</sub> = 100kΩ, R<sub>C</sub> = 1kΩ</li><li>DMM × 2 (đo I<sub>B</sub>, I<sub>C</sub>)</li></ul><p><b>Bước thực hiện:</b></p><ol><li>Đặt V<sub>CC</sub> = 10V cố định</li><li>Thay đổi V<sub>BB</sub> để I<sub>B</sub> = 10, 20, 30, 40, 50 μA</li><li>Với mỗi I<sub>B</sub>: sweep V<sub>CE</sub> = 0→10V, đo I<sub>C</sub></li></ol>'
        ),
        contentSlide(
          'e3-s4',
          c.background,
          c.primary,
          c.text,
          'Bảng số liệu',
          '<p><b>Đặc tuyến ngõ ra (I<sub>B</sub> = 20μA):</b></p><table style="width:100%; border-collapse:collapse; font-size:16px"><tr style="border-bottom:2px solid #ffd700"><th style="padding:6px">V<sub>CE</sub> (V)</th><th>0.1</th><th>0.5</th><th>1</th><th>2</th><th>4</th><th>6</th><th>8</th><th>10</th></tr><tr><td style="padding:6px">I<sub>C</sub> (mA)</td><td>0.5</td><td>1.8</td><td>2.0</td><td>2.05</td><td>2.1</td><td>2.15</td><td>2.2</td><td>2.25</td></tr></table><p style="margin-top:15px"><b>Ghi chú:</b> Ghi đủ các mức I<sub>B</sub> = 10, 20, 30, 40, 50 μA</p>'
        ),
        contentSlide(
          'e3-s5',
          c.background,
          c.primary,
          c.text,
          'Đồ thị đặc tuyến',
          '<p>Vẽ trên giấy milimet hoặc Excel/MATLAB:</p><ul style="line-height:2"><li><b>Đặc tuyến ngõ ra:</b> 5 đường I<sub>C</sub>(V<sub>CE</sub>) ứng với 5 mức I<sub>B</sub></li><li><b>Đặc tuyến truyền đạt:</b> I<sub>C</sub>(I<sub>B</sub>) tại V<sub>CE</sub> = 5V</li><li>Xác định vùng bão hoà: V<sub>CE(sat)</sub> ≈ 0.2V</li></ul><p style="margin-top:15px; font-style:italic; color:#ffd70080">Chèn ảnh chụp đồ thị vào đây</p>'
        ),
        contentSlide(
          'e3-s6',
          c.background,
          c.primary,
          c.text,
          'Tính toán & Phân tích',
          '<p><b>Hệ số khuếch đại:</b></p><p style="text-align:center; font-size:22px">$$\\beta = \\frac{I_C}{I_B} = \\frac{2.05\\text{mA}}{20\\mu\\text{A}} \\approx 102$$</p><p><b>So sánh:</b></p><ul><li>Datasheet 2N2222: β = 75–300 (typical 100)</li><li>Kết quả TN: β ≈ 100 → phù hợp</li><li>β thay đổi theo I<sub>C</sub> và nhiệt độ</li></ul>'
        ),
        contentSlide(
          'e3-s7',
          c.background,
          c.primary,
          c.text,
          'Nhận xét & Kết luận',
          '<ul style="line-height:2"><li>Đặc tuyến ngõ ra: vùng active gần như nằm ngang → BJT hoạt động như nguồn dòng</li><li>β có giá trị khá ổn định trong vùng active</li><li>Sai số do: DMM accuracy, nhiệt độ, ESR mạch</li><li>BJT 2N2222 phù hợp cho mạch khuếch đại tín hiệu nhỏ</li></ul>'
        ),
        qnaSlide('e3-s8', c.background, c.primary, c.text),
      ]
    )
  )

  // 4.4 Seminar — Analog vs Digital
  templates.push(
    templateObj(
      'elec-seminar-adc',
      'electronics',
      'Seminar — Analog vs Digital Signal Processing',
      'Template seminar so sánh xử lý tín hiệu analog và digital. 7 slides.',
      ['adc', 'dac', 'sampling', 'signal-processing', 'seminar'],
      'intermediate',
      '120deg',
      c,
      [
        seminarTitleSlide(
          'e4-s1',
          c.background,
          c.primary,
          c.text,
          'Analog vs Digital Signal Processing',
          'Từ thế giới liên tục đến thế giới rời rạc'
        ),
        contentSlide(
          'e4-s2',
          c.background,
          c.primary,
          c.text,
          'Tín hiệu Analog vs Digital',
          '<p><b>Analog:</b> Liên tục theo thời gian và biên độ</p><p>• Ví dụ: âm thanh, nhiệt độ, áp suất</p><p><b>Digital:</b> Rời rạc theo thời gian, lượng tử hoá biên độ</p><p>• Ví dụ: audio CD (44.1kHz, 16-bit), ảnh JPEG</p><p><b>Tại sao Digital?</b></p><ul><li>Chống nhiễu tốt hơn</li><li>Lưu trữ, truyền, sao chép không mất chất lượng</li><li>Linh hoạt: thay đổi thuật toán bằng phần mềm</li></ul>'
        ),
        contentSlide(
          'e4-s3',
          c.background,
          c.primary,
          c.text,
          'Định lý lấy mẫu Nyquist–Shannon',
          '<p style="text-align:center; font-size:24px; margin:20px 0">$$f_s \\geq 2 f_{max}$$</p><p><b>Giải thích:</b></p><ul><li>f<sub>s</sub>: tần số lấy mẫu</li><li>f<sub>max</sub>: tần số cao nhất của tín hiệu</li><li>Vi phạm → aliasing (chồng phổ)</li></ul><p><b>Ví dụ:</b> Audio CD: f<sub>max</sub> = 20kHz → f<sub>s</sub> = 44.1kHz > 40kHz ✓</p>'
        ),
        contentSlide(
          'e4-s4',
          c.background,
          c.primary,
          c.text,
          'Bộ chuyển đổi ADC',
          '<p><b>Các kiến trúc phổ biến:</b></p><table style="width:100%; border-collapse:collapse; font-size:17px"><tr style="border-bottom:2px solid #ffd700"><th style="padding:6px; text-align:left">Loại</th><th>Tốc độ</th><th>Độ phân giải</th><th>Ứng dụng</th></tr><tr style="border-bottom:1px solid #ffd70030"><td style="padding:6px">Flash</td><td>Rất nhanh</td><td>6-8 bit</td><td>Video, oscilloscope</td></tr><tr style="border-bottom:1px solid #ffd70030"><td style="padding:6px">SAR</td><td>Nhanh</td><td>12-18 bit</td><td>MCU, đa năng</td></tr><tr style="border-bottom:1px solid #ffd70030"><td style="padding:6px">Sigma-Delta</td><td>Chậm</td><td>24 bit</td><td>Audio, đo lường</td></tr><tr><td style="padding:6px">Pipeline</td><td>Nhanh</td><td>12-16 bit</td><td>Communication</td></tr></table>'
        ),
        contentSlide(
          'e4-s5',
          c.background,
          c.primary,
          c.text,
          'Anti-aliasing Filter',
          '<p><b>Mục đích:</b> Loại bỏ tần số > f<sub>s</sub>/2 trước khi lấy mẫu</p><p>• Active LPF bậc 4-8 (Butterworth/Bessel)</p><p>• f<sub>c</sub> = 0.45 × f<sub>s</sub> (thực tế)</p><p><b>Quá trình xử lý:</b></p><ol><li>Tín hiệu analog → Anti-aliasing filter</li><li>→ Sample & Hold</li><li>→ ADC (N-bit quantization)</li><li>→ DSP (xử lý số)</li><li>→ DAC → Reconstruction filter → Analog out</li></ol>'
        ),
        contentSlide(
          'e4-s6',
          c.background,
          c.primary,
          c.text,
          'DSP — Xử lý tín hiệu số',
          '<p><b>Ưu điểm DSP:</b></p><ul><li>FIR/IIR filter: thiết kế linh hoạt, ổn định</li><li>FFT: phân tích phổ real-time</li><li>Adaptive filter: noise cancellation</li><li>Compression: MP3, AAC, OPUS</li></ul><p><b>Hardware:</b></p><ul><li>DSP chip: TMS320 (TI), SHARC (ADI)</li><li>FPGA: real-time, parallel processing</li><li>GPU: deep learning-based processing</li></ul>'
        ),
        qnaSlide('e4-s7', c.background, c.primary, c.text),
      ]
    )
  )

  // 4.5 Project — Thiết kế mạch
  templates.push(
    templateObj(
      'elec-project-circuit',
      'electronics',
      'Project Presentation — Thiết kế mạch nguồn/khuếch đại',
      'Template báo cáo đồ án thiết kế mạch điện tử. 9 slides chuẩn.',
      ['project', 'pcb', 'schematic', 'design', 'electronics'],
      'advanced',
      '160deg',
      c,
      [
        projectTitleSlide(
          'e5-s1',
          c.background,
          c.primary,
          c.text,
          'Thiết kế mạch nguồn DC điều chỉnh được'
        ),
        contentSlide(
          'e5-s2',
          c.background,
          c.primary,
          c.text,
          'Yêu cầu & Thông số kỹ thuật',
          '<ul style="line-height:2"><li><b>Đầu vào:</b> AC 220V/50Hz</li><li><b>Đầu ra:</b> DC 1.25V – 30V, max 2A</li><li><b>Ripple:</b> < 50mV</li><li><b>Bảo vệ:</b> ngắn mạch, quá dòng, quá nhiệt</li><li><b>Hiển thị:</b> LCD V/I meter</li></ul>'
        ),
        contentSlide(
          'e5-s3',
          c.background,
          c.primary,
          c.text,
          'Sơ đồ khối hệ thống',
          '<p><b>Pipeline:</b></p><p>AC 220V → Biến áp → Chỉnh lưu cầu → Lọc C → LM317 → Output</p><p><b>Các khối chính:</b></p><ol><li>Biến áp hạ áp: 220V → 24V AC</li><li>Chỉnh lưu cầu: 4×1N5408</li><li>Tụ lọc: 4700μF/50V</li><li>IC ổn áp: LM317 + transistor khuếch đại dòng</li><li>Bảo vệ: fuse + current limiter</li></ol>'
        ),
        contentSlide(
          'e5-s4',
          c.background,
          c.primary,
          c.text,
          'Schematic mạch nguyên lý',
          '<p style="text-align:center; font-style:italic; color:#ffd70080">Chèn ảnh schematic từ KiCad/Altium vào đây</p><p style="margin-top:20px"><b>Tính toán chính:</b></p><p>V<sub>out</sub> = 1.25(1 + R<sub>2</sub>/R<sub>1</sub>) + I<sub>adj</sub>·R<sub>2</sub></p><p>• R<sub>1</sub> = 240Ω (cố định), R<sub>2</sub> = 5kΩ pot</p><p>• Tản nhiệt: P<sub>d</sub> = (V<sub>in</sub>−V<sub>out</sub>)×I<sub>out</sub></p>'
        ),
        contentSlide(
          'e5-s5',
          c.background,
          c.primary,
          c.text,
          'PCB Layout',
          '<p style="text-align:center; font-style:italic; color:#ffd70080">Chèn ảnh PCB layout vào đây</p><p style="margin-top:20px"><b>Nguyên tắc layout:</b></p><ul><li>Tách riêng phần công suất và phần điều khiển</li><li>Đường mạch dòng lớn: width ≥ 2mm (1A/mm rule)</li><li>Ground plane: pour copper ở bottom layer</li><li>Tụ bypass 100nF gần IC</li></ul>'
        ),
        contentSlide(
          'e5-s6',
          c.background,
          c.primary,
          c.text,
          'BOM — Danh sách linh kiện',
          '<table style="width:100%; border-collapse:collapse; font-size:16px"><tr style="border-bottom:2px solid #ffd700"><th style="padding:6px; text-align:left">STT</th><th style="text-align:left">Linh kiện</th><th>Giá trị</th><th>SL</th></tr><tr style="border-bottom:1px solid #ffd70030"><td style="padding:6px">1</td><td>Biến áp</td><td>220/24V 3A</td><td>1</td></tr><tr style="border-bottom:1px solid #ffd70030"><td style="padding:6px">2</td><td>Diode cầu</td><td>1N5408</td><td>4</td></tr><tr style="border-bottom:1px solid #ffd70030"><td style="padding:6px">3</td><td>Tụ lọc</td><td>4700μF/50V</td><td>1</td></tr><tr style="border-bottom:1px solid #ffd70030"><td style="padding:6px">4</td><td>LM317</td><td>TO-220</td><td>1</td></tr><tr><td style="padding:6px">5</td><td>Biến trở</td><td>5kΩ</td><td>1</td></tr></table>'
        ),
        contentSlide(
          'e5-s7',
          c.background,
          c.primary,
          c.text,
          'Kết quả đo kiểm',
          '<p><b>Kết quả thực tế:</b></p><ul style="line-height:2"><li>V<sub>out</sub> range: 1.3V – 29.5V ✓</li><li>I<sub>max</sub>: 1.95A ✓</li><li>Ripple @1A, 12V: 35mV < 50mV ✓</li><li>Hiệu suất @12V/1A: η = 12/(24×1.2) ≈ 42%</li><li>Bảo vệ quá dòng: ngắt @2.2A ✓</li></ul>'
        ),
        contentSlide(
          'e5-s8',
          c.background,
          c.primary,
          c.text,
          'Cải tiến & Phát triển',
          '<ul style="line-height:2"><li><b>Hiệu suất:</b> Chuyển sang buck converter (LM2596) → η > 85%</li><li><b>Giao tiếp:</b> Thêm MCU + encoder để chỉnh áp chính xác</li><li><b>Display:</b> OLED hiển thị V, I, P, T</li><li><b>Kết nối:</b> USB-C PD output</li></ul>'
        ),
        qnaSlide('e5-s9', c.background, c.primary, c.text),
      ]
    )
  )

  return templates
}

function genAutomationTemplates() {
  const c = AUTO
  const templates = []

  // 5.1 Tổng quan — Điều khiển tự động
  templates.push(
    templateObj(
      'auto-lecture-overview',
      'automation',
      'Bài giảng tổng quan — Hệ thống điều khiển tự động',
      'Template bài giảng về điều khiển: hàm truyền, ổn định, PID, PLC. 10 slides.',
      ['control', 'pid', 'transfer-function', 'plc', 'lecture'],
      'intermediate',
      '135deg',
      c,
      [
        titleSlide(
          'a1-s1',
          c.background,
          c.primary,
          c.text,
          'Cơ sở Điều khiển Tự động',
          'Giảng viên: ... · Lớp: ... · Ngày: ...'
        ),
        outlineSlide('a1-s2', c.background, c.primary, c.text, [
          'Hệ thống vòng hở & vòng kín',
          'Hàm truyền',
          'Sơ đồ khối',
          'Ổn định Routh-Hurwitz',
          'Bộ điều khiển PID',
          'PLC cơ bản',
        ]),
        twoColSlide(
          'a1-s3',
          c.background,
          c.primary,
          c.text,
          'Vòng hở vs Vòng kín',
          '<p><b>Vòng hở (Open-loop):</b></p><ul><li>Không phản hồi</li><li>Đơn giản, rẻ</li><li>Không tự hiệu chỉnh</li><li>VD: lò vi sóng timer</li></ul>',
          '<p><b>Vòng kín (Closed-loop):</b></p><ul><li>Có phản hồi</li><li>Tự hiệu chỉnh sai số</li><li>Phức tạp hơn</li><li>VD: điều hoà nhiệt độ</li></ul>'
        ),
        contentSlide(
          'a1-s4',
          c.background,
          c.primary,
          c.text,
          'Hàm truyền',
          '<p><b>Định nghĩa:</b> Tỷ số Laplace ngõ ra / ngõ vào</p><p style="text-align:center; font-size:24px; margin:20px 0">$$G(s) = \\frac{Y(s)}{X(s)} = \\frac{K}{s^2 + 2\\zeta\\omega_n s + \\omega_n^2}$$</p><p><b>Hệ bậc 2:</b></p><ul><li>ζ < 1: dao động tắt dần (underdamped)</li><li>ζ = 1: tới hạn (critically damped)</li><li>ζ > 1: quá tắt dần (overdamped)</li></ul>'
        ),
        contentSlide(
          'a1-s5',
          c.background,
          c.primary,
          c.text,
          'Sơ đồ khối — Quy tắc nối',
          '<p><b>Nối tiếp:</b> G = G<sub>1</sub> · G<sub>2</sub></p><p><b>Song song:</b> G = G<sub>1</sub> + G<sub>2</sub></p><p><b>Phản hồi âm:</b></p><p style="text-align:center; font-size:24px; margin:15px 0">$$G_{cl} = \\frac{G}{1 + G \\cdot H}$$</p><p><b>Mason\'s gain formula:</b> cho sơ đồ phức tạp</p>'
        ),
        contentSlide(
          'a1-s6',
          c.background,
          c.primary,
          c.text,
          'Ổn định — Routh-Hurwitz',
          '<p><b>Điều kiện cần:</b> Tất cả hệ số đa thức đặc trưng > 0</p><p><b>Bảng Routh:</b></p><table style="width:80%; border-collapse:collapse; font-size:17px; margin:10px auto"><tr style="border-bottom:2px solid #ff4757"><th style="padding:6px">Hàng</th><th>Cột 1</th><th>Cột 2</th><th>Cột 3</th></tr><tr style="border-bottom:1px solid #ff475730"><td style="padding:6px">s<sup>n</sup></td><td>a<sub>n</sub></td><td>a<sub>n-2</sub></td><td>a<sub>n-4</sub></td></tr><tr style="border-bottom:1px solid #ff475730"><td style="padding:6px">s<sup>n-1</sup></td><td>a<sub>n-1</sub></td><td>a<sub>n-3</sub></td><td>a<sub>n-5</sub></td></tr><tr><td style="padding:6px">s<sup>n-2</sup></td><td>b<sub>1</sub></td><td>b<sub>2</sub></td><td>...</td></tr></table><p>Hệ ổn định ⟺ cột 1 không đổi dấu</p>'
        ),
        contentSlide(
          'a1-s7',
          c.background,
          c.primary,
          c.text,
          'Bộ điều khiển PID',
          '<p><b>Luật PID:</b></p><p style="text-align:center; font-size:22px; margin:15px 0">$$u(t) = K_p e(t) + K_i \\int_0^t e(\\tau)d\\tau + K_d \\frac{de(t)}{dt}$$</p><ul><li><b>P (Proportional):</b> Giảm sai số xác lập, tăng → oscillation</li><li><b>I (Integral):</b> Triệt tiêu sai số xác lập, tăng → overshoot</li><li><b>D (Derivative):</b> Giảm overshoot, dự đoán xu hướng</li></ul>'
        ),
        contentSlide(
          'a1-s8',
          c.background,
          c.primary,
          c.text,
          'PLC — Programmable Logic Controller',
          '<p><b>Kiến trúc:</b> CPU + I/O modules + Power supply + Communication</p><p><b>Ngôn ngữ lập trình IEC 61131-3:</b></p><ul><li>Ladder Diagram (LD) — phổ biến nhất</li><li>Function Block Diagram (FBD)</li><li>Structured Text (ST)</li><li>Instruction List (IL)</li><li>Sequential Function Chart (SFC)</li></ul><p><b>Hãng:</b> Siemens S7, Allen-Bradley, Mitsubishi, Omron</p>'
        ),
        tableSlide(
          'a1-s9',
          c.background,
          c.primary,
          c.text,
          'So sánh bộ điều khiển P, PI, PD, PID',
          '<table style="width:100%; border-collapse:collapse"><tr style="border-bottom:2px solid #ff4757"><th style="padding:8px; text-align:left">Thông số</th><th style="padding:8px">P</th><th style="padding:8px">PI</th><th style="padding:8px">PD</th><th style="padding:8px">PID</th></tr><tr style="border-bottom:1px solid #ff475730"><td style="padding:8px">Rise time</td><td style="padding:8px; text-align:center">Giảm</td><td style="padding:8px; text-align:center">Giảm</td><td style="padding:8px; text-align:center">Ít thay đổi</td><td style="padding:8px; text-align:center">Giảm</td></tr><tr style="border-bottom:1px solid #ff475730"><td style="padding:8px">Overshoot</td><td style="padding:8px; text-align:center">Tăng</td><td style="padding:8px; text-align:center">Tăng</td><td style="padding:8px; text-align:center">Giảm</td><td style="padding:8px; text-align:center">Giảm</td></tr><tr style="border-bottom:1px solid #ff475730"><td style="padding:8px">Settling</td><td style="padding:8px; text-align:center">Ít thay đổi</td><td style="padding:8px; text-align:center">Tăng</td><td style="padding:8px; text-align:center">Giảm</td><td style="padding:8px; text-align:center">Giảm</td></tr><tr><td style="padding:8px">SS error</td><td style="padding:8px; text-align:center">Giảm, ≠ 0</td><td style="padding:8px; text-align:center">= 0</td><td style="padding:8px; text-align:center">Ít thay đổi</td><td style="padding:8px; text-align:center">= 0</td></tr></table>'
        ),
        qnaSlide('a1-s10', c.background, c.primary, c.text),
      ]
    )
  )

  // 5.2 Chi tiết — PID
  templates.push(
    templateObj(
      'auto-lecture-pid',
      'automation',
      'Bài giảng chi tiết — Thiết kế bộ điều khiển PID',
      'Template bài giảng chi tiết PID tuning: Ziegler-Nichols, Root Locus, Bode. 12 slides.',
      ['pid', 'tuning', 'ziegler-nichols', 'root-locus', 'bode', 'lecture'],
      'advanced',
      '150deg',
      c,
      [
        titleSlide(
          'a2-s1',
          c.background,
          c.primary,
          c.text,
          'Thiết kế bộ điều khiển PID',
          'Phương pháp chỉnh định & Bù tần số'
        ),
        outlineSlide('a2-s2', c.background, c.primary, c.text, [
          'PID trong miền s',
          'Ziegler-Nichols',
          'Root Locus',
          'Biểu đồ Bode',
          'Bù lead-lag',
          'Simulink demo',
        ]),
        contentSlide(
          'a2-s3',
          c.background,
          c.primary,
          c.text,
          'PID trong miền Laplace',
          '<p><b>Hàm truyền PID:</b></p><p style="text-align:center; font-size:24px; margin:15px 0">$$C(s) = K_p + \\frac{K_i}{s} + K_d s = K_p\\left(1 + \\frac{1}{T_i s} + T_d s\\right)$$</p><p>T<sub>i</sub> = K<sub>p</sub>/K<sub>i</sub> (thời gian tích phân)</p><p>T<sub>d</sub> = K<sub>d</sub>/K<sub>p</sub> (thời gian vi phân)</p><p><b>PID thực tế:</b> Thêm filter cho D: $$C(s) = K_p + \\frac{K_i}{s} + \\frac{K_d s}{1 + \\frac{s}{N}}$$</p>'
        ),
        twoColSlide(
          'a2-s4',
          c.background,
          c.primary,
          c.text,
          'Ziegler-Nichols — Phương pháp 1',
          '<p><b>Step Response Method:</b></p><ol><li>Cho hệ hở chạy step</li><li>Đo delay L và time constant T</li><li>Tra bảng ZN</li></ol>',
          '<table style="border-collapse:collapse; font-size:16px"><tr style="border-bottom:2px solid #ff4757"><th style="padding:6px">Bộ ĐK</th><th>K<sub>p</sub></th><th>T<sub>i</sub></th><th>T<sub>d</sub></th></tr><tr style="border-bottom:1px solid #ff475730"><td style="padding:6px">P</td><td>T/L</td><td>∞</td><td>0</td></tr><tr style="border-bottom:1px solid #ff475730"><td style="padding:6px">PI</td><td>0.9T/L</td><td>L/0.3</td><td>0</td></tr><tr><td style="padding:6px">PID</td><td>1.2T/L</td><td>2L</td><td>0.5L</td></tr></table>'
        ),
        contentSlide(
          'a2-s5',
          c.background,
          c.primary,
          c.text,
          'Ziegler-Nichols — Phương pháp 2',
          '<p><b>Ultimate Gain Method:</b></p><ol style="line-height:2"><li>Đặt K<sub>i</sub> = 0, K<sub>d</sub> = 0</li><li>Tăng K<sub>p</sub> cho đến khi hệ dao động đều → K<sub>u</sub></li><li>Đo chu kỳ dao động → P<sub>u</sub></li><li>Tính: K<sub>p</sub> = 0.6K<sub>u</sub>, T<sub>i</sub> = P<sub>u</sub>/2, T<sub>d</sub> = P<sub>u</sub>/8</li></ol><p><b>Nhược điểm:</b> Cần đưa hệ tới bờ mất ổn định → nguy hiểm trong thực tế</p>'
        ),
        contentSlide(
          'a2-s6',
          c.background,
          c.primary,
          c.text,
          'Root Locus — Quỹ tích nghiệm',
          '<p><b>Mục đích:</b> Vẽ vị trí cực vòng kín khi K thay đổi 0 → ∞</p><p><b>Quy tắc vẽ:</b></p><ol><li>Số nhánh = bậc hệ</li><li>Bắt đầu từ cực hở, kết thúc tại zero hở hoặc ∞</li><li>Trên trục thực: bên phải có lẻ (cực + zero)</li><li>Tiệm cận: σ<sub>a</sub> = (Σcực − Σzero)/(n−m)</li></ol><p><b>Thiết kế:</b> Chọn K sao cho cực vòng kín nằm trong vùng mong muốn (ζ, ω<sub>n</sub>)</p>'
        ),
        contentSlide(
          'a2-s7',
          c.background,
          c.primary,
          c.text,
          'Biểu đồ Bode',
          '<p><b>Bode plot:</b> Magnitude (dB) và Phase (°) theo log(ω)</p><p><b>Các chỉ tiêu:</b></p><ul><li><b>Gain margin (GM):</b> |G| tại pha = −180° → GM > 6dB</li><li><b>Phase margin (PM):</b> pha tại |G| = 0dB → PM > 30°</li><li><b>Bandwidth:</b> ω tại |G| giảm −3dB</li></ul><p>$$GM = -20\\log|G(j\\omega_{pc})| \\text{ (dB)}$$</p>'
        ),
        contentSlide(
          'a2-s8',
          c.background,
          c.primary,
          c.text,
          'Bù Lead-Lag',
          '<p><b>Lead compensator:</b> Tăng phase margin</p><p style="text-align:center">$$C(s) = K \\frac{s + z}{s + p}$$ với p > z</p><p><b>Lag compensator:</b> Giảm sai số xác lập</p><p style="text-align:center">$$C(s) = K \\frac{s + z}{s + p}$$ với z > p</p><p><b>Lead-Lag:</b> Kết hợp cả hai ưu điểm</p>'
        ),
        contentSlide(
          'a2-s9',
          c.background,
          c.primary,
          c.text,
          'Anti-windup & Bumpless Transfer',
          '<p><b>Windup problem:</b></p><p>Khi actuator bão hoà, I tích luỹ → overshoot lớn khi thoát bão hoà</p><p><b>Giải pháp Anti-windup:</b></p><ul><li>Clamping: dừng tích phân khi output bão hoà</li><li>Back-calculation: trừ ngược sai số bão hoà</li></ul><p><b>Bumpless transfer:</b></p><p>Chuyển Manual → Auto mà không giật output</p>'
        ),
        contentSlide(
          'a2-s10',
          c.background,
          c.primary,
          c.text,
          'MATLAB/Simulink Demo',
          '<p><b>Ví dụ trong MATLAB:</b></p><pre style="background:#1a0a0e; border:1px solid #ff475730; padding:12px; border-radius:4px; font-size:15px; color:#ffd5d0">G = tf([1], [1 2 1]);\nC = pid(10, 5, 2);\nT = feedback(C*G, 1);\nstep(T)\nmargin(C*G)</pre><p style="margin-top:10px"><b>Simulink:</b> Kéo thả block PID Controller, Plant, Scope</p>'
        ),
        summarySlide('a2-s11', c.background, c.primary, c.text, [
          'PID: 3 thành phần P, I, D điều chỉnh đáp ứng',
          'Ziegler-Nichols: chỉnh định nhanh dựa trên thực nghiệm',
          'Root Locus: thiết kế K dựa trên vị trí cực',
          'Bode: xác định GM, PM để đảm bảo ổn định',
          'Lead-Lag: bù tần số nâng cao chất lượng',
          'Anti-windup: xử lý bão hoà actuator',
        ]),
        qnaSlide('a2-s12', c.background, c.primary, c.text),
      ]
    )
  )

  // 5.3 Lab Report — PID
  templates.push(
    templateObj(
      'auto-lab-pid',
      'automation',
      'Lab Report — TN bộ điều khiển PID',
      'Template báo cáo thí nghiệm PID: step response, tuning. 8 slides.',
      ['pid', 'lab', 'experiment', 'step-response', 'automation'],
      'beginner',
      '180deg',
      c,
      [
        labTitleSlide('a3-s1', c.background, c.primary, c.text, 'Thí nghiệm bộ điều khiển PID'),
        contentSlide(
          'a3-s2',
          c.background,
          c.primary,
          c.text,
          'Mục đích thí nghiệm',
          '<ul style="font-size:20px; line-height:2"><li>Khảo sát ảnh hưởng của K<sub>p</sub>, K<sub>i</sub>, K<sub>d</sub> lên đáp ứng hệ thống</li><li>Áp dụng phương pháp Ziegler-Nichols để chỉnh định PID</li><li>Đo các chỉ tiêu: overshoot, settling time, steady-state error</li><li>So sánh P, PI, PID</li></ul>'
        ),
        contentSlide(
          'a3-s3',
          c.background,
          c.primary,
          c.text,
          'Thiết bị & Sơ đồ thí nghiệm',
          '<p><b>Đối tượng:</b> Motor DC + encoder (điều khiển tốc độ)</p><p><b>Bộ điều khiển:</b> Arduino + H-bridge driver</p><p><b>Sơ đồ:</b></p><p>Setpoint → PID (Arduino) → PWM → H-bridge → Motor → Encoder → Feedback</p><p><b>Phần mềm:</b> Arduino IDE + Serial Plotter</p>'
        ),
        contentSlide(
          'a3-s4',
          c.background,
          c.primary,
          c.text,
          'Bảng số liệu — Ảnh hưởng K<sub>p</sub>',
          '<table style="width:100%; border-collapse:collapse; font-size:17px"><tr style="border-bottom:2px solid #ff4757"><th style="padding:6px">K<sub>p</sub></th><th>Overshoot (%)</th><th>Rise time (s)</th><th>Settling (s)</th><th>SS error</th></tr><tr style="border-bottom:1px solid #ff475730"><td style="padding:6px; text-align:center">1</td><td style="text-align:center">0</td><td style="text-align:center">2.5</td><td style="text-align:center">3.0</td><td style="text-align:center">15%</td></tr><tr style="border-bottom:1px solid #ff475730"><td style="padding:6px; text-align:center">5</td><td style="text-align:center">10</td><td style="text-align:center">0.8</td><td style="text-align:center">2.0</td><td style="text-align:center">5%</td></tr><tr style="border-bottom:1px solid #ff475730"><td style="padding:6px; text-align:center">10</td><td style="text-align:center">25</td><td style="text-align:center">0.4</td><td style="text-align:center">3.5</td><td style="text-align:center">2%</td></tr><tr><td style="padding:6px; text-align:center">20</td><td style="text-align:center">50</td><td style="text-align:center">0.2</td><td style="text-align:center">5.0</td><td style="text-align:center">1%</td></tr></table>'
        ),
        contentSlide(
          'a3-s5',
          c.background,
          c.primary,
          c.text,
          'Đồ thị Step Response',
          '<p>Chèn đồ thị step response cho các trường hợp:</p><ol style="line-height:2"><li>Chỉ P: K<sub>p</sub> = 5 → nhanh nhưng có SS error</li><li>PI: K<sub>p</sub> = 5, K<sub>i</sub> = 2 → triệt tiêu SS error, overshoot tăng</li><li>PID (ZN): K<sub>p</sub> = 6, K<sub>i</sub> = 3, K<sub>d</sub> = 0.75 → cân bằng tốt</li></ol><p style="margin-top:15px; font-style:italic; color:#ff475780">Chèn screenshot Serial Plotter vào đây</p>'
        ),
        contentSlide(
          'a3-s6',
          c.background,
          c.primary,
          c.text,
          'Phân tích kết quả',
          '<p><b>So sánh hiệu quả:</b></p><ul style="line-height:2"><li><b>P alone:</b> Nhanh nhưng không triệt tiêu SS error</li><li><b>PI:</b> SS error = 0 nhưng overshoot ≈ 20%</li><li><b>PID (ZN):</b> OS ≈ 8%, settling < 1.5s, SS = 0 ✓</li></ul><p><b>Nhận xét:</b> Ziegler-Nichols cho kết quả ban đầu tốt, nhưng cần fine-tuning cho ứng dụng cụ thể</p>'
        ),
        contentSlide(
          'a3-s7',
          c.background,
          c.primary,
          c.text,
          'Kết luận & Kiến nghị',
          '<ul style="line-height:2"><li>PID controller cải thiện đáng kể so với P/PI</li><li>ZN method: phù hợp cho chỉnh định ban đầu</li><li>Cần anti-windup khi motor bão hoà</li><li><b>Cải tiến:</b> thêm filter cho D, auto-tuning algorithm</li></ul>'
        ),
        qnaSlide('a3-s8', c.background, c.primary, c.text),
      ]
    )
  )

  // 5.4 Seminar — SCADA
  templates.push(
    templateObj(
      'auto-seminar-scada',
      'automation',
      'Seminar — SCADA và Industry 4.0',
      'Template seminar về SCADA, HMI, IIoT, Digital Twin. 7 slides.',
      ['scada', 'industry4', 'iiot', 'hmi', 'seminar'],
      'intermediate',
      '120deg',
      c,
      [
        seminarTitleSlide(
          'a4-s1',
          c.background,
          c.primary,
          c.text,
          'SCADA & Industry 4.0',
          'Từ giám sát truyền thống đến nhà máy thông minh'
        ),
        contentSlide(
          'a4-s2',
          c.background,
          c.primary,
          c.text,
          'SCADA là gì?',
          '<p><b>Supervisory Control And Data Acquisition</b></p><p><b>Thành phần:</b></p><ul><li><b>RTU/PLC:</b> Thu thập dữ liệu từ sensor</li><li><b>Communication:</b> Modbus, Profinet, OPC-UA</li><li><b>MTU:</b> Server trung tâm xử lý dữ liệu</li><li><b>HMI:</b> Giao diện người-máy hiển thị</li></ul><p><b>Ứng dụng:</b> Nhà máy điện, xử lý nước, dầu khí, sản xuất</p>'
        ),
        contentSlide(
          'a4-s3',
          c.background,
          c.primary,
          c.text,
          'HMI — Human Machine Interface',
          '<p><b>Thiết kế HMI hiện đại:</b></p><ul><li>High-performance HMI: ít animation, nhiều data</li><li>ISA-101 standard: màu sắc, alarm management</li><li>Responsive layout: PC, tablet, mobile</li></ul><p><b>Phần mềm:</b> WinCC (Siemens), FactoryTalk View (AB), Ignition (Inductive)</p>'
        ),
        twoColSlide(
          'a4-s4',
          c.background,
          c.primary,
          c.text,
          'Industry 3.0 → 4.0',
          '<p><b>Industry 3.0:</b></p><ul><li>PLC + SCADA</li><li>Automation cố định</li><li>Mạng nội bộ</li><li>Reactive maintenance</li></ul>',
          '<p><b>Industry 4.0:</b></p><ul><li>IIoT + Edge computing</li><li>Flexible manufacturing</li><li>Cloud + AI analytics</li><li>Predictive maintenance</li></ul>'
        ),
        contentSlide(
          'a4-s5',
          c.background,
          c.primary,
          c.text,
          'IIoT & OPC-UA',
          '<p><b>Industrial IoT:</b></p><ul><li>Sensor → Edge gateway → Cloud platform</li><li>Protocol: MQTT, AMQP, OPC-UA</li></ul><p><b>OPC-UA (Unified Architecture):</b></p><ul><li>Platform-independent, secure, scalable</li><li>Thay thế OPC Classic (COM/DCOM)</li><li>Chuẩn giao tiếp Industry 4.0</li></ul>'
        ),
        contentSlide(
          'a4-s6',
          c.background,
          c.primary,
          c.text,
          'Digital Twin',
          '<p><b>Bản sao số:</b> Mô hình ảo real-time của hệ thống vật lý</p><p><b>3 level:</b></p><ol><li><b>Digital Model:</b> Mô phỏng offline</li><li><b>Digital Shadow:</b> Cập nhật 1 chiều (physical → digital)</li><li><b>Digital Twin:</b> 2 chiều (bidirectional sync)</li></ol><p><b>Ứng dụng:</b> Tối ưu vận hành, dự đoán lỗi, training operator</p><p><b>Platform:</b> Siemens MindSphere, Azure Digital Twins, AWS IoT TwinMaker</p>'
        ),
        qnaSlide('a4-s7', c.background, c.primary, c.text),
      ]
    )
  )

  // 5.5 Project — Hệ thống ĐK
  templates.push(
    templateObj(
      'auto-project-control',
      'automation',
      'Project — Đồ án hệ thống điều khiển',
      'Template báo cáo đồ án hệ thống điều khiển. 9 slides.',
      ['project', 'control-system', 'matlab', 'simulink', 'automation'],
      'advanced',
      '160deg',
      c,
      [
        projectTitleSlide(
          'a5-s1',
          c.background,
          c.primary,
          c.text,
          'Thiết kế hệ thống điều khiển nhiệt độ lò nung'
        ),
        contentSlide(
          'a5-s2',
          c.background,
          c.primary,
          c.text,
          'Đặt vấn đề & Yêu cầu',
          '<ul style="line-height:2"><li><b>Đối tượng:</b> Lò nung công nghiệp (0–500°C)</li><li><b>Yêu cầu:</b> Sai số ≤ ±2°C, settling < 30s</li><li><b>Sensor:</b> Thermocouple K-type + MAX31855</li><li><b>Actuator:</b> SSR + heater 2kW</li><li><b>Controller:</b> Arduino Mega / PLC S7-1200</li></ul>'
        ),
        contentSlide(
          'a5-s3',
          c.background,
          c.primary,
          c.text,
          'Mô hình đối tượng',
          '<p><b>Phương trình nhiệt:</b></p><p style="text-align:center; font-size:22px">$$m c_p \\frac{dT}{dt} = P_{heater} - hA(T - T_{amb})$$</p><p><b>Hàm truyền (xấp xỉ bậc 1 có trễ):</b></p><p style="text-align:center; font-size:22px">$$G(s) = \\frac{K e^{-Ls}}{Ts + 1}$$</p><p>Thực nghiệm: K = 50°C/kW, T = 120s, L = 15s</p>'
        ),
        contentSlide(
          'a5-s4',
          c.background,
          c.primary,
          c.text,
          'Thiết kế bộ điều khiển',
          '<p><b>Bước 1:</b> Ziegler-Nichols → K<sub>p</sub>=9.6, T<sub>i</sub>=30, T<sub>d</sub>=7.5</p><p><b>Bước 2:</b> Fine-tuning bằng Root Locus</p><p><b>Bước 3:</b> Thêm Anti-windup (clamping)</p><p><b>Kết quả simulation (MATLAB):</b></p><ul><li>Overshoot: 5.2%</li><li>Settling time: 25s</li><li>SS error: 0</li></ul>'
        ),
        contentSlide(
          'a5-s5',
          c.background,
          c.primary,
          c.text,
          'Sơ đồ phần cứng',
          '<p style="text-align:center; font-style:italic; color:#ff475780">Chèn sơ đồ đấu nối phần cứng vào đây</p><p style="margin-top:15px"><b>Kết nối:</b></p><ul><li>Thermocouple K → MAX31855 → SPI → Arduino</li><li>Arduino PWM → opto-isolator → SSR-40DA → Heater</li><li>LCD 20×4: hiển thị T<sub>set</sub>, T<sub>actual</sub>, mode</li><li>Buzzer: alarm khi T > T<sub>max</sub></li></ul>'
        ),
        contentSlide(
          'a5-s6',
          c.background,
          c.primary,
          c.text,
          'Lưu đồ chương trình',
          '<p><b>Main loop (100ms cycle):</b></p><ol style="line-height:1.8"><li>Đọc nhiệt độ (MAX31855 SPI)</li><li>Tính sai số: e = T<sub>set</sub> − T<sub>actual</sub></li><li>PID compute: u = P + I + D</li><li>Anti-windup check</li><li>Output PWM (0–100%)</li><li>Update LCD, check alarm</li><li>Serial log (for plotting)</li></ol>'
        ),
        contentSlide(
          'a5-s7',
          c.background,
          c.primary,
          c.text,
          'Kết quả thực nghiệm',
          '<p><b>Test setpoint tracking (200°C → 300°C → 200°C):</b></p><ul style="line-height:2"><li>Rise time: 22s (within spec ✓)</li><li>Overshoot: 4.8% (≈ 14.4°C) ✓</li><li>Settling: 28s ✓</li><li>SS error: < 1°C ✓</li></ul><p style="margin-top:10px; font-style:italic; color:#ff475780">Chèn đồ thị step response thực tế vào đây</p>'
        ),
        contentSlide(
          'a5-s8',
          c.background,
          c.primary,
          c.text,
          'Kết luận & Hướng phát triển',
          '<ul style="line-height:2"><li>Hệ thống đạt yêu cầu kỹ thuật đề ra</li><li>PID + Anti-windup hoạt động ổn định</li><li><b>Hạn chế:</b> Chưa có feed-forward, model-based control</li><li><b>Phát triển:</b></li><ul><li>Nâng cấp lên PLC S7-1200 + HMI</li><li>Thêm profile tracking (ramp heating)</li><li>IoT: MQTT → cloud dashboard</li></ul></ul>'
        ),
        qnaSlide('a5-s9', c.background, c.primary, c.text),
      ]
    )
  )

  return templates
}

function genElectricalTemplates() {
  const c = POWER
  const templates = []

  // 6.1 Tổng quan — Máy điện
  templates.push(
    templateObj(
      'electrical-lecture-overview',
      'electrical',
      'Bài giảng tổng quan — Máy điện & Hệ thống điện',
      'Template bài giảng về MBA, động cơ, hệ thống 3 pha, bảo vệ rơle. 10 slides.',
      ['transformer', 'motor', '3-phase', 'relay', 'lecture'],
      'intermediate',
      '135deg',
      c,
      [
        titleSlide(
          'p1-s1',
          c.background,
          c.primary,
          c.text,
          'Máy điện và Hệ thống cung cấp điện',
          'Giảng viên: ... · Lớp: ... · Ngày: ...'
        ),
        outlineSlide('p1-s2', c.background, c.primary, c.text, [
          'Máy biến áp',
          'Động cơ không đồng bộ',
          'Động cơ đồng bộ',
          'Hệ thống 3 pha',
          'Cung cấp điện',
          'Bảo vệ rơle',
        ]),
        contentSlide(
          'p1-s3',
          c.background,
          c.primary,
          c.text,
          'Máy biến áp (Transformer)',
          '<p><b>Nguyên lý:</b> Cảm ứng điện từ Faraday</p><p style="text-align:center; font-size:24px; margin:15px 0">$$\\frac{V_1}{V_2} = \\frac{N_1}{N_2} = a$$</p><p><b>Sơ đồ tương đương:</b></p><ul><li>R<sub>1</sub>, X<sub>1</sub>: tổn hao + điện kháng sơ cấp</li><li>R<sub>c</sub>, X<sub>m</sub>: nhánh từ hoá</li><li>R<sub>2</sub>\', X<sub>2</sub>\': quy đổi thứ cấp về sơ cấp</li></ul><p><b>Hiệu suất:</b> η = P<sub>2</sub>/(P<sub>2</sub> + P<sub>Fe</sub> + P<sub>Cu</sub>)</p>'
        ),
        contentSlide(
          'p1-s4',
          c.background,
          c.primary,
          c.text,
          'Động cơ không đồng bộ',
          '<p><b>Cấu tạo:</b> Stator (cuộn dây 3 pha) + Rotor (lồng sóc/dây quấn)</p><p><b>Tốc độ đồng bộ:</b></p><p style="text-align:center; font-size:22px">$$n_s = \\frac{120f}{p}$$ (rpm)</p><p><b>Độ trượt:</b></p><p style="text-align:center; font-size:22px">$$s = \\frac{n_s - n_r}{n_s}$$</p><p>• Không tải: s ≈ 0.02–0.05</p><p>• Đầy tải: s ≈ 0.03–0.08</p>'
        ),
        contentSlide(
          'p1-s5',
          c.background,
          c.primary,
          c.text,
          'Động cơ đồng bộ',
          '<p><b>Đặc điểm:</b> Rotor quay đúng tốc độ đồng bộ n<sub>s</sub></p><p><b>V-curve:</b> I<sub>a</sub> theo I<sub>f</sub></p><ul><li>Under-excitation → lagging PF (hấp thụ Q)</li><li>Over-excitation → leading PF (phát Q)</li></ul><p><b>Ứng dụng:</b></p><ul><li>Synchronous condenser: bù công suất phản kháng</li><li>Máy phát điện: nhà máy điện</li></ul>'
        ),
        contentSlide(
          'p1-s6',
          c.background,
          c.primary,
          c.text,
          'Hệ thống 3 pha',
          '<p><b>Đấu nối:</b></p><p><b>Sao (Y):</b> $$V_{dây} = \\sqrt{3} V_{pha}$$, $$I_{dây} = I_{pha}$$</p><p><b>Tam giác (Δ):</b> $$V_{dây} = V_{pha}$$, $$I_{dây} = \\sqrt{3} I_{pha}$$</p><p><b>Công suất 3 pha:</b></p><p style="text-align:center; font-size:22px">$$P = \\sqrt{3} V_d I_d \\cos\\varphi$$</p>'
        ),
        contentSlide(
          'p1-s7',
          c.background,
          c.primary,
          c.text,
          'Sơ đồ cung cấp điện',
          '<p><b>Cấu trúc:</b></p><p>Nhà máy điện → Trạm 220kV → Trạm 110kV → Trạm 22kV → Hạ thế 0.4kV</p><p><b>Tiêu chí thiết kế:</b></p><ul><li>Độ tin cậy: N-1 criterion</li><li>Sụt áp: ΔU ≤ 5%</li><li>Tổn hao: ΔP minimize</li><li>Chi phí: tối ưu kinh tế-kỹ thuật</li></ul>'
        ),
        contentSlide(
          'p1-s8',
          c.background,
          c.primary,
          c.text,
          'Bảo vệ Rơle',
          '<p><b>Rơle quá dòng (50/51):</b></p><ul><li>Instantaneous (50): cắt nhanh khi I > I<sub>set</sub></li><li>Time-delay (51): cắt sau thời gian trễ, đặc tuyến phụ thuộc</li></ul><p><b>Rơle khoảng cách (21):</b></p><ul><li>Đo tổng trở Z = V/I</li><li>3 vùng bảo vệ: Zone 1 (80%), Zone 2 (120%), Zone 3 (200%)</li></ul>'
        ),
        summarySlide('p1-s9', c.background, c.primary, c.text, [
          'MBA: biến đổi điện áp, tỷ số vòng dây',
          'ĐCKĐB: rotor lồng sóc, độ trượt s',
          'ĐCĐB: V-curve, bù công suất phản kháng',
          '3 pha: Y/Δ, công suất √3·V·I·cosφ',
          'CCĐ: N-1, sụt áp ≤ 5%',
          'Bảo vệ: 50/51 quá dòng, 21 khoảng cách',
        ]),
        qnaSlide('p1-s10', c.background, c.primary, c.text),
      ]
    )
  )

  // 6.2 Chi tiết — 3 pha
  templates.push(
    templateObj(
      'electrical-lecture-3phase',
      'electrical',
      'Bài giảng chi tiết — Hệ thống điện 3 pha',
      'Template chi tiết hệ thống 3 pha: cân bằng, mất cân bằng, công suất. 12 slides.',
      ['3-phase', 'power', 'wattmeter', 'balanced', 'unbalanced', 'lecture'],
      'advanced',
      '150deg',
      c,
      [
        titleSlide(
          'p2-s1',
          c.background,
          c.primary,
          c.text,
          'Hệ thống điện 3 pha',
          'Cân bằng — Mất cân bằng — Đo công suất'
        ),
        outlineSlide('p2-s2', c.background, c.primary, c.text, [
          'Nguồn 3 pha đối xứng',
          'Tải cân bằng Y & Δ',
          'Tải mất cân bằng',
          'Công suất 3 pha',
          'Đo bằng Wattmeter',
          'Bù công suất phản kháng',
        ]),
        contentSlide(
          'p2-s3',
          c.background,
          c.primary,
          c.text,
          'Nguồn 3 pha đối xứng',
          '<p><b>3 pha lệch 120°:</b></p><p>$$v_a = V_m \\sin(\\omega t)$$</p><p>$$v_b = V_m \\sin(\\omega t - 120°)$$</p><p>$$v_c = V_m \\sin(\\omega t - 240°)$$</p><p><b>Tính chất:</b> v<sub>a</sub> + v<sub>b</sub> + v<sub>c</sub> = 0 (luôn luôn)</p><p><b>Thứ tự pha:</b> Thuận (abc) hoặc Nghịch (acb)</p>'
        ),
        twoColSlide(
          'p2-s4',
          c.background,
          c.primary,
          c.text,
          'Tải cân bằng — Y vs Δ',
          '<p><b>Tải đấu Y:</b></p><p>$$I_{pha} = \\frac{V_{pha}}{Z_{pha}}$$</p><p>$$I_{dây} = I_{pha}$$</p><p>$$V_{dây} = \\sqrt{3} V_{pha}$$</p><p>Dây trung tính: I<sub>N</sub> = 0</p>',
          '<p><b>Tải đấu Δ:</b></p><p>$$I_{pha} = \\frac{V_{dây}}{Z_{pha}}$$</p><p>$$I_{dây} = \\sqrt{3} I_{pha}$$</p><p>$$V_{dây} = V_{pha}$$</p><p>Không có dây trung tính</p>'
        ),
        contentSlide(
          'p2-s5',
          c.background,
          c.primary,
          c.text,
          'Biến đổi Y ↔ Δ',
          '<p><b>Δ → Y:</b></p><p style="text-align:center; font-size:22px">$$Z_Y = \\frac{Z_\\Delta}{3}$$</p><p><b>Y → Δ:</b></p><p style="text-align:center; font-size:22px">$$Z_\\Delta = 3 Z_Y$$</p><p><b>Tổng quát (không cân bằng):</b></p><p>$$Z_1 = \\frac{Z_{12} Z_{31}}{Z_{12} + Z_{23} + Z_{31}}$$</p>'
        ),
        contentSlide(
          'p2-s6',
          c.background,
          c.primary,
          c.text,
          'Tải mất cân bằng',
          '<p><b>Vấn đề:</b> Z<sub>a</sub> ≠ Z<sub>b</sub> ≠ Z<sub>c</sub></p><p><b>Tải Y có dây trung tính:</b></p><ul><li>Giải từng pha độc lập</li><li>I<sub>N</sub> = I<sub>a</sub> + I<sub>b</sub> + I<sub>c</sub> ≠ 0</li></ul><p><b>Tải Y không dây trung tính:</b></p><ul><li>Điện thế điểm trung tính trôi</li><li>Dùng công thức Millman</li></ul><p><b>Phương pháp thành phần đối xứng:</b> Fortescue decomposition</p>'
        ),
        contentSlide(
          'p2-s7',
          c.background,
          c.primary,
          c.text,
          'Công suất 3 pha',
          '<p><b>Tải cân bằng:</b></p><p style="text-align:center; font-size:20px">$$P = 3V_{pha}I_{pha}\\cos\\varphi = \\sqrt{3}V_{dây}I_{dây}\\cos\\varphi$$</p><p style="text-align:center; font-size:20px">$$Q = \\sqrt{3}V_{dây}I_{dây}\\sin\\varphi$$</p><p style="text-align:center; font-size:20px">$$S = \\sqrt{3}V_{dây}I_{dây}$$</p><p><b>Tam giác công suất:</b> S² = P² + Q²</p>'
        ),
        contentSlide(
          'p2-s8',
          c.background,
          c.primary,
          c.text,
          'Đo công suất — Phương pháp 2 Wattmeter',
          '<p><b>Nguyên lý Blondel:</b> N dây → cần (N−1) wattmeter</p><p><b>2 Wattmeter method (3 dây, 3 pha):</b></p><p>$$P_1 = V_{ac} I_a \\cos(30° + \\varphi)$$</p><p>$$P_2 = V_{bc} I_b \\cos(30° - \\varphi)$$</p><p>$$P_{total} = P_1 + P_2$$</p><p>$$\\tan\\varphi = \\sqrt{3} \\frac{P_1 - P_2}{P_1 + P_2}$$</p>'
        ),
        contentSlide(
          'p2-s9',
          c.background,
          c.primary,
          c.text,
          'Power Factor & Bù công suất phản kháng',
          '<p><b>Tại sao cần bù?</b></p><ul><li>cosφ thấp → dòng lớn → tổn hao tăng</li><li>Yêu cầu EVN: cosφ ≥ 0.85 (phạt nếu thấp hơn)</li></ul><p><b>Phương pháp bù:</b></p><ul><li>Tụ bù: rẻ, phổ biến nhất</li><li>Máy bù đồng bộ: linh hoạt</li><li>SVC/STATCOM: điều chỉnh nhanh</li></ul><p>$$Q_C = P(\\tan\\varphi_1 - \\tan\\varphi_2)$$</p>'
        ),
        contentSlide(
          'p2-s10',
          c.background,
          c.primary,
          c.text,
          'Harmonics trong hệ thống 3 pha',
          '<p><b>Nguồn harmonics:</b> Biến tần, chỉnh lưu, UPS, LED driver</p><p><b>Ảnh hưởng:</b></p><ul><li>Tăng tổn hao lõi sắt MBA</li><li>Quá nhiệt dây trung tính (harmonic bậc 3)</li><li>Mis-operation relay</li></ul><p><b>THD (Total Harmonic Distortion):</b></p><p style="text-align:center">$$THD = \\frac{\\sqrt{\\sum_{n=2}^\\infty V_n^2}}{V_1} \\times 100\\%$$</p><p>IEEE 519: THD<sub>v</sub> < 5%, THD<sub>i</sub> < 8%</p>'
        ),
        summarySlide('p2-s11', c.background, c.primary, c.text, [
          '3 pha đối xứng: 120° lệch nhau',
          'Y vs Δ: chọn tuỳ ứng dụng',
          'Mất cân bằng: Millman, Fortescue',
          'P = √3·V·I·cosφ',
          '2 Wattmeter: đo P + tính PF',
          'Bù Q: tụ bù, SVC, STATCOM',
        ]),
        qnaSlide('p2-s12', c.background, c.primary, c.text),
      ]
    )
  )

  // 6.3 Lab Report — MBA
  templates.push(
    templateObj(
      'electrical-lab-transformer',
      'electrical',
      'Lab Report — TN máy biến áp',
      'Template báo cáo TN không tải, ngắn mạch MBA. 8 slides.',
      ['transformer', 'lab', 'no-load', 'short-circuit', 'electrical'],
      'beginner',
      '180deg',
      c,
      [
        labTitleSlide('p3-s1', c.background, c.primary, c.text, 'Thí nghiệm Máy biến áp 1 pha'),
        contentSlide(
          'p3-s2',
          c.background,
          c.primary,
          c.text,
          'Mục đích thí nghiệm',
          '<ul style="font-size:20px; line-height:2"><li>Thí nghiệm không tải: xác định R<sub>c</sub>, X<sub>m</sub>, tổn hao lõi P<sub>Fe</sub></li><li>Thí nghiệm ngắn mạch: xác định R<sub>eq</sub>, X<sub>eq</sub>, tổn hao đồng P<sub>Cu</sub></li><li>Vẽ sơ đồ tương đương hoàn chỉnh</li><li>Tính hiệu suất và độ thay đổi điện áp</li></ul>'
        ),
        contentSlide(
          'p3-s3',
          c.background,
          c.primary,
          c.text,
          'TN Không tải (Open-circuit test)',
          '<p><b>Cách thực hiện:</b></p><ul><li>Thứ cấp hở mạch, cấp V<sub>1</sub> = V<sub>định mức</sub></li><li>Đo: V<sub>0</sub>, I<sub>0</sub>, P<sub>0</sub></li></ul><p><b>Tính toán:</b></p><p>$$\\cos\\varphi_0 = \\frac{P_0}{V_0 I_0}$$</p><p>$$R_c = \\frac{V_0^2}{P_0}$$, $$X_m = \\frac{V_0}{I_0 \\sin\\varphi_0}$$</p>'
        ),
        contentSlide(
          'p3-s4',
          c.background,
          c.primary,
          c.text,
          'TN Ngắn mạch (Short-circuit test)',
          '<p><b>Cách thực hiện:</b></p><ul><li>Thứ cấp ngắn mạch, tăng V<sub>1</sub> từ từ đến I<sub>sc</sub> = I<sub>định mức</sub></li><li>Đo: V<sub>sc</sub>, I<sub>sc</sub>, P<sub>sc</sub></li></ul><p><b>Tính toán:</b></p><p>$$Z_{eq} = \\frac{V_{sc}}{I_{sc}}$$, $$R_{eq} = \\frac{P_{sc}}{I_{sc}^2}$$</p><p>$$X_{eq} = \\sqrt{Z_{eq}^2 - R_{eq}^2}$$</p>'
        ),
        contentSlide(
          'p3-s5',
          c.background,
          c.primary,
          c.text,
          'Bảng số liệu',
          '<table style="width:100%; border-collapse:collapse; font-size:17px"><tr style="border-bottom:2px solid #4ecdc4"><th style="padding:6px; text-align:left">Thông số</th><th>Không tải</th><th>Ngắn mạch</th></tr><tr style="border-bottom:1px solid #4ecdc430"><td style="padding:6px">V (V)</td><td style="text-align:center">220</td><td style="text-align:center">12.5</td></tr><tr style="border-bottom:1px solid #4ecdc430"><td style="padding:6px">I (A)</td><td style="text-align:center">0.45</td><td style="text-align:center">2.27</td></tr><tr style="border-bottom:1px solid #4ecdc430"><td style="padding:6px">P (W)</td><td style="text-align:center">35</td><td style="text-align:center">28</td></tr><tr style="border-bottom:1px solid #4ecdc430"><td style="padding:6px">cosφ</td><td style="text-align:center">0.354</td><td style="text-align:center">0.99</td></tr><tr><td style="padding:6px; font-weight:bold">Kết quả</td><td style="text-align:center">R<sub>c</sub>=1383Ω, X<sub>m</sub>=526Ω</td><td style="text-align:center">R<sub>eq</sub>=5.4Ω, X<sub>eq</sub>=0.8Ω</td></tr></table>'
        ),
        contentSlide(
          'p3-s6',
          c.background,
          c.primary,
          c.text,
          'Hiệu suất & Voltage Regulation',
          '<p><b>Hiệu suất:</b></p><p style="text-align:center; font-size:22px">$$\\eta = \\frac{S \\cdot \\text{pf} \\cdot k}{S \\cdot \\text{pf} \\cdot k + P_{Fe} + k^2 P_{Cu}} \\times 100\\%$$</p><p>η<sub>max</sub> khi P<sub>Fe</sub> = k²P<sub>Cu</sub> → k = √(P<sub>Fe</sub>/P<sub>Cu</sub>)</p><p><b>Voltage Regulation:</b></p><p style="text-align:center; font-size:22px">$$VR = \\frac{V_{NL} - V_{FL}}{V_{FL}} \\times 100\\%$$</p>'
        ),
        contentSlide(
          'p3-s7',
          c.background,
          c.primary,
          c.text,
          'Nhận xét & Kết luận',
          '<ul style="line-height:2"><li>Sơ đồ tương đương phù hợp với thực tế</li><li>P<sub>Fe</sub> ≈ const (phụ thuộc V), P<sub>Cu</sub> ∝ I² (phụ thuộc tải)</li><li>η<sub>max</sub> ≈ 96% tại k ≈ 0.8 (80% tải)</li><li>VR ≈ 3.5% tại cosφ = 0.8 lagging</li><li>Sai số do: dụng cụ đo, nhiệt độ, tổn hao phụ</li></ul>'
        ),
        qnaSlide('p3-s8', c.background, c.primary, c.text),
      ]
    )
  )

  // 6.4 Seminar — NL tái tạo
  templates.push(
    templateObj(
      'electrical-seminar-renewable',
      'electrical',
      'Seminar — Năng lượng tái tạo',
      'Template seminar về điện mặt trời, gió, grid integration. 7 slides.',
      ['solar', 'wind', 'renewable', 'mppt', 'grid', 'seminar'],
      'intermediate',
      '120deg',
      c,
      [
        seminarTitleSlide(
          'p4-s1',
          c.background,
          c.primary,
          c.text,
          'Năng lượng tái tạo & Lưới điện thông minh',
          'Solar PV · Wind · Grid Integration'
        ),
        contentSlide(
          'p4-s2',
          c.background,
          c.primary,
          c.text,
          'Điện mặt trời — Solar PV',
          '<p><b>Nguyên lý:</b> Hiệu ứng quang điện (photovoltaic effect)</p><p><b>Cell → Module → Array:</b></p><ul><li>Cell silicon: V<sub>oc</sub> ≈ 0.6V, I<sub>sc</sub> ≈ 8A</li><li>Module 60 cells: V<sub>mp</sub> ≈ 30V, P<sub>mp</sub> ≈ 350W</li></ul><p><b>Hiệu suất:</b> Mono-Si: 20–22%, Poly-Si: 17–19%, Thin-film: 12–15%</p>'
        ),
        contentSlide(
          'p4-s3',
          c.background,
          c.primary,
          c.text,
          'MPPT — Maximum Power Point Tracking',
          '<p><b>Vấn đề:</b> P<sub>max</sub> thay đổi theo irradiance và nhiệt độ</p><p><b>Thuật toán P&O (Perturb & Observe):</b></p><ol><li>Tăng V → đo P</li><li>P tăng → tiếp tục tăng V</li><li>P giảm → đảo chiều</li></ol><p><b>Thuật toán INC (Incremental Conductance):</b></p><p>$$\\frac{dP}{dV} = 0 \\Rightarrow \\frac{dI}{dV} = -\\frac{I}{V}$$</p>'
        ),
        contentSlide(
          'p4-s4',
          c.background,
          c.primary,
          c.text,
          'Điện gió — Wind Turbine',
          '<p><b>Công suất gió:</b></p><p style="text-align:center; font-size:22px">$$P = \\frac{1}{2} \\rho A v^3 C_p$$</p><p>C<sub>p</sub> max = 16/27 ≈ 59.3% (giới hạn Betz)</p><p><b>Loại turbine:</b></p><ul><li>DFIG (Doubly-Fed Induction Generator): phổ biến nhất</li><li>PMSG (Permanent Magnet Synchronous): offshore</li></ul>'
        ),
        contentSlide(
          'p4-s5',
          c.background,
          c.primary,
          c.text,
          'Grid Integration — Hoà lưới',
          '<p><b>Thách thức:</b></p><ul><li>Biến động: phụ thuộc thời tiết</li><li>Ổn định tần số: inertia thấp</li><li>Power quality: harmonics từ inverter</li></ul><p><b>Giải pháp:</b></p><ul><li>Battery ESS: lithium-ion, flow battery</li><li>Smart inverter: grid-forming, ride-through</li><li>Forecasting: AI/ML dự báo sản lượng</li></ul>'
        ),
        contentSlide(
          'p4-s6',
          c.background,
          c.primary,
          c.text,
          'Smart Grid & Microgrid',
          '<p><b>Lưới điện thông minh:</b></p><ul><li>AMI (Advanced Metering Infrastructure)</li><li>DERMS (Distributed Energy Resource Management)</li><li>Demand response: điều chỉnh tải theo giời cao/thấp điểm</li></ul><p><b>Microgrid:</b></p><ul><li>Hoạt động island mode khi lưới chính sự cố</li><li>PV + Wind + Battery + Diesel backup</li><li>EMS: energy management system</li></ul>'
        ),
        qnaSlide('p4-s7', c.background, c.primary, c.text),
      ]
    )
  )

  // 6.5 Project — CCĐ
  templates.push(
    templateObj(
      'electrical-project-power',
      'electrical',
      'Project — Thiết kế hệ thống cung cấp điện',
      'Template đồ án CCĐ: single-line diagram, load calculation, protection. 9 slides.',
      ['power-system', 'single-line', 'load', 'protection', 'project'],
      'advanced',
      '160deg',
      c,
      [
        projectTitleSlide(
          'p5-s1',
          c.background,
          c.primary,
          c.text,
          'Thiết kế hệ thống cung cấp điện cho nhà máy'
        ),
        contentSlide(
          'p5-s2',
          c.background,
          c.primary,
          c.text,
          'Thông tin phụ tải',
          '<p><b>Nhà máy cơ khí — Các phân xưởng:</b></p><table style="width:100%; border-collapse:collapse; font-size:17px"><tr style="border-bottom:2px solid #4ecdc4"><th style="padding:6px; text-align:left">Phân xưởng</th><th>P<sub>đặt</sub> (kW)</th><th>K<sub>sd</sub></th><th>cosφ</th></tr><tr style="border-bottom:1px solid #4ecdc430"><td style="padding:6px">Gia công cơ khí</td><td style="text-align:center">450</td><td style="text-align:center">0.6</td><td style="text-align:center">0.7</td></tr><tr style="border-bottom:1px solid #4ecdc430"><td style="padding:6px">Hàn + nhiệt luyện</td><td style="text-align:center">350</td><td style="text-align:center">0.5</td><td style="text-align:center">0.75</td></tr><tr style="border-bottom:1px solid #4ecdc430"><td style="padding:6px">Lắp ráp</td><td style="text-align:center">200</td><td style="text-align:center">0.65</td><td style="text-align:center">0.8</td></tr><tr><td style="padding:6px">Văn phòng + phụ trợ</td><td style="text-align:center">80</td><td style="text-align:center">0.7</td><td style="text-align:center">0.85</td></tr></table>'
        ),
        contentSlide(
          'p5-s3',
          c.background,
          c.primary,
          c.text,
          'Tính toán phụ tải',
          '<p><b>Phương pháp K<sub>nc</sub> (hệ số nhu cầu):</b></p><p style="text-align:center; font-size:22px">$$P_{tt} = K_{nc} \\cdot P_{đặt}$$</p><p><b>Tổng hợp:</b></p><ul><li>P<sub>tổng</sub> = K<sub>đt</sub> × ΣP<sub>tt</sub> = 0.85 × 640 = 544 kW</li><li>Q<sub>tổng</sub> = 480 kVAr</li><li>S<sub>tổng</sub> = √(P² + Q²) = 725 kVA</li><li>cosφ<sub>tổng</sub> = 0.75 → cần bù lên 0.9</li></ul>'
        ),
        contentSlide(
          'p5-s4',
          c.background,
          c.primary,
          c.text,
          'Sơ đồ nguyên lý CCĐ',
          '<p style="text-align:center; font-style:italic; color:#4ecdc480">Chèn single-line diagram vào đây</p><p style="margin-top:15px"><b>Phương án:</b></p><ul><li>Nguồn: 22kV từ lưới EVN</li><li>TBA: 22/0.4kV, 800kVA, Dyn11</li><li>Tủ phân phối tổng (MDB)</li><li>Tủ phân phối phân xưởng (SDB)</li><li>Cáp: Cu/XLPE, ngầm</li></ul>'
        ),
        contentSlide(
          'p5-s5',
          c.background,
          c.primary,
          c.text,
          'Chọn thiết bị chính',
          '<table style="width:100%; border-collapse:collapse; font-size:16px"><tr style="border-bottom:2px solid #4ecdc4"><th style="padding:6px; text-align:left">Thiết bị</th><th>Thông số</th><th>Số lượng</th></tr><tr style="border-bottom:1px solid #4ecdc430"><td style="padding:6px">MBA</td><td>800kVA, 22/0.4kV, Dyn11</td><td style="text-align:center">1</td></tr><tr style="border-bottom:1px solid #4ecdc430"><td style="padding:6px">ACB tổng</td><td>1600A, 50kA, 3P</td><td style="text-align:center">1</td></tr><tr style="border-bottom:1px solid #4ecdc430"><td style="padding:6px">MCCB phân xưởng</td><td>400A-630A, 36kA</td><td style="text-align:center">4</td></tr><tr style="border-bottom:1px solid #4ecdc430"><td style="padding:6px">Tụ bù</td><td>200kVAr, tự động 6 cấp</td><td style="text-align:center">1 bộ</td></tr><tr><td style="padding:6px">Cáp ngầm</td><td>Cu/XLPE 3×185+95mm²</td><td style="text-align:center">120m</td></tr></table>'
        ),
        contentSlide(
          'p5-s6',
          c.background,
          c.primary,
          c.text,
          'Tính ngắn mạch & Bảo vệ',
          '<p><b>Dòng ngắn mạch tại MDB:</b></p><p style="text-align:center; font-size:22px">$$I_{sc} = \\frac{S_{MBA}}{\\sqrt{3} \\cdot U_2 \\cdot u_k\\%} = \\frac{800}{\\sqrt{3} \\times 0.4 \\times 0.04} \\approx 28.9 \\text{kA}$$</p><p><b>Phối hợp bảo vệ:</b></p><ul><li>ACB tổng: I<sub>set</sub> = 1.4 × I<sub>n</sub>, t = 0.4s</li><li>MCCB nhánh: I<sub>set</sub> = 1.25 × I<sub>n</sub>, t = 0.1s (selective)</li></ul>'
        ),
        contentSlide(
          'p5-s7',
          c.background,
          c.primary,
          c.text,
          'Nối đất & An toàn',
          '<p><b>Hệ thống nối đất TN-S:</b></p><ul><li>PE riêng biệt từ MBA đến tải</li><li>Điện trở nối đất: R<sub>đ</sub> ≤ 4Ω</li></ul><p><b>An toàn:</b></p><ul><li>RCCB 30mA cho ổ cắm (chống giật)</li><li>SPD (chống sét) tại tủ tổng</li><li>IP54 cho tủ phân xưởng</li></ul>'
        ),
        contentSlide(
          'p5-s8',
          c.background,
          c.primary,
          c.text,
          'Dự toán & Kết luận',
          '<p><b>Chi phí ước tính:</b></p><ul><li>MBA + tủ: 350 triệu VNĐ</li><li>Cáp + phụ kiện: 180 triệu</li><li>Thi công: 120 triệu</li><li><b>Tổng: ≈ 650 triệu VNĐ</b></li></ul><p><b>Kết luận:</b> Phương án đáp ứng yêu cầu kỹ thuật, kinh tế hợp lý, dễ mở rộng trong tương lai.</p>'
        ),
        qnaSlide('p5-s9', c.background, c.primary, c.text),
      ]
    )
  )

  return templates
}

// ══════════════════════════════════════════════════════
// PHASE 04: P2 Templates (3 per subject)
// ══════════════════════════════════════════════════════

const MEAS = { primary: '#a8e6cf', background: '#0e1a14', text: '#d5ffe8', accent: '#56ab2f' }
const PELEC = { primary: '#ff8a5c', background: '#1a100a', text: '#ffe0d5', accent: '#ff6348' }
const MECH = { primary: '#95adb6', background: '#0f1419', text: '#dce5e8', accent: '#74b9ff' }
const DRAW = { primary: '#8b7355', background: '#f5f0e8', text: '#2c2416', accent: '#6b5b3e' }
const FLUID = { primary: '#48bfe3', background: '#0a1628', text: '#d0eeff', accent: '#00b4d8' }

function genMeasurementTemplates() {
  const c = MEAS
  return [
    templateObj(
      'meas-lecture-overview',
      'measurement',
      'Bài giảng tổng quan — Đo lường đại lượng điện',
      'Template bài giảng về sai số, cầu Wheatstone, oscilloscope, sensor. 10 slides.',
      ['measurement', 'wheatstone', 'oscilloscope', 'sensor', 'lecture'],
      'intermediate',
      '135deg',
      c,
      [
        titleSlide(
          'm1-s1',
          c.background,
          c.primary,
          c.text,
          'Đo lường đại lượng điện',
          'Giảng viên: ... · Lớp: ... · Ngày: ...'
        ),
        outlineSlide('m1-s2', c.background, c.primary, c.text, [
          'Sai số đo lường',
          'Cơ cấu đo',
          'Cầu Wheatstone',
          'Oscilloscope',
          'Sensor & Transducer',
          'Đo công suất',
        ]),
        contentSlide(
          'm1-s3',
          c.background,
          c.primary,
          c.text,
          'Sai số đo lường',
          '<p><b>Sai số tuyệt đối:</b> Δx = |x<sub>đo</sub> − x<sub>thực</sub>|</p><p><b>Sai số tương đối:</b></p><p style="text-align:center; font-size:24px; margin:15px 0">$$\\delta = \\frac{\\Delta x}{x_{thực}} \\times 100\\%$$</p><p><b>Phân loại:</b></p><ul><li><b>Hệ thống:</b> có quy luật, hiệu chỉnh được</li><li><b>Ngẫu nhiên:</b> phân bố Gauss, giảm bằng đo nhiều lần</li><li><b>Sai số thô:</b> lỗi người đo, loại bỏ</li></ul>'
        ),
        contentSlide(
          'm1-s4',
          c.background,
          c.primary,
          c.text,
          'Cơ cấu đo điện',
          "<p><b>Từ điện (D'Arsonval):</b></p><ul><li>Cuộn dây quay trong từ trường cố định</li><li>Chỉ đo DC, độ chính xác cao (class 0.5)</li></ul><p><b>Điện từ:</b></p><ul><li>Lá sắt bị hút vào cuộn dây</li><li>Đo AC/DC, thang phi tuyến</li></ul><p><b>Điện động:</b></p><ul><li>2 cuộn dây (cố định + di động)</li><li>Đo công suất (Wattmeter)</li></ul>"
        ),
        contentSlide(
          'm1-s5',
          c.background,
          c.primary,
          c.text,
          'Cầu Wheatstone',
          '<p><b>Sơ đồ:</b> 4 nhánh điện trở hình thoi + galvanometer</p><p><b>Điều kiện cân bằng:</b></p><p style="text-align:center; font-size:24px; margin:15px 0">$$R_x = \\frac{R_2 \\cdot R_3}{R_1}$$</p><p><b>Độ nhạy:</b> phụ thuộc tỷ số R<sub>2</sub>/R<sub>1</sub></p><p><b>Ứng dụng:</b> Đo R chính xác, strain gauge, RTD</p>'
        ),
        contentSlide(
          'm1-s6',
          c.background,
          c.primary,
          c.text,
          'Oscilloscope',
          '<p><b>Digital Storage Oscilloscope (DSO):</b></p><ul><li>Sample rate: 1–20 GSa/s</li><li>Bandwidth: 50 MHz – 8 GHz</li><li>Channels: 2 hoặc 4</li></ul><p><b>Đo lường:</b></p><ul><li>V<sub>pp</sub> = (peak − trough) × V/div</li><li>f = 1/T, T = (cycles) × Time/div</li><li>Phase: Δt/T × 360°</li></ul>'
        ),
        contentSlide(
          'm1-s7',
          c.background,
          c.primary,
          c.text,
          'Sensor & Transducer',
          '<p><b>Nhiệt độ:</b></p><ul><li>RTD (Pt100): tuyến tính, chính xác</li><li>Thermocouple: range rộng, rẻ</li><li>Thermistor: nhạy, phi tuyến</li></ul><p><b>Áp suất:</b> Strain gauge, piezoelectric</p><p><b>Vị trí:</b> Encoder, LVDT, potentiometer</p><p><b>Lưu lượng:</b> Orifice, Venturi, Coriolis</p>'
        ),
        contentSlide(
          'm1-s8',
          c.background,
          c.primary,
          c.text,
          'Đo công suất AC',
          '<p><b>1 pha:</b> P = V·I·cosφ (dùng Wattmeter)</p><p><b>3 pha cân bằng:</b> Phương pháp 2 Wattmeter</p><p style="text-align:center; font-size:20px">$$P = P_1 + P_2$$</p><p><b>Power Analyzer:</b></p><ul><li>Yokogawa WT5000, Hioki PW6001</li><li>Đo P, Q, S, PF, harmonics, THD</li><li>DC – 1 MHz bandwidth</li></ul>'
        ),
        summarySlide('m1-s9', c.background, c.primary, c.text, [
          'Sai số: hệ thống vs ngẫu nhiên',
          'Cơ cấu: từ điện (DC), điện từ (AC/DC)',
          'Wheatstone: đo R chính xác',
          'Oscilloscope: đo Vpp, f, phase',
          'Sensor: RTD, thermocouple, strain gauge',
          'Power: Wattmeter, power analyzer',
        ]),
        qnaSlide('m1-s10', c.background, c.primary, c.text),
      ]
    ),
    templateObj(
      'meas-lab-measurement',
      'measurement',
      'Lab Report — Đo đại lượng điện',
      'Template báo cáo TN đo R/L/C bằng DMM, oscilloscope, cầu đo. 8 slides.',
      ['lab', 'dmm', 'rlc', 'measurement', 'experiment'],
      'beginner',
      '180deg',
      c,
      [
        labTitleSlide('m2-s1', c.background, c.primary, c.text, 'Đo đại lượng điện cơ bản R, L, C'),
        contentSlide(
          'm2-s2',
          c.background,
          c.primary,
          c.text,
          'Mục đích & Thiết bị',
          '<ul style="font-size:20px; line-height:2"><li>Sử dụng DMM đo R, V, I</li><li>Sử dụng oscilloscope đo V<sub>pp</sub>, f, phase</li><li>So sánh cầu đo vs DMM trong đo R</li><li><b>Thiết bị:</b> DMM (Fluke 87V), DSO (Rigol DS1054Z), cầu Wheatstone</li><li><b>Linh kiện:</b> R (100Ω–10kΩ), L (10mH–100mH), C (100nF–10μF)</li></ul>'
        ),
        contentSlide(
          'm2-s3',
          c.background,
          c.primary,
          c.text,
          'TN1: Đo điện trở bằng DMM & cầu Wheatstone',
          '<table style="width:100%; border-collapse:collapse; font-size:17px"><tr style="border-bottom:2px solid #a8e6cf"><th style="padding:6px; text-align:left">R nominal</th><th>DMM (Ω)</th><th>Cầu (Ω)</th><th>Sai số DMM</th><th>Sai số cầu</th></tr><tr style="border-bottom:1px solid #a8e6cf30"><td style="padding:6px">100Ω</td><td style="text-align:center">99.3</td><td style="text-align:center">99.8</td><td style="text-align:center">0.7%</td><td style="text-align:center">0.2%</td></tr><tr style="border-bottom:1px solid #a8e6cf30"><td style="padding:6px">1kΩ</td><td style="text-align:center">988</td><td style="text-align:center">997</td><td style="text-align:center">1.2%</td><td style="text-align:center">0.3%</td></tr><tr><td style="padding:6px">10kΩ</td><td style="text-align:center">9.85k</td><td style="text-align:center">9.98k</td><td style="text-align:center">1.5%</td><td style="text-align:center">0.2%</td></tr></table><p style="margin-top:10px"><b>Nhận xét:</b> Cầu Wheatstone chính xác hơn DMM</p>'
        ),
        contentSlide(
          'm2-s4',
          c.background,
          c.primary,
          c.text,
          'TN2: Đo L, C bằng Oscilloscope',
          '<p><b>Phương pháp:</b> Mạch RC/RL kết hợp function generator</p><p>Đo thời hằng τ từ waveform:</p><ul><li>RC: τ = R×C → C = τ/R</li><li>RL: τ = L/R → L = τ×R</li></ul><p><b>Kết quả:</b></p><ul><li>C = 1μF: đo được 0.97μF (sai số 3%)</li><li>L = 47mH: đo được 45.2mH (sai số 3.8%)</li></ul>'
        ),
        contentSlide(
          'm2-s5',
          c.background,
          c.primary,
          c.text,
          'TN3: Đo tần số & Pha bằng DSO',
          '<p><b>Tín hiệu:</b> Function generator → R và C nối tiếp → đo V<sub>R</sub>, V<sub>C</sub></p><p><b>Kết quả:</b></p><table style="width:100%; border-collapse:collapse; font-size:17px"><tr style="border-bottom:2px solid #a8e6cf"><th style="padding:6px">f (kHz)</th><th>V<sub>R</sub> (V)</th><th>V<sub>C</sub> (V)</th><th>Phase (°)</th></tr><tr style="border-bottom:1px solid #a8e6cf30"><td style="padding:6px; text-align:center">1</td><td style="text-align:center">1.2</td><td style="text-align:center">4.5</td><td style="text-align:center">-75</td></tr><tr style="border-bottom:1px solid #a8e6cf30"><td style="padding:6px; text-align:center">1.59</td><td style="text-align:center">3.5</td><td style="text-align:center">3.5</td><td style="text-align:center">-45</td></tr><tr><td style="padding:6px; text-align:center">10</td><td style="text-align:center">4.8</td><td style="text-align:center">0.8</td><td style="text-align:center">-10</td></tr></table>'
        ),
        contentSlide(
          'm2-s6',
          c.background,
          c.primary,
          c.text,
          'Phân tích & So sánh phương pháp',
          '<ul style="line-height:2"><li><b>DMM:</b> Nhanh, tiện lợi, accuracy ±0.5–1.5%</li><li><b>Cầu Wheatstone:</b> Chính xác hơn (±0.1%), chậm</li><li><b>Oscilloscope:</b> Linh hoạt nhất, đo AC waveform, phase</li><li>DMM phù hợp kiểm tra nhanh</li><li>Cầu đo dùng khi cần precision cao</li></ul>'
        ),
        contentSlide(
          'm2-s7',
          c.background,
          c.primary,
          c.text,
          'Kết luận',
          '<ul style="line-height:2"><li>Thực hành thành thạo 3 phương pháp đo cơ bản</li><li>Hiểu ưu/nhược điểm từng phương pháp</li><li>Sai số đo nằm trong dung sai cho phép</li><li>Oscilloscope là công cụ đa năng nhất cho đo lường điện tử</li></ul>'
        ),
        qnaSlide('m2-s8', c.background, c.primary, c.text),
      ]
    ),
    templateObj(
      'meas-project-system',
      'measurement',
      'Project — Thiết kế hệ thống đo',
      'Template đồ án thiết kế hệ thống đo lường: sensor, ADC, display. 9 slides.',
      ['project', 'sensor', 'adc', 'signal-conditioning', 'measurement'],
      'advanced',
      '160deg',
      c,
      [
        projectTitleSlide(
          'm3-s1',
          c.background,
          c.primary,
          c.text,
          'Thiết kế hệ thống đo nhiệt độ đa kênh'
        ),
        contentSlide(
          'm3-s2',
          c.background,
          c.primary,
          c.text,
          'Yêu cầu kỹ thuật',
          '<ul style="line-height:2"><li><b>Kênh đo:</b> 8 kênh nhiệt độ</li><li><b>Sensor:</b> PT100 (RTD)</li><li><b>Range:</b> -50°C đến +300°C</li><li><b>Accuracy:</b> ±0.5°C</li><li><b>Hiển thị:</b> LCD + SD card logging</li><li><b>Giao tiếp:</b> RS485 Modbus RTU</li></ul>'
        ),
        contentSlide(
          'm3-s3',
          c.background,
          c.primary,
          c.text,
          'Signal Conditioning',
          '<p><b>PT100 → mạch cầu → INA → ADC:</b></p><ul><li>Excitation current: 1mA (tránh self-heating)</li><li>3-wire compensation: loại bỏ sai số dây dẫn</li><li>INA128: G = 50 → ΔV = 50 × 0.385 × ΔT mV</li></ul><p><b>Anti-aliasing:</b> LPF fc = 10Hz (nhiệt độ thay đổi chậm)</p>'
        ),
        contentSlide(
          'm3-s4',
          c.background,
          c.primary,
          c.text,
          'ADC & Multiplexer',
          '<p><b>ADS1115:</b> 16-bit, 860 SPS, I2C, ±2.048V range</p><p><b>Resolution:</b> 2.048/32768 = 62.5μV → ΔT ≈ 0.003°C</p><p><b>MUX:</b> CD74HC4067 (16 kênh) → chọn 1/8 kênh sensor</p><p><b>Sampling:</b> 8 kênh × 10 SPS = scan cycle 0.8s</p>'
        ),
        contentSlide(
          'm3-s5',
          c.background,
          c.primary,
          c.text,
          'Firmware — STM32',
          '<p><b>MCU:</b> STM32F103C8T6 (Blue Pill)</p><p><b>Main loop:</b></p><ol style="line-height:1.8"><li>MUX select channel</li><li>Wait settling (10ms)</li><li>Read ADS1115 via I2C</li><li>Linearization (Callendar-Van Dusen)</li><li>Digital filter (moving average N=10)</li><li>Update LCD, log SD card</li><li>Respond Modbus query</li></ol>'
        ),
        contentSlide(
          'm3-s6',
          c.background,
          c.primary,
          c.text,
          'Calibration',
          '<p><b>Phương pháp:</b> 2-point calibration</p><ul><li>Điểm 0°C: nước đá tan</li><li>Điểm 100°C: nước sôi</li></ul><p><b>Hiệu chỉnh:</b></p><p style="text-align:center; font-size:20px">$$T_{cal} = \\frac{T_{raw} - T_{low}}{T_{high} - T_{low}} \\times (T_{ref,high} - T_{ref,low}) + T_{ref,low}$$</p><p>Lưu hệ số vào EEPROM cho từng kênh</p>'
        ),
        contentSlide(
          'm3-s7',
          c.background,
          c.primary,
          c.text,
          'Kết quả & Đánh giá',
          '<ul style="line-height:2"><li>8 kênh hoạt động ổn định</li><li>Accuracy: ±0.3°C (vượt yêu cầu ±0.5°C)</li><li>Response time: < 2s</li><li>Modbus RTU: test OK với SCADA</li><li>SD card: log 24h liên tục, file CSV</li></ul>'
        ),
        contentSlide(
          'm3-s8',
          c.background,
          c.primary,
          c.text,
          'Cải tiến & Phát triển',
          '<ul style="line-height:2"><li>Nâng lên 16 kênh + thermocouple support</li><li>Wi-Fi (ESP32): cloud dashboard</li><li>Alarm: relay output khi T > threshold</li><li>Vỏ hộp: IP65 cho môi trường công nghiệp</li></ul>'
        ),
        qnaSlide('m3-s9', c.background, c.primary, c.text),
      ]
    ),
  ]
}

function genPowerElecTemplates() {
  const c = PELEC
  return [
    templateObj(
      'pelec-lecture-overview',
      'power-electronics',
      'Bài giảng tổng quan — Điện tử công suất',
      'Template bài giảng ĐTCS: Thyristor, chỉnh lưu, Buck/Boost, Inverter. 10 slides.',
      ['thyristor', 'rectifier', 'buck', 'boost', 'inverter', 'lecture'],
      'intermediate',
      '135deg',
      c,
      [
        titleSlide(
          'pe1-s1',
          c.background,
          c.primary,
          c.text,
          'Điện tử công suất: Linh kiện & Bộ biến đổi',
          'Giảng viên: ... · Lớp: ... · Ngày: ...'
        ),
        outlineSlide('pe1-s2', c.background, c.primary, c.text, [
          'Linh kiện công suất',
          'Chỉnh lưu',
          'Buck converter',
          'Boost converter',
          'Inverter',
          'PWM',
        ]),
        tableSlide(
          'pe1-s3',
          c.background,
          c.primary,
          c.text,
          'Linh kiện bán dẫn công suất',
          '<table style="width:100%; border-collapse:collapse"><tr style="border-bottom:2px solid #ff8a5c"><th style="padding:8px; text-align:left">Linh kiện</th><th style="padding:8px">V<sub>max</sub></th><th style="padding:8px">I<sub>max</sub></th><th style="padding:8px">f<sub>sw</sub></th><th style="padding:8px">Điều khiển</th></tr><tr style="border-bottom:1px solid #ff8a5c30"><td style="padding:8px">SCR</td><td style="padding:8px; text-align:center">6kV</td><td style="padding:8px; text-align:center">3kA</td><td style="padding:8px; text-align:center">500Hz</td><td style="padding:8px; text-align:center">Gate trigger</td></tr><tr style="border-bottom:1px solid #ff8a5c30"><td style="padding:8px">IGBT</td><td style="padding:8px; text-align:center">3.3kV</td><td style="padding:8px; text-align:center">1.2kA</td><td style="padding:8px; text-align:center">20kHz</td><td style="padding:8px; text-align:center">V<sub>GE</sub></td></tr><tr style="border-bottom:1px solid #ff8a5c30"><td style="padding:8px">Power MOSFET</td><td style="padding:8px; text-align:center">600V</td><td style="padding:8px; text-align:center">100A</td><td style="padding:8px; text-align:center">500kHz</td><td style="padding:8px; text-align:center">V<sub>GS</sub></td></tr><tr><td style="padding:8px">GaN HEMT</td><td style="padding:8px; text-align:center">650V</td><td style="padding:8px; text-align:center">60A</td><td style="padding:8px; text-align:center">2MHz</td><td style="padding:8px; text-align:center">V<sub>GS</sub></td></tr></table>'
        ),
        contentSlide(
          'pe1-s4',
          c.background,
          c.primary,
          c.text,
          'Chỉnh lưu (Rectifier)',
          '<p><b>Nửa chu kỳ:</b> $$V_{dc} = \\frac{V_m}{\\pi}$$</p><p><b>Toàn chu kỳ (cầu):</b> $$V_{dc} = \\frac{2V_m}{\\pi}$$</p><p><b>Chỉnh lưu cầu 3 pha:</b> $$V_{dc} = \\frac{3\\sqrt{3}V_m}{\\pi} \\approx 1.35 V_{LL}$$</p><p><b>Có điều khiển (Thyristor):</b> $$V_{dc} = V_{dc0} \\cos\\alpha$$</p><p>α: góc kích thyristor (0° – 180°)</p>'
        ),
        contentSlide(
          'pe1-s5',
          c.background,
          c.primary,
          c.text,
          'Buck Converter — Giảm áp',
          '<p><b>Nguyên lý:</b> Switch (MOSFET) + Diode + LC filter</p><p style="text-align:center; font-size:24px; margin:15px 0">$$V_o = D \\cdot V_{in}$$</p><p>D = t<sub>on</sub>/T (duty cycle, 0 < D < 1)</p><p><b>Dòng gợn sóng:</b></p><p style="text-align:center; font-size:20px">$$\\Delta I_L = \\frac{(V_{in} - V_o)D}{f_{sw} L}$$</p><p>Chế độ CCM: I<sub>L</sub> luôn > 0</p>'
        ),
        contentSlide(
          'pe1-s6',
          c.background,
          c.primary,
          c.text,
          'Boost Converter — Tăng áp',
          '<p style="text-align:center; font-size:24px; margin:15px 0">$$V_o = \\frac{V_{in}}{1-D}$$</p><p>D = 0.5 → V<sub>o</sub> = 2V<sub>in</sub></p><p>D = 0.75 → V<sub>o</sub> = 4V<sub>in</sub></p><p><b>Giới hạn:</b> D < 0.85 thực tế (parasitic losses)</p><p><b>Ứng dụng:</b> PFC, MPPT solar, battery step-up</p>'
        ),
        contentSlide(
          'pe1-s7',
          c.background,
          c.primary,
          c.text,
          'Inverter — Nghịch lưu',
          '<p><b>Half-bridge:</b> 2 switch → AC vuông +V<sub>dc</sub>/2, −V<sub>dc</sub>/2</p><p><b>Full-bridge (H-bridge):</b> 4 switch → AC vuông ±V<sub>dc</sub></p><p><b>3-phase inverter:</b> 6 switch → 3 pha AC cho motor</p><p><b>Multi-level:</b> Neutral-Point-Clamped (NPC), Cascaded H-bridge → THD thấp hơn</p>'
        ),
        contentSlide(
          'pe1-s8',
          c.background,
          c.primary,
          c.text,
          'PWM — Điều chế độ rộng xung',
          '<p><b>SPWM (Sinusoidal PWM):</b></p><ul><li>So sánh sin reference với carrier tam giác</li><li>M<sub>a</sub> = V<sub>ref</sub>/V<sub>carrier</sub> (modulation index)</li><li>V<sub>1(rms)</sub> = M<sub>a</sub> × V<sub>dc</sub>/√2</li></ul><p><b>SV-PWM (Space Vector):</b></p><ul><li>Hiệu suất bus DC cao hơn 15%</li><li>Chuẩn trong biến tần công nghiệp</li></ul>'
        ),
        summarySlide('pe1-s9', c.background, c.primary, c.text, [
          'SCR/IGBT/MOSFET: chọn theo V, I, f',
          'Chỉnh lưu: không/có điều khiển, cầu 3 pha',
          'Buck: V<sub>o</sub> = D·V<sub>in</sub>, giảm áp',
          'Boost: V<sub>o</sub> = V<sub>in</sub>/(1-D), tăng áp',
          'Inverter: DC→AC, half/full/3-phase',
          'PWM: SPWM, SV-PWM cho THD thấp',
        ]),
        qnaSlide('pe1-s10', c.background, c.primary, c.text),
      ]
    ),
    templateObj(
      'pelec-lab-rectifier',
      'power-electronics',
      'Lab Report — Mạch chỉnh lưu có điều khiển',
      'Template TN chỉnh lưu thyristor, đo góc kích α, output voltage. 8 slides.',
      ['rectifier', 'thyristor', 'firing-angle', 'lab', 'experiment'],
      'beginner',
      '180deg',
      c,
      [
        labTitleSlide(
          'pe2-s1',
          c.background,
          c.primary,
          c.text,
          'Thí nghiệm mạch chỉnh lưu có điều khiển'
        ),
        contentSlide(
          'pe2-s2',
          c.background,
          c.primary,
          c.text,
          'Mục đích & Thiết bị',
          '<ul style="font-size:20px; line-height:2"><li>Khảo sát mạch chỉnh lưu 1 pha cầu thyristor</li><li>Đo V<sub>dc</sub> theo góc kích α</li><li>So sánh lý thuyết vs thực tế</li><li><b>Thiết bị:</b> Module TN ĐTCS, DSO, DMM</li><li><b>Tải:</b> R = 100Ω, R-L (100Ω + 50mH)</li></ul>'
        ),
        contentSlide(
          'pe2-s3',
          c.background,
          c.primary,
          c.text,
          'Bảng số liệu — Tải R',
          '<table style="width:100%; border-collapse:collapse; font-size:17px"><tr style="border-bottom:2px solid #ff8a5c"><th style="padding:6px">α (°)</th><th>V<sub>dc</sub> lý thuyết (V)</th><th>V<sub>dc</sub> đo (V)</th><th>Sai số (%)</th></tr><tr style="border-bottom:1px solid #ff8a5c30"><td style="padding:6px; text-align:center">0</td><td style="text-align:center">45.0</td><td style="text-align:center">43.8</td><td style="text-align:center">2.7</td></tr><tr style="border-bottom:1px solid #ff8a5c30"><td style="padding:6px; text-align:center">30</td><td style="text-align:center">38.9</td><td style="text-align:center">37.5</td><td style="text-align:center">3.6</td></tr><tr style="border-bottom:1px solid #ff8a5c30"><td style="padding:6px; text-align:center">60</td><td style="text-align:center">22.5</td><td style="text-align:center">21.2</td><td style="text-align:center">5.8</td></tr><tr><td style="padding:6px; text-align:center">90</td><td style="text-align:center">0</td><td style="text-align:center">0.5</td><td style="text-align:center">—</td></tr></table>'
        ),
        contentSlide(
          'pe2-s4',
          c.background,
          c.primary,
          c.text,
          'Dạng sóng output',
          '<p>Chụp oscilloscope waveform tại các góc kích:</p><ul style="line-height:2"><li>α = 0°: gần giống chỉnh lưu diode</li><li>α = 30°: cắt 1/6 chu kỳ</li><li>α = 60°: cắt 1/3 chu kỳ, ripple lớn</li><li>α = 90°: V<sub>dc</sub> ≈ 0</li></ul><p style="font-style:italic; color:#ff8a5c80">Chèn ảnh chụp OSC vào đây</p>'
        ),
        contentSlide(
          'pe2-s5',
          c.background,
          c.primary,
          c.text,
          'Ảnh hưởng cuộn cảm tải',
          '<p><b>Tải R-L vs tải R:</b></p><ul style="line-height:2"><li>Cuộn cảm giữ dòng liên tục → V<sub>dc</sub> giảm ít hơn</li><li>$$V_{dc} = \\frac{2V_m}{\\pi} \\cos\\alpha$$ (dòng liên tục)</li><li>Ripple current giảm đáng kể</li><li>Cần diode freewheeling cho tải L lớn</li></ul>'
        ),
        contentSlide(
          'pe2-s6',
          c.background,
          c.primary,
          c.text,
          'Phân tích sai số',
          '<ul style="line-height:2"><li>V<sub>drop</sub> thyristor: ≈ 1.5V × 2 = 3V (2 thyristor dẫn đồng thời)</li><li>Commutation overlap: do L<sub>s</sub> nguồn</li><li>Sai số góc kích: ±2° do mạch trigger</li><li>DMM đo average, OSC xác nhận waveform</li></ul>'
        ),
        contentSlide(
          'pe2-s7',
          c.background,
          c.primary,
          c.text,
          'Kết luận',
          '<ul style="line-height:2"><li>V<sub>dc</sub> giảm khi tăng α → đúng lý thuyết</li><li>Tải R-L: dòng liên tục, ripple thấp hơn tải R</li><li>Sai số 3-6% do V<sub>drop</sub> thyristor và parasitics</li><li>Ứng dụng: điều khiển tốc độ DC motor, nguồn DC công nghiệp</li></ul>'
        ),
        qnaSlide('pe2-s8', c.background, c.primary, c.text),
      ]
    ),
    templateObj(
      'pelec-project-converter',
      'power-electronics',
      'Project — Thiết kế bộ biến đổi DC-DC',
      'Template đồ án thiết kế Buck/Boost converter. 9 slides.',
      ['project', 'buck', 'boost', 'converter', 'design'],
      'advanced',
      '160deg',
      c,
      [
        projectTitleSlide(
          'pe3-s1',
          c.background,
          c.primary,
          c.text,
          'Thiết kế bộ Buck Converter 12V/5V — 3A'
        ),
        contentSlide(
          'pe3-s2',
          c.background,
          c.primary,
          c.text,
          'Thông số thiết kế',
          '<ul style="line-height:2"><li><b>V<sub>in</sub>:</b> 10V – 14V (from battery)</li><li><b>V<sub>out</sub>:</b> 5V ± 2%</li><li><b>I<sub>out</sub>:</b> 0 – 3A</li><li><b>Ripple:</b> ΔV<sub>o</sub> < 50mV, ΔI<sub>L</sub> < 30% I<sub>out</sub></li><li><b>f<sub>sw</sub>:</b> 200 kHz</li><li><b>Hiệu suất:</b> > 90%</li></ul>'
        ),
        contentSlide(
          'pe3-s3',
          c.background,
          c.primary,
          c.text,
          'Tính toán thiết kế',
          '<p><b>Duty cycle:</b> D = V<sub>o</sub>/V<sub>in</sub> = 5/12 = 0.417</p><p><b>Cuộn cảm:</b></p><p style="text-align:center; font-size:20px">$$L = \\frac{(V_{in} - V_o) \\cdot D}{f_{sw} \\cdot \\Delta I_L} = \\frac{(12-5) \\times 0.417}{200k \\times 0.9} = 16.2\\mu H \\rightarrow 22\\mu H$$</p><p><b>Tụ output:</b></p><p style="text-align:center; font-size:20px">$$C = \\frac{\\Delta I_L}{8 f_{sw} \\Delta V_o} = \\frac{0.9}{8 \\times 200k \\times 0.05} = 11.25\\mu F \\rightarrow 22\\mu F$$</p>'
        ),
        contentSlide(
          'pe3-s4',
          c.background,
          c.primary,
          c.text,
          'Chọn linh kiện',
          '<table style="width:100%; border-collapse:collapse; font-size:17px"><tr style="border-bottom:2px solid #ff8a5c"><th style="padding:6px; text-align:left">Linh kiện</th><th>Part number</th><th>Key spec</th></tr><tr style="border-bottom:1px solid #ff8a5c30"><td style="padding:6px">MOSFET</td><td>IRF3205</td><td>55V, 110A, R<sub>DS</sub>=8mΩ</td></tr><tr style="border-bottom:1px solid #ff8a5c30"><td style="padding:6px">Diode</td><td>SS34</td><td>40V, 3A Schottky</td></tr><tr style="border-bottom:1px solid #ff8a5c30"><td style="padding:6px">Inductor</td><td>SER2211-223</td><td>22μH, 4A, shielded</td></tr><tr style="border-bottom:1px solid #ff8a5c30"><td style="padding:6px">Output cap</td><td>MLCC + Elec</td><td>22μF ceramic + 100μF</td></tr><tr><td style="padding:6px">Controller</td><td>TL494 / SG3525</td><td>PWM controller</td></tr></table>'
        ),
        contentSlide(
          'pe3-s5',
          c.background,
          c.primary,
          c.text,
          'Sơ đồ nguyên lý & PCB',
          '<p style="text-align:center; font-style:italic; color:#ff8a5c80">Chèn schematic & PCB layout vào đây</p><p style="margin-top:15px"><b>Layout guidelines:</b></p><ul><li>High-current loop nhỏ nhất có thể</li><li>Tụ bootstrap gần gate driver</li><li>Star ground: power ground vs signal ground</li><li>Sense traces: Kelvin connection</li></ul>'
        ),
        contentSlide(
          'pe3-s6',
          c.background,
          c.primary,
          c.text,
          'Kết quả đo kiểm',
          '<table style="width:100%; border-collapse:collapse; font-size:17px"><tr style="border-bottom:2px solid #ff8a5c"><th style="padding:6px; text-align:left">Thông số</th><th>Yêu cầu</th><th>Đo được</th><th>Kết quả</th></tr><tr style="border-bottom:1px solid #ff8a5c30"><td style="padding:6px">V<sub>out</sub></td><td style="text-align:center">5V ±2%</td><td style="text-align:center">4.98V</td><td style="text-align:center">✓</td></tr><tr style="border-bottom:1px solid #ff8a5c30"><td style="padding:6px">Ripple</td><td style="text-align:center"><50mV</td><td style="text-align:center">28mV</td><td style="text-align:center">✓</td></tr><tr style="border-bottom:1px solid #ff8a5c30"><td style="padding:6px">Efficiency @3A</td><td style="text-align:center">>90%</td><td style="text-align:center">92.3%</td><td style="text-align:center">✓</td></tr><tr><td style="padding:6px">Load regulation</td><td style="text-align:center"><2%</td><td style="text-align:center">0.8%</td><td style="text-align:center">✓</td></tr></table>'
        ),
        contentSlide(
          'pe3-s7',
          c.background,
          c.primary,
          c.text,
          'Thermal & EMC',
          '<p><b>Thermal:</b></p><ul><li>MOSFET: P<sub>d</sub> = I²·R<sub>DS</sub> = 9×0.008 = 72mW → không cần tản nhiệt</li><li>Diode: P<sub>d</sub> = V<sub>f</sub>·I·(1-D) = 0.4×3×0.583 = 0.7W → ấm nhẹ</li></ul><p><b>EMC:</b></p><ul><li>Conducted emission: cần input LC filter</li><li>Radiated: PCB shield + short loop</li></ul>'
        ),
        contentSlide(
          'pe3-s8',
          c.background,
          c.primary,
          c.text,
          'Cải tiến & Phát triển',
          '<ul style="line-height:2"><li>Synchronous buck: thay diode bằng MOSFET → η > 95%</li><li>Integrated solution: LM2596, MP2307</li><li>Digital control: MCU-based PID + adaptive frequency</li><li>GaN MOSFET: f<sub>sw</sub> > 1MHz → L,C nhỏ hơn</li></ul>'
        ),
        qnaSlide('pe3-s9', c.background, c.primary, c.text),
      ]
    ),
  ]
}

function genMechanicalTemplates() {
  const c = MECH
  return [
    templateObj(
      'mech-lecture-overview',
      'mechanical',
      'Bài giảng tổng quan — Chi tiết máy',
      'Template bài giảng về bánh răng, đai, trục, ổ lăn, bu lông. 10 slides.',
      ['gear', 'bearing', 'shaft', 'bolt', 'mechanical', 'lecture'],
      'intermediate',
      '135deg',
      c,
      [
        titleSlide(
          'mc1-s1',
          c.background,
          c.primary,
          c.text,
          'Chi tiết máy: Truyền động & Liên kết',
          'Giảng viên: ... · Lớp: ... · Ngày: ...'
        ),
        outlineSlide('mc1-s2', c.background, c.primary, c.text, [
          'Bánh răng',
          'Truyền động đai',
          'Trục & then',
          'Ổ lăn',
          'Bu lông',
          'Lò xo',
        ]),
        contentSlide(
          'mc1-s3',
          c.background,
          c.primary,
          c.text,
          'Truyền động bánh răng',
          '<p><b>Tỷ số truyền:</b></p><p style="text-align:center; font-size:24px; margin:15px 0">$$i = \\frac{n_1}{n_2} = \\frac{z_2}{z_1}$$</p><p><b>Phân loại:</b></p><ul><li>Bánh răng trụ: răng thẳng, răng nghiêng</li><li>Bánh răng côn: trục giao nhau</li><li>Trục vít - Bánh vít: tỷ số truyền lớn</li></ul><p><b>Hiệu suất:</b> 96-99% (trụ), 95-97% (côn), 40-85% (trục vít)</p>'
        ),
        contentSlide(
          'mc1-s4',
          c.background,
          c.primary,
          c.text,
          'Truyền động đai',
          '<p><b>Ưu điểm:</b> Êm, hấp thụ rung, bảo vệ quá tải</p><p><b>Loại đai:</b></p><ul><li>Đai dẹt: tốc độ cao, khoảng cách trục lớn</li><li>Đai V (hình thang): phổ biến nhất</li><li>Đai răng (timing belt): không trượt</li></ul><p><b>Công suất truyền:</b></p><p style="text-align:center; font-size:20px">$$P = (F_1 - F_2) \\cdot v$$</p><p>v = π·d·n/60000 (m/s)</p>'
        ),
        contentSlide(
          'mc1-s5',
          c.background,
          c.primary,
          c.text,
          'Trục & Then',
          '<p><b>Tính đường kính trục:</b></p><p style="text-align:center; font-size:22px; margin:15px 0">$$d \\geq \\sqrt[3]{\\frac{16M}{\\pi[\\tau]}}$$</p><p>[τ] = 15–30 MPa (thép C45)</p><p><b>Kiểm nghiệm trục:</b></p><p style="text-align:center; font-size:20px">$$\\sigma_{td} = \\sqrt{\\sigma^2 + 3\\tau^2} \\leq [\\sigma]$$</p><p><b>Then:</b> Truyền moment xoắn từ trục → bánh răng/pulley</p>'
        ),
        contentSlide(
          'mc1-s6',
          c.background,
          c.primary,
          c.text,
          'Ổ lăn (Rolling Bearing)',
          '<p><b>Tuổi thọ:</b></p><p style="text-align:center; font-size:22px; margin:15px 0">$$L_{10} = \\left(\\frac{C}{P}\\right)^p \\times 10^6 \\text{ vòng}$$</p><p>p = 3 (ổ bi), p = 10/3 (ổ đũa)</p><p><b>Phân loại:</b></p><ul><li>Ổ bi đỡ: chịu lực hướng tâm</li><li>Ổ bi chặn: chịu lực dọc trục</li><li>Ổ đũa côn: chịu cả hai</li></ul><p><b>Hãng:</b> SKF, NSK, FAG, NTN, Timken</p>'
        ),
        contentSlide(
          'mc1-s7',
          c.background,
          c.primary,
          c.text,
          'Mối ghép bu lông',
          '<p><b>Lực kẹp:</b></p><p>Siết bu lông tạo lực kẹp F<sub>0</sub></p><p><b>Bu lông chịu lực dọc trục:</b></p><p style="text-align:center; font-size:20px">$$F_b = F_0 + \\frac{k_b}{k_b + k_m} \\cdot F_{ext}$$</p><p>k<sub>b</sub>: độ cứng bu lông, k<sub>m</sub>: độ cứng tấm ghép</p><p><b>Ứng suất:</b> σ = F/A<sub>s</sub> (diện tích tiết diện ứng suất)</p><p><b>Moment siết:</b> T = K × d × F<sub>0</sub> (K ≈ 0.2)</p>'
        ),
        contentSlide(
          'mc1-s8',
          c.background,
          c.primary,
          c.text,
          'Lò xo',
          '<p><b>Lò xo nén/kéo:</b></p><p style="text-align:center; font-size:24px">$$F = k \\cdot x$$</p><p><b>Độ cứng lò xo trụ:</b></p><p style="text-align:center; font-size:20px">$$k = \\frac{G d^4}{8 D^3 n}$$</p><p>G: module đàn hồi trượt, d: đường kính dây, D: đường kính trung bình, n: số vòng</p><p><b>Ứng suất xoắn:</b> τ = K<sub>W</sub> × 8FD/(πd³)</p>'
        ),
        summarySlide('mc1-s9', c.background, c.primary, c.text, [
          'Bánh răng: i = z₂/z₁, hiệu suất cao',
          'Đai: êm, V-belt phổ biến, timing belt chính xác',
          'Trục: d ∝ ∛M, kiểm nghiệm σ<sub>td</sub>',
          'Ổ lăn: L₁₀ = (C/P)^p × 10⁶',
          'Bu lông: lực kẹp F₀, moment siết T',
          'Lò xo: F = kx, k = Gd⁴/(8D³n)',
        ]),
        qnaSlide('mc1-s10', c.background, c.primary, c.text),
      ]
    ),
    templateObj(
      'mech-lab-transmission',
      'mechanical',
      'Lab Report — Khảo sát cơ cấu truyền động',
      'Template TN đo tỷ số truyền, hiệu suất bánh răng/đai. 8 slides.',
      ['transmission', 'gear', 'belt', 'efficiency', 'lab'],
      'beginner',
      '180deg',
      c,
      [
        labTitleSlide(
          'mc2-s1',
          c.background,
          c.primary,
          c.text,
          'Khảo sát cơ cấu truyền động cơ khí'
        ),
        contentSlide(
          'mc2-s2',
          c.background,
          c.primary,
          c.text,
          'Mục đích & Thiết bị',
          '<ul style="font-size:20px; line-height:2"><li>Đo tỷ số truyền thực tế của hộp số 2 cấp</li><li>Đo hiệu suất truyền động đai V-belt</li><li>So sánh lý thuyết vs thực nghiệm</li><li><b>Thiết bị:</b> Bộ TN truyền động, tachometer, torque sensor, motor</li></ul>'
        ),
        contentSlide(
          'mc2-s3',
          c.background,
          c.primary,
          c.text,
          'TN1: Tỷ số truyền hộp số',
          '<table style="width:100%; border-collapse:collapse; font-size:17px"><tr style="border-bottom:2px solid #95adb6"><th style="padding:6px; text-align:left">Cấp</th><th>z₁</th><th>z₂</th><th>i lý thuyết</th><th>n₁ (rpm)</th><th>n₂ (rpm)</th><th>i thực tế</th></tr><tr style="border-bottom:1px solid #95adb630"><td style="padding:6px">I</td><td style="text-align:center">20</td><td style="text-align:center">60</td><td style="text-align:center">3.0</td><td style="text-align:center">1500</td><td style="text-align:center">498</td><td style="text-align:center">3.01</td></tr><tr><td style="padding:6px">II</td><td style="text-align:center">25</td><td style="text-align:center">50</td><td style="text-align:center">2.0</td><td style="text-align:center">498</td><td style="text-align:center">247</td><td style="text-align:center">2.02</td></tr></table><p style="margin-top:10px">i<sub>tổng</sub> = 3.01 × 2.02 = 6.08 (lý thuyết: 6.0)</p>'
        ),
        contentSlide(
          'mc2-s4',
          c.background,
          c.primary,
          c.text,
          'TN2: Hiệu suất truyền động đai',
          '<table style="width:100%; border-collapse:collapse; font-size:17px"><tr style="border-bottom:2px solid #95adb6"><th style="padding:6px">Tải (%)</th><th>P<sub>in</sub> (W)</th><th>P<sub>out</sub> (W)</th><th>η (%)</th></tr><tr style="border-bottom:1px solid #95adb630"><td style="padding:6px; text-align:center">25%</td><td style="text-align:center">120</td><td style="text-align:center">108</td><td style="text-align:center">90.0</td></tr><tr style="border-bottom:1px solid #95adb630"><td style="padding:6px; text-align:center">50%</td><td style="text-align:center">240</td><td style="text-align:center">222</td><td style="text-align:center">92.5</td></tr><tr style="border-bottom:1px solid #95adb630"><td style="padding:6px; text-align:center">75%</td><td style="text-align:center">360</td><td style="text-align:center">338</td><td style="text-align:center">93.9</td></tr><tr><td style="padding:6px; text-align:center">100%</td><td style="text-align:center">480</td><td style="text-align:center">446</td><td style="text-align:center">92.9</td></tr></table>'
        ),
        contentSlide(
          'mc2-s5',
          c.background,
          c.primary,
          c.text,
          'Phân tích kết quả',
          '<ul style="line-height:2"><li>Tỷ số truyền thực tế sai lệch < 1.5%</li><li>Hiệu suất đai V-belt: 90–94% → phù hợp lý thuyết (90–98%)</li><li>η<sub>max</sub> ở 75% tải → đúng với đặc tính đai</li><li>Giảm η ở full load do trượt đai tăng</li></ul>'
        ),
        contentSlide(
          'mc2-s6',
          c.background,
          c.primary,
          c.text,
          'Đồ thị',
          '<p>Vẽ đồ thị:</p><ul style="line-height:2"><li>η(%) vs Tải(%) → đỉnh ở 75%</li><li>Trượt(%) vs Tải(%) → tăng tuyến tính</li></ul><p style="font-style:italic; color:#95adb680">Chèn đồ thị Excel/MATLAB vào đây</p>'
        ),
        contentSlide(
          'mc2-s7',
          c.background,
          c.primary,
          c.text,
          'Kết luận',
          '<ul style="line-height:2"><li>Hộp số 2 cấp: tỷ số truyền ổn định, sai lệch < 2%</li><li>Đai V-belt: η ≈ 92%, phù hợp truyền công suất vừa</li><li>Cần bảo dưỡng: căng đai đúng lực, bôi trơn bánh răng</li></ul>'
        ),
        qnaSlide('mc2-s8', c.background, c.primary, c.text),
      ]
    ),
    templateObj(
      'mech-project-transmission',
      'mechanical',
      'Project — Thiết kế hệ thống truyền động',
      'Template đồ án thiết kế hộp số, bản vẽ, chế tạo. 9 slides.',
      ['project', 'gearbox', 'shaft', 'design', 'mechanical'],
      'advanced',
      '160deg',
      c,
      [
        projectTitleSlide(
          'mc3-s1',
          c.background,
          c.primary,
          c.text,
          'Thiết kế hộp giảm tốc 2 cấp bánh răng trụ'
        ),
        contentSlide(
          'mc3-s2',
          c.background,
          c.primary,
          c.text,
          'Thông số đầu vào',
          '<ul style="line-height:2"><li><b>Công suất:</b> P = 5.5 kW</li><li><b>Tốc độ motor:</b> n = 1450 rpm</li><li><b>Tỷ số truyền:</b> i = 12</li><li><b>Moment xoắn ra:</b> M = 432 N·m</li><li><b>Thời gian làm việc:</b> 5 năm, 2 ca/ngày</li></ul>'
        ),
        contentSlide(
          'mc3-s3',
          c.background,
          c.primary,
          c.text,
          'Phân phối tỷ số truyền',
          '<p><b>i<sub>tổng</sub> = i<sub>1</sub> × i<sub>2</sub> = 12</b></p><p>Phân phối theo tiêu chí nhỏ gọn:</p><ul><li>Cấp nhanh: i<sub>1</sub> = 4 (z<sub>1</sub>=20, z<sub>2</sub>=80)</li><li>Cấp chậm: i<sub>2</sub> = 3 (z<sub>3</sub>=25, z<sub>4</sub>=75)</li></ul><p><b>Module:</b> m<sub>1</sub> = 2mm (cấp nhanh), m<sub>2</sub> = 3mm (cấp chậm)</p><p>Vật liệu: Thép C45 tôi bề mặt, HRC 45–50</p>'
        ),
        contentSlide(
          'mc3-s4',
          c.background,
          c.primary,
          c.text,
          'Tính toán trục',
          '<p><b>Trục I (vào):</b></p><p>d<sub>I</sub> ≥ ∛(16×36.2/(π×20)) = 21.2mm → chọn d = 25mm</p><p><b>Trục II (trung gian):</b></p><p>d<sub>II</sub> = 35mm</p><p><b>Trục III (ra):</b></p><p>d<sub>III</sub> = 45mm</p><p><b>Kiểm nghiệm:</b> Vẽ biểu đồ M<sub>x</sub>, M<sub>y</sub>, M<sub>z</sub> → σ<sub>td</sub> ≤ [σ]</p>'
        ),
        contentSlide(
          'mc3-s5',
          c.background,
          c.primary,
          c.text,
          'Chọn ổ lăn & Then',
          '<p><b>Ổ lăn:</b></p><table style="width:100%; border-collapse:collapse; font-size:17px"><tr style="border-bottom:2px solid #95adb6"><th style="padding:6px; text-align:left">Trục</th><th>Ổ lăn</th><th>C (kN)</th><th>L<sub>h</sub> (giờ)</th></tr><tr style="border-bottom:1px solid #95adb630"><td style="padding:6px">I</td><td>6205</td><td style="text-align:center">14.8</td><td style="text-align:center">28,400</td></tr><tr style="border-bottom:1px solid #95adb630"><td style="padding:6px">II</td><td>6207</td><td style="text-align:center">25.5</td><td style="text-align:center">22,100</td></tr><tr><td style="padding:6px">III</td><td>6209</td><td style="text-align:center">33.2</td><td style="text-align:center">18,500</td></tr></table><p style="margin-top:10px"><b>Then:</b> Bằng, b×h = 8×7 (trục I), 10×8 (II), 14×9 (III)</p>'
        ),
        contentSlide(
          'mc3-s6',
          c.background,
          c.primary,
          c.text,
          'Bản vẽ lắp',
          '<p style="text-align:center; font-style:italic; color:#95adb680">Chèn bản vẽ lắp hộp giảm tốc vào đây</p><p style="margin-top:15px"><b>Nội dung bản vẽ:</b></p><ul><li>Hình chiếu đứng, bằng + cắt A-A</li><li>Bảng kê chi tiết (BOM)</li><li>Kích thước lắp, dung sai, độ nhám</li><li>Yêu cầu kỹ thuật</li></ul>'
        ),
        contentSlide(
          'mc3-s7',
          c.background,
          c.primary,
          c.text,
          'Bôi trơn & Vỏ hộp',
          '<p><b>Bôi trơn:</b></p><ul><li>Bánh răng: ngâm dầu (dầu CN 40)</li><li>Ổ lăn: mỡ (SKF LGMT 2)</li><li>Mức dầu: 1/3 – 2/3 bán kính bánh răng chậm</li></ul><p><b>Vỏ hộp:</b></p><ul><li>Vật liệu: Gang xám GX 15-32</li><li>Chia 2 nửa: nắp + thân</li><li>Bu lông nền: M16</li><li>Bu lông ghép: M12</li></ul>'
        ),
        contentSlide(
          'mc3-s8',
          c.background,
          c.primary,
          c.text,
          'Kết luận & Đánh giá',
          '<ul style="line-height:2"><li>Hộp giảm tốc đáp ứng yêu cầu: i=12, P=5.5kW</li><li>Tuổi thọ ổ lăn > 18,000 giờ (≈ 5 năm)</li><li>Ứng suất tại các tiết diện nguy hiểm: OK</li><li><b>Cải tiến:</b> Dùng phần mềm CAE (ANSYS) kiểm nghiệm bền, giảm khối lượng</li></ul>'
        ),
        qnaSlide('mc3-s9', c.background, c.primary, c.text),
      ]
    ),
  ]
}

function genDrawingTemplates() {
  const c = DRAW
  return [
    templateObj(
      'draw-lecture-overview',
      'technical-drawing',
      'Bài giảng tổng quan — Vẽ kỹ thuật',
      'Template bài giảng VKT: tiêu chuẩn, đường nét, hình chiếu, mặt cắt. 10 slides.',
      ['drawing', 'projection', 'section', 'dimension', 'lecture'],
      'beginner',
      '135deg',
      c,
      [
        titleSlide(
          'd1-s1',
          c.background,
          c.primary,
          c.text,
          'Vẽ kỹ thuật: Tiêu chuẩn & Phương pháp',
          'Giảng viên: ... · Lớp: ... · Ngày: ...'
        ),
        outlineSlide('d1-s2', c.background, c.primary, c.text, [
          'Tiêu chuẩn bản vẽ',
          'Các loại đường nét',
          'Hình chiếu vuông góc',
          'Hình chiếu trục đo',
          'Mặt cắt & Hình cắt',
          'Ghi kích thước',
        ]),
        contentSlide(
          'd1-s3',
          c.background,
          c.primary,
          c.text,
          'Tiêu chuẩn bản vẽ kỹ thuật',
          '<p><b>Khổ giấy (TCVN 2-74):</b></p><table style="width:80%; border-collapse:collapse; font-size:17px; margin:10px auto"><tr style="border-bottom:2px solid #8b7355"><th style="padding:6px">Khổ</th><th>Kích thước (mm)</th></tr><tr style="border-bottom:1px solid #8b735530"><td style="padding:6px; text-align:center">A0</td><td style="text-align:center">841 × 1189</td></tr><tr style="border-bottom:1px solid #8b735530"><td style="padding:6px; text-align:center">A1</td><td style="text-align:center">594 × 841</td></tr><tr style="border-bottom:1px solid #8b735530"><td style="padding:6px; text-align:center">A3</td><td style="text-align:center">297 × 420</td></tr><tr><td style="padding:6px; text-align:center">A4</td><td style="text-align:center">210 × 297</td></tr></table><p>Khung tên: góc phải dưới, 185×55mm</p><p>Tỷ lệ: 1:1, 1:2, 2:1, 1:5, 5:1...</p>'
        ),
        tableSlide(
          'd1-s4',
          c.background,
          c.primary,
          c.text,
          'Các loại đường nét',
          '<table style="width:100%; border-collapse:collapse"><tr style="border-bottom:2px solid #8b7355"><th style="padding:8px; text-align:left">Đường nét</th><th style="padding:8px">Hình dạng</th><th style="padding:8px">Ứng dụng</th></tr><tr style="border-bottom:1px solid #8b735530"><td style="padding:8px">Liền đậm</td><td style="padding:8px; text-align:center">━━━</td><td style="padding:8px">Cạnh thấy, đường bao thấy</td></tr><tr style="border-bottom:1px solid #8b735530"><td style="padding:8px">Liền mảnh</td><td style="padding:8px; text-align:center">───</td><td style="padding:8px">Đường kích thước, gióng</td></tr><tr style="border-bottom:1px solid #8b735530"><td style="padding:8px">Đứt ngắn</td><td style="padding:8px; text-align:center">- - -</td><td style="padding:8px">Cạnh khuất, đường bao khuất</td></tr><tr style="border-bottom:1px solid #8b735530"><td style="padding:8px">Chấm gạch mảnh</td><td style="padding:8px; text-align:center">─·─·─</td><td style="padding:8px">Đường tâm, đường trục</td></tr><tr><td style="padding:8px">Lượn sóng</td><td style="padding:8px; text-align:center">∿∿∿</td><td style="padding:8px">Đường cắt lìa</td></tr></table>'
        ),
        contentSlide(
          'd1-s5',
          c.background,
          c.primary,
          c.text,
          'Hình chiếu vuông góc',
          '<p><b>6 hướng chiếu:</b> Đứng, Bằng, Cạnh, Sau, Trên, Dưới</p><p><b>3 hình chiếu chính:</b></p><ul><li><b>Hình chiếu đứng:</b> nhìn từ trước (chính diện)</li><li><b>Hình chiếu bằng:</b> nhìn từ trên xuống</li><li><b>Hình chiếu cạnh:</b> nhìn từ bên trái</li></ul><p><b>Bố trí (phương pháp E):</b></p><p>HC Bằng ở dưới HC Đứng, HC Cạnh bên phải</p>'
        ),
        contentSlide(
          'd1-s6',
          c.background,
          c.primary,
          c.text,
          'Hình chiếu trục đo',
          '<p><b>Isometric (đẳng trắc):</b></p><ul><li>3 trục lệch 120°, hệ số biến dạng bằng nhau</li><li>p = q = r = 0.82 (thực dụng: dùng 1)</li></ul><p><b>Dimetric:</b></p><ul><li>2 hệ số bằng nhau, 1 khác</li></ul><p><b>Ứng dụng:</b> Hình biểu diễn trực quan, catalog sản phẩm</p>'
        ),
        contentSlide(
          'd1-s7',
          c.background,
          c.primary,
          c.text,
          'Mặt cắt & Hình cắt',
          '<p><b>Mặt cắt:</b> Chỉ vẽ phần vật thể bị mặt phẳng cắt cắt qua</p><p><b>Hình cắt:</b> Vẽ phần bị cắt + phần phía sau mặt phẳng cắt</p><p><b>Ký hiệu vật liệu (gạch mặt cắt):</b></p><ul><li>Kim loại: gạch chéo 45°, cách đều</li><li>Gỗ: vân gỗ</li><li>Bê tông: chấm + tam giác</li></ul><p><b>Quy ước:</b> Bu lông, trục, nan hoa không cắt dọc</p>'
        ),
        contentSlide(
          'd1-s8',
          c.background,
          c.primary,
          c.text,
          'Ghi kích thước',
          '<p><b>Quy tắc:</b></p><ul><li>Đủ: không thừa, không thiếu</li><li>Rõ ràng: không chồng chéo đường kích thước</li><li>Hợp lý: ghi ở hình chiếu rõ nhất</li></ul><p><b>Ký hiệu:</b></p><ul><li>Ø: đường kính, R: bán kính</li><li>□: cạnh vuông</li><li>Dung sai: Ø50 ± 0.05 hoặc Ø50H7</li><li>Độ nhám: Ra 1.6, Ra 3.2...</li></ul>'
        ),
        summarySlide('d1-s9', c.background, c.primary, c.text, [
          'Khổ giấy A0–A4, khung tên, tỷ lệ',
          '5 loại đường nét chính',
          '3 hình chiếu: đứng, bằng, cạnh',
          'Isometric: 3 trục lệch 120°',
          'Mặt cắt vs Hình cắt',
          'Ghi kích thước: đủ, rõ, hợp lý',
        ]),
        qnaSlide('d1-s10', c.background, c.primary, c.text),
      ]
    ),
    templateObj(
      'draw-lab-exercise',
      'technical-drawing',
      'Lab Report — Bài tập vẽ kỹ thuật',
      'Template bài tập vẽ hình chiếu, đọc bản vẽ. 8 slides.',
      ['drawing', 'projection', 'exercise', 'lab'],
      'beginner',
      '180deg',
      c,
      [
        labTitleSlide('d2-s1', c.background, c.primary, c.text, 'Bài tập thực hành Vẽ kỹ thuật'),
        contentSlide(
          'd2-s2',
          c.background,
          c.primary,
          c.text,
          'Yêu cầu bài tập',
          '<ul style="font-size:20px; line-height:2"><li><b>BT1:</b> Cho 2 hình chiếu → vẽ hình chiếu thứ 3</li><li><b>BT2:</b> Cho vật thể 3D → vẽ 3 hình chiếu</li><li><b>BT3:</b> Vẽ hình cắt A-A</li><li><b>BT4:</b> Ghi kích thước đầy đủ</li><li><b>Yêu cầu:</b> Giấy A3, bút chì 2H & HB, compa, thước T</li></ul>'
        ),
        contentSlide(
          'd2-s3',
          c.background,
          c.primary,
          c.text,
          'BT1: Vẽ hình chiếu thứ 3',
          '<p><b>Đề bài:</b> Cho hình chiếu đứng và hình chiếu bằng</p><p style="text-align:center; font-style:italic; color:#8b735580">Chèn hình đề bài vào đây</p><p><b>Phương pháp:</b></p><ol><li>Phân tích hình dạng vật thể từ 2 HC</li><li>Xác định các mặt, cạnh, lỗ</li><li>Dóng đường từ HC Đứng sang → HC Cạnh</li><li>Dùng đường 45° đưa kích thước từ HC Bằng lên</li></ol>'
        ),
        contentSlide(
          'd2-s4',
          c.background,
          c.primary,
          c.text,
          'BT2: 3D → 3 hình chiếu',
          '<p style="text-align:center; font-style:italic; color:#8b735580">Chèn hình vật thể 3D isometric vào đây</p><p style="margin-top:15px"><b>Trình tự vẽ:</b></p><ol><li>Chọn hướng chiếu chính (HC Đứng)</li><li>Vẽ khung bao ngoài</li><li>Vẽ các đường bao thấy (nét liền đậm)</li><li>Vẽ các đường bao khuất (nét đứt)</li><li>Vẽ đường tâm + đường trục</li></ol>'
        ),
        contentSlide(
          'd2-s5',
          c.background,
          c.primary,
          c.text,
          'BT3: Hình cắt A-A',
          '<p><b>Bước thực hiện:</b></p><ol style="line-height:2"><li>Xác định vị trí mặt phẳng cắt</li><li>Ký hiệu: mũi tên A↓ ─·─·─ ↓A</li><li>Vẽ phần vật thể bị cắt</li><li>Gạch mặt cắt (45°, cách 2mm)</li><li>Vẽ phần phía sau mặt cắt</li></ol><p><b>Lưu ý:</b> Bu lông, trục, gân → không gạch mặt cắt</p>'
        ),
        contentSlide(
          'd2-s6',
          c.background,
          c.primary,
          c.text,
          'BT4: Ghi kích thước',
          '<p><b>Nguyên tắc ghi:</b></p><ul style="line-height:2"><li>Khoảng cách đường kích thước đến bản vẽ: ≥ 10mm</li><li>Giữa các đường kích thước: ≥ 7mm</li><li>Mũi tên: nhọn, kín, dài ≈ 3mm</li><li>Số ghi: chính giữa, trên đường kích thước</li><li>Ghi từ chuẩn đo (base) ra ngoài</li></ul>'
        ),
        contentSlide(
          'd2-s7',
          c.background,
          c.primary,
          c.text,
          'Kết quả & Nhận xét',
          '<p style="text-align:center; font-style:italic; color:#8b735580">Chèn ảnh chụp bài vẽ hoàn chỉnh vào đây</p><p style="margin-top:15px"><b>Tiêu chí đánh giá:</b></p><ul><li>Đúng hình dạng: 40%</li><li>Đường nét chuẩn: 20%</li><li>Kích thước đầy đủ: 20%</li><li>Trình bày sạch đẹp: 20%</li></ul>'
        ),
        qnaSlide('d2-s8', c.background, c.primary, c.text),
      ]
    ),
    templateObj(
      'draw-project-product',
      'technical-drawing',
      'Project — Bản vẽ thiết kế sản phẩm',
      'Template đồ án bản vẽ: sketch, chi tiết, lắp, BOM. 9 slides.',
      ['project', 'product-design', 'assembly', 'bom', 'drawing'],
      'intermediate',
      '160deg',
      c,
      [
        projectTitleSlide(
          'd3-s1',
          c.background,
          c.primary,
          c.text,
          'Bản vẽ thiết kế sản phẩm cơ khí'
        ),
        contentSlide(
          'd3-s2',
          c.background,
          c.primary,
          c.text,
          'Ý tưởng & Phác thảo',
          '<p><b>Sản phẩm:</b> Bàn kẹp ê-tô mini cho khoan bàn</p><p><b>Yêu cầu:</b></p><ul><li>Khoảng mở: 0 – 60mm</li><li>Lực kẹp: 500N</li><li>Vật liệu: nhôm 6061 + thép C45</li></ul><p style="text-align:center; font-style:italic; color:#8b735580">Chèn sketch phác thảo vào đây</p>'
        ),
        contentSlide(
          'd3-s3',
          c.background,
          c.primary,
          c.text,
          'Bản vẽ chi tiết — Thân ê-tô',
          '<p style="text-align:center; font-style:italic; color:#8b735580">Chèn bản vẽ chi tiết thân vào đây</p><p style="margin-top:15px"><b>Nội dung:</b></p><ul><li>3 hình chiếu + hình cắt A-A</li><li>Kích thước đầy đủ + dung sai lắp ghép</li><li>Độ nhám bề mặt: Ra 3.2 (mặt kẹp), Ra 6.3 (còn lại)</li><li>Vật liệu: Nhôm 6061-T6</li></ul>'
        ),
        contentSlide(
          'd3-s4',
          c.background,
          c.primary,
          c.text,
          'Bản vẽ chi tiết — Trục vít kẹp',
          '<p style="text-align:center; font-style:italic; color:#8b735580">Chèn bản vẽ chi tiết trục vít vào đây</p><p style="margin-top:15px"><b>Thông số:</b></p><ul><li>Ren thang M12×1.75, dài 80mm</li><li>Vật liệu: Thép C45, tôi cải thiện</li><li>Dung sai: 6g (trục), 6H (lỗ ren)</li><li>Độ nhám ren: Ra 1.6</li></ul>'
        ),
        contentSlide(
          'd3-s5',
          c.background,
          c.primary,
          c.text,
          'Bản vẽ lắp',
          '<p style="text-align:center; font-style:italic; color:#8b735580">Chèn bản vẽ lắp hoàn chỉnh vào đây</p><p style="margin-top:15px"><b>Nội dung:</b></p><ul><li>Hình chiếu đứng (cắt) + hình chiếu bằng</li><li>Kích thước lắp: tổng thể, khoảng mở, lắp ghép</li><li>Đánh số chi tiết: 1→N</li><li>Yêu cầu kỹ thuật + điều kiện lắp</li></ul>'
        ),
        contentSlide(
          'd3-s6',
          c.background,
          c.primary,
          c.text,
          'Bảng kê chi tiết (BOM)',
          '<table style="width:100%; border-collapse:collapse; font-size:17px"><tr style="border-bottom:2px solid #8b7355"><th style="padding:6px">STT</th><th style="text-align:left">Tên chi tiết</th><th>Vật liệu</th><th>SL</th></tr><tr style="border-bottom:1px solid #8b735530"><td style="padding:6px; text-align:center">1</td><td>Thân cố định</td><td style="text-align:center">Al 6061</td><td style="text-align:center">1</td></tr><tr style="border-bottom:1px solid #8b735530"><td style="padding:6px; text-align:center">2</td><td>Má kẹp di động</td><td style="text-align:center">Al 6061</td><td style="text-align:center">1</td></tr><tr style="border-bottom:1px solid #8b735530"><td style="padding:6px; text-align:center">3</td><td>Trục vít kẹp</td><td style="text-align:center">C45</td><td style="text-align:center">1</td></tr><tr style="border-bottom:1px solid #8b735530"><td style="padding:6px; text-align:center">4</td><td>Tay quay</td><td style="text-align:center">C45</td><td style="text-align:center">1</td></tr><tr><td style="padding:6px; text-align:center">5</td><td>Bu lông M6×20</td><td style="text-align:center">8.8</td><td style="text-align:center">4</td></tr></table>'
        ),
        contentSlide(
          'd3-s7',
          c.background,
          c.primary,
          c.text,
          'Mô hình 3D CAD',
          '<p style="text-align:center; font-style:italic; color:#8b735580">Chèn render 3D từ SolidWorks/Inventor vào đây</p><p style="margin-top:15px"><b>Phần mềm:</b> SolidWorks 2024</p><ul><li>Part modeling: từng chi tiết</li><li>Assembly: lắp ráp + kiểm tra xung đột</li><li>Drawing: xuất bản vẽ 2D tự động</li><li>Simulation: FEA kiểm nghiệm bền</li></ul>'
        ),
        contentSlide(
          'd3-s8',
          c.background,
          c.primary,
          c.text,
          'Kết luận',
          '<ul style="line-height:2"><li>Bản vẽ chi tiết + lắp đầy đủ theo TCVN</li><li>Mô hình 3D CAD: hỗ trợ kiểm tra lắp ghép</li><li>Sản phẩm khả thi chế tạo bằng phay CNC</li><li><b>Cải tiến:</b> Quick-release mechanism, jaw coating</li></ul>'
        ),
        qnaSlide('d3-s9', c.background, c.primary, c.text),
      ]
    ),
  ]
}

function genFluidTemplates() {
  const c = FLUID
  return [
    templateObj(
      'fluid-lecture-overview',
      'fluid-mechanics',
      'Bài giảng tổng quan — Cơ học chất lỏng',
      'Template bài giảng thuỷ khí: áp suất, Bernoulli, tổn thất, bơm. 10 slides.',
      ['fluid', 'bernoulli', 'pressure', 'pump', 'lecture'],
      'intermediate',
      '135deg',
      c,
      [
        titleSlide(
          'f1-s1',
          c.background,
          c.primary,
          c.text,
          'Cơ học chất lỏng: Tĩnh học & Động học',
          'Giảng viên: ... · Lớp: ... · Ngày: ...'
        ),
        outlineSlide('f1-s2', c.background, c.primary, c.text, [
          'Tính chất chất lỏng',
          'Áp suất thuỷ tĩnh',
          'Phương trình Bernoulli',
          'Phương trình liên tục',
          'Tổn thất áp suất',
          'Bơm & Đặc tuyến',
        ]),
        contentSlide(
          'f1-s3',
          c.background,
          c.primary,
          c.text,
          'Tính chất chất lỏng',
          '<p><b>Khối lượng riêng:</b> ρ = m/V (kg/m³)</p><ul><li>Nước 20°C: ρ = 998 kg/m³</li><li>Dầu: ρ ≈ 850–920 kg/m³</li></ul><p><b>Độ nhớt động lực:</b> μ (Pa·s)</p><p><b>Độ nhớt động học:</b> ν = μ/ρ (m²/s)</p><p><b>Sức căng bề mặt:</b> σ (N/m) → mao dẫn, hình thành giọt</p><p><b>Số Reynolds:</b> Re = ρvD/μ → phân biệt chảy tầng/rối</p>'
        ),
        contentSlide(
          'f1-s4',
          c.background,
          c.primary,
          c.text,
          'Áp suất thuỷ tĩnh',
          '<p style="text-align:center; font-size:24px; margin:20px 0">$$p = p_0 + \\rho g h$$</p><p><b>Tính chất:</b></p><ul><li>Tác dụng vuông góc bề mặt</li><li>Tại 1 điểm: bằng nhau theo mọi hướng (Pascal)</li><li>Phụ thuộc độ sâu, không phụ thuộc hình dạng</li></ul><p><b>Lực tác dụng lên thành phẳng:</b></p><p style="text-align:center; font-size:20px">$$F = \\rho g h_c A$$</p><p>h<sub>c</sub>: độ sâu trọng tâm diện tích</p>'
        ),
        contentSlide(
          'f1-s5',
          c.background,
          c.primary,
          c.text,
          'Phương trình Bernoulli',
          '<p style="text-align:center; font-size:24px; margin:20px 0">$$\\frac{p}{\\rho g} + \\frac{v^2}{2g} + z = const$$</p><p><b>Ý nghĩa:</b></p><ul><li>p/ρg: cột áp suất (áp năng)</li><li>v²/2g: cột áp động (động năng)</li><li>z: cột áp vị trí (thế năng)</li></ul><p><b>Điều kiện:</b> Dòng chảy ổn định, không nén, không ma sát (lý tưởng)</p><p><b>Bernoulli thực tế:</b> thêm tổn thất h<sub>f</sub></p>'
        ),
        contentSlide(
          'f1-s6',
          c.background,
          c.primary,
          c.text,
          'Phương trình liên tục',
          '<p style="text-align:center; font-size:24px; margin:20px 0">$$A_1 v_1 = A_2 v_2 = Q$$</p><p>Q: lưu lượng thể tích (m³/s)</p><p><b>Ý nghĩa:</b> Tiết diện nhỏ → vận tốc lớn (và ngược lại)</p><p><b>Ứng dụng:</b></p><ul><li>Vòi phun: giảm A → tăng v</li><li>Ống Venturi: đo lưu lượng</li><li>Thiết kế đường ống: chọn φ phù hợp</li></ul>'
        ),
        contentSlide(
          'f1-s7',
          c.background,
          c.primary,
          c.text,
          'Tổn thất áp suất',
          '<p><b>Tổn thất dọc đường (Darcy-Weisbach):</b></p><p style="text-align:center; font-size:22px; margin:15px 0">$$h_f = f \\frac{L}{D} \\frac{v^2}{2g}$$</p><p>f: hệ số ma sát (tra biểu đồ Moody)</p><p><b>Tổn thất cục bộ:</b></p><p style="text-align:center; font-size:22px">$$h_m = K \\frac{v^2}{2g}$$</p><p>K: hệ số tổn thất (van, cua, mở rộng, thu hẹp)</p>'
        ),
        contentSlide(
          'f1-s8',
          c.background,
          c.primary,
          c.text,
          'Bơm — Đặc tuyến & Điểm làm việc',
          '<p><b>Đặc tuyến bơm:</b> H = f(Q) — đường cong giảm dần</p><p><b>Đặc tuyến hệ thống:</b></p><p style="text-align:center; font-size:20px">$$H_{sys} = H_{static} + h_f(Q)$$</p><p><b>Điểm làm việc:</b> Giao H<sub>pump</sub>(Q) và H<sub>sys</sub>(Q)</p><p><b>NPSH (Net Positive Suction Head):</b></p><p>NPSH<sub>a</sub> > NPSH<sub>r</sub> → tránh cavitation</p>'
        ),
        summarySlide('f1-s9', c.background, c.primary, c.text, [
          'ρ, μ, ν: tính chất cơ bản chất lỏng',
          'p = p₀ + ρgh: áp suất thuỷ tĩnh',
          'Bernoulli: bảo toàn năng lượng dòng chảy',
          'A₁v₁ = A₂v₂: liên tục',
          'hf = f(L/D)(v²/2g): Darcy-Weisbach',
          'Bơm: giao đặc tuyến bơm & hệ thống',
        ]),
        qnaSlide('f1-s10', c.background, c.primary, c.text),
      ]
    ),
    templateObj(
      'fluid-lab-flow',
      'fluid-mechanics',
      'Lab Report — Đo lưu lượng & tổn thất',
      'Template TN đo lưu lượng Venturi, tổn thất qua van. 8 slides.',
      ['flow', 'venturi', 'pressure-loss', 'lab', 'experiment'],
      'beginner',
      '180deg',
      c,
      [
        labTitleSlide(
          'f2-s1',
          c.background,
          c.primary,
          c.text,
          'Đo lưu lượng & Tổn thất trong ống'
        ),
        contentSlide(
          'f2-s2',
          c.background,
          c.primary,
          c.text,
          'Mục đích & Thiết bị',
          '<ul style="font-size:20px; line-height:2"><li>Đo lưu lượng bằng ống Venturi và rotameter</li><li>Đo tổn thất áp suất qua van, cua ống</li><li>Xác định hệ số tổn thất cục bộ K</li><li><b>Thiết bị:</b> Bộ TN thuỷ lực, manometer, rotameter, stopwatch</li></ul>'
        ),
        contentSlide(
          'f2-s3',
          c.background,
          c.primary,
          c.text,
          'TN1: Đo lưu lượng — Venturi',
          '<p><b>Nguyên lý:</b> Bernoulli + liên tục</p><p style="text-align:center; font-size:20px">$$Q = C_d A_2 \\sqrt{\\frac{2g \\Delta h}{1 - (A_2/A_1)^2}}$$</p><table style="width:100%; border-collapse:collapse; font-size:17px; margin-top:10px"><tr style="border-bottom:2px solid #48bfe3"><th style="padding:6px">Lần</th><th>Δh (cm)</th><th>Q<sub>Venturi</sub> (L/min)</th><th>Q<sub>thùng</sub> (L/min)</th><th>C<sub>d</sub></th></tr><tr style="border-bottom:1px solid #48bfe330"><td style="padding:6px; text-align:center">1</td><td style="text-align:center">5.2</td><td style="text-align:center">12.8</td><td style="text-align:center">12.3</td><td style="text-align:center">0.96</td></tr><tr><td style="padding:6px; text-align:center">2</td><td style="text-align:center">12.5</td><td style="text-align:center">19.8</td><td style="text-align:center">19.0</td><td style="text-align:center">0.96</td></tr></table>'
        ),
        contentSlide(
          'f2-s4',
          c.background,
          c.primary,
          c.text,
          'TN2: Tổn thất qua van & cua ống',
          '<table style="width:100%; border-collapse:collapse; font-size:17px"><tr style="border-bottom:2px solid #48bfe3"><th style="padding:6px; text-align:left">Phần tử</th><th>Δp (Pa)</th><th>v (m/s)</th><th>K đo</th><th>K lý thuyết</th></tr><tr style="border-bottom:1px solid #48bfe330"><td style="padding:6px">Van cầu (mở 100%)</td><td style="text-align:center">1850</td><td style="text-align:center">1.2</td><td style="text-align:center">2.57</td><td style="text-align:center">2.5</td></tr><tr style="border-bottom:1px solid #48bfe330"><td style="padding:6px">Cua 90°</td><td style="text-align:center">520</td><td style="text-align:center">1.2</td><td style="text-align:center">0.72</td><td style="text-align:center">0.7</td></tr><tr><td style="padding:6px">Thu hẹp đột ngột</td><td style="text-align:center">380</td><td style="text-align:center">1.8</td><td style="text-align:center">0.23</td><td style="text-align:center">0.25</td></tr></table>'
        ),
        contentSlide(
          'f2-s5',
          c.background,
          c.primary,
          c.text,
          'Đồ thị & Phân tích',
          '<p><b>Đồ thị 1:</b> Q vs √Δh (Venturi) → tuyến tính ✓</p><p><b>Đồ thị 2:</b> Δp vs v² (tổn thất) → tuyến tính ✓</p><p><b>Nhận xét:</b></p><ul style="line-height:2"><li>C<sub>d</sub> Venturi ≈ 0.96 → phù hợp (0.95–0.98)</li><li>K đo sai lệch < 5% so với lý thuyết</li><li>Van cầu: K lớn nhất → tổn thất cao</li></ul>'
        ),
        contentSlide(
          'f2-s6',
          c.background,
          c.primary,
          c.text,
          'Nguồn sai số',
          '<ul style="line-height:2"><li>Manometer: đọc mức chất lỏng ±1mm</li><li>Rotameter: ±2% full scale</li><li>Dòng chảy chưa ổn định hoàn toàn</li><li>Rò rỉ nhỏ tại khớp nối</li><li>Nhiệt độ nước thay đổi → ρ, μ thay đổi</li></ul>'
        ),
        contentSlide(
          'f2-s7',
          c.background,
          c.primary,
          c.text,
          'Kết luận',
          '<ul style="line-height:2"><li>Ống Venturi: phương pháp đo lưu lượng chính xác, ít tổn thất</li><li>Tổn thất cục bộ phụ thuộc v² → thiết kế ống cần tránh thay đổi tiết diện đột ngột</li><li>Van cầu gây tổn thất lớn → ưu tiên van bướm cho lưu lượng lớn</li></ul>'
        ),
        qnaSlide('f2-s8', c.background, c.primary, c.text),
      ]
    ),
    templateObj(
      'fluid-project-piping',
      'fluid-mechanics',
      'Project — Thiết kế hệ thống đường ống',
      'Template đồ án thiết kế đường ống: pipe sizing, pump selection. 9 slides.',
      ['piping', 'pump', 'pipe-sizing', 'control-valve', 'project'],
      'advanced',
      '160deg',
      c,
      [
        projectTitleSlide(
          'f3-s1',
          c.background,
          c.primary,
          c.text,
          'Thiết kế hệ thống cấp nước cho toà nhà'
        ),
        contentSlide(
          'f3-s2',
          c.background,
          c.primary,
          c.text,
          'Thông số thiết kế',
          '<ul style="line-height:2"><li><b>Toà nhà:</b> 10 tầng, 40 căn hộ</li><li><b>Nhu cầu:</b> 200 lít/người/ngày × 4 người = 32 m³/ngày</li><li><b>Lưu lượng giờ cao điểm:</b> Q = 5.3 m³/h</li><li><b>Áp lực yêu cầu tại tầng 10:</b> 15 mH₂O</li><li><b>Chiều cao:</b> 30m (3m/tầng)</li></ul>'
        ),
        contentSlide(
          'f3-s3',
          c.background,
          c.primary,
          c.text,
          'Chọn đường kính ống',
          '<p><b>Phương pháp:</b> Giới hạn vận tốc v = 1.5–2.5 m/s</p><p style="text-align:center; font-size:22px; margin:15px 0">$$D = \\sqrt{\\frac{4Q}{\\pi v}}$$</p><p>Q = 5.3/3600 = 1.47×10⁻³ m³/s, v = 2 m/s</p><p>D = √(4×1.47e-3/(π×2)) = 30.6mm → chọn DN32 (PPR)</p><p><b>Ống nhánh (mỗi tầng):</b> DN25</p><p><b>Ống vào căn hộ:</b> DN20</p>'
        ),
        contentSlide(
          'f3-s4',
          c.background,
          c.primary,
          c.text,
          'Tính tổn thất áp suất',
          '<p><b>Tổn thất dọc đường:</b></p><p>f = 0.025 (Re ≈ 60,000, PPR ε = 0.007mm)</p><p>$$h_f = 0.025 \\times \\frac{35}{0.032} \\times \\frac{2^2}{2 \\times 9.81} = 5.6 \\text{ mH}_2\\text{O}$$</p><p><b>Tổn thất cục bộ:</b></p><p>10 cua 90° (K=0.7) + 5 van (K=0.3) + fittings</p><p>h<sub>m</sub> ≈ 2.8 mH₂O</p><p><b>Tổng cột áp bơm:</b> H = 30 + 15 + 5.6 + 2.8 = 53.4 m</p>'
        ),
        contentSlide(
          'f3-s5',
          c.background,
          c.primary,
          c.text,
          'Chọn bơm',
          '<p><b>Yêu cầu:</b> Q = 5.3 m³/h, H = 53.4 m</p><p><b>Bơm chọn:</b> Grundfos CR 3-17 (centrifugal multistage)</p><ul><li>Q<sub>nom</sub>: 3–6 m³/h</li><li>H<sub>max</sub>: 58 m</li><li>P: 2.2 kW, 3 pha 380V</li><li>η: 65%</li></ul><p><b>NPSH check:</b></p><p>NPSH<sub>a</sub> = 10.3 − 1.5 − 0.5 = 8.3m > NPSH<sub>r</sub> = 2.5m ✓</p>'
        ),
        contentSlide(
          'f3-s6',
          c.background,
          c.primary,
          c.text,
          'Sơ đồ hệ thống',
          '<p style="text-align:center; font-style:italic; color:#48bfe380">Chèn sơ đồ đường ống P&ID vào đây</p><p style="margin-top:15px"><b>Hệ thống:</b></p><ul><li>Bể ngầm 20m³ → Bơm → Bể mái 10m³</li><li>Tự động: phao điện bể mái → on/off bơm</li><li>Van 1 chiều: chống dòng ngược</li><li>PRV (Pressure Reducing Valve): tầng 1-3</li></ul>'
        ),
        contentSlide(
          'f3-s7',
          c.background,
          c.primary,
          c.text,
          'Biện pháp tiết kiệm nước',
          '<ul style="line-height:2"><li>Đồng hồ nước từng căn hộ</li><li>Vòi sen tiết kiệm: 6 L/min (thay vì 12)</li><li>Bồn cầu 2 nút: 3/6 lít</li><li>Tái sử dụng nước mưa cho tưới cây</li><li>BMS monitoring: phát hiện rò rỉ</li></ul>'
        ),
        contentSlide(
          'f3-s8',
          c.background,
          c.primary,
          c.text,
          'Kết luận & Dự toán',
          '<p><b>Dự toán:</b></p><ul><li>Bơm + tủ điện: 35 triệu</li><li>Ống PPR + phụ kiện: 60 triệu</li><li>Bể inox mái: 25 triệu</li><li>Thi công: 30 triệu</li><li><b>Tổng: ≈ 150 triệu VNĐ</b></li></ul><p><b>Kết luận:</b> Hệ thống đảm bảo áp lực, lưu lượng, an toàn. Chi phí hợp lý cho toà nhà 10 tầng.</p>'
        ),
        qnaSlide('f3-s9', c.background, c.primary, c.text),
      ]
    ),
  ]
}

// ══════════════════════════════════════════════════════
// MAIN: Merge all templates
// ══════════════════════════════════════════════════════

const filePath = path.join(__dirname, '..', 'server', 'data', 'built-in-templates.json')
const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'))
console.log(`Existing templates: ${existing.length}`)

const newTemplates = [
  ...genElectronicsTemplates(),
  ...genAutomationTemplates(),
  ...genElectricalTemplates(),
  ...genMeasurementTemplates(),
  ...genPowerElecTemplates(),
  ...genMechanicalTemplates(),
  ...genDrawingTemplates(),
  ...genFluidTemplates(),
]

console.log(`New templates: ${newTemplates.length}`)
const merged = [...existing, ...newTemplates]
console.log(`Total: ${merged.length}`)

// Verify no duplicate IDs
const ids = merged.map((t) => t.id)
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
if (dupes.length) {
  console.error('DUPLICATE IDs:', dupes)
  process.exit(1)
}

// Category breakdown
const cats = {}
merged.forEach((t) => {
  cats[t.category] = (cats[t.category] || 0) + 1
})
console.log('By category:', JSON.stringify(cats, null, 2))

fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf8')
console.log(`Written to ${filePath}`)
console.log(`File size: ${(fs.statSync(filePath).size / 1024).toFixed(1)} KB`)
