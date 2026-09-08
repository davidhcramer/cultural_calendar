import {createClient} from '@supabase/supabase-js';
import {createStore} from './store.js';
import {mountDiary} from './diary.js';
import './style.css';

const status=document.getElementById('auth-status');
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const configured=url?.startsWith('https://')&&key?.startsWith('sb_publishable_');
let mounted=false,loading=false,currentUser=null,client=null,store=null;
const cacheKey=id=>'culture-cache-'+id;
function cache(id,data){try{localStorage.setItem(cacheKey(id),JSON.stringify(data));}catch{connection('Saved online. Offline storage is unavailable on this device.');}}
function connection(message){document.getElementById('connection-status').textContent=message;}
function clearPrivateStorage(id){
  const prefixes=['culture-cloud-'+id,'culture-cache-'+id];
  for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(prefixes.some(p=>k.startsWith(p)))localStorage.removeItem(k);}
}
async function signOut(){
  if(!confirm('Sign out and clear this device’s cached calendar and unsaved drafts? Saved records stay in your account.'))return;
  const {error}=await client.auth.signOut({scope:'local'});
  if(error){connection('Could not sign out. '+error.message);return;}
  if(currentUser)clearPrivateStorage(currentUser.id);
  location.reload();
}
async function load(session){
  if(mounted||loading||!session)return;
  loading=true;
  currentUser=session.user;
  status.textContent='Opening your calendar…';
  try{
    let data,offline=false;
    try{data=await store.load();cache(currentUser.id,data);}
    catch(error){
      // A denied or expired session must never fall back to cached private data online.
      if(navigator.onLine)throw error;
      data=JSON.parse(localStorage.getItem(cacheKey(currentUser.id))||'null');
      if(!data)throw new Error('Connect to the internet to open this calendar for the first time.');
      offline=true;
    }
    mounted=true;
    document.getElementById('auth-panel').hidden=true;
    document.getElementById('diary-content').hidden=false;
    mountDiary({DATA:data,store,userId:currentUser.id,userEmail:currentUser.email,
      onCache:data=>cache(currentUser.id,data),signOut,connection});
    connection(offline?'Offline. Viewing the last saved calendar.':'Up to date.');
  }catch(error){status.textContent=error.message;document.getElementById('retry-load').hidden=false;}
  finally{loading=false;}
}
if(!configured){
  status.textContent='This copy is waiting for its Supabase connection settings.';
  document.getElementById('login-form').hidden=true;
}else{
  client=createClient(url,key,{auth:{flowType:'implicit',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  store=createStore(client);
  document.getElementById('login-form').addEventListener('submit',async event=>{
    event.preventDefault();const button=document.getElementById('send-link');button.disabled=true;
    status.textContent='Sending your sign-in link…';
    const {error}=await client.auth.signInWithOtp({email:document.getElementById('login-email').value.trim(),options:{emailRedirectTo:location.origin+import.meta.env.BASE_URL}});
    status.textContent=error?error.message:'Check your email. Open the sign-in link on this device, then return to the calendar.';
    button.disabled=false;
  });
  client.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT'&&mounted){if(currentUser)clearPrivateStorage(currentUser.id);location.reload();return;}
    if(session&&currentUser&&session.user.id!==currentUser.id){clearPrivateStorage(currentUser.id);location.reload();return;}
    if(session&&!mounted)setTimeout(()=>load(session),0);
  });
  document.getElementById('retry-load').onclick=async()=>{const {data}=await client.auth.getSession();await load(data.session);};
  const {data,error}=await client.auth.getSession();
  if(error)status.textContent=error.message;else await load(data.session);
}
if('serviceWorker' in navigator&&import.meta.env.PROD){navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',{scope:import.meta.env.BASE_URL}).catch(()=>connection('Offline viewing is unavailable in this browser.'));}
