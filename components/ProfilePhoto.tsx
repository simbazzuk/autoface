"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export function ProfilePhoto({
  uid,
  name,
  className = "",
  refreshKey = 0,
}: {
  uid: string;
  name: string;
  className?: string;
  refreshKey?: number;
}) {
  const { user } = useAuth();
  const [src,setSrc]=useState("");

  useEffect(()=>{
    if(!user||!uid){setSrc("");return}
    let active=true;
    let objectUrl="";
    const current=user;
    (async()=>{
      try{
        const token=await current.getIdToken();
        const response=await fetch(`/api/profile-photo/${encodeURIComponent(uid)}?v=${refreshKey}`,{
          headers:{Authorization:`Bearer ${token}`},
          cache:"no-store",
        });
        if(!response.ok)return;
        const blob=await response.blob();
        objectUrl=URL.createObjectURL(blob);
        if(active)setSrc(objectUrl);
      }catch{}
    })();
    return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}
  },[user,uid,refreshKey]);

  return src
    ? <img className={`profile-photo-image ${className}`} src={src} alt={`${name}'s profile`} />
    : <div className={`profile-placeholder ${className}`} aria-label={`${name} profile photo placeholder`}>{name.slice(0,1).toUpperCase()}</div>;
}
