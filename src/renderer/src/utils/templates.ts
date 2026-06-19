export interface Template {
  id: string
  name: string
  description: string
  icon: string
  category: 'game' | 'web' | 'utility' | 'learning'
  language: 'html' | 'javascript' | 'python'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
  files: { name: string; content: string }[]
}

// NOTE: All inner JS uses string concat (not backticks) to avoid nested template literal issues

const SNAKE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><title>Snake Game</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#1e1e2e;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:monospace;color:#cdd6f4}
    h1{color:#a6e3a1;margin-bottom:8px;font-size:24px}
    #score{color:#f9e2af;margin-bottom:12px;font-size:16px}
    canvas{border:2px solid #89b4fa;border-radius:4px}
    #msg{margin-top:12px;color:#f38ba8;font-size:14px;min-height:20px}
  </style>
</head>
<body>
  <h1>Snake</h1>
  <div id="score">Score: 0 | Best: 0</div>
  <canvas id="c" width="400" height="400"></canvas>
  <div id="msg">Press any arrow key to start</div>
<script>
const C=document.getElementById('c'),ctx=C.getContext('2d');
const SZ=20,COLS=20;
let snake,dir,food,score,best=0,running=false,loop;
function init(){
  snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}];
  dir={x:1,y:0};score=0;
  placeFood();running=true;
  document.getElementById('msg').textContent='';
  clearInterval(loop);loop=setInterval(tick,120);
}
function placeFood(){
  do{food={x:Math.floor(Math.random()*COLS),y:Math.floor(Math.random()*COLS)};}
  while(snake.some(function(s){return s.x===food.x&&s.y===food.y;}));
}
function tick(){
  var head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
  if(head.x<0||head.x>=COLS||head.y<0||head.y>=COLS||snake.some(function(s){return s.x===head.x&&s.y===head.y;})){
    clearInterval(loop);running=false;best=Math.max(best,score);
    document.getElementById('msg').textContent='Game Over! Score: '+score;return;
  }
  snake.unshift(head);
  if(head.x===food.x&&head.y===food.y){score++;if(score>best)best=score;placeFood();}
  else snake.pop();
  document.getElementById('score').textContent='Score: '+score+' | Best: '+best;
  draw();
}
function draw(){
  ctx.fillStyle='#1e1e2e';ctx.fillRect(0,0,400,400);
  ctx.strokeStyle='#313244';
  for(var i=0;i<=COLS;i++){ctx.beginPath();ctx.moveTo(i*SZ,0);ctx.lineTo(i*SZ,400);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*SZ);ctx.lineTo(400,i*SZ);ctx.stroke();}
  ctx.fillStyle='#f38ba8';ctx.beginPath();ctx.arc(food.x*SZ+SZ/2,food.y*SZ+SZ/2,SZ/2-2,0,Math.PI*2);ctx.fill();
  snake.forEach(function(s,i){
    ctx.fillStyle=i===0?'#a6e3a1':'hsl(142,70%,'+(50-i*1.5)+'%)';
    ctx.fillRect(s.x*SZ+1,s.y*SZ+1,SZ-2,SZ-2);
  });
}
document.addEventListener('keydown',function(e){
  if(!running){init();return;}
  var map={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}};
  if(map[e.key]&&!(map[e.key].x===-dir.x&&map[e.key].y===-dir.y)){dir=map[e.key];e.preventDefault();}
});
draw();
</script>
</body></html>`

const CALCULATOR_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Calculator</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#1e1e2e;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,sans-serif}
.calc{background:#181825;border-radius:20px;padding:16px;width:280px;box-shadow:0 20px 60px rgba(0,0,0,0.5)}
.display{background:#11111b;border-radius:12px;padding:16px;margin-bottom:12px;text-align:right}
.expr{color:#6c7086;font-size:13px;min-height:20px;word-break:break-all}
.result{color:#cdd6f4;font-size:36px;font-weight:300;word-break:break-all}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
button{border:none;border-radius:12px;font-size:18px;padding:16px 8px;cursor:pointer;transition:all .1s;font-weight:500}
button:active{transform:scale(0.95)}
.op{background:#89b4fa;color:#1e1e2e}.eq{background:#a6e3a1;color:#1e1e2e}
.cl{background:#f38ba8;color:#1e1e2e}.num{background:#313244;color:#cdd6f4}
.zero{grid-column:span 2}.fn{background:#45475a;color:#cdd6f4}
</style></head>
<body><div class="calc">
<div class="display"><div class="expr" id="expr"></div><div class="result" id="res">0</div></div>
<div class="grid">
  <button class="cl" onclick="cl()">AC</button>
  <button class="fn" onclick="neg()">+/-</button>
  <button class="fn" onclick="pct()">%</button>
  <button class="op" onclick="op('/')">div</button>
  <button class="num" onclick="num('7')">7</button>
  <button class="num" onclick="num('8')">8</button>
  <button class="num" onclick="num('9')">9</button>
  <button class="op" onclick="op('*')">x</button>
  <button class="num" onclick="num('4')">4</button>
  <button class="num" onclick="num('5')">5</button>
  <button class="num" onclick="num('6')">6</button>
  <button class="op" onclick="op('-')">-</button>
  <button class="num" onclick="num('1')">1</button>
  <button class="num" onclick="num('2')">2</button>
  <button class="num" onclick="num('3')">3</button>
  <button class="op" onclick="op('+')">+</button>
  <button class="num zero" onclick="num('0')">0</button>
  <button class="num" onclick="dot()">.</button>
  <button class="eq" onclick="eq()">=</button>
</div></div>
<script>
var cur='0',prev='',operator='',newNum=true;
var R=document.getElementById('res'),E=document.getElementById('expr');
function update(){R.textContent=cur.length>10?parseFloat(cur).toExponential(4):cur;}
function num(n){if(newNum){cur=n;newNum=false;}else{cur=cur==='0'?n:cur+n;}update();}
function dot(){if(newNum){cur='0.';newNum=false;}else if(!cur.includes('.'))cur+='.';update();}
function op(o){if(operator&&!newNum)eq();prev=cur;operator=o;newNum=true;E.textContent=cur+' '+o;}
function eq(){if(!operator||!prev)return;var a=parseFloat(prev),b=parseFloat(cur),r;
  if(operator==='+')r=a+b;else if(operator==='-')r=a-b;else if(operator==='*')r=a*b;else r=a/b;
  E.textContent=prev+operator+cur+'=';cur=String(parseFloat(r.toFixed(10)));operator='';newNum=true;update();}
function cl(){cur='0';prev='';operator='';newNum=true;E.textContent='';update();}
function neg(){cur=String(-parseFloat(cur));update();}
function pct(){cur=String(parseFloat(cur)/100);update();}
document.addEventListener('keydown',function(e){
  if(e.key>='0'&&e.key<='9')num(e.key);
  if(e.key==='.')dot();
  if(['+','-','*','/'].includes(e.key))op(e.key);
  if(e.key==='Enter'||e.key==='=')eq();
  if(e.key==='Escape')cl();
  if(e.key==='Backspace'){cur=cur.length>1?cur.slice(0,-1):'0';update();}
});
</script></body></html>`

const TODO_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Todo App</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#1e1e2e;min-height:100vh;font-family:'Segoe UI',sans-serif;padding:32px 16px;color:#cdd6f4}
.app{max-width:520px;margin:auto}
h1{color:#cba6f7;font-size:28px;margin-bottom:20px}
.input-row{display:flex;gap:8px;margin-bottom:16px}
input[type=text]{flex:1;padding:10px 14px;border-radius:10px;border:1px solid #313244;background:#181825;color:#cdd6f4;font-size:14px;outline:none}
input[type=text]:focus{border-color:#89b4fa}
select{padding:10px;border-radius:10px;border:1px solid #313244;background:#181825;color:#cdd6f4;font-size:13px;outline:none}
.add-btn{padding:10px 18px;background:#89b4fa;color:#1e1e2e;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer}
.filters{display:flex;gap:6px;margin-bottom:12px}
.filter{padding:6px 14px;border-radius:8px;border:1px solid #313244;background:transparent;color:#6c7086;font-size:12px;cursor:pointer}
.filter.active{background:#89b4fa;color:#1e1e2e;border-color:#89b4fa}
.todo-list{display:flex;flex-direction:column;gap:6px}
.todo{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#181825;border-radius:10px;border:1px solid #313244}
.todo.done{opacity:0.5}
.todo.done .text{text-decoration:line-through;color:#6c7086}
.check{width:20px;height:20px;border-radius:50%;border:2px solid #45475a;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.check.done{background:#a6e3a1;border-color:#a6e3a1;color:#1e1e2e;font-size:12px}
.text{flex:1;font-size:14px}
.badge{font-size:10px;padding:2px 8px;border-radius:999px;font-weight:600}
.high{background:#f38ba888;color:#f38ba8}.med{background:#f9e2af88;color:#f9e2af}.low{background:#a6e3a188;color:#a6e3a1}
.del{background:none;border:none;color:#6c7086;cursor:pointer;font-size:16px;padding:2px 6px;border-radius:4px}
.del:hover{color:#f38ba8}
.stats{text-align:center;color:#6c7086;font-size:12px;margin-top:12px}
</style></head>
<body>
<div class="app">
  <h1>Todo App</h1>
  <div class="input-row">
    <input type="text" id="inp" placeholder="Add a task...">
    <select id="pri"><option value="med">Medium</option><option value="high">High</option><option value="low">Low</option></select>
    <button class="add-btn" onclick="add()">Add</button>
  </div>
  <div class="filters">
    <button class="filter active" onclick="setFilter('all',this)">All</button>
    <button class="filter" onclick="setFilter('active',this)">Active</button>
    <button class="filter" onclick="setFilter('done',this)">Done</button>
  </div>
  <div class="todo-list" id="list"></div>
  <p class="stats" id="stats"></p>
</div>
<script>
document.getElementById('inp').addEventListener('keydown',function(e){if(e.key==='Enter')add();});
var todos=JSON.parse(localStorage.getItem('todos')||'[]'),filter='all';
function save(){localStorage.setItem('todos',JSON.stringify(todos));}
function add(){
  var t=document.getElementById('inp').value.trim();
  if(!t)return;
  todos.unshift({id:Date.now(),text:t,done:false,pri:document.getElementById('pri').value});
  save();render();document.getElementById('inp').value='';
}
function toggle(id){var t=todos.find(function(t){return t.id===id;});if(t)t.done=!t.done;save();render();}
function del(id){todos=todos.filter(function(t){return t.id!==id;});save();render();}
function setFilter(f,btn){filter=f;document.querySelectorAll('.filter').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');render();}
function render(){
  var list=document.getElementById('list');
  var visible=todos.filter(function(t){return filter==='all'?true:filter==='done'?t.done:!t.done;});
  list.innerHTML=visible.map(function(t){
    return '<div class="todo '+(t.done?'done':'')+'">'
      +'<div class="check '+(t.done?'done':'')+'" onclick="toggle('+t.id+')">'+(t.done?'v':'')+'</div>'
      +'<span class="text">'+t.text+'</span>'
      +'<span class="badge '+t.pri+'">'+t.pri+'</span>'
      +'<button class="del" onclick="del('+t.id+')">x</button>'
      +'</div>';
  }).join('');
  var done=todos.filter(function(t){return t.done;}).length;
  document.getElementById('stats').textContent=done+'/'+todos.length+' completed';
}
render();
</script></body></html>`

const QUIZ_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Quiz App</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#1e1e2e;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',sans-serif;color:#cdd6f4;padding:20px}
.app{max-width:560px;width:100%;background:#181825;border-radius:20px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,0.4)}
.progress{display:flex;justify-content:space-between;margin-bottom:16px;font-size:12px;color:#6c7086}
.bar{height:4px;background:#313244;border-radius:2px;margin-bottom:20px}
.bar-fill{height:100%;background:linear-gradient(90deg,#89b4fa,#cba6f7);border-radius:2px;transition:width .3s}
.q{font-size:18px;font-weight:600;margin-bottom:20px;line-height:1.5}
.options{display:flex;flex-direction:column;gap:10px}
.opt{padding:12px 16px;border-radius:12px;border:2px solid #313244;background:#11111b;color:#cdd6f4;text-align:left;font-size:14px;cursor:pointer;transition:all .15s}
.opt:hover{border-color:#89b4fa}
.opt.correct{border-color:#a6e3a1;background:#a6e3a122;color:#a6e3a1}
.opt.wrong{border-color:#f38ba8;background:#f38ba822;color:#f38ba8}
.feedback{margin-top:14px;padding:12px;border-radius:10px;background:#11111b;font-size:13px;color:#a6adc8;display:none}
.next{width:100%;margin-top:16px;padding:12px;background:#89b4fa;color:#1e1e2e;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;display:none}
.score-screen{text-align:center;display:none}
.score-screen h2{font-size:32px;color:#cba6f7;margin-bottom:8px}
.score-screen .score{font-size:56px;font-weight:700;color:#89b4fa;margin:16px 0}
.retry{padding:12px 32px;background:#89b4fa;color:#1e1e2e;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer}
</style></head>
<body><div class="app" id="quiz-screen">
<div class="progress"><span id="qnum">Question 1/5</span><span id="score-live">Score: 0</span></div>
<div class="bar"><div class="bar-fill" id="bar" style="width:0%"></div></div>
<div class="q" id="qtext"></div>
<div class="options" id="opts"></div>
<div class="feedback" id="fb"></div>
<button class="next" id="next" onclick="nextQ()">Next Question</button>
</div>
<div class="score-screen" id="score-screen">
<h2>Quiz Complete!</h2>
<div class="score" id="final-score">0/5</div>
<p id="result-msg" style="color:#6c7086;margin-bottom:8px"></p>
<button class="retry" onclick="restart()">Try Again</button>
</div>
<script>
var Q=[
  {q:"What does HTML stand for?",opts:["HyperText Markup Language","High Tech Modern Language","HyperText Modern Links","Hyper Transfer Markup Language"],ans:0,exp:"HTML stands for HyperText Markup Language."},
  {q:"Which keyword declares a variable in modern JavaScript?",opts:["var","dim","let / const","int"],ans:2,exp:"'let' and 'const' are the modern ES6+ ways to declare variables."},
  {q:"What symbol is used for comments in Python?",opts:["//","--","#","/*"],ans:2,exp:"Python uses # for single-line comments."},
  {q:"What does CSS stand for?",opts:["Computer Style Sheets","Cascading Style Sheets","Creative Style System","Coded Style Syntax"],ans:1,exp:"CSS stands for Cascading Style Sheets."},
  {q:"What data structure is First-In-First-Out (FIFO)?",opts:["Stack","Queue","Tree","Linked List"],ans:1,exp:"A Queue is FIFO."}
];
var qi=0,score=0;
function render(){
  var q=Q[qi];
  document.getElementById('qnum').textContent='Question '+(qi+1)+'/'+Q.length;
  document.getElementById('score-live').textContent='Score: '+score;
  document.getElementById('bar').style.width=((qi/Q.length)*100)+'%';
  document.getElementById('qtext').textContent=q.q;
  document.getElementById('opts').innerHTML=q.opts.map(function(o,i){
    return '<button class="opt" onclick="answer('+i+')">'+o+'</button>';
  }).join('');
  document.getElementById('fb').style.display='none';
  document.getElementById('next').style.display='none';
}
function answer(i){
  var q=Q[qi];
  document.querySelectorAll('.opt').forEach(function(b,j){
    b.disabled=true;
    if(j===q.ans)b.classList.add('correct');
    else if(j===i)b.classList.add('wrong');
  });
  if(i===q.ans)score++;
  document.getElementById('score-live').textContent='Score: '+score;
  var fb=document.getElementById('fb');
  fb.textContent=(i===q.ans?'Correct! ':'Wrong! ')+q.exp;
  fb.style.display='block';
  document.getElementById('next').style.display='block';
  document.getElementById('next').textContent=qi<Q.length-1?'Next Question':'See Results';
}
function nextQ(){qi++;if(qi>=Q.length){showScore();}else render();}
function showScore(){
  document.getElementById('quiz-screen').style.display='none';
  document.getElementById('score-screen').style.display='block';
  document.getElementById('final-score').textContent=score+'/'+Q.length;
  var msgs=['Keep studying!','Not bad!','Good job!','Great work!','Perfect score!'];
  document.getElementById('result-msg').textContent=msgs[Math.min(Math.floor(score/Q.length*(msgs.length-1)),msgs.length-1)];
}
function restart(){qi=0;score=0;document.getElementById('quiz-screen').style.display='block';document.getElementById('score-screen').style.display='none';render();}
render();
</script></body></html>`

const TYPING_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Typing Speed Test</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#1e1e2e;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',sans-serif;color:#cdd6f4;padding:20px}
.app{max-width:640px;width:100%;background:#181825;border-radius:20px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,0.4)}
h1{color:#cba6f7;font-size:24px;margin-bottom:20px;text-align:center}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
.stat{background:#11111b;border-radius:12px;padding:12px;text-align:center}
.stat-val{font-size:28px;font-weight:700;color:#89b4fa}
.stat-lbl{font-size:11px;color:#6c7086;margin-top:4px}
#text-display{background:#11111b;border-radius:12px;padding:16px;font-size:18px;line-height:1.8;margin-bottom:14px;min-height:100px;letter-spacing:0.5px}
.correct{color:#a6e3a1}.wrong{color:#f38ba8;background:#f38ba822;border-radius:2px}.current{background:#89b4fa33;border-bottom:2px solid #89b4fa}.pending{color:#45475a}
input{width:100%;padding:12px 14px;border-radius:10px;border:1px solid #313244;background:#11111b;color:#cdd6f4;font-size:15px;outline:none;margin-bottom:12px}
input:focus{border-color:#89b4fa}
.btn-row{display:flex;gap:8px}
button{flex:1;padding:10px;border:none;border-radius:10px;cursor:pointer;font-size:14px;font-weight:600}
.start{background:#89b4fa;color:#1e1e2e}.reset{background:#313244;color:#cdd6f4}
#progress{height:4px;background:#313244;border-radius:2px;margin-bottom:14px}
#progress-bar{height:100%;background:#89b4fa;border-radius:2px;transition:width .1s}
</style></head>
<body><div class="app">
<h1>Typing Speed Test</h1>
<div class="stats">
  <div class="stat"><div class="stat-val" id="wpm">0</div><div class="stat-lbl">WPM</div></div>
  <div class="stat"><div class="stat-val" id="acc">100</div><div class="stat-lbl">Accuracy %</div></div>
  <div class="stat"><div class="stat-val" id="time">60</div><div class="stat-lbl">Seconds</div></div>
</div>
<div id="progress"><div id="progress-bar" style="width:100%"></div></div>
<div id="text-display"></div>
<input id="inp" placeholder="Click Start to begin..." disabled>
<div class="btn-row"><button class="start" onclick="startGame()">Start</button><button class="reset" onclick="resetGame()">Reset</button></div>
</div>
<script>
var SENTENCES=["The quick brown fox jumps over the lazy dog","Programming is the art of telling computers what to do","Clean code always looks like it was written by someone who cares","First solve the problem then write the code","Any fool can write code that a computer can understand"];
var text='',idx=0,wrong=0,start_t=null,timer=null,duration=60,running=false,orig='';
var disp=document.getElementById('text-display'),inp=document.getElementById('inp');
function render(){
  disp.innerHTML=text.split('').map(function(c,i){
    var cls='pending';
    if(i<idx)cls=orig[i]===text[i]?'correct':'wrong';
    else if(i===idx)cls='current';
    return '<span class="'+cls+'">'+c+'</span>';
  }).join('');
}
function startGame(){
  orig=text=SENTENCES[Math.floor(Math.random()*SENTENCES.length)];
  idx=0;wrong=0;running=true;
  inp.disabled=false;inp.value='';inp.focus();
  var t=duration;
  document.getElementById('time').textContent=t;
  document.getElementById('progress-bar').style.width='100%';
  clearInterval(timer);
  start_t=Date.now();
  timer=setInterval(function(){
    t--;
    document.getElementById('time').textContent=t;
    document.getElementById('progress-bar').style.width=(t/duration*100)+'%';
    if(t<=0){clearInterval(timer);running=false;inp.disabled=true;inp.placeholder='Time up!';}
  },1000);
  render();
}
inp.addEventListener('input',function(e){
  if(!running)return;
  var v=e.target.value;
  idx=v.length;
  var el=Date.now()-start_t;
  var wpm=Math.round((idx/5)/(el/60000))||0;
  var acc=Math.max(0,Math.round(((idx-wrong)/Math.max(idx,1))*100));
  document.getElementById('wpm').textContent=wpm;
  document.getElementById('acc').textContent=acc;
  if(v[v.length-1]!==text[v.length-1])wrong++;
  render();
  if(idx>=text.length){clearInterval(timer);running=false;inp.disabled=true;inp.placeholder='Done! '+wpm+' WPM, '+acc+'% accuracy';}
});
function resetGame(){clearInterval(timer);running=false;idx=0;wrong=0;text='';orig='';inp.disabled=true;inp.value='';inp.placeholder='Click Start to begin...';disp.innerHTML='';document.getElementById('wpm').textContent='0';document.getElementById('acc').textContent='100';document.getElementById('time').textContent=duration;document.getElementById('progress-bar').style.width='100%';}
</script></body></html>`

const COLOR_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Color Palette Generator</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#1e1e2e;min-height:100vh;font-family:'Segoe UI',sans-serif;color:#cdd6f4;padding:32px 20px}
h1{color:#cba6f7;font-size:26px;text-align:center;margin-bottom:8px}
p{color:#6c7086;text-align:center;font-size:13px;margin-bottom:24px}
.controls{display:flex;justify-content:center;gap:10px;margin-bottom:28px;flex-wrap:wrap;align-items:center}
button{padding:10px 20px;border:none;border-radius:10px;cursor:pointer;font-size:14px;font-weight:600}
.gen{background:#89b4fa;color:#1e1e2e}
label{display:flex;align-items:center;gap:8px;color:#a6adc8;font-size:13px;background:#181825;padding:8px 14px;border-radius:10px}
.palette{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;margin-bottom:20px}
.swatch{border-radius:14px;overflow:hidden;cursor:pointer;transition:transform .15s;box-shadow:0 4px 12px rgba(0,0,0,0.3)}
.swatch:hover{transform:translateY(-4px)}
.color-block{height:100px}
.swatch-info{background:#181825;padding:8px 10px}
.hex{font-size:12px;font-family:monospace;color:#cdd6f4}
.copy-hint{font-size:10px;color:#6c7086}
.toast{position:fixed;bottom:20px;right:20px;background:#a6e3a1;color:#1e1e2e;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;display:none}
</style></head>
<body>
<h1>Color Palette Generator</h1>
<p>Click any color to copy its hex code</p>
<div class="controls">
  <button class="gen" onclick="generate()">Generate Palette</button>
  <label><input type="checkbox" id="lock"> Lock hue</label>
  <label>Count: <input type="range" id="count" min="3" max="8" value="5" style="width:80px" oninput="document.getElementById('cv').textContent=this.value;generate()"> <span id="cv">5</span></label>
</div>
<div class="palette" id="palette"></div>
<div class="toast" id="toast">Copied!</div>
<script>
var lockedHue=null;
function hslToHex(h,s,l){
  l/=100;var a=s*Math.min(l,1-l)/100;
  function f(n){var k=(n+h/30)%12;var c=l-a*Math.max(Math.min(k-3,9-k,1),-1);return Math.round(255*c).toString(16).padStart(2,'0');}
  return '#'+f(0)+f(8)+f(4);
}
function generate(){
  var n=+document.getElementById('count').value;
  var locked=document.getElementById('lock').checked;
  var baseH=locked&&lockedHue!==null?lockedHue:Math.random()*360;
  if(!locked)lockedHue=baseH;
  var colors=[];
  for(var i=0;i<n;i++){
    var h=(baseH+i*(360/n))%360;
    var s=50+Math.random()*30;
    var l=45+Math.random()*20;
    colors.push({hex:hslToHex(h,s,l)});
  }
  document.getElementById('palette').innerHTML=colors.map(function(c){
    return '<div class="swatch" onclick="copyColor(\''+c.hex+'\')">'
      +'<div class="color-block" style="background:'+c.hex+'"></div>'
      +'<div class="swatch-info"><div class="hex">'+c.hex.toUpperCase()+'</div>'
      +'<div class="copy-hint">Click to copy</div></div></div>';
  }).join('');
}
function copyColor(hex){
  window.api.clipboard.writeText(hex);
    var t=document.getElementById('toast');t.style.display='block';
    setTimeout(function(){t.style.display='none';},1500);
}
generate();
</script></body></html>`

export const TEMPLATES: Template[] = [
  {
    id: 'snake-game', name: 'Snake Game', icon: '🐍', category: 'game', language: 'html',
    difficulty: 'intermediate', tags: ['game', 'canvas', 'javascript'],
    description: 'Classic snake game with score tracking and increasing speed',
    files: [{ name: 'snake.html', content: SNAKE_HTML }]
  },
  {
    id: 'calculator', name: 'Calculator', icon: '🔢', category: 'web', language: 'html',
    difficulty: 'beginner', tags: ['calculator', 'css-grid', 'javascript'],
    description: 'Beautiful calculator with keyboard support',
    files: [{ name: 'calculator.html', content: CALCULATOR_HTML }]
  },
  {
    id: 'todo-app', name: 'Todo App', icon: '✅', category: 'web', language: 'html',
    difficulty: 'beginner', tags: ['todo', 'localStorage', 'css'],
    description: 'Clean todo app with localStorage persistence and filters',
    files: [{ name: 'todo.html', content: TODO_HTML }]
  },
  {
    id: 'quiz-app', name: 'Quiz App', icon: '🧠', category: 'learning', language: 'html',
    difficulty: 'beginner', tags: ['quiz', 'javascript', 'learning'],
    description: 'Interactive quiz with score tracking and explanations',
    files: [{ name: 'quiz.html', content: QUIZ_HTML }]
  },
  {
    id: 'typing-test', name: 'Typing Speed Test', icon: '⌨️', category: 'learning', language: 'html',
    difficulty: 'intermediate', tags: ['typing', 'wpm', 'game'],
    description: 'Test your typing speed in WPM with accuracy tracking',
    files: [{ name: 'typing-test.html', content: TYPING_HTML }]
  },
  {
    id: 'color-picker', name: 'Color Palette Generator', icon: '🎨', category: 'utility', language: 'html',
    difficulty: 'beginner', tags: ['color', 'design', 'css'],
    description: 'Generate beautiful color palettes and copy hex codes',
    files: [{ name: 'color-palette.html', content: COLOR_HTML }]
  }
]

export const CATEGORIES = [
  { id: 'all',      label: 'All',      icon: '✨' },
  { id: 'game',     label: 'Games',    icon: '🎮' },
  { id: 'web',      label: 'Web Apps', icon: '🌐' },
  { id: 'utility',  label: 'Utility',  icon: '🔧' },
  { id: 'learning', label: 'Learning', icon: '📚' },
]
