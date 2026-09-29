import mido
BPM=100; TPB=480; beat=TPB
mid=mido.MidiFile(ticks_per_beat=TPB)
def track(ch, prog, vol=100, name=''):
    t=mido.MidiTrack(); mid.tracks.append(t)
    if ch!=9: t.append(mido.Message('program_change',channel=ch,program=prog,time=0))
    t.append(mido.Message('control_change',channel=ch,control=7,value=vol,time=0))
    t.append(mido.Message('control_change',channel=ch,control=91,value=60,time=0))
    return t
meta=mido.MidiTrack(); mid.tracks.append(meta); meta.append(mido.MetaMessage('set_tempo',tempo=mido.bpm2tempo(BPM)))
notes={}  # ch -> list of (start_beat, dur_beats, note, vel)
def add(ch,st,du,n,v): notes.setdefault(ch,[]).append((st,du,n,v))
C=60
chords={'C':[48,55,64,67],'G':[43,55,62,67],'Am':[45,57,64,69],'F':[41,53,60,65],'Em':[40,55,64,67],'Dm':[50,57,62,65]}
# 12.5 bars of 4 beats; bar = 2.4s
prog_=['Am','F','F','C','C','G','Am','F','C','G','Am','F','C']
for bar,ch in enumerate(prog_):
    b0=bar*4; tones=chords[ch]
    if bar<2:   # hesitant sparse piano
        for i,n in enumerate([tones[0]+12,tones[2],tones[3]]): add(0,b0+i*1.33,1.3,n,48)
    elif bar<4: # piano arpeggios + pad
        for i in range(8): add(0,b0+i*.5,.5,[tones[0]+12,tones[1]+12,tones[2]+12,tones[3]+12][i%4],58)
        for n in tones[1:]: add(1,b0,4,n,50)
        add(3,b0,4,tones[0]-12 if tones[0]>=48 else tones[0],60)
    else:
        full = bar>=8
        for i in range(8): add(0,b0+i*.5,.5,[tones[0]+12,tones[1]+12,tones[2]+12,tones[3]+12][i%4],64 if full else 60)
        for n in tones[1:]: add(1,b0,4,n,70 if full else 58)
        root = tones[0] if tones[0]<48 else tones[0]-12
        for i in [0,1.5,2,3]: add(3,b0+i,.9,root,78)
        for i in [.5,1.5,2.5,3.5]: add(2,b0+i,.3,tones[2]+12,56)  # pizzicato offbeats
        # drums
        if bar<12:
            for i in [0,2]: add(9,b0+i,.2,36,70 if full else 55)
            for i in [1,3]: add(9,b0+i,.2,39 if full else 37,60 if full else 40)
            for i in range(8): add(9,b0+i*.5,.1,42,38)
# glockenspiel melody at the "aha" (bars 8-12)
mel=[(0,76),(1,79),(2,81),(3,79),(4,74),(5.5,76),(6,79),(8,81),(9,79),(10,76),(11,72),(12,76),(13,77),(14,79),(16,84),(17,81),(18,79),(19,76),(20,72)]
for st,n in mel: add(4,32+st,1,n,70)
# final chord
for n in [48,55,60,64,67,72]: add(0,48,4,n,70); add(1,48,4,n,60)
add(4,48,3,84,70)
chans={0:(0,110),1:(48,70),2:(45,80),3:(32,100),4:(9,85),9:(0,100)}
for ch,(pg,vol) in chans.items():
    t=track(ch,pg,vol); ev=[]
    for st,du,n,v in notes.get(ch,[]):
        ev.append((int(st*beat),1,n,v)); ev.append((int((st+du)*beat),0,n,0))
    ev.sort(key=lambda e:(e[0],e[1])); last=0
    for tk,on,n,v in ev:
        t.append(mido.Message('note_on' if on else 'note_off',channel=ch,note=n,velocity=v,time=tk-last)); last=tk
mid.save('music.mid')
