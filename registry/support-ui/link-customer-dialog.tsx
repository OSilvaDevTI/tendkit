"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSupport } from "./provider";
import type { TicketDetail } from "./client";
import { contactLabel } from "./format";

/** Links the sender to one of your customers. Their later messages link on their own. */
export function LinkCustomerDialog({
  detail,
  open,
  onOpenChange,
}: {
  detail: TicketDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { client, t } = useSupport();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useQuery({
    queryKey: ["support", "customers", debounced],
    queryFn: () => client.searchCustomers(debounced),
    enabled: open && debounced.length >= 2,
  });
  const link = useMutation({
    mutationFn: (customerId: string | null) => client.linkCustomer({ ticketId: detail.ticket.id, customerId }),
    onSuccess: () => {
      onOpenChange(false);
      setQuery("");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["support", "ticket", detail.ticket.id] });
      queryClient.invalidateQueries({ queryKey: ["support", "tickets"] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("link.title")}</DialogTitle>
          <DialogDescription>{t("link.description", { name: contactLabel(detail.contact) })}</DialogDescription>
        </DialogHeader>
        <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("link.search")} aria-label={t("link.search")} />
        <div className="max-h-72 min-h-24 overflow-y-auto">
          {results.isFetching ? (
            <Loader2 className="mx-auto mt-6 size-4 animate-spin text-muted-foreground" />
          ) : debounced.length < 2 ? (
            <p className="pt-6 text-center text-sm text-muted-foreground">{t("link.hint")}</p>
          ) : results.data?.length ? (
            <ul className="divide-y">
              {results.data.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    disabled={link.isPending}
                    onClick={() => link.mutate(customer.id)}
                    className="flex w-full items-center justify-between gap-2 px-1 py-2.5 text-start text-sm hover:bg-muted/50"
                  >
                    <bdi className="truncate">{customer.name}</bdi>
                    {customer.id === detail.customer?.id && <Check className="size-4 text-primary" />}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pt-6 text-center text-sm text-muted-foreground">{t("link.none")}</p>
          )}
        </div>
        {detail.customer && (
          <Button variant="ghost" size="sm" className="justify-self-start" disabled={link.isPending} onClick={() => link.mutate(null)}>
            {t("link.unlink", { name: detail.customer.name })}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
