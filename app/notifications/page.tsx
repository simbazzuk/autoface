"use client";
import { useCallback,useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

type N={id:string;type:string;title:string;body:string;actionUrl:string|null;read:boolean;createdAt:string|null};
const icons:Record<string,string>={introduction:"♥",message:"💬",connection:"↗",verification:"✓",safety:"!"};

export default function NotificationsPage(){
 const {user,loading}=useAuth(); const router=useRouter(); const [items,setItems]=useState<N[]|null>(null); const [error,setError]=useState("");
 useEffect(()=>{if(!loading&&!user)router.replace("/sign-in")},[loading,user,router]);
 const load=useCallback(async()=>{if(!user)return;try{const token=await user.getIdToken();const r=await fetch("/api/notifications",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});const b=await r.json();if(!r.ok)throw new Error(b.error??"Unable to load notifications.");setItems(b.notifications??[]);setError("")}catch(e){setItems([]);setError(e instanceof Error?e.message:"Unable to load notifications.")}},[user]);
 useEffect(()=>{void load()},[load]);
 async function mark(id?:string,markAll=false){if(!user)return;const token=await user.getIdToken();await fetch("/api/notifications",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(markAll?{markAll:true}:{id})});await load()}
 if(loading||!user||items===null)return <main><section className="section"><div className="container"><p className="muted">Loading activity…</p></div></section></main>;
 return <main><section className="page-hero compact-hero"><div className="container notification-head"><div><span className="eyebrow">Activity · v0.11.1</span><h1>What’s happening in AutoFace.</h1><p className="lead">Introductions, messages, connection activity and important trust events appear here.</p></div>{items.some(x=>!x.read)&&<button className="btn" onClick={()=>void mark(undefined,true)}>Mark all as read</button>}</div></section>
 <section className="section notification-section"><div className="container">{error&&<p className="notice">{error}</p>}{items.length===0?<div className="card discovery-empty"><h2>No activity yet</h2><p>New introductions and messages will appear here.</p></div>:<div className="notification-list">{items.map(n=><article className={`notification-card ${n.read?"":"unread"}`} key={n.id}><div className={`notification-icon ${n.type}`}>{icons[n.type]??"•"}</div><div className="notification-copy"><span>{n.type.toUpperCase()}</span><h3>{n.title}</h3><p>{n.body}</p><small>{n.createdAt?new Date(n.createdAt).toLocaleString():"Just now"}</small></div><div className="notification-actions">{n.actionUrl&&<a className="btn btn-primary" href={n.actionUrl} onClick={()=>void mark(n.id)}>Open</a>}{!n.read&&<button className="notification-read" onClick={()=>void mark(n.id)}>Mark read</button>}</div></article>)}</div>}</div></section></main>
}
