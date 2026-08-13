import { Bot, Mic, Send, Sparkles, X, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import Button from './ui/Button.jsx';
import { useCampusStore } from '../store/useCampusStore.js';
import { campusGuideAgent, createStudentAgent } from '../ai/agent.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

// Same profiles as defined in SuhruthDigitalTwin
export const STUDENT_PROFILES = [
  { id: 'student_0', name: 'Alex', major: 'Computer Science', trait: 'Always talking about hackathons and coding in the dark.' },
  { id: 'student_1', name: 'Sam', major: 'Mechanical Engineering', trait: 'Stressed about thermodynamics, drinks way too much coffee.' },
  { id: 'student_2', name: 'Jordan', major: 'Architecture', trait: 'Constantly admiring the campus buildings and sketching in a notebook.' },
  { id: 'student_3', name: 'Casey', major: 'Business', trait: 'Always pitching startup ideas to anyone who will listen.' },
  { id: 'student_4', name: 'Taylor', major: 'Arts', trait: 'Very chill, loves sitting in the garden.' },
  { id: 'student_5', name: 'Sneha Reddy', major: 'Civil Engineering', trait: 'Focused on structures and concrete mixtures, very practical.' },
  { id: 'student_6', name: 'Karthik Nair', major: 'Science & Humanities', trait: 'Philosophical and loves talking about quantum physics.' },
  { id: 'student_7', name: 'Meera Joshi', major: 'Computer Science', trait: 'Loves open source and is always looking for contributors.' },
];

const studentAgents = {};
const suggestions = ['Where is the CAD lab?', 'Show me academic buildings', 'Clear highlights', 'Take me to the library'];

export default function AIAssistant() {
  const { isChatOpen, toggleChat, chatMessages, addChatMessage, chatTarget } = useCampusStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef(null);

  const isGlobal = chatTarget === null;
  const targetStudent = isGlobal ? null : STUDENT_PROFILES.find(p => p.id === chatTarget);

  const ask = async (text) => {
    const q = text || input;
    if (!q.trim() || isLoading) return;
    setInput('');
    addChatMessage({ role: 'user', content: q });
    setIsLoading(true);

    try {
      const langchainMessages = chatMessages.map(m => 
        m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
      );
      langchainMessages.push(new HumanMessage(q));

      let responseContent = "";

      if (isGlobal) {
        const result = await campusGuideAgent.invoke({ messages: langchainMessages });
        const lastMessage = result.messages[result.messages.length - 1];
        responseContent = lastMessage.content;
      } else {
        if (!studentAgents[chatTarget]) {
          studentAgents[chatTarget] = createStudentAgent(targetStudent.name, targetStudent.major, targetStudent.trait);
        }
        const agent = studentAgents[chatTarget];
        const result = await agent.invoke({ messages: langchainMessages });
        const lastMessage = result.messages[result.messages.length - 1];
        responseContent = lastMessage.content;
      }

      addChatMessage({ role: 'ai', content: responseContent });
    } catch (error) {
      console.error("AI Error:", error);
      addChatMessage({ role: 'ai', content: `Sorry, I am having trouble connecting to my neural network right now. Details: ${error.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.94 }}
            transition={{ duration: 0.25, ease: [0.4,0,0.2,1] }}
            className="mb-4 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl shadow-glass"
            style={{
              background: 'linear-gradient(145deg, rgba(5,8,22,0.92) 0%, rgba(10,18,45,0.88) 100%)',
              border: '1px solid rgba(255,255,255,0.10)',
              backdropFilter: 'blur(36px) saturate(180%)',
              WebkitBackdropFilter: 'blur(36px) saturate(180%)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/20">
                  {isGlobal ? <Sparkles className="text-primary" size={15} /> : <User className="text-primary" size={15} />}
                </span>
                <div>
                  <span className="block text-sm font-bold">{isGlobal ? 'Campus AI' : targetStudent?.name}</span>
                  <span className="flex items-center gap-1 text-[10px] text-accent">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent animate-blink" style={{ boxShadow: '0 0 6px #00FFB3' }} />
                    {isGlobal ? 'Online' : targetStudent?.major}
                  </span>
                </div>
              </div>
              <Button
                variant="icon"
                size="sm"
                aria-label="Close assistant"
                onClick={toggleChat}
              >
                <X size={14} />
              </Button>
            </div>

            {/* Messages */}
            <div className="no-scrollbar max-h-60 space-y-2.5 overflow-y-auto px-4 py-3">
              {chatMessages.length === 0 && (
                <div className="text-center text-slate-500 py-6 text-sm">
                  {isGlobal ? "Hi! I can guide you around campus or highlight buildings for you." : `Say hello to ${targetStudent?.name}!`}
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'ai'
                      ? 'bg-white/6 text-slate-200 border border-white/8'
                      : 'ml-8 bg-gradient-to-r from-primary/15 to-secondary/10 text-primary border border-primary/15 text-right'
                  }`}
                >
                  {msg.content}
                </motion.div>
              ))}
              {isLoading && (
                <div className="rounded-xl px-3.5 py-2.5 text-sm bg-white/6 text-slate-400 border border-white/8 w-16 flex justify-center items-center space-x-1">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Suggestions */}
            <div className="flex flex-wrap gap-1.5 border-t border-white/[0.06] px-4 py-2.5">
              {suggestions.map((s) => (
                <Button key={s} variant="ghost" size="sm" onClick={() => ask(s)}>
                  {s}
                </Button>
              ))}
            </div>

            {/* Input */}
            <div className="flex gap-2 border-t border-white/[0.06] px-4 py-3">
              <Button variant="icon" size="sm" aria-label="Voice input">
                <Mic size={15} />
              </Button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ask()}
                disabled={isLoading}
                placeholder={isGlobal ? "Ask anything about campus…" : `Chat with ${targetStudent?.name}...`}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-primary/30 focus:bg-white/8 transition disabled:opacity-50"
              />
              <Button variant="primary" size="sm" onClick={() => ask()} aria-label="Send" disabled={!input.trim() || isLoading}>
                <Send size={14} />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="neon-border relative grid h-14 w-14 place-items-center rounded-2xl shadow-glow transition"
        style={{
          background: 'linear-gradient(135deg, rgba(0,229,255,0.15), rgba(123,97,255,0.15))',
          backdropFilter: 'blur(20px)',
        }}
        aria-label="Open AI assistant"
        onClick={() => {
          if (!isChatOpen) {
            useCampusStore.getState().openChatWithTarget(null); // Force open to global guide
          } else {
            toggleChat();
          }
        }}
      >
        <Bot className="text-primary" size={22} />
        <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-void bg-accent animate-blink" style={{ boxShadow: '0 0 8px #00FFB3' }} />
      </motion.button>
    </div>
  );
}
