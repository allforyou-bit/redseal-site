/* Exam countdown calendar file (.ics) for redsealquiz.ca.

   One generator for every page that offers "Add my exam countdown to my calendar": the study
   planner (study-planner.html calls examCountdownIcs.events/build itself) and the eleven quiz
   pages, where a box next to the Mock Exam bar holds a date field and the button. That box is
   written by tools/wire_kofi_ctas.py and carries data-ics-trade; this file binds it. Moved here
   unchanged from study-planner.html on 2026-10-03 so the planner and the quiz pages make the
   same file (same UIDs for the same trade and exam date, so a second download updates the
   reminders instead of doubling them).

   Built entirely in the browser: no request is made and the exam date never leaves the device.
   The generator is pure functions (no DOM), so it can be run and validated outside the page.
   RFC 5545: CRLF line endings, lines folded at 75 octets, TEXT values escaped, all-day events
   as DTSTART;VALUE=DATE with an exclusive DTEND. */
(function(root){
  var REMINDERS=[
    {key:'t21',before:21,title:'start full mock exams',
     body:'Three weeks to go. Take a full timed mock exam on the {CODE} practice quiz, review every wrong answer, then take another every few days.'},
    {key:'t7',before:7,title:'revision-notes week',
     body:'One week to go. Revise one topic block a day: your Mistakes tab and the key concept under each explanation (or the revision notes, if you have the printable bank). Anything you cannot explain out loud, practise again.'},
    {key:'t1',before:1,title:'Numbers & Specs night',
     body:'Exam tomorrow. Go over the figures and specs you keep missing, then your weakest topic. No new material tonight, and get some sleep.'}
  ];
  function pad(n){return (n<10?'0':'')+n;}
  function parseISO(s){
    var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||''));
    return m?Date.UTC(+m[1],+m[2]-1,+m[3]):NaN;
  }
  function ymd(ms){var d=new Date(ms);return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate());}
  function stamp(now){
    return now.getUTCFullYear()+pad(now.getUTCMonth()+1)+pad(now.getUTCDate())+'T'
          +pad(now.getUTCHours())+pad(now.getUTCMinutes())+pad(now.getUTCSeconds())+'Z';
  }
  function text(s){
    return String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r\n|\r|\n/g,'\\n');
  }
  function octets(ch){
    var c=ch.codePointAt(0);
    return c<0x80?1:(c<0x800?2:(c<0x10000?3:4));
  }
  function fold(line){
    var out=[],cur='',size=0,limit=75;
    for(var i=0;i<line.length;){
      var ch=String.fromCodePoint(line.codePointAt(i));
      if(ch==='\\'&&i+1<line.length)ch+=line.charAt(i+1); // keep an escape such as \n on one line
      var n=0;for(var k=0;k<ch.length;){var cp=String.fromCodePoint(ch.codePointAt(k));n+=octets(cp);k+=cp.length;}
      if(size+n>limit){out.push(cur);cur=' ';size=1;limit=75;}
      cur+=ch;size+=n;i+=ch.length;
    }
    out.push(cur);
    return out.join('\r\n');
  }
  function code(name){var c=String(name).split(' ')[0];return c==='Gasfitter'?'Gasfitter (Class A)':c;}
  function quizUrl(t){
    return 'https://redsealquiz.ca/'+t+'.html?utm_source=exam-calendar&utm_medium=ics&utm_campaign='+t;
  }
  /* Reminders that fall on or after today (local date, YYYY-MM-DD). */
  function events(examISO,todayISO){
    var exam=parseISO(examISO),today=parseISO(todayISO),list=[];
    if(isNaN(exam)||isNaN(today))return list;
    for(var i=0;i<REMINDERS.length;i++){
      var at=exam-REMINDERS[i].before*86400000;
      if(at>=today)list.push({key:REMINDERS[i].key,before:REMINDERS[i].before,date:ymd(at),next:ymd(at+86400000),
                              title:REMINDERS[i].title,body:REMINDERS[i].body});
    }
    return list;
  }
  function build(t,tradeName,examISO,todayISO,now){
    var list=events(examISO,todayISO);
    if(!list.length||!/^[a-z0-9-]+$/.test(String(t)))return '';
    var c=code(tradeName),url=quizUrl(t),exam=ymd(parseISO(examISO)),dt=stamp(now||new Date());
    var L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//redsealquiz.ca//Red Seal Exam Countdown//EN',
           'CALSCALE:GREGORIAN','METHOD:PUBLISH'];
    for(var i=0;i<list.length;i++){
      var e=list[i];
      var summary=c+(e.before===1?' exam tomorrow: ':' exam in '+e.before+' days: ')+e.title;
      L.push('BEGIN:VEVENT',
             'UID:'+t+'-exam-'+exam+'-'+e.key+'@redsealquiz.ca',
             'DTSTAMP:'+dt,
             'DTSTART;VALUE=DATE:'+e.date,
             'DTEND;VALUE=DATE:'+e.next,
             'SUMMARY:'+text(summary),
             'DESCRIPTION:'+text(e.body.replace('{CODE}',c)+'\n\n'+c+' practice quiz: '+url),
             'URL:'+url,
             'TRANSP:TRANSPARENT',
             'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+text(summary),'TRIGGER:PT9H','END:VALARM',
             'END:VEVENT');
    }
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n')+'\r\n';
  }
  root.examCountdownIcs={events:events,build:build,fold:fold,text:text};

  /* ---- Quiz-page box (data-ics-trade). Everything below needs a document. ---- */
  if(!root.document)return;
  var doc=root.document;
  function localISO(dt){return dt.getFullYear()+'-'+pad(dt.getMonth()+1)+'-'+pad(dt.getDate());}
  function save(t,body){
    var blob=new Blob([body],{type:'text/calendar;charset=utf-8'});
    var a=doc.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='red-seal-'+t+'-exam-countdown.ics';
    doc.body.appendChild(a);
    a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);if(a.parentNode)a.parentNode.removeChild(a);},1500);
  }
  function bind(box){
    var t=box.getAttribute('data-ics-trade')||'',name=box.getAttribute('data-ics-name')||'';
    var input=box.querySelector('[data-ics-date]'),btn=box.querySelector('[data-ics-add]'),msg=box.querySelector('[data-ics-msg]');
    if(!/^[a-z0-9-]+$/.test(t)||!name||!input||!btn||!msg||box.getAttribute('data-ics-bound'))return;
    box.setAttribute('data-ics-bound','1');
    var intro=msg.textContent;
    function say(s,bad){msg.textContent=s;msg.style.color=bad?'#b91c1c':'';}
    try{input.min=localISO(new Date());}catch(e){}
    input.addEventListener('input',function(){say(intro,false);});
    btn.addEventListener('click',function(){
      var examISO=input.value,todayISO=localISO(new Date());
      if(!examISO){say('Choose your exam date first.',true);try{input.focus();}catch(e){}return;}
      if(isNaN(parseISO(examISO))){say('Enter the date as YYYY-MM-DD, for example '+todayISO+'.',true);return;}
      if(examISO<todayISO){say('That date is in the past. Choose your upcoming exam date.',true);return;}
      var list=events(examISO,todayISO);
      if(!list.length){say('Your exam is today, so there is no reminder left to add.',true);return;}
      var body=build(t,name,examISO,todayISO,new Date());
      if(!body)return;
      save(t,body);
      var left=3-list.length;
      say('Saved red-seal-'+t+'-exam-countdown.ics with '+(list.length===1?'1 reminder':list.length+' reminders')
          +(left?' ('+(left===1?'one reminder is':'two reminders are')+' already in the past and left out)':'')
          +'. Open it to add the reminders to your calendar.',false);
      try{if(typeof root.gtag==='function')root.gtag('event','ics_download',{trade:t,placement:'quiz_mock_bar'});}catch(e){}
    });
    box.hidden=false;
  }
  function init(){
    var boxes=doc.querySelectorAll('[data-ics-trade]');
    for(var i=0;i<boxes.length;i++){try{bind(boxes[i]);}catch(e){/* never break the quiz */}}
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init);else init();
})(window);
