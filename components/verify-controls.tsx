"use client";

/* ─── Verification queue controls ──────────────────────────────────────
 *  The interactive halves of /apply/verify: confirm a requirement
 *  against its official page, and record a contact's email together
 *  with the page it was read from.
 *
 *  Both exist because of the same asymmetry: the agent's environment
 *  cannot reach institutional domains, and the owner's browser can. So
 *  the queue turns twenty minutes of the owner's reading into resolved
 *  provenance the rest of the system builds on.
 * ────────────────────────────────────────────────────────────────────── */

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyRequirementAction } from "@/lib/admissions-actions";
import { recordContactEmailAction } from "@/lib/fieldwork-actions";
import { toast } from "sonner";

export function ConfirmRequirementButton({
  id,
  institutionId,
}: {
  id: string;
  institutionId: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      className="h-7 shrink-0 border-primary/40 px-2.5 text-[11px] text-primary hover:bg-primary/10"
      onClick={() =>
        start(async () => {
          const res = await verifyRequirementAction({
            id,
            institution_id: institutionId,
          });
          if (res.error) toast.error(res.error);
          else toast.success("Confirmed against the official page");
        })
      }
    >
      {pending ? "Saving…" : "Read it — confirm"}
    </Button>
  );
}

export function ContactEmailForm({ contactId }: { contactId: string }) {
  const [email, setEmail] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await recordContactEmailAction({
            id: contactId,
            email: email.trim(),
            email_source_url: sourceUrl.trim(),
          });
          if (res?.error) toast.error(res.error);
          else toast.success("Address recorded with its source");
        });
      }}
    >
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="address exactly as the page shows it"
        className="h-8 w-64 text-xs"
      />
      <Input
        type="url"
        required
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
        placeholder="https:// page you read it from"
        className="h-8 w-72 text-xs"
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending || !email || !sourceUrl}
        className="h-8 px-3 text-[11px]"
      >
        {pending ? "Saving…" : "Record"}
      </Button>
    </form>
  );
}
