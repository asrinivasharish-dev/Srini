import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Tablet,
  Maximize,
  RotateCw,
  Wifi,
  WifiOff,
  Battery,
  ShieldCheck,
  Sparkles,
  Zap,
  FolderOpen,
  ArrowLeft,
  Circle,
  Square,
  Minus,
  Settings,
  Bell,
  Cpu,
  Fingerprint,
  Monitor
} from 'lucide-react';
import { ActiveTab } from '../types';
import { triggerHaptic } from '../utils/haptics';

interface AndroidShellProps {
  children: React.ReactNode;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  recentCount?: number;
  onLoadSample?: () => void;
  onAndroidBack?: () => void;
  onAndroidHome?: () => void;
  onAndroidRecents?: () => void;
}

export type DeviceType = 'phone' | 'tablet' | 'responsive';
export type Orientation = 'portrait' | 'landscape';
export type MaterialTheme = 'indigo' | 'emerald' | 'coral' | 'violet';

export const AndroidShell: React.FC<AndroidShellProps> = ({
  children,
  activeTab,
  onSelectTab,
  recentCount = 0,
  onLoadSample,
  onAndroidBack,
  onAndroidHome,
  onAndroidRecents,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('09:41');
  const [navMode, setNavMode] = useState<'3-button' | 'gestures'>('3-button');
  const [deviceType, setDeviceType] = useState<DeviceType>('responsive');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [batteryLevel] = useState<number>(98);
  const [showAndroidInfo, setShowAndroidInfo] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const mins = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleBack = () => {
    triggerHaptic('light');
    if (onAndroidBack) {
      onAndroidBack();
    } else {
      onSelectTab('home');
    }
  };

  const handleHome = () => {
    triggerHaptic('medium');
    if (onAndroidHome) {
      onAndroidHome();
    } else {
      onSelectTab('home');
    }
  };

  const handleRecents = () => {
    triggerHaptic('light');
    if (onAndroidRecents) {
      onAndroidRecents();
    } else {
      onSelectTab('recent');
    }
  };

  const toggleOrientation = () => {
    triggerHaptic('medium');
    setOrientation((prev) => (prev === 'portrait' ? 'landscape' : 'portrait'));
  };

  // Compute container dimensions according to deviceType and orientation
  const getContainerClasses = () => {
    if (deviceType === 'responsive') {
      return 'w-full max-w-6xl my-auto h-screen sm:h-[92vh] sm:rounded-[36px]';
    }

    if (deviceType === 'tablet') {
      if (orientation === 'landscape') {
        return 'w-full max-w-[1020px] my-auto h-[620px] sm:h-[660px] rounded-[36px]';
      }
      return 'w-full max-w-[768px] my-auto h-[860px] sm:h-[920px] rounded-[36px]';
    }

    // Phone mode
    if (orientation === 'landscape') {
      return 'w-full max-w-[840px] my-auto h-[440px] sm:h-[460px] rounded-[36px]';
    }
    return 'w-full sm:max-w-[430px] my-auto h-screen sm:h-[860px] sm:rounded-[50px]';
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-white flex flex-col items-center justify-center p-0 sm:p-4 select-none font-sans overflow-x-hidden">
      {/* Android Device & Orientation Environment Control Bar */}
      <header className="hidden sm:flex w-full max-w-4xl items-center justify-between py-2 px-4 mb-2 bg-[#161922]/90 backdrop-blur-md rounded-2xl border border-[#24272D] shadow-lg text-xs text-[#9CA3AF]">
        {/* Left: Device & System Info */}
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-[#4F46E5]/20 flex items-center justify-center text-[#818CF8]">
            {deviceType === 'tablet' ? (
              <Tablet className="w-3.5 h-3.5" />
            ) : deviceType === 'responsive' ? (
              <Monitor className="w-3.5 h-3.5" />
            ) : (
              <Smartphone className="w-3.5 h-3.5" />
            )}
          </div>
          <div>
            <span className="font-bold text-white text-xs tracking-tight">
              {deviceType === 'tablet'
                ? 'Android Tablet'
                : deviceType === 'responsive'
                ? 'Adaptive Full Screen'
                : 'Android Phone'}
            </span>
            <span className="text-[10px] text-[#10B981] ml-2 font-mono">
              ● {orientation.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Right: Form Factor Switchers & Orientation Toggle */}
        <div className="flex items-center gap-2">
          {/* Device Form Factor Selector */}
          <div className="flex items-center bg-[#0F1115] rounded-full p-0.5 border border-[#24272D] text-[10px]">
            <button
              id="btn-device-phone"
              onClick={() => {
                triggerHaptic('light');
                setDeviceType('phone');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold transition-all ${
                deviceType === 'phone'
                  ? 'bg-[#4F46E5] text-white shadow-sm'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
              title="Phone Viewport"
            >
              <Smartphone className="w-3 h-3" />
              <span>Phone</span>
            </button>

            <button
              id="btn-device-tablet"
              onClick={() => {
                triggerHaptic('light');
                setDeviceType('tablet');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold transition-all ${
                deviceType === 'tablet'
                  ? 'bg-[#4F46E5] text-white shadow-sm'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
              title="Tablet Viewport (Galaxy Tab / Pixel Tablet / iPad)"
            >
              <Tablet className="w-3 h-3" />
              <span>Tablet</span>
            </button>

            <button
              id="btn-device-responsive"
              onClick={() => {
                triggerHaptic('light');
                setDeviceType('responsive');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold transition-all ${
                deviceType === 'responsive'
                  ? 'bg-[#4F46E5] text-white shadow-sm'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
              title="Fluid Adaptive Full Screen"
            >
              <Maximize className="w-3 h-3" />
              <span>Fluid</span>
            </button>
          </div>

          {/* Orientation Rotate Button (Portrait <-> Landscape) */}
          <button
            id="btn-toggle-orientation"
            onClick={toggleOrientation}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold transition-all shadow-sm active:scale-95 ${
              orientation === 'landscape'
                ? 'bg-gradient-to-r from-emerald-600/30 to-teal-600/30 border-emerald-500/50 text-emerald-300'
                : 'bg-[#1F2937] hover:bg-[#374151] border-[#374151] text-white'
            }`}
            title="Rotate Screen (Portrait / Landscape)"
          >
            <RotateCw className="w-3 h-3 text-[#818CF8]" />
            <span className="capitalize">{orientation}</span>
          </button>

          {/* Nav Mode Switch */}
          <div className="hidden md:flex items-center bg-[#0F1115] rounded-full p-0.5 border border-[#24272D] text-[10px]">
            <button
              id="btn-nav-mode-3btn"
              onClick={() => {
                triggerHaptic('light');
                setNavMode('3-button');
              }}
              className={`px-2 py-0.5 rounded-full font-semibold transition-all ${
                navMode === '3-button'
                  ? 'bg-[#4F46E5] text-white shadow-sm'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
              title="3-Button Navigation (Back, Home, Recents)"
            >
              3-Btn
            </button>
            <button
              id="btn-nav-mode-gestures"
              onClick={() => {
                triggerHaptic('light');
                setNavMode('gestures');
              }}
              className={`px-2 py-0.5 rounded-full font-semibold transition-all ${
                navMode === 'gestures'
                  ? 'bg-[#4F46E5] text-white shadow-sm'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
              title="Android Gesture Navigation"
            >
              Gesture
            </button>
          </div>

          {/* Quick Android Info Toggle */}
          <button
            id="btn-android-info-toggle"
            onClick={() => {
              triggerHaptic('light');
              setShowAndroidInfo(!showAndroidInfo);
            }}
            className="p-1 rounded-full bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white transition-all"
            title="Android Device Specifications"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Android Device Specs Sheet Modal (if toggled) */}
      {showAndroidInfo && (
        <div className="hidden sm:block w-full max-w-4xl mb-2 p-3.5 bg-[#1F2937] border border-[#374151] rounded-2xl text-xs space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between pb-1 border-b border-[#374151]">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <Cpu className="w-3.5 h-3.5 text-[#818CF8]" />
              <span>Adaptive Multi-Device Engine</span>
            </div>
            <span className="text-[10px] text-[#10B981] font-semibold bg-[#10B981]/15 px-2 py-0.5 rounded-full">
              Phone • Tablet • Landscape Ready
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-[#9CA3AF]">
            <div>• Form Factor: <span className="text-white font-medium capitalize">{deviceType}</span></div>
            <div>• Orientation: <span className="text-white font-medium capitalize">{orientation}</span></div>
            <div>• Storage: <span className="text-white font-medium">/sdcard/Download</span></div>
            <div>• Sandbox: <span className="text-white font-medium">100% On-Device</span></div>
          </div>
        </div>
      )}

      {/* Android Device Frame Exterior Container */}
      <div className={`relative ${getContainerClasses()} flex flex-col transition-all duration-300`}>
        <div className="relative flex-1 rounded-none sm:rounded-[36px] p-0 sm:p-2.5 bg-transparent sm:bg-gradient-to-b sm:from-[#24272D] sm:via-[#1F2937] sm:to-[#111827] shadow-none sm:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08)] sm:border-[4px] sm:border-[#374151] flex flex-col overflow-hidden">
          
          {/* Camera Punch-Hole (Centered Android Pixel Style for phone/tablet portrait) */}
          {deviceType === 'phone' && orientation === 'portrait' && (
            <div className="hidden sm:flex absolute top-4 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#090A0F] ring-2 ring-[#24272D] z-50 items-center justify-center pointer-events-none">
              <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]/70 ring-1 ring-[#818CF8]/50" />
            </div>
          )}

          {/* Android Screen Display Surface */}
          <div className="relative flex-1 bg-[#0F1115] rounded-none sm:rounded-[28px] overflow-hidden flex flex-col shadow-inner sm:border sm:border-[#24272D]">
            
            {/* Android System Status Bar */}
            <div className="h-9 sm:h-10 px-4 sm:px-6 pt-1 flex items-center justify-between text-xs text-[#9CA3AF] font-medium z-40 bg-[#0F1115]/95 backdrop-blur-md shrink-0 border-b border-[#24272D]/40">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white tracking-tight text-xs">{currentTime}</span>
                <div className="flex items-center gap-1 opacity-70">
                  <Bell className="w-2.5 h-2.5 text-[#818CF8]" />
                </div>
              </div>

              {/* Center Orientation/Form-Factor Badge for Mobile */}
              <div className="sm:hidden flex items-center gap-1 bg-[#1F2937] px-2 py-0.5 rounded-full text-[10px] text-zinc-300">
                <span className="capitalize">{deviceType}</span>
                <span>•</span>
                <span className="capitalize">{orientation}</span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1">
                  {isOnline ? (
                    <>
                      <Wifi className="w-3.5 h-3.5 text-[#9CA3AF]" />
                      <span className="text-[10px] font-bold text-[#818CF8]">5G</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[10px] font-bold text-amber-400">Offline</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 text-white">
                  <span className="text-[10px] font-mono">{batteryLevel}%</span>
                  <Battery className="w-4 h-4 text-[#10B981] fill-[#10B981]/40" />
                </div>
              </div>
            </div>

            {/* Dynamic Android Screen Content Body */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col bg-[#0F1115]">
              {children}
            </div>

            {/* Android System Navigation Bar (Bottom) */}
            <div className="bg-[#0F1115] border-t border-[#24272D]/60 shrink-0 z-40">
              {navMode === '3-button' ? (
                /* Android 3-Button Navigation (Back, Home, Recents) */
                <div className="h-10 sm:h-11 px-8 flex items-center justify-around text-[#9CA3AF]">
                  {/* Android Back Button */}
                  <button
                    id="btn-android-sys-back"
                    onClick={handleBack}
                    className="p-2 sm:p-2.5 rounded-full hover:bg-white/10 active:bg-white/20 active:scale-90 transition-all text-[#9CA3AF] hover:text-white"
                    title="Android Back"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  {/* Android Home Button */}
                  <button
                    id="btn-android-sys-home"
                    onClick={handleHome}
                    className="p-2 sm:p-2.5 rounded-full hover:bg-white/10 active:bg-white/20 active:scale-90 transition-all text-[#9CA3AF] hover:text-white"
                    title="Android Home"
                  >
                    <Circle className="w-4 h-4" />
                  </button>

                  {/* Android Recents Button */}
                  <button
                    id="btn-android-sys-recents"
                    onClick={handleRecents}
                    className="p-2 sm:p-2.5 rounded-full hover:bg-white/10 active:bg-white/20 active:scale-90 transition-all text-[#9CA3AF] hover:text-white relative"
                    title="Android Recents / Processed Files"
                  >
                    <Square className="w-4 h-4" />
                    {recentCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#4F46E5]" />
                    )}
                  </button>
                </div>
              ) : (
                /* Android Gesture Pill Navigation */
                <div
                  className="h-5 sm:h-6 flex items-center justify-center cursor-pointer active:opacity-60"
                  onClick={handleHome}
                  title="Android Gesture Pill (Tap for Home, Swipe up for Recents)"
                >
                  <div className="w-28 h-1 bg-[#4B5563] hover:bg-[#9CA3AF] rounded-full transition-colors" />
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
