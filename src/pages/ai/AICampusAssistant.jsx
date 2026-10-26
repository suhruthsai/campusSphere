// AICampusAssistant.jsx — Module 17
import { MessageCircle, Globe, Send, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import MonitoringLayout, { MCard } from '../../components/monitoring/MonitoringLayout.jsx';
import { assistant } from '../../data/ai.js';
import { aiApi } from '../../utils/api.js';
import { useCampusStore } from '../../store/useCampusStore.js';

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

  // Real answers from the campus AI (same service as the floating assistant)
  const sendMessage = async () => {
    if (!input.trim() || typing) return;
    const userMsg = input.trim();
    const history = [...messages.slice(1), { role: 'user', text: userMsg }].slice(-10)
      .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text.slice(0, 2000) }));
    if (lang !== 'English') history[history.length - 1].content += `

(Please reply in ${lang}.)`;
    setMessages((m) => [...m, { role: 'user', text: userMsg }]);
    setInput('');
    setTyping(true);
    try {
      const { reply, actions } = await aiApi.chat(history);
      const store = useCampusStore.getState();
      for (const action of actions || []) {
        if (action.name === 'fly_to_building') store.setAIFlyTarget(action.args.buildingName);
      }
      setMessages((m) => [...m, { role: 'assistant', text: reply || '(no answer)' }]);
    } catch (e) {
      const notSetUp = /not configured|GROQ_API_KEY/i.test(e.message);
      setMessages((m) => [...m, { role: 'assistant', text: notSetUp
        ? "The AI assistant isn't set up yet: the server needs a **GROQ_API_KEY** in its .env file. Ask the admin to add one and restart the backend."
        : `Sorry, I couldn't reach the AI service. Details: ${e.message}` }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <MonitoringLayout
      title="AI Campus Assistant"
      subtitle="Intelligent Q&A, navigation, and campus information"
      icon={<MessageCircle size={22} />}
      accentColor="#7B61FF"
      liveLabel="Groq AI"
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
                  <p className="text-[10px] text-slate-400">Replies in {lang}</p>
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
