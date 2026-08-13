import { motion } from 'framer-motion';

export default function BarChart({ data, label = 'occupancy' }) {
  return (
    <div className="space-y-5">
      {data.map((item, index) => {
        const val = item[label];
        const color = index % 3 === 0 ? 'from-primary to-cyan-400' : index % 3 === 1 ? 'from-secondary to-violet-400' : 'from-accent to-emerald-400';
        return (
          <div key={item.name}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-300">{item.name}</span>
              <span className="font-bold text-white">{val}%</span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${val}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1.1, ease: 'easeOut', delay: index * 0.07 }}
                className={`h-full rounded-full bg-gradient-to-r ${color}`}
                style={{ boxShadow: index % 3 === 0 ? '0 0 12px rgba(0,229,255,0.5)' : index % 3 === 1 ? '0 0 12px rgba(123,97,255,0.5)' : '0 0 12px rgba(0,255,179,0.5)' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
