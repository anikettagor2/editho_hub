import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Play, CheckCircle2, Video, Sliders, Sparkles, Volume2, Maximize2, Scissors, Music } from "lucide-react";
import { useAuth } from "@/lib/context/auth-context";
import { useState, useEffect } from "react";

export function MarketingHero() {
    const { user } = useAuth();
    
    // Split screen before/after editing slider positions
    const [sliderPos, setSliderPos] = useState(50);
    const [isPlaying, setIsPlaying] = useState(true);
    const [activeTab, setActiveTab] = useState<'timeline' | 'grading'>('timeline');

    // Auto-slide playback effect to simulate rendering/grading sweep
    useEffect(() => {
        if (!isPlaying) return;
        let direction = 1;
        const interval = setInterval(() => {
            setSliderPos((prev) => {
                // Bounce back and forth between 15% and 85% for continuous premium demonstration
                if (prev >= 85) direction = -1;
                if (prev <= 15) direction = 1;
                return prev + direction * 0.8;
            });
        }, 30);
        return () => clearInterval(interval);
    }, [isPlaying]);

    // Derived active clip information based on playhead position
    const getActivePhase = () => {
        if (sliderPos < 35) {
            return {
                title: "Hook Assembly",
                desc: "Trimming dead space & pacing cuts",
                icon: <Scissors className="w-3.5 h-3.5 text-blue-500 animate-bounce" />,
                tag: "Speed Cuts Applied"
            };
        } else if (sliderPos < 70) {
            return {
                title: "Color Grading",
                desc: "Applying cinematic Teal & Orange LUT",
                icon: <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />,
                tag: "Cinematic Grade 4K"
            };
        } else {
            return {
                title: "Audio Mastering",
                desc: "Mixing beats, vocals & sound effects",
                icon: <Music className="w-3.5 h-3.5 text-purple-500 animate-pulse" />,
                tag: "Sound SFX Layered"
            };
        }
    };

    const currentPhase = getActivePhase();

    return (
        <section className="relative min-h-screen flex flex-col justify-center pt-36 pb-24 overflow-hidden bg-gradient-to-b from-[#fafafd] via-[#f7f5ff] to-[#ffffff]">
            {/* Grid & Dot Background Overlay for custom premium aesthetic */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808007_1px,transparent_1px),linear-gradient(to_bottom,#80808007_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-200/20 via-indigo-100/5 to-transparent blur-3xl pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
                <div className="text-center max-w-4xl mx-auto">
                    {/* Floating Glow Badge */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6 }}
                        className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white border border-indigo-100/80 shadow-md shadow-indigo-100/30 mb-8 hover:border-indigo-200 transition-colors cursor-pointer group"
                    >
                        <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                        <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-widest group-hover:text-blue-600 transition-colors">
                            ✦ Premium Video Editing Service
                        </span>
                    </motion.div>

                    {/* Gradient Headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-zinc-950 leading-[1.12] tracking-tight mb-8 max-w-4xl mx-auto font-sans"
                    >
                        Scale your content with <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent inline-block pb-2">Expert Video Editors</span>
                    </motion.h1>

                    {/* Description */}
                    <motion.p
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-lg md:text-xl text-zinc-600 mb-12 leading-relaxed max-w-2xl mx-auto font-normal"
                    >
                        Focus on creating, we'll handle the rest. Get a dedicated post-production team to turn your raw footage into high-converting videos. No hiring stress, just results.
                    </motion.p>

                    {/* CTAs */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
                    >
                        <Link href={user ? "/dashboard" : "/signup"} className="w-full sm:w-auto">
                            <button className="w-full sm:w-auto px-9 py-4.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-xl shadow-blue-200/50 flex items-center justify-center gap-2 group transform active:scale-95">
                                {user ? "Go to Dashboard" : "Get Started Now"}
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </Link>
                        <Link href="#how-it-works" className="w-full sm:w-auto">
                            <button className="w-full sm:w-auto px-9 py-4.5 bg-white text-zinc-900 font-bold rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition-all flex items-center justify-center gap-2 shadow-sm transform active:scale-95">
                                <Play className="w-4 h-4 fill-current text-blue-600" />
                                See How It Works
                            </button>
                        </Link>
                    </motion.div>
                </div>

                {/* State-Of-The-Art Interactive Editor Studio Workspace Teaser */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="max-w-5xl mx-auto bg-zinc-950 rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden relative"
                >
                    {/* Mock OS Toolbar */}
                    <div className="bg-zinc-900 px-6 py-4 flex items-center justify-between border-b border-zinc-800">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-red-500/80" />
                            <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                            <span className="w-3 h-3 rounded-full bg-green-500/80" />
                            <span className="text-[11px] font-mono text-zinc-500 ml-4 tracking-wider">PROJECT_MONTAGE_FINAL_4K.pr</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setIsPlaying(!isPlaying)}
                                className={`text-[10px] font-bold px-3 py-1 rounded-md transition-colors ${isPlaying ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-zinc-800 text-zinc-400 border border-transparent'}`}
                            >
                                {isPlaying ? "● AUTOMATING" : "▶ PREVIEW"}
                            </button>
                            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono border border-zinc-700/50">4K HDR</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 min-h-[350px]">
                        {/* Interactive Screen Player Workspace */}
                        <div className="md:col-span-2 relative bg-black/80 aspect-video md:aspect-auto flex items-center justify-center overflow-hidden group">
                            {/* Before Image (Log unedited gray log footage) */}
                            <img 
                                src="/cinematic_travel_shot.png" 
                                alt="Raw Log Footage" 
                                className="absolute inset-0 w-full h-full object-cover filter grayscale(70%) brightness(75%) contrast(85%)"
                            />

                            {/* Graded Cinematic Preview Image (Slider widths controlled) */}
                            <div 
                                className="absolute inset-0 overflow-hidden"
                                style={{ width: `${sliderPos}%` }}
                            >
                                <img 
                                    src="/cinematic_travel_shot.png" 
                                    alt="Color Graded Footage" 
                                    className="absolute inset-0 w-full h-full object-cover"
                                    style={{ width: "100%", maxWidth: "none" }} // Keeps the image sized correctly
                                />
                            </div>

                            {/* Divider Line */}
                            <div 
                                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.6)] cursor-ew-resize z-20"
                                style={{ left: `${sliderPos}%` }}
                            >
                                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-zinc-900 flex items-center justify-center text-[10px] font-bold shadow-lg border border-zinc-300">
                                    ⇄
                                </div>
                            </div>

                            {/* Split Badges */}
                            <div className="absolute left-4 top-4 bg-black/60 backdrop-blur-sm text-[9px] font-mono tracking-widest text-zinc-400 px-2 py-1 rounded border border-zinc-700/50 select-none z-10">
                                RAW UNEDITED
                            </div>
                            <div className="absolute right-4 top-4 bg-blue-600/80 backdrop-blur-sm text-[9px] font-mono tracking-widest text-white px-2 py-1 rounded border border-blue-500/50 select-none z-10">
                                CINEMATIC EDIT
                            </div>

                            {/* Center Sweep Overlay Notification banner */}
                            <div className="absolute bottom-4 left-4 right-4 bg-zinc-900/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-zinc-800 text-left flex items-center justify-between z-10 transition-all">
                                <div className="flex items-center gap-2.5">
                                    {currentPhase.icon}
                                    <div>
                                        <p className="text-[10px] font-bold text-zinc-300">{currentPhase.title}</p>
                                        <p className="text-[9px] text-zinc-500">{currentPhase.desc}</p>
                                    </div>
                                </div>
                                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold uppercase tracking-wider">
                                    {currentPhase.tag}
                                </span>
                            </div>
                        </div>

                        {/* Adjustments Editor Sidebar Panels */}
                        <div className="bg-zinc-950 p-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-zinc-800">
                            {/* Editor control tab switches */}
                            <div className="space-y-4">
                                <div className="flex gap-2 p-1 bg-zinc-900 rounded-lg border border-zinc-800">
                                    <button 
                                        onClick={() => setActiveTab('timeline')}
                                        className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-colors ${activeTab === 'timeline' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    >
                                        Tracks
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('grading')}
                                        className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-colors ${activeTab === 'grading' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    >
                                        Color Grade
                                    </button>
                                </div>

                                <AnimatePresence mode="wait">
                                    {activeTab === 'grading' ? (
                                        <motion.div 
                                            key="grading"
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            className="space-y-4 pt-2"
                                        >
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-[10px] font-mono">
                                                    <span className="text-zinc-400">Cinematic LUT (Orange & Teal)</span>
                                                    <span className="text-amber-500">Active</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                                                    <motion.div 
                                                        className="h-full bg-amber-500" 
                                                        animate={{ width: `${sliderPos}%` }}
                                                        transition={{ duration: 0.1 }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between text-[10px] font-mono">
                                                    <span className="text-zinc-400">Exposure Adjustment</span>
                                                    <span className="text-zinc-300">{(sliderPos / 100).toFixed(2)} EV</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                                                    <motion.div 
                                                        className="h-full bg-zinc-400" 
                                                        animate={{ width: `${Math.min(100, sliderPos + 10)}%` }}
                                                        transition={{ duration: 0.1 }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between text-[10px] font-mono">
                                                    <span className="text-zinc-400">Saturation & Color Boost</span>
                                                    <span className="text-blue-400">+18%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 w-[65%]" />
                                                </div>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div 
                                            key="timeline"
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            className="space-y-3 pt-2"
                                        >
                                            <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 flex items-center gap-2">
                                                <Video className="w-3.5 h-3.5 text-blue-400" />
                                                <div>
                                                    <p className="text-[10px] font-bold text-zinc-300">V1: Travel Montage</p>
                                                    <p className="text-[8px] text-zinc-500">Cinematic Slow Motion</p>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 flex items-center gap-2">
                                                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                                                <div>
                                                    <p className="text-[10px] font-bold text-zinc-300">FX: Lower Third Graphics</p>
                                                    <p className="text-[8px] text-zinc-500">Smooth Motion Graphic</p>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 flex items-center gap-2">
                                                <Music className="w-3.5 h-3.5 text-purple-400" />
                                                <div>
                                                    <p className="text-[10px] font-bold text-zinc-300">A1: Beat Sync Overlay</p>
                                                    <p className="text-[8px] text-zinc-500">Audio EQ and Effects</p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Export / Render mock speed card info */}
                            <div className="pt-6 border-t border-zinc-900 space-y-3">
                                <div className="flex justify-between items-center text-[10px] font-mono">
                                    <span className="text-zinc-500">Export Estimation</span>
                                    <span className="text-green-500 font-bold">2.4 seconds</span>
                                </div>
                                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 w-[100%] animate-pulse" />
                                </div>
                                <p className="text-[8px] text-zinc-500 leading-normal">
                                    EditoHub editors utilize high-speed cloud clusters to render and deliver cinematic projects within hours.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Timeline Tracks Area */}
                    <div className="bg-zinc-950 p-4 border-t border-zinc-900 text-zinc-400 select-none">
                        <div className="relative pt-2">
                            {/* Tracks */}
                            <div className="space-y-2 relative">
                                {/* Playhead Red Line */}
                                <div 
                                    className="absolute top-0 bottom-0 w-px bg-red-500 z-30 transition-all pointer-events-none"
                                    style={{ left: `${sliderPos}%` }}
                                >
                                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1" />
                                </div>

                                {/* Video Track */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-mono w-6 text-zinc-500">V1</span>
                                    <div className="flex-1 h-6 bg-zinc-900/50 rounded border border-zinc-800/80 overflow-hidden relative flex">
                                        <div className={`h-full border-r border-zinc-800 px-3 flex items-center text-[8px] font-semibold transition-colors ${sliderPos < 35 ? 'bg-blue-600/30 text-blue-300' : 'bg-blue-950/20 text-blue-500'}`} style={{ width: "35%" }}>
                                            Intro Hook
                                        </div>
                                        <div className={`h-full border-r border-zinc-800 px-3 flex items-center text-[8px] font-semibold transition-colors ${sliderPos >= 35 && sliderPos < 70 ? 'bg-blue-600/30 text-blue-300' : 'bg-blue-950/20 text-blue-500'}`} style={{ width: "35%" }}>
                                            Epic Travel
                                        </div>
                                        <div className={`h-full px-3 flex items-center text-[8px] font-semibold transition-colors ${sliderPos >= 70 ? 'bg-blue-600/30 text-blue-300' : 'bg-blue-950/20 text-blue-500'}`} style={{ width: "30%" }}>
                                            Outro Slow
                                        </div>
                                    </div>
                                </div>

                                {/* Text/FX Track */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-mono w-6 text-zinc-500">T1</span>
                                    <div className="flex-1 h-6 bg-zinc-900/50 rounded border border-zinc-800/80 relative flex items-center">
                                        <div 
                                            className={`absolute h-4 rounded text-[7px] font-bold px-2 flex items-center transition-colors ${sliderPos >= 20 && sliderPos < 65 ? 'bg-amber-600/30 text-amber-300 border border-amber-500/20' : 'bg-zinc-900 text-zinc-600'}`}
                                            style={{ left: "20%", width: "45%" }}
                                        >
                                            Cinematic LUT Layer
                                        </div>
                                    </div>
                                </div>

                                {/* Audio Track */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-mono w-6 text-zinc-500">A1</span>
                                    <div className="flex-1 h-6 bg-zinc-900/50 rounded border border-zinc-800/80 relative overflow-hidden flex items-center">
                                        <div className="w-full flex justify-between items-center px-4">
                                            {Array.from({ length: 45 }).map((_, i) => {
                                                const isActive = (sliderPos / 100) * 45 >= i;
                                                return (
                                                    <span 
                                                        key={i} 
                                                        className={`w-[2px] rounded-full transition-all duration-300 ${isActive ? 'bg-purple-500' : 'bg-zinc-800'}`} 
                                                        style={{ 
                                                            height: `${Math.max(4, Math.sin(i * 0.4) * 16 + 8)}px`,
                                                            transform: isActive && isPlaying ? "scaleY(1.2)" : "scaleY(1)"
                                                        }} 
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Features Badges Ribbon */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 pt-16 mt-20 border-t border-indigo-100/40"
                >
                    {[
                        "24hr Turnaround",
                        "Infinite Revisions",
                        "Dedicated Manager",
                        "Fixed Monthly Price"
                    ].map((feature, i) => (
                        <div key={i} className="flex items-center gap-2.5 group cursor-pointer">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform duration-300" />
                            <span className="text-sm font-bold text-zinc-700 group-hover:text-zinc-950 transition-colors">
                                {feature}
                            </span>
                        </div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}

