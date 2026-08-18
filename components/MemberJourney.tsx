import { Check, Compass, Sparkles, UserRound } from "lucide-react";

type Stage="profile"|"atlas"|"preferences"|"discover";

export function MemberJourney({stage}:{stage:Stage}){
  const order:Stage[]=["profile","atlas","preferences","discover"];
  const current=order.indexOf(stage);
  const steps=[
    {id:"profile" as const,label:"About you",hint:"Build your profile",icon:<UserRound size={16}/>},
    {id:"atlas" as const,label:"Atlas",hint:"What matters to you",icon:<Sparkles size={16}/>},
    {id:"preferences" as const,label:"Preferences",hint:"Who should Atlas consider?",icon:<Compass size={16}/>},
    {id:"discover" as const,label:"Discover",hint:"Meet considered people",icon:<Compass size={16}/>},
  ];
  return <div className="member-journey-shell"><div className="container">
    <div className="member-journey">
      {steps.map((step,index)=>{
        const complete=index<current;
        const active=index===current;
        return <div className={`member-journey-step ${complete?"complete":""} ${active?"active":""}`} key={step.id}>
          <div className="member-journey-marker">{complete?<Check size={15}/>:step.icon}</div>
          <div><small>STEP {index+1}</small><b>{step.label}</b><span>{step.hint}</span></div>
          {index<steps.length-1&&<i/>}
        </div>
      })}
    </div>
  </div></div>
}
