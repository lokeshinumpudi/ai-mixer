import { motion } from 'framer-motion';

export const Greeting = () => {
  return (
    <div className="max-w-3xl mx-auto md:mt-20 px-8 size-full flex flex-col justify-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.5,
          duration: 0.8,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
        className="text-3xl md:text-4xl greeting-title mb-2"
      >
        Hello there!
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.7,
          duration: 0.8,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
        className="text-xl md:text-2xl greeting-subtitle text-muted-foreground"
      >
        How can I help you today?
      </motion.div>
    </div>
  );
};
