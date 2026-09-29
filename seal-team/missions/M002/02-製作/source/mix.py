import numpy as np, json
from scipy.io import wavfile
from scipy.signal import resample_poly, butter, sosfilt
SR=44100; N=SR*30
def load(p):
    sr,a=wavfile.read(p); a=a.astype(np.float32)
    if a.dtype!=np.float32 or np.abs(a).max()>2: a=a/32768.0
    if a.ndim==2: a=a.mean(1)
    if sr!=SR: a=resample_poly(a,SR//100* (1), sr//100) if False else resample_poly(a,441,sr//100)
    return a.astype(np.float32)
mus=load('music_raw.wav')[:N]; mus=np.pad(mus,(0,max(0,N-len(mus))))
# fade out end
env=np.ones(N); fo=int(29.0*SR); env[fo:]=np.linspace(1,0,N-fo)**1.5; mus*=env
starts=json.load(open('vo_starts.json'))
vo=np.zeros(N,np.float32); voenv=np.zeros(N)
for i,s in enumerate(starts):
    a=load(f'vo{i}.wav'); a=a/np.abs(a).max()*0.9
    # warm it slightly: gentle low-shelf-ish by mixing lowpassed copy
    lp=sosfilt(butter(2,300,'low',fs=SR,output='sos'),a); a=a+0.25*lp
    st=int(s*SR); a=a[:N-st]; vo[st:st+len(a)]+=a; voenv[max(0,st-int(.15*SR)):st+len(a)+int(.25*SR)]=1
k=int(.2*SR); voenv=np.convolve(voenv,np.ones(k)/k,'same')
mus=mus/np.abs(mus).max()*0.55*(1-0.55*voenv)
t=np.arange(N)/SR
sfx=np.zeros(N,np.float32)
def put(at,sig,g=1.0):
    st=int(at*SR); sig=sig[:N-st]; sfx[st:st+len(sig)]+=sig*g
def tone(f,d,dec=8): tt=np.arange(int(d*SR))/SR; return np.sin(2*np.pi*f*tt)*np.exp(-dec*tt)
def noise(d,lo,hi,dec=30):
    n=np.random.default_rng(1).standard_normal(int(d*SR)); n=sosfilt(butter(2,[lo,hi],'band',fs=SR,output='sos'),n); tt=np.arange(len(n))/SR; return n*np.exp(-dec*tt)
def whoosh(d=.5):
    n=np.random.default_rng(2).standard_normal(int(d*SR)); tt=np.linspace(0,1,len(n)); n=sosfilt(butter(2,[400,4000],'band',fs=SR,output='sos'),n); return n*np.sin(np.pi*tt)**2*.25
def M(*a):
    L=max(len(x) for x in a); return sum(np.pad(x,(0,L-len(x))) for x in a)
ding=lambda: M(tone(1318,.6,6)*.5,tone(1760,.6,7)*.35)
# buzz
for k in range(2):
    tt=np.arange(int(.18*SR))/SR; put(.3+k*.25, np.sign(np.sin(2*np.pi*170*tt))*.12*np.hanning(len(tt)))
put(2.65,ding(),.5)
for k in range(9): put(3.27+k*.09+ (k%3)*.01, noise(.03,1500,6000,120),.35)
for k in range(5): put(4.27+k*.08, noise(.03,1200,5000,120),.3)
put(4.65,whoosh(.5),.8)
put(10.25,M(tone(660,.15,25)*.5,noise(.02,800,3000,150)*.3),.8)
put(11.95,whoosh(.35),.9); put(12.02,tone(990,.2,20),.3)
put(12.8,ding(),.35)
put(15.33,noise(.05,1000,8000,80)*.8,1); put(15.42,noise(.06,800,6000,60)*.6,1)
put(16.1-.1,whoosh(.3),.6); put(16.8,ding(),.35)
put(18.15,M(*[tone(f,1.0,4)*.2 for f in [1568,2093,2637]]),.6)
put(19.1,whoosh(.4),.6)
for k,f in enumerate([784,988,1175]): put(19.3+k*.12,tone(f,.4,8),.25)
put(23.85,whoosh(.5),.8); put(24.95,M(tone(880,.25,14)*.6,tone(1320,.25,14)*.3),.4)
mix=mus+vo*1.0+sfx
mix=np.tanh(mix*1.1)/np.tanh(1.1)
mix=mix/np.abs(mix).max()*0.93
wavfile.write('final_audio.wav',SR,(mix*32767).astype(np.int16))
print('ok', np.abs(mix).max())
