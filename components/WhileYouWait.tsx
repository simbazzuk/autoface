"use client";

import { useEffect, useMemo, useState } from "react";
import { Gamepad2, RotateCcw, Sparkles } from "lucide-react";

type Choice = { left:string; right:string };
const questions:Choice[] = [
  {left:"City break",right:"Beach holiday"},
  {left:"Night out",right:"Cosy night in"},
  {left:"Gym session",right:"Long walk"},
  {left:"Plan everything",right:"Be spontaneous"},
  {left:"Big family gathering",right:"Small dinner"},
  {left:"Tea",right:"Coffee"},
  {left:"Mountains",right:"Beach"},
  {left:"Cinema",right:"Streaming at home"},
  {left:"Cook together",right:"Eat out"},
  {left:"Early bird",right:"Night owl"},
];

const storageKey="autoface-this-or-that-v1";

export function WhileYouWait(){
  const [answers,setAnswers]=useState<Record<number,string>>({});
  const [index,setIndex]=useState(0);

  useEffect(()=>{
    try{
      const saved=window.localStorage.getItem(storageKey);
      if(saved){
        const parsed=JSON.parse(saved) as Record<number,string>;
        setAnswers(parsed);
        const firstUnanswered=questions.findIndex((_,i)=>!parsed[i]);
        setIndex(firstUnanswered<0?questions.length:firstUnanswered);
      }
    }catch{}
  },[]);

  const complete=index>=questions.length;
  const answered=Object.keys(answers).length;
  const current=questions[index];
  const summary=useMemo(()=>Object.entries(answers).slice(0,4).map(([key,value])=>value),[answers]);

  function choose(value:string){
    const next={...answers,[index]:value};
    setAnswers(next);
    try{window.localStorage.setItem(storageKey,JSON.stringify(next))}catch{}
    window.setTimeout(()=>setIndex((currentIndex)=>Math.min(questions.length,currentIndex+1)),120);
  }

  function reset(){
    setAnswers({});
    setIndex(0);
    try{window.localStorage.removeItem(storageKey)}catch{}
  }

  return <div className="card while-you-wait-card">
    <div className="while-you-wait-heading">
      <div className="while-you-wait-icon"><Gamepad2 size={22}/></div>
      <div><span className="privacy-kicker">WHILE YOU WAIT</span><h2>Let&apos;s have a little fun.</h2><p>Atlas is still looking for introductions worth showing you. In the meantime, try a quick round of <b>This or That</b>.</p></div>
      <span className="while-you-wait-progress">{answered}/{questions.length}</span>
    </div>

    {!complete&&current?<div className="this-or-that-game">
      <div className="this-or-that-prompt"><small>QUESTION {index+1}</small><b>Which feels more like you?</b></div>
      <div className="this-or-that-options">
        <button type="button" onClick={()=>choose(current.left)}><span>A</span><b>{current.left}</b></button>
        <div className="this-or-that-or">OR</div>
        <button type="button" onClick={()=>choose(current.right)}><span>B</span><b>{current.right}</b></button>
      </div>
      <p className="this-or-that-note"><Sparkles size={13}/>Just for fun for now — these answers stay in this browser and are <b>not used by Atlas matching</b>.</p>
    </div>:<div className="this-or-that-complete">
      <span className="this-or-that-confetti">✦</span>
      <h3>That&apos;s the round complete.</h3>
      <p>Your choices were saved only in this browser. They do not affect compatibility or who Atlas recommends.</p>
      {summary.length>0&&<div className="this-or-that-summary">{summary.map((item,i)=><span key={`${item}-${i}`}>{item}</span>)}</div>}
      <button type="button" className="btn" onClick={reset}><RotateCcw size={14}/>Play again</button>
    </div>}
  </div>;
}
