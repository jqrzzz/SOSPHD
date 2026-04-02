/* ─── SOS PHD App Configuration ───────────────────────────────────────
 *  Central config for the app. Owner identity, feature flags, defaults.
 *  This is the single source of truth for "who owns this instance."
 * ────────────────────────────────────────────────────────────────────── */

export const APP_CONFIG = {
  /** The master owner of this SOS PHD instance */
  owner: {
    email: "juanquirozjr@gmail.com",
    name: "Juan Quiroz Jr.",
    role: "researcher" as const,
  },

  /** App metadata */
  app: {
    name: "SOS PHD",
    version: "0.2",
    description: "Research Automation for Tourist SOS",
    themeColor: "#0A1018",
  },

  /** Supabase project (matches .env.local) */
  supabase: {
    projectRef: "jnbxkvlkqmwnqlmetknj",
  },

  /** PhD research context */
  research: {
    thesis:
      "Human-AI coordination reduces measurable delay and access friction in tourist emergencies across heterogeneous health systems.",
    corridors: [
      "Koh Samui → Bangkok",
      "Phuket → Bangkok",
      "Chiang Mai → Bangkok",
      "Pattaya → Bangkok",
      "Krabi → Bangkok",
      "Bangkok Hub",
    ],
  },
} as const;
