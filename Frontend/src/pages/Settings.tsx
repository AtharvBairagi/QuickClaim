import { useState, useEffect, type ReactNode, type ChangeEvent } from "react";
import { useAuth } from "../context/AuthContext";

type Toggle = { id: string; label: string; description: string; value: boolean };

export default function Settings() {
  const { user, logout } = useAuth();

  // Profile
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [profileSaved, setProfileSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const initials = (user?.name || "User")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  // Password
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSaved, setPwSaved] = useState(false);

  // Notifications
  const [notifs, setNotifs] = useState<Toggle[]>([
    { id: "expiry_30", label: "30-day expiry reminder", description: "Notify me when a warranty expires in 30 days.", value: true },
    { id: "expiry_7", label: "7-day expiry reminder", description: "Notify me when a warranty expires in 7 days.", value: true },
    { id: "expired", label: "Warranty expired", description: "Notify me when a warranty has lapsed.", value: false },
    { id: "shared_invite", label: "Shared ownership invites", description: "Notify me when someone shares a product with me.", value: true },
    { id: "shared_removed", label: "Sharing removed", description: "Notify me when I am removed from a shared product.", value: false },
  ]);

  function saveProfile() {
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  }

  function savePassword() {
    if (!pwCurrent) { setPwError("Please enter your current password."); return; }
    if (pwNew.length < 8) { setPwError("New password must be at least 8 characters."); return; }
    if (pwNew !== pwConfirm) { setPwError("New passwords do not match."); return; }
    setPwError("");
    setPwCurrent(""); setPwNew(""); setPwConfirm("");
    setPwSaved(true);
    setTimeout(() => setPwSaved(false), 2500);
  }

  function toggleNotif(id: string) {
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, value: !n.value } : n));
  }

  async function handleSignOut() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="px-8 py-8 max-w-[760px] mx-auto">
      <div className="mb-7">
        <h2 className="text-[17px] font-semibold text-[#0d0d0d] leading-tight tracking-[-0.01em]">Settings</h2>
        <p className="text-sm text-[#71717a] mt-1">Manage your profile, notifications, and account preferences.</p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Profile */}
        <SettingsSection title="Profile">
          <div className="flex items-start gap-5 mb-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-full bg-[#0d0d0d] text-white flex items-center justify-center text-lg font-semibold select-none">
                {initials}
              </div>
              <button className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white border border-[#a1a1aa] flex items-center justify-center shadow-sm hover:bg-[#f4f4f5] transition-colors">
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                  <path d="M7 1.5l1.5 1.5-5.5 5.5H1.5V7L7 1.5z" stroke="#52525b" strokeWidth="1.1" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="text-[12px] text-[#71717a] pt-1 leading-relaxed">
              Upload a profile photo. JPG or PNG, max 2 MB.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <FieldGroup label="Full Name" required>
              <TextInput value={name} onChange={setName} placeholder="Full name" />
            </FieldGroup>
            <FieldGroup label="Email Address" required>
              <TextInput value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
            </FieldGroup>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={saveProfile} className="flex items-center gap-2 bg-[#0d0d0d] text-white text-sm font-medium px-4 py-2 rounded-[4px] hover:bg-[#262626] transition-colors">
              Save Profile
            </button>
            {profileSaved && <SavedBadge />}
          </div>
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title="Notifications">
          <div className="flex flex-col divide-y divide-[#f4f4f5]">
            {notifs.map((n) => (
              <div key={n.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                <div>
                  <div className="text-[13px] font-medium text-[#0d0d0d]">{n.label}</div>
                  <div className="text-[11px] text-[#71717a] mt-0.5">{n.description}</div>
                </div>
                <Toggle checked={n.value} onChange={() => toggleNotif(n.id)} />
              </div>
            ))}
          </div>
        </SettingsSection>

        {/* Change Password */}
        <SettingsSection title="Change Password">
          <div className="flex flex-col gap-4 mb-5">
            <FieldGroup label="Current Password" required>
              <TextInput value={pwCurrent} onChange={setPwCurrent} placeholder="••••••••" type="password" />
            </FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label="New Password" required>
                <TextInput value={pwNew} onChange={setPwNew} placeholder="Min. 8 characters" type="password" />
              </FieldGroup>
              <FieldGroup label="Confirm New Password" required>
                <TextInput value={pwConfirm} onChange={setPwConfirm} placeholder="Repeat new password" type="password" />
              </FieldGroup>
            </div>
          </div>

          {pwError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-[#fef2f2] border border-[#fecaca] rounded-[4px] mb-4">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="shrink-0">
                <circle cx="7" cy="7" r="5.5" stroke="#dc2626" strokeWidth="1.3" />
                <path d="M7 4v3.5" stroke="#dc2626" strokeWidth="1.3" strokeLinecap="round" />
                <circle cx="7" cy="10" r="0.7" fill="#dc2626" />
              </svg>
              <span className="text-[12px] text-[#b91c1c]">{pwError}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={savePassword} className="bg-[#0d0d0d] text-white text-sm font-medium px-4 py-2 rounded-[4px] hover:bg-[#262626] transition-colors">
              Update Password
            </button>
            {pwSaved && <SavedBadge />}
          </div>
        </SettingsSection>

        {/* Account */}
        <SettingsSection title="Account">
          <div className="flex flex-col divide-y divide-[#f4f4f5]">
            <div className="flex items-center justify-between py-3.5 first:pt-0">
              <div>
                <div className="text-[13px] font-medium text-[#0d0d0d]">Sign Out</div>
                <div className="text-[11px] text-[#71717a] mt-0.5">Sign out of your QuickClaim account on this device.</div>
              </div>
              <button
                onClick={handleSignOut}
                disabled={loggingOut}
                className="text-sm font-medium text-[#3f3f46] border border-[#a1a1aa] px-3 py-1.5 rounded-[4px] hover:bg-[#f4f4f5] transition-colors disabled:opacity-50"
              >
                {loggingOut ? "Signing out..." : "Sign Out"}
              </button>
            </div>
            <div className="flex items-center justify-between py-3.5 last:pb-0">
              <div>
                <div className="text-[13px] font-medium text-[#b91c1c]">Delete Account</div>
                <div className="text-[11px] text-[#71717a] mt-0.5">Permanently delete your account and all associated data.</div>
              </div>
              <button className="text-sm font-medium text-[#b91c1c] border border-[#fecaca] px-3 py-1.5 rounded-[4px] hover:bg-[#fef2f2] transition-colors">
                Delete Account
              </button>
            </div>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}

/* ── Reusable primitives ── */

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white border border-[#a1a1aa] rounded-[4px] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#a1a1aa] bg-[#f9f9f9]">
        <h3 className="text-[11px] font-semibold text-[#52525b] mono uppercase tracking-wider">{title}</h3>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

function FieldGroup({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#52525b] mono uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-[#b91c1c] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input type={type} value={value} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-[13px] border border-[#a1a1aa] rounded-[4px] px-3 py-2 bg-white focus:outline-none focus:border-[#52525b] transition-colors placeholder:text-[#71717a]" />
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${checked ? "bg-[#0d0d0d]" : "bg-[#71717a]"}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

function SavedBadge() {
  return (
    <span className="flex items-center gap-1.5 text-[12px] text-[#15803d] font-medium">
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="#15803d" strokeWidth="1.3" />
        <path d="M4.5 7l2 2 3-3" stroke="#15803d" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Saved
    </span>
  );
}
