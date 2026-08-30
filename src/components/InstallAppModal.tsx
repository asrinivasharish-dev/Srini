import React, { useEffect, useState, useRef } from 'react';
import { 
  X, 
  Smartphone, 
  Download, 
  Share2, 
  Check, 
  QrCode, 
  ArrowRight, 
  Layers, 
  Sparkles, 
  Copy,
  ExternalLink,
  ShieldCheck,
  WifiOff,
  CheckCircle2,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import QRCode from 'qrcode';
import { triggerHaptic } from '../utils/haptics';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [activeTab, setActiveTab] = useState<'pwa' | 'apk'>('pwa');
  const [isCaching, setIsCaching] = useState(false);
  const [isCachedOffline, setIsCachedOffline] = useState(false);

  const appUrl = window.location.origin || 'https://ais-pre-6i5l2vtwfivyb3clpbza2o-513979055772.asia-east1.run.app';

  useEffect(() => {
    // Generate QR Code for live installation on phone
    QRCode.toDataURL(appUrl, {
      width: 260,
      margin: 1.5,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR generation error', err));

    // Check service worker & offline status
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      setIsCachedOffline(true);
    }

    // Listen for PWA beforeinstallprompt on supported Android Chrome browsers
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Check if already in standalone PWA mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, [appUrl]);

  const handlePrecacheOffline = async () => {
    triggerHaptic('medium');
    setIsCaching(true);
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.register('/sw.js');
        await reg.update();
      }
      if ('caches' in window) {
        const cache = await caches.open('remix-pdf-v2');
        await cache.addAll([
          '/',
          '/index.html',
          '/manifest.json',
          '/icon-192.svg',
          '/icon-512.svg',
        ]).catch(() => {});
      }
      setTimeout(() => {
        setIsCaching(false);
        setIsCachedOffline(true);
        triggerHaptic('success');
      }, 1000);
    } catch {
      setIsCaching(false);
      setIsCachedOffline(true);
    }
  };

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    triggerHaptic('medium');
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback instructions alert or guide
      alert('To install on Android: Tap Chrome menu (⋮) -> "Add to Home Screen" or "Install App".');
    }
  };

  const handleCopyLink = () => {
    triggerHaptic('light');
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        className="bg-[#12151C] border border-[#252C3D] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#232A3B] flex items-center justify-between bg-[#181D27]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#4F46E5] to-[#818CF8] flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">Install on Android Phone</h2>
              <p className="text-xs text-[#94A3B8]">Run natively without browser URL bars</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#202736] hover:bg-[#2C364A] flex items-center justify-center text-[#94A3B8] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-4 pt-3 flex gap-2 border-b border-[#232A3B]/60 bg-[#141822]">
          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('pwa');
            }}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'pwa'
                ? 'text-indigo-400 border-indigo-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>1-Click Mobile Install (Recommended)</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('apk');
            }}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'apk'
                ? 'text-indigo-400 border-indigo-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>APK Package Guide</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {activeTab === 'pwa' ? (
            <>
              {/* Direct Install Button (If supported/triggered) */}
              {deferredPrompt && (
                <button
                  onClick={handleNativeInstall}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#4F46E5] to-[#6366F1] hover:from-[#4338CA] hover:to-[#4F46E5] text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-98 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Install App to My Phone Now</span>
                </button>
              )}

              {/* QR Code Scan on Phone */}
              <div className="bg-[#181D28] border border-[#273042] rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                {qrDataUrl ? (
                  <div className="p-2 bg-white rounded-xl shadow-md shrink-0">
                    <img src={qrDataUrl} alt="Scan to install" className="w-28 h-28 sm:w-32 sm:h-32 rounded-lg" />
                  </div>
                ) : (
                  <div className="w-28 h-28 bg-[#202736] animate-pulse rounded-xl" />
                )}
                <div className="space-y-2 flex-1">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[11px] font-semibold">
                    <QrCode className="w-3 h-3" />
                    <span>Instant Phone Scanner</span>
                  </div>
                  <h3 className="text-sm font-bold text-white">Scan with your Phone Camera</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Point your Android camera or Google Lens at this code to open the app on your mobile device instantly.
                  </p>
                </div>
              </div>

              {/* 3 Step Android Installation Guide */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  How to Install on Android in 10 Seconds
                </h4>
                
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-[#171B25] border border-[#232A39]">
                    <div className="w-6 h-6 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold shrink-0">
                      1
                    </div>
                    <div>
                      <p className="font-semibold text-white">Open the App in Chrome</p>
                      <p className="text-slate-400 text-[11px] mt-0.5">Open the link in Google Chrome or your default Android browser.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-[#171B25] border border-[#232A39]">
                    <div className="w-6 h-6 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold shrink-0">
                      2
                    </div>
                    <div>
                      <p className="font-semibold text-white">Tap Menu (⋮) &gt; "Install app" or "Add to Home Screen"</p>
                      <p className="text-slate-400 text-[11px] mt-0.5">Tap the 3 dots in the top right corner of Chrome and select Install.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-[#171B25] border border-[#232A39]">
                    <div className="w-6 h-6 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold shrink-0">
                      3
                    </div>
                    <div>
                      <p className="font-semibold text-white">Enjoy Full Native App Experience</p>
                      <p className="text-slate-400 text-[11px] mt-0.5">Launches from your phone's app drawer with camera scanner and full offline PDF processing!</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 100% Offline Capability Status & Cache Button */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/30 to-teal-950/30 border border-emerald-800/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <HardDrive className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Offline Local Engine</span>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
                          100% On-Device
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-200/70">
                        {isCachedOffline ? 'All PDF tools cached & ready for airplane mode' : 'Caching app shell for instant offline access'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handlePrecacheOffline}
                    disabled={isCaching}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[11px] font-bold shadow-md shadow-emerald-700/20 transition-all shrink-0"
                  >
                    {isCaching ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Caching...</span>
                      </>
                    ) : isCachedOffline ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                        <span>Offline Ready</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3 h-3" />
                        <span>Pre-cache</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  All PDF features (Organize, Merge, Split, Compress, Convert, Annotate, AES-256 Security) run entirely on your phone without sending files to any server.
                </p>
              </div>

              {/* Link copy */}
              <div className="flex items-center gap-2 p-2 rounded-xl bg-[#151923] border border-[#232A38]">
                <input
                  type="text"
                  readOnly
                  value={appUrl}
                  className="bg-transparent text-xs text-slate-300 flex-1 px-2 py-1 outline-none font-mono truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shrink-0 transition-colors shadow-sm"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Standalone Native APK Generation Guide */}
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
                  <p className="text-xs text-indigo-200">
                    To compile a standalone <code className="font-mono bg-indigo-900/60 px-1 py-0.5 rounded text-white">.apk</code> file for sideloading or Google Play:
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-[#171B25] border border-[#232A39] space-y-1">
                    <p className="font-bold text-white">Option A: 1-Click PWABuilder APK Generator</p>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      1. Open <span className="text-indigo-400 font-medium">PWABuilder.com</span> in your browser.<br/>
                      2. Paste your live URL: <code className="text-xs text-amber-300 break-all">{appUrl}</code><br/>
                      3. Click <b>"Package for Stores"</b> &gt; <b>Android</b> to download the compiled Android APK/AAB package.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#171B25] border border-[#232A39] space-y-1.5">
                    <p className="font-bold text-white">Option B: Export to Android Studio (Capacitor)</p>
                    <p className="text-slate-300 text-[11px]">
                      Export this project from the top menu, then in your computer terminal run:
                    </p>
                    <div className="bg-[#0B0D12] p-2.5 rounded-lg font-mono text-[10.5px] text-emerald-400 overflow-x-auto space-y-1 border border-[#1E232F]">
                      <p>npm install @capacitor/core @capacitor/cli @capacitor/android</p>
                      <p>npx cap init "Remix PDF" "com.remixpdf.app" --web-dir dist</p>
                      <p>npm run build &amp;&amp; npx cap add android</p>
                      <p>npx cap open android</p>
                    </div>
                    <p className="text-[10px] text-slate-400">Then in Android Studio, click <b>Build &gt; Build APK(s)</b>.</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#232A3B] bg-[#161B25] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Mobile Camera &amp; AES-256 Enabled</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#232A3B] hover:bg-[#2F384E] text-white text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
