class Component extends DCLogic {
  state = {
    theme: this.props.theme ?? 'dark',
    view: this.props.startScreen ?? 'home',
    tool: 'route',
    frame: 0,
    playing: false,
    cat: '전체',
    zones: this.props.showRuleZones ?? true,
    loop: true,
    speed: '1.0×',
    teamColor: '#d93a3a',
    formation: '1-2-1',
    courtMode: null,
  };

  halfFrames = [
    { name: '셋업', note: '4번이 하프라인에서 볼을 잡고 좌우 윙(2·3번)의 침투 타이밍을 만든다.',
      a:[{n:4,x:250,y:95},{n:2,x:140,y:175},{n:3,x:352,y:175}],
      b:[{n:'G',x:250,y:377,gk:true},{n:2,x:250,y:270},{n:3,x:330,y:229}],
      ball:{x:250,y:117},
      arrows:[
        {d:'M250,113 C 296,127 332,147 346,161', color:'#fbbf24', w:3, dash:'9 9'},
        {d:'M352,175 C 360,217 358,245 354,263', color:'#38bdf8', w:3.4, dash:''},
      ] },
    { name: '측면 침투', note: '3번이 골 지역 옆으로 파고들고, 2번은 반대편에서 크로스를 대비한다.',
      a:[{n:4,x:250,y:125},{n:2,x:140,y:239},{n:3,x:352,y:273}],
      b:[{n:'G',x:250,y:377,gk:true},{n:2,x:250,y:283},{n:3,x:302,y:305}],
      ball:{x:350,y:291},
      arrows:[
        {d:'M350,291 C 322,321 292,341 272,355', color:'#fbbf24', w:3, dash:'9 9'},
        {d:'M140,239 C 150,285 160,313 166,329', color:'#38bdf8', w:3.4, dash:''},
      ] },
    { name: '스핀킥 마무리', note: '2번이 골 지역 앞에서 스핀킥으로 마무리한다.',
      a:[{n:4,x:250,y:145},{n:2,x:172,y:333},{n:3,x:352,y:301}],
      b:[{n:'G',x:238,y:373,gk:true},{n:2,x:252,y:303},{n:3,x:300,y:313}],
      ball:{x:182,y:343},
      arrows:[
        {d:'M182,345 C 202,361 220,371 234,379', color:'#fbbf24', w:5, dash:''},
      ] },
  ];

  courtDefs = {
    full:  { label:'풀 코트', dims:'30 × 18 m', vb:'0 0 800 500', w:800, h:500,
      desc:'규격 최대 크기의 전체 코트. 4v4 전술 전개와 전환 훈련에 적합합니다.' },
    half:  { label:'하프 코트', dims:'18 × 15 m · 90° 회전', vb:'0 0 500 425', w:500, h:425,
      desc:'공격 진영만 세로로 확대. 마무리·세트피스 훈련에 적합합니다.' },
    flat:  { label:'플랫 코트', dims:'라인 없음', vb:'0 0 500 425', w:500, h:425,
      desc:'하프 코트에서 라인을 제거한 자유 배치용. 위치 개념 설명에 적합합니다.' },
  };

  frames = [
    { name: '셋업', note: '4번이 공을 잡고 측면(3번)으로 전개 준비. 상대는 중앙에 밀집한다.',
      a:[{n:'G',x:48,y:250,gk:true},{n:2,x:250,y:145},{n:3,x:250,y:355},{n:4,x:388,y:250}],
      b:[{n:'G',x:752,y:250,gk:true},{n:2,x:560,y:165},{n:3,x:560,y:335},{n:4,x:468,y:258}],
      ball:{x:414,y:250},
      arrows:[
        {d:'M392,250 C 340,300 292,338 272,352', color:'#fbbf24', w:3, dash:'9 9'},
        {d:'M250,355 C 330,392 402,408 462,404', color:'#38bdf8', w:3.4, dash:''},
      ] },
    { name: '측면 침투', note: '3번이 사이드라인을 타고 전진하고, 2번은 골 지역 앞으로 침투한다.',
      a:[{n:'G',x:48,y:250,gk:true},{n:2,x:382,y:150},{n:3,x:470,y:400},{n:4,x:344,y:256}],
      b:[{n:'G',x:752,y:250,gk:true},{n:2,x:560,y:238},{n:3,x:560,y:335},{n:4,x:518,y:335}],
      ball:{x:468,y:398},
      arrows:[
        {d:'M470,400 C 542,408 592,408 622,408', color:'#38bdf8', w:3.4, dash:''},
        {d:'M382,150 C 480,158 560,176 598,190', color:'#38bdf8', w:3.4, dash:''},
        {d:'M626,404 C 660,348 654,300 648,272', color:'#fbbf24', w:3, dash:'9 9'},
      ] },
    { name: '크로스 & 마무리', note: '3번의 크로스를 2번이 스핀킥으로 마무리한다.',
      a:[{n:'G',x:48,y:250,gk:true},{n:2,x:602,y:205},{n:3,x:620,y:404},{n:4,x:425,y:256}],
      b:[{n:'G',x:742,y:262,gk:true},{n:2,x:612,y:282},{n:3,x:648,y:335},{n:4,x:560,y:335}],
      ball:{x:648,y:246},
      arrows:[
        {d:'M648,248 C 686,246 716,248 736,251', color:'#fbbf24', w:5, dash:''},
      ] },
  ];

  navDefs = [
    { key:'home', label:'대문', icon:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/></svg>' },
    { key:'library', label:'목록', icon:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>' },
    { key:'editor', label:'편집기', icon:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 4.5 19.5 8.5 8 20H4v-4z"/><path d="M13.5 6.5 17.5 10.5"/></svg>' },
    { key:'present', label:'시연', icon:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8.5 20h7"/></svg>' },
    { key:'settings', label:'설정', icon:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M4.2 7.2l2.6 1.5M17.2 15.3l2.6 1.5M4.2 16.8l2.6-1.5M17.2 8.7l2.6-1.5"/></svg>' },
  ];

  toolDefs = [
    { key:'select', label:'선택', icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.5 18 2.3-7.2L20 11.5z"/></svg>' },
    { key:'route', label:'이동', icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20c8 0 8-14 16-14"/><path d="M14 6h6v6"/></svg>' },
    { key:'pass', label:'패스', icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 3"><path d="M4 12h13"/><path d="M13 7l6 5-6 5"/></svg>' },
    { key:'ball', label:'공', icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5v17" opacity=".55"/></svg>' },
    { key:'add', label:'선수', icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="4" width="9" height="13" rx="2"/><path d="M18 8v6M15 11h6"/></svg>' },
    { key:'text', label:'메모', icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 6h14M12 6v13"/></svg>' },
    { key:'erase', label:'지우개', icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16l7-7 7 7-4 4H8z"/><path d="M9 21h11"/></svg>' },
  ];

  drillDefs = [
    { title:'측면 돌파 후 크로스', cat:'공격', level:'중급', dur:'8분', steps:5,
      dots:[{x:60,y:56,c:'#d93a3a'},{x:110,y:126,c:'#d93a3a'},{x:196,y:46,c:'#2b7fd4'},{x:238,y:120,c:'#2b7fd4'}],
      arrow:'M124,132 C 178,140 216,90 250,62' },
    { title:'2-1 상황 회피 패스', cat:'볼 운반', level:'초급', dur:'6분', steps:4,
      dots:[{x:82,y:91,c:'#d93a3a'},{x:146,y:44,c:'#d93a3a'},{x:146,y:130,c:'#2b7fd4'},{x:196,y:91,c:'#2b7fd4'}],
      arrow:'M118,96 C 150,66 184,64 204,88' },
    { title:'골 지역 2인 규칙 로테이션', cat:'수비', level:'중급', dur:'10분', steps:6,
      dots:[{x:246,y:58,c:'#2b7fd4'},{x:246,y:120,c:'#2b7fd4'},{x:278,y:91,c:'#2b7fd4'},{x:182,y:91,c:'#d93a3a'}],
      arrow:'M254,68 C 282,76 288,118 258,128' },
    { title:'스핀킥 슛 마무리', cat:'슈팅', level:'고급', dur:'7분', steps:4,
      dots:[{x:152,y:91,c:'#d93a3a'},{x:214,y:66,c:'#d93a3a'},{x:276,y:91,c:'#2b7fd4'}],
      arrow:'M200,96 C 232,74 264,84 290,94' },
    { title:'킥인 세트피스', cat:'세트피스', level:'중급', dur:'5분', steps:3,
      dots:[{x:16,y:91,c:'#d93a3a'},{x:72,y:50,c:'#d93a3a'},{x:112,y:130,c:'#d93a3a'},{x:176,y:91,c:'#2b7fd4'}],
      arrow:'M38,96 C 92,66 134,76 166,94' },
    { title:'전방 압박 트랩', cat:'수비', level:'고급', dur:'9분', steps:6,
      dots:[{x:204,y:50,c:'#d93a3a'},{x:204,y:130,c:'#d93a3a'},{x:246,y:91,c:'#2b7fd4'},{x:286,y:91,c:'#2b7fd4'}],
      arrow:'M212,64 C 240,78 246,86 252,92' },
  ];

  catColor = { '공격':'#d93a3a', '수비':'#2b7fd4', '슈팅':'#e08a12', '세트피스':'#7c5cd6', '볼 운반':'#128a5c' };

  componentWillUnmount(){ if(this._iv) clearInterval(this._iv); }
  stop(){ if(this._iv){clearInterval(this._iv);this._iv=null;} }

  interval(){ const s=this.state.speed; return s==='0.5×'?2400 : s==='2.0×'?800 : 1500; }
  activeFrames(){ return (this.state.courtMode && this.state.courtMode!=='full') ? this.halfFrames : this.frames; }

  togglePlay = () => {
    if (this.state.playing) { this.stop(); this.setState({playing:false}); return; }
    this.setState({playing:true});
    this._iv = setInterval(() => {
      const len = this.activeFrames().length;
      this.setState(s => {
        const last = s.frame >= len-1;
        if (last && !s.loop) { this.stop(); return { playing:false }; }
        return { frame: last ? 0 : s.frame+1 };
      });
    }, this.interval());
  };
  nextFrame = () => { const len=this.activeFrames().length; this.stop(); this.setState(s=>({playing:false, frame:(s.frame+1)%len})); };
  prevFrame = () => { const len=this.activeFrames().length; this.stop(); this.setState(s=>({playing:false, frame:(s.frame-1+len)%len})); };
  selectFrame = (i) => { this.stop(); this.setState({playing:false, frame:i}); };
  go = (v) => { this.stop(); this.setState({view:v, playing:false}); };
  toggleTheme = () => this.setState(s=>({theme:s.theme==='dark'?'light':'dark'}));

  pickCourt = (m) => { this.stop(); this.setState({courtMode:m, frame:0, playing:false}); };

  courtPreview(mode){
    const line = { fill:'none', stroke:'rgba(255,255,255,.95)', strokeWidth:2.2 };
    if (mode==='full') return React.createElement('svg', {viewBox:'0 0 200 125', width:'100%', height:'100%', preserveAspectRatio:'xMidYMid meet'},
      React.createElement('rect', {x:8,y:8,width:184,height:109,...line}),
      React.createElement('line', {x1:100,y1:8,x2:100,y2:117,...line}),
      React.createElement('circle', {cx:100,cy:62.5,r:18,...line}),
      React.createElement('path', {d:'M8,38 L38,38 L38,87 L8,87',...line,strokeWidth:1.8}),
      React.createElement('path', {d:'M192,38 L162,38 L162,87 L192,87',...line,strokeWidth:1.8}));
    if (mode==='half') return React.createElement('svg', {viewBox:'0 0 125 150', width:'100%', height:'100%', preserveAspectRatio:'xMidYMid meet'},
      React.createElement('path', {d:'M10,8 L10,142 L115,142 L115,8',...line}),
      React.createElement('line', {x1:10,y1:8,x2:115,y2:8,...line}),
      React.createElement('path', {d:'M44,8 A18.5,18.5 0 0 0 81,8',...line}),
      React.createElement('path', {d:'M40,142 L40,102 L85,102 L85,142',...line,strokeWidth:1.8}),
      React.createElement('circle', {cx:44,cy:142,r:3,fill:'#f5f5f5',stroke:'#c2410c',strokeWidth:1.2}),
      React.createElement('circle', {cx:81,cy:142,r:3,fill:'#f5f5f5',stroke:'#c2410c',strokeWidth:1.2}));
    return React.createElement('svg', {viewBox:'0 0 125 150', width:'100%', height:'100%', preserveAspectRatio:'xMidYMid meet'},
      React.createElement('rect', {x:10,y:8,width:105,height:134,rx:6,fill:'rgba(255,255,255,.14)',stroke:'rgba(255,255,255,.4)',strokeWidth:1.6,strokeDasharray:'5 5'}));
  }

  renderVals(){
    const S = this.state, v = S.view;
    const mode = S.courtMode || 'full';
    const half = mode !== 'full';
    const src = half ? this.halfFrames : this.frames;
    const cd = this.courtDefs[mode];
    const f = src[Math.min(S.frame, src.length-1)], n = src.length;
    const dark = S.theme==='dark';
    const on = 'var(--accent)', onInk = 'var(--accent-ink)';
    const pill = (active) => ({ bg: active?on:'transparent', fg: active?onInk:'var(--muted)' });

    const nav = this.navDefs.map(d => ({
      label: d.label, active: v===d.key,
      color: v===d.key ? 'var(--text)' : 'var(--faint)',
      icon: React.createElement('span', { style:{display:'flex', color: v===d.key?'var(--accent)':'currentColor'}, dangerouslySetInnerHTML:{__html:d.icon} }),
      go: () => this.go(d.key),
    }));

    const titles = {
      home:['대문','오늘의 훈련 현황과 빠른 시작'],
      library:['드릴 라이브러리','저장된 드릴을 열어 편집하거나 시연하세요'],
      editor:['측면 돌파 후 크로스','공격 전개 · 중급 · 8분 · 4v4'],
      present:['시연 모드','팀 앞에서 드릴을 단계별로 보여주세요'],
      settings:['설정','앱 동작과 팀 기본값'],
    };
    let [pageTitle, pageSub] = titles[v] || titles.home;
    if ((v==='editor'||v==='present') && !S.courtMode) { pageTitle = '코트 선택'; pageSub = '진행할 코트 형태를 고르세요'; }
    else if (v==='editor'||v==='present') pageSub = `${cd.label} · ${cd.dims} · ${n}스텝`;

    const primary = {
      home:['새 드릴', () => this.go('editor')],
      library:['새 드릴', () => this.go('editor')],
      editor:['저장', () => {}],
      present:['편집으로', () => this.go('editor')],
    }[v];

    const plusIcon = React.createElement('svg', {width:15,height:15,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2.6,strokeLinecap:'round',
      dangerouslySetInnerHTML:{__html:'<path d="M12 5v14M5 12h14"/>'}});

    const chips = [];
    const mk = (c, team) => {
      const gk = !!c.gk;
      const mine = team==='a';
      const color = gk ? (mine ? '#f2c811' : '#22a95b') : (mine ? S.teamColor : '#2b7fd4');
      const ink = (gk && mine) ? '#3a2e00' : '#ffffff';
      const nx = half ? 0 : (mine ? 5 : -5);
      const ny = half ? (mine ? 5 : -5) : 0;
      return { key: team+c.n, num: c.n, color, textColor: ink,
        horiz: !half, vert: half,
        headX: mine ? -12 : 12,
        headY: mine ? -12 : 12,
        numEl: React.createElement('text', { x:nx, y:ny, fontFamily:"'Space Grotesk',sans-serif", fontSize:20,
          fontWeight:700, fill:ink, textAnchor:'middle', dominantBaseline:'central' }, String(c.n)),
        gstyle: { transform:`translate(${c.x}px,${c.y}px)`, transition:'transform .6s cubic-bezier(.4,0,.2,1)' } };
    };
    f.a.forEach(c=>chips.push(mk(c,'a')));
    f.b.forEach(c=>chips.push(mk(c,'b')));

    const arrows = f.arrows.map(a => ({...a, marker: a.color==='#fbbf24' ? 'url(#mkAmber)' : 'url(#mkCyan)'}));
    const pArrows = f.arrows.map(a => ({...a, marker: a.color==='#fbbf24' ? 'url(#pkAmber)' : 'url(#pkCyan)'}));

    const categories = ['전체','공격','수비','슈팅','세트피스','볼 운반'].map(label => {
      const active = S.cat===label;
      return { label, pick: () => this.setState({cat:label}),
        style:`padding:7px 14px;border-radius:9px;font-size:12.5px;font-weight:600;border:1px solid ${active?'transparent':'var(--border)'};background:${active?on:'transparent'};color:${active?onInk:'var(--muted)'}` };
    });

    const drills = this.drillDefs
      .filter(d => S.cat==='전체' || d.cat===S.cat)
      .map(d => ({...d, tagBg:this.catColor[d.cat], open: () => this.go('editor')}));

    const tools = this.toolDefs.map(t => ({
      label:t.label, active:S.tool===t.key,
      color: S.tool===t.key ? 'var(--text)' : 'var(--faint)',
      icon: React.createElement('span',{style:{display:'flex',color:S.tool===t.key?'var(--accent)':'currentColor'},dangerouslySetInnerHTML:{__html:t.icon}}),
      select: () => this.setState({tool:t.key}),
    }));

    const roster = [
      {num:'G',name:'골키퍼',role:'GK',color:'#f2c811',ink:'#3a2e00'},
      {num:2,name:'수비수',role:'DF',color:S.teamColor,ink:'#fff'},
      {num:3,name:'윙',role:'WG',color:S.teamColor,ink:'#fff'},
      {num:4,name:'플레이메이커',role:'PM',color:S.teamColor,ink:'#fff'},
      {num:'G',name:'상대 GK',role:'GK',color:'#22a95b',ink:'#fff'},
      {num:2,name:'상대 2',role:'DF',color:'#2b7fd4',ink:'#fff'},
      {num:3,name:'상대 3',role:'DF',color:'#2b7fd4',ink:'#fff'},
      {num:4,name:'상대 4',role:'MF',color:'#2b7fd4',ink:'#fff'},
    ];

    const steps = src.map((fr,i) => {
      const cur = i===S.frame;
      return { num:i+1, name:fr.name, note:fr.note,
        border: cur?on:'var(--border)',
        bg: cur?'color-mix(in srgb,var(--accent) 9%,transparent)':'transparent',
        numBg: cur?on:'var(--elev)', numInk: cur?onInk:'var(--muted)',
        barBg: i<=S.frame ? on : 'var(--elev)',
        select: () => this.selectFrame(i) };
    });

    const frameNodes = src.map((fr,i) => ({
      left:`${(i/(n-1))*100}%`,
      dotBorder: i<=S.frame?on:'var(--border-strong)',
      dotBg: i===S.frame?on:'var(--panel)',
      select: () => this.selectFrame(i) }));

    return {
      theme:S.theme, isDark:dark, isLight:!dark, toggleTheme:this.toggleTheme,
      isHome:v==='home', isLibrary:v==='library', isEditor:v==='editor', isPresent:v==='present', isSettings:v==='settings',
      needsCourtPick: (v==='editor'||v==='present') && !S.courtMode,
      showEditorBody: v==='editor' && !!S.courtMode,
      showPresentBody: v==='present' && !!S.courtMode,
      isFull: mode==='full', isHalf: mode==='half', isFlat: mode==='flat',
      courtVB: cd.vb, surfW: cd.w, surfH: cd.h,
      courtLabel: `${cd.label}\n${cd.dims}`,
      showCourtSwitch: (v==='editor'||v==='present') && !!S.courtMode,
      courtSwitch: ['full','half','flat'].map(m => ({
        short: m==='full'?'풀':m==='half'?'하프':'플랫', title: this.courtDefs[m].label,
        bg: mode===m ? on : 'transparent', fg: mode===m ? onInk : 'var(--muted)',
        pick: () => this.pickCourt(m) })),
      courtOpts: ['full','half','flat'].map(m => ({
        title: this.courtDefs[m].label, desc: this.courtDefs[m].desc, dims: this.courtDefs[m].dims,
        preview: this.courtPreview(m), pick: () => this.pickCourt(m) })),
      nav, pageTitle, pageSub,
      courtBg: dark ? '#1f7a46' : '#2f9e5c',
      showPrimary: !!primary && !((v==='editor'||v==='present') && !S.courtMode),
      primaryLabel: primary?primary[0]:'', primaryAction: primary?primary[1]:()=>{}, primaryIcon: plusIcon,
      showPresentBtn: (v==='editor' && !!S.courtMode) || v==='library',
      goPresent: () => this.go('present'), goEditor: () => this.go('editor'), goLibrary: () => this.go('library'),

      stats: [
        {label:'저장된 드릴', value:'24', unit:'개'},
        {label:'이번 주 훈련', value:'3', unit:'회'},
        {label:'등록 선수', value:'9', unit:'명'},
        {label:'평균 드릴 길이', value:'7.2', unit:'분'},
      ],
      recent: this.drillDefs.slice(0,4).map((d,i)=>({
        title:d.title, steps:d.steps, meta:`${d.cat} · ${d.level} · ${d.dur}`,
        when:['2시간 전','어제','3일 전','지난주'][i],
        swatch:this.catColor[d.cat], open: () => this.go('editor') })),
      session: [
        {name:'웜업 · 볼 컨트롤', dur:'15분', dot:'#128a5c'},
        {name:'측면 돌파 후 크로스', dur:'8분', dot:'#d93a3a'},
        {name:'전방 압박 트랩', dur:'9분', dot:'#2b7fd4'},
      ],

      categories, drills, tools, roster, steps, chips, arrows, pArrows, frameNodes,
      showRuleZones: S.zones,
      ballStyle: { transform:`translate(${f.ball.x}px,${f.ball.y}px)`, transition:'transform .6s cubic-bezier(.4,0,.2,1)' },
      playing:S.playing, paused:!S.playing,
      togglePlay:this.togglePlay, nextFrame:this.nextFrame, prevFrame:this.prevFrame,
      frameLabel:`${S.frame+1}/${n}`, frameName:f.name, frameNote:f.note,
      frameCount:`총 ${n}스텝`, progressPct:`${(S.frame/(n-1))*100}%`, speedLabel:S.speed,

      themeOpts: [
        {label:'다크', ...pill(dark), pick:()=>this.setState({theme:'dark'})},
        {label:'라이트', ...pill(!dark), pick:()=>this.setState({theme:'light'})},
      ],
      speedOpts: ['0.5×','1.0×','2.0×'].map(l=>({label:l, ...pill(S.speed===l), pick:()=>this.setState({speed:l})})),
      formationOpts: ['1-2-1','2-1-1','1-1-2'].map(l=>({label:l, ...pill(S.formation===l), pick:()=>this.setState({formation:l})})),
      teamColors: ['#d93a3a','#2b7fd4','#e08a12','#7c5cd6'].map(c=>({
        value:c, ring: S.teamColor===c ? 'var(--accent)' : 'transparent',
        pick:()=>this.setState({teamColor:c}) })),
      toggleZones: () => this.setState(s=>({zones:!s.zones})),
      zoneTrack: S.zones ? on : 'var(--border-strong)', zoneKnob: S.zones ? '23px' : '3px',
      toggleLoop: () => this.setState(s=>({loop:!s.loop})),
      loopTrack: S.loop ? on : 'var(--border-strong)', loopKnob: S.loop ? '23px' : '3px',
    };
  }
}
