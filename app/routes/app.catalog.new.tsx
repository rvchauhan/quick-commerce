import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, type HeadersFunction } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useDarkStore } from "../lib/dark-store/context";
import {
  createSku,
  getCatalogMeta,
  listSkus,
  uploadCatalogImage,
} from "../lib/dark-store/api";
import {
  ApiError,
  type SkuSpec,
  type SkuVariant,
  type VariantOption,
} from "../lib/dark-store/types";
import { Banner, Button, PageHeader, PortalShell } from "../components/portal-ui";

const MAX_NAME = 70;
const MAX_DESCRIPTION = 5000;
const MAX_GALLERY = 4;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_VARIANTS = 200;
const MONEY_MAX = 99_999_999.99;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const CURRENCIES = ["USD", "INR", "EUR", "GBP", "AUD", "CAD", "AED", "SGD"] as const;

type ImageSlot = { file: File; preview: string };
type OptionDraft = { name: string; valuesText: string };

function sanitizeDecimal(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}

function clampDecimal(value: string, max: number) {
  const cleaned = sanitizeDecimal(value);
  if (cleaned === "" || cleaned === ".") return cleaned;
  return Number(cleaned) > max ? String(max) : cleaned;
}

function sanitizeInt(value: string) {
  return value.replace(/\D/g, "");
}

function parseNum(value: string) {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : undefined;
}

function optionKey(options: Record<string, string>) {
  return Object.keys(options)
    .sort()
    .map((key) => `${key}:${options[key]}`)
    .join("|");
}

function cartesian(options: VariantOption[]) {
  return options.reduce<Record<string, string>[]>((acc, option) => {
    if (acc.length === 0) {
      return option.values.map((value) => ({ [option.name]: value }));
    }
    const next: Record<string, string>[] = [];
    for (const combo of acc) {
      for (const value of option.values) next.push({ ...combo, [option.name]: value });
    }
    return next;
  }, []);
}

function Section({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="qc-sku-section">
      <div className="qc-sku-section-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="qc-sku-section-body">{children}</div>
    </section>
  );
}

function FormField({
  label,
  required,
  error,
  hint,
  count,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  count?: string;
  children: ReactNode;
}) {
  return (
    <div className={`qc-sku-field${error ? " has-error" : ""}`}>
      <label>
        {label}
        {required ? <span className="req"> *</span> : null}
      </label>
      {children}
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
        <div>
          {error ? <p className="error">{error}</p> : null}
          {!error && hint ? <p className="hint">{hint}</p> : null}
        </div>
        {count ? <p className="count">{count}</p> : null}
      </div>
    </div>
  );
}

function ImagePicker({
  slot,
  label,
  onPick,
  onClear,
}: {
  slot: ImageSlot | null;
  label: string;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <button
        type="button"
        className={`qc-upload${slot ? " has-image" : ""}`}
        onClick={() => inputRef.current?.click()}
      >
        {slot ? <img src={slot.preview} alt="" /> : null}
        <div className="overlay">
          <span className="material-symbols-outlined" style={{ fontSize: 28, display: "block", marginBottom: 6 }}>
            cloud_upload
          </span>
          {label}
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onPick(file);
        }}
      />
      {slot ? (
        <button type="button" className="qc-btn qc-btn-ghost" style={{ marginTop: 6 }} onClick={onClear}>
          Remove
        </button>
      ) : null}
    </div>
  );
}

export default function CatalogNewPage() {
  const ds = useDarkStore();
  const shopify = useAppBridge();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [customBrand, setCustomBrand] = useState(false);
  const [customCategory, setCustomCategory] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [basePrice, setBasePrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [initialStock, setInitialStock] = useState("");
  const [reorderPoint, setReorderPoint] = useState("10");
  const [allowBackorder, setAllowBackorder] = useState(false);
  const [isFragile, setIsFragile] = useState(false);
  const [requiresColdStorage, setRequiresColdStorage] = useState(false);
  const [weightKg, setWeightKg] = useState("");
  const [dimL, setDimL] = useState("");
  const [dimW, setDimW] = useState("");
  const [dimH, setDimH] = useState("");
  const [barcode, setBarcode] = useState("");
  const [skuCode, setSkuCode] = useState("");
  const [primary, setPrimary] = useState<ImageSlot | null>(null);
  const [gallery, setGallery] = useState<(ImageSlot | null)[]>(Array(MAX_GALLERY).fill(null));
  const [optionDrafts, setOptionDrafts] = useState<OptionDraft[]>([]);
  const [variants, setVariants] = useState<SkuVariant[]>([]);
  const [specs, setSpecs] = useState<SkuSpec[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [existingSkus, setExistingSkus] = useState<{ barcode: string | null; skuCode: string | null }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!ds.configured) return;
    void Promise.all([getCatalogMeta(), listSkus()])
      .then(([meta, skus]) => {
        setBrands(meta.brands ?? []);
        setCategories(meta.categories ?? []);
        setExistingSkus(
          (skus.data ?? []).map((sku) => ({
            barcode: sku.barcode,
            skuCode: sku.skuCode,
          })),
        );
      })
      .catch(() => {
        // Meta/list are optional for creating a SKU.
      });
  }, [ds.configured]);

  const parsedOptions = useMemo<VariantOption[]>(
    () =>
      optionDrafts
        .map((draft) => ({
          name: draft.name.trim(),
          values: [...new Set(draft.valuesText.split(",").map((value) => value.trim()).filter(Boolean))],
        }))
        .filter((option) => option.name && option.values.length > 0),
    [optionDrafts],
  );

  const variantCount = useMemo(() => {
    if (parsedOptions.length === 0) return 0;
    return parsedOptions.reduce((acc, option) => acc * option.values.length, 1);
  }, [parsedOptions]);

  useEffect(() => {
    if (variantCount === 0 || variantCount > MAX_VARIANTS) {
      setVariants([]);
      return;
    }

    const combos = cartesian(parsedOptions);
    setVariants((previous) => {
      const byKey = new Map(previous.map((variant) => [optionKey(variant.options), variant]));
      return combos.map((options) => {
        const existing = byKey.get(optionKey(options));
        if (existing) return existing;
        return {
          id: crypto.randomUUID(),
          options,
          price: parseNum(basePrice),
          stock: parseNum(initialStock) !== undefined ? Math.floor(Number(initialStock)) : undefined,
        };
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(parsedOptions), variantCount]);

  if (!ds.configured) {
    return (
      <PortalShell>
        <PageHeader crumbs={["Catalog", "Master Catalog", "Add SKU"]} title="Add New Product" />
        <Banner tone="warning" title="Dark Store API not connected">
          {ds.error}
        </Banner>
      </PortalShell>
    );
  }

  const basePriceNum = parseNum(basePrice);
  const compareAtNum = parseNum(compareAtPrice);
  const compareInvalid =
    compareAtNum !== undefined && basePriceNum !== undefined && compareAtNum <= basePriceNum;
  const barcodeTrim = barcode.trim();
  const barcodeInvalid = barcodeTrim !== "" && !/^\d{8,14}$/.test(barcodeTrim);
  const barcodeTaken = barcodeTrim !== "" && existingSkus.some((sku) => sku.barcode === barcodeTrim);
  const skuTrim = skuCode.trim();
  const skuTaken = skuTrim !== "" && existingSkus.some((sku) => sku.skuCode === skuTrim);
  const nameError = attempted && !name.trim() ? "Product title is required" : undefined;
  const priceError = attempted && basePriceNum === undefined ? "Price is required" : undefined;

  const pickImage = (file: File, assign: (slot: ImageSlot) => void) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(`${file.name}: only PNG, JPG or WEBP allowed`);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`${file.name}: exceeds the 2MB limit`);
      return;
    }
    setError(null);
    assign({ file, preview: URL.createObjectURL(file) });
  };

  const generateSkuCode = () => {
    setSkuCode(`SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
  };

  const save = async (status: "draft" | "active") => {
    setAttempted(true);
    setError(null);

    if (
      !name.trim() ||
      basePriceNum === undefined ||
      compareInvalid ||
      barcodeInvalid ||
      barcodeTaken ||
      skuTaken
    ) {
      return;
    }

    if (variantCount > MAX_VARIANTS) {
      setError(`Too many variants (${variantCount}). Keep the matrix under ${MAX_VARIANTS}.`);
      return;
    }

    setSaving(true);
    try {
      const slots = [primary, ...gallery].filter((slot): slot is ImageSlot => slot !== null);
      const images: string[] = [];
      for (const slot of slots) {
        const uploaded = await uploadCatalogImage(slot.file);
        images.push(uploaded.url);
      }

      const length = parseNum(dimL);
      const width = parseNum(dimW);
      const height = parseNum(dimH);
      const dimensionsCm =
        length !== undefined && width !== undefined && height !== undefined
          ? { length, width, height }
          : undefined;

      await createSku({
        name: name.trim(),
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
        barcode: barcodeTrim || undefined,
        basePrice: basePriceNum,
        currency,
        compareAtPrice: compareAtNum,
        costPrice: parseNum(costPrice),
        taxRate: parseNum(taxRate) ?? 0,
        allowBackorder,
        unitOfMeasure: "each",
        skuCode: skuTrim || undefined,
        isFragile,
        requiresColdStorage,
        weightKg: parseNum(weightKg),
        dimensionsCm,
        defaultReorderPoint:
          parseNum(reorderPoint) !== undefined ? Math.floor(Number(reorderPoint)) : 10,
        defaultInitialStock:
          parseNum(initialStock) !== undefined ? Math.floor(Number(initialStock)) : undefined,
        variantOptions: parsedOptions,
        variants: variantCount > 0 && variantCount <= MAX_VARIANTS ? variants : [],
        description: description.trim() || undefined,
        specs: specs
          .map((spec) => ({ key: spec.key.trim(), value: spec.value.trim() }))
          .filter((spec) => spec.key && spec.value),
        images,
        status,
      });

      shopify.toast.show(status === "draft" ? "SKU saved as draft" : "SKU added to catalog");
      navigate("/app/catalog");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create SKU");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalShell>
      <PageHeader
        crumbs={["Catalog", "Master Catalog", "Add SKU"]}
        title="Add New Product"
        subtitle="Fill in the technical and logistics details to register this product into the global catalog."
        actions={<span className="qc-badge muted">Unsaved</span>}
      />

      {error ? (
        <Banner tone="critical" title="Could not save SKU">
          {error}
        </Banner>
      ) : null}

      <div className="qc-sku-layout">
        <div className="qc-sku-main">
          <Section title="Title and description">
            <div className="qc-sku-grid">
              <FormField label="Title" required error={nameError} count={`${name.length}/${MAX_NAME}`}>
                <input
                  value={name}
                  maxLength={MAX_NAME}
                  placeholder="e.g. Organic Almond Milk 1L"
                  onChange={(event) => setName(event.target.value)}
                />
              </FormField>
              <FormField
                label="Description"
                count={`${description.length}/${MAX_DESCRIPTION}`}
                hint="Shown to store staff and customers."
              >
                <textarea
                  value={description}
                  maxLength={MAX_DESCRIPTION}
                  placeholder="Describe ingredients, usage, storage notes…"
                  onChange={(event) => setDescription(event.target.value)}
                />
              </FormField>
            </div>
          </Section>

          <Section title="Media" subtitle="PNG, JPG or WEBP — max 2MB each">
            <div className="qc-sku-grid cols-2">
              <FormField label="Primary image">
                <ImagePicker
                  slot={primary}
                  label="Drag & drop or click to upload"
                  onPick={(file) =>
                    pickImage(file, (slot) => {
                      if (primary?.preview) URL.revokeObjectURL(primary.preview);
                      setPrimary(slot);
                    })
                  }
                  onClear={() => {
                    if (primary?.preview) URL.revokeObjectURL(primary.preview);
                    setPrimary(null);
                  }}
                />
              </FormField>
              <FormField label={`Gallery slots (${gallery.filter(Boolean).length}/${MAX_GALLERY})`}>
                <div className="qc-gallery">
                  {gallery.map((slot, index) => (
                    <ImagePicker
                      key={index}
                      slot={slot}
                      label="+"
                      onPick={(file) =>
                        pickImage(file, (next) => {
                          setGallery((previous) => {
                            const copy = [...previous];
                            if (copy[index]?.preview) URL.revokeObjectURL(copy[index]!.preview);
                            copy[index] = next;
                            return copy;
                          });
                        })
                      }
                      onClear={() => {
                        setGallery((previous) => {
                          const copy = [...previous];
                          if (copy[index]?.preview) URL.revokeObjectURL(copy[index]!.preview);
                          copy[index] = null;
                          return copy;
                        });
                      }}
                    />
                  ))}
                </div>
              </FormField>
            </div>
          </Section>

          <Section title="Pricing">
            <div className="qc-sku-grid cols-2">
              <FormField label="Currency">
                <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Price" required error={priceError}>
                <input
                  value={basePrice}
                  inputMode="decimal"
                  placeholder="0.00"
                  onChange={(event) => setBasePrice(clampDecimal(event.target.value, MONEY_MAX))}
                />
              </FormField>
              <FormField
                label="Compare-at price"
                error={compareInvalid ? "Must be higher than selling price" : undefined}
              >
                <input
                  value={compareAtPrice}
                  inputMode="decimal"
                  placeholder="0.00"
                  onChange={(event) => setCompareAtPrice(clampDecimal(event.target.value, MONEY_MAX))}
                />
              </FormField>
              <FormField label="Cost per item">
                <input
                  value={costPrice}
                  inputMode="decimal"
                  placeholder="0.00"
                  onChange={(event) => setCostPrice(clampDecimal(event.target.value, MONEY_MAX))}
                />
              </FormField>
              <FormField label="Tax rate">
                <input
                  value={taxRate}
                  inputMode="decimal"
                  placeholder="0.00%"
                  onChange={(event) => setTaxRate(clampDecimal(event.target.value, 100))}
                />
              </FormField>
            </div>
          </Section>

          <Section title="Inventory">
            <div className="qc-sku-grid cols-2">
              <FormField label="Initial stock">
                <input
                  value={initialStock}
                  inputMode="numeric"
                  placeholder="0"
                  onChange={(event) => setInitialStock(sanitizeInt(event.target.value))}
                />
              </FormField>
              <FormField label="Reorder point">
                <input
                  value={reorderPoint}
                  inputMode="numeric"
                  placeholder="10"
                  onChange={(event) => setReorderPoint(sanitizeInt(event.target.value))}
                />
              </FormField>
            </div>
            <div style={{ marginTop: "0.85rem" }}>
              <label className="qc-toggle">
                <span className="label">Continue selling when out of stock</span>
                <input
                  type="checkbox"
                  checked={allowBackorder}
                  onChange={(event) => setAllowBackorder(event.target.checked)}
                />
              </label>
            </div>
          </Section>

          <Section title="Shipping">
            <div className="qc-sku-grid cols-2" style={{ marginBottom: "0.85rem" }}>
              <label className="qc-toggle">
                <span className="label">Fragile item</span>
                <input
                  type="checkbox"
                  checked={isFragile}
                  onChange={(event) => setIsFragile(event.target.checked)}
                />
              </label>
              <label className="qc-toggle">
                <span className="label">Cold storage required</span>
                <input
                  type="checkbox"
                  checked={requiresColdStorage}
                  onChange={(event) => setRequiresColdStorage(event.target.checked)}
                />
              </label>
            </div>
            <div className="qc-sku-grid cols-4">
              <FormField label="Weight (kg)">
                <input
                  value={weightKg}
                  inputMode="decimal"
                  placeholder="0.00"
                  onChange={(event) => setWeightKg(clampDecimal(event.target.value, 1000))}
                />
              </FormField>
              <FormField label="Length (cm)">
                <input
                  value={dimL}
                  inputMode="decimal"
                  placeholder="L"
                  onChange={(event) => setDimL(clampDecimal(event.target.value, 1000))}
                />
              </FormField>
              <FormField label="Width (cm)">
                <input
                  value={dimW}
                  inputMode="decimal"
                  placeholder="W"
                  onChange={(event) => setDimW(clampDecimal(event.target.value, 1000))}
                />
              </FormField>
              <FormField label="Height (cm)">
                <input
                  value={dimH}
                  inputMode="decimal"
                  placeholder="H"
                  onChange={(event) => setDimH(clampDecimal(event.target.value, 1000))}
                />
              </FormField>
            </div>
          </Section>

          <Section
            title="Variants"
            subtitle="Add options like size or color to create multiple variants."
            actions={
              <Button
                variant="secondary"
                icon="add"
                onClick={() => setOptionDrafts((previous) => [...previous, { name: "", valuesText: "" }])}
              >
                Add option
              </Button>
            }
          >
            {optionDrafts.length === 0 ? (
              <button
                type="button"
                className="qc-btn qc-btn-secondary"
                style={{ width: "100%" }}
                onClick={() => setOptionDrafts([{ name: "", valuesText: "" }])}
              >
                + Add options like size or color
              </button>
            ) : (
              <div className="qc-sku-grid">
                {optionDrafts.map((draft, index) => (
                  <div key={index} className="qc-sku-grid cols-2">
                    <FormField label="Option name">
                      <input
                        value={draft.name}
                        placeholder="Size"
                        onChange={(event) =>
                          setOptionDrafts((previous) =>
                            previous.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, name: event.target.value } : row,
                            ),
                          )
                        }
                      />
                    </FormField>
                    <FormField label="Values (comma-separated)">
                      <div className="qc-sku-input-row">
                        <input
                          value={draft.valuesText}
                          placeholder="S, M, L"
                          onChange={(event) =>
                            setOptionDrafts((previous) =>
                              previous.map((row, rowIndex) =>
                                rowIndex === index ? { ...row, valuesText: event.target.value } : row,
                              ),
                            )
                          }
                        />
                        <Button
                          variant="ghost"
                          icon="delete"
                          onClick={() =>
                            setOptionDrafts((previous) => previous.filter((_, rowIndex) => rowIndex !== index))
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </FormField>
                  </div>
                ))}

                {variantCount > MAX_VARIANTS ? (
                  <p className="qc-muted">
                    Generated matrix is too large ({variantCount}). Reduce options/values.
                  </p>
                ) : variants.length > 0 ? (
                  <div className="qc-table-wrap">
                    <table className="qc-table">
                      <thead>
                        <tr>
                          <th>Variant</th>
                          <th>Price</th>
                          <th>Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variants.map((variant) => (
                          <tr key={variant.id}>
                            <td>{Object.values(variant.options).join(" / ")}</td>
                            <td>
                              <input
                                className="qc-input"
                                value={variant.price ?? ""}
                                onChange={(event) => {
                                  const price = parseNum(clampDecimal(event.target.value, MONEY_MAX));
                                  setVariants((previous) =>
                                    previous.map((row) =>
                                      row.id === variant.id ? { ...row, price } : row,
                                    ),
                                  );
                                }}
                              />
                            </td>
                            <td>
                              <input
                                className="qc-input"
                                value={variant.stock ?? ""}
                                onChange={(event) => {
                                  const stockRaw = sanitizeInt(event.target.value);
                                  const stock = stockRaw === "" ? undefined : Number(stockRaw);
                                  setVariants((previous) =>
                                    previous.map((row) =>
                                      row.id === variant.id ? { ...row, stock } : row,
                                    ),
                                  );
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            )}
          </Section>

          <Section
            title="Specifications"
            subtitle="Free-form spec sheet shown to store staff and customers."
            actions={
              <Button
                variant="secondary"
                icon="add"
                onClick={() => setSpecs((previous) => [...previous, { key: "", value: "" }])}
              >
                Add spec
              </Button>
            }
          >
            {specs.length === 0 ? (
              <button
                type="button"
                className="qc-btn qc-btn-secondary"
                style={{ width: "100%" }}
                onClick={() => setSpecs([{ key: "", value: "" }])}
              >
                + Add a spec like Processor or Material
              </button>
            ) : (
              <div className="qc-sku-grid">
                {specs.map((spec, index) => (
                  <div key={index} className="qc-sku-grid cols-2">
                    <FormField label="Field">
                      <input
                        value={spec.key}
                        placeholder="Material"
                        onChange={(event) =>
                          setSpecs((previous) =>
                            previous.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, key: event.target.value } : row,
                            ),
                          )
                        }
                      />
                    </FormField>
                    <FormField label="Value">
                      <div className="qc-sku-input-row">
                        <input
                          value={spec.value}
                          placeholder="Glass bottle"
                          onChange={(event) =>
                            setSpecs((previous) =>
                              previous.map((row, rowIndex) =>
                                rowIndex === index ? { ...row, value: event.target.value } : row,
                              ),
                            )
                          }
                        />
                        <Button
                          variant="ghost"
                          icon="delete"
                          onClick={() =>
                            setSpecs((previous) => previous.filter((_, rowIndex) => rowIndex !== index))
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </FormField>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <aside className="qc-sku-side">
          <Section title="Organization">
            <div className="qc-sku-grid">
              <FormField label="Brand">
                {customBrand || brands.length === 0 ? (
                  <input
                    value={brand}
                    placeholder="Select or type brand"
                    onChange={(event) => setBrand(event.target.value)}
                  />
                ) : (
                  <select
                    value={brand}
                    onChange={(event) => {
                      if (event.target.value === "__custom__") {
                        setCustomBrand(true);
                        setBrand("");
                      } else {
                        setBrand(event.target.value);
                      }
                    }}
                  >
                    <option value="">Select brand</option>
                    {brands.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                    <option value="__custom__">+ Add new…</option>
                  </select>
                )}
              </FormField>
              <FormField label="Category">
                {customCategory || categories.length === 0 ? (
                  <input
                    value={category}
                    placeholder="Select or type category"
                    onChange={(event) => setCategory(event.target.value)}
                  />
                ) : (
                  <select
                    value={category}
                    onChange={(event) => {
                      if (event.target.value === "__custom__") {
                        setCustomCategory(true);
                        setCategory("");
                      } else {
                        setCategory(event.target.value);
                      }
                    }}
                  >
                    <option value="">Select category</option>
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                    <option value="__custom__">+ Add new…</option>
                  </select>
                )}
              </FormField>
            </div>
          </Section>

          <Section title="Identification">
            <div className="qc-sku-grid">
              <FormField
                label="UPC / EAN barcode"
                error={
                  barcodeInvalid
                    ? "Barcode must be 8–14 digits"
                    : barcodeTaken
                      ? "Barcode already exists in catalog"
                      : undefined
                }
              >
                <input
                  value={barcode}
                  inputMode="numeric"
                  placeholder="Barcode"
                  onChange={(event) => setBarcode(sanitizeInt(event.target.value))}
                />
              </FormField>
              <FormField
                label="Internal SKU ID"
                error={skuTaken ? "SKU code already exists" : undefined}
                hint="Leave blank to auto-generate"
              >
                <div className="qc-sku-input-row">
                  <input
                    value={skuCode}
                    placeholder="SKU-XXXXXX"
                    onChange={(event) => setSkuCode(event.target.value)}
                  />
                  <Button variant="secondary" onClick={generateSkuCode}>
                    Generate
                  </Button>
                </div>
              </FormField>
            </div>
          </Section>
        </aside>
      </div>

      <div className="qc-sku-footer">
        <Link className="qc-btn qc-btn-secondary" to="/app/catalog">
          <span className="material-symbols-outlined">close</span>
          Discard
        </Link>
        <div className="qc-actions">
          <Button variant="secondary" disabled={saving} onClick={() => void save("draft")}>
            Save as draft
          </Button>
          <Button icon="check" disabled={saving} onClick={() => void save("active")}>
            {saving ? "Saving…" : "Save product"}
          </Button>
        </div>
      </div>
    </PortalShell>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
