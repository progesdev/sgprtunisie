/* SGPR — Défilement fluide, apparitions des sections, vidéos.
   Léger et sans dépendance. Désactivé si l'utilisateur demande
   moins d'animations (prefers-reduced-motion). */
(function(){
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root=document.documentElement;
  var hasIO='IntersectionObserver' in window;

  /* ---------- 1. Défilement fluide (molette + ancres) ---------- */
  var current=window.scrollY,target=current,raf=0,lastT=0,animating=false;
  function maxScroll(){return Math.max(0,root.scrollHeight-window.innerHeight);}
  function clamp(v){return Math.min(Math.max(v,0),maxScroll());}
  function jump(y){window.scrollTo({top:y,left:window.scrollX,behavior:'instant'});}
  function tick(t){
    var dt=lastT?Math.min(64,t-lastT):16;lastT=t;
    var k=1-Math.pow(1-0.12,dt/16.67);           /* même douceur à 60 ou 120 Hz */
    current+=(target-current)*k;
    if(Math.abs(target-current)<0.5){current=target;jump(current);animating=false;raf=0;lastT=0;return;}
    jump(current);raf=requestAnimationFrame(tick);
  }
  function scrollToY(y){
    target=clamp(y);
    if(!animating){current=window.scrollY;animating=true;lastT=0;raf=requestAnimationFrame(tick);}
  }
  /* L'utilisateur fait défiler autrement (barre, clavier, tactile) : on se recale */
  window.addEventListener('scroll',function(){if(!animating){current=target=window.scrollY;}},{passive:true});

  function canScrollInside(el,dy){
    while(el&&el!==document.body&&el!==root){
      if(el.nodeType===1){
        var st=getComputedStyle(el),oy=st.overflowY;
        if((oy==='auto'||oy==='scroll')&&el.scrollHeight>el.clientHeight){
          if(dy>0?el.scrollTop+el.clientHeight<el.scrollHeight-1:el.scrollTop>0)return true;
        }
      }
      el=el.parentNode;
    }
    return false;
  }
  var finePointer=window.matchMedia&&window.matchMedia('(pointer:fine)').matches;
  if(!reduce&&finePointer){
    window.addEventListener('wheel',function(e){
      if(e.defaultPrevented||e.ctrlKey||e.metaKey||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
      var t=e.target;
      if(t&&t.closest&&t.closest('textarea,select,[data-native-scroll]'))return;
      var dy=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?window.innerHeight:1);
      if(canScrollInside(t,dy))return;
      e.preventDefault();
      if(!animating){current=target=window.scrollY;}
      scrollToY(target+dy);
    },{passive:false});
  }

  /* Liens d'ancrage (#section) et « Retour en haut » : glissement doux */
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a[href^="#"]');
    if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey)return;
    var id=a.getAttribute('href').slice(1);
    var dest=(id===''||id==='top')?0:(document.getElementById(id)?document.getElementById(id).getBoundingClientRect().top+window.scrollY:null);
    if(dest===null)return;
    e.preventDefault();
    if(reduce){jump(dest);}else{scrollToY(dest);}
    if(id&&id!=='top'&&history.replaceState)history.replaceState(null,'','#'+id);
  });

  /* ---------- 2. Animations d'apparition existantes (.anim / .sgpr-anim) ---------- */
  var vh=window.innerHeight||root.clientHeight;
  if(!reduce&&hasIO){
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){e.target.style.animationPlayState='running';io.unobserve(e.target);}
      });
    },{rootMargin:'0px 0px -6% 0px'});
    document.querySelectorAll('.anim,.sgpr-anim').forEach(function(el){
      if(el.getBoundingClientRect().top>vh){el.style.animationPlayState='paused';io.observe(el);}
    });
  }

  /* ---------- 3. Apparition douce des textes, images et blocs ----------
     Chaque élément situé sous l'écran apparaît en fondu + léger glissement
     vers le haut quand il arrive à l'écran, en cascade avec ses voisins.
     Les classes sont retirées à la fin : l'élément retrouve exactement
     ses styles d'origine (survols, opacités, transformations). */
  var nvCards=document.querySelectorAll('.nv-reveal');
  if(reduce||!hasIO){
    nvCards.forEach(function(c){c.classList.add('nv-visible');});
  }else{
    var cio=new IntersectionObserver(function(entries){
      entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add('nv-visible');cio.unobserve(e.target);}});
    },{rootMargin:'0px 0px -6% 0px'});
    nvCards.forEach(function(c){cio.observe(c);});
  }

  var BLOCKS='.sgprp-value-card,.sgprp-service-card,.sgprp-team-card,.sgprp-testimonial,.sgprp-stat-grid>div,'+
    '.sgprp-logo-grid>div,.sgprp-media-card,.sgprp-impact-image,.service-card,.experience-box,.panel,.service,.review,.stat,'+
    '.brand-item,.brand-pills,.bottom-contact,.contact-cta,.sgpr-footer-inner>*';
  var ATOMS='h1,h2,h3,h4,p,img,video,iframe,blockquote,.sgprp-btn,.btn,.sgprp-label,.tag,.line,.heading-line,ul';
  var SKIP='header,.sgpr-shared-topbar,.topbar,.home-carousel,.carousel-track,.brands-home-track,.carousel-window,'+
    '.anim,.sgpr-anim,.nv-reveal,.sgprp-hero,button,label,select,form ul,nav,.sgpr-footer-bottom,'+
    '[class*="marquee"],[class*="track"],[data-no-reveal]';

  if(!reduce&&hasIO){
    var marked=[];
    document.querySelectorAll(BLOCKS+','+ATOMS).forEach(function(el){
      if(el.closest(SKIP))return;
      if(el.parentElement&&el.parentElement.closest('.sx-hide'))return;   /* déjà animé via un parent */
      var r=el.getBoundingClientRect();
      if(!r.width&&!r.height)return;                 /* masqué */
      if(r.top<=vh*0.98)return;                      /* déjà à l'écran : on n'y touche pas */
      el.classList.add('sx-hide');
      marked.push(el);
    });

    function show(el,d){
      if(el.__sxDone)return;el.__sxDone=1;
      sio.unobserve(el);
      el.style.setProperty('transition-delay',d+'s','important');
      el.classList.add('sx-anim');
      void el.offsetWidth;                            /* fige l'état caché avant de lancer la transition */
      el.classList.remove('sx-hide');
      setTimeout(function(){el.classList.remove('sx-anim','sx-hide');el.style.removeProperty('transition-delay');},(d+0.95)*1000);
    }
    function showBatch(list){
      list.sort(function(a,b){var ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();return (ra.top-rb.top)||(ra.left-rb.left);});
      list.forEach(function(el,i){show(el,Math.min(i,6)*0.08);});
    }
    var sio=new IntersectionObserver(function(entries){
      showBatch(entries.filter(function(e){return e.isIntersecting;}).map(function(e){return e.target;}));
    },{rootMargin:'0px 0px -7% 0px'});
    marked.forEach(function(el){sio.observe(el);});

    /* Filet de sécurité : tout élément à l'écran ou déjà dépassé (défilement très
       rapide, saut d'ancre, onglet en arrière-plan) est affiché quoi qu'il arrive */
    var pending=false;
    function sweep(){
      pending=false;
      var h=window.innerHeight,late=[];
      marked=marked.filter(function(el){
        if(el.__sxDone)return false;
        if(el.getBoundingClientRect().top<h*0.93){late.push(el);return false;}
        return true;
      });
      if(late.length)showBatch(late);
      if(!marked.length)window.removeEventListener('scroll',onScroll);
    }
    function onScroll(){if(!pending){pending=true;setTimeout(sweep,120);}}
    window.addEventListener('scroll',onScroll,{passive:true});
    window.addEventListener('load',sweep);

    /* Images à l'écran encore en chargement : fondu à l'arrivée au lieu d'un affichage brutal */
    document.querySelectorAll('img').forEach(function(img){
      if(img.complete||img.classList.contains('sx-hide')||img.closest('header'))return;
      img.classList.add('sx-imgwait');
      function show(){img.classList.add('sx-imgin');img.classList.remove('sx-imgwait');setTimeout(function(){img.classList.remove('sx-imgin');},700);}
      img.addEventListener('load',show,{once:true});img.addEventListener('error',show,{once:true});
    });
  }

  /* ---------- 4. Navbar mobile : lien actif visible ---------- */
  var nav=document.querySelector('header.sgpr-shared-nav');
  var active=nav&&nav.querySelector('a.active');
  if(nav&&active&&nav.scrollWidth>nav.clientWidth){
    var over=active.offsetLeft+active.offsetWidth-nav.clientWidth;
    if(over>0)nav.scrollLeft=over;
  }

  /* ---------- 5. Vidéos (page Nouveautés) ---------- */
  /* Lecture automatique, sans son, en boucle et sans barre de contrôle.
     Un clic sur une vidéo affiche sa barre de contrôle (lecture, son, plein écran). */
  var videos=[].slice.call(document.querySelectorAll('video[data-sgpr-video]'));
  function tryPlay(v){v.muted=true;var p=v.play();if(p&&p.catch)p.catch(function(){v.controls=true;});}
  videos.forEach(function(v){
    v.muted=true;
    v.addEventListener('click',function(e){
      if(!v.controls){e.preventDefault();v.controls=true;v.classList.add('nv-open');}
    });
    /* Si le son est activé sur une vidéo, les autres repassent en muet */
    v.addEventListener('volumechange',function(){
      if(!v.muted)videos.forEach(function(o){if(o!==v)o.muted=true;});
    });
    /* Mise en pause manuelle respectée : la vidéo ne repart pas toute seule */
    v.addEventListener('pause',function(){
      if(v.__sxAuto){v.__sxAuto=false;return;}      /* pause automatique (hors écran) */
      v.__sxUserPaused=v.controls;
    });
    v.addEventListener('play',function(){v.__sxUserPaused=false;});
  });
  if(reduce){
    /* Animations réduites demandées : pas de lecture automatique */
    videos.forEach(function(v){v.removeAttribute('autoplay');v.pause();v.controls=true;});
  }else if(videos.length&&hasIO){
    /* Ne lit que les vidéos visibles à l'écran (économie de batterie et de données) */
    var vio=new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        var v=e.target;
        if(e.isIntersecting){if(v.paused&&!v.__sxUserPaused)tryPlay(v);}
        else if(!v.paused){v.__sxAuto=true;v.pause();}
      });
    },{threshold:0.15});
    videos.forEach(function(v){vio.observe(v);});
    /* Vérification de secours au défilement (défilement rapide, onglet en arrière-plan) */
    var vt=0;
    function checkVideos(){
      vt=0;var h=window.innerHeight;
      videos.forEach(function(v){
        var r=v.getBoundingClientRect(),inView=r.bottom>h*0.1&&r.top<h*0.9;
        if(inView){if(v.paused&&!v.__sxUserPaused)tryPlay(v);}
        else if(!v.paused){v.__sxAuto=true;v.pause();}
      });
    }
    window.addEventListener('scroll',function(){if(!vt)vt=setTimeout(checkVideos,150);},{passive:true});
    window.addEventListener('resize',function(){if(!vt)vt=setTimeout(checkVideos,150);});
  }else{
    videos.forEach(tryPlay);
  }
})();
