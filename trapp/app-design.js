/* Keep schedule content below its toolbar at any text size or screen width. */
document.addEventListener('DOMContentLoaded',()=>{
 const header=document.getElementById('ultra-header');if(!header)return;
 let frame=0;
 const measure=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const height=header.getBoundingClientRect().height;if(height>0)document.documentElement.style.setProperty('--app-schedule-top',Math.ceil(height+14)+'px');});};
 new ResizeObserver(measure).observe(header);
 const centerNav=track=>requestAnimationFrame(()=>{const active=track.querySelector('.active');if(!active||!track.clientWidth)return;const a=active.getBoundingClientRect(),b=track.getBoundingClientRect();track.scrollLeft+=a.left+a.width/2-b.left-b.width/2;});
 document.querySelectorAll('.nav-scroll-track').forEach(track=>new ResizeObserver(()=>centerNav(track)).observe(track));
 window.addEventListener('resize',measure,{passive:true});
});
