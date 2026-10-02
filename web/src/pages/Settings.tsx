import { useEffect, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Monitor,
  Moon,
  Palette,
  Save,
  ShieldCheck,
  Sun,
  UserRound,
} from "../components/icons";
import { getUser, saveSession, getToken } from "../lib/auth";
import { applyTheme, cacheTheme, type ThemePref } from "../lib/theme";
import {
  getMyProfile,
  updatePassword,
  updatePreferences,
  updateProfile,
  type UserProfile,
} from "../lib/users";

type TabId = "profile" | "security" | "preferences";

const TABS: Array<{ id: TabId; label: string; Icon: typeof UserRound }> = [
  { id: "profile", label: "Profile", Icon: UserRound },
  { id: "security", label: "Security", Icon: ShieldCheck },
  { id: "preferences", label: "Preferences", Icon: Palette },
];

function mapError(e: unknown): string {
  const raw =
    (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
    (e as Error)?.message ||
    "Terjadi kesalahan";
  if (raw === "Username already taken") return "Username sudah digunakan. Silakan pilih username lain.";
  if (raw === "Current password is incorrect") return "Password saat ini salah.";
  if (/Passwords do not match/i.test(raw)) return "Konfirmasi password tidak sama.";
  if (/must differ/i.test(raw)) return "Password baru harus berbeda dari password saat ini.";
  if (/Validation failed/i.test(raw)) return "Input tidak valid, periksa kembali isian form.";
  return raw;
}

function FieldError({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <small role="alert" style={{ color: "var(--lf-error)" }}>
      {msg}
    </small>
  );
}

export default function Settings() {
  const [tab, setTab] = useState<TabId>("profile");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    getMyProfile()
      .then(setProfile)
      .catch((e: unknown) => setLoadError(mapError(e)))
      .finally(() => setLoading(false));
  }, []);

  function onTabKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const ids = TABS.map((t) => t.id);
    const i = ids.indexOf(tab);
    const next = e.key === "ArrowRight" ? (i + 1) % ids.length : (i - 1 + ids.length) % ids.length;
    setTab(ids[next]);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="lf-page">
      <div className="lf-page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Settings</h1>
          <p>Kelola profil, keamanan akun, dan preferensi LightFlow.</p>
        </div>
      </div>

      <div className="lf-tabs" role="tablist" aria-label="Pengaturan akun" onKeyDown={onTabKey}>
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className={`lf-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <t.Icon size={16} aria-hidden /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--md-sys-color-on-surface-variant)" }}>
          <Loader2 size={15} className="lf-spin" aria-hidden /> Memuat…
        </p>
      ) : loadError || !profile ? (
        <div className="lf-error" role="alert">{loadError || "Gagal memuat profil."}</div>
      ) : (
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === "profile" && <ProfileForm key={profile.id} initial={profile} />}
          {tab === "security" && <SecurityForm />}
          {tab === "preferences" && <PreferencesForm key={profile.id} initial={profile.themePreference} />}
        </div>
      )}
    </div>
  );
}

/* ---------------- Profile ---------------- */

function ProfileForm({ initial }: { initial: UserProfile }) {
  const [username, setUsername] = useState(initial.username);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [fieldErr, setFieldErr] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  function validateLocal(): boolean {
    const u = username.trim();
    if (u.length < 3 || u.length > 64 || !/^[a-zA-Z0-9._-]+$/.test(u)) {
      setFieldErr("Username 3–64 karakter: huruf, angka, titik, underscore, strip.");
      return false;
    }
    if (displayName.trim().length > 64) {
      setFieldErr("Display name maksimal 64 karakter.");
      return false;
    }
    setFieldErr("");
    return true;
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    if (!validateLocal()) return;
    setSaving(true);
    try {
      const user = await updateProfile({ username: username.trim(), displayName: displayName.trim() });
      const token = getToken();
      const prev = getUser();
      if (token && prev) saveSession(token, { ...prev, username: user.username, displayName: user.displayName });
      setOk("Profil berhasil diperbarui.");
    } catch (err: unknown) {
      setError(mapError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="lf-card" style={{ maxWidth: 720 }} onSubmit={onSave} noValidate={false}>
      <h3>Profile</h3>
      <p className="sub">Informasi dasar akun LightFlow.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="lf-field">
          <span>Username</span>
          <input
            className="lf-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={64}
            autoComplete="username"
            aria-describedby="username-help"
          />
          <small id="username-help">3–64 karakter: huruf, angka, titik, underscore, strip.</small>
          <FieldError msg={fieldErr} />
        </label>
        <label className="lf-field">
          <span>Display name</span>
          <input
            className="lf-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={64}
            autoComplete="nickname"
            placeholder="Nama tampilan (opsional)"
          />
        </label>
        {error && (
          <div className="lf-error" role="alert">
            {error}
          </div>
        )}
        {ok && (
          <div className="lf-info" role="status">
            {ok}
          </div>
        )}
        <div>
          <button type="submit" className="lf-btn lf-btn--primary" disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={15} className="lf-spin" aria-hidden /> Menyimpan…
              </>
            ) : (
              <>
                <Save size={15} aria-hidden /> Simpan perubahan
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ---------------- Security ---------------- */

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  error?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="lf-field" htmlFor={id}>
      <span>{label}</span>
      <span style={{ position: "relative", display: "block" }}>
        <input
          id={id}
          className="lf-input"
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={6}
          maxLength={128}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          style={{ paddingRight: 44 }}
        />
        <button
          type="button"
          className="lf-icon-btn"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? `Sembunyikan ${label}` : `Tampilkan ${label}`}
          aria-pressed={show}
          title={show ? "Sembunyikan" : "Tampilkan"}
          style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)" }}
        >
          {show ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
        </button>
      </span>
      <FieldError msg={error || ""} />
    </label>
  );
}

function SecurityForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  function validateLocal(): boolean {
    const e: typeof errors = {};
    if (!current) e.current = "Password saat ini wajib diisi.";
    if (next.length < 6) e.next = "Password baru minimal 6 karakter.";
    if (next && next === current) e.next = "Password baru harus berbeda dari password saat ini.";
    if (confirm !== next) e.confirm = "Konfirmasi password tidak sama.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    if (!validateLocal()) return;
    setSaving(true);
    try {
      await updatePassword({ currentPassword: current, newPassword: next, confirmPassword: confirm });
      setCurrent("");
      setNext("");
      setConfirm("");
      setOk("Password berhasil diperbarui.");
    } catch (err: unknown) {
      setError(mapError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="lf-card" style={{ maxWidth: 720 }} onSubmit={onSave}>
      <h3>Security</h3>
      <p className="sub">Perbarui password untuk menjaga keamanan akun.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <PasswordField id="pw-current" label="Password saat ini" value={current} onChange={setCurrent} autoComplete="current-password" error={errors.current} />
        <PasswordField id="pw-new" label="Password baru" value={next} onChange={setNext} autoComplete="new-password" error={errors.next} />
        <PasswordField id="pw-confirm" label="Konfirmasi password baru" value={confirm} onChange={setConfirm} autoComplete="new-password" error={errors.confirm} />
        {error && (
          <div className="lf-error" role="alert">
            <KeyRound size={14} aria-hidden style={{ verticalAlign: "-2px", marginRight: 6 }} />
            {error}
          </div>
        )}
        {ok && (
          <div className="lf-info" role="status">
            {ok}
          </div>
        )}
        <div>
          <button type="submit" className="lf-btn lf-btn--primary" disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={15} className="lf-spin" aria-hidden /> Menyimpan…
              </>
            ) : (
              <>
                <Save size={15} aria-hidden /> Simpan password
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ---------------- Preferences ---------------- */

const THEMES: Array<{ id: ThemePref; label: string; desc: string; Icon: typeof Sun }> = [
  { id: "light", label: "Light", desc: "Terang", Icon: Sun },
  { id: "dark", label: "Dark", desc: "Gelap", Icon: Moon },
  { id: "system", label: "System", desc: "Ikuti perangkat", Icon: Monitor },
];

function PreferencesForm({ initial }: { initial: ThemePref }) {
  const [value, setValue] = useState<ThemePref>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function pick(pref: ThemePref) {
    if (pref === value && !error) return;
    const prev = value;
    setValue(pref);
    setError("");
    setOk("");
    applyTheme(pref);
    cacheTheme(pref);
    setSaving(true);
    try {
      await updatePreferences(pref);
      setOk("Preferensi berhasil diperbarui.");
    } catch (err: unknown) {
      setValue(prev);
      applyTheme(prev);
      cacheTheme(prev);
      setError(mapError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="lf-card" style={{ maxWidth: 720 }}>
      <h3>Preferences</h3>
      <p className="sub">Tampilan aplikasi. Berlaku langsung dan tersimpan di akun.</p>
      <div className="lf-field">
        <span id="theme-label">Theme</span>
        <div className="lf-radio-group" role="radiogroup" aria-labelledby="theme-label">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={value === t.id}
              className={`lf-radio${value === t.id ? " active" : ""}`}
              onClick={() => void pick(t.id)}
              disabled={saving}
            >
              <t.Icon size={18} aria-hidden />
              <span>
                <strong>{t.label}</strong>
                <small>{t.desc}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
      {saving && (
        <p style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", color: "var(--md-sys-color-on-surface-variant)" }}>
          <Loader2 size={14} className="lf-spin" aria-hidden /> Menyimpan…
        </p>
      )}
      {error && (
        <div className="lf-error" role="alert">
          {error}
        </div>
      )}
      {ok && (
        <div className="lf-info" role="status">
          {ok}
        </div>
      )}
    </div>
  );
}
