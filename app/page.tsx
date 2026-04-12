import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SplineScene } from "@/components/ui/spline-scene";
import AnimatedGradientBackground from "@/components/ui/animated-gradient-background";
import { SparklesCore } from "@/components/ui/sparkles";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";
import { Navbar } from "@/components/ui/navbar";
import {
  CheckCircle, ArrowRight, Clock,
  MapPin, Shield, Zap, Users, Pause, Twitter, Github, AlertTriangle,
} from "lucide-react";
import { FlowraLogo } from "@/components/ui/logo";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black pt-20">
        <div className="container mx-auto px-4">
          <Card className="w-full h-[500px] bg-black/[0.96] relative overflow-hidden border border-white/10 rounded-2xl">
            <div
              className="absolute -top-40 left-0 md:left-60 md:-top-20 pointer-events-none"
              style={{
                background: "radial-gradient(600px circle at center, rgba(99,102,241,0.15), transparent)",
                width: "800px",
                height: "600px",
              }}
            />
            <div className="flex h-full">
              <div className="flex-1 p-10 relative z-10 flex flex-col justify-center">
                <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 w-fit">
                  <FlowraLogo size={14} />
                  <span className="text-xs text-blue-300 font-medium">Programmable Payments on Arc Network</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-white bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-transparent">
                  Meet Flowra —<br />Your Payment Agent
                </h1>
                <p className="mt-4 text-neutral-300 max-w-lg text-base leading-relaxed">
                  Flowra lets you stream USDC to anyone — drip by drip — with smart conditions
                  like location-gating. Perfect for allowances, payroll, milestones, and more.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 mt-8">
                  <a href="/create">
                    <Button size="lg" className="bg-white text-black hover:bg-gray-100">
                      Start with Flowra
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
                  <a href="/dashboard">
                    <Button size="lg" variant="outline" className="border-neutral-600 text-neutral-300 hover:bg-neutral-800 bg-transparent">
                      View Dashboard
                    </Button>
                  </a>
                </div>
                <div className="flex items-center gap-8 text-sm text-neutral-400 mt-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span>No intermediaries</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span>Cancel anytime</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span>Location-aware</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 relative hidden md:block">
                <SplineScene
                  scene="https://prod.spline.design/UbM7F-HZcyTbZ4y3/scene.splinecode"
                  className="w-full h-full"
                />
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section id="how" className="py-24 bg-black">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-white">Sending money the old way is broken</h2>
              <div className="space-y-4 text-gray-300">
                {["Lump-sum transfers with zero control after sending","Allowances paid early then spent all at once","Freelance escrow with trusted intermediaries taking fees","No way to attach real-world conditions to payments"].map((t) => (
                  <p key={t} className="flex items-start gap-3"><span className="text-red-500 mt-1">✗</span>{t}</p>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-white">What Flowra does instead</h2>
              <div className="space-y-4 text-gray-300">
                {["Holds your funds securely in a smart contract","Enforces your conditions — time, location, or proof","Releases payments only when everything checks out","No chasing. No middlemen. No uncertainty."].map((t) => (
                  <p key={t} className="flex items-start gap-3"><CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />{t}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-black">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white">Everything you need</h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">One contract. Infinite payment possibilities.</p>
          </div>
          <BentoGrid className="lg:grid-rows-3 lg:grid-cols-3">
            <BentoCard name="Location-Gated Streams" className="lg:row-start-1 lg:row-end-4 lg:col-start-2 lg:col-end-3" background={
              <div className="absolute inset-0 overflow-hidden border border-white/10">
                <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 600" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="200" cy="280" r="180" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 8"/>
                  <circle cx="200" cy="280" r="120" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 8"/>
                  <circle cx="200" cy="280" r="60" stroke="#3b82f6" strokeWidth="1"/>
                  <circle cx="200" cy="280" r="8" fill="#3b82f6"/>
                  <line x1="200" y1="80" x2="200" y2="480" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="4 8"/>
                  <line x1="20" y1="280" x2="380" y2="280" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="4 8"/>
                  <path d="M200 200 C200 200 230 240 230 265 C230 282 216 295 200 295 C184 295 170 282 170 265 C170 240 200 200 200 200Z" fill="#3b82f6" opacity="0.6"/>
                  <circle cx="200" cy="262" r="10" fill="white" opacity="0.8"/>
                </svg>
                <div className="absolute inset-0 bg-gradient-to-b from-blue-950/60 to-black/80"/>
              </div>
            } Icon={MapPin} description="Receiver can only claim funds when physically inside a defined geographic zone. Great for work attendance, field payments, or location-specific allowances." href="/create" cta="Create stream" />

            <BentoCard name="Time-Based Unlock" className="lg:col-start-1 lg:col-end-2 lg:row-start-1 lg:row-end-3" background={
              <div className="absolute inset-0 overflow-hidden border border-white/10">
                <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="200" cy="170" r="120" stroke="#10b981" strokeWidth="1.5"/>
                  <circle cx="200" cy="170" r="4" fill="#10b981"/>
                  <line x1="200" y1="170" x2="200" y2="80" stroke="#10b981" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="200" y1="170" x2="255" y2="200" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
                  <rect x="60" y="320" width="40" height="30" rx="4" fill="#10b981" opacity="0.4"/>
                  <rect x="110" y="305" width="40" height="45" rx="4" fill="#10b981" opacity="0.5"/>
                  <rect x="160" y="285" width="40" height="65" rx="4" fill="#10b981" opacity="0.6"/>
                  <rect x="210" y="260" width="40" height="90" rx="4" fill="#10b981" opacity="0.7"/>
                  <rect x="260" y="230" width="40" height="120" rx="4" fill="#10b981" opacity="0.9"/>
                </svg>
                <div className="absolute inset-0 bg-gradient-to-b from-green-950/60 to-black/80"/>
              </div>
            } Icon={Clock} description="Funds unlock daily, weekly, or on a custom interval. Receiver sees their available balance grow in real time." href="/create" cta="Create stream" />

            <BentoCard name="Full Sender Control" className="lg:col-start-1 lg:col-end-2 lg:row-start-3 lg:row-end-4" background={
              <div className="absolute inset-0 overflow-hidden border border-white/10">
                <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 220" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="50" y="60" width="70" height="70" rx="16" fill="#f97316" opacity="0.6"/>
                  <rect x="70" y="78" width="10" height="34" rx="3" fill="white"/>
                  <rect x="90" y="78" width="10" height="34" rx="3" fill="white"/>
                  <rect x="155" y="60" width="70" height="70" rx="16" fill="#f97316" opacity="0.4"/>
                  <polygon points="173,78 173,112 200,95" fill="white"/>
                  <rect x="260" y="60" width="70" height="70" rx="16" fill="#ef4444" opacity="0.5"/>
                  <line x1="278" y1="78" x2="312" y2="112" stroke="white" strokeWidth="5" strokeLinecap="round"/>
                  <line x1="312" y1="78" x2="278" y2="112" stroke="white" strokeWidth="5" strokeLinecap="round"/>
                </svg>
                <div className="absolute inset-0 bg-gradient-to-b from-orange-950/60 to-black/80"/>
              </div>
            } Icon={Pause} description="Pause to stop the drip. Resume when ready. Cancel and both parties get their fair share instantly." href="/dashboard" cta="View dashboard" />

            <BentoCard name="Secure & Non-Custodial" className="lg:col-start-3 lg:col-end-3 lg:row-start-1 lg:row-end-2" background={
              <div className="absolute inset-0 overflow-hidden border border-white/10">
                <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 220" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M200 20 L320 65 L320 135 C320 185 200 215 200 215 C200 215 80 185 80 135 L80 65 Z" stroke="#a855f7" strokeWidth="2" fill="#a855f7" fillOpacity="0.15"/>
                  <rect x="170" y="105" width="60" height="50" rx="6" fill="#a855f7" opacity="0.5"/>
                  <path d="M180 105 L180 93 C180 79 220 79 220 93 L220 105" stroke="#a855f7" strokeWidth="3" fill="none" strokeLinecap="round"/>
                  <circle cx="200" cy="130" r="6" fill="white" opacity="0.8"/>
                </svg>
                <div className="absolute inset-0 bg-gradient-to-b from-purple-950/60 to-black/80"/>
              </div>
            } Icon={Shield} description="Funds sit in the smart contract, never in our hands. Your wallet, your rules." href="/#how-it-works" cta="Learn more" />

            <BentoCard name="Instant Claims" className="lg:col-start-3 lg:col-end-3 lg:row-start-2 lg:row-end-3" background={
              <div className="absolute inset-0 overflow-hidden border border-white/10">
                <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 500" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <polygon points="220,40 155,220 210,220 175,460 265,195 205,195" fill="#eab308" opacity="0.7"/>
                  <circle cx="200" cy="250" r="180" stroke="#eab308" strokeWidth="0.5" strokeDasharray="3 6" opacity="0.4"/>
                  <circle cx="200" cy="250" r="130" stroke="#eab308" strokeWidth="0.5" strokeDasharray="3 6" opacity="0.3"/>
                </svg>
                <div className="absolute inset-0 bg-gradient-to-b from-yellow-950/60 to-black/80"/>
              </div>
            } Icon={Zap} description="Receiver can claim anytime — just the portion that has unlocked so far. No waiting, no batching, no delays." href="/dashboard" cta="Open app" />

            <BentoCard name="Emergency Unlock" className="lg:col-start-3 lg:col-end-3 lg:row-start-3 lg:row-end-4" background={
              <div className="absolute inset-0 overflow-hidden border border-white/10">
                <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 220" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <polygon points="200,30 240,110 160,110" stroke="#ef4444" strokeWidth="2" fill="#ef4444" fillOpacity="0.2"/>
                  <line x1="200" y1="55" x2="200" y2="85" stroke="#ef4444" strokeWidth="3" strokeLinecap="round"/>
                  <circle cx="200" cy="98" r="3" fill="#ef4444"/>
                  <circle cx="200" cy="110" r="60" stroke="#ef4444" strokeWidth="1" strokeDasharray="4 4" opacity="0.5"/>
                  <circle cx="200" cy="110" r="90" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="4 8" opacity="0.3"/>
                </svg>
                <div className="absolute inset-0 bg-gradient-to-b from-red-950/60 to-black/80"/>
              </div>
            } Icon={AlertTriangle} description="Receiver requests early access to locked funds. Sender approves a specific percentage — funds release instantly on-chain." href="/dashboard" cta="Learn more" />
          </BentoGrid>
        </div>
      </section>
      {/* How Flowra Works */}
      <section id="how-it-works" className="py-24 bg-black">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white">How Flowra Works</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { n: "1", title: "Assign Flowra", body: "Create a payment stream and define your conditions — time, location, or proof of work." },
              { n: "2", title: "Flowra Monitors", body: "Flowra tracks time intervals, verifies GPS locations, and watches for proof submissions." },
              { n: "3", title: "Flowra Verifies", body: "Conditions are checked automatically or reviewed when needed. Nothing slips through." },
              { n: "4", title: "Flowra Releases Funds", body: "Once everything is met, payment is unlocked instantly on-chain. No delays, no disputes." },
            ].map((s) => (
              <div key={s.n} className="text-center space-y-4">
                <div className="h-16 w-16 bg-white text-black rounded-full flex items-center justify-center mx-auto text-xl font-bold">{s.n}</div>
                <h3 className="text-lg font-bold text-white">{s.title}</h3>
                <p className="text-gray-300 text-sm">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-24 overflow-hidden">
        <AnimatedGradientBackground Breathing={true} gradientColors={["#0A0A0A", "#1e3a5f", "#2d1b6e", "#0A0A0A"]} gradientStops={[35, 60, 80, 100]} />
        <div className="relative z-10 container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="relative h-32 w-full flex flex-col items-center justify-center">
              <div className="w-full absolute inset-0">
                <SparklesCore id="ctasparticles" background="transparent" minSize={0.6} maxSize={1.4} particleDensity={100} className="w-full h-full" particleColor="#FFFFFF" speed={0.8} />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400 relative z-20 text-balance">
                Ready to make money flow?
              </h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/create">
                <Button size="lg" variant="secondary" className="bg-white text-black hover:bg-gray-100">
                  Create Your First Stream <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <a href="/dashboard">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 bg-transparent">
                  Open Dashboard
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative py-16 bg-black border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <FlowraLogo size={28} />
              <span className="text-white font-semibold">Flowra</span>
            </div>
            <p className="text-gray-400 text-sm">Smart payment streams on Arc Network.</p>
            <div className="flex gap-4">
              <a href="https://x.com/1st_bernice" target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"><Twitter className="h-4 w-4" /></a>
              <a href="https://github.com/addnad/drippay" target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"><Github className="h-4 w-4" /></a>
            </div>
          </div>
          <div className="border-t border-white/10 mt-12 pt-8 text-center">
            <p className="text-gray-500 text-sm">© 2026 Flowra. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
