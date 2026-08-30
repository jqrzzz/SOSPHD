"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface AdvisorChatProps {
  sessionId: string;
}

const STARTER_PROMPTS = [
  "What should I work on next for Paper 1?",
  "Which cases are missing milestones?",
  "Summarise the highest-priority research gaps.",
  "Help me draft a corridor briefing for Koh Samui.",
];

export function AdvisorChat({ sessionId }: AdvisorChatProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error, regenerate, clearError } =
    useChat({
      id: sessionId,
      transport: new DefaultChatTransport({
        api: "/api/advisor",
        prepareSendMessagesRequest: ({ id, messages: msgs }) => ({
          body: {
            id,
            messages: msgs,
          },
        }),
      }),
    });

  const isLoading = status === "streaming" || status === "submitted";

  // Surface rate-limit (429) and stream errors. The AI SDK puts the
  // server's message in error.message; a 429 from gateAIRequest reads
  // "Rate limit exceeded for AI surface …".
  const isRateLimited =
    !!error && /rate limit|too many requests|429/i.test(error.message);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function send(text: string) {
    if (!text.trim() || isLoading) return;
    sendMessage({ text });
    setInput("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <ScrollArea className="flex-1">
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-atomic="false"
          aria-label="Advisor conversation"
          className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8"
        >
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex flex-col items-center gap-6 py-12 text-center"
            >
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded-3xl bg-primary/20 blur-3xl"
                />
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/20 to-primary/5 shadow-[0_8px_24px_-8px_hsl(170_50%_38%/0.4)]">
                  <BrainIcon className="h-7 w-7 text-primary" />
                </div>
              </div>
              <div className="flex max-w-md flex-col gap-2">
                <h2 className="text-balance text-xl font-semibold tracking-tight">
                  Ask the advisor.
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  I see your active cases, computed metrics, missing milestones,
                  open tasks, and the research-gap analysis. Try one of these or
                  just start typing.
                </p>
              </div>
              <div className="grid w-full gap-2 sm:grid-cols-2">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => send(prompt)}
                    disabled={isLoading}
                    className="group flex items-start gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 text-left text-xs leading-relaxed text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card hover:text-foreground hover:shadow-[0_8px_24px_-12px_hsl(170_50%_38%/0.4)]"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] text-primary"
                    >
                      ↵
                    </span>
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "flex-row-reverse" : "flex-row",
                )}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    message.role === "user"
                      ? "bg-primary/15 text-primary ring-1 ring-primary/20"
                      : "bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-[0_4px_12px_-4px_hsl(170_50%_38%/0.5)]",
                  )}
                  aria-hidden="true"
                >
                  {message.role === "user" ? "You" : <BrainIcon className="h-3.5 w-3.5" />}
                </div>
                <div
                  className={cn(
                    "flex max-w-[85%] flex-col gap-1",
                    message.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {message.role === "user" ? "You" : "Advisor"}
                  </span>
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      message.role === "user"
                        ? "bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-[0_8px_20px_-8px_hsl(170_50%_38%/0.5)]"
                        : "surface-card border border-border/60 text-card-foreground",
                    )}
                  >
                    {message.parts.map((part, index) => {
                      if (part.type === "text") {
                        return (
                          <div
                            key={index}
                            className="whitespace-pre-wrap [&>*]:my-1"
                          >
                            {formatAdvisorText(part.text)}
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <div
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-[0_4px_12px_-4px_hsl(170_50%_38%/0.5)]"
              >
                <BrainIcon className="h-3.5 w-3.5" />
              </div>
              <div className="surface-card flex items-center gap-2 rounded-2xl border border-border/60 px-4 py-3">
                <ThinkingDots />
                <span className="text-xs text-muted-foreground">thinking…</span>
              </div>
            </motion.div>
          )}

          {error && (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            >
              <span className="font-medium">
                {isRateLimited
                  ? "You're sending messages too fast."
                  : "The advisor couldn't respond."}
              </span>
              <span className="text-xs text-red-200/80">
                {isRateLimited
                  ? "Rate limit reached. Wait a moment, then retry."
                  : error.message || "A network or server error occurred."}
              </span>
              <div className="mt-1 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 border-red-500/40 bg-transparent text-xs text-red-100 hover:bg-red-500/15"
                  onClick={() => {
                    clearError();
                    regenerate();
                  }}
                >
                  Retry
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-red-200/70 hover:text-red-100"
                  onClick={() => clearError()}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border/60 bg-background/60 px-4 py-3 backdrop-blur-md sm:px-6">
        <form
          onSubmit={handleSubmit}
          className={cn(
            "mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border bg-card/60 p-2 transition-all",
            input.length > 0
              ? "border-primary/40 shadow-[0_0_0_4px_hsl(170_50%_38%/0.08)]"
              : "border-border/60",
          )}
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your research…"
            className="min-h-[40px] max-h-[160px] resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
            disabled={isLoading}
            rows={1}
          />
          <Button
            type="submit"
            size="sm"
            disabled={isLoading || !input.trim()}
            className="self-end shadow-[0_4px_12px_-4px_hsl(170_50%_38%/0.5)]"
          >
            <SendIcon className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-[10px] text-muted-foreground/60">
          ⏎ to send · ⇧⏎ for new line · Suggestions are provisional and are
          not saved as tasks or chat history. Do not enter PHI.
        </p>
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="flex items-center gap-1" aria-label="Advisor is thinking">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-primary"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{
            duration: 1.1,
            delay: i * 0.18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}

/** Simple markdown-like formatting for advisor structured output */
function formatAdvisorText(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(
        <h4
          key={i}
          className="mb-1 mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-primary"
        >
          {line.slice(4)}
        </h4>,
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="mb-1 mt-3 text-sm font-semibold text-foreground">
          {line.slice(3)}
        </h3>,
      );
    } else if (line.startsWith("- ")) {
      elements.push(
        <div key={i} className="flex gap-2 pl-1">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
          <span>{line.slice(2)}</span>
        </div>,
      );
    } else if (line.startsWith("```")) {
      continue;
    } else if (line.trim()) {
      elements.push(<p key={i}>{line}</p>);
    } else {
      elements.push(<div key={i} className="h-1" />);
    }
  }

  return elements;
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}
