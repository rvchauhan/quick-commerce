import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import {
  activateStore,
  bulkSkuMappings,
  createStore,
  geocodeAddress,
  getStore,
  checkManagerEmail,
  inviteManager,
  listInventory,
  listSkuMappings,
  listSkus,
  stockIn,
  updateStore,
} from "../lib/dark-store/api";
import {
  ApiError,
  type CatalogSku,
  type CreateStoreInput,
} from "../lib/dark-store/types";
import { CoverageMap } from "./CoverageMap";
import { Banner, Button, PageHeader, PortalShell } from "./portal-ui";

type Step = 1 | 2 | 3;

/** Reads a string field out of a jsonb blob (facility / geofence / hours). */
export function jsonString(obj: unknown, key: string): string {
  if (typeof obj !== "object" || obj === null) return "";
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "string" ? v : "";
}

export function jsonNumber(obj: unknown, key: string): number | undefined {
  if (typeof obj !== "object" || obj === null) return undefined;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "number" ? v : undefined;
}

export function jsonBoolean(obj: unknown, key: string): boolean {
  if (typeof obj !== "object" || obj === null) return false;
  return Boolean((obj as Record<string, unknown>)[key]);
}

const STEPS = [
  { n: 1, label: "Store Details" },
  { n: 2, label: "Location & Logistics" },
  { n: 3, label: "Inventory" },
  { n: 4, label: "Activation" },
] as const;

const COUNTRIES = [
  "United States",
  "United Kingdom",
  "India",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "United Arab Emirates",
  "Singapore",
  "Japan",
  "Brazil",
  "Mexico",
] as const;

type DraftRow = {
  skuId: string;
  enabled: boolean;
  price: string;
  stock: string;
};

function categoryTone(category: string | null | undefined) {
  const c = (category ?? "").toUpperCase();
  if (c.includes("FRESH") || c.includes("DAIRY")) return "fresh";
  if (c.includes("BAKERY")) return "bakery";
  if (c.includes("BEVERAGE") || c.includes("DRINK")) return "beverage";
  return "general";
}

function categoryGlyph(category: string | null | undefined) {
  const c = (category ?? "").toUpperCase();
  if (c.includes("DAIRY") || c.includes("MILK")) return "🥛";
  if (c.includes("BAKERY") || c.includes("BREAD")) return "🍞";
  if (c.includes("BEVERAGE") || c.includes("COFFEE")) return "☕";
  if (c.includes("FRESH")) return "🥬";
  return "📦";
}

function WizardCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <section className="qc-wizard-card">
      <div className="qc-wizard-card-head">
        <div className="qc-wizard-card-icon">
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  error,
  required,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`qc-sku-field ${error ? "has-error " : ""}${className}`}>
      <label>
        {label}
        {required ? <span className="req"> *</span> : null}
      </label>
      {children}
      {error ? <p className="error">{error}</p> : null}
      {!error && hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

/** Click-to-open searchable country picker (replaces native datalist). */
function CountrySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        const match = COUNTRIES.find(
          (c) => c.toLowerCase() === query.trim().toLowerCase(),
        );
        if (match) {
          onChange(match);
          setQuery(match);
        } else {
          setQuery(value);
        }
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, value, query, onChange]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...COUNTRIES];
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="qc-country-select" ref={rootRef}>
      <div className="qc-country-select-control">
        <input
          className="qc-input"
          placeholder="Select country"
          value={query}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="country-select-list"
          aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value.replace(/\d/g, ""));
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setQuery(value);
            }
            if (e.key === "Enter") {
              e.preventDefault();
              const first = filtered[0];
              if (first) {
                onChange(first);
                setQuery(first);
                setOpen(false);
              }
            }
          }}
        />
        <button
          type="button"
          className="qc-country-select-toggle"
          aria-label={open ? "Close country list" : "Open country list"}
          tabIndex={-1}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="material-symbols-outlined">
            {open ? "expand_less" : "expand_more"}
          </span>
        </button>
      </div>
      {open ? (
        <ul id="country-select-list" className="qc-country-select-menu" role="listbox">
          {filtered.length === 0 ? (
            <li className="qc-country-select-empty">No matching countries</li>
          ) : (
            filtered.map((c) => (
              <li key={c} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={c === value}
                  className={c === value ? "selected" : undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(c);
                    setQuery(c);
                    setOpen(false);
                  }}
                >
                  {c}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

function Toggle({
  on,
  onChange,
  label,
  description,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
}) {
  return (
    <div className="qc-toggle-row">
      {(label || description) && (
        <div>
          {label ? <p className="qc-toggle-label">{label}</p> : null}
          {description ? <p className="qc-muted" style={{ fontSize: "0.75rem" }}>{description}</p> : null}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        className={`qc-switch ${on ? "on" : ""}`}
        onClick={() => onChange(!on)}
      >
        <span />
      </button>
    </div>
  );
}

function StepIndicator({
  step,
  canJumpToMapping,
  onStepChange,
}: {
  step: Step;
  canJumpToMapping: boolean;
  onStepChange: (s: Step) => void;
}) {
  return (
    <div className="qc-stepper">
      {STEPS.map((s, i) => {
        const completed = step > s.n;
        const active = step === s.n;
        const clickable = s.n <= 3 && (s.n <= 2 || canJumpToMapping);
        return (
          <div key={s.n} className="qc-stepper-item">
            <button
              type="button"
              disabled={!clickable}
              className={`qc-step ${active ? "active" : ""} ${completed ? "done" : ""}`}
              onClick={() => clickable && onStepChange(s.n as Step)}
            >
              <span className="qc-step-num">
                {completed ? (
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    check
                  </span>
                ) : (
                  s.n
                )}
              </span>
              <span className="qc-step-label">{s.label}</span>
            </button>
            {i < STEPS.length - 1 ? <div className="qc-step-line" /> : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Dark store wizard (portal parity).
 * - Create: /app/stores/new
 * - Edit: /app/stores/:storeId/edit?step=1|2|3
 */
export function DarkStoreWizard({
  storeId: editStoreId,
  initialStep = 1,
}: {
  storeId?: string;
  initialStep?: Step;
} = {}) {
  const isEdit = Boolean(editStoreId);
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(initialStep);
  const [storeId, setStoreId] = useState<string | null>(editStoreId ?? null);
  const [storeName, setStoreName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [storeLoading, setStoreLoading] = useState(isEdit);
  const [storeLoadError, setStoreLoadError] = useState<string | null>(null);
  const [existingManagerStatus, setExistingManagerStatus] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [statusIntent, setStatusIntent] = useState<"active" | "maintenance">("active");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("");
  const [latText, setLatText] = useState("");
  const [lngText, setLngText] = useState("");
  const lat = latText.trim() !== "" && Number.isFinite(Number(latText)) ? Number(latText) : null;
  const lng = lngText.trim() !== "" && Number.isFinite(Number(lngText)) ? Number(lngText) : null;
  const [coverageRadius, setCoverageRadius] = useState(5);
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerEmailError, setManagerEmailError] = useState<string | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [contact, setContact] = useState("");
  const [capacity, setCapacity] = useState("");
  const [coldStorage, setColdStorage] = useState(false);
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [inviteEmailSent, setInviteEmailSent] = useState(false);
  const [pendingContinue, setPendingContinue] = useState(false);
  const invitedEmailRef = useRef("");
  const pinManuallySetRef = useRef(false);
  const geocodeRequestIdRef = useRef(0);
  const [geocodeStatus, setGeocodeStatus] = useState<
    "idle" | "locating" | "found-approximate" | "not-found" | "error"
  >("idle");

  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [skus, setSkus] = useState<CatalogSku[]>([]);
  const [skusLoading, setSkusLoading] = useState(false);
  const [existingMappingSkuIds, setExistingMappingSkuIds] = useState<Set<string>>(new Set());
  const [inventoryBySkuId, setInventoryBySkuId] = useState<Map<string, number>>(new Map());
  const [showEnabledOnly, setShowEnabledOnly] = useState(false);
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState("All Categories");

  const cancelTo = isEdit && editStoreId ? `/app/stores/${editStoreId}` : "/app/stores";
  const crumbLabel = isEdit ? "Edit Store" : "Add New Store";
  const title = isEdit ? `Edit "${storeName || "Dark Store"}"` : "Add New Dark Store";
  const prefilledRef = useRef(false);

  useEffect(() => {
    if (!isEdit || !editStoreId) return;
    let cancelled = false;
    setStoreLoading(true);
    setStoreLoadError(null);
    void getStore(editStoreId)
      .then((store) => {
        if (cancelled) return;
        setStoreName(store.name);
        setExistingManagerStatus(store.managerStatus ?? null);
        if (prefilledRef.current) return;
        prefilledRef.current = true;
        setName(store.name);
        setCode(store.code ?? "");
        setStreet(jsonString(store.facility, "street") || store.address);
        setCity(jsonString(store.geofence, "city"));
        setPostal(jsonString(store.geofence, "postalCode"));
        setCountry(jsonString(store.geofence, "country"));
        const initialLat = jsonNumber(store.geofence, "lat");
        const initialLng = jsonNumber(store.geofence, "lng");
        setLatText(initialLat != null ? String(initialLat) : "");
        setLngText(initialLng != null ? String(initialLng) : "");
        pinManuallySetRef.current = initialLat != null && initialLng != null;
        setCoverageRadius(jsonNumber(store.geofence, "radiusKm") ?? 5);
        setManagerName(store.managerName ?? jsonString(store.facility, "managerName"));
        setManagerEmail(store.managerEmail ?? "");
        invitedEmailRef.current = (store.managerEmail ?? "").trim().toLowerCase();
        setContact(
          jsonString(store.facility, "contactNumber")
            .replace(/^\+91/, "")
            .replace(/\D/g, "")
            .slice(-10),
        );
        const capacityM3 = jsonNumber(store.facility, "capacityM3");
        setCapacity(capacityM3 != null ? String(capacityM3) : "");
        setColdStorage(jsonBoolean(store.facility, "coldStorage"));
        setOpenTime(jsonString(store.operatingHours, "open"));
        setCloseTime(jsonString(store.operatingHours, "close"));
        setStatusIntent(
          jsonString(store.facility, "intendedStatus") === "maintenance" ? "maintenance" : "active",
        );
      })
      .catch((err) => {
        if (!cancelled) {
          setStoreLoadError(err instanceof ApiError ? err.message : "Failed to load store");
        }
      })
      .finally(() => {
        if (!cancelled) setStoreLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, editStoreId]);

  useEffect(() => {
    if (pinManuallySetRef.current) return;
    if (!city.trim() && !postal.trim()) return;

    setGeocodeStatus("locating");
    const requestId = ++geocodeRequestIdRef.current;
    const handle = setTimeout(() => {
      void geocodeAddress({ street, city, postalCode: postal, country })
        .then((result) => {
          if (requestId !== geocodeRequestIdRef.current || pinManuallySetRef.current) return;
          setLatText(String(result.lat));
          setLngText(String(result.lng));
          setGeocodeStatus(result.precision === "approximate" ? "found-approximate" : "idle");
        })
        .catch((err) => {
          if (requestId !== geocodeRequestIdRef.current || pinManuallySetRef.current) return;
          setGeocodeStatus(err instanceof ApiError && err.status === 404 ? "not-found" : "error");
        });
    }, 900);

    return () => clearTimeout(handle);
  }, [street, city, postal, country]);

  /** Marks the pin as manually placed so address typing stops overriding it. */
  const markPinManual = () => {
    pinManuallySetRef.current = true;
    setGeocodeStatus("idle");
  };

  useEffect(() => {
    if (step !== 3 || !storeId) return;
    let cancelled = false;
    setSkusLoading(true);
    void Promise.all([listSkus({ status: "active" }), listSkuMappings(storeId), listInventory(storeId)])
      .then(([skuRes, mapRes, invRes]) => {
        if (cancelled) return;
        const catalog = (skuRes.data ?? []).filter((sku) => sku.status === "active");
        const mappings = mapRes.data ?? [];
        const bySku = new Map(mappings.map((m) => [m.skuId, m]));
        setSkus(catalog);
        setExistingMappingSkuIds(new Set(mappings.map((m) => m.skuId)));
        setInventoryBySkuId(new Map(invRes.data.map((row) => [row.skuId, row.availableQty])));
        setDrafts((prev) => {
          const next: Record<string, DraftRow> = {};
          for (const sku of catalog) {
            const existing = bySku.get(sku.id);
            const prior = prev[sku.id];
            next[sku.id] = prior ?? {
              skuId: sku.id,
              enabled: existing?.isListed ?? false,
              price: existing?.priceOverride ?? sku.basePrice ?? "",
              stock:
                existing || sku.defaultInitialStock == null
                  ? ""
                  : String(sku.defaultInitialStock),
            };
          }
          return next;
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load catalog");
        }
      })
      .finally(() => {
        if (!cancelled) setSkusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, storeId]);

  const buildPayload = (): CreateStoreInput => {
    const address = [street, city, postal, country].filter(Boolean).join(", ");
    return {
      name: name.trim(),
      code: code.trim() || undefined,
      address: address || street || "Address TBD",
      geofence: {
        type: "circle",
        radiusKm: coverageRadius,
        city,
        postalCode: postal,
        country,
        lat,
        lng,
      },
      operatingHours: {
        timezone: "local",
        open: openTime || undefined,
        close: closeTime || undefined,
      },
      facility: {
        street,
        capacityM3: capacity ? Number(capacity) : null,
        coldStorage,
        contactNumber: contact ? `+91${contact}` : null,
        managerName: managerName || null,
        intendedStatus: statusIntent,
      },
      managerName: managerName || undefined,
    };
  };

  /** Returns an error message when the manager email can't be invited, otherwise null. */
  const validateManagerEmail = async (): Promise<string | null> => {
    const email = managerEmail.trim().toLowerCase();
    if (!email || email === invitedEmailRef.current) return null;
    if (!/^\S+@\S+\.\S+$/.test(email)) return "Enter a valid manager email";
    setCheckingEmail(true);
    try {
      const { available } = await checkManagerEmail({
        email,
        storeId: isEdit ? editStoreId : undefined,
      });
      return available ? null : "This email is already registered";
    } finally {
      setCheckingEmail(false);
    }
  };

  const onManagerEmailBlur = async () => {
    try {
      setManagerEmailError(await validateManagerEmail());
    } catch {
      setManagerEmailError(null);
    }
  };

  const goToLocation = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Store name is required");
      return;
    }
    if (contact && contact.length !== 10) {
      setError("Contact number must be 10 digits");
      return;
    }
    try {
      const emailError = await validateManagerEmail();
      setManagerEmailError(emailError);
      if (emailError) return;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not verify manager email");
      return;
    }
    setStep(2);
  };

  const finishCreate = (store: { id: string; name: string }, mode: "continue" | "draft") => {
    if (mode === "draft") {
      navigate(isEdit ? `/app/stores/${store.id}` : "/app/stores");
      return;
    }
    setStoreId(store.id);
    setStoreName(store.name);
    setStep(3);
  };

  const submitStore = async (mode: "continue" | "draft") => {
    setError(null);
    if (!street.trim()) {
      setError(
        mode === "draft"
          ? "Street address is required to save a draft store"
          : "Street address is required",
      );
      return;
    }
    if (managerEmail.trim() && !/^\S+@\S+\.\S+$/.test(managerEmail.trim())) {
      setError("Enter a valid manager email");
      return;
    }
    if (managerEmail.trim() && !managerName.trim()) {
      setError("Manager name is required when inviting a manager");
      return;
    }

    setSaving(true);
    try {
      const emailError = await validateManagerEmail();
      if (emailError) {
        setManagerEmailError(emailError);
        setError(emailError);
        return;
      }
      const payload = buildPayload();
      const store = isEdit
        ? await updateStore(editStoreId!, payload)
        : await createStore(payload);
      const trimmedEmail = managerEmail.trim().toLowerCase();
      if (trimmedEmail && trimmedEmail !== invitedEmailRef.current) {
        const invite = await inviteManager({
          email: trimmedEmail,
          name: managerName.trim() || "Store Manager",
          storeId: store.id,
        });
        invitedEmailRef.current = trimmedEmail;
        setInviteEmailSent(invite.emailSent);
        setInviteLink(invite.inviteLink);
        setInviteLinkCopied(false);
        setPendingContinue(mode === "continue");
        setStoreId(store.id);
        setStoreName(store.name);
        return;
      }
      finishCreate({ id: store.id, name: store.name }, mode);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : `Failed to ${isEdit ? "update" : "create"} store`,
      );
    } finally {
      setSaving(false);
    }
  };

  const persistMappings = async (activate: boolean) => {
    if (!storeId) throw new Error("Store not created yet");
    const activeIds = new Set(skus.filter((s) => s.status === "active").map((s) => s.id));
    const enabled = Object.values(drafts).filter((d) => d.enabled && activeIds.has(d.skuId));
    if (enabled.length > 0) {
      const reorderBySku = new Map(skus.map((s) => [s.id, s.defaultReorderPoint]));
      await bulkSkuMappings(storeId, {
        mappings: enabled.map((d) => ({
          skuId: d.skuId,
          isListed: true,
          priceOverride: d.price.trim() === "" ? null : Number(d.price),
          reorderThreshold: reorderBySku.get(d.skuId) ?? 10,
        })),
      });
      for (const d of enabled) {
        const qty = Number(d.stock);
        if (Number.isFinite(qty) && qty > 0) {
          await stockIn(storeId, { skuId: d.skuId, quantity: qty, source: "onboarding" });
        }
      }
    }
    if (activate) await activateStore(storeId);
  };

  const onCompleteSetup = async () => {
    setError(null);
    setSaving(true);
    try {
      await persistMappings(true);
      navigate(isEdit && editStoreId ? `/app/stores/${editStoreId}` : "/app/stores");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to complete setup");
    } finally {
      setSaving(false);
    }
  };

  const onSaveDraftMappings = async () => {
    setError(null);
    setSaving(true);
    try {
      await persistMappings(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save mappings");
    } finally {
      setSaving(false);
    }
  };

  const mappedCount = Object.values(drafts).filter((d) => d.enabled).length;
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const sku of skus) {
      if (sku.category) set.add(sku.category);
    }
    return ["All Categories", ...Array.from(set).sort()];
  }, [skus]);

  const visibleSkus = skus.filter((sku) => {
    const draft = drafts[sku.id];
    if (showEnabledOnly && !draft?.enabled) return false;
    if (category !== "All Categories" && sku.category !== category) return false;
    if (filter.trim()) {
      const q = filter.toLowerCase();
      const hay = `${sku.name} ${sku.brand ?? ""} ${sku.barcode ?? ""} ${sku.category ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const subtitle =
    step === 3 ? (
      <>
        Configure localized inventory for{" "}
        <strong>'{storeName || "New store"}'</strong>
      </>
    ) : step === 2 ? (
      "Pin the store's exact location and set its delivery coverage radius."
    ) : isEdit ? (
      "Update this dark store's details, or jump to Inventory Mapping to manage its assigned products."
    ) : (
      "Register a new high-velocity fulfillment hub to the regional network."
    );

  if (inviteLink) {
    return (
      <PortalShell>
        <PageHeader
          crumbs={["Management", "Dark Stores", crumbLabel]}
          title={title}
        />
        <div className="qc-invite-card">
          <div className="qc-invite-icon">
            <span className="material-symbols-outlined">
              {inviteEmailSent ? "mark_email_read" : "mail"}
            </span>
          </div>
          <h3>{inviteEmailSent ? "Manager invited — email sent" : "Manager invited"}</h3>
          <p className="qc-muted">
            {inviteEmailSent ? (
              <>
                We've emailed a setup link to <strong>{managerEmail.trim()}</strong>. It expires in
                7 days.
              </>
            ) : (
              <>
                Share this one-time setup link with <strong>{managerEmail.trim()}</strong> — it
                expires in 7 days.
              </>
            )}
          </p>
          <div className="qc-invite-row">
            <input className="qc-input" readOnly value={inviteLink} />
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(inviteLink);
                setInviteLinkCopied(true);
              }}
            >
              {inviteLinkCopied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <Button
            icon="arrow_forward"
            onClick={() => {
              setInviteLink(null);
              if (pendingContinue && storeId) {
                setStep(3);
              } else {
                navigate(cancelTo);
              }
            }}
          >
            {pendingContinue ? "Continue to Inventory" : "Done"}
          </Button>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <PageHeader
        crumbs={["Management", "Dark Stores", crumbLabel]}
        title={title}
        subtitle={subtitle}
        actions={
          step === 3 ? (
            <>
              <Button variant="secondary" disabled={saving} onClick={onSaveDraftMappings}>
                Save Draft
              </Button>
              <Button disabled={saving} onClick={onCompleteSetup}>
                {saving ? "Saving…" : "Complete Setup"}
              </Button>
            </>
          ) : undefined
        }
      />

      {error ? (
        <Banner tone="critical" title="Something went wrong">
          {error}
        </Banner>
      ) : null}

      <StepIndicator
        step={step}
        canJumpToMapping={Boolean(storeId)}
        onStepChange={(s) => {
          if (s === 3 && !storeId) return;
          setStep(s);
        }}
      />

      {step <= 2 && isEdit && storeLoading ? (
        <p className="qc-muted" style={{ textAlign: "center", padding: "3rem 0" }}>
          Loading store details…
        </p>
      ) : null}

      {step <= 2 && isEdit && storeLoadError ? (
        <Banner tone="critical" title="Failed to load store">
          {storeLoadError}
        </Banner>
      ) : null}

      {step === 1 && !(isEdit && (storeLoading || storeLoadError)) && (
        <form className="qc-wizard-layout" onSubmit={goToLocation}>
          <div className="qc-wizard-main">
            <WizardCard title="Basic Information" icon="info">
              <div className="qc-sku-grid cols-2">
                <Field label="Store Name" required>
                  <input
                    className="qc-input"
                    placeholder="e.g. Westside Hub B1"
                    value={name}
                    maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Unique Store ID">
                  <input
                    className="qc-input"
                    placeholder="WH-B1-77291"
                    value={code}
                    maxLength={20}
                    onChange={(e) =>
                      setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20))
                    }
                  />
                </Field>
              </div>
              <div className="qc-sku-field" style={{ marginTop: "1.25rem" }}>
                <label>Status</label>
                <div className="qc-status-pills">
                  {(["active", "maintenance"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`qc-status-pill ${statusIntent === option ? "active" : ""}`}
                      onClick={() => setStatusIntent(option)}
                    >
                      <span className="dot" />
                      {option === "active" ? "Active" : "Maintenance"}
                    </button>
                  ))}
                </div>
                <p className="hint">
                  Stores are created as <strong>onboarding</strong>; activation happens after
                  inventory mapping.
                </p>
              </div>
            </WizardCard>

            <WizardCard title="Management & Staffing" icon="groups">
              {isEdit && existingManagerStatus ? (
                <p className="qc-muted" style={{ fontSize: "0.75rem", marginBottom: "1rem" }}>
                  Current manager status: <strong style={{ textTransform: "capitalize" }}>{existingManagerStatus}</strong>.
                  Changing the email below invites a new manager and replaces the assignment.
                </p>
              ) : null}
              <div className="qc-sku-grid cols-2">
                <Field label="Manager Name">
                  <input
                    className="qc-input"
                    placeholder="e.g. Alex Thompson"
                    value={managerName}
                    maxLength={80}
                    onChange={(e) => setManagerName(e.target.value)}
                  />
                </Field>
                <Field
                  label="Manager Email"
                  hint="They'll receive a one-time link to set their own password and log in as store manager."
                  error={managerEmailError}
                >
                  <input
                    className="qc-input"
                    type="email"
                    placeholder="manager@company.com"
                    value={managerEmail}
                    onChange={(e) => {
                      setManagerEmail(e.target.value);
                      setManagerEmailError(null);
                    }}
                    onBlur={onManagerEmailBlur}
                  />
                </Field>
                <Field label="Contact Number">
                  <div className="qc-sku-input-row">
                    <span>+91</span>
                    <input
                      className="qc-input"
                      type="tel"
                      placeholder="98765 43210"
                      value={contact}
                      maxLength={10}
                      inputMode="numeric"
                      pattern="[0-9]{10}"
                      onChange={(e) =>
                        setContact(e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                    />
                  </div>
                </Field>
              </div>
            </WizardCard>
          </div>

          <div className="qc-wizard-side">
            <WizardCard title="Operations" icon="warehouse">
              <div className="qc-sku-field">
                <label>Working Hours</label>
                <div className="qc-hours-row">
                  <input
                    className="qc-input"
                    type="time"
                    value={openTime}
                    onChange={(e) => setOpenTime(e.target.value)}
                    aria-label="Opening time"
                  />
                  <input
                    className="qc-input"
                    type="time"
                    value={closeTime}
                    onChange={(e) => setCloseTime(e.target.value)}
                    aria-label="Closing time"
                  />
                </div>
              </div>
              <Field label="Capacity">
                <div className="qc-sku-input-row">
                  <input
                    className="qc-input"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="2,500"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                  />
                  <span>m³</span>
                </div>
              </Field>
              <Toggle
                label="Cold Storage"
                description="Dedicated unit"
                on={coldStorage}
                onChange={setColdStorage}
              />
            </WizardCard>

            <div className="qc-wizard-actions-card">
              <Button type="submit" icon="arrow_forward" disabled={checkingEmail}>
                {checkingEmail ? "Checking…" : "Next: Location & Logistics"}
              </Button>
              <Link className="qc-text-link" to={cancelTo}>
                Cancel & Return
              </Link>
            </div>
          </div>
        </form>
      )}

      {step === 2 && !(isEdit && (storeLoading || storeLoadError)) && (
        <form
          className="qc-wizard-layout"
          onSubmit={(e) => {
            e.preventDefault();
            void submitStore("continue");
          }}
        >
          <div className="qc-wizard-main">
            <WizardCard title="Location & Logistics" icon="location_on">
              <div className="qc-sku-grid cols-2">
                <Field label="Street Address" required className="span-2">
                  <input
                    className="qc-input"
                    placeholder="123 Logistical Way"
                    value={street}
                    maxLength={120}
                    onChange={(e) => setStreet(e.target.value)}
                    required
                  />
                </Field>
                <Field label="City">
                  <input
                    className="qc-input"
                    placeholder="Metropolis"
                    value={city}
                    maxLength={60}
                    onChange={(e) => setCity(e.target.value.replace(/\d/g, ""))}
                  />
                </Field>
                <Field label="Postal Code">
                  <input
                    className="qc-input"
                    placeholder="90210"
                    value={postal}
                    maxLength={10}
                    onChange={(e) => setPostal(e.target.value.slice(0, 10))}
                  />
                </Field>
                <Field
                  label="Country"
                  hint="Scopes the map lookup so addresses resolve to the right country."
                >
                  <CountrySelect value={country} onChange={setCountry} />
                </Field>
                <Field label="Latitude">
                  <input
                    className="qc-input"
                    placeholder="51.5074"
                    value={latText}
                    onChange={(e) => {
                      pinManuallySetRef.current = !(
                        e.target.value.trim() === "" && lngText.trim() === ""
                      );
                      setLatText(e.target.value);
                    }}
                  />
                </Field>
                <Field label="Longitude">
                  <input
                    className="qc-input"
                    placeholder="-0.1278"
                    value={lngText}
                    onChange={(e) => {
                      pinManuallySetRef.current = !(
                        e.target.value.trim() === "" && latText.trim() === ""
                      );
                      setLngText(e.target.value);
                    }}
                  />
                </Field>
              </div>

              <div className="qc-sku-field" style={{ marginTop: "1.25rem" }}>
                <label>Coverage Preview</label>
                <CoverageMap
                  lat={lat}
                  lng={lng}
                  radiusKm={coverageRadius}
                  onChange={(newLat, newLng) => {
                    markPinManual();
                    setLatText(String(newLat));
                    setLngText(String(newLng));
                  }}
                />
                {lat != null && lng != null ? (
                  <p className="qc-muted" style={{ marginTop: "0.5rem", fontSize: "0.75rem" }}>
                    Pin at {lat.toFixed(5)}, {lng.toFixed(5)} · {coverageRadius} km radius
                  </p>
                ) : null}
                <p className="hint">
                  {geocodeStatus === "locating"
                    ? "Locating address on the map…"
                    : geocodeStatus === "found-approximate"
                      ? "Located to the city/postal code area — drag the pin to the exact spot."
                      : geocodeStatus === "not-found"
                        ? "Couldn't find that address — click the map or type coordinates to set the pin."
                        : geocodeStatus === "error"
                          ? "Location lookup failed — click the map or type coordinates to set the pin."
                          : "Type an address above to locate it automatically, or click/drag the pin to set it manually."}
                </p>
              </div>

              <div className="qc-sku-field" style={{ marginTop: "1rem" }}>
                <div className="qc-slider-head">
                  <label>Coverage Radius (km)</label>
                  <strong>
                    {coverageRadius} km
                  </strong>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={coverageRadius}
                  onChange={(e) => setCoverageRadius(Number(e.target.value))}
                />
              </div>
            </WizardCard>
          </div>

          <div className="qc-wizard-side">
            <div className="qc-wizard-actions-card">
              <Button type="submit" disabled={saving} icon="arrow_forward">
                {saving
                  ? "Saving…"
                  : isEdit
                    ? "Save Changes & Continue"
                    : "Save & Continue"}
              </Button>
              {!isEdit ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  icon="draft"
                  onClick={() => void submitStore("draft")}
                >
                  Save as Draft
                </Button>
              ) : null}
              <button type="button" className="qc-text-link" onClick={() => setStep(1)}>
                ← Back to Store Details
              </button>
              <Link className="qc-text-link" to={cancelTo}>
                Cancel & Return
              </Link>
            </div>
          </div>
        </form>
      )}

      {step === 3 && (
        <div className="qc-inventory-step">
          <div className="qc-inventory-toolbar">
            <div className="qc-search" style={{ flex: 1 }}>
              <span className="material-symbols-outlined">filter_list</span>
              <input
                className="qc-input"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by category, brand or SKU..."
              />
            </div>
            <select
              className="qc-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ maxWidth: 200 }}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <Toggle on={showEnabledOnly} onChange={setShowEnabledOnly} label="Show Enabled Only" />
          </div>

          {skusLoading && <p className="qc-muted">Loading catalog…</p>}
          {!skusLoading && skus.length === 0 && (
            <p className="qc-muted">
              No SKUs in master catalog yet.{" "}
              <Link to="/app/catalog/new">Add a SKU</Link> first.
            </p>
          )}

          <div className="qc-product-grid">
            {visibleSkus.map((sku) => {
              const draft = drafts[sku.id];
              if (!draft) return null;
              const hasExisting = existingMappingSkuIds.has(sku.id);
              return (
                <article key={sku.id} className="qc-product-card">
                  <div className="qc-product-card-top">
                    <div className="qc-product-glyph">{categoryGlyph(sku.category)}</div>
                  </div>
                  <span className={`qc-cat-chip ${categoryTone(sku.category)}`}>
                    {(sku.category ?? "GENERAL").toUpperCase()}
                  </span>
                  <h4>{sku.name}</h4>
                  <p className="qc-muted">SKU: {sku.barcode ?? sku.id.slice(0, 8)}</p>
                  <div className="qc-product-card-body">
                    <Toggle
                      label="Enable for Store"
                      on={draft.enabled}
                      onChange={(enabled) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [sku.id]: { ...prev[sku.id], enabled },
                        }))
                      }
                    />
                    {draft.enabled && (
                      <div className="qc-sku-grid cols-2" style={{ marginTop: "0.75rem" }}>
                        <Field label="Price">
                          <input
                            className="qc-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.price}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [sku.id]: { ...prev[sku.id], price: e.target.value },
                              }))
                            }
                          />
                        </Field>
                        <Field label={hasExisting ? "Add Stock" : "Stock"}>
                          <input
                            className="qc-input"
                            type="number"
                            min="0"
                            step="1"
                            value={draft.stock}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [sku.id]: { ...prev[sku.id], stock: e.target.value },
                              }))
                            }
                          />
                          {hasExisting ? (
                            <p className="hint">
                              Current: {inventoryBySkuId.get(sku.id) ?? 0} units
                            </p>
                          ) : null}
                        </Field>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}

            <ImportBatchCard
              storeId={storeId!}
              onImported={async () => {
                const [mapRes, invRes] = await Promise.all([
                  listSkuMappings(storeId!),
                  listInventory(storeId!),
                ]);
                setExistingMappingSkuIds(new Set(mapRes.data.map((m) => m.skuId)));
                setInventoryBySkuId(
                  new Map(invRes.data.map((row) => [row.skuId, row.availableQty])),
                );
              }}
              onError={setError}
            />
          </div>

          <div className="qc-sku-footer">
            <button type="button" className="qc-text-link" onClick={() => setStep(2)}>
              ← Back to Store Details
            </button>
            <div className="qc-actions">
              <span className="qc-muted">
                Products Mapped{" "}
                <strong>
                  {mappedCount} / {skus.length}
                </strong>
              </span>
              <Button disabled={saving} onClick={onCompleteSetup}>
                {saving ? "Saving…" : "Complete Setup"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}

function ImportBatchCard({
  storeId,
  onImported,
  onError,
}: {
  storeId: string;
  onImported: () => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          onError(null);
          setBusy(true);
          void file
            .text()
            .then((csv) => bulkSkuMappings(storeId, { csv }))
            .then(() => onImported())
            .catch((err) => onError(err instanceof ApiError ? err.message : "CSV import failed"))
            .finally(() => {
              setBusy(false);
              if (inputRef.current) inputRef.current.value = "";
            });
        }}
      />
      <button
        type="button"
        className="qc-product-card qc-import-card"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <div className="qc-import-icon">
          <span className="material-symbols-outlined">{busy ? "hourglass_top" : "add"}</span>
        </div>
        <h4>{busy ? "Importing…" : "Import Batch"}</h4>
        <p className="qc-muted">Upload a CSV to map products in bulk to this store.</p>
      </button>
    </>
  );
}

export default DarkStoreWizard;
