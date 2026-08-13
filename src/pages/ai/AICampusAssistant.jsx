// AICampusAssistant.jsx — Module 17
import { MessageCircle, Mic, Globe, Send, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import MonitoringLayout, { MCard } from '../../components/monitoring/MonitoringLayout.jsx';
import { assistant } from '../../data/ai.js';

export default function AICampusAssistant() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: '👋 Hi! I\'m **CampusSphere AI Assistant**. I can help you with campus navigation, classroom availability, events, building info, and more.\n\nTry asking me something!' },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [lang, setLang] = useState('English');
  const chatEnd = useRef(null);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages((m) => [...m, { role: 'user', text: userMsg }]);
    setInput('');
    setTyping(true);

    setTimeout(() => {
      // Check FAQ first
      const faqMatch = assistant.faqs.find((f) => userMsg.toLowerCase().includes(f.q.toLowerCase().split(' ').slice(1, 4).join(' ').toLowerCase()));
      
      let reply;
      if (faqMatch) {
        reply = faqMatch.a;
      } else if (userMsg.toLowerCase().includes('study') || userMsg.toLowerCase().includes('quiet')) {
        reply = '📚 Based on current occupancy data:\n\n1. **Reading Hall 2** — 58% occupied, 25 seats free (Quietest)\n2. **S&H Block Study Room 301** — Empty, AC available\n3. **Library Mezzanine** — 12 seats available\n\n💡 Recommendation: Reading Hall 2 for the quietest environment.';
      } else if (userMsg.toLowerCase().includes('navigate') || userMsg.toLowerCase().includes('direction') || userMsg.toLowerCase().includes('route') || userMsg.toLowerCase().includes('how to go')) {
        reply = '🗺️ I can help you navigate! Here are popular routes:\n\n• **Main Gate → CSE Block**: 200m, 3 min walk\n• **Parking → Library**: 150m, 2 min walk\n• **Canteen → ECE Block**: 180m, 3 min walk\n\nTell me your start and destination for a specific route!';
      } else if (userMsg.toLowerCase().includes('event') || userMsg.toLowerCase().includes('fest')) {
        reply = '📅 Upcoming Events at Suhruth University:\n\n1. **InnoVerse 2026** — Tech Fest (Aug 15–17)\n2. **AI/ML Workshop** — CSE Block (Aug 5)\n3. **Cultural Night** — Auditorium (Aug 20)\n4. **Sports Day** — Main Ground (Sep 1)';
      } else if (userMsg.toLowerCase().includes('park')) {
        reply = '🅿️ Current Parking Status:\n\n• **Zone B (Students)**: 17 slots free — Closest to CSE/ECE\n• **Zone C (Staff)**: 11 slots free — Near Library\n• **Zone D (Visitors)**: 6 slots free\n• **Zone A (Faculty)**: 2 slots free\n\n💡 Recommended: Zone B for best availability.';
      } else if (userMsg.toLowerCase().includes('energy') || userMsg.toLowerCase().includes('power')) {
        reply = '⚡ Campus Energy Status:\n\n• Total today: **1,842 kWh**\n• Peak demand: **312 kW** (CSE Block highest)\n• Solar generated: **226 kWh**\n• AI forecast tomorrow: **1,920 kWh**\n\n⚠️ Canteen peak load at 14:00 — 48 kW';
      } else {
        reply = `🤖 I understand you\'re asking about "${userMsg}". Here\'s what I found:\n\nAll 15 campus modules (Digital Twin, Parking, Library, Energy, Water, Crowd, Environment, Attendance) are operating normally. The campus currently has **2,840 people** on site.\n\nFeel free to ask about specific buildings, classrooms, labs, events, or navigation!`;
      }
      
      setMessages((m) => [...m, { role: 'assistant', text: reply }]);
      setTyping(false);
    }, 1200 + Math.random() * 800);
  };

  return (
    <MonitoringLayout
      title="AI Campus Assistant"
      subtitle="Intelligent Q&A, navigation, and campus information"
      icon={<MessageCircle size={22} />}
      accentColor="#7B61FF"
      liveLabel="AI Online"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Chat window */}
        <div className="lg:col-span-2">
          <MCard className="flex flex-col" style={{ minHeight: 520 }}>
            {/* Chat header */}
            <div className="flex items-center justify-between border-b border-white/8 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-purple-500/15 text-purple-400">
                  <Sparkles size={16} />
                </span>
                <div>
                  <p className="text-xs font-bold text-white">CampusSphere AI</p>
                  <p className="text-[10px] text-green-400">● Online · {lang}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Globe size={12} className="text-slate-500" />
                <select value={lang} onChange={(e) => setLang(e.target.value)}
                  className="text-[10px] bg-transparent border-none text-slate-400 outline-none cursor-pointer">
                  {assistant.languages.map((l) => <option key={l} value={l} style={{ background: '#04091a' }}>{l}</option>)}
                </select>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ maxHeight: 380, minHeight: 300 }}>
              <AnimatePresence>
                {messages.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#7B61FF]/20 border border-[#7B61FF]/25 text-white'
                        : 'bg-white/5 border border-white/8 text-slate-200'
                    }`}>
                      {msg.text.split('\n').map((line, j) => (
                        <p key={j} className={j > 0 ? 'mt-1' : ''}>
                          {line.split('**').map((part, k) => 
                            k % 2 === 1 ? <strong key={k} className="text-white font-semibold">{part}</strong> : part
                          )}
                        </p>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {typing && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="rounded-2xl bg-white/5 border border-white/8 px-4 py-3 text-xs text-slate-400">
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </motion.div>
              )}
              <div ref={chatEnd} />
            </div>

            {/* Input bar */}
            <div className="flex items-center gap-2 mt-3 border-t border-white/8 pt-3">
              <button className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-purple-400 transition"
                      title="Voice input">
                <Mic size={14} />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about buildings, navigation, events, classrooms..."
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500/40 transition"
              />
              <button onClick={sendMessage}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#7B61FF] text-white hover:bg-[#6B51EF] transition">
                <Send size={14} />
              </button>
            </div>
          </MCard>
        </div>

        {/* Sidebar — Capabilities + FAQ */}
        <div className="space-y-4">
          <MCard title="Capabilities" accent="#7B61FF">
            <div className="grid grid-cols-2 gap-2">
              {assistant.capabilities.map((cap) => (
                <div key={cap.label} className="rounded-xl border border-white/6 bg-white/3 p-2.5 text-center hover:bg-white/6 transition cursor-pointer"
                     onClick={() => { setInput(cap.label === 'Campus Q&A' ? 'Tell me about CSE Block' : cap.label === 'Navigation Assistance' ? 'Navigate me from Main Gate to Library' : cap.label === 'Event Information' ? 'What events are coming up?' : ''); }}>
                  <p className="text-lg mb-1">{cap.icon}</p>
                  <p className="text-[10px] font-semibold text-white">{cap.label}</p>
                </div>
              ))}
            </div>
          </MCard>

          <MCard title="Frequently Asked" accent="#7B61FF">
            <div className="space-y-1">
              {assistant.faqs.slice(0, 5).map((faq, i) => (
                <button key={i} onClick={() => { setInput(faq.q); }}
                  className="block w-full text-left rounded-lg px-3 py-2 text-[11px] text-slate-400 hover:bg-purple-500/8 hover:text-purple-300 transition truncate">
                  💬 {faq.q}
                </button>
              ))}
            </div>
          </MCard>

          <MCard title="Languages" accent="#7B61FF">
            <div className="flex flex-wrap gap-1">
              {assistant.languages.map((l) => (
                <button key={l} onClick={() => setLang(l)}
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                    lang === l ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 text-slate-400 border border-white/8 hover:text-white'
                  }`}>{l}</button>
              ))}
            </div>
          </MCard>
        </div>
      </div>
    </MonitoringLayout>
  );
}
