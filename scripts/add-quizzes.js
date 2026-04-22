/* eslint-env node */
const fs = require('fs')
const path = require('path')

const BUILT_IN_PATH = path.join(__dirname, 'server', 'data', 'built-in-templates.json')

const quizzes = [
  {
    id: 'quiz-multiple-choice',
    category: 'quiz',
    title: 'Multiple Choice Quiz',
    titleVi: 'Trắc nghiệm nhiều lựa chọn',
    description: 'Interactive 4-option multiple choice quiz with instant feedback.',
    tags: ['quiz', 'multiple-choice', 'assessment'],
    thumbnail: 'quiz-mcq.png',
    theme: 'dracula',
    transition: 'fade',
    slides: [
      {
        id: 'slide-1',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-1',
            type: 'text',
            x: 80,
            y: 200,
            width: 800,
            height: 100,
            zIndex: 1,
            content: '<h1 style="text-align:center">Bài kiểm tra trắc nghiệm</h1>',
          },
        ],
      },
      {
        id: 'slide-2',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-quiz-1',
            type: 'html',
            x: 80,
            y: 80,
            width: 800,
            height: 500,
            zIndex: 1,
            content: `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; background: transparent; color: white; padding: 20px; font-size: 24px; }
  .question { margin-bottom: 30px; font-weight: bold; font-size: 32px; }
  .option { padding: 15px 20px; margin: 10px 0; border: 2px solid rgba(255,255,255,0.2); border-radius: 8px; cursor: pointer; transition: 0.2s; background: rgba(255,255,255,0.05); }
  .option:hover { border-color: #6366f1; background: rgba(99,102,241,0.1); }
  .option.correct { border-color: #22c55e; background: rgba(34,197,94,0.15); }
  .option.wrong { border-color: #ef4444; background: rgba(239,68,68,0.15); }
  .feedback { margin-top: 20px; padding: 15px; border-radius: 8px; display: none; font-weight: bold; }
  .feedback.success { background: rgba(34,197,94,0.2); color: #4ade80; border: 1px solid #22c55e; display: block; }
  .feedback.error { background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid #ef4444; display: block; }
</style>
</head>
<body>
  <div class="question">Câu 1: Định luật Ohm được biểu diễn bằng công thức nào?</div>
  <div id="options">
    <div class="option" onclick="check(this, false)">A. P = U × I</div>
    <div class="option" onclick="check(this, true)">B. U = I × R</div>
    <div class="option" onclick="check(this, false)">C. F = m × a</div>
    <div class="option" onclick="check(this, false)">D. E = mc²</div>
  </div>
  <div id="fb" class="feedback"></div>

<script>
  let answered = false;
  function check(el, isCorrect) {
    if (answered) return;
    answered = true;
    
    // Highlight all options
    const opts = document.querySelectorAll('.option');
    opts.forEach(o => {
      if (o.innerText.startsWith('B.')) o.classList.add('correct');
    });

    const fb = document.getElementById('fb');
    if (isCorrect) {
      el.classList.add('correct');
      fb.textContent = '✅ Chính xác! U = I × R là công thức của định luật Ohm.';
      fb.className = 'feedback success';
    } else {
      el.classList.add('wrong');
      fb.textContent = '❌ Sai rồi. Đáp án đúng là B.';
      fb.className = 'feedback error';
    }
  }
</script>
</body>
</html>`,
          },
        ],
      },
      {
        id: 'slide-3',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-quiz-2',
            type: 'html',
            x: 80,
            y: 80,
            width: 800,
            height: 500,
            zIndex: 1,
            content: `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; background: transparent; color: white; padding: 20px; font-size: 24px; }
  .question { margin-bottom: 30px; font-weight: bold; font-size: 32px; }
  .option { padding: 15px 20px; margin: 10px 0; border: 2px solid rgba(255,255,255,0.2); border-radius: 8px; cursor: pointer; transition: 0.2s; background: rgba(255,255,255,0.05); }
  .option:hover { border-color: #6366f1; background: rgba(99,102,241,0.1); }
  .option.correct { border-color: #22c55e; background: rgba(34,197,94,0.15); }
  .option.wrong { border-color: #ef4444; background: rgba(239,68,68,0.15); }
  .feedback { margin-top: 20px; padding: 15px; border-radius: 8px; display: none; font-weight: bold; }
  .feedback.success { background: rgba(34,197,94,0.2); color: #4ade80; border: 1px solid #22c55e; display: block; }
  .feedback.error { background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid #ef4444; display: block; }
</style>
</head>
<body>
  <div class="question">Câu 2: Số thập phân 10 chuyển sang hệ nhị phân là gì?</div>
  <div id="options">
    <div class="option" onclick="check(this, true)">A. 1010</div>
    <div class="option" onclick="check(this, false)">B. 1100</div>
    <div class="option" onclick="check(this, false)">C. 1001</div>
    <div class="option" onclick="check(this, false)">D. 0101</div>
  </div>
  <div id="fb" class="feedback"></div>

<script>
  let answered = false;
  function check(el, isCorrect) {
    if (answered) return;
    answered = true;
    
    const opts = document.querySelectorAll('.option');
    opts.forEach(o => {
      if (o.innerText.startsWith('A.')) o.classList.add('correct');
    });

    const fb = document.getElementById('fb');
    if (isCorrect) {
      el.classList.add('correct');
      fb.textContent = '✅ Chính xác! 10 = 8 + 2 = 1010 (nhị phân).';
      fb.className = 'feedback success';
    } else {
      el.classList.add('wrong');
      fb.textContent = '❌ Sai rồi. Đáp án đúng là A.';
      fb.className = 'feedback error';
    }
  }
</script>
</body>
</html>`,
          },
        ],
      },
      {
        id: 'slide-4',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-text',
            type: 'text',
            x: 80,
            y: 150,
            width: 800,
            height: 200,
            zIndex: 1,
            content:
              '<h2 style="text-align:center">Kết thúc phần kiểm tra</h2><p style="text-align:center; margin-top: 20px;">Giáo viên có thể sử dụng các template này để đánh giá nhanh mức độ hiểu bài của học viên ngay trong quá trình giảng dạy.</p>',
          },
        ],
      },
    ],
  },
  {
    id: 'quiz-true-false',
    category: 'quiz',
    title: 'True/False Quiz',
    titleVi: 'Trắc nghiệm Đúng/Sai',
    description: 'Multiple True/False statements with live score calculation.',
    tags: ['quiz', 'true-false', 'assessment'],
    thumbnail: 'quiz-tf.png',
    theme: 'dracula',
    transition: 'fade',
    slides: [
      {
        id: 'slide-1',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-1',
            type: 'text',
            x: 80,
            y: 200,
            width: 800,
            height: 100,
            zIndex: 1,
            content: '<h1 style="text-align:center">Đúng hay Sai?</h1>',
          },
        ],
      },
      {
        id: 'slide-2',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-tf-1',
            type: 'html',
            x: 80,
            y: 50,
            width: 800,
            height: 550,
            zIndex: 1,
            content: `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: system-ui; color: white; margin: 0; padding: 10px; background: transparent; font-size: 20px; }
  .row { display: flex; align-items: center; justify-content: space-between; padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); }
  .statement { flex: 1; padding-right: 20px; }
  .actions { display: flex; gap: 10px; }
  button { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 16px; background: #374151; color: white; transition: 0.2s; }
  button:hover { background: #4b5563; }
  button.true.selected { background: #22c55e; }
  button.false.selected { background: #ef4444; }
  .submit-btn { display: block; width: 100%; margin-top: 30px; padding: 15px; background: #6366f1; font-size: 20px; border-radius: 8px; }
  .submit-btn:hover { background: #4f46e5; }
  .result { display: none; margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; }
</style>
</head>
<body>
  <div id="quiz">
    <div class="row">
      <div class="statement">1. Trái Đất xoay quanh Mặt Trời.</div>
      <div class="actions">
        <button class="true" onclick="select(this, 1, true)">Đúng</button>
        <button class="false" onclick="select(this, 1, false)">Sai</button>
      </div>
    </div>
    <div class="row">
      <div class="statement">2. Nước sôi ở 100°C trong mọi điều kiện áp suất.</div>
      <div class="actions">
        <button class="true" onclick="select(this, 2, true)">Đúng</button>
        <button class="false" onclick="select(this, 2, false)">Sai</button>
      </div>
    </div>
    <div class="row">
      <div class="statement">3. Ánh sáng di chuyển nhanh hơn âm thanh.</div>
      <div class="actions">
        <button class="true" onclick="select(this, 3, true)">Đúng</button>
        <button class="false" onclick="select(this, 3, false)">Sai</button>
      </div>
    </div>
    <div class="row">
      <div class="statement">4. CPU là bộ nhớ chính của máy tính.</div>
      <div class="actions">
        <button class="true" onclick="select(this, 4, true)">Đúng</button>
        <button class="false" onclick="select(this, 4, false)">Sai</button>
      </div>
    </div>
    <button class="submit-btn" onclick="submit()">Hoàn thành</button>
  </div>
  <div id="res" class="result"></div>

<script>
  const answers = { 1: null, 2: null, 3: null, 4: null };
  const correct = { 1: true, 2: false, 3: true, 4: false };

  function select(btn, qId, val) {
    const parent = btn.parentElement;
    parent.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    answers[qId] = val;
  }

  function submit() {
    let score = 0;
    for(let i=1; i<=4; i++) {
      if (answers[i] === correct[i]) score++;
    }
    const res = document.getElementById('res');
    res.style.display = 'block';
    res.innerHTML = \`Bạn đã trả lời đúng \${score}/4 câu.\`;
    
    // Highlight correct/incorrect rows
    const rows = document.querySelectorAll('.row');
    for(let i=1; i<=4; i++) {
      if (answers[i] === correct[i]) rows[i-1].style.borderLeft = '5px solid #22c55e';
      else rows[i-1].style.borderLeft = '5px solid #ef4444';
    }
  }
</script>
</body>
</html>`,
          },
        ],
      },
      {
        id: 'slide-4',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-text',
            type: 'text',
            x: 80,
            y: 150,
            width: 800,
            height: 200,
            zIndex: 1,
            content:
              '<h2>Giải thích</h2><ul><li><b>Câu 2 sai:</b> Nước sôi ở 100°C ở áp suất khí quyển chuẩn, nhưng ở vùng núi cao áp suất thấp, nước sôi ở nhiệt độ thấp hơn.</li><li><b>Câu 4 sai:</b> CPU là bộ vi xử lý trung tâm, RAM mới là bộ nhớ chính.</li></ul>',
          },
        ],
      },
    ],
  },
  {
    id: 'quiz-fill-blank',
    category: 'quiz',
    title: 'Fill in the Blank',
    titleVi: 'Điền vào chỗ trống',
    description: 'Paragraph with input fields for learners to type in the correct words.',
    tags: ['quiz', 'fill-blank', 'assessment'],
    thumbnail: 'quiz-blank.png',
    theme: 'dracula',
    transition: 'fade',
    slides: [
      {
        id: 'slide-1',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-1',
            type: 'text',
            x: 80,
            y: 200,
            width: 800,
            height: 100,
            zIndex: 1,
            content: '<h1 style="text-align:center">Điền vào chỗ trống</h1>',
          },
        ],
      },
      {
        id: 'slide-2',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-fb-1',
            type: 'html',
            x: 80,
            y: 80,
            width: 800,
            height: 400,
            zIndex: 1,
            content: `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: system-ui; color: white; margin: 0; padding: 20px; background: transparent; font-size: 24px; line-height: 2; }
  input { font-size: 24px; padding: 5px 10px; border: none; border-bottom: 2px solid #6366f1; background: rgba(255,255,255,0.1); color: #fbbf24; text-align: center; width: 150px; font-weight: bold; border-radius: 4px 4px 0 0; }
  input:focus { outline: none; background: rgba(255,255,255,0.2); }
  input.correct { border-bottom-color: #22c55e; color: #22c55e; }
  input.wrong { border-bottom-color: #ef4444; color: #ef4444; }
  .btn { display: block; margin-top: 40px; padding: 12px 24px; background: #6366f1; color: white; border: none; border-radius: 6px; font-size: 20px; font-weight: bold; cursor: pointer; }
  .btn:hover { background: #4f46e5; }
</style>
</head>
<body>
  <div>
    Internet là một mạng lưới máy tính toàn cầu kết nối với nhau sử dụng bộ giao thức <input type="text" id="q1" placeholder="...">. Hệ thống này bao gồm hàng triệu mạng tư nhân, công cộng, học thuật, doanh nghiệp và chính phủ, được liên kết bởi một mảng rộng lớn các công nghệ mạng điện tử, <input type="text" id="q2" placeholder="..."> và quang học.
  </div>
  <button class="btn" onclick="check()">Kiểm tra</button>

<script>
  function check() {
    const q1 = document.getElementById('q1');
    const q2 = document.getElementById('q2');
    
    const ans1 = q1.value.trim().toLowerCase();
    const ans2 = q2.value.trim().toLowerCase();
    
    if (ans1 === 'tcp/ip' || ans1 === 'tcp ip') {
      q1.className = 'correct';
    } else {
      q1.className = 'wrong';
    }
    
    if (ans2 === 'không dây' || ans2 === 'khong day' || ans2 === 'wireless') {
      q2.className = 'correct';
    } else {
      q2.className = 'wrong';
    }
  }
</script>
</body>
</html>`,
          },
        ],
      },
      {
        id: 'slide-3',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-text',
            type: 'text',
            x: 80,
            y: 150,
            width: 800,
            height: 200,
            zIndex: 1,
            content:
              '<h2>Đáp án</h2><ul><li>Ô 1: <b>TCP/IP</b></li><li>Ô 2: <b>không dây</b></li></ul>',
          },
        ],
      },
    ],
  },
  {
    id: 'quiz-ordering',
    category: 'quiz',
    title: 'Sequence Ordering',
    titleVi: 'Sắp xếp thứ tự',
    description: 'Click items to order them sequentially.',
    tags: ['quiz', 'ordering', 'sequence'],
    thumbnail: 'quiz-order.png',
    theme: 'dracula',
    transition: 'fade',
    slides: [
      {
        id: 'slide-1',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-1',
            type: 'text',
            x: 80,
            y: 200,
            width: 800,
            height: 100,
            zIndex: 1,
            content: '<h1 style="text-align:center">Sắp xếp chu trình</h1>',
          },
        ],
      },
      {
        id: 'slide-2',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-ord-1',
            type: 'html',
            x: 80,
            y: 80,
            width: 800,
            height: 450,
            zIndex: 1,
            content: `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: system-ui; color: white; margin: 0; padding: 20px; background: transparent; }
  .item { display: flex; align-items: center; background: rgba(255,255,255,0.1); margin-bottom: 15px; padding: 15px; border-radius: 8px; cursor: pointer; transition: 0.2s; border: 2px solid transparent; }
  .item:hover { background: rgba(255,255,255,0.15); }
  .num { width: 40px; height: 40px; border-radius: 50%; background: #374151; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; margin-right: 20px; }
  .item.selected { border-color: #6366f1; background: rgba(99,102,241,0.1); }
  .item.selected .num { background: #6366f1; }
  .item.correct { border-color: #22c55e; background: rgba(34,197,94,0.1); }
  .item.correct .num { background: #22c55e; }
  .item.wrong { border-color: #ef4444; background: rgba(239,68,68,0.1); }
  .item.wrong .num { background: #ef4444; }
  .controls { display: flex; gap: 15px; margin-top: 30px; }
  button { padding: 12px 24px; border: none; border-radius: 6px; font-size: 18px; font-weight: bold; cursor: pointer; }
  .btn-check { background: #10b981; color: white; }
  .btn-reset { background: #6b7280; color: white; }
</style>
</head>
<body>
  <h3 style="margin-bottom: 20px;">Sắp xếp các bước phát triển phần mềm (SDLC): Click theo thứ tự</h3>
  <div id="list">
    <div class="item" onclick="select(this)" data-correct="2"><div class="num"></div><div>Thiết kế (Design)</div></div>
    <div class="item" onclick="select(this)" data-correct="5"><div class="num"></div><div>Bảo trì (Maintenance)</div></div>
    <div class="item" onclick="select(this)" data-correct="1"><div class="num"></div><div>Phân tích yêu cầu (Requirement Analysis)</div></div>
    <div class="item" onclick="select(this)" data-correct="4"><div class="num"></div><div>Kiểm thử (Testing)</div></div>
    <div class="item" onclick="select(this)" data-correct="3"><div class="num"></div><div>Lập trình (Implementation)</div></div>
  </div>
  <div class="controls">
    <button class="btn-check" onclick="check()">Kiểm tra</button>
    <button class="btn-reset" onclick="reset()">Làm lại</button>
  </div>

<script>
  let currentStep = 1;

  function select(el) {
    if (el.classList.contains('selected') || el.classList.contains('correct') || el.classList.contains('wrong')) return;
    el.classList.add('selected');
    el.dataset.user = currentStep;
    el.querySelector('.num').textContent = currentStep;
    currentStep++;
  }

  function check() {
    const items = document.querySelectorAll('.item');
    items.forEach(el => {
      if (!el.dataset.user) return;
      el.classList.remove('selected');
      if (el.dataset.user === el.dataset.correct) {
        el.classList.add('correct');
      } else {
        el.classList.add('wrong');
      }
    });
  }

  function reset() {
    currentStep = 1;
    const items = document.querySelectorAll('.item');
    items.forEach(el => {
      el.className = 'item';
      delete el.dataset.user;
      el.querySelector('.num').textContent = '';
    });
  }
</script>
</body>
</html>`,
          },
        ],
      },
      {
        id: 'slide-3',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-text',
            type: 'text',
            x: 80,
            y: 150,
            width: 800,
            height: 300,
            zIndex: 1,
            content:
              '<h2>Đáp án đúng</h2><ol style="margin-top:20px; font-size:28px; line-height: 1.8;"><li>Phân tích yêu cầu</li><li>Thiết kế</li><li>Lập trình</li><li>Kiểm thử</li><li>Bảo trì</li></ol>',
          },
        ],
      },
    ],
  },
  {
    id: 'quiz-matching',
    category: 'quiz',
    title: 'Match the Pairs',
    titleVi: 'Nối cặp tương ứng',
    description: 'Match items from the left column to the right column.',
    tags: ['quiz', 'matching', 'assessment'],
    thumbnail: 'quiz-match.png',
    theme: 'dracula',
    transition: 'fade',
    slides: [
      {
        id: 'slide-1',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-1',
            type: 'text',
            x: 80,
            y: 200,
            width: 800,
            height: 100,
            zIndex: 1,
            content: '<h1 style="text-align:center">Nối khái niệm</h1>',
          },
        ],
      },
      {
        id: 'slide-2',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-match-1',
            type: 'html',
            x: 40,
            y: 40,
            width: 880,
            height: 500,
            zIndex: 1,
            content: `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: system-ui; color: white; margin: 0; padding: 20px; background: transparent; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; position: relative; }
  .col { display: flex; flex-direction: column; gap: 20px; }
  .box { padding: 15px; background: rgba(255,255,255,0.05); border: 2px solid rgba(255,255,255,0.2); border-radius: 8px; cursor: pointer; transition: 0.2s; text-align: center; font-weight: bold; }
  .box:hover { background: rgba(255,255,255,0.1); border-color: #9ca3af; }
  .box.selected { border-color: #3b82f6; background: rgba(59,130,246,0.2); box-shadow: 0 0 10px rgba(59,130,246,0.5); }
  .box.matched { border-color: #10b981; background: rgba(16,185,129,0.1); cursor: default; }
  svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: -1; }
  line { stroke: #3b82f6; stroke-width: 4; stroke-linecap: round; }
  line.matched { stroke: #10b981; }
  .win { display: none; text-align: center; color: #10b981; font-size: 24px; font-weight: bold; margin-top: 30px; }
</style>
</head>
<body>
  <h3 style="margin-bottom: 30px; text-align: center;">Nối ngôn ngữ lập trình với đặc điểm nổi bật</h3>
  <div class="grid" id="grid">
    <svg id="svg"></svg>
    <div class="col" id="colA">
      <div class="box" id="a1" data-match="b3">Python</div>
      <div class="box" id="a2" data-match="b1">JavaScript</div>
      <div class="box" id="a3" data-match="b2">C++</div>
      <div class="box" id="a4" data-match="b4">SQL</div>
    </div>
    <div class="col" id="colB">
      <div class="box" id="b1">Chạy trên trình duyệt web</div>
      <div class="box" id="b2">Hiệu năng cao, dùng làm game engine</div>
      <div class="box" id="b3">Cú pháp dễ đọc, phổ biến trong AI</div>
      <div class="box" id="b4">Truy vấn và thao tác cơ sở dữ liệu</div>
    </div>
  </div>
  <div class="win" id="win">🎉 Chúc mừng bạn đã hoàn thành!</div>

<script>
  let selA = null, selB = null;
  let matches = 0;
  
  const boxesA = document.querySelectorAll('#colA .box');
  const boxesB = document.querySelectorAll('#colB .box');
  const svg = document.getElementById('svg');

  boxesA.forEach(b => b.addEventListener('click', () => handleSelect(b, 'A')));
  boxesB.forEach(b => b.addEventListener('click', () => handleSelect(b, 'B')));

  function handleSelect(box, col) {
    if (box.classList.contains('matched')) return;

    if (col === 'A') {
      if (selA) selA.classList.remove('selected');
      selA = box;
      selA.classList.add('selected');
    } else {
      if (selB) selB.classList.remove('selected');
      selB = box;
      selB.classList.add('selected');
    }

    if (selA && selB) {
      if (selA.dataset.match === selB.id) {
        // Match!
        selA.classList.remove('selected'); selB.classList.remove('selected');
        selA.classList.add('matched'); selB.classList.add('matched');
        drawLine(selA, selB, 'matched');
        selA = null; selB = null;
        matches++;
        if (matches === 4) document.getElementById('win').style.display = 'block';
      } else {
        // Wrong
        setTimeout(() => {
          if(selA) selA.classList.remove('selected');
          if(selB) selB.classList.remove('selected');
          selA = null; selB = null;
        }, 500);
      }
    }
  }

  function drawLine(el1, el2, className) {
    const r1 = el1.getBoundingClientRect();
    const r2 = el2.getBoundingClientRect();
    const gridR = document.getElementById('grid').getBoundingClientRect();
    
    const x1 = r1.right - gridR.left;
    const y1 = r1.top + r1.height/2 - gridR.top;
    const x2 = r2.left - gridR.left;
    const y2 = r2.top + r2.height/2 - gridR.top;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('class', className);
    svg.appendChild(line);
  }
</script>
</body>
</html>`,
          },
        ],
      },
    ],
  },
  {
    id: 'viz-dashboard',
    category: 'corporate',
    title: 'Business Dashboard',
    titleVi: 'Bảng điều khiển kinh doanh',
    description: 'Data dashboard with KPI cards and embedded Chart.js visualizations.',
    tags: ['dashboard', 'chart', 'kpi', 'data'],
    thumbnail: 'viz-dash.png',
    theme: 'dracula',
    transition: 'slide',
    slides: [
      {
        id: 'slide-1',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-1',
            type: 'text',
            x: 80,
            y: 200,
            width: 800,
            height: 100,
            zIndex: 1,
            content: '<h1 style="text-align:center">Q3 Performance Dashboard</h1>',
          },
        ],
      },
      {
        id: 'slide-2',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-dash-1',
            type: 'html',
            x: 20,
            y: 20,
            width: 920,
            height: 500,
            zIndex: 1,
            content: `<!DOCTYPE html>
<html>
<head>
<script src="vendor/chart.js/dist/chart.umd.js"></script>
<style>
  body { font-family: system-ui; color: white; margin: 0; padding: 10px; background: transparent; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
  .kpi { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; }
  .kpi-title { font-size: 14px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; }
  .kpi-val { font-size: 32px; font-weight: bold; margin: 5px 0; }
  .kpi-sub { font-size: 12px; color: #10b981; }
  .chart-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; height: 320px; }
  .chart-card { background: rgba(0,0,0,0.2); border-radius: 8px; padding: 15px; }
  canvas { width: 100% !important; height: 100% !important; }
</style>
</head>
<body>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-title">Revenue</div><div class="kpi-val">$45,231</div><div class="kpi-sub">↑ +12.5% vs Q2</div></div>
    <div class="kpi"><div class="kpi-title">Users</div><div class="kpi-val">12.4K</div><div class="kpi-sub">↑ +4.2% vs Q2</div></div>
    <div class="kpi"><div class="kpi-title">Conversion</div><div class="kpi-val">3.2%</div><div class="kpi-sub" style="color:#ef4444">↓ -0.5% vs Q2</div></div>
    <div class="kpi"><div class="kpi-title">CAC</div><div class="kpi-val">$24.5</div><div class="kpi-sub">↑ +1.1% vs Q2</div></div>
  </div>
  <div class="chart-grid">
    <div class="chart-card"><canvas id="barChart"></canvas></div>
    <div class="chart-card"><canvas id="pieChart"></canvas></div>
  </div>

<script>
  // Wait for Chart.js to load (in case network is slow)
  function initCharts() {
    if (typeof Chart === 'undefined') {
      setTimeout(initCharts, 50);
      return;
    }
    
    Chart.defaults.color = '#9ca3af';
    Chart.defaults.font.family = 'system-ui';

    new Chart(document.getElementById('barChart'), {
      type: 'bar',
      data: {
        labels: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [{
          label: 'Revenue 2026',
          data: [12000, 15000, 14000, 18000, 22000, 28000],
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, title: { display: true, text: 'Monthly Revenue', color: '#fff' } },
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.1)' } },
          x: { grid: { display: false } }
        }
      }
    });

    new Chart(document.getElementById('pieChart'), {
      type: 'doughnut',
      data: {
        labels: ['Direct', 'Social', 'Referral'],
        datasets: [{
          data: [55, 30, 15],
          backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: 'Traffic Sources', color: '#fff' }
        }
      }
    });
  }
  
  initCharts();
</script>
</body>
</html>`,
          },
        ],
      },
      {
        id: 'slide-3',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-text',
            type: 'text',
            x: 80,
            y: 150,
            width: 800,
            height: 300,
            zIndex: 1,
            content:
              '<h2>Key Insights</h2><ul><li>Revenue grew consistently month-over-month, ending Q3 strongly at <b>$45,231</b>.</li><li>Direct traffic remains our primary acquisition channel (55%), followed by Social (30%).</li><li>While revenue is up, our conversion rate dropped slightly. Focus for Q4 will be on funnel optimization.</li></ul>',
          },
        ],
      },
    ],
  },
  {
    id: 'viz-trend-report',
    category: 'academic',
    title: 'Trend Analysis Chart',
    titleVi: 'Báo cáo xu hướng',
    description: 'Line chart visualization for trend reporting and analysis.',
    tags: ['trend', 'chart', 'line', 'data'],
    thumbnail: 'viz-trend.png',
    theme: 'dracula',
    transition: 'slide',
    slides: [
      {
        id: 'slide-1',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-1',
            type: 'text',
            x: 80,
            y: 200,
            width: 800,
            height: 100,
            zIndex: 1,
            content: '<h1 style="text-align:center">Global Temperature Anomalies</h1>',
          },
        ],
      },
      {
        id: 'slide-2',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-trend-1',
            type: 'html',
            x: 40,
            y: 40,
            width: 880,
            height: 480,
            zIndex: 1,
            content: `<!DOCTYPE html>
<html>
<head>
<script src="vendor/chart.js/dist/chart.umd.js"></script>
<style>
  body { font-family: system-ui; margin: 0; padding: 0; background: transparent; overflow: hidden; }
  .chart-container { height: 480px; width: 100%; padding: 20px; box-sizing: border-box; background: rgba(0,0,0,0.2); border-radius: 12px; }
  canvas { width: 100% !important; height: 100% !important; }
</style>
</head>
<body>
  <div class="chart-container">
    <canvas id="lineChart"></canvas>
  </div>

<script>
  function initChart() {
    if (typeof Chart === 'undefined') { setTimeout(initChart, 50); return; }
    
    Chart.defaults.color = '#9ca3af';
    Chart.defaults.font.family = 'system-ui';

    const ctx = document.getElementById('lineChart').getContext('2d');
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(239, 68, 68, 0.5)'); // Red at top
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)'); // Transparent at bottom

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['1980', '1985', '1990', '1995', '2000', '2005', '2010', '2015', '2020', '2025'],
        datasets: [{
          label: 'Anomaly (°C)',
          data: [0.27, 0.12, 0.44, 0.45, 0.42, 0.69, 0.73, 0.90, 1.02, 1.18],
          borderColor: '#ef4444',
          backgroundColor: gradient,
          borderWidth: 3,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#ef4444',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4 // smooth curves
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Global Temperature Anomaly vs 1850-1900 Average', color: '#fff', font: { size: 18 } }
        },
        scales: {
          y: { 
            grid: { color: 'rgba(255,255,255,0.1)' },
            title: { display: true, text: 'Temperature Anomaly (°C)' }
          },
          x: { 
            grid: { display: false }
          }
        }
      }
    });
  }
  initChart();
</script>
</body>
</html>`,
          },
        ],
      },
      {
        id: 'slide-3',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-text',
            type: 'text',
            x: 80,
            y: 150,
            width: 800,
            height: 300,
            zIndex: 1,
            content:
              '<h2>Analysis</h2><p>The chart clearly demonstrates an accelerating upward trend in global temperature anomalies since 1980.</p><p>Key observations:</p><ul><li>Temperatures have consistently stayed above the pre-industrial baseline.</li><li>The rate of increase has visibly steepened post-2000.</li><li>The anomaly surpassed +1.0°C in the most recent decade.</li></ul>',
          },
        ],
      },
    ],
  },
  {
    id: 'viz-comparison-chart',
    category: 'engineering',
    title: 'Grouped Comparison',
    titleVi: 'Biểu đồ so sánh',
    description: 'Grouped bar charts for side-by-side metric comparison.',
    tags: ['chart', 'comparison', 'bar', 'engineering'],
    thumbnail: 'viz-compare.png',
    theme: 'dracula',
    transition: 'slide',
    slides: [
      {
        id: 'slide-1',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-1',
            type: 'text',
            x: 80,
            y: 200,
            width: 800,
            height: 100,
            zIndex: 1,
            content: '<h1 style="text-align:center">Material Properties Comparison</h1>',
          },
        ],
      },
      {
        id: 'slide-2',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-comp-1',
            type: 'html',
            x: 40,
            y: 40,
            width: 880,
            height: 480,
            zIndex: 1,
            content: `<!DOCTYPE html>
<html>
<head>
<script src="vendor/chart.js/dist/chart.umd.js"></script>
<style>
  body { font-family: system-ui; margin: 0; padding: 0; background: transparent; overflow: hidden; }
  .chart-container { height: 480px; width: 100%; padding: 20px; box-sizing: border-box; background: rgba(0,0,0,0.2); border-radius: 12px; }
  canvas { width: 100% !important; height: 100% !important; }
</style>
</head>
<body>
  <div class="chart-container">
    <canvas id="barChart"></canvas>
  </div>

<script>
  function initChart() {
    if (typeof Chart === 'undefined') { setTimeout(initChart, 50); return; }
    
    Chart.defaults.color = '#9ca3af';
    Chart.defaults.font.family = 'system-ui';

    new Chart(document.getElementById('barChart'), {
      type: 'bar',
      data: {
        labels: ['Steel', 'Aluminum', 'Titanium', 'Carbon Fiber'],
        datasets: [
          {
            label: 'Tensile Strength (MPa)',
            data: [400, 276, 900, 1600],
            backgroundColor: '#3b82f6',
            borderRadius: 4
          },
          {
            label: 'Density (g/cm³)',
            data: [7.8, 2.7, 4.5, 1.6],
            backgroundColor: '#10b981',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: '#fff' } },
          title: { display: true, text: 'Strength vs Density (Not to scale)', color: '#fff', font: { size: 16 } }
        },
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.1)' } },
          x: { grid: { display: false } }
        }
      }
    });
  }
  initChart();
</script>
</body>
</html>`,
          },
        ],
      },
      {
        id: 'slide-3',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-table',
            type: 'text',
            x: 80,
            y: 80,
            width: 800,
            height: 400,
            zIndex: 1,
            content: `<h2>Data Table</h2>
<table style="width:100%; border-collapse: collapse; margin-top: 30px; font-size: 24px;">
  <thead style="background: rgba(255,255,255,0.1);">
    <tr>
      <th style="padding:15px; border: 1px solid #4b5563;">Material</th>
      <th style="padding:15px; border: 1px solid #4b5563;">Tensile Strength (MPa)</th>
      <th style="padding:15px; border: 1px solid #4b5563;">Density (g/cm³)</th>
      <th style="padding:15px; border: 1px solid #4b5563;">Specific Strength</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="padding:15px; border: 1px solid #4b5563;">Steel</td><td style="padding:15px; border: 1px solid #4b5563; text-align:center;">400</td><td style="padding:15px; border: 1px solid #4b5563; text-align:center;">7.8</td><td style="padding:15px; border: 1px solid #4b5563; text-align:center;">51</td></tr>
    <tr><td style="padding:15px; border: 1px solid #4b5563;">Aluminum</td><td style="padding:15px; border: 1px solid #4b5563; text-align:center;">276</td><td style="padding:15px; border: 1px solid #4b5563; text-align:center;">2.7</td><td style="padding:15px; border: 1px solid #4b5563; text-align:center;">102</td></tr>
    <tr><td style="padding:15px; border: 1px solid #4b5563;">Titanium</td><td style="padding:15px; border: 1px solid #4b5563; text-align:center;">900</td><td style="padding:15px; border: 1px solid #4b5563; text-align:center;">4.5</td><td style="padding:15px; border: 1px solid #4b5563; text-align:center;">200</td></tr>
    <tr><td style="padding:15px; border: 1px solid #4b5563;">Carbon Fiber</td><td style="padding:15px; border: 1px solid #4b5563; text-align:center;">1600</td><td style="padding:15px; border: 1px solid #4b5563; text-align:center;">1.6</td><td style="padding:15px; border: 1px solid #4b5563; text-align:center;">1000</td></tr>
  </tbody>
</table>`,
          },
        ],
      },
    ],
  },
]

// Append to built-in-templates.json
fs.readFile(BUILT_IN_PATH, 'utf-8', (err, data) => {
  if (err) {
    console.error('Error reading JSON:', err)
    return
  }
  try {
    const templates = JSON.parse(data)

    // Filter out existing ones with the same IDs
    const quizIds = quizzes.map((s) => s.id)
    const filteredTemplates = templates.filter((t) => !quizIds.includes(t.id))

    const newTemplates = [...filteredTemplates, ...quizzes]

    fs.writeFileSync(BUILT_IN_PATH, JSON.stringify(newTemplates, null, 2), 'utf-8')
    console.log(`Successfully added ${quizzes.length} quiz/viz templates.`)
  } catch (e) {
    console.error('Error parsing JSON:', e)
  }
})
