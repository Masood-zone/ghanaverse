"use client"
import {
  FormSelect,
  FormSwitch,
  FormCheckbox,
} from "@/components/ui/form-controls"
import { SettingRow } from "@/components/ui/setting-row"
import { SelectField } from "@/components/ui/select-field"
import { SelectItem } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { money, billingDate } from "@/lib/billing-format"
import { QueryState } from "@/components/common/query-state"
import type { AdminBillingData, EarningsData } from "@/types/billing"
import { toast } from "sonner"
import "./subscriptions.css"

function useOperation(base: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      path,
      body,
      method = "POST",
    }: {
      path: string
      body: unknown
      method?: string
    }) =>
      api<{ id: string }>(`${base}/${path}`, {
        method,
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["billing"] })
      toast.success("Changes saved.")
    },
  })
}
function Failure({ error }: { error: Error | null }) {
  return error ? (
    <p role="alert" className="gv-sub-error mt-3">
      {error.message}
    </p>
  ) : null
}
function PlanSettings({ data }: { data: AdminBillingData }) {
  const mutation = useOperation("/admin/billing")
  const form = useForm({
    defaultValues: {
      price: data.plan.amount / 100,
      enabled: data.plan.enabled,
      commercialConfirmed: data.plan.commercialConfirmed,
    },
  })
  return (
    <form
      className="gv-sub-card space-y-4"
      onSubmit={form.handleSubmit((v) =>
        mutation.mutate({
          path: "plan",
          method: "PATCH",
          body: {
            amount: Math.round(v.price * 100),
            enabled: v.enabled,
            commercialConfirmed: v.commercialConfirmed,
          },
        })
      )}
    >
      <h2>Premium Pass pricing</h2>
      <p>
        Price changes apply to future purchases. Existing payment amounts and
        access periods are retained.
      </p>
      <Label className="gv-label">
        GHS per 30 days
        <Input
          type="number"
          min="1"
          max="10000"
          step="0.01"
          required
          {...form.register("price", { valueAsNumber: true })}
        />
      </Label>
      <SettingRow
        title="Enable checkout"
        description="Allow Premium Pass purchases when the launch requirements are met."
        icon="shopping_bag"
      >
        {({ labelId, descriptionId }) => (
          <FormSwitch
            control={form.control}
            name="enabled"
            aria-labelledby={labelId}
            aria-describedby={descriptionId}
          />
        )}
      </SettingRow>
      <Label className="flex items-start gap-2 text-sm">
        <FormCheckbox control={form.control} name="commercialConfirmed" />
        Commercial pricing and content costs have been validated for live
        checkout
      </Label>
      <p>
        Live payments additionally require the production launch configuration.
        Current environment: {data.mode}.
      </p>
      <button disabled={mutation.isPending} className="gv-sub-button">
        Save pricing
      </button>
      <Failure error={mutation.error} />
    </form>
  )
}
type LicenseValues = {
  contentId: string
  rightsHolderId: string
  amount: number
  startsAt: string
  endsAt: string
  dueAt: string
  contractReference: string
  commercialUse: boolean
}
function LicenseForm({ data }: { data: EarningsData }) {
  const form = useForm<LicenseValues>(),
    mutation = useOperation("/admin/billing")
  return (
    <form
      className="gv-sub-card space-y-4"
      onSubmit={form.handleSubmit((v) =>
        mutation.mutate(
          {
            path: "licenses",
            body: {
              ...v,
              amount: Math.round(v.amount * 100),
              startsAt: new Date(`${v.startsAt}Z`).toISOString(),
              endsAt: new Date(`${v.endsAt}Z`).toISOString(),
              dueAt: new Date(`${v.dueAt}Z`).toISOString(),
            },
          },
          { onSuccess: () => form.reset() }
        )
      )}
    >
      <h2>Record a licensing agreement</h2>
      <p>
        One fixed fee per title and licence period. The contract remains the
        authority for commercial terms.
      </p>
      <Label className="gv-label">
        Title
        <FormSelect
          aria-label="Title"
          required
          control={form.control}
          name="contentId"
          onValueChange={(e) => {
            form.setValue("contentId", e)
            form.setValue(
              "rightsHolderId",
              data.titles.find((t) => t.id === e)?.rightsHolderId ?? ""
            )
          }}
        >
          <SelectItem value="">Choose title</SelectItem>
          {data.titles.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.title}
            </SelectItem>
          ))}
        </FormSelect>
      </Label>
      <Label className="gv-label">
        Assigned rights holder
        <FormSelect
          aria-label="Assigned rights holder"
          required
          control={form.control}
          name="rightsHolderId"
        >
          <SelectItem value="">Choose rights holder</SelectItem>
          {data.holders.map((h) => (
            <SelectItem key={h.id} value={h.id}>
              {h.name}
            </SelectItem>
          ))}
        </FormSelect>
      </Label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Label className="gv-label">
          Fixed fee (GHS)
          <Input
            type="number"
            min="0.01"
            max="1000000"
            step="0.01"
            required
            {...form.register("amount", { valueAsNumber: true })}
          />
        </Label>
        <Label className="gv-label">
          Payment due (UTC)
          <Input type="datetime-local" required {...form.register("dueAt")} />
        </Label>
        <Label className="gv-label">
          Licence starts (UTC)
          <Input
            type="datetime-local"
            required
            {...form.register("startsAt")}
          />
        </Label>
        <Label className="gv-label">
          Licence ends (UTC)
          <Input type="datetime-local" required {...form.register("endsAt")} />
        </Label>
      </div>
      <Label className="gv-label">
        Contract reference
        <Input
          required
          minLength={3}
          maxLength={500}
          {...form.register("contractReference")}
        />
      </Label>
      <Label className="flex gap-2 text-sm">
        <FormCheckbox required control={form.control} name="commercialUse" />
        The contract permits this title to be offered through paid GhanaVerse
        access
      </Label>
      <button disabled={mutation.isPending} className="gv-sub-button">
        Save agreement draft
      </button>
      <Failure error={mutation.error} />
    </form>
  )
}
type RecipientValues = {
  rightsHolderId: string
  type: "ghipss" | "mobile_money"
  name: string
  bankCode: string
  accountNumber: string
}
function RecipientForm({ data, base }: { data: EarningsData; base: string }) {
  const form = useForm<RecipientValues>({
      defaultValues: { type: "mobile_money" },
    }),
    mutation = useOperation(base)
  const [type, setType] = useState<"ghipss" | "mobile_money">("mobile_money")
  const banks = useQuery({
    queryKey: ["billing", "banks", type],
    queryFn: ({ signal }) =>
      api<Array<{ name: string; code: string }>>(`${base}/banks?type=${type}`, {
        signal,
      }),
    retry: false,
  })
  return (
    <form
      className="gv-sub-card space-y-4"
      onSubmit={form.handleSubmit((v) =>
        mutation.mutate(
          { path: "recipients", body: v },
          {
            onSuccess: () => {
              form.reset({ type })
            },
          }
        )
      )}
    >
      <h2>Register a payout recipient</h2>
      <p>
        New destinations require administrator confirmation. Complete account
        numbers are sent to Paystack and are not stored by GhanaVerse.
      </p>
      <Label className="gv-label">
        Rights holder
        <FormSelect
          aria-label="Rights holder"
          required
          control={form.control}
          name="rightsHolderId"
        >
          <SelectItem value="">Choose organization</SelectItem>
          {data.holders.map((h) => (
            <SelectItem key={h.id} value={h.id}>
              {h.name}
            </SelectItem>
          ))}
        </FormSelect>
      </Label>
      <Label className="gv-label">
        Destination
        <FormSelect
          aria-label="Destination"
          control={form.control}
          name="type"
          onValueChange={(e) => {
            const t = e as RecipientValues["type"]
            setType(t)
            form.setValue("type", t)
            form.setValue("bankCode", "")
          }}
        >
          <SelectItem value="mobile_money">Ghana Mobile Money</SelectItem>
          <SelectItem value="ghipss">Ghana bank account</SelectItem>
        </FormSelect>
      </Label>
      <Label className="gv-label">
        Bank / Mobile Money provider
        <FormSelect
          aria-label="Bank / Mobile Money provider"
          required
          control={form.control}
          name="bankCode"
        >
          <SelectItem value="">
            {banks.isPending ? "Loading providers…" : "Choose provider"}
          </SelectItem>
          {banks.data?.map((b) => (
            <SelectItem key={b.code} value={b.code}>
              {b.name}
            </SelectItem>
          ))}
        </FormSelect>
      </Label>
      <Failure error={banks.error} />
      <Label className="gv-label">
        Recipient name
        <Input
          required
          minLength={2}
          autoComplete="off"
          {...form.register("name")}
        />
      </Label>
      <Label className="gv-label">
        Account / Mobile Money number
        <Input
          required
          pattern="[+]?[0-9]{7,20}"
          autoComplete="off"
          inputMode="tel"
          {...form.register("accountNumber")}
        />
      </Label>
      <button
        disabled={mutation.isPending || !banks.data}
        className="gv-sub-button"
      >
        Verify and register recipient
      </button>
      <Failure error={mutation.error} />
    </form>
  )
}
function PayoutControls({
  payout,
  base,
}: {
  payout: EarningsData["licenses"][number]["payouts"][number]
  base: string
}) {
  const mutation = useOperation(base),
    [otp, setOtp] = useState("")
  return (
    <div className="mt-3 rounded border bg-white p-3">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <strong className="text-xs">
            {money(payout.amount)} · {payout.status}
          </strong>
          <p className="break-all">{payout.reference}</p>
          <p>{payout.recipientLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {payout.status === "APPROVED" ? (
            <button
              className="gv-sub-button"
              disabled={mutation.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Send ${money(payout.amount)} to ${payout.recipientLabel}? GhanaVerse pays transfer fees separately.`
                  )
                )
                  mutation.mutate({
                    path: `payouts/${payout.id}`,
                    body: { action: "send" },
                  })
              }}
            >
              Send approved fee
            </button>
          ) : null}
          <button
            className="gv-sub-button gv-sub-button-outline"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                path: `payouts/${payout.id}`,
                body: { action: "reconcile" },
              })
            }
          >
            Refresh provider status
          </button>
          {["UNKNOWN", "SENDING"].includes(payout.status) ? (
            <button
              className="gv-sub-button gv-sub-button-outline"
              disabled={mutation.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    "Reconcile this transfer first and retry only its existing reference if Paystack has no record?"
                  )
                )
                  mutation.mutate({
                    path: `payouts/${payout.id}`,
                    body: { action: "retry" },
                  })
              }}
            >
              Recover same transfer
            </button>
          ) : null}
        </div>
      </div>
      {payout.status === "OTP_REQUIRED" ? (
        <form
          className="mt-3 flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            mutation.mutate(
              {
                path: `payouts/${payout.id}`,
                body: { action: "finalize", otp },
              },
              { onSuccess: () => setOtp("") }
            )
          }}
        >
          <Label className="gv-label">
            Paystack one-time code
            <Input
              required
              pattern="[0-9]{4,10}"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
          </Label>
          <button
            className="gv-sub-button self-end"
            disabled={mutation.isPending}
          >
            Confirm OTP
          </button>
        </form>
      ) : null}
      {payout.lastError ? (
        <p className="text-amber-800!">{payout.lastError}</p>
      ) : null}
      <Failure error={mutation.error} />
    </div>
  )
}
export function LicensingContent({ admin = false }: { admin?: boolean }) {
  const base = admin ? "/admin/billing" : "/creator/earnings"
  const query = useQuery({
    queryKey: ["billing", admin ? "admin" : "creator"],
    queryFn: ({ signal }) =>
      api<EarningsData | AdminBillingData>(base, { signal }),
  })
  const mutation = useOperation(base),
    [recipientChoices, setRecipientChoices] = useState<Record<string, string>>(
      {}
    )
  const data = query.data
  if (!data)
    return (
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
    )
  const adminData = "plan" in data ? data : null
  const payable = data.licenses.filter(
    (l) =>
      Boolean(l.approvedById) && !l.payouts.some((p) => p.status === "SUCCESS")
  )
  const paid = data.licenses.flatMap((l) =>
    l.payouts.filter((p) => p.status === "SUCCESS")
  )
  return (
    <div className="mx-auto max-w-7xl space-y-7 p-4 md:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-wider text-primary uppercase">
            Fixed content licensing ·{" "}
            {data.mode === "test" ? "Test environment" : "Live environment"}
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            {admin ? "Licensing & Payouts" : "Licensing & Earnings"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Agreed fees, payment records, and transparent statements for
            participating rights holders.
          </p>
        </div>
        <a
          href={`/api${base}?format=csv`}
          className="gv-sub-button gv-sub-button-outline"
        >
          Export statement (.CSV)
        </a>
      </div>
      {/* {data.mode === "test" ? (
        <div className="gv-sub-status">
          Paystack test environment. Provider test success does not establish a
          real bank or Mobile Money settlement.
        </div>
      ) : null} */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="gv-sub-card">
          <p>Approved fees awaiting settlement</p>
          <h2>{money(payable.reduce((s, l) => s + l.amount, 0))}</h2>
        </div>
        <div className="gv-sub-card">
          <p>
            {data.mode === "test"
              ? "Test payouts confirmed"
              : "Provider-confirmed payouts"}
          </p>
          <h2>{money(paid.reduce((s, p) => s + p.amount, 0))}</h2>
        </div>
        <div className="gv-sub-card">
          <p>Licensing agreements</p>
          <h2>{data.licenses.length}</h2>
        </div>
      </div>
      {adminData ? (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <PlanSettings
            key={`${adminData.plan.amount}:${adminData.plan.enabled}:${adminData.plan.commercialConfirmed}`}
            data={adminData}
          />
          <LicenseForm data={data} />
        </div>
      ) : null}
      <details className="gv-sub-card">
        <summary className="cursor-pointer font-semibold">
          Add a bank / Mobile Money recipient
        </summary>
        <div className="mt-5">
          <RecipientForm data={data} base={base} />
        </div>
      </details>
      <section className="gv-sub-card">
        <h2>Payout destinations</h2>
        {!data.recipients.length ? (
          <p className="mt-4">No payout recipients have been registered.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {data.recipients.map((r) => (
              <div
                key={r.id}
                className="gv-sub-inset flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <strong>
                    {r.name} · {r.maskedAccount}
                  </strong>
                  <p>
                    {data.holders.find((h) => h.id === r.rightsHolderId)?.name}{" "}
                    · {r.type === "ghipss" ? "Bank" : "Mobile Money"} ·{" "}
                    {r.status}
                  </p>
                </div>
                {admin && r.status === "PENDING" ? (
                  <button
                    disabled={mutation.isPending}
                    className="gv-sub-button gv-sub-button-outline"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Confirm ${r.name}, ${r.maskedAccount} as this rights holder’s payout destination? Replacing a destination cancels unsent approvals.`
                        )
                      )
                        mutation.mutate({
                          path: `recipients/${r.id}`,
                          method: "PATCH",
                          body: {},
                        })
                    }}
                  >
                    Confirm recipient
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="gv-sub-card">
        <h2>Agreements &amp; payment history</h2>
        <Failure error={mutation.error} />
        {!data.licenses.length ? (
          <p className="mt-5">No licensing agreements have been recorded.</p>
        ) : (
          data.licenses.map((l) => (
            <article key={l.id} className="gv-sub-inset mt-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3>{l.content.title}</h3>
                  <p>
                    {l.rightsHolder.name} · {l.status}
                  </p>
                  <p>
                    Licence: {billingDate(l.startsAt)}–{billingDate(l.endsAt)} ·
                    Due {billingDate(l.dueAt)}
                  </p>
                  <p className="break-all">Contract: {l.contractReference}</p>
                </div>
                <strong className="text-xl">{money(l.amount)}</strong>
              </div>
              {admin ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  {l.status === "DRAFT" ? (
                    <button
                      disabled={mutation.isPending}
                      className="gv-sub-button gv-sub-button-outline"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Approve commercial licence for ${l.content.title}, fixed fee ${money(l.amount)}?`
                          )
                        )
                          mutation.mutate({
                            path: `licenses/${l.id}`,
                            method: "PATCH",
                            body: { status: "APPROVED" },
                          })
                      }}
                    >
                      Approve licence
                    </button>
                  ) : null}
                  {l.approvedById ? (
                    <>
                      <button
                        disabled={mutation.isPending}
                        className="gv-sub-button gv-sub-button-outline"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Revoke this streaming licence? Premium playback will stop and unsent approvals will be cancelled. Existing contractual payment obligations remain recorded."
                            )
                          )
                            mutation.mutate({
                              path: `licenses/${l.id}`,
                              method: "PATCH",
                              body: { status: "REVOKED" },
                            })
                        }}
                      >
                        Revoke streaming licence
                      </button>
                      {!l.payouts.some(
                        (p) =>
                          !["FAILED", "REVERSED", "CANCELLED"].includes(
                            p.status
                          )
                      ) ? (
                        <>
                          <SelectField
                            aria-label={`Payout recipient for ${l.content.title}`}
                            className="max-w-xs"
                            value={recipientChoices[l.id] ?? ""}
                            onValueChange={(e) =>
                              setRecipientChoices({
                                ...recipientChoices,
                                [l.id]: e,
                              })
                            }
                          >
                            <SelectItem value="">
                              Choose approved recipient
                            </SelectItem>
                            {data.recipients
                              .filter(
                                (r) =>
                                  r.rightsHolderId === l.rightsHolderId &&
                                  r.status === "APPROVED"
                              )
                              .map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.name} · {r.maskedAccount}
                                </SelectItem>
                              ))}
                          </SelectField>
                          <button
                            className="gv-sub-button"
                            disabled={
                              mutation.isPending || !recipientChoices[l.id]
                            }
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Approve ${money(l.amount)} for this licensing fee? Review the recipient before sending.`
                                )
                              )
                                mutation.mutate({
                                  path: "payouts",
                                  body: {
                                    licenseId: l.id,
                                    recipientId: recipientChoices[l.id],
                                  },
                                })
                            }}
                          >
                            Approve payout
                          </button>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
              {l.payouts.map((p) =>
                admin ? (
                  <PayoutControls key={p.id} payout={p} base={base} />
                ) : (
                  <div key={p.id} className="mt-3 border-t pt-3 text-sm">
                    {money(p.amount)} · {p.status}
                    <p className="break-all">{p.reference}</p>
                  </div>
                )
              )}
            </article>
          ))
        )}
      </section>
      {adminData ? (
        <section className="gv-sub-card">
          <h2>Recent viewer payments</h2>
          <p>
            Latest 100 records in the current payment environment.
            Reconciliation verifies the original amount and owner.
          </p>
          {!adminData.payments.length ? (
            <p className="mt-4">No viewer payments yet.</p>
          ) : (
            adminData.payments.map((p) => (
              <div key={p.id} className="gv-sub-receipt-row">
                <div>
                  <strong>
                    {p.user.name} · {money(p.amount)} · {p.status}
                  </strong>
                  <small className="break-all">{p.reference}</small>
                  <small>
                    Fees: {p.fee === null ? "Awaiting provider" : money(p.fee)}{" "}
                    · Refunded: {money(p.refundAmount)}
                    {p.reviewRequired ? " · Adjustment needs review" : ""}
                  </small>
                </div>
                <button
                  disabled={mutation.isPending}
                  className="gv-sub-button gv-sub-button-outline"
                  onClick={() =>
                    mutation.mutate({
                      path: "reconcile",
                      body: { reference: p.reference },
                    })
                  }
                >
                  Reconcile payment
                </button>
                {p.reviewRequired ? (
                  <button
                    className="gv-sub-button gv-sub-button-outline"
                    disabled={mutation.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Mark this payment adjustment reviewed? This acknowledges review without changing access or provider amounts."
                        )
                      )
                        mutation.mutate({
                          path: `reviews/${p.id}`,
                          body: { refundAmount: p.refundAmount },
                        })
                    }}
                  >
                    Mark adjustment reviewed
                  </button>
                ) : null}
              </div>
            ))
          )}
        </section>
      ) : null}
    </div>
  )
}
