import { useState, useRef, type ReactNode, type ChangeEvent } from "react";
import type { AppRoute } from "../types";
import { createProduct } from "../api/products";
import type { CreateProductPayload } from "../api/products";
import { uploadReceipt } from "../api/receipts";
import { ApiError } from "../api/client";

interface Props {
  onNavigate: (route: AppRoute) => void;
}

const CATEGORIES = [
  "TV & Display",
  "Laptop",
  "Tablet",
  "Headphones",
  "Storage",
  "Appliances",
  "Peripherals",
  "Camera",
  "Other",
];

interface FormValues {
  name: string;
  brand: string;
  model: string;
  category: string;
  purchaseDate: string;
  purchasePrice: string;
  retailer: string;
  warrantyStart: string;
  warrantyEnd: string;
  notes: string;
}

type FormErrors = Partial<Record<keyof FormValues, string>>;

// Fields the backend requires (name, purchaseDate, warrantyExpiry)
// and extra UX-required fields we enforce in the form
const REQUIRED: (keyof FormValues)[] = ["name", "brand", "category", "purchaseDate", "warrantyEnd"];

const FIELD_LABELS: Record<keyof FormValues, string> = {
  name: "Product Name",
  brand: "Brand",
  model: "Model",
  category: "Category",
  purchaseDate: "Purchase Date",
  purchasePrice: "Purchase Price",
  retailer: "Store / Retailer",
  warrantyStart: "Warranty Start Date",
  warrantyEnd: "Warranty End Date",
  notes: "Notes",
};

export default function AddProduct({ onNavigate }: Props) {
  const [values, setValues] = useState<FormValues>({
    name: "",
    brand: "",
    model: "",
    category: "",
    purchaseDate: "",
    purchasePrice: "",
    retailer: "",
    warrantyStart: "",
    warrantyEnd: "",
    notes: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({});
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [createdProduct, setCreatedProduct] = useState<{ id: string; name: string } | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [retryingReceipt, setRetryingReceipt] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function validate(v: FormValues): FormErrors {
    const errs: FormErrors = {};
    for (const key of REQUIRED) {
      if (!v[key].trim()) {
        errs[key] = `${FIELD_LABELS[key]} is required`;
      }
    }
    if (v.warrantyStart && v.warrantyEnd && v.warrantyEnd < v.warrantyStart) {
      errs.warrantyEnd = "Warranty end date must be after start date";
    }
    if (v.warrantyEnd && v.purchaseDate && v.warrantyEnd < v.purchaseDate) {
      errs.warrantyEnd = "Warranty end date cannot be before purchase date";
    }
    if (v.purchasePrice && !/^\d+(\.\d{0,2})?$/.test(v.purchasePrice)) {
      errs.purchasePrice = "Enter a valid price (e.g. 1799 or 1799.99)";
    }
    return errs;
  }

  function set(field: keyof FormValues, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    if (touched[field] || submitted) {
      const errs = validate(next);
      setErrors((prev) => ({ ...prev, [field]: errs[field] }));
    }
  }

  function blur(field: keyof FormValues) {
    setTouched((t) => ({ ...t, [field]: true }));
    const errs = validate(values);
    setErrors((prev) => ({ ...prev, [field]: errs[field] }));
  }

  function validateReceiptFile(f: File): boolean {
    if (f.size > 10 * 1024 * 1024) {
      setFileError("File exceeds the maximum allowed size of 10 MB.");
      return false;
    }
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    const allowedExts = ["pdf", "jpg", "jpeg", "png", "webp"];
    if (!allowed.includes(f.type) && !allowedExts.includes(ext)) {
      setFileError("Unsupported file type. Please upload a PDF, JPG, PNG, or WEBP.");
      return false;
    }
    setFileError(null);
    return true;
  }

  async function handleRetryReceipt() {
    if (!createdProduct || !file) return;
    setRetryingReceipt(true);
    setReceiptError(null);
    try {
      await uploadReceipt(createdProduct.id, file);
      onNavigate({ page: "product-detail", productId: createdProduct.id });
    } catch (err: any) {
      const msg =
        err instanceof ApiError ? err.message : err?.message || "Failed to upload receipt.";
      setReceiptError(msg);
    } finally {
      setRetryingReceipt(false);
    }
  }

  async function handleSubmit() {
    setSubmitted(true);
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // If product was already created in a previous attempt and only receipt failed,
    // don't recreate the product — retry the receipt directly!
    if (createdProduct && file) {
      await handleRetryReceipt();
      return;
    }

    setSubmitting(true);
    setServerError(null);
    setReceiptError(null);

    const payload: CreateProductPayload = {
      name: values.name.trim(),
      purchaseDate: values.purchaseDate,
      warrantyExpiry: values.warrantyEnd,
    };

    if (values.warrantyStart) payload.warrantyStartDate = values.warrantyStart;
    if (values.category) payload.category = values.category;
    if (values.brand) payload.brand = values.brand.trim();
    if (values.model.trim()) payload.model = values.model.trim();
    if (values.retailer.trim()) payload.retailer = values.retailer.trim();
    if (values.purchasePrice) payload.price = parseFloat(values.purchasePrice);
    if (values.notes.trim()) payload.notes = values.notes.trim();

    let newProduct;
    try {
      newProduct = await createProduct(payload);
    } catch (err: any) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err?.message || "An unexpected error occurred. Please try again.";
      setServerError(msg);
      setSubmitting(false);
      return;
    }

    // Product creation succeeded — preserve it so we never recreate it
    setCreatedProduct({ id: newProduct.id, name: newProduct.name });

    // If receipt file was selected, upload it
    if (file) {
      try {
        await uploadReceipt(newProduct.id, file);
        onNavigate({ page: "products" });
      } catch (receiptErr: any) {
        const msg =
          receiptErr instanceof ApiError
            ? receiptErr.message
            : receiptErr?.message || "Receipt upload failed.";
        setReceiptError(
          `Product "${newProduct.name}" was created successfully, but uploading the receipt failed: ${msg}. You can retry uploading the receipt now, or go directly to the product details.`
        );
        setSubmitting(false);
      }
    } else {
      onNavigate({ page: "products" });
    }
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f && validateReceiptFile(f)) {
      setFile(f);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && validateReceiptFile(f)) {
      setFile(f);
    }
  }

  const hasErrors = Object.keys(validate(values)).length > 0;

  return (
    <div className="px-8 py-8 max-w-[860px] mx-auto">
      {/* Back */}
      <button
        onClick={() => onNavigate({ page: "products" })}
        className="flex items-center gap-1.5 text-[12px] text-[#71717a] hover:text-[#0d0d0d] transition-colors mb-5"
        disabled={submitting}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M8 2.5L4.5 6.5L8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Products
      </button>

      {/* Header */}
      <div className="mb-7">
        <h2 className="text-[17px] font-semibold text-[#0d0d0d] leading-tight tracking-[-0.01em]">Add Product</h2>
        <p className="text-sm text-[#71717a] mt-1">Enter your product details and warranty information.</p>
      </div>

      {/* Partial Success Alert */}
      {createdProduct && receiptError && (
        <div className="mb-6 p-4 bg-[#fffbeb] border border-[#fde68a] rounded-[4px] text-xs text-[#92400e]">
          <div className="font-semibold text-sm mb-1 text-[#b45309]">Product Created with Receipt Warning</div>
          <p className="mb-3 leading-relaxed">{receiptError}</p>
          <div className="flex items-center gap-3 flex-wrap">
            {file && (
              <button
                type="button"
                onClick={handleRetryReceipt}
                disabled={retryingReceipt}
                className="px-3 py-1.5 bg-[#b45309] text-white font-medium rounded-[4px] hover:bg-[#92400e] transition-colors disabled:opacity-50"
              >
                {retryingReceipt ? "Uploading receipt..." : "Retry Receipt Upload"}
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate({ page: "product-detail", productId: createdProduct.id })}
              className="px-3 py-1.5 bg-white border border-[#d97706] text-[#b45309] font-medium rounded-[4px] hover:bg-[#fef3c7] transition-colors"
            >
              Go to Product Detail
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ page: "products" })}
              className="text-[#71717a] hover:text-[#0d0d0d] underline underline-offset-2 ml-auto"
            >
              View All Products
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {/* Product Details */}
        <FormSection title="Product Details">
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            <FormField
              label="Product Name"
              required
              error={errors.name}
              touched={touched.name || submitted}
            >
              <Input
                placeholder='e.g. LG C2 OLED 65"'
                value={values.name}
                onChange={(v) => set("name", v)}
                onBlur={() => blur("name")}
                hasError={!!(errors.name && (touched.name || submitted))}
              />
            </FormField>

            <FormField
              label="Brand"
              required
              error={errors.brand}
              touched={touched.brand || submitted}
            >
              <Input
                placeholder="e.g. LG"
                value={values.brand}
                onChange={(v) => set("brand", v)}
                onBlur={() => blur("brand")}
                hasError={!!(errors.brand && (touched.brand || submitted))}
              />
            </FormField>

            <FormField label="Model" error={errors.model} touched={touched.model || submitted}>
              <Input
                placeholder="e.g. OLED65C2PUA"
                value={values.model}
                onChange={(v) => set("model", v)}
                onBlur={() => blur("model")}
                hasError={false}
              />
            </FormField>

            <FormField
              label="Category"
              required
              error={errors.category}
              touched={touched.category || submitted}
            >
              <SelectInput
                value={values.category}
                onChange={(v) => set("category", v)}
                onBlur={() => blur("category")}
                hasError={!!(errors.category && (touched.category || submitted))}
                options={[{ value: "", label: "Select a category" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
              />
            </FormField>
          </div>
        </FormSection>

        {/* Purchase Details */}
        <FormSection title="Purchase Details">
          <div className="grid grid-cols-3 gap-x-5 gap-y-4">
            <FormField
              label="Purchase Date"
              required
              error={errors.purchaseDate}
              touched={touched.purchaseDate || submitted}
            >
              <Input
                type="date"
                value={values.purchaseDate}
                onChange={(v) => set("purchaseDate", v)}
                onBlur={() => blur("purchaseDate")}
                hasError={!!(errors.purchaseDate && (touched.purchaseDate || submitted))}
              />
            </FormField>

            <FormField
              label="Purchase Price"
              error={errors.purchasePrice}
              touched={touched.purchasePrice || submitted}
            >
              <Input
                placeholder="e.g. 1799"
                prefix="$"
                value={values.purchasePrice}
                onChange={(v) => set("purchasePrice", v)}
                onBlur={() => blur("purchasePrice")}
                hasError={!!(errors.purchasePrice && (touched.purchasePrice || submitted))}
              />
            </FormField>

            <FormField label="Store / Retailer" error={errors.retailer} touched={touched.retailer || submitted}>
              <Input
                placeholder="e.g. Best Buy"
                value={values.retailer}
                onChange={(v) => set("retailer", v)}
                onBlur={() => blur("retailer")}
                hasError={false}
              />
            </FormField>
          </div>
        </FormSection>

        {/* Warranty */}
        <FormSection title="Warranty">
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            <FormField
              label="Warranty Start Date"
              error={errors.warrantyStart}
              touched={touched.warrantyStart || submitted}
            >
              <Input
                type="date"
                value={values.warrantyStart}
                onChange={(v) => set("warrantyStart", v)}
                onBlur={() => blur("warrantyStart")}
                hasError={!!(errors.warrantyStart && (touched.warrantyStart || submitted))}
              />
            </FormField>

            <FormField
              label="Warranty End Date"
              required
              error={errors.warrantyEnd}
              touched={touched.warrantyEnd || submitted}
            >
              <Input
                type="date"
                value={values.warrantyEnd}
                onChange={(v) => set("warrantyEnd", v)}
                onBlur={() => blur("warrantyEnd")}
                hasError={!!(errors.warrantyEnd && (touched.warrantyEnd || submitted))}
              />
            </FormField>
          </div>
        </FormSection>

        {/* Notes */}
        <FormSection title="Notes">
          <textarea
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Optional notes about this product..."
            rows={3}
            className="w-full text-[13px] border border-[#e4e4e7] rounded-[4px] px-3 py-2 focus:outline-none focus:border-[#a1a1aa] transition-colors placeholder:text-[#d4d4d8] resize-none"
          />
        </FormSection>

        {/* Receipt Upload */}
        <FormSection title="Receipt">
          {file ? (
            <SelectedFile file={file} onRemove={() => setFile(null)} />
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`flex flex-col items-center justify-center py-10 border-2 border-dashed rounded-[4px] cursor-pointer transition-colors ${
                dragging
                  ? "border-[#0d0d0d] bg-[#f4f4f5]"
                  : "border-[#d4d4d8] hover:border-[#a1a1aa] hover:bg-[#fafafa]"
              }`}
            >
              <div className="w-10 h-10 bg-[#f4f4f5] rounded-[4px] flex items-center justify-center mb-3">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M10 3v10M6 7l4-4 4 4" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 15h14" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-[13px] font-medium text-[#3f3f46] mb-0.5">
                Drag and drop, or <span className="text-[#0d0d0d] underline underline-offset-2">browse</span>
              </div>
              <div className="text-[11px] text-[#a1a1aa]">PDF, JPG, PNG, WEBP — up to 10 MB</div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          )}
          {fileError && (
            <div className="text-xs text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] p-2.5 rounded-[4px] mt-2.5">
              {fileError}
            </div>
          )}
          {file && (
            <p className="text-[11px] text-[#a1a1aa] mt-2">
              Receipt will be automatically uploaded when the product is saved.
            </p>
          )}
        </FormSection>

        {/* Validation summary */}
        {submitted && hasErrors && (
          <div className="flex items-start gap-2.5 px-4 py-3 bg-[#fef2f2] border border-[#fecaca] rounded-[4px]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
              <circle cx="7" cy="7" r="5.5" stroke="#dc2626" strokeWidth="1.3" />
              <path d="M7 4v3.5" stroke="#dc2626" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="7" cy="10" r="0.7" fill="#dc2626" />
            </svg>
            <div className="text-[12px] text-[#b91c1c]">
              Please fill in all required fields before adding the product.
            </div>
          </div>
        )}

        {/* Server error */}
        {serverError && (
          <div className="flex items-start gap-2.5 px-4 py-3 bg-[#fef2f2] border border-[#fecaca] rounded-[4px]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
              <circle cx="7" cy="7" r="5.5" stroke="#dc2626" strokeWidth="1.3" />
              <path d="M7 4v3.5" stroke="#dc2626" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="7" cy="10" r="0.7" fill="#dc2626" />
            </svg>
            <div className="text-[12px] text-[#b91c1c]">{serverError}</div>
          </div>
        )}

        {/* Form actions */}
        <div className="flex items-center justify-end gap-3 pt-1 pb-2">
          <button
            onClick={() => onNavigate({ page: "products" })}
            disabled={submitting}
            className="text-sm font-medium text-[#3f3f46] border border-[#e4e4e7] px-4 py-2 rounded-[4px] hover:bg-[#f4f4f5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 bg-[#0d0d0d] text-white text-sm font-medium px-4 py-2 rounded-[4px] hover:bg-[#262626] active:bg-[#1a1a1a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting && (
              <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {submitting ? "Saving…" : "Add Product"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Form section wrapper ── */
function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white border border-[#e4e4e7] rounded-[4px] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#e4e4e7] bg-[#f9f9f9]">
        <h3 className="text-[11px] font-semibold text-[#a1a1aa] mono uppercase tracking-wider">{title}</h3>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

/* ── Form field with label + error ── */
function FormField({
  label,
  required,
  error,
  touched,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  touched?: boolean;
  children: ReactNode;
}) {
  const showError = error && touched;
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#52525b] mono uppercase tracking-wider mb-1.5">
        {label}
        {required && <span className="text-[#b91c1c] ml-0.5">*</span>}
      </label>
      {children}
      {showError && (
        <div className="flex items-center gap-1 mt-1.5">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="#dc2626" strokeWidth="1.2" />
            <path d="M6 3.5v3" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="6" cy="8.5" r="0.6" fill="#dc2626" />
          </svg>
          <span className="text-[11px] text-[#b91c1c]">{error}</span>
        </div>
      )}
    </div>
  );
}

/* ── Text/date input ── */
function Input({
  value,
  onChange,
  onBlur,
  placeholder,
  hasError,
  type = "text",
  prefix,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  placeholder?: string;
  hasError: boolean;
  type?: string;
  prefix?: string;
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#a1a1aa] pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`w-full text-[13px] border rounded-[4px] px-3 py-2 focus:outline-none transition-colors placeholder:text-[#d4d4d8] ${
          prefix ? "pl-6" : ""
        } ${
          hasError
            ? "border-[#fca5a5] bg-[#fff8f8] focus:border-[#dc2626]"
            : "border-[#e4e4e7] bg-white focus:border-[#a1a1aa]"
        }`}
      />
    </div>
  );
}

/* ── Select input ── */
function SelectInput({
  value,
  onChange,
  onBlur,
  hasError,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  hasError: boolean;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`w-full appearance-none text-[13px] border rounded-[4px] px-3 pr-8 py-2 focus:outline-none transition-colors cursor-pointer ${
          value === "" ? "text-[#d4d4d8]" : "text-[#0d0d0d]"
        } ${
          hasError
            ? "border-[#fca5a5] bg-[#fff8f8] focus:border-[#dc2626]"
            : "border-[#e4e4e7] bg-white focus:border-[#a1a1aa]"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.value === ""}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

/* ── Selected file display ── */
function SelectedFile({ file, onRemove }: { file: File; onRemove: () => void }) {
  const ext = file.name.split(".").pop()?.toUpperCase() ?? "FILE";
  const size =
    file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(0)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="flex items-center gap-3 p-3.5 border border-[#e4e4e7] rounded-[4px] bg-[#fafafa]">
      <div className="w-9 h-10 bg-white border border-[#e4e4e7] rounded-[3px] flex items-center justify-center shrink-0">
        <span className="text-[9px] font-bold mono text-[#71717a]">{ext}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[#0d0d0d] truncate">{file.name}</div>
        <div className="text-[11px] text-[#a1a1aa] mono mt-0.5">{ext} · {size}</div>
      </div>
      <button
        onClick={onRemove}
        className="text-[#a1a1aa] hover:text-[#52525b] transition-colors p-1"
        aria-label="Remove file"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
