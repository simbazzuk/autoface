"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export function NotificationBell(){
 const {user}=useAuth(); const [count,setCount]=useState(0);
 useEffect(()=>{
  if(!user){setCount(0);return}
  const currentUser=user; let live=true;
  async function load(){try{const token=await currentUser.getIdToken();const r=await fetch("/api/notifications",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});const b=await r.json().catch(()=>({}));if(live&&r.ok)setCount(Number(b.unreadCount??0))}catch{}}
  void load(); const timer=window.setInterval(()=>void load(),10000); return()=>{live=false;window.clearInterval(timer)}
 },[user]);
 if(!user)return null;
 return <Link className="notification-bell" href="/notifications" aria-label={`${count} unread notifications`}><span aria-hidden="true">♢</span>{count>0&&<b>{count>9?"9+":count}</b>}</Link>
}
