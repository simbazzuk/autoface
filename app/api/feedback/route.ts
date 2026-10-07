import {NextRequest,NextResponse} from 'next/server';
import {FieldValue} from 'firebase-admin/firestore';

import {
  adminDb,
  requireUser
} from '@/lib/server/firebase-admin';

const allowedCategories=new Set([
  'general',
  'bug',
  'feature',
  'safety'
]);

export async function POST(request:NextRequest){
  try{
    const user=await requireUser(request);

    if(!adminDb){
      throw new Error('SERVER_NOT_CONFIGURED');
    }

    const body=await request.json().catch(()=>({}));

    const category=
      typeof body?.category==='string'
        ?body.category.trim()
        :'';

    const message=
      typeof body?.message==='string'
        ?body.message.trim()
        :'';

    if(!allowedCategories.has(category)){
      return NextResponse.json(
        {error:'Invalid feedback category.'},
        {status:400}
      );
    }

    if(message.length<5){
      return NextResponse.json(
        {error:'Please provide a little more detail.'},
        {status:400}
      );
    }

    if(message.length>2000){
      return NextResponse.json(
        {error:'Feedback is too long.'},
        {status:400}
      );
    }

    const ref=await adminDb.collection('feedback').add({
      userId:user.uid,
      category,
      message,

      platform:
        typeof body?.platform==='string'
          ?body.platform.slice(0,30)
          :'unknown',

      appVersion:
        typeof body?.appVersion==='string'
          ?body.appVersion.slice(0,30)
          :'unknown',

      buildNumber:
        typeof body?.buildNumber==='string'
          ?body.buildNumber.slice(0,30)
          :'unknown',

      priority:
        category==='safety'
          ?'safety'
          :'normal',

      status:'new',
      source:'mobile',
      createdAt:FieldValue.serverTimestamp(),
      updatedAt:FieldValue.serverTimestamp()
    });

    return NextResponse.json({
      ok:true,
      id:ref.id
    });
  }catch(error){
    console.error('[feedback] POST failed',error);

    const message=
      error instanceof Error
        ?error.message
        :'Unable to submit feedback';

    if(message==='UNAUTHENTICATED'){
      return NextResponse.json(
        {error:'Authentication required.'},
        {status:401}
      );
    }

    return NextResponse.json(
      {error:'Unable to submit feedback.'},
      {status:500}
    );
  }
}
